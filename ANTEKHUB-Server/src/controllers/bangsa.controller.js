// File: src/controllers/bangsa.controller.js
// Tujuan: CRUD master Bangsa (negara) mengikuti gaya alumni.controller
// Catatan: getAll tanpa limit/pagination; dukung filter & search sederhana

const { Op } = require('sequelize');
const { sequelize, Bangsa } = require('../models');

// (Opsional) Validasi sederhana pakai Joi langsung di controller agar mandiri
const Joi = require('joi');
const createSchema = Joi.object({
  nama: Joi.string().max(255).required(),
  iso3: Joi.string().length(3).uppercase().allow(null, ''),
  iso2: Joi.string().length(2).uppercase().allow(null, ''),
  kode_telepon: Joi.number().integer().allow(null),
  region: Joi.string().max(100).allow(null, ''),
  subregion: Joi.string().max(100).allow(null, ''),
  longitude: Joi.number().allow(null),
  latitude: Joi.number().allow(null),
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  nama: Joi.string().max(255),
  iso3: Joi.string().length(3).uppercase().allow(null, ''),
  iso2: Joi.string().length(2).uppercase().allow(null, ''),
  kode_telepon: Joi.number().integer().allow(null),
  region: Joi.string().max(100).allow(null, ''),
  subregion: Joi.string().max(100).allow(null, ''),
  longitude: Joi.number().allow(null),
  latitude: Joi.number().allow(null),
}).min(1).options({ stripUnknown: true });

// ===== Util =====
const sanitizeBangsa = (row) => {
  if (!row) return row;
  const plain = row.get ? row.get({ plain: true }) : row;
  return plain;
};

// Helper: map error DB → http code
function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || '';
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: 'Format UUID tidak valid', detail: msg };
  }
  // unique constraint (nama unik)
  if (/duplicate key value violates unique constraint/i.test(msg) || /unique constraint/i.test(msg)) {
    return { status: 409, message: 'Data duplikat (unik terlanggar)', detail: msg };
  }
  return null;
}

// ====== ADD ======
exports.add = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });

    const row = await Bangsa.create({
      nama: payload.nama,
      iso3: payload.iso3 || null,
      iso2: payload.iso2 || null,
      kode_telepon: typeof payload.kode_telepon === 'number' ? payload.kode_telepon : null,
      region: payload.region || null,
      subregion: payload.subregion || null,
      longitude: typeof payload.longitude === 'number' ? payload.longitude : null,
      latitude: typeof payload.latitude === 'number' ? payload.latitude : null,
    }, { transaction: t });

    await t.commit();
    return res.status(201).json({ message: 'Bangsa dibuat', data: sanitizeBangsa(row) });
  } catch (err) {
    await t.rollback();

    if (err.isJoi) {
      return res.status(422).json({
        message: 'Validasi gagal',
        errors: err.details.map(d => ({ path: d.path.join('.'), message: d.message }))
      });
    }

    const mapped = mapSequelizeError(err);
    if (mapped) {
      return res.status(mapped.status).json({ message: mapped.message, detail: mapped.detail });
    }

    console.error('bangsa.add error:', err);
    return res.status(500).json({ message: 'Gagal membuat bangsa' });
  }
};

// ====== GET ALL (master table → TANPA LIMIT/PAGINATION) ======
// Query opsional:
//   search=... (iLike ke nama)
//   region=... (boleh banyak: ?region=Asia&region=Eropa)
//   iso2=ID (boleh banyak)
//   iso3=IDN (boleh banyak)
//   kode_telepon=62 (boleh banyak)
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();

    const regions = ([]).concat(req.query.region || []).filter(Boolean);
    const iso2s = ([]).concat(req.query.iso2 || []).filter(Boolean).map(s => String(s).toUpperCase());
    const iso3s = ([]).concat(req.query.iso3 || []).filter(Boolean).map(s => String(s).toUpperCase());
    const telephones = ([]).concat(req.query.kode_telepon || []).filter(v => v !== '').map(Number).filter(n => !Number.isNaN(n));

    const where = {};
    if (search) where.nama = { [Op.iLike]: `%${search}%` };
    if (regions.length) where.region = { [Op.in]: regions };
    if (iso2s.length) where.iso2 = { [Op.in]: iso2s };
    if (iso3s.length) where.iso3 = { [Op.in]: iso3s };
    if (telephones.length) where.kode_telepon = { [Op.in]: telephones };

    const rows = await Bangsa.findAll({
      where,
      order: [['nama', 'ASC']], // master → urut by nama
    });

    return res.json({
      data: rows.map(sanitizeBangsa),
      meta: { total: rows.length } // tanpa page/limit
    });
  } catch (err) {
    console.error('bangsa.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data bangsa' });
  }
};

// ====== GET ONE by uuid ======
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await Bangsa.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Bangsa tidak ditemukan' });
    return res.json({ data: sanitizeBangsa(row) });
  } catch (err) {
    console.error('bangsa.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data bangsa' });
  }
};

// ====== UPDATE by uuid (parsial) ======
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await Bangsa.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Bangsa tidak ditemukan' });

    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });

    const update = {};
    ['nama','iso3','iso2','kode_telepon','region','subregion','longitude','latitude'].forEach(k => {
      if (typeof payload[k] !== 'undefined') {
        // normalisasi null untuk string kosong
        if (['iso3','iso2','region','subregion'].includes(k) && (payload[k] === '' || payload[k] === null)) {
          update[k] = null;
        } else {
          update[k] = payload[k];
        }
      }
    });

    await row.update(update, { transaction: t });
    await t.commit();
    return res.json({ message: 'Bangsa diperbarui', data: sanitizeBangsa(row) });
  } catch (err) {
    await t.rollback();

    if (err.isJoi) {
      return res.status(422).json({
        message: 'Validasi gagal',
        errors: err.details.map(d => ({ path: d.path.join('.'), message: d.message }))
      });
    }

    const mapped = mapSequelizeError(err);
    if (mapped) {
      return res.status(mapped.status).json({ message: mapped.message, detail: mapped.detail });
    }

    console.error('bangsa.update error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui bangsa' });
  }
};

// ====== DELETE by uuid (single / batch "a,b,c") ======
exports.deleteByUuid = async (req, res) => {
  try {
    let uuids = [];

    if (req.params.uuid) {
      uuids = req.params.uuid.split(',').map(v => v.trim()).filter(Boolean);
    } else if (Array.isArray(req.body.uuids)) {
      uuids = req.body.uuids.filter(Boolean);
    }

    if (!uuids.length)
      return res.status(400).json({ message: 'UUID tidak diberikan' });

    const found = await Bangsa.findAll({
      where: { uuid: { [Op.in]: uuids } },
      attributes: ['uuid']
    });

    if (!found.length)
      return res.status(404).json({ message: 'Data bangsa tidak ditemukan' });

    const deleted = await Bangsa.destroy({
      where: { uuid: { [Op.in]: uuids } }
    });

    return res.json({
      message: `Berhasil menghapus ${deleted} data bangsa`,
      deleted,
      uuids
    });
  } catch (err) {
    console.error('bangsa.deleteByUuid error:', err);
    return res.status(500).json({
      message: 'Gagal menghapus bangsa',
      detail: err.message
    });
  }
};

// ====== DELETE ALL (hati-hati; lindungi dengan role ketat) ======
exports.deleteAll = async (_req, res) => {
  try {
    const del = await Bangsa.destroy({ where: {} });
    return res.json({ message: 'Semua bangsa terhapus', deleted: del });
  } catch (err) {
    console.error('bangsa.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua bangsa', detail: err.message });
  }
};

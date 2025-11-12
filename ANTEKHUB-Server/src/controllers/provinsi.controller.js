// File: src/controllers/provinsi.controller.js
// Tujuan: CRUD master Provinsi mengikuti gaya bangsa.controller (tanpa pagination)
// Catatan: unik pada (bangsa_id, nama)

const { Op } = require('sequelize');
const { sequelize, Provinsi } = require('../models');
const Joi = require('joi');

// ===== Validasi =====
const createSchema = Joi.object({
  bangsa_id: Joi.number().integer().required(),
  nama: Joi.string().max(255).required(),
  iso2: Joi.string().max(50).allow(null, ''),
  iso3166_2: Joi.string().max(50).allow(null, ''),
  longitude: Joi.number().allow(null),
  latitude: Joi.number().allow(null),
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  bangsa_id: Joi.number().integer(), // opsional, boleh pindah negara
  nama: Joi.string().max(255),
  iso2: Joi.string().max(50).allow(null, ''),
  iso3166_2: Joi.string().max(50).allow(null, ''),
  longitude: Joi.number().allow(null),
  latitude: Joi.number().allow(null),
}).min(1).options({ stripUnknown: true });

// ===== Util =====
const sanitize = (row) => (row?.get ? row.get({ plain: true }) : row);

function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || '';
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: 'Format UUID tidak valid', detail: msg };
  }
  // unique (bangsa_id, nama)
  if (/duplicate key value violates unique constraint/i.test(msg) || /uq_provinsi_bangsa_nama/i.test(msg)) {
    return { status: 409, message: 'Data duplikat: kombinasi bangsa_id & nama sudah ada', detail: msg };
  }
  return null;
}

// ===== Create =====
exports.add = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });

    const created = await Provinsi.create(
      {
        bangsa_id: payload.bangsa_id,
        nama: payload.nama,
        iso2: payload.iso2 || null,
        iso3166_2: payload.iso3166_2 || null,
        longitude: typeof payload.longitude === 'number' ? payload.longitude : null,
        latitude: typeof payload.latitude === 'number' ? payload.latitude : null,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ message: 'Provinsi dibuat', data: sanitize(created) });
  } catch (err) {
    await t.rollback();

    if (err.isJoi) {
      return res.status(422).json({
        message: 'Validasi gagal',
        errors: err.details.map((d) => ({ path: d.path.join('.'), message: d.message })),
      });
    }

    const mapped = mapSequelizeError(err);
    if (mapped) return res.status(mapped.status).json({ message: mapped.message, detail: mapped.detail });

    console.error('provinsi.add error:', err);
    return res.status(500).json({ message: 'Gagal membuat provinsi' });
  }
};

// ===== Read All (tanpa pagination) =====
// Query opsional:
//   search=... (iLike nama)
//   bangsa_id=1&bangsa_id=2 (multi)
//   iso2=... (multi)
//   iso3166_2=... (multi)
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const bangsaIds = ([]).concat(req.query.bangsa_id || []).filter((v) => v !== '').map(Number).filter((n) => !Number.isNaN(n));
    const iso2s = ([]).concat(req.query.iso2 || []).filter(Boolean);
    const isoCodes = ([]).concat(req.query.iso3166_2 || []).filter(Boolean);

    const where = {};
    if (search) where.nama = { [Op.iLike]: `%${search}%` };
    if (bangsaIds.length) where.bangsa_id = { [Op.in]: bangsaIds };
    if (iso2s.length) where.iso2 = { [Op.in]: iso2s };
    if (isoCodes.length) where.iso3166_2 = { [Op.in]: isoCodes };

    const rows = await Provinsi.findAll({
      where,
      order: [
        ['bangsa_id', 'ASC'],
        ['nama', 'ASC'],
      ],
    });

    return res.json({ data: rows.map(sanitize), meta: { total: rows.length } });
  } catch (err) {
    console.error('provinsi.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data provinsi' });
  }
};

// GET ALL by UUID Bangsa (tanpa pagination)
// Path yang direkomendasikan: /api/negara/:bangsa_uuid/provinsi
exports.getAllByBangsaUuid = async (req, res) => {
  try {
    const { Bangsa, Provinsi } = require('../models'); // pastikan Bangsa tersedia
    const { bangsa_uuid } = req.params;

    // Opsional: filter tambahan sama seperti getAll (search, iso2, iso3166_2)
    const { Op } = require('sequelize');
    const search = (req.query.search || '').trim();
    const iso2s = ([]).concat(req.query.iso2 || []).filter(Boolean);
    const isoCodes = ([]).concat(req.query.iso3166_2 || []).filter(Boolean);

    const negara = await Bangsa.findOne({ where: { uuid: bangsa_uuid } });
    if (!negara) return res.status(404).json({ message: 'Negara (bangsa) tidak ditemukan' });

    const where = { bangsa_id: negara.id };
    if (search) where.nama = { [Op.iLike]: `%${search}%` };
    if (iso2s.length) where.iso2 = { [Op.in]: iso2s };
    if (isoCodes.length) where.iso3166_2 = { [Op.in]: isoCodes };

    const rows = await Provinsi.findAll({
      where,
      order: [['nama', 'ASC']],
    });

    const sanitize = (row) => (row?.get ? row.get({ plain: true }) : row);
    return res.json({
      data: rows.map(sanitize),
      meta: { total: rows.length, bangsa_uuid }
    });
  } catch (err) {
    console.error('provinsi.getAllByBangsaUuid error:', err);
    return res.status(500).json({ message: 'Gagal mengambil daftar provinsi berdasarkan negara' });
  }
};


// ===== Read One =====
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await Provinsi.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Provinsi tidak ditemukan' });
    return res.json({ data: sanitize(row) });
  } catch (err) {
    console.error('provinsi.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data provinsi' });
  }
};

// ===== Update (parsial) =====
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await Provinsi.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Provinsi tidak ditemukan' });

    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });

    const update = {};
    ['bangsa_id', 'nama', 'iso2', 'iso3166_2', 'longitude', 'latitude'].forEach((k) => {
      if (typeof payload[k] !== 'undefined') {
        if (['iso2', 'iso3166_2'].includes(k) && (payload[k] === '' || payload[k] === null)) {
          update[k] = null;
        } else {
          update[k] = payload[k];
        }
      }
    });

    await row.update(update, { transaction: t });
    await t.commit();
    return res.json({ message: 'Provinsi diperbarui', data: sanitize(row) });
  } catch (err) {
    await t.rollback();

    if (err.isJoi) {
      return res.status(422).json({
        message: 'Validasi gagal',
        errors: err.details.map((d) => ({ path: d.path.join('.'), message: d.message })),
      });
    }

    const mapped = mapSequelizeError(err);
    if (mapped) return res.status(mapped.status).json({ message: mapped.message, detail: mapped.detail });

    console.error('provinsi.update error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui provinsi' });
  }
};

// ===== Delete single/batch =====
exports.deleteByUuid = async (req, res) => {
  try {
    let uuids = [];
    if (req.params.uuid) {
      uuids = req.params.uuid.split(',').map((v) => v.trim()).filter(Boolean);
    } else if (Array.isArray(req.body.uuids)) {
      uuids = req.body.uuids.filter(Boolean);
    }
    if (!uuids.length) return res.status(400).json({ message: 'UUID tidak diberikan' });

    const found = await Provinsi.findAll({ where: { uuid: { [Op.in]: uuids } }, attributes: ['uuid'] });
    if (!found.length) return res.status(404).json({ message: 'Data provinsi tidak ditemukan' });

    const deleted = await Provinsi.destroy({ where: { uuid: { [Op.in]: uuids } } });
    return res.json({ message: `Berhasil menghapus ${deleted} data provinsi`, deleted, uuids });
  } catch (err) {
    console.error('provinsi.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus provinsi', detail: err.message });
  }
};

// ===== Delete all (hati-hati) =====
exports.deleteAll = async (_req, res) => {
  try {
    const del = await Provinsi.destroy({ where: {} });
    return res.json({ message: 'Semua provinsi terhapus', deleted: del });
  } catch (err) {
    console.error('provinsi.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua provinsi', detail: err.message });
  }
};

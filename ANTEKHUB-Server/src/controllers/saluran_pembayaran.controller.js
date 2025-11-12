// File: src/controllers/saluran_pembayaran.controller.js
// Tujuan: CRUD master "SaluranPembayaran" (tanpa pagination, gaya seperti provinsi.controller)
// Catatan: unik logis pada kode_saluran; relasi ke MetodePembayaran via metode_pembayaran_id

const { Op } = require('sequelize');
const Joi = require('joi');
const { sequelize, SaluranPembayaran } = require('../models');

// ===== Validasi =====
const createSchema = Joi.object({
  metode_pembayaran_id: Joi.number().integer().required(),
  kode_saluran: Joi.string().max(50).trim().required(), // e.g. BRI_VA, OVO, QRIS
  nama: Joi.string().max(100).trim().required(),
  active: Joi.boolean().optional(), // default true
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  metode_pembayaran_id: Joi.number().integer(),
  kode_saluran: Joi.string().max(50).trim(),
  nama: Joi.string().max(100).trim(),
  active: Joi.boolean(),
}).min(1).options({ stripUnknown: true });

// ===== Util =====
const sanitize = (row) => (row?.get ? row.get({ plain: true }) : row);

function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || '';
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: 'Format UUID tidak valid', detail: msg };
  }
  if (/duplicate key value/i.test(msg) || /unique constraint/i.test(msg)) {
    return { status: 409, message: 'Data duplikat: kode_saluran sudah ada', detail: msg };
  }
  if (/violates foreign key constraint/i.test(msg)) {
    return { status: 422, message: 'metode_pembayaran_id tidak valid (FK gagal)', detail: msg };
  }
  return null;
}

// ===== Create =====
exports.add = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });

    const created = await SaluranPembayaran.create(
      {
        metode_pembayaran_id: payload.metode_pembayaran_id,
        kode_saluran: payload.kode_saluran,
        nama: payload.nama,
        active: typeof payload.active === 'boolean' ? payload.active : true,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ message: 'Saluran pembayaran dibuat', data: sanitize(created) });
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

    console.error('saluran_pembayaran.add error:', err);
    return res.status(500).json({ message: 'Gagal membuat saluran pembayaran' });
  }
};

// ===== Read All (tanpa pagination) =====
// Query opsional:
//   search=...                         → iLike ke nama/kode_saluran
//   metode_pembayaran_id=1&... (multi) → filter FK
//   kode_saluran=BRI_VA&... (multi)    → exact
//   active=true|false                  → boolean
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const metodeIds = ([]).concat(req.query.metode_pembayaran_id || [])
      .filter((v) => v !== '').map(Number).filter((n) => !Number.isNaN(n));
    const kodeList = ([]).concat(req.query.kode_saluran || []).map((v) => String(v).trim()).filter(Boolean);
    const activeParam = req.query.active;

    const where = {};
    if (search) {
      where[Op.or] = [
        { nama: { [Op.iLike]: `%${search}%` } },
        { kode_saluran: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (metodeIds.length) where.metode_pembayaran_id = { [Op.in]: metodeIds };
    if (kodeList.length) where.kode_saluran = { [Op.in]: kodeList };
    if (typeof activeParam !== 'undefined') {
      if (['true', 'false'].includes(String(activeParam).toLowerCase())) {
        where.active = String(activeParam).toLowerCase() === 'true';
      }
    }

    const rows = await SaluranPembayaran.findAll({
      where,
      order: [
        ['metode_pembayaran_id', 'ASC'],
        ['nama', 'ASC'],
      ],
    });

    return res.json({ data: rows.map(sanitize), meta: { total: rows.length } });
  } catch (err) {
    console.error('saluran_pembayaran.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data saluran pembayaran' });
  }
};

// ===== Read All by UUID MetodePembayaran (tanpa pagination) =====
// Disarankan rute di parent: /api/metode-pembayaran/:metode_uuid/saluran-pembayaran
exports.getAllByMetodeUuid = async (req, res) => {
  try {
    const { MetodePembayaran, SaluranPembayaran } = require('../models');
    const { metode_uuid } = req.params;

    const metode = await MetodePembayaran.findOne({ where: { uuid: metode_uuid } });
    if (!metode) return res.status(404).json({ message: 'Metode pembayaran tidak ditemukan' });

    // re-use filter ringan
    const search = (req.query.search || '').trim();
    const where = { metode_pembayaran_id: metode.id };
    if (search) {
      where[Op.or] = [
        { nama: { [Op.iLike]: `%${search}%` } },
        { kode_saluran: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const rows = await SaluranPembayaran.findAll({ where, order: [['nama', 'ASC']] });
    return res.json({ data: rows.map(sanitize), meta: { total: rows.length, metode_uuid } });
  } catch (err) {
    console.error('saluran_pembayaran.getAllByMetodeUuid error:', err);
    return res.status(500).json({ message: 'Gagal mengambil daftar saluran pembayaran berdasarkan metode' });
  }
};

// ===== Read One =====
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await SaluranPembayaran.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Saluran pembayaran tidak ditemukan' });
    return res.json({ data: sanitize(row) });
  } catch (err) {
    console.error('saluran_pembayaran.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil detail saluran pembayaran' });
  }
};

// ===== Update (parsial) =====
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await SaluranPembayaran.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Saluran pembayaran tidak ditemukan' });

    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });

    const update = {};
    ['metode_pembayaran_id', 'kode_saluran', 'nama', 'active'].forEach((k) => {
      if (typeof payload[k] !== 'undefined') {
        update[k] = payload[k];
      }
    });

    await row.update(update, { transaction: t });
    await t.commit();
    return res.json({ message: 'Saluran pembayaran diperbarui', data: sanitize(row) });
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

    console.error('saluran_pembayaran.update error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui saluran pembayaran' });
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

    const found = await SaluranPembayaran.findAll({
      where: { uuid: { [Op.in]: uuids } },
      attributes: ['uuid'],
    });
    if (!found.length) return res.status(404).json({ message: 'Data saluran pembayaran tidak ditemukan' });

    const deleted = await SaluranPembayaran.destroy({ where: { uuid: { [Op.in]: uuids } } });
    return res.json({ message: `Berhasil menghapus ${deleted} data saluran pembayaran`, deleted, uuids });
  } catch (err) {
    console.error('saluran_pembayaran.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus saluran pembayaran', detail: err.message });
  }
};

// ===== Delete all (hati-hati) =====
exports.deleteAll = async (_req, res) => {
  try {
    const del = await SaluranPembayaran.destroy({ where: {} });
    return res.json({ message: 'Semua saluran pembayaran terhapus', deleted: del });
  } catch (err) {
    console.error('saluran_pembayaran.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua saluran pembayaran', detail: err.message });
  }
};

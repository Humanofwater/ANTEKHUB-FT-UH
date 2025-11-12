// File: src/controllers/metode_pembayaran.controller.js
// Tujuan: CRUD master "MetodePembayaran" (tanpa pagination; gaya mengikuti bangsa.controller)

const { Op } = require('sequelize');
const Joi = require('joi');
const { sequelize, MetodePembayaran } = require('../models');

// ===== Validasi =====
const createSchema = Joi.object({
  kode_metode: Joi.string().max(50).trim().required(), // e.g. VA, QRIS, E-WALLET
  nama: Joi.string().max(100).trim().required(),
  active: Joi.boolean().optional(),
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  kode_metode: Joi.string().max(50).trim(),
  nama: Joi.string().max(100).trim(),
  active: Joi.boolean(),
}).min(1).options({ stripUnknown: true });

// ===== Util =====
const toPlain = (row) => (row?.get ? row.get({ plain: true }) : row);
function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || '';
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: 'Format UUID tidak valid', detail: msg };
  }
  if (/duplicate key value/i.test(msg) || /unique constraint/i.test(msg)) {
    return { status: 409, message: 'Kode metode sudah terdaftar', detail: msg };
  }
  return null;
}

// =========================
// CREATE (Add)
// =========================
exports.add = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });

    const created = await MetodePembayaran.create(
      {
        kode_metode: payload.kode_metode,
        nama: payload.nama,
        active: typeof payload.active === 'boolean' ? payload.active : true,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ message: 'Metode pembayaran dibuat', data: toPlain(created) });
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

    console.error('metode_pembayaran.add error:', err);
    return res.status(500).json({ message: 'Gagal membuat metode pembayaran' });
  }
};

// =========================
// GET ALL (tanpa pagination)
// Query:
//   search=...           → iLike ke nama/kode_metode
//   active=true|false    → filter boolean
//   kode_metode=VA&...   → multi exact
// =========================
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const activeParam = req.query.active;
    const kodeParams = [].concat(req.query.kode_metode || []).map((v) => String(v).trim()).filter(Boolean);

    const where = {};
    if (search) {
      where[Op.or] = [
        { nama: { [Op.iLike]: `%${search}%` } },
        { kode_metode: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (typeof activeParam !== 'undefined') {
      if (['true', 'false'].includes(String(activeParam).toLowerCase())) {
        where.active = String(activeParam).toLowerCase() === 'true';
      }
    }
    if (kodeParams.length) {
      where.kode_metode = { [Op.in]: kodeParams };
    }

    const rows = await MetodePembayaran.findAll({
      where,
      order: [['nama', 'ASC']],
    });

    return res.json({ data: rows.map(toPlain), meta: { total: rows.length } });
  } catch (err) {
    console.error('metode_pembayaran.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data metode pembayaran' });
  }
};

// =========================
// GET ONE by uuid
// =========================
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await MetodePembayaran.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Metode pembayaran tidak ditemukan' });
    return res.json({ data: toPlain(row) });
  } catch (err) {
    console.error('metode_pembayaran.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil detail metode pembayaran' });
  }
};

// =========================
// UPDATE by uuid
// =========================
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await MetodePembayaran.findOne({ where: { uuid }, transaction: t });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: 'Metode pembayaran tidak ditemukan' });
    }

    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });

    const update = {};
    if (Object.prototype.hasOwnProperty.call(payload, 'kode_metode')) update.kode_metode = payload.kode_metode;
    if (Object.prototype.hasOwnProperty.call(payload, 'nama')) update.nama = payload.nama;
    if (Object.prototype.hasOwnProperty.call(payload, 'active')) update.active = payload.active;

    await row.update(update, { transaction: t });
    await t.commit();
    return res.json({ message: 'Metode pembayaran diperbarui', data: toPlain(row) });
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

    console.error('metode_pembayaran.update error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui metode pembayaran' });
  }
};

// =========================
// DELETE single/batch by uuid
//  - DELETE /metode-pembayaran/:uuid           -> hapus satu (atau comma-separated)
//  - DELETE /metode-pembayaran                 -> body { uuids: [..] }
// =========================
exports.deleteByUuid = async (req, res) => {
  try {
    let uuids = [];
    if (req.params.uuid) {
      uuids = req.params.uuid.split(',').map((v) => v.trim()).filter(Boolean);
    } else if (Array.isArray(req.body.uuids)) {
      uuids = req.body.uuids.filter(Boolean);
    }
    if (!uuids.length) return res.status(400).json({ message: 'UUID tidak diberikan' });

    const deleted = await MetodePembayaran.destroy({ where: { uuid: { [Op.in]: uuids } } });
    if (!deleted) return res.status(404).json({ message: 'Data metode pembayaran tidak ditemukan' });

    return res.json({ message: `Berhasil menghapus ${deleted} data metode pembayaran`, deleted, uuids });
  } catch (err) {
    console.error('metode_pembayaran.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus metode pembayaran', detail: err.message });
  }
};

// =========================
// DELETE ALL (hati-hati)
// =========================
exports.deleteAll = async (_req, res) => {
  try {
    const del = await MetodePembayaran.destroy({ where: {} });
    return res.json({ message: 'Semua metode pembayaran terhapus', deleted: del });
  } catch (err) {
    console.error('metode_pembayaran.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua metode pembayaran', detail: err.message });
  }
};

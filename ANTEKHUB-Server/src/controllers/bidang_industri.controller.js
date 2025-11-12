// File: src/controllers/bidang_industri.controller.js
// Tujuan: CRUD master "BidangIndustri" (tanpa pagination; gaya mengikuti bangsa.controller)

const { Op } = require('sequelize');
const { sequelize, BidangIndustri } = require('../models');
const Joi = require('joi');

// ===== Validasi =====
const createSchema = Joi.object({
  kode: Joi.string().max(50).trim().allow(null, ''),
  nama: Joi.string().max(255).trim().required(),
  deskripsi: Joi.string().allow(null, ''),
  active: Joi.boolean().optional(), // default true
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  kode: Joi.string().max(50).trim().allow(null, ''),
  nama: Joi.string().max(255).trim(),
  deskripsi: Joi.string().allow(null, ''),
  active: Joi.boolean(),
}).min(1).options({ stripUnknown: true });

// ===== Util =====
const toPlain = (row) => (row?.get ? row.get({ plain: true }) : row);

function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || '';
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: 'Format UUID tidak valid', detail: msg };
  }
  // unique constraint (nama unik)
  if (/duplicate key value/i.test(msg) || /unique constraint/i.test(msg)) {
    return { status: 409, message: 'Data duplikat (nama sudah terdaftar)', detail: msg };
  }
  return null;
}

// ===== ADD =====
exports.add = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });

    const row = await BidangIndustri.create(
      {
        kode: payload.kode || null,
        nama: payload.nama,
        deskripsi: payload.deskripsi?.trim?.() || null,
        active: typeof payload.active === 'boolean' ? payload.active : true,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ message: 'Bidang industri dibuat', data: toPlain(row) });
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

    console.error('bidang_industri.add error:', err);
    return res.status(500).json({ message: 'Gagal membuat bidang industri' });
  }
};

// ===== GET ALL (master: tanpa limit/pagination) =====
// Query opsional:
//   search=...                → iLike ke nama/kode/deskripsi
//   active=true|false         → filter boolean
//   kode=FINTECH&kode=HEALTH  → multi exact
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const aktifParam = req.query.active;
    const kodes = ([]).concat(req.query.kode || []).map((v) => String(v).trim()).filter(Boolean);

    const where = {};
    if (search) {
      where[Op.or] = [
        { nama: { [Op.iLike]: `%${search}%` } },
        { kode: { [Op.iLike]: `%${search}%` } },
        { deskripsi: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (typeof aktifParam !== 'undefined') {
      const s = String(aktifParam).toLowerCase();
      if (s === 'true' || s === 'false') where.active = s === 'true';
    }
    if (kodes.length) where.kode = { [Op.in]: kodes };

    const rows = await BidangIndustri.findAll({
      where,
      order: [['nama', 'ASC']],
    });

    return res.json({ data: rows.map(toPlain), meta: { total: rows.length } });
  } catch (err) {
    console.error('bidang_industri.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data bidang industri' });
  }
};

// ===== GET ONE by uuid =====
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await BidangIndustri.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Bidang industri tidak ditemukan' });
    return res.json({ data: toPlain(row) });
  } catch (err) {
    console.error('bidang_industri.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil detail bidang industri' });
  }
};

// ===== UPDATE by uuid (parsial) =====
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await BidangIndustri.findOne({ where: { uuid } });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: 'Bidang industri tidak ditemukan' });
    }

    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });

    const update = {};
    if (Object.prototype.hasOwnProperty.call(payload, 'kode')) update.kode = payload.kode || null;
    if (Object.prototype.hasOwnProperty.call(payload, 'nama')) update.nama = payload.nama;
    if (Object.prototype.hasOwnProperty.call(payload, 'deskripsi')) update.deskripsi = payload.deskripsi || null;
    if (Object.prototype.hasOwnProperty.call(payload, 'active')) update.active = payload.active;

    await row.update(update, { transaction: t });
    await t.commit();
    return res.json({ message: 'Bidang industri diperbarui', data: toPlain(row) });
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

    console.error('bidang_industri.update error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui bidang industri' });
  }
};

// ===== DELETE single/batch by uuid =====
exports.deleteByUuid = async (req, res) => {
  try {
    let uuids = [];
    if (req.params.uuid) {
      uuids = req.params.uuid.split(',').map((v) => v.trim()).filter(Boolean);
    } else if (Array.isArray(req.body.uuids)) {
      uuids = req.body.uuids.filter(Boolean);
    }
    if (!uuids.length) return res.status(400).json({ message: 'UUID tidak diberikan' });

    const found = await BidangIndustri.findAll({ where: { uuid: { [Op.in]: uuids } }, attributes: ['uuid'] });
    if (!found.length) return res.status(404).json({ message: 'Data bidang industri tidak ditemukan' });

    const deleted = await BidangIndustri.destroy({ where: { uuid: { [Op.in]: uuids } } });
    return res.json({ message: `Berhasil menghapus ${deleted} data bidang industri`, deleted, uuids });
  } catch (err) {
    console.error('bidang_industri.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus bidang industri', detail: err.message });
  }
};

// ===== DELETE ALL (hati-hati) =====
exports.deleteAll = async (_req, res) => {
  try {
    const del = await BidangIndustri.destroy({ where: {} });
    return res.json({ message: 'Semua bidang industri terhapus', deleted: del });
  } catch (err) {
    console.error('bidang_industri.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua bidang industri', detail: err.message });
  }
};

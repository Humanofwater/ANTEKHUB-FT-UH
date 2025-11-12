// File: src/controllers/bank.controller.js
// Tujuan: CRUD master Bank (tanpa pagination; gaya mengikuti bangsa.controller)

const { Op } = require('sequelize');
const { sequelize, Bank } = require('../models');
const Joi = require('joi');

// ===== Validasi =====
const createSchema = Joi.object({
  nama: Joi.string().max(255).trim().required(),
  kategori: Joi.string().max(50).trim().allow(null, ''), // contoh: BANK / E-WALLET / GATEWAY
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  nama: Joi.string().max(255).trim(),
  kategori: Joi.string().max(50).trim().allow(null, ''),
}).min(1).options({ stripUnknown: true });

// ===== Util =====
const toPlain = (row) => (row?.get ? row.get({ plain: true }) : row);

function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || '';
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: 'Format UUID tidak valid', detail: msg };
  }
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

    const row = await Bank.create(
      {
        nama: payload.nama,
        kategori: payload.kategori || null,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ message: 'Bank dibuat', data: toPlain(row) });
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

    console.error('bank.add error:', err);
    return res.status(500).json({ message: 'Gagal membuat bank' });
  }
};

// ===== GET ALL (master; tanpa pagination) =====
// Query opsional:
//   search=... (iLike nama)
//   kategori=BANK&kategori=E-WALLET (multi)
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const kategoris = ([]).concat(req.query.kategori || []).map((v) => String(v).trim()).filter(Boolean);

    const where = {};
    if (search) where.nama = { [Op.iLike]: `%${search}%` };
    if (kategoris.length) where.kategori = { [Op.in]: kategoris };

    const rows = await Bank.findAll({ where, order: [['nama', 'ASC']] });
    return res.json({ data: rows.map(toPlain), meta: { total: rows.length } });
  } catch (err) {
    console.error('bank.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data bank' });
  }
};

// ===== GET ONE by uuid =====
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await Bank.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Bank tidak ditemukan' });
    return res.json({ data: toPlain(row) });
  } catch (err) {
    console.error('bank.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil detail bank' });
  }
};

// ===== UPDATE by uuid =====
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await Bank.findOne({ where: { uuid } });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: 'Bank tidak ditemukan' });
    }

    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });

    const update = {};
    if (Object.prototype.hasOwnProperty.call(payload, 'nama')) update.nama = payload.nama;
    if (Object.prototype.hasOwnProperty.call(payload, 'kategori')) {
      update.kategori = payload.kategori || null; // kosong → null
    }

    await row.update(update, { transaction: t });
    await t.commit();
    return res.json({ message: 'Bank diperbarui', data: toPlain(row) });
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

    console.error('bank.update error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui bank' });
  }
};

// ===== DELETE single / batch by uuid =====
exports.deleteByUuid = async (req, res) => {
  try {
    let uuids = [];

    if (req.params.uuid) {
      uuids = req.params.uuid.split(',').map((v) => v.trim()).filter(Boolean);
    } else if (Array.isArray(req.body.uuids)) {
      uuids = req.body.uuids.filter(Boolean);
    }

    if (!uuids.length) return res.status(400).json({ message: 'UUID tidak diberikan' });

    const found = await Bank.findAll({ where: { uuid: { [Op.in]: uuids } }, attributes: ['uuid'] });
    if (!found.length) return res.status(404).json({ message: 'Data bank tidak ditemukan' });

    const deleted = await Bank.destroy({ where: { uuid: { [Op.in]: uuids } } });
    return res.json({ message: `Berhasil menghapus ${deleted} data bank`, deleted, uuids });
  } catch (err) {
    console.error('bank.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus bank', detail: err.message });
  }
};

// ===== DELETE ALL (hati-hati) =====
exports.deleteAll = async (_req, res) => {
  try {
    const del = await Bank.destroy({ where: {} });
    return res.json({ message: 'Semua bank terhapus', deleted: del });
  } catch (err) {
    console.error('bank.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua bank', detail: err.message });
  }
};

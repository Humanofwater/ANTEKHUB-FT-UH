// File: src/controllers/rekening.controller.js
// Tujuan: CRUD master "Rekening" (tanpa pagination, gaya seperti provinsi.controller)
// Catatan: unik logis pada (bank_id, nomor_rekening); relasi ke Bank via bank_id

const { Op } = require('sequelize');
const Joi = require('joi');
const { sequelize, Rekening, Bank } = require('../models');

// ===== Validasi =====
const createSchema = Joi.object({
  bank_id: Joi.number().integer().allow(null),              // boleh null (rekening umum)
  nama_rekening: Joi.string().max(255).trim().required(),
  nomor_rekening: Joi.string().max(255).trim().required(),
  deskripsi: Joi.string().allow('', null),
  aktif: Joi.boolean().optional(),                           // default true
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  bank_id: Joi.number().integer().allow(null),
  nama_rekening: Joi.string().max(255).trim(),
  nomor_rekening: Joi.string().max(255).trim(),
  deskripsi: Joi.string().allow('', null),
  aktif: Joi.boolean(),
}).min(1).options({ stripUnknown: true });

// ===== Util =====
const toPlain = (row) => (row?.get ? row.get({ plain: true }) : row);

function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || '';

  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: 'Format UUID tidak valid', detail: msg };
  }
  if (/duplicate key value/i.test(msg) || /unique constraint/i.test(msg)) {
    // (bank_id, nomor_rekening) unik
    return { status: 409, message: 'Nomor rekening sudah terdaftar untuk bank tersebut', detail: msg };
  }
  if (/violates foreign key constraint/i.test(msg)) {
    return { status: 422, message: 'bank_id tidak valid (FK gagal)', detail: msg };
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

    const row = await Rekening.create(
      {
        bank_id: payload.bank_id ?? null,
        nama_rekening: payload.nama_rekening,
        nomor_rekening: payload.nomor_rekening,
        deskripsi: typeof payload.deskripsi === 'string' ? payload.deskripsi : null,
        aktif: typeof payload.aktif === 'boolean' ? payload.aktif : true,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ message: 'Rekening dibuat', data: toPlain(row) });
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

    console.error('rekening.add error:', err);
    return res.status(500).json({ message: 'Gagal membuat rekening' });
  }
};

// =========================
// GET ALL (tanpa pagination)
// Query opsional:
//   search=...                         → iLike ke nama_rekening / nomor_rekening / deskripsi
//   bank_id=1&bank_id=2 (multi)        → filter FK
//   nomor_rekening=12345 (multi exact)
//   aktif=true|false                   → boolean
// =========================
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();

    const bankIds = ([]).concat(req.query.bank_id || [])
      .map((v) => (v === '' || v === null ? null : Number(v)))
      .filter((v) => v === null || !Number.isNaN(v));

    const noreks = ([]).concat(req.query.nomor_rekening || [])
      .map((v) => String(v).trim()).filter(Boolean);

    const aktifParam = req.query.aktif;

    const where = {};
    if (search) {
      where[Op.or] = [
        { nama_rekening: { [Op.iLike]: `%${search}%` } },
        { nomor_rekening: { [Op.iLike]: `%${search}%` } },
        { deskripsi: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (bankIds.length) {
      // Jika ada null di filter → cari bank_id IS NULL juga
      const withNull = bankIds.includes(null);
      where.bank_id = withNull
        ? { [Op.or]: [ { [Op.in]: bankIds.filter((x) => x !== null) }, null ] }
        : { [Op.in]: bankIds };
    }
    if (noreks.length) where.nomor_rekening = { [Op.in]: noreks };
    if (typeof aktifParam !== 'undefined') {
      const v = String(aktifParam).toLowerCase();
      if (v === 'true' || v === 'false') where.aktif = v === 'true';
    }

    const rows = await Rekening.findAll({
      where,
      order: [
        ['bank_id', 'ASC'],
        ['nama_rekening', 'ASC'],
      ],
    });

    return res.json({ data: rows.map(toPlain), meta: { total: rows.length } });
  } catch (err) {
    console.error('rekening.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data rekening' });
  }
};

// =========================
// GET ALL by Bank UUID (tanpa pagination)
// Path: /api/bank/:bank_uuid/rekening
// =========================
exports.getAllByBankUuid = async (req, res) => {
  try {
    const { bank_uuid } = req.params;

    const bank = await Bank.findOne({ where: { uuid: bank_uuid } });
    if (!bank) return res.status(404).json({ message: 'Bank tidak ditemukan' });

    const search = (req.query.search || '').trim();
    const noreks = ([]).concat(req.query.nomor_rekening || [])
      .map((v) => String(v).trim()).filter(Boolean);
    const aktifParam = req.query.aktif;

    const where = { bank_id: bank.id };
    if (search) {
      where[Op.or] = [
        { nama_rekening: { [Op.iLike]: `%${search}%` } },
        { nomor_rekening: { [Op.iLike]: `%${search}%` } },
        { deskripsi: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (noreks.length) where.nomor_rekening = { [Op.in]: noreks };
    if (typeof aktifParam !== 'undefined') {
      const v = String(aktifParam).toLowerCase();
      if (v === 'true' || v === 'false') where.aktif = v === 'true';
    }

    const rows = await Rekening.findAll({ where, order: [['nama_rekening', 'ASC']] });
    return res.json({ data: rows.map(toPlain), meta: { total: rows.length, bank_uuid } });
  } catch (err) {
    console.error('rekening.getAllByBankUuid error:', err);
    return res.status(500).json({ message: 'Gagal mengambil daftar rekening berdasarkan bank' });
  }
};

// =========================
// GET ONE by uuid
// =========================
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await Rekening.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Rekening tidak ditemukan' });
    return res.json({ data: toPlain(row) });
  } catch (err) {
    console.error('rekening.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil detail rekening' });
  }
};

// =========================
/* UPDATE by uuid (parsial) */
// =========================
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await Rekening.findOne({ where: { uuid } });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: 'Rekening tidak ditemukan' });
    }

    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });

    const update = {};
    ['bank_id', 'nama_rekening', 'nomor_rekening', 'deskripsi', 'aktif'].forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(payload, k)) {
        update[k] = payload[k];
      }
    });

    await row.update(update, { transaction: t });
    await t.commit();
    return res.json({ message: 'Rekening diperbarui', data: toPlain(row) });
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

    console.error('rekening.update error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui rekening' });
  }
};

// =========================
// DELETE single/batch by uuid
//  - DELETE /rekening/:uuid           -> hapus satu (atau comma-separated)
//  - DELETE /rekening                 -> body { uuids: [..] }
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

    const found = await Rekening.findAll({ where: { uuid: { [Op.in]: uuids } }, attributes: ['uuid'] });
    if (!found.length) return res.status(404).json({ message: 'Data rekening tidak ditemukan' });

    const deleted = await Rekening.destroy({ where: { uuid: { [Op.in]: uuids } } });
    return res.json({ message: `Berhasil menghapus ${deleted} data rekening`, deleted, uuids });
  } catch (err) {
    console.error('rekening.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus rekening', detail: err.message });
  }
};

// =========================
// DELETE ALL (hati-hati)
// =========================
exports.deleteAll = async (_req, res) => {
  try {
    const del = await Rekening.destroy({ where: {} });
    return res.json({ message: 'Semua rekening terhapus', deleted: del });
  } catch (err) {
    console.error('rekening.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua rekening', detail: err.message });
  }
};

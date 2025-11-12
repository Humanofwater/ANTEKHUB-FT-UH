// File: src/controllers/program_studi.controller.js
// Tujuan: CRUD master table "ProgramStudi" (tanpa pagination; master reference)
// Catatan: Field utama -> kode: string[], nama: string, strata: enum (strata_enum)
// Unik logis: (nama, strata)

const { Op } = require('sequelize');
const Joi = require('joi');
const { sequelize, ProgramStudi } = require('../models');

// ===== Validasi =====
const kodeItemSchema = Joi.string().max(20).trim().min(1);
const createSchema = Joi.object({
  kode: Joi.array().items(kodeItemSchema).default([]),
  nama: Joi.string().max(100).trim().required(),
  strata: Joi.string().trim().required(), // biarkan DB enum yang menolak nilai tidak sah
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  kode: Joi.array().items(kodeItemSchema),
  nama: Joi.string().max(100).trim(),
  strata: Joi.string().trim(),
}).min(1).options({ stripUnknown: true });

// ===== Util =====
const toPlain = (row) => (row?.get ? row.get({ plain: true }) : row);

function sanitizeKode(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    const v = String(s || '').trim();
    if (!v) continue;
    const key = v; // jika ingin case-insensitive gunakan v.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || '';
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: 'Format UUID tidak valid', detail: msg };
  }
  if (/is not a valid enum/i.test(msg) || /invalid input value for enum/i.test(msg)) {
    return { status: 422, message: 'Nilai strata tidak valid', detail: msg };
  }
  if (/duplicate key value/i.test(msg)) {
    return { status: 409, message: 'Data duplikat', detail: msg };
  }
  return null;
}

// =========================
// CREATE (Add)  —— DITARUH PALING ATAS
// =========================
exports.add = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });
    payload.kode = sanitizeKode(payload.kode);

    // Cegah duplikasi logis nama+strata
    const dup = await ProgramStudi.findOne({
      where: { nama: payload.nama, strata: payload.strata },
      transaction: t,
    });
    if (dup) {
      await t.rollback();
      return res.status(409).json({ message: 'Program studi dengan nama dan strata tersebut sudah ada' });
    }

    const created = await ProgramStudi.create(
      {
        kode: payload.kode,
        nama: payload.nama,
        strata: payload.strata,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ message: 'Program studi dibuat', data: toPlain(created) });
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

    console.error('program_studi.add error:', err);
    return res.status(500).json({ message: 'Gagal menambah program studi' });
  }
};

// =========================
// GET ALL (tanpa pagination)
// Query opsional:
//   search=... (iLike nama)
//   strata=S1&strata=S2 (multi)
//   kode=SI&kode=IF (overlap)
// =========================
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const stratas = ([]).concat(req.query.strata || []).filter((v) => String(v).trim() !== '');
    const kodeFilter = sanitizeKode([].concat(req.query.kode || []));

    const where = {};
    if (search) where.nama = { [Op.iLike]: `%${search}%` };
    if (stratas.length) where.strata = { [Op.in]: stratas };
    if (kodeFilter.length) where.kode = { [Op.overlap]: kodeFilter }; // match jika ada irisan

    const rows = await ProgramStudi.findAll({
      where,
      order: [['nama', 'ASC'], ['strata', 'ASC']],
    });

    return res.json({ data: rows.map(toPlain), meta: { total: rows.length } });
  } catch (err) {
    console.error('program_studi.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil program studi' });
  }
};

// =========================
// GET ONE by UUID
// =========================
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await ProgramStudi.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Program studi tidak ditemukan' });
    return res.json({ data: toPlain(row) });
  } catch (err) {
    console.error('program_studi.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil detail program studi' });
  }
};

// =========================
// UPDATE by UUID (parsial)
// =========================
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await ProgramStudi.findOne({ where: { uuid }, transaction: t });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: 'Program studi tidak ditemukan' });
    }

    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });

    // Jika nama/strata berubah, cek duplikasi logis (nama, strata)
    const next = {
      kode: typeof payload.kode !== 'undefined' ? sanitizeKode(payload.kode) : row.kode,
      nama: typeof payload.nama !== 'undefined' ? payload.nama.trim() : row.nama,
      strata: typeof payload.strata !== 'undefined' ? payload.strata.trim() : row.strata,
    };

    if (next.nama !== row.nama || next.strata !== row.strata) {
      const dup = await ProgramStudi.findOne({
        where: { nama: next.nama, strata: next.strata, uuid: { [Op.ne]: uuid } },
        transaction: t,
      });
      if (dup) {
        await t.rollback();
        return res.status(409).json({ message: 'Program studi dengan nama dan strata tersebut sudah ada' });
      }
    }

    await row.update(next, { transaction: t });
    await t.commit();
    return res.json({ message: 'Program studi diperbarui', data: toPlain(row) });
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

    console.error('program_studi.update error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui program studi' });
  }
};

// =========================
/* DELETE single/batch by UUID
   - DELETE /program-studi/:uuid           -> hapus satu
   - DELETE /program-studi                 -> body { uuids: [..] }
*/
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

    const deleted = await ProgramStudi.destroy({ where: { uuid: { [Op.in]: uuids } } });
    if (!deleted) return res.status(404).json({ message: 'Data program studi tidak ditemukan' });

    return res.json({ message: `Berhasil menghapus ${deleted} data program studi`, deleted, uuids });
  } catch (err) {
    console.error('program_studi.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus program studi', detail: err.message });
  }
};

// =========================
// DELETE ALL (hati-hati)
// =========================
exports.deleteAll = async (_req, res) => {
  try {
    const del = await ProgramStudi.destroy({ where: {} });
    return res.json({ message: 'Semua program studi terhapus', deleted: del });
  } catch (err) {
    console.error('program_studi.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua program studi', detail: err.message });
  }
};

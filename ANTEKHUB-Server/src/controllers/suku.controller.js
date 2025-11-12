// File: src/controllers/suku.controller.js
// Tujuan: CRUD master table "Suku" (gaya selaras program_studi.controller.js)
// Catatan: Tanpa pagination; pertahankan perilaku & status code yang sudah lulus test

const { Op } = require('sequelize');
const Joi = require('joi');
const { Suku } = require('../models');

// ========== Util ==========
const toPlain = (row) => (row?.get ? row.get({ plain: true }) : row);

function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || '';
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: 'Format UUID tidak valid', detail: msg };
  }
  if (/duplicate key value/i.test(msg)) {
    return { status: 409, message: 'Suku sudah terdaftar', detail: msg };
  }
  return null;
}

// ========== Validasi ==========
const createSchema = Joi.object({
  nama: Joi.string().trim().min(1).required(),
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  nama: Joi.string().trim().min(1),
})
  .min(1) // harus ada field yang diupdate
  .options({ stripUnknown: true });

// =========================
// CREATE (Add)
// =========================
exports.add = async (req, res) => {
  try {
    // Validasi Joi – pertahankan pesan/status yang sama dengan implementasi lama
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });

    // Cegah duplikasi (sesuai perilaku lama)
    const exists = await Suku.findOne({ where: { nama: payload.nama } });
    if (exists) {
      return res.status(409).json({ message: 'Suku sudah terdaftar' });
    }

    const created = await Suku.create({ nama: payload.nama });
    return res.status(201).json({ data: toPlain(created) });
  } catch (err) {
    if (err.isJoi) {
      // Selaraskan dengan perilaku lama: 422 untuk input tidak valid
      return res.status(422).json({ message: 'Nama suku wajib diisi' });
    }
    const mapped = mapSequelizeError(err);
    if (mapped) return res.status(mapped.status).json({ message: mapped.message, detail: mapped.detail });

    console.error('suku.add error:', err);
    return res.status(500).json({ message: 'Gagal menambah data suku' });
  }
};

// =========================
// GET ALL (tanpa pagination)
// =========================
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();

    const where = {};
    if (search) where.nama = { [Op.iLike]: `%${search}%` };

    const rows = await Suku.findAll({
      where,
      order: [['nama', 'ASC']],
    });

    const data = rows.map(toPlain);
    return res.json({ data, meta: { total: data.length } });
  } catch (err) {
    console.error('suku.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data suku' });
  }
};

// =========================
// GET ONE by UUID
// =========================
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await Suku.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Data suku tidak ditemukan' });

    return res.json({ data: toPlain(row) });
  } catch (err) {
    console.error('suku.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil detail suku' });
  }
};

// =========================
// UPDATE by UUID (parsial)
// =========================
exports.updateByUuid = async (req, res) => {
  try {
    const { uuid } = req.params;

    const row = await Suku.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Suku tidak ditemukan' });

    // Jika body kosong → 422 (selaras perilaku sebelumnya)
    if (!Object.keys(req.body || {}).length) {
      return res.status(422).json({
        message: 'Validasi gagal',
        errors: [{ path: 'body', message: 'Tidak ada field yang diupdate' }],
      });
    }

    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });

    // Jika "nama" dikirim, wajib non-kosong dan tidak duplikat (selaras yang lama)
    if (Object.prototype.hasOwnProperty.call(payload, 'nama')) {
      const newName = payload.nama;

      if (newName !== row.nama) {
        const dup = await Suku.findOne({ where: { nama: newName } });
        if (dup && dup.uuid !== uuid) {
          return res.status(409).json({ message: 'Nama suku sudah digunakan' });
        }
        row.nama = newName;
      }
    }

    await row.save();
    return res.json({ data: toPlain(row) });
  } catch (err) {
    if (err.isJoi) {
      return res.status(422).json({
        message: 'Validasi gagal',
        errors: err.details.map((d) => ({ path: d.path.join('.'), message: d.message })),
      });
    }
    const mapped = mapSequelizeError(err);
    if (mapped) return res.status(mapped.status).json({ message: mapped.message, detail: mapped.detail });

    console.error('suku.updateByUuid error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui suku' });
  }
};

// =========================
// DELETE by UUID
// =========================
exports.deleteByUuid = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await Suku.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Suku tidak ditemukan' });

    await row.destroy();
    return res.json({ message: 'Data suku berhasil dihapus' });
  } catch (err) {
    console.error('suku.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus data suku' });
  }
};

// =========================
// DELETE ALL (Super Admin)
// =========================
exports.deleteAll = async (_req, res) => {
  try {
    const count = await Suku.destroy({ where: {} });
    return res.json({ message: `Berhasil menghapus ${count} data suku` });
  } catch (err) {
    console.error('suku.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua data suku' });
  }
};

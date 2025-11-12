// File: src/controllers/userAdmin.controller.js
// Tujuan: CRUD untuk model UsersAdmin (sesuai models/user_admin.js)
// Kontrak: operasi berbasis UUID; kolom "nama" & "username" wajib; "role" ENUM('Admin','Super Admin')
// Catatan: Model name adalah "UsersAdmin" (bukan "UserAdmin") sesuai definisi model

const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { UsersAdmin } = require('../models'); // <- model name sesuai file model
const UserAdmin = UsersAdmin; // alias agar penamaan di bawah tetap konsisten

// Sembunyikan field sensitif
const sanitize = (row) => {
  if (!row) return row;
  const plain = row.get ? row.get({ plain: true }) : row;
  // hapus password dari output
  // eslint-disable-next-line no-unused-vars
  const { password, ...safe } = plain;
  return safe;
};

// ===== Create =====
exports.add = async (req, res) => {
  try {
    const { nama, username, nomor_telepon, password, role } = req.body;

    if (!nama || !username || !password) {
      return res.status(400).json({ message: 'nama, username, dan password wajib diisi' });
    }

    const exists = await UserAdmin.findOne({ where: { username } });
    if (exists) return res.status(409).json({ message: 'username sudah digunakan' });

    // Validasi role opsional (kalau dikirim)
    if (role && !['Admin', 'Super Admin'].includes(role)) {
      return res.status(400).json({ message: 'role tidak valid (hanya Admin atau Super Admin)' });
    }

    const hash = await bcrypt.hash(password, 12);

    const created = await UserAdmin.create({
      nama,
      username,
      nomor_telepon: nomor_telepon || null,
      password: hash,
      role: role || 'Admin', // default sesuai model
      // uuid dibuat otomatis oleh model (defaultValue: UUIDV4)
    });

    return res.status(201).json({ message: 'Admin dibuat', data: sanitize(created) });
  } catch (err) {
    console.error('user_admin.add error:', err);
    return res.status(500).json({ message: 'Gagal membuat admin' });
  }
};

// ===== Get All (tanpa pagination) =====
exports.getAll = async (_req, res) => {
  try {
    const rows = await UserAdmin.findAll({
      attributes: { exclude: ['password'] },
      order: [['updated_at', 'DESC']],
    });
    return res.json({ data: rows, total: rows.length });
  } catch (err) {
    console.error('user_admin.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data admin' });
  }
};

// ===== Get One by UUID =====
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await UserAdmin.findOne({
      where: { uuid },
      attributes: { exclude: ['password'] },
    });
    if (!row) return res.status(404).json({ message: 'Admin tidak ditemukan' });
    return res.json({ data: row });
  } catch (err) {
    console.error('user_admin.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data admin' });
  }
};

// ===== Update by UUID (parsial) =====
exports.updateByUuid = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await UserAdmin.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Admin tidak ditemukan' });

    const payload = { ...req.body };

    // Lindungi kolom yang tidak boleh diubah langsung
    ['id', 'uuid', 'created_at', 'updated_at'].forEach((k) => delete payload[k]);

    // Validasi unique username jika berubah
    if (payload.username && payload.username !== row.username) {
      const dup = await UserAdmin.findOne({ where: { username: payload.username } });
      if (dup) return res.status(409).json({ message: 'username sudah digunakan' });
    }

    // Validasi role jika diberikan
    if (typeof payload.role !== 'undefined' && !['Admin', 'Super Admin'].includes(payload.role)) {
      return res.status(400).json({ message: 'role tidak valid (hanya Admin atau Super Admin)' });
    }

    // Hash password jika diubah
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 12);
    } else {
      delete payload.password;
    }

    await row.update(payload);

    return res.json({ message: 'Admin diperbarui', data: sanitize(row) });
  } catch (err) {
    console.error('user_admin.updateByUuid error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui admin' });
  }
};

// ===== Delete by UUID (single/batch) =====
// Mendukung: DELETE /:uuid (comma-separated) atau body { uuids: [...] }
exports.deleteByUuid = async (req, res) => {
  try {
    let uuids = [];
    if (req.params.uuid) {
      uuids = req.params.uuid.split(',').map((v) => v.trim()).filter(Boolean);
    } else if (Array.isArray(req.body.uuids)) {
      uuids = req.body.uuids.filter(Boolean);
    }

    if (!uuids.length) {
      return res.status(400).json({ message: 'UUID tidak diberikan' });
    }

    const deleted = await UserAdmin.destroy({ where: { uuid: { [Op.in]: uuids } } });
    return res.json({ message: 'Hapus admin selesai', deleted, uuids });
  } catch (err) {
    console.error('user_admin.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus admin' });
  }
};

// ===== Delete All =====
exports.deleteAll = async (_req, res) => {
  try {
    const deleted = await UserAdmin.destroy({ where: {}, truncate: true, cascade: true });
    return res.json({ message: 'Semua admin dihapus', deleted });
  } catch (err) {
    console.error('user_admin.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua admin' });
  }
};

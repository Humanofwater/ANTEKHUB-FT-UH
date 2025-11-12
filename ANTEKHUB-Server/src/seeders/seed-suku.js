// File: src/seeder/seed-suku.js
// Tujuan: Seed master "Suku" dari Data/daftar_suku_bangsa_indonesia_150.json
// Jalankan: npm run db:seed seed-suku.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { sequelize, Suku } = require('../models');
const { Op } = require('sequelize');

function cleanStr(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function readSukuListFromJson() {
  const jsonPath = path.join(process.cwd(), 'Data', 'daftar_suku_bangsa_indonesia_150.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File JSON tidak ditemukan: ${jsonPath}`);
  }
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);

  // Struktur yang diharapkan: { ..., suku_bangsa: [ "Aceh", "Gayo", ... ] }
  const arr = Array.isArray(parsed?.suku_bangsa) ? parsed.suku_bangsa : parsed;
  if (!Array.isArray(arr)) {
    throw new Error('Format JSON tidak valid: tidak ditemukan array "suku_bangsa".');
  }

  // Bersihkan & deduplicate (case-insensitive)
  const set = new Set();
  const names = [];
  for (const item of arr) {
    const nama = cleanStr(item);
    if (!nama) continue;
    const key = nama.toLowerCase();
    if (!set.has(key)) {
      set.add(key);
      names.push(nama);
    }
  }
  return names;
}

async function up() {
  // Ambil daftar nama suku
  const names = readSukuListFromJson();
  if (!names.length) {
    console.log('Tidak ada data suku yang valid untuk di-seed.');
    return;
  }

  await sequelize.authenticate();

  // Transaksi tunggal untuk efisiensi & konsistensi
  const t = await sequelize.transaction();
  try {
    // Ambil existing agar tidak query findOrCreate per item
    const existing = await Suku.findAll({
      where: { nama: { [Op.in]: names } },
      attributes: ['nama'],
      transaction: t,
    });
    const existingSet = new Set(existing.map((r) => r.nama.toLowerCase()));

    // Filter hanya yang belum ada
    const toInsert = names
      .filter((n) => !existingSet.has(n.toLowerCase()))
      .map((n) => ({ nama: n }));

    if (toInsert.length) {
      // Insert batch
      await Suku.bulkCreate(toInsert, { transaction: t });
      console.log(`✔ Insert Suku baru: ${toInsert.length} baris`);
    } else {
      console.log('✔ Tidak ada suku baru untuk diinsert (semua sudah ada)');
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal seeding suku:', err.message);
    throw err;
  }
}

async function down() {
  // Rollback spesifik hanya untuk nama-nama yang ada di file JSON
  const names = readSukuListFromJson();
  if (!names.length) {
    console.log('Tidak ada data suku pada file JSON. down() tidak melakukan apa-apa.');
    return;
  }

  await sequelize.authenticate();

  const t = await sequelize.transaction();
  try {
    const deleted = await Suku.destroy({
      where: { nama: { [Op.in]: names } },
      transaction: t,
    });
    await t.commit();
    console.log(`✔ Hapus data suku (rollback): ${deleted} baris`);
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal rollback suku:', err.message);
    throw err;
  }
}

module.exports = { up, down };
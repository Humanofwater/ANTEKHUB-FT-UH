// File: src/seeder/seed-jenis-institusi.js
// Tujuan : Seed master "JenisInstitusi" dari Data/jenis_institusi_enum.json
// Jalankan: npm run db:seed src/seeder/seed-jenis-institusi.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');

const { sequelize, JenisInstitusi } = require('../models');

// --- Util ---
function cleanStr(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function toKode50(nama) {
  // Ubah ke UPPER_SNAKE_CASE lalu potong 50 char
  return String(nama || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase()
    .slice(0, 50);
}

function readJenisFromJson() {
  const jsonPath = path.join(process.cwd(), 'Data', 'jenis_institusi_enum.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File JSON tidak ditemukan: ${jsonPath}`);
  }
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);

  // Struktur: { "jenis_institusi": [ ... ] }
  const arr = Array.isArray(parsed?.jenis_institusi) ? parsed.jenis_institusi : parsed;
  if (!Array.isArray(arr)) {
    throw new Error('Format JSON tidak valid: tidak ditemukan array "jenis_institusi".');
  }

  // Bersihkan & dedup (case-insensitive)
  const seen = new Set();
  const names = [];
  for (const x of arr) {
    const nama = cleanStr(x);
    if (!nama) continue;
    const key = nama.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(nama);
    }
  }
  return names;
}

// --- Up: insert idempotent ---
async function up() {
  const names = readJenisFromJson();
  if (!names.length) {
    console.log('Tidak ada data jenis institusi yang valid untuk di-seed.');
    return;
  }

  await sequelize.authenticate();
  const t = await sequelize.transaction();
  try {
    // Cek existing by nama (unique)
    const existing = await JenisInstitusi.findAll({
      where: { nama: { [Op.in]: names } },
      attributes: ['nama'],
      transaction: t,
    });
    const existSet = new Set(existing.map((r) => r.nama.toLowerCase()));

    const toInsert = names
      .filter((n) => !existSet.has(n.toLowerCase()))
      .map((n) => ({
        nama: n,
        kode: toKode50(n),
        deskripsi: n,
        active: true,
      }));

    if (toInsert.length) {
      await JenisInstitusi.bulkCreate(toInsert, { transaction: t });
      console.log(`✔ Insert JenisInstitusi baru: ${toInsert.length} baris`);
    } else {
      console.log('✔ Tidak ada JenisInstitusi baru untuk diinsert (semua sudah ada)');
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal seeding jenis institusi:', err.message);
    throw err;
  }
}

// --- Down: hapus hanya data yang berasal dari file JSON ---
async function down() {
  const names = readJenisFromJson();
  if (!names.length) {
    console.log('Tidak ada data pada file JSON. down() tidak melakukan apa-apa.');
    return;
  }

  await sequelize.authenticate();
  const t = await sequelize.transaction();
  try {
    const deleted = await JenisInstitusi.destroy({
      where: { nama: { [Op.in]: names } },
      transaction: t,
    });
    await t.commit();
    console.log(`✔ Rollback JenisInstitusi: ${deleted} baris terhapus`);
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal rollback jenis institusi:', err.message);
    throw err;
  }
}

module.exports = { up, down };
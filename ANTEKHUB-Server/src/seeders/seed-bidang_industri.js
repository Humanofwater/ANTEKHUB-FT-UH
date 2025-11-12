// File: src/seeder/seed-bidang-industri.js
// Tujuan: Seed master "BidangIndustri" dari Data/bidang_industri_enum.json
// Jalankan: npm run db:seed src/seeder/seed-bidang-industri.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize, BidangIndustri } = require('../models');

// Utility pembersih string
function cleanStr(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Baca dan normalisasi data bidang industri dari JSON
function readBidangIndustriFromJson() {
  const jsonPath = path.join(process.cwd(), 'Data', 'bidang_industri_enum.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File JSON tidak ditemukan: ${jsonPath}`);
  }
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);

  // Struktur: { bidang_industri: [ "Agribisnis/Pertanian", ... ] }
  const arr = Array.isArray(parsed?.bidang_industri) ? parsed.bidang_industri : parsed;
  if (!Array.isArray(arr)) {
    throw new Error('Format JSON tidak valid: tidak ditemukan array "bidang_industri".');
  }

  // Bersihkan & deduplicate (case-insensitive)
  const seen = new Set();
  const cleaned = [];

  for (const item of arr) {
    const nama = cleanStr(item);
    if (!nama) continue;
    const key = nama.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push(nama);
    }
  }

  return cleaned;
}

// Fungsi up(): insert jika belum ada
async function up() {
  const names = readBidangIndustriFromJson();
  if (!names.length) {
    console.log('Tidak ada data bidang industri yang valid untuk di-seed.');
    return;
  }

  await sequelize.authenticate();
  const t = await sequelize.transaction();

  try {
    // Ambil data existing untuk menghindari duplikasi
    const existing = await BidangIndustri.findAll({
      where: { nama: { [Op.in]: names } },
      attributes: ['nama'],
      transaction: t,
    });

    const existingSet = new Set(existing.map((r) => r.nama.toLowerCase()));

    // Buat daftar insert baru
    const toInsert = names
      .filter((n) => !existingSet.has(n.toLowerCase()))
      .map((n) => ({
        nama: n,
        kode: n
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .toUpperCase()
          .substring(0, 50), // max 50 sesuai model
        deskripsi: n,
        active: true,
      }));

    if (toInsert.length) {
      await BidangIndustri.bulkCreate(toInsert, { transaction: t });
      console.log(`✔ Insert BidangIndustri baru: ${toInsert.length} baris`);
    } else {
      console.log('✔ Tidak ada bidang industri baru untuk diinsert (semua sudah ada)');
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal seeding bidang industri:', err.message);
    throw err;
  }
}

// Fungsi down(): rollback hanya data dari file JSON
async function down() {
  const names = readBidangIndustriFromJson();
  if (!names.length) {
    console.log('Tidak ada data bidang industri di file JSON. down() tidak melakukan apa-apa.');
    return;
  }

  await sequelize.authenticate();
  const t = await sequelize.transaction();

  try {
    const deleted = await BidangIndustri.destroy({
      where: { nama: { [Op.in]: names } },
      transaction: t,
    });

    await t.commit();
    console.log(`✔ Hapus data bidang industri (rollback): ${deleted} baris`);
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal rollback bidang industri:', err.message);
    throw err;
  }
}

module.exports = { up, down };

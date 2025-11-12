// File: src/seeder/seed-bank.js
// Tujuan: Seed master "Bank" dari Data/daftar_bank_indonesia_unique.json
// Jalankan: npm run db:seed src/seeder/seed-bank.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');

const { sequelize, Bank } = require('../models');

function cleanStr(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function readBankListFromJson() {
  const jsonPath = path.join(process.cwd(), 'Data', 'daftar_bank_indonesia_unique.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File JSON tidak ditemukan: ${jsonPath}`);
  }
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);

  // Prefer "flat_unique" jika ada; fallback ke gabungan categories_simple
  let names = [];
  if (Array.isArray(parsed.flat_unique)) {
    names = parsed.flat_unique;
  } else if (parsed.categories_simple && typeof parsed.categories_simple === 'object') {
    for (const key of Object.keys(parsed.categories_simple)) {
      const arr = parsed.categories_simple[key];
      if (Array.isArray(arr)) names.push(...arr);
    }
  } else {
    throw new Error('Format JSON bank tidak valid: tidak ada "flat_unique" atau "categories_simple".');
  }

  // Bersihkan & dedup case-insensitive
  const seen = new Set();
  const unique = [];
  for (const n of names) {
    const nama = cleanStr(n);
    if (!nama) continue;
    const key = nama.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(nama);
    }
  }
  return unique;
}

async function up() {
  const banks = readBankListFromJson();
  if (!banks.length) {
    console.log('Tidak ada data bank valid untuk di-seed.');
    return;
  }

  await sequelize.authenticate();
  const t = await sequelize.transaction();
  try {
    // Ambil existing untuk hindari duplikasi
    const existing = await Bank.findAll({
      where: { nama: { [Op.in]: banks } },
      attributes: ['nama'],
      transaction: t,
    });
    const existSet = new Set(existing.map((r) => r.nama.toLowerCase()));

    // Map ke payload insert; kategori diset "BANK" agar konsisten dengan controller/filter
    const toInsert = banks
      .filter((n) => !existSet.has(n.toLowerCase()))
      .map((nama) => ({ nama, kategori: 'BANK' }));

    if (toInsert.length) {
      await Bank.bulkCreate(toInsert, { transaction: t });
      console.log(`✔ Insert Bank baru: ${toInsert.length} baris`);
    } else {
      console.log('✔ Tidak ada Bank baru untuk diinsert (semua sudah ada)');
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal seeding bank:', err.message);
    throw err;
  }
}

async function down() {
  const banks = readBankListFromJson();
  if (!banks.length) {
    console.log('Tidak ada data bank pada file JSON. down() tidak melakukan apa-apa.');
    return;
  }

  await sequelize.authenticate();
  const t = await sequelize.transaction();
  try {
    const deleted = await Bank.destroy({
      where: { nama: { [Op.in]: banks } },
      transaction: t,
    });
    await t.commit();
    console.log(`✔ Hapus data bank (rollback): ${deleted} baris`);
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal rollback bank:', err.message);
    throw err;
  }
}

module.exports = { up, down };
// File: src/seeder/seed-program-studi.js
// Tujuan: Seed master "ProgramStudi" dari Data/program_studi.json
// Jalankan: npm run db:seed src/seeder/seed-program-studi.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize, ProgramStudi } = require('../models');

function cleanStr(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function sanitizeKode(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    const v = String(s || '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

// Baca & transform JSON ke array objek { nama, strata, kode }
function readProgramStudiFromJson() {
  const jsonPath = path.join(process.cwd(), 'Data', 'program_studi.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File JSON tidak ditemukan: ${jsonPath}`);
  }
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);

  const items = [];

  for (const entry of parsed) {
    const strata = cleanStr(entry.Strata);
    if (!strata) continue;

    if (Array.isArray(entry['Program Studi'])) {
      // Format: { Strata: 'S1', Program Studi: [{ Kode/Nama/... }] }
      for (const ps of entry['Program Studi']) {
        const nama = cleanStr(ps.Nama);
        const kode = sanitizeKode(ps.Kode || ps.kode || []);
        if (!nama) continue;
        items.push({ nama, strata, kode });
      }
    } else {
      // Format langsung: { Strata: 'Profesi', Kode: [...], Nama: '...' }
      const nama = cleanStr(entry.Nama);
      const kode = sanitizeKode(entry.Kode || entry.kode || []);
      if (!nama) continue;
      items.push({ nama, strata, kode });
    }
  }

  // Dedup berdasarkan (nama + strata)
  const seen = new Set();
  const unique = [];
  for (const ps of items) {
    const key = `${ps.nama.toLowerCase()}|${ps.strata.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(ps);
    }
  }

  return unique;
}

async function up() {
  const data = readProgramStudiFromJson();
  if (!data.length) {
    console.log('Tidak ada data program studi valid untuk di-seed.');
    return;
  }

  await sequelize.authenticate();
  const t = await sequelize.transaction();

  try {
    const existing = await ProgramStudi.findAll({
      where: {
        [Op.or]: data.map((x) => ({
          nama: x.nama,
          strata: x.strata,
        })),
      },
      attributes: ['nama', 'strata'],
      transaction: t,
    });

    const existingSet = new Set(
      existing.map((r) => `${r.nama.toLowerCase()}|${r.strata.toLowerCase()}`)
    );

    const toInsert = data.filter(
      (x) => !existingSet.has(`${x.nama.toLowerCase()}|${x.strata.toLowerCase()}`)
    );

    if (toInsert.length) {
      await ProgramStudi.bulkCreate(toInsert, { transaction: t });
      console.log(`✔ Insert Program Studi baru: ${toInsert.length} baris`);
    } else {
      console.log('✔ Tidak ada Program Studi baru untuk diinsert (semua sudah ada)');
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal seeding program_studi:', err.message);
    throw err;
  }
}

async function down() {
  const data = readProgramStudiFromJson();
  if (!data.length) {
    console.log('Tidak ada data program studi pada file JSON. down() tidak melakukan apa-apa.');
    return;
  }

  await sequelize.authenticate();
  const t = await sequelize.transaction();

  try {
    const deleted = await ProgramStudi.destroy({
      where: {
        [Op.or]: data.map((x) => ({
          nama: x.nama,
          strata: x.strata,
        })),
      },
      transaction: t,
    });
    await t.commit();
    console.log(`✔ Hapus data program studi (rollback): ${deleted} baris`);
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal rollback program_studi:', err.message);
    throw err;
  }
}

module.exports = { up, down };
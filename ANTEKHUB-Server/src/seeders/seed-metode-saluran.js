// File: src/seeder/seed-metode-saluran.js
// Tujuan: Seed master "MetodePembayaran" & "SaluranPembayaran" dari Data/metode_pembayaran.json
// Jalankan: npm run db:seed src/seeder/seed-metode-saluran.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');

const { sequelize, MetodePembayaran, SaluranPembayaran } = require('../models');

// Normalisasi kode metode → konsisten dengan ekosistem (VA/EWL/CC/RTO/PAYLATER/QR)
const METHOD_CODE_MAP = {
  e_wallet: 'EWL',
  virtual_account: 'VA',
  credit_card: 'CC',
  retail_outlet: 'RTO',
  paylater: 'PAYLATER',
  qr_payment: 'QR',
};

function cleanStr(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function toUpperSnake(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function readMetodeSaluranFromJson() {
  const jsonPath = path.join(process.cwd(), 'Data', 'metode_pembayaran.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File JSON tidak ditemukan: ${jsonPath}`);
  }
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Format JSON tidak valid: root bukan array.');
  }

  // Hasil: { metode: [{ kode_metode, nama }], saluran: [{ kode_saluran, nama, kode_metode }] }
  const metode = [];
  const saluran = [];

  for (const m of parsed) {
    const methodCode = cleanStr(m.method_code);
    const name = cleanStr(m.name);
    if (!methodCode || !name) continue;

    const kode_metode = METHOD_CODE_MAP[methodCode] || toUpperSnake(methodCode);
    metode.push({ kode_metode, nama: name });

    const channels = Array.isArray(m.channels) ? m.channels : [];
    for (const c of channels) {
      const chCode = cleanStr(c.channel_code);
      const chName = cleanStr(c.name);
      if (!chCode || !chName) continue;
      const kode_saluran = toUpperSnake(chCode); // contoh: bca_va → BCA_VA, gopay → GOPAY
      saluran.push({ kode_saluran, nama: chName, kode_metode });
    }
  }

  // Dedup konsisten
  const seenM = new Set();
  const uniqMetode = [];
  for (const x of metode) {
    const key = x.kode_metode.toUpperCase();
    if (!seenM.has(key)) {
      seenM.add(key);
      uniqMetode.push(x);
    }
  }

  const seenS = new Set();
  const uniqSaluran = [];
  for (const x of saluran) {
    const key = x.kode_saluran.toUpperCase();
    if (!seenS.has(key)) {
      seenS.add(key);
      uniqSaluran.push(x);
    }
  }

  return { metode: uniqMetode, saluran: uniqSaluran };
}

async function up() {
  const { metode, saluran } = readMetodeSaluranFromJson();
  if (!metode.length) {
    console.log('Tidak ada data metode pembayaran untuk di-seed.');
    return;
  }

  await sequelize.authenticate();
  const t = await sequelize.transaction();
  try {
    // 1) Seed MetodePembayaran (idempotent by kode_metode)
    const existingM = await MetodePembayaran.findAll({
      where: { kode_metode: { [Op.in]: metode.map((m) => m.kode_metode) } },
      attributes: ['id', 'kode_metode'],
      transaction: t,
    });
    const existM = new Map(existingM.map((r) => [r.kode_metode.toUpperCase(), r]));

    const toInsertM = metode
      .filter((m) => !existM.has(m.kode_metode.toUpperCase()))
      .map((m) => ({
        kode_metode: m.kode_metode,
        nama: m.nama,
        active: true,
      }));

    if (toInsertM.length) {
      await MetodePembayaran.bulkCreate(toInsertM, { transaction: t });
      console.log(`✔ Insert MetodePembayaran baru: ${toInsertM.length} baris`);
    } else {
      console.log('✔ Tidak ada MetodePembayaran baru untuk diinsert (semua sudah ada)');
    }

    // Ambil ulang semua metode (agar dapat id untuk FK saluran)
    const allM = await MetodePembayaran.findAll({
      where: { kode_metode: { [Op.in]: metode.map((m) => m.kode_metode) } },
      attributes: ['id', 'kode_metode'],
      transaction: t,
    });
    const kodeToId = new Map(allM.map((r) => [r.kode_metode.toUpperCase(), r.id]));

    // 2) Seed SaluranPembayaran (idempotent by kode_saluran)
    const existingS = await SaluranPembayaran.findAll({
      where: { kode_saluran: { [Op.in]: saluran.map((s) => s.kode_saluran) } },
      attributes: ['kode_saluran'],
      transaction: t,
    });
    const existS = new Set(existingS.map((r) => r.kode_saluran.toUpperCase()));

    const toInsertS = saluran
      .filter((s) => !existS.has(s.kode_saluran.toUpperCase()) && kodeToId.has(s.kode_metode.toUpperCase()))
      .map((s) => ({
        metode_pembayaran_id: kodeToId.get(s.kode_metode.toUpperCase()),
        kode_saluran: s.kode_saluran,
        nama: s.nama,
        active: true,
      }));

    if (toInsertS.length) {
      await SaluranPembayaran.bulkCreate(toInsertS, { transaction: t });
      console.log(`✔ Insert SaluranPembayaran baru: ${toInsertS.length} baris`);
    } else {
      console.log('✔ Tidak ada SaluranPembayaran baru untuk diinsert (semua sudah ada)');
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal seeding metode/saluran:', err.message);
    throw err;
  }
}

async function down() {
  const { metode, saluran } = readMetodeSaluranFromJson();
  await sequelize.authenticate();
  const t = await sequelize.transaction();
  try {
    // Hapus saluran dulu (FK)
    const delS = await SaluranPembayaran.destroy({
      where: { kode_saluran: { [Op.in]: saluran.map((s) => s.kode_saluran) } },
      transaction: t,
    });
    // Lalu hapus metode
    const delM = await MetodePembayaran.destroy({
      where: { kode_metode: { [Op.in]: metode.map((m) => m.kode_metode) } },
      transaction: t,
    });

    await t.commit();
    console.log(`✔ Rollback saluran: ${delS} baris, metode: ${delM} baris`);
  } catch (err) {
    await t.rollback();
    console.error('✖ Gagal rollback metode/saluran:', err.message);
    throw err;
  }
}

module.exports = { up, down };

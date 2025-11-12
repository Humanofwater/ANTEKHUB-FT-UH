// File: src/seeder/seed-countries-states-cities.js
// Tujuan: Seed tabel Bangsa, Provinsi, KabupatenKota dari Data/countries+states+cities.json
// Jalankan: npm run db:seed src/seeder/seed-countries-states-cities.js
//
// Kontrak model (disesuaikan dengan gaya project kamu):
// - Bangsa:  fields utama -> nama, iso3, iso2, kode_telepon, region, subregion, longitude, latitude
//            unik logis -> nama (sesuai gaya yang kamu pakai di controller/seed sebelumnya)
// - Provinsi: fields -> bangsa_id (FK), nama, iso2, iso3166_2, longitude, latitude
//            unik logis -> (bangsa_id, nama)
// - KabupatenKota: fields -> provinsi_id (FK), nama, longitude, latitude
//            unik logis -> (provinsi_id, nama)
//
// Catatan:
// - Transaksi per-negara: jika 1 negara gagal, tidak menggagalkan negara lain.
// - Insert/Update (upsert manual): findOne -> create atau update ringan jika ada perubahan.

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import models dari src/models (seeder berada di src/seeder -> ../models)
const { sequelize, Bangsa, Provinsi, KabupatenKota } = require('../models');

// ===== Util parsing =====
function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function toFloat(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}
function cleanStr(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// ===== Upsert helpers =====
async function upsertBangsa(country, t) {
  const payload = {
    nama: cleanStr(country.name),
    iso3: cleanStr(country.iso3),
    iso2: cleanStr(country.iso2),
    kode_telepon: toNum(country.phonecode),
    region: cleanStr(country.region),
    subregion: cleanStr(country.subregion),
    longitude: toFloat(country.longitude),
    latitude: toFloat(country.latitude),
  };

  let row = await Bangsa.findOne({ where: { nama: payload.nama }, transaction: t });
  if (!row) {
    row = await Bangsa.create(payload, { transaction: t });
    return { row, created: true, updated: false };
  }

  const changed = {};
  for (const k of Object.keys(payload)) {
    if (row[k] !== payload[k]) changed[k] = payload[k];
  }
  if (Object.keys(changed).length) {
    await row.update(changed, { transaction: t });
    return { row, created: false, updated: true };
  }
  return { row, created: false, updated: false };
}

async function upsertProvinsi(bangsaId, state, t) {
  const payload = {
    bangsa_id: bangsaId,
    nama: cleanStr(state.name),
    iso2: cleanStr(state.iso2),
    iso3166_2: cleanStr(state.iso3166_2),
    longitude: toFloat(state.longitude),
    latitude: toFloat(state.latitude),
  };

  let row = await Provinsi.findOne({
    where: { bangsa_id: payload.bangsa_id, nama: payload.nama },
    transaction: t,
  });
  if (!row) {
    row = await Provinsi.create(payload, { transaction: t });
    return { row, created: true, updated: false };
  }

  const changed = {};
  for (const k of ['iso2', 'iso3166_2', 'longitude', 'latitude']) {
    if (row[k] !== payload[k]) changed[k] = payload[k];
  }
  if (Object.keys(changed).length) {
    await row.update(changed, { transaction: t });
    return { row, created: false, updated: true };
  }
  return { row, created: false, updated: false };
}

async function upsertKabupatenKota(provinsiId, city, t) {
  const payload = {
    provinsi_id: provinsiId,
    nama: cleanStr(city.name),
    longitude: toFloat(city.longitude),
    latitude: toFloat(city.latitude),
  };

  let row = await KabupatenKota.findOne({
    where: { provinsi_id: payload.provinsi_id, nama: payload.nama },
    transaction: t,
  });
  if (!row) {
    row = await KabupatenKota.create(payload, { transaction: t });
    return { row, created: true, updated: false };
  }

  const changed = {};
  for (const k of ['longitude', 'latitude']) {
    if (row[k] !== payload[k]) changed[k] = payload[k];
  }
  if (Object.keys(changed).length) {
    await row.update(changed, { transaction: t });
    return { row, created: false, updated: true };
  }
  return { row, created: false, updated: false };
}

// ===== Proses 1 negara (dengan transaksi) =====
async function seedOneCountry(country, idx, total) {
  const displayName = cleanStr(country?.name) || `index-${idx}`;
  const t = await sequelize.transaction();
  try {
    const bangsaRes = await upsertBangsa(country, t);
    const bangsa = bangsaRes.row;
    let pvCreated = 0, pvUpdated = 0, kkCreated = 0, kkUpdated = 0;

    const states = Array.isArray(country.states) ? country.states : [];
    for (const s of states) {
      const provRes = await upsertProvinsi(bangsa.id, s, t);
      if (provRes.created) pvCreated++;
      if (provRes.updated) pvUpdated++;

      const cities = Array.isArray(s.cities) ? s.cities : [];
      for (const c of cities) {
        const kkRes = await upsertKabupatenKota(provRes.row.id, c, t);
        if (kkRes.created) kkCreated++;
        if (kkRes.updated) kkUpdated++;
      }
    }

    await t.commit();
    console.log(`✔ ${idx + 1}/${total} ${displayName} — Bangsa(${bangsaRes.created ? 'C' : '='}${bangsaRes.updated ? 'U' : ''}), Provinsi(+${pvCreated}/~${pvUpdated}), KabKota(+${kkCreated}/~${kkUpdated})`);
  } catch (err) {
    await t.rollback();
    console.error(`✖ Gagal negara "${displayName}": ${err.message}`);
  }
}

// ===== API seeder (UP/DOWN) =====
async function up() {
  // Lokasi data: [project]/Data/countries+states+cities.json
  const jsonPath = path.join(process.cwd(), 'Data', 'countries+states+cities.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File JSON tidak ditemukan: ${jsonPath}`);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  let data = JSON.parse(raw);

  // Data bisa berupa array negara atau object { data: [...] } / { countries: [...] }
  if (!Array.isArray(data)) {
    if (Array.isArray(data?.data)) data = data.data;
    else if (Array.isArray(data?.countries)) data = data.countries;
    else throw new Error('Format JSON tidak dikenal. Harus array negara atau object { data: [...] }/{ countries: [...] }.');
  }

  await sequelize.authenticate();

  const total = data.length;
  console.log(`▶ Mulai seeding ${total} negara dari: ${jsonPath}`);

  for (let i = 0; i < total; i++) {
    // Jalankan per-negara supaya memory stabil & kalau gagal tidak merusak batch lain
    // (Jika ingin paralel, hati-hati dengan beban & deadlock)
    // eslint-disable-next-line no-await-in-loop
    await seedOneCountry(data[i], i, total);
  }

  console.log('🏁 Selesai seeding countries+states+cities.');
}

async function down() {
  // Tidak melakukan rollback destruktif secara default (hindari hapus massal produksi).
  // Jika butuh, kamu bisa implement truncate terkontrol berikut:
  // await KabupatenKota.destroy({ where: {}, truncate: true, cascade: true });
  // await Provinsi.destroy({ where: {}, truncate: true, cascade: true });
  // await Bangsa.destroy({ where: {}, truncate: true, cascade: true });
  console.log('Seeder down() dipanggil. No-op.');
}

module.exports = { up, down };

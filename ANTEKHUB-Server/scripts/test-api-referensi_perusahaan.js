// File: scripts/test-api-referensi-perusahaan.js
// Tujuan: Testing CRUD referensi_perusahaan.controller.js (master table, tanpa pagination)
//         Termasuk filter via query: bangsa_uuid, provinsi_uuid, kabupaten_uuid,
//         jenis_institusi_uuid, bidang_industri_uuid, search & alias (TANPA filter jabatan).
// Jalankan: node scripts/test-api-referensi-perusahaan.js
// ENV opsional: BASE_URL (default http://localhost:3000)

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API = `${BASE_URL}/api`;
const OUT_DIR = path.join(process.cwd(), 'logs');
mkdirp.sync(OUT_DIR);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = path.join(OUT_DIR, `test-referensi-perusahaan-results-${stamp}.json`);

const seededSuperAdmin = { username: 'superadmin_7843', password: 'SAdmin#7843' };

const results = [];
let TOKEN = null;
let CREATED = []; // uuid perusahaan yang dibuat
// Entitas pendukung untuk filter (simpen id dan uuid)
let BANGSA = null;
let PROVINSI = null;
let KABUPATEN = null;
let JENIS = null;
let BIDANG = null;

function record(name, req, res, err, expect) {
  results.push({
    name,
    expect,
    request: req,
    response: res
      ? { status: res.status, statusText: res.statusText, headers: res.headers, data: res.data }
      : null,
    error: err
      ? {
          message: err.message,
          code: err.code || null,
          response: err.response ? { status: err.response.status, data: err.response.data } : null
        }
      : null,
    ts: new Date().toISOString()
  });
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function http(opts) {
  const { method, url, body, headers } = opts;
  const cfg = {
    method,
    url,
    headers: headers || {},
    data: body,
    validateStatus: () => true,
    timeout: 20000
  };
  return axios(cfg);
}

async function loginAdmin() {
  const name = 'Auth: login admin (superadmin seeder)';
  const req = {
    method: 'POST',
    url: `${API}/auth/admin/login`,
    body: { username: seededSuperAdmin.username, password: seededSuperAdmin.password },
    headers: { 'Content-Type': 'application/json' }
  };
  const res = await http(req);
  record(name, req, res, null, '200 + token');
  assert(res.status === 200, `Login harus 200, dapat ${res.status}`);
  assert(res.data && res.data.token, 'Response tidak mengandung token');
  TOKEN = res.data.token;
}

function authHeader() {
  return { Authorization: `Bearer ${TOKEN}` };
}

/* =========================
 *  SEED MASTER ENTITIES
 *  - Bangsa (Indonesia)
 *  - Provinsi (di atas bangsa)
 *  - Kabupaten (di atas provinsi)
 *  - Jenis Institusi
 *  - Bidang Industri
 *  Idempotent: cek → buat jika belum ada
 * ========================= */

async function ensureBangsa() {
  // cari by iso2=ID
  const q = { method: 'GET', url: `${API}/negara?iso2=ID`, headers: authHeader() };
  const got = await http(q);
  record('Bangsa: get by iso2=ID', q, got, null, '200');
  assert(got.status === 200, `GET bangsa harus 200, dapat ${got.status}`);
  const rows = Array.isArray(got.data?.data) ? got.data.data : [];
  let row = rows.find((r) => String(r.iso2).toUpperCase() === 'ID');

  if (!row) {
    const req = {
      method: 'POST',
      url: `${API}/negara`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: {
        nama: `Indonesia Seed ${Date.now()}`,
        iso3: 'IDN',
        iso2: 'ID',
        kode_telepon: 62,
        region: 'Asia',
        subregion: 'Southeast Asia',
        longitude: 106.8,
        latitude: -6.2
      }
    };
    const res = await http(req);
    record('Bangsa: seed Indonesia (create)', req, res, null, '201/409');
    assert([201, 409].includes(res.status) || (res.status === 200 && res.data?.data), `Create Bangsa expected 201/409/200, got ${res.status}`);
    row = res.data?.data || row;
  }

  if (!row?.id) {
    const ref = await http(q);
    record('Bangsa: re-fetch after seed', q, ref, null, '200');
    assert(ref.status === 200, `Re-fetch bangsa harus 200, dapat ${ref.status}`);
    const rows2 = Array.isArray(ref.data?.data) ? ref.data.data : [];
    row = rows2.find((r) => String(r.iso2).toUpperCase() === 'ID') || row;
  }

  assert(row?.id && row?.uuid, 'Bangsa ID tidak tersedia');
  BANGSA = row;
}

async function ensureProvinsi() {
  // GET provinsi by BANGSA UUID  → /api/negara/:bangsa_uuid/provinsi
  const q = {
    method: 'GET',
    url: `${API}/negara/${encodeURIComponent(BANGSA.uuid)}/provinsi`,
    headers: authHeader()
  };
  const got = await http(q);
  record('Provinsi: GET by bangsa_uuid (merge params)', q, got, null, '200');
  assert(got.status === 200, `GET provinsi harus 200, dapat ${got.status}`);

  const rows = Array.isArray(got.data?.data) ? got.data.data : [];
  let row = rows[0];

  if (!row) {
    // CREATE masih ke endpoint create biasa (sesuai router kamu)
    // kalau create kamu ditempatkan di /api/negara/provinsi, pakai itu;
    // kalau di /api/provinsi, biarkan seperti ini:
    const req = {
      method: 'POST',
      url: `${API}/negara/provinsi`, // ganti ke `${API}/provinsi` jika memang di situ
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: {
        bangsa_id: BANGSA.id,         // controller provinsi kamu pakai FK numeric
        nama: `Prov Seed ${Date.now()}`,
        iso2: 'PVS',
        iso3166_2: 'ID-PVS',
        longitude: 106.8,
        latitude: -6.2
      }
    };
    const res = await http(req);
    record('Provinsi: seed (create)', req, res, null, '201/200');
    assert([201, 200].includes(res.status), `Create Provinsi expected 201/200, got ${res.status}`);
    row = res.data?.data || res.data;
  }

  assert(row?.id && row?.uuid, 'Provinsi ID/UUID tidak tersedia');
  PROVINSI = row;
}

async function ensureKabupaten() {
  // Prioritas 1: GET by Bangsa + Provinsi UUID
  // /api/negara/:bangsa_uuid/provinsi/:provinsi_uuid/kabupaten-kota
  let got, q;

  try {
    q = {
      method: 'GET',
      url: `${API}/negara/${encodeURIComponent(BANGSA.uuid)}/provinsi/${encodeURIComponent(PROVINSI.uuid)}/kabupaten-kota`,
      headers: authHeader()
    };
    got = await http(q);
    record('Kabupaten: GET by bangsa_uuid + provinsi_uuid', q, got, null, '200');
  } catch (e) {
    // ignore; akan fallback di bawah
  }

  // Fallback 1: GET by Provinsi UUID
  if (!got || got.status !== 200) {
    q = {
      method: 'GET',
      // /api/negara/:provinsi_uuid/kabupaten-kota  (sesuai route kamu)
      url: `${API}/negara/${encodeURIComponent(PROVINSI.uuid)}/kabupaten-kota`,
      headers: authHeader()
    };
    got = await http(q);
    record('Kabupaten: GET by provinsi_uuid', q, got, null, '200');
  }

  // Fallback 2: GET by Bangsa UUID
  if (got.status !== 200) {
    q = {
      method: 'GET',
      // /api/negara/:bangsa_uuid/kabupaten-kota  (sesuai route kamu)
      url: `${API}/negara/${encodeURIComponent(BANGSA.uuid)}/kabupaten-kota`,
      headers: authHeader()
    };
    got = await http(q);
    record('Kabupaten: GET by bangsa_uuid', q, got, null, '200');
  }

  if (got.status !== 200) {
    console.log('⚠ Endpoint kabupaten-kota GET tidak 200, beberapa tes akan dilewati.');
    return;
  }

  const rows = Array.isArray(got.data?.data) ? got.data.data : [];
  let row = rows[0];

  if (!row) {
    // CREATE: biarkan sesuai endpoint create kamu (umumnya /api/kabupaten-kota)
    const req = {
      method: 'POST',
      url: `${API}/kabupaten-kota`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: {
        provinsi_id: PROVINSI.id,   // FK numeric
        nama: `Kab Seed ${Date.now()}`,
        longitude: 107.6,
        latitude: -6.9
      }
    };
    const res = await http(req);
    record('Kabupaten: seed (create)', req, res, null, '201/200');
    if (![201, 200].includes(res.status)) {
      console.log('⚠ Create kabupaten gagal, beberapa tes akan dilewati.');
      return;
    }
    row = res.data?.data || res.data;
  }

  if (!(row?.id && row?.uuid)) {
    console.log('⚠ Kabupaten tidak memiliki id/uuid, beberapa tes akan dilewati.');
    return;
  }
  KABUPATEN = row;
}

async function ensureJenis() {
  // cari minimal satu JenisInstitusi
  const q = { method: 'GET', url: `${API}/jenis-institusi?search=Uji`, headers: authHeader() };
  const got = await http(q);
  record('Jenis: get any (search=Uji)', q, got, null, '200');
  if (got.status !== 200) throw new Error(`GET jenis institusi harus 200, dapat ${got.status}`);
  const rows = Array.isArray(got.data?.data) ? got.data.data : [];
  let row = rows[0];

  if (!row) {
    const req = {
      method: 'POST',
      url: `${API}/jenis-institusi`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: { nama: `Jenis Uji ${Date.now()}`, kode: 'JNS', deskripsi: 'Jenis Uji', active: true }
    };
    const res = await http(req);
    record('Jenis: seed (create)', req, res, null, '201/200');
    assert([201, 200].includes(res.status), `Create Jenis expected 201/200, got ${res.status}`);
    row = res.data?.data || res.data;
  }

  assert(row?.id && row?.uuid, 'JenisInstitusi ID tidak tersedia');
  JENIS = row;
}

async function ensureBidang() {
  const q = { method: 'GET', url: `${API}/bidang-industri?search=Uji`, headers: authHeader() };
  const got = await http(q);
  record('Bidang: get any (search=Uji)', q, got, null, '200');
  if (got.status !== 200) throw new Error(`GET bidang industri harus 200, dapat ${got.status}`);
  const rows = Array.isArray(got.data?.data) ? got.data.data : [];
  let row = rows[0];

  if (!row) {
    const req = {
      method: 'POST',
      url: `${API}/bidang-industri`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: { nama: `Bidang Uji ${Date.now()}`, kode: 'BDG_UI', deskripsi: 'Bidang Uji', active: true }
    };
    const res = await http(req);
    record('Bidang: seed (create)', req, res, null, '201/200');
    assert([201, 200].includes(res.status), `Create Bidang expected 201/200, got ${res.status}`);
    row = res.data?.data || res.data;
  }

  assert(row?.id && row?.uuid, 'BidangIndustri ID tidak tersedia');
  BIDANG = row;
}

async function seedAllMasters() {
  await ensureBangsa();
  await ensureProvinsi();
  await ensureKabupaten(); // opsional; jika gagal → tes kabupaten di-skip
  await ensureJenis();
  await ensureBidang();
}

// ====== Payload ReferensiPerusahaan ======
function makeCreatePayload(i) {
  return {
    nama_perusahaan: `Perusahaan Uji ${i}-${Date.now()}`,
    slug: `perusahaan-uji-${i}-${Date.now()}`,
    jenis_perusahaan_id: JENIS?.id || null,
    bidang_industri_id: BIDANG?.id || null,
    perusahaan_negara_id: BANGSA?.id || null,
    perusahaan_provinsi_id: PROVINSI?.id || null,
    perusahaan_kabupaten_id: KABUPATEN?.id || null,
    perusahaan_alamat: `Jl. Uji No.${i}`,
    longitude: 106.8 + i,
    latitude: -6.2 - i,
    alias_list: i % 2 === 0 ? ['Corp', 'PT'] : ['Ltd', 'Holding'],
    total_alumni: i * 10
  };
}

function makeBadPayload_missingRequired() {
  return {
    // nama_perusahaan hilang
    perusahaan_alamat: '', // kosong
    longitude: 106.7,
    latitude: -6.2
  };
}

function makeBadPayload_invalidSchema() {
  return {
    nama_perusahaan: '',
    perusahaan_alamat: 'Jl. Salah',
    longitude: 'timur',     // salah tipe
    latitude: -1000,        // out of range
    total_alumni: -5,       // invalid min
    alias_list: 'bukan_array'
  };
}

// ====== TESTS ======
async function t1_create_ok() {
  const name = 'RefPerusahaan: create OK (2 rows)';
  const createdLocal = [];
  for (let i = 1; i <= 2; i++) {
    const req = {
      method: 'POST',
      url: `${API}/referensi-perusahaan`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: makeCreatePayload(i)
    };
    const res = await http(req);
    record(`${name} #${i}`, req, res, null, '201 + data.uuid');
    assert(res.status === 201, `Create harus 201, dapat ${res.status}`);
    assert(res.data && res.data.data && res.data.data.uuid, 'Response tidak mengandung data.uuid');
    createdLocal.push(res.data.data.uuid);
  }
  CREATED = createdLocal;
}

async function t1_create_error_missing_required() {
  const name = 'RefPerusahaan: create ERROR missing required fields';
  const req = {
    method: 'POST',
    url: `${API}/referensi-perusahaan`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_missingRequired()
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Missing required harus 400/422, dapat ${res.status}`);
}

async function t1_create_error_invalid_schema() {
  const name = 'RefPerusahaan: create ERROR invalid schema';
  const req = {
    method: 'POST',
    url: `${API}/referensi-perusahaan`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_invalidSchema()
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Invalid schema harus 400/422, dapat ${res.status}`);
}

// LIST (tanpa pagination)
async function t2_get_list_default() {
  const name = 'RefPerusahaan: get list default (no pagination)';
  const req = { method: 'GET', url: `${API}/referensi-perusahaan`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array');
  assert(res.status === 200, `List harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data.data), 'Response.data.data harus array');
  assert(typeof res.data.meta?.total === 'number', 'meta.total harus number');
}

async function t2_get_list_filters() {
  // search by nama/slug
  const req1 = { method: 'GET', url: `${API}/referensi-perusahaan?search=Perusahaan%20Uji`, headers: authHeader() };
  const res1 = await http(req1);
  record('RefPerusahaan: filter search', req1, res1, null, '200');
  assert(res1.status === 200, `Search harus 200, dapat ${res1.status}`);

  // alias contains (1)
  const req2 = { method: 'GET', url: `${API}/referensi-perusahaan?alias=Corp`, headers: authHeader() };
  const res2 = await http(req2);
  record('RefPerusahaan: filter alias contains(1)', req2, res2, null, '200');
  assert(res2.status === 200, `Filter alias harus 200, dapat ${res2.status}`);

  // bangsa_uuid
  const req3 = { method: 'GET', url: `${API}/referensi-perusahaan?bangsa_uuid=${encodeURIComponent(BANGSA.uuid)}`, headers: authHeader() };
  const res3 = await http(req3);
  record('RefPerusahaan: filter bangsa_uuid', req3, res3, null, '200');
  assert(res3.status === 200, `Filter bangsa_uuid harus 200, dapat ${res3.status}`);

  // bangsa + provinsi (jika PROVINSI tersedia)
  if (PROVINSI?.uuid) {
    const req4 = {
      method: 'GET',
      url: `${API}/referensi-perusahaan?bangsa_uuid=${encodeURIComponent(BANGSA.uuid)}&provinsi_uuid=${encodeURIComponent(PROVINSI.uuid)}`,
      headers: authHeader()
    };
    const res4 = await http(req4);
    record('RefPerusahaan: filter bangsa_uuid + provinsi_uuid', req4, res4, null, '200');
    assert(res4.status === 200, `Filter bangsa+provinsi harus 200, dapat ${res4.status}`);
  } else {
    record('RefPerusahaan: filter bangsa+provinsi (SKIPPED)', { url: 'N/A' }, null, null, 'skipped');
    console.log('⚠ Skip filter provinsi: PROVINSI tidak tersedia.');
  }

  // bangsa + provinsi + kabupaten (jika KABUPATEN tersedia)
  if (PROVINSI?.uuid && KABUPATEN?.uuid) {
    const req5 = {
      method: 'GET',
      url: `${API}/referensi-perusahaan?bangsa_uuid=${encodeURIComponent(BANGSA.uuid)}&provinsi_uuid=${encodeURIComponent(PROVINSI.uuid)}&kabupaten_uuid=${encodeURIComponent(KABUPATEN.uuid)}`,
      headers: authHeader()
    };
    const res5 = await http(req5);
    record('RefPerusahaan: filter bangsa+provinsi+kabupaten', req5, res5, null, '200');
    assert(res5.status === 200, `Filter bangsa+provinsi+kabupaten harus 200, dapat ${res5.status}`);
  } else {
    record('RefPerusahaan: filter bangsa+provinsi+kabupaten (SKIPPED)', { url: 'N/A' }, null, null, 'skipped');
    console.log('⚠ Skip filter kabupaten: KABUPATEN tidak tersedia.');
  }

  // jenis_institusi_uuid
  const req6 = { method: 'GET', url: `${API}/referensi-perusahaan?jenis_institusi_uuid=${encodeURIComponent(JENIS.uuid)}`, headers: authHeader() };
  const res6 = await http(req6);
  record('RefPerusahaan: filter jenis_institusi_uuid', req6, res6, null, '200');
  assert(res6.status === 200, `Filter jenis_institusi_uuid harus 200, dapat ${res6.status}`);

  // bidang_industri_uuid
  const req7 = { method: 'GET', url: `${API}/referensi-perusahaan?bidang_industri_uuid=${encodeURIComponent(BIDANG.uuid)}`, headers: authHeader() };
  const res7 = await http(req7);
  record('RefPerusahaan: filter bidang_industri_uuid', req7, res7, null, '200');
  assert(res7.status === 200, `Filter bidang_industri_uuid harus 200, dapat ${res7.status}`);

  // kombinasi lengkap (jika tersedia)
  if (PROVINSI?.uuid && KABUPATEN?.uuid) {
    const url = `${API}/referensi-perusahaan?bangsa_uuid=${encodeURIComponent(BANGSA.uuid)}&provinsi_uuid=${encodeURIComponent(PROVINSI.uuid)}&kabupaten_uuid=${encodeURIComponent(KABUPATEN.uuid)}&jenis_institusi_uuid=${encodeURIComponent(JENIS.uuid)}&bidang_industri_uuid=${encodeURIComponent(BIDANG.uuid)}&alias=PT`;
    const req8 = { method: 'GET', url, headers: authHeader() };
    const res8 = await http(req8);
    record('RefPerusahaan: filter kombinasi lengkap', req8, res8, null, '200');
    assert(res8.status === 200, `Filter kombinasi lengkap harus 200, dapat ${res8.status}`);
  } else {
    record('RefPerusahaan: filter kombinasi lengkap (SKIPPED)', { url: 'N/A' }, null, null, 'skipped');
    console.log('⚠ Skip kombinasi lengkap: PROVINSI/KABUPATEN tidak tersedia.');
  }
}

async function t3_get_detail_ok() {
  const name = 'RefPerusahaan: get detail OK';
  const uuid = CREATED[0];
  const req = { method: 'GET', url: `${API}/referensi-perusahaan/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + uuid sama');
  assert(res.status === 200, `Detail harus 200, dapat ${res.status}`);
  assert(res.data && res.data.data && res.data.data.uuid === uuid, 'Detail UUID tidak cocok');
}

async function t3_get_detail_not_found() {
  const name = 'RefPerusahaan: get detail NOT FOUND';
  const req = { method: 'GET', url: `${API}/referensi-perusahaan/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Not-found harus 404/400, dapat ${res.status}`);
}

async function t4_update_ok() {
  const name = 'RefPerusahaan: update OK (alias_list + total_alumni)';
  const uuid = CREATED[0];
  const body = { alias_list: ['ENTERPRISE', 'PT'], total_alumni: 999, slug: `perusahaan-upd-${Date.now()}` };
  const req = {
    method: 'PATCH',
    url: `${API}/referensi-perusahaan/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Update harus 200, dapat ${res.status}`);
}

async function t4_update_error_invalid_schema() {
  const name = 'RefPerusahaan: update ERROR invalid schema';
  const uuid = CREATED[0];
  const body = { longitude: 'timur', total_alumni: -100, alias_list: 'salah' }; // tipe salah
  const req = {
    method: 'PATCH',
    url: `${API}/referensi-perusahaan/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Invalid schema seharusnya 400/422, dapat ${res.status}`);
}

async function t5_delete_not_found() {
  const name = 'RefPerusahaan: delete NOT FOUND';
  const req = { method: 'DELETE', url: `${API}/referensi-perusahaan/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Delete not-found seharusnya 404/400, dapat ${res.status}`);
}

async function t5_delete_ok() {
  const name = 'RefPerusahaan: delete OK';
  const uuid = CREATED[1]; // hapus yang kedua
  const req = { method: 'DELETE', url: `${API}/referensi-perusahaan/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete harus 200, dapat ${res.status}`);
}

async function t6_delete_all_ok() {
  const name = 'RefPerusahaan: delete ALL OK';
  const req = { method: 'DELETE', url: `${API}/referensi-perusahaan/__all`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete all harus 200, dapat ${res.status}`);
}

async function main() {
  const summary = { startedAt: new Date().toISOString(), baseUrl: BASE_URL, apiBase: API };
  let failed = 0;

  const steps = [
    loginAdmin,

    // SEED pendukung (wajib untuk filter sukses)
    seedAllMasters,

    // CREATE
    t1_create_ok,
    t1_create_error_missing_required,
    t1_create_error_invalid_schema,

    // LIST (no pagination + filters)
    t2_get_list_default,
    t2_get_list_filters,

    // DETAIL
    t3_get_detail_ok,
    t3_get_detail_not_found,

    // UPDATE
    t4_update_ok,
    t4_update_error_invalid_schema,

    // DELETE
    t5_delete_not_found,
    t5_delete_ok,

    // DELETE ALL
    t6_delete_all_ok
  ];

  for (const fn of steps) {
    try {
      await fn();
      console.log(`✔ ${fn.name}`);
    } catch (e) {
      console.error(`✖ ${fn.name}: ${e.message}`);
      failed++;
    }
  }

  fs.writeFileSync(
    outFile,
    JSON.stringify({ summary: { ...summary, finishedAt: new Date().toISOString(), failed }, results }, null, 2),
    'utf8'
  );
  console.log(`Saved report: ${outFile}`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  try {
    fs.writeFileSync(outFile, JSON.stringify({ fatal: e.message, results }, null, 2), 'utf8');
    console.log(`Saved report (fatal): ${outFile}`);
  } catch {}
  process.exit(1);
});

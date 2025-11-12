// File: scripts/test-api-provinsi.js
// Tujuan: Testing CRUD provinsi.controller.js (master table, tanpa pagination)
// Jalankan: node scripts/test-api-provinsi.js
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
const outFile = path.join(OUT_DIR, `test-provinsi-results-${stamp}.json`);

const seededSuperAdmin = { username: 'superadmin_7843', password: 'SAdmin#7843' };

const results = [];
let TOKEN = null;
let CREATED = []; // uuid provinsi yang dibuat
let BANGSA = {};  // { ID: {id, uuid, ...}, SG: {id, uuid, ...} }

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

/** =========================
 *  SEED BANGSA (ID & SG)
 *  - Idempotent: cek dulu; kalau tidak ada → create
 *  - Simpan ke BANGSA.ID & BANGSA.SG
 *  ========================= */
async function ensureBangsaSeed() {
  // 1) Cek data yang sudah ada
  const q = { method: 'GET', url: `${API}/negara?iso2=ID&iso2=SG`, headers: authHeader() };
  const got = await http(q);
  record('Bangsa: get existing (iso2=ID,SG)', q, got, null, '200');
  assert(got.status === 200, `GET bangsa harus 200, dapat ${got.status}`);

  const rows = Array.isArray(got.data?.data) ? got.data.data : [];
  const findByIso2 = (iso2) => rows.find((r) => String(r.iso2).toUpperCase() === iso2);

  let ID = findByIso2('ID');
  let SG = findByIso2('SG');

  // 2) Create jika belum ada
  if (!ID) {
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
    record('Bangsa: seed Indonesia (create if missing)', req, res, null, '201');
    assert([201, 409].includes(res.status) || (res.status === 200 && res.data?.data), `Create IDN expected 201/409/200, got ${res.status}`);
    ID = res.data?.data || ID;
  }

  if (!SG) {
    const req = {
      method: 'POST',
      url: `${API}/negara`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: {
        nama: `Singapura Seed ${Date.now()}`,
        iso3: 'SGP',
        iso2: 'SG',
        kode_telepon: 65,
        region: 'Asia',
        subregion: 'Southeast Asia',
        longitude: 103.8,
        latitude: 1.35
      }
    };
    const res = await http(req);
    record('Bangsa: seed Singapura (create if missing)', req, res, null, '201');
    assert([201, 409].includes(res.status) || (res.status === 200 && res.data?.data), `Create SGP expected 201/409/200, got ${res.status}`);
    SG = res.data?.data || SG;
  }

  // 3) Kalau masih belum punya id karena 409, ambil ulang via GET
  if (!ID?.id || !SG?.id) {
    const req = { method: 'GET', url: `${API}/negara?iso2=ID&iso2=SG`, headers: authHeader() };
    const res = await http(req);
    record('Bangsa: re-fetch after seed', req, res, null, '200');
    assert(res.status === 200, `Re-fetch bangsa harus 200, dapat ${res.status}`);
    const rows2 = Array.isArray(res.data?.data) ? res.data.data : [];
    const byIso2 = (iso2) => rows2.find((r) => String(r.iso2).toUpperCase() === iso2);
    ID = ID?.id ? ID : byIso2('ID');
    SG = SG?.id ? SG : byIso2('SG');
  }

  assert(ID?.id, 'Gagal memastikan bangsa Indonesia (ID) tersedia');
  assert(SG?.id, 'Gagal memastikan bangsa Singapura (SG) tersedia');

  BANGSA = { ID, SG };
}

// ====== PAYLOAD UTAMA (pakai bangsa_id hasil seed) ======
function makeCreatePayload(i) {
  const useSG = i % 2 === 0;
  const bangsaId = useSG ? BANGSA.SG.id : BANGSA.ID.id;
  return {
    bangsa_id: bangsaId,
    nama: `Provinsi Uji ${i}-${Date.now()}`, // unik
    iso2: useSG ? 'JBR' : 'JKT',
    iso3166_2: useSG ? 'ID-JB' : 'ID-JK',
    longitude: 106.8 + i,
    latitude: -6.2 - i
  };
}

// Payload salah: field wajib hilang
function makeBadPayload_missingRequired() {
  return {
    // bangsa_id hilang
    // nama hilang
    iso2: 'XXX',
    iso3166_2: 'ID-XX'
  };
}

// Payload salah: validation gagal (tipe/format salah)
function makeBadPayload_invalidSchema() {
  return {
    bangsa_id: 'SATU',      // harus number
    nama: '',               // nama required tidak boleh kosong
    iso2: 123,              // harus string
    iso3166_2: 456,         // harus string
    longitude: '106',       // harus number
    latitude: '6'           // harus number
  };
}

// ====== TESTS ======
async function t1_create_ok() {
  const name = 'Provinsi: create OK (2 rows)';
  const createdLocal = [];
  for (let i = 1; i <= 2; i++) {
    const req = {
      method: 'POST',
      url: `${API}/provinsi`, // << gunakan /api/provinsi
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
  const name = 'Provinsi: create ERROR missing required fields';
  const req = {
    method: 'POST',
    url: `${API}/provinsi`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_missingRequired()
  };
  const res = await http(req);
  record(name, req, res, null, '422');
  assert([400, 422].includes(res.status), `Missing required harus 400/422, dapat ${res.status}`);
}

async function t1_create_error_invalid_schema() {
  const name = 'Provinsi: create ERROR invalid schema';
  const req = {
    method: 'POST',
    url: `${API}/provinsi`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_invalidSchema()
  };
  const res = await http(req);
  record(name, req, res, null, '422');
  assert([400, 422].includes(res.status), `Invalid schema harus 400/422, dapat ${res.status}`);
}

// LIST (tanpa pagination) - GLOBAL
async function t2_get_list_default() {
  const name = 'Provinsi: get list default (no pagination)';
  const req = { method: 'GET', url: `${API}/provinsi`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array');
  assert(res.status === 200, `List harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data.data), 'Response.data.data harus array');
  assert(typeof res.data.meta?.total === 'number', 'meta.total harus number');
}

async function t2_get_list_filters() {
  // search by nama
  const req1 = { method: 'GET', url: `${API}/provinsi?search=Provinsi%20Uji`, headers: authHeader() };
  const res1 = await http(req1);
  record('Provinsi: filter search by nama', req1, res1, null, '200');
  assert(res1.status === 200, `Search harus 200, dapat ${res1.status}`);

  // filter bangsa_id (multi)
  const req2 = { method: 'GET', url: `${API}/provinsi?bangsa_id=${BANGSA.ID.id}&bangsa_id=${BANGSA.SG.id}`, headers: authHeader() };
  const res2 = await http(req2);
  record('Provinsi: filter bangsa_id=ID&SG', req2, res2, null, '200');
  assert(res2.status === 200, `Filter bangsa_id harus 200, dapat ${res2.status}`);

  // filter iso2
  const req3 = { method: 'GET', url: `${API}/provinsi?iso2=JBR`, headers: authHeader() };
  const res3 = await http(req3);
  record('Provinsi: filter iso2=JBR', req3, res3, null, '200');
  assert(res3.status === 200, `Filter iso2 harus 200, dapat ${res3.status}`);

  // filter iso3166_2
  const req4 = { method: 'GET', url: `${API}/provinsi?iso3166_2=ID-JB`, headers: authHeader() };
  const res4 = await http(req4);
  record('Provinsi: filter iso3166_2=ID-JB', req4, res4, null, '200');
  assert(res4.status === 200, `Filter iso3166_2 harus 200, dapat ${res4.status}`);
}

// LIST (scoped by UUID negara) - BARU
async function t2b_get_list_by_negara_uuid() {
  const name = 'Provinsi: get list by negara UUID (no pagination)';
  const bangsaUuid = BANGSA.ID.uuid; // tes pakai Indonesia
  const req = { method: 'GET', url: `${API}/negara/${bangsaUuid}/provinsi`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array scoped');
  assert(res.status === 200, `List by negara harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data.data), 'Response.data.data harus array');

  // Validasi: semua row punya bangsa_id = ID.id
  const expectedId = BANGSA.ID.id;
  for (const r of res.data.data) {
    assert(r.bangsa_id === expectedId, `Row bukan milik bangsa ${expectedId}`);
  }
}

async function t3_get_detail_ok() {
  const name = 'Provinsi: get detail OK';
  const uuid = CREATED[0];
  const req = { method: 'GET', url: `${API}/provinsi/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + uuid sama');
  assert(res.status === 200, `Detail harus 200, dapat ${res.status}`);
  assert(res.data && res.data.data && res.data.data.uuid === uuid, 'Detail UUID tidak cocok');
}

async function t3_get_detail_not_found() {
  const name = 'Provinsi: get detail NOT FOUND';
  const req = { method: 'GET', url: `${API}/provinsi/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404');
  assert([404, 400].includes(res.status), `Not-found harus 404/400, dapat ${res.status}`);
}

async function t4_update_ok() {
  const name = 'Provinsi: update OK (iso2 + iso3166_2)';
  const uuid = CREATED[0];
  const body = { iso2: 'BLI', iso3166_2: 'ID-BA' };
  const req = {
    method: 'PATCH',
    url: `${API}/provinsi/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Update harus 200, dapat ${res.status}`);
}

async function t4_update_error_invalid_schema() {
  const name = 'Provinsi: update ERROR invalid schema';
  const uuid = CREATED[0];
  const body = { bangsa_id: 'SATU', longitude: 'seratus' }; // tipe salah
  const req = {
    method: 'PATCH',
    url: `${API}/provinsi/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '422');
  assert([400, 422].includes(res.status), `Invalid schema seharusnya 400/422, dapat ${res.status}`);
}

async function t5_delete_not_found() {
  const name = 'Provinsi: delete NOT FOUND';
  const req = { method: 'DELETE', url: `${API}/provinsi/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404');
  assert([404, 400].includes(res.status), `Delete not-found seharusnya 404/400, dapat ${res.status}`);
}

async function t5_delete_ok() {
  const name = 'Provinsi: delete OK';
  const uuid = CREATED[1]; // hapus yang kedua
  const req = { method: 'DELETE', url: `${API}/provinsi/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete harus 200, dapat ${res.status}`);
}

async function t6_delete_all_ok() {
  const name = 'Provinsi: delete ALL OK';
  const req = { method: 'DELETE', url: `${API}/provinsi/__all`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete all harus 200, dapat ${res.status}`);
}

async function main() {
  const summary = { startedAt: new Date().toISOString(), baseUrl: BASE_URL, apiBase: API };

  let failed = 0;
  const steps = [
    loginAdmin,

    // Penting: seed master Bangsa lebih dulu
    ensureBangsaSeed,

    // CREATE
    t1_create_ok,
    t1_create_error_missing_required,
    t1_create_error_invalid_schema,

    // LIST (no pagination)
    t2_get_list_default,
    t2_get_list_filters,

    // LIST scoped by UUID negara (BARU)
    t2b_get_list_by_negara_uuid,

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

  // write report
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

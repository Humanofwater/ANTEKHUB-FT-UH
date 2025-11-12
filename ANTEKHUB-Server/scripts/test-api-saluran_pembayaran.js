// File: scripts/test-api-saluran-pembayaran.js
// Tujuan: Testing CRUD saluran_pembayaran.controller.js (master table, tanpa pagination)
// Jalankan: node scripts/test-api-saluran-pembayaran.js
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
const outFile = path.join(OUT_DIR, `test-saluran-pembayaran-results-${stamp}.json`);

const seededSuperAdmin = { username: 'superadmin_7843', password: 'SAdmin#7843' };

const results = [];
let TOKEN = null;
let CREATED = []; // uuid saluran pembayaran yang dibuat
let METODE = {};  // { VA: {id, uuid, ...}, EWL: {id, uuid, ...} }

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
 *  SEED METODE_PEMBAYARAN (VA & EWL)
 *  - Idempotent: cek dulu; kalau tidak ada → create
 *  - Simpan ke METODE.VA & METODE.EWL
 *  ========================= */
async function ensureMetodeSeed() {
  // 1) Cek data yang sudah ada
  const q = { method: 'GET', url: `${API}/metode-pembayaran?kode_metode=VA&kode_metode=EWL`, headers: authHeader() };
  const got = await http(q);
  record('Metode: get existing (kode_metode=VA,EWL)', q, got, null, '200');
  assert(got.status === 200, `GET metode harus 200, dapat ${got.status}`);

  const rows = Array.isArray(got.data?.data) ? got.data.data : [];
  const byKode = (k) => rows.find((r) => String(r.kode_metode).toUpperCase() === k);

  let VA = byKode('VA');
  let EWL = byKode('EWL');

  // 2) Create jika belum ada
  if (!VA) {
    const req = {
      method: 'POST',
      url: `${API}/metode-pembayaran`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: { kode_metode: 'VA', nama: `Virtual Account Seed ${Date.now()}`, active: true }
    };
    const res = await http(req);
    record('Metode: seed VA (create if missing)', req, res, null, '201/409');
    assert([201, 409].includes(res.status) || (res.status === 200 && res.data?.data), `Create VA expected 201/409/200, got ${res.status}`);
    VA = res.data?.data || VA;
  }

  if (!EWL) {
    const req = {
      method: 'POST',
      url: `${API}/metode-pembayaran`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: { kode_metode: 'EWL', nama: `E-Wallet Seed ${Date.now()}`, active: true }
    };
    const res = await http(req);
    record('Metode: seed EWL (create if missing)', req, res, null, '201/409');
    assert([201, 409].includes(res.status) || (res.status === 200 && res.data?.data), `Create EWL expected 201/409/200, got ${res.status}`);
    EWL = res.data?.data || EWL;
  }

  // 3) Kalau masih belum punya id karena 409, ambil ulang via GET
  if (!VA?.id || !EWL?.id) {
    const req = { method: 'GET', url: `${API}/metode-pembayaran?kode_metode=VA&kode_metode=EWL`, headers: authHeader() };
    const res = await http(req);
    record('Metode: re-fetch after seed', req, res, null, '200');
    assert(res.status === 200, `Re-fetch metode harus 200, dapat ${res.status}`);
    const rows2 = Array.isArray(res.data?.data) ? res.data.data : [];
    const byK = (k) => rows2.find((r) => String(r.kode_metode).toUpperCase() === k);
    VA = VA?.id ? VA : byK('VA');
    EWL = EWL?.id ? EWL : byK('EWL');
  }

  assert(VA?.id, 'Gagal memastikan metode VA tersedia');
  assert(EWL?.id, 'Gagal memastikan metode EWL tersedia');

  METODE = { VA, EWL };
}

// ====== PAYLOAD UTAMA (pakai metode_pembayaran_id hasil seed) ======
function makeCreatePayload(i) {
  const useEwl = i % 2 === 0;
  const metodeId = useEwl ? METODE.EWL.id : METODE.VA.id;
  const prefix = useEwl ? 'EWL' : 'VA';
  return {
    metode_pembayaran_id: metodeId,
    kode_saluran: `${prefix}_${Date.now()}_${i}`, // unik
    nama: `Saluran ${prefix} Uji ${i}-${Date.now()}`,
    active: i % 2 === 1
  };
}

// Payload salah: field wajib hilang
function makeBadPayload_missingRequired() {
  return {
    // metode_pembayaran_id hilang
    // kode_saluran hilang
    nama: 'Tanpa Kode',
    active: true
  };
}

// Payload salah: validation gagal (tipe/format salah)
function makeBadPayload_invalidSchema() {
  return {
    metode_pembayaran_id: 'SATU',   // harus number
    kode_saluran: '',               // required
    nama: '',                       // required
    active: 'iya'                   // harus boolean
  };
}

// ====== TESTS ======
async function t1_create_ok() {
  const name = 'SaluranPembayaran: create OK (2 rows)';
  const createdLocal = [];
  for (let i = 1; i <= 2; i++) {
    const req = {
      method: 'POST',
      url: `${API}/saluran-pembayaran`,
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
  const name = 'SaluranPembayaran: create ERROR missing required fields';
  const req = {
    method: 'POST',
    url: `${API}/saluran-pembayaran`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_missingRequired()
  };
  const res = await http(req);
  record(name, req, res, null, '422');
  assert([400, 422].includes(res.status), `Missing required harus 400/422, dapat ${res.status}`);
}

async function t1_create_error_invalid_schema() {
  const name = 'SaluranPembayaran: create ERROR invalid schema';
  const req = {
    method: 'POST',
    url: `${API}/saluran-pembayaran`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_invalidSchema()
  };
  const res = await http(req);
  record(name, req, res, null, '422');
  assert([400, 422].includes(res.status), `Invalid schema harus 400/422, dapat ${res.status}`);
}

// LIST (tanpa pagination)
async function t2_get_list_default() {
  const name = 'SaluranPembayaran: get list default (no pagination)';
  const req = { method: 'GET', url: `${API}/saluran-pembayaran`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array');
  assert(res.status === 200, `List harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data.data), 'Response.data.data harus array');
  assert(typeof res.data.meta?.total === 'number', 'meta.total harus number');
}

async function t2_get_list_filters() {
  // search by nama/kode
  const req1 = { method: 'GET', url: `${API}/saluran-pembayaran?search=Saluran`, headers: authHeader() };
  const res1 = await http(req1);
  record('SaluranPembayaran: filter search', req1, res1, null, '200');
  assert(res1.status === 200, `Search harus 200, dapat ${res1.status}`);

  // filter metode_pembayaran_id (multi)
  const req2 = {
    method: 'GET',
    url: `${API}/saluran-pembayaran?metode_pembayaran_id=${METODE.VA.id}&metode_pembayaran_id=${METODE.EWL.id}`,
    headers: authHeader()
  };
  const res2 = await http(req2);
  record('SaluranPembayaran: filter metode_pembayaran_id=VA&EWL', req2, res2, null, '200');
  assert(res2.status === 200, `Filter metode_pembayaran_id harus 200, dapat ${res2.status}`);

  // filter kode_saluran (multi)
  const req3 = { method: 'GET', url: `${API}/saluran-pembayaran?kode_saluran=${encodeURIComponent('VA_X')}&kode_saluran=${encodeURIComponent('EWL_X')}`, headers: authHeader() };
  const res3 = await http(req3);
  record('SaluranPembayaran: filter kode_saluran multi', req3, res3, null, '200');
  assert(res3.status === 200, `Filter kode_saluran harus 200, dapat ${res3.status}`);

  // filter active
  const req4 = { method: 'GET', url: `${API}/saluran-pembayaran?active=true`, headers: authHeader() };
  const res4 = await http(req4);
  record('SaluranPembayaran: filter active=true', req4, res4, null, '200');
  assert(res4.status === 200, `Filter active harus 200, dapat ${res4.status}`);
}

// LIST (scoped by UUID metode) - analog t2b provinsi
async function t2b_get_list_by_metode_uuid() {
  const name = 'SaluranPembayaran: get list by metode UUID (no pagination)';
  const metodeUuid = METODE.VA.uuid; // tes pakai VA
  const req = { method: 'GET', url: `${API}/metode-pembayaran/${metodeUuid}/saluran-pembayaran`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array scoped');
  assert(res.status === 200, `List by metode harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data.data), 'Response.data.data harus array');

  // Validasi: semua row punya metode_pembayaran_id = VA.id
  const expectedId = METODE.VA.id;
  for (const r of res.data.data) {
    assert(r.metode_pembayaran_id === expectedId, `Row bukan milik metode ${expectedId}`);
  }
}

async function t3_get_detail_ok() {
  const name = 'SaluranPembayaran: get detail OK';
  const uuid = CREATED[0];
  const req = { method: 'GET', url: `${API}/saluran-pembayaran/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + uuid sama');
  assert(res.status === 200, `Detail harus 200, dapat ${res.status}`);
  assert(res.data && res.data.data && res.data.data.uuid === uuid, 'Detail UUID tidak cocok');
}

async function t3_get_detail_not_found() {
  const name = 'SaluranPembayaran: get detail NOT FOUND';
  const req = { method: 'GET', url: `${API}/saluran-pembayaran/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404');
  assert([404, 400].includes(res.status), `Not-found harus 404/400, dapat ${res.status}`);
}

async function t4_update_ok() {
  const name = 'SaluranPembayaran: update OK (nama + active)';
  const uuid = CREATED[0];
  const body = { nama: `Saluran Updated ${Date.now()}`, active: true };
  const req = {
    method: 'PATCH',
    url: `${API}/saluran-pembayaran/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Update harus 200, dapat ${res.status}`);
}

async function t4_update_error_invalid_schema() {
  const name = 'SaluranPembayaran: update ERROR invalid schema';
  const uuid = CREATED[0];
  const body = { metode_pembayaran_id: 'SATU', active: 'iya' }; // tipe salah
  const req = {
    method: 'PATCH',
    url: `${API}/saluran-pembayaran/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '422');
  assert([400, 422].includes(res.status), `Invalid schema seharusnya 400/422, dapat ${res.status}`);
}

async function t5_delete_not_found() {
  const name = 'SaluranPembayaran: delete NOT FOUND';
  const req = { method: 'DELETE', url: `${API}/saluran-pembayaran/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404');
  assert([404, 400].includes(res.status), `Delete not-found seharusnya 404/400, dapat ${res.status}`);
}

async function t5_delete_ok() {
  const name = 'SaluranPembayaran: delete OK';
  const uuid = CREATED[1]; // hapus yang kedua
  const req = { method: 'DELETE', url: `${API}/saluran-pembayaran/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete harus 200, dapat ${res.status}`);
}

async function t6_delete_all_ok() {
  const name = 'SaluranPembayaran: delete ALL OK';
  const req = { method: 'DELETE', url: `${API}/saluran-pembayaran/__all`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete all harus 200, dapat ${res.status}`);
}

async function main() {
  const summary = { startedAt: new Date().toISOString(), baseUrl: BASE_URL, apiBase: API };

  let failed = 0;
  const steps = [
    loginAdmin,

    // Penting: seed master Metode Pembayaran lebih dulu
    ensureMetodeSeed,

    // CREATE
    t1_create_ok,
    t1_create_error_missing_required,
    t1_create_error_invalid_schema,

    // LIST (no pagination)
    t2_get_list_default,
    t2_get_list_filters,

    // LIST scoped by UUID metode (analog provinsi-by-negara)
    t2b_get_list_by_metode_uuid,

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

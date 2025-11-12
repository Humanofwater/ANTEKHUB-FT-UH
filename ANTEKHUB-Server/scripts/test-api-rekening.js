// File: scripts/test-api-rekening.js
// Tujuan: Testing CRUD rekening.controller.js (master table, tanpa pagination) + scoped list by bank UUID
// Jalankan: node scripts/test-api-rekening.js
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
const outFile = path.join(OUT_DIR, `test-rekening-results-${stamp}.json`);

const seededSuperAdmin = { username: 'superadmin_7843', password: 'SAdmin#7843' };

const results = [];
let TOKEN = null;
let CREATED = []; // uuid rekening yang dibuat
let BANKS = {};  // { A: {id, uuid, ...}, B: {id, uuid, ...} }

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
 *  SEED BANK (dua entri)
 *  - Idempotent: cek dulu; kalau tidak ada → create
 *  - Simpan ke BANKS.A & BANKS.B
 *  ========================= */
async function ensureBankSeed() {
  // 1) Cek data yang sudah ada (ambil 50 teratas dengan filter nama mengandung "Seed")
  const q = { method: 'GET', url: `${API}/bank?search=Seed`, headers: authHeader() };
  const got = await http(q);
  record('Bank: get existing (search=Seed)', q, got, null, '200');
  assert(got.status === 200, `GET bank harus 200, dapat ${got.status}`);

  const rows = Array.isArray(got.data?.data) ? got.data.data : [];
  const findByNama = (needle) =>
    rows.find((r) => String(r.nama).toLowerCase().includes(needle.toLowerCase()));

  let A = findByNama('Bank Seed A');
  let B = findByNama('Bank Seed B');

  // 2) Create jika belum ada
  if (!A) {
    const req = {
      method: 'POST',
      url: `${API}/bank`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: { nama: `Bank Seed A`, kategori: 'BANK' }
    };
    const res = await http(req);
    record('Bank: seed A (create if missing)', req, res, null, '201/409');
    assert([201, 409].includes(res.status) || (res.status === 200 && res.data?.data), `Create Bank A expected 201/409/200, got ${res.status}`);
    A = res.data?.data || A;
  }

  if (!B) {
    const req = {
      method: 'POST',
      url: `${API}/bank`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: { nama: `Bank Seed B`, kategori: 'BANK' }
    };
    const res = await http(req);
    record('Bank: seed B (create if missing)', req, res, null, '201/409');
    assert([201, 409].includes(res.status) || (res.status === 200 && res.data?.data), `Create Bank B expected 201/409/200, got ${res.status}`);
    B = res.data?.data || B;
  }

  // 3) Kalau masih belum punya id karena 409, ambil ulang via GET
  if (!A?.id || !B?.id) {
    const req = { method: 'GET', url: `${API}/bank?search=Seed`, headers: authHeader() };
    const res = await http(req);
    record('Bank: re-fetch after seed', req, res, null, '200');
    assert(res.status === 200, `Re-fetch bank harus 200, dapat ${res.status}`);
    const rows2 = Array.isArray(res.data?.data) ? res.data.data : [];
    const byNameContains = (s) => rows2.find((r) => String(r.nama).toLowerCase().includes(s.toLowerCase()));
    A = A?.id ? A : byNameContains('bank seed a');
    B = B?.id ? B : byNameContains('bank seed b');
  }

  assert(A?.id, 'Gagal memastikan Bank Seed A tersedia');
  assert(B?.id, 'Gagal memastikan Bank Seed B tersedia');

  BANKS = { A, B };
}

// ====== PAYLOAD UTAMA (pakai bank_id hasil seed) ======
function makeCreatePayload(i) {
  const useB = i % 2 === 0;
  const bankId = useB ? BANKS.B.id : BANKS.A.id;
  return {
    bank_id: bankId,
    nama_rekening: `Rekening Uji ${i}-${Date.now()}`,
    nomor_rekening: `NR-${Date.now()}-${i}`,
    deskripsi: i % 2 === 0 ? 'Rekening operasional' : 'Rekening umum',
    aktif: i % 2 === 1
  };
}

// Payload salah: field wajib hilang
function makeBadPayload_missingRequired() {
  return {
    // bank_id boleh null tapi kita hilangkan field wajib berikut:
    // nama_rekening hilang
    nomor_rekening: '', // empty → invalid
    aktif: true
  };
}

// Payload salah: validation gagal (tipe/format salah)
function makeBadPayload_invalidSchema() {
  return {
    bank_id: 'SATU',          // harus number atau null
    nama_rekening: '',        // required
    nomor_rekening: 12345,    // harus string
    deskripsi: 999,           // harus string/null
    aktif: 'iya'              // harus boolean
  };
}

// ====== TESTS ======
async function t1_create_ok() {
  const name = 'Rekening: create OK (2 rows)';
  const createdLocal = [];
  for (let i = 1; i <= 2; i++) {
    const req = {
      method: 'POST',
      url: `${API}/rekening`,
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
  const name = 'Rekening: create ERROR missing required fields';
  const req = {
    method: 'POST',
    url: `${API}/rekening`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_missingRequired()
  };
  const res = await http(req);
  record(name, req, res, null, '422');
  assert([400, 422].includes(res.status), `Missing required harus 400/422, dapat ${res.status}`);
}

async function t1_create_error_invalid_schema() {
  const name = 'Rekening: create ERROR invalid schema';
  const req = {
    method: 'POST',
    url: `${API}/rekening`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_invalidSchema()
  };
  const res = await http(req);
  record(name, req, res, null, '422');
  assert([400, 422].includes(res.status), `Invalid schema harus 400/422, dapat ${res.status}`);
}

// LIST (tanpa pagination)
async function t2_get_list_default() {
  const name = 'Rekening: get list default (no pagination)';
  const req = { method: 'GET', url: `${API}/rekening`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array');
  assert(res.status === 200, `List harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data.data), 'Response.data.data harus array');
  assert(typeof res.data.meta?.total === 'number', 'meta.total harus number');
}

async function t2_get_list_filters() {
  // search by nama/nomor/deskripsi
  const req1 = { method: 'GET', url: `${API}/rekening?search=Rekening%20Uji`, headers: authHeader() };
  const res1 = await http(req1);
  record('Rekening: filter search', req1, res1, null, '200');
  assert(res1.status === 200, `Search harus 200, dapat ${res1.status}`);

  // filter bank_id (multi)
  const req2 = { method: 'GET', url: `${API}/rekening?bank_id=${BANKS.A.id}&bank_id=${BANKS.B.id}`, headers: authHeader() };
  const res2 = await http(req2);
  record('Rekening: filter bank_id=A&B', req2, res2, null, '200');
  assert(res2.status === 200, `Filter bank_id harus 200, dapat ${res2.status}`);

  // filter nomor_rekening (multi exact)
  const req3 = { method: 'GET', url: `${API}/rekening?nomor_rekening=NR-UNKNOWN&nomor_rekening=NR-UNKNOWN-2`, headers: authHeader() };
  const res3 = await http(req3);
  record('Rekening: filter nomor_rekening multi', req3, res3, null, '200');
  assert(res3.status === 200, `Filter nomor_rekening harus 200, dapat ${res3.status}`);

  // filter aktif
  const req4 = { method: 'GET', url: `${API}/rekening?aktif=true`, headers: authHeader() };
  const res4 = await http(req4);
  record('Rekening: filter aktif=true', req4, res4, null, '200');
  assert(res4.status === 200, `Filter aktif harus 200, dapat ${res4.status}`);
}

// LIST (scoped by Bank UUID) - analog t2b provinsi
async function t2b_get_list_by_bank_uuid() {
  const name = 'Rekening: get list by bank UUID (no pagination)';
  const bankUuid = BANKS.A.uuid;
  const req = { method: 'GET', url: `${API}/rekening/by-bank/${bankUuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array scoped');
  assert(res.status === 200, `List by bank harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data.data), 'Response.data.data harus array');

  // Validasi: semua row punya bank_id = BANKS.A.id
  const expectedId = BANKS.A.id;
  for (const r of res.data.data) {
    assert(r.bank_id === expectedId, `Row bukan milik bank ${expectedId}`);
  }
}

async function t3_get_detail_ok() {
  const name = 'Rekening: get detail OK';
  const uuid = CREATED[0];
  const req = { method: 'GET', url: `${API}/rekening/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + uuid sama');
  assert(res.status === 200, `Detail harus 200, dapat ${res.status}`);
  assert(res.data && res.data.data && res.data.data.uuid === uuid, 'Detail UUID tidak cocok');
}

async function t3_get_detail_not_found() {
  const name = 'Rekening: get detail NOT FOUND';
  const req = { method: 'GET', url: `${API}/rekening/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Not-found harus 404/400, dapat ${res.status}`);
}

async function t4_update_ok() {
  const name = 'Rekening: update OK (nama_rekening + aktif)';
  const uuid = CREATED[0];
  const body = { nama_rekening: `Rekening Updated ${Date.now()}`, aktif: true };
  const req = {
    method: 'PATCH',
    url: `${API}/rekening/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Update harus 200, dapat ${res.status}`);
}

async function t4_update_error_invalid_schema() {
  const name = 'Rekening: update ERROR invalid schema';
  const uuid = CREATED[0];
  const body = { bank_id: 'SATU', aktif: 'iya' }; // tipe salah
  const req = {
    method: 'PATCH',
    url: `${API}/rekening/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Invalid schema seharusnya 400/422, dapat ${res.status}`);
}

async function t5_delete_not_found() {
  const name = 'Rekening: delete NOT FOUND';
  const req = { method: 'DELETE', url: `${API}/rekening/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Delete not-found seharusnya 404/400, dapat ${res.status}`);
}

async function t5_delete_ok() {
  const name = 'Rekening: delete OK';
  const uuid = CREATED[1]; // hapus yang kedua
  const req = { method: 'DELETE', url: `${API}/rekening/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete harus 200, dapat ${res.status}`);
}

async function t6_delete_all_ok() {
  const name = 'Rekening: delete ALL OK';
  const req = { method: 'DELETE', url: `${API}/rekening/__all`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete all harus 200, dapat ${res.status}`);
}

async function main() {
  const summary = { startedAt: new Date().toISOString(), baseUrl: BASE_URL, apiBase: API };

  let failed = 0;
  const steps = [
    loginAdmin,

    // Penting: seed master Bank lebih dulu
    ensureBankSeed,

    // CREATE
    t1_create_ok,
    t1_create_error_missing_required,
    t1_create_error_invalid_schema,

    // LIST (no pagination)
    t2_get_list_default,
    t2_get_list_filters,

    // LIST scoped by bank UUID (analog provinsi-by-negara)
    t2b_get_list_by_bank_uuid,

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

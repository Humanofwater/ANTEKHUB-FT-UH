// File: scripts/test-api-program-studi.js
// Tujuan: End-to-end testing untuk resource "Program Studi" (tanpa pagination)
// Jalankan: node scripts/test-api-program-studi.js
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
const outFile = path.join(OUT_DIR, `test-program-studi-results-${stamp}.json`);

const seededSuperAdmin = { username: 'superadmin_7843', password: 'SAdmin#7843' };

const results = [];
let TOKEN = null;
let CREATED = [];         // uuid program studi yang dibuat
let DUPLICATE_PAIR = {};  // { nama, strata } dari row pertama untuk test duplikat

// ---------- helpers ----------
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
function assert(cond, message) { if (!cond) throw new Error(message); }
async function http(opts) {
  const { method, url, body, headers } = opts;
  const cfg = { method, url, headers: headers || {}, data: body, validateStatus: () => true, timeout: 20000 };
  return axios(cfg);
}
function authHeader() { return { Authorization: `Bearer ${TOKEN}` }; }

// ---------- auth ----------
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

// ---------- payload generators ----------
function makeName(i) { return `Program Studi Uji ${i}-${Date.now()}`; }
function makeStrata(i) {
  // contoh strata: S1, S2, D3 — sesuaikan dengan enum DB kamu
  const list = [
          'Sarjana',
          'Magister',
          'Doktor',
          'Profesi Arsitektur',
          'Insinyur',
          'Diploma 3'
        ];
  return list[i % list.length];
}
function makeKode(i) {
  // array kode unik dan ringkas
  return [`K${i}`, `UJI${i}`];
}
function makeCreatePayload(i) {
  return { kode: makeKode(i), nama: makeName(i), strata: makeStrata(i) };
}
function makeBadPayload_missingRequired() {
  // hilangkan nama & strata
  return { kode: ['ABC'] };
}
function makeBadPayload_invalidSchema() {
  // tipe salah / isi tidak valid
  return {
    kode: 'BUKAN_ARRAY',  // harus array
    nama: '',             // wajib non-kosong
    strata: ''            // biar di-tolak validasi
  };
}

// ---------- tests: CREATE ----------
async function t1_create_ok() {
  const name = 'ProgramStudi: create OK (2 rows)';
  const createdLocal = [];
  for (let i = 1; i <= 2; i++) {
    const body = makeCreatePayload(i);
    const req = {
      method: 'POST',
      url: `${API}/program-studi`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body
    };
    const res = await http(req);
    record(`${name} #${i}`, req, res, null, '201 + data.uuid');
    assert(res.status === 201, `Create harus 201, dapat ${res.status}`);
    assert(res.data?.data?.uuid, 'Response tidak mengandung data.uuid');
    createdLocal.push(res.data.data.uuid);
    if (i === 1) {
      DUPLICATE_PAIR = { nama: res.data.data.nama, strata: res.data.data.strata };
    }
  }
  CREATED = createdLocal;
}

async function t1_create_error_missing_required() {
  const name = 'ProgramStudi: create ERROR missing required';
  const req = {
    method: 'POST',
    url: `${API}/program-studi`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_missingRequired()
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Missing required harus 400/422, dapat ${res.status}`);
}

async function t1_create_error_invalid_schema() {
  const name = 'ProgramStudi: create ERROR invalid schema';
  const req = {
    method: 'POST',
    url: `${API}/program-studi`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_invalidSchema()
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Invalid schema harus 400/422, dapat ${res.status}`);
}

async function t1_create_error_duplicate_pair() {
  const name = 'ProgramStudi: create ERROR duplicate (nama+strata)';
  const req = {
    method: 'POST',
    url: `${API}/program-studi`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: { kode: ['DUP'], nama: DUPLICATE_PAIR.nama, strata: DUPLICATE_PAIR.strata }
  };
  const res = await http(req);
  record(name, req, res, null, '409');
  assert([409, 400].includes(res.status), `Duplicate harus 409/400, dapat ${res.status}`);
}

// ---------- tests: LIST ----------
async function t2_get_list_default() {
  const name = 'ProgramStudi: get list default (no pagination)';
  const req = { method: 'GET', url: `${API}/program-studi`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array');
  assert(res.status === 200, `List harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data?.data), 'Response.data.data harus array');
  assert(typeof res.data?.meta?.total === 'number', 'meta.total harus number');
}

async function t2_get_list_filters() {
  // search by nama
  const req1 = { method: 'GET', url: `${API}/program-studi?search=Program%20Studi%20Uji`, headers: authHeader() };
  const res1 = await http(req1);
  record('ProgramStudi: filter search by nama', req1, res1, null, '200');
  assert(res1.status === 200, `Search harus 200, dapat ${res1.status}`);

  // filter by strata (multi)
  const req2 = { method: 'GET', url: `${API}/program-studi?strata=Sarjana&strata=Magister`, headers: authHeader() };
  const res2 = await http(req2);
  record('ProgramStudi: filter strata S1,S2', req2, res2, null, '200');
  assert(res2.status === 200, `Filter strata harus 200, dapat ${res2.status}`);

  // filter by kode (overlap)
  const req3 = { method: 'GET', url: `${API}/program-studi?kode=K1&kode=UJI1`, headers: authHeader() };
  const res3 = await http(req3);
  record('ProgramStudi: filter kode overlap', req3, res3, null, '200');
  assert(res3.status === 200, `Filter kode harus 200, dapat ${res3.status}`);
}

// ---------- tests: DETAIL ----------
async function t3_get_detail_ok() {
  const name = 'ProgramStudi: get detail OK';
  const uuid = CREATED[0];
  const req = { method: 'GET', url: `${API}/program-studi/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + uuid sama');
  assert(res.status === 200, `Detail harus 200, dapat ${res.status}`);
  assert(res.data?.data?.uuid === uuid, 'Detail UUID tidak cocok');
}

async function t3_get_detail_not_found() {
  const name = 'ProgramStudi: get detail NOT FOUND';
  const req = { method: 'GET', url: `${API}/program-studi/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Not-found harus 404/400, dapat ${res.status}`);
}

// ---------- tests: UPDATE ----------
async function t4_update_ok() {
  const name = 'ProgramStudi: update OK (ubah nama & kode)';
  const uuid = CREATED[0];
  const body = { nama: `Program Studi Updated ${Date.now()}`, kode: ['UPD', 'UJI'] };
  const req = {
    method: 'PATCH',
    url: `${API}/program-studi/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Update harus 200, dapat ${res.status}`);
}

async function t4_update_error_invalid_schema() {
  const name = 'ProgramStudi: update ERROR invalid schema';
  const uuid = CREATED[0];
  const body = { nama: '', kode: 'BUKAN_ARRAY' }; // invalid: nama kosong & kode bukan array
  const req = {
    method: 'PATCH',
    url: `${API}/program-studi/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Invalid schema seharusnya 400/422, dapat ${res.status}`);
}

async function t4_update_error_duplicate_pair() {
  const name = 'ProgramStudi: update ERROR duplicate (nama+strata)';
  const uuid = CREATED[0];

  // Ambil detail row kedua untuk ambil pair nama+strata target
  const reqGet = { method: 'GET', url: `${API}/program-studi/${CREATED[1]}`, headers: authHeader() };
  const resGet = await http(reqGet);
  record('ProgramStudi: ambil nama+strata untuk duplikasi', reqGet, resGet, null, '200');
  assert(resGet.status === 200, `Detail harus 200, dapat ${resGet.status}`);
  const target = { nama: resGet.data?.data?.nama, strata: resGet.data?.data?.strata };

  const body = { nama: target.nama, strata: target.strata };
  const req = {
    method: 'PATCH',
    url: `${API}/program-studi/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '409');
  assert([409, 400].includes(res.status), `Duplicate update harus 409/400, dapat ${res.status}`);
}

// ---------- tests: DELETE ----------
async function t5_delete_not_found() {
  const name = 'ProgramStudi: delete NOT FOUND';
  const req = { method: 'DELETE', url: `${API}/program-studi/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Delete not-found seharusnya 404/400, dapat ${res.status}`);
}

async function t5_delete_ok() {
  const name = 'ProgramStudi: delete OK';
  const uuid = CREATED[1]; // hapus yang kedua
  const req = { method: 'DELETE', url: `${API}/program-studi/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete harus 200, dapat ${res.status}`);
}

async function t6_delete_all_ok() {
  const name = 'ProgramStudi: delete ALL OK';
  const req = { method: 'DELETE', url: `${API}/program-studi/__all`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete all harus 200, dapat ${res.status}`);
}

// ---------- main ----------
async function main() {
  const summary = { startedAt: new Date().toISOString(), baseUrl: BASE_URL, apiBase: API };
  let failed = 0;

  const steps = [
    loginAdmin,

    // CREATE
    t1_create_ok,
    t1_create_error_missing_required,
    t1_create_error_invalid_schema,
    t1_create_error_duplicate_pair,

    // LIST
    t2_get_list_default,
    t2_get_list_filters,

    // DETAIL
    t3_get_detail_ok,
    t3_get_detail_not_found,

    // UPDATE
    t4_update_ok,
    t4_update_error_invalid_schema,
    t4_update_error_duplicate_pair,

    // DELETE
    t5_delete_not_found,
    t5_delete_ok,

    // DELETE ALL
    t6_delete_all_ok,
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

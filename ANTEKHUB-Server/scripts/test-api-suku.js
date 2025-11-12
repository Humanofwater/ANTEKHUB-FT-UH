// File: scripts/test-api-suku.js
// Tujuan: End-to-end testing untuk resource "Suku" (master table, tanpa pagination)
// Jalankan: node scripts/test-api-suku.js
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
const outFile = path.join(OUT_DIR, `test-suku-results-${stamp}.json`);

const seededSuperAdmin = { username: 'superadmin_7843', password: 'SAdmin#7843' };

const results = [];
let TOKEN = null;
let CREATED = []; // simpan uuid suku yang dibuat
let DUPLICATE_NAME = null; // nama untuk uji duplikasi

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
function authHeader() {
  return { Authorization: `Bearer ${TOKEN}` };
}

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
function makeName(i) {
  return `Suku Uji ${i}-${Date.now()}`;
}
function makeCreatePayload(i) {
  return { nama: makeName(i) };
}
function makeBadPayload_missingRequired() {
  return {}; // tidak ada 'nama'
}
function makeBadPayload_invalidSchema() {
  return { nama: '' }; // string kosong → invalid
}

// ---------- tests: CREATE ----------
async function t1_create_ok() {
  const name = 'Suku: create OK (2 rows)';
  const createdLocal = [];
  for (let i = 1; i <= 2; i++) {
    const body = makeCreatePayload(i);
    const req = {
      method: 'POST',
      url: `${API}/suku`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body
    };
    const res = await http(req);
    record(`${name} #${i}`, req, res, null, '201 + data.uuid');
    assert(res.status === 201, `Create harus 201, dapat ${res.status}`);
    assert(res.data && res.data.data && res.data.data.uuid, 'Response tidak mengandung data.uuid');
    createdLocal.push(res.data.data.uuid);
    if (i === 1) DUPLICATE_NAME = res.data.data.nama; // simpan nama pertama untuk uji duplikat
  }
  CREATED = createdLocal;
}

async function t1_create_error_missing_required() {
  const name = 'Suku: create ERROR missing required';
  const req = {
    method: 'POST',
    url: `${API}/suku`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_missingRequired()
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Missing required harus 400/422, dapat ${res.status}`);
}

async function t1_create_error_invalid_schema() {
  const name = 'Suku: create ERROR invalid schema';
  const req = {
    method: 'POST',
    url: `${API}/suku`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_invalidSchema()
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Invalid schema harus 400/422, dapat ${res.status}`);
}

async function t1_create_error_duplicate_name() {
  const name = 'Suku: create ERROR duplicate name';
  const req = {
    method: 'POST',
    url: `${API}/suku`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: { nama: DUPLICATE_NAME }
  };
  const res = await http(req);
  record(name, req, res, null, '409');
  assert(res.status === 409 || res.status === 400, `Duplicate harus 409/400, dapat ${res.status}`);
}

// ---------- tests: LIST ----------
async function t2_get_list_default() {
  const name = 'Suku: get list default (no pagination)';
  const req = { method: 'GET', url: `${API}/suku`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array');
  assert(res.status === 200, `List harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data?.data), 'Response.data.data harus array');
  assert(typeof res.data?.meta?.total === 'number', 'meta.total harus number');
}

async function t2_get_list_search() {
  const name = 'Suku: list filter search by nama';
  const req = { method: 'GET', url: `${API}/suku?search=Suku%20Uji`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Search harus 200, dapat ${res.status}`);
}

// ---------- tests: DETAIL ----------
async function t3_get_detail_ok() {
  const name = 'Suku: get detail OK';
  const uuid = CREATED[0];
  const req = { method: 'GET', url: `${API}/suku/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + uuid sama');
  assert(res.status === 200, `Detail harus 200, dapat ${res.status}`);
  assert(res.data && res.data.data && res.data.data.uuid === uuid, 'Detail UUID tidak cocok');
}

async function t3_get_detail_not_found() {
  const name = 'Suku: get detail NOT FOUND';
  const req = { method: 'GET', url: `${API}/suku/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Not-found harus 404/400, dapat ${res.status}`);
}

// ---------- tests: UPDATE ----------
async function t4_update_ok() {
  const name = 'Suku: update OK (ubah nama)';
  const uuid = CREATED[0];
  const body = { nama: `${DUPLICATE_NAME} - Updated` };
  const req = {
    method: 'PATCH',
    url: `${API}/suku/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Update harus 200, dapat ${res.status}`);
}

async function t4_update_error_invalid_schema() {
  const name = 'Suku: update ERROR invalid schema (nama kosong)';
  const uuid = CREATED[0];
  const body = { nama: '' };
  const req = {
    method: 'PATCH',
    url: `${API}/suku/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Invalid schema seharusnya 400/422, dapat ${res.status}`);
}

async function t4_update_error_duplicate_name() {
  const name = 'Suku: update ERROR duplicate name';
  const uuid = CREATED[0];
  // Pakai nama dari row kedua agar duplikat
  const reqGet = { method: 'GET', url: `${API}/suku/${CREATED[1]}`, headers: authHeader() };
  const resGet = await http(reqGet);
  record('Suku: ambil nama untuk duplikasi', reqGet, resGet, null, '200');
  assert(resGet.status === 200, `Detail harus 200, dapat ${resGet.status}`);
  const targetName = resGet.data?.data?.nama;
  const body = { nama: targetName };

  const req = {
    method: 'PATCH',
    url: `${API}/suku/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '409');
  assert([409, 400].includes(res.status), `Duplicate update harus 409/400, dapat ${res.status}`);
}

// ---------- tests: DELETE ----------
async function t5_delete_not_found() {
  const name = 'Suku: delete NOT FOUND';
  const req = { method: 'DELETE', url: `${API}/suku/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Delete not-found seharusnya 404/400, dapat ${res.status}`);
}

async function t5_delete_ok() {
  const name = 'Suku: delete OK';
  const uuid = CREATED[1]; // hapus yang kedua
  const req = { method: 'DELETE', url: `${API}/suku/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete harus 200, dapat ${res.status}`);
}

async function t6_delete_all_ok() {
  const name = 'Suku: delete ALL OK';
  const req = { method: 'DELETE', url: `${API}/suku/__all`, headers: authHeader() };
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
    t1_create_error_duplicate_name,

    // LIST
    t2_get_list_default,
    t2_get_list_search,

    // DETAIL
    t3_get_detail_ok,
    t3_get_detail_not_found,

    // UPDATE
    t4_update_ok,
    t4_update_error_invalid_schema,
    t4_update_error_duplicate_name,

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

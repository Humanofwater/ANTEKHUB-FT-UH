// File: scripts/test-api-metode-pembayaran.js
// Tujuan: Otomatisasi testing CRUD metode_pembayaran.controller.js (master table, tanpa pagination)
// Jalankan: node scripts/test-api-metode-pembayaran.js
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
const outFile = path.join(OUT_DIR, `test-metode-pembayaran-results-${stamp}.json`);

const seededSuperAdmin = { username: 'superadmin_7843', password: 'SAdmin#7843' };

const results = [];
let TOKEN = null;
let CREATED = []; // simpan uuid metode pembayaran yang dibuat

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

// ====== PAYLOAD ======
function makeCreatePayload(i) {
  return {
    kode_metode: i % 2 === 0 ? `VA-${Date.now()}` : `EWL-${Date.now()}`,
    nama: `Metode Uji ${i}-${Date.now()}`,
    active: i % 2 === 0 // true/false bergantian
  };
}

function makeBadPayload_missingRequired() {
  return {
    // kode_metode hilang
    // nama hilang
    active: true
  };
}

function makeBadPayload_invalidSchema() {
  return {
    kode_metode: '',     // kosong → invalid
    nama: '',            // kosong → invalid
    active: 'yes'        // bukan boolean → invalid
  };
}

// ====== TESTS ======
async function t1_create_ok() {
  const name = 'MetodePembayaran: create OK (2 rows)';
  const createdLocal = [];
  for (let i = 1; i <= 2; i++) {
    const req = {
      method: 'POST',
      url: `${API}/metode-pembayaran`,
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
  const name = 'MetodePembayaran: create ERROR missing required';
  const req = {
    method: 'POST',
    url: `${API}/metode-pembayaran`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_missingRequired()
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Missing required harus 400/422, dapat ${res.status}`);
}

async function t1_create_error_invalid_schema() {
  const name = 'MetodePembayaran: create ERROR invalid schema';
  const req = {
    method: 'POST',
    url: `${API}/metode-pembayaran`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_invalidSchema()
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Invalid schema harus 400/422, dapat ${res.status}`);
}

// LIST (tanpa pagination)
async function t2_get_list_default() {
  const name = 'MetodePembayaran: get list default (no pagination)';
  const req = { method: 'GET', url: `${API}/metode-pembayaran`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array');
  assert(res.status === 200, `List harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data.data), 'Response.data.data harus array');
  assert(typeof res.data.meta?.total === 'number', 'meta.total harus number');
}

async function t2_get_list_filters() {
  // search by nama/kode
  const req1 = { method: 'GET', url: `${API}/metode-pembayaran?search=Metode%20Uji`, headers: authHeader() };
  const res1 = await http(req1);
  record('MetodePembayaran: filter search', req1, res1, null, '200');
  assert(res1.status === 200, `Search harus 200, dapat ${res1.status}`);

  // filter active=true
  const req2 = { method: 'GET', url: `${API}/metode-pembayaran?active=true`, headers: authHeader() };
  const res2 = await http(req2);
  record('MetodePembayaran: filter active=true', req2, res2, null, '200');
  assert(res2.status === 200, `Filter active=true harus 200, dapat ${res2.status}`);

  // filter kode_metode (multi)
  const req3 = { method: 'GET', url: `${API}/metode-pembayaran?kode_metode=VA&kode_metode=QRIS`, headers: authHeader() };
  const res3 = await http(req3);
  record('MetodePembayaran: filter kode_metode multi', req3, res3, null, '200');
  assert(res3.status === 200, `Filter kode_metode harus 200, dapat ${res3.status}`);
}

async function t3_get_detail_ok() {
  const name = 'MetodePembayaran: get detail OK';
  const uuid = CREATED[0];
  const req = { method: 'GET', url: `${API}/metode-pembayaran/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + uuid sama');
  assert(res.status === 200, `Detail harus 200, dapat ${res.status}`);
  assert(res.data && res.data.data && res.data.data.uuid === uuid, 'Detail UUID tidak cocok');
}

async function t3_get_detail_not_found() {
  const name = 'MetodePembayaran: get detail NOT FOUND';
  const req = { method: 'GET', url: `${API}/metode-pembayaran/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Not-found harus 404/400, dapat ${res.status}`);
}

async function t4_update_ok() {
  const name = 'MetodePembayaran: update OK';
  const uuid = CREATED[0];
  const body = { nama: `Metode Uji Updated ${Date.now()}`, active: true };
  const req = {
    method: 'PATCH',
    url: `${API}/metode-pembayaran/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Update harus 200, dapat ${res.status}`);
}

async function t4_update_error_invalid_schema() {
  const name = 'MetodePembayaran: update ERROR invalid schema';
  const uuid = CREATED[0];
  const body = { nama: '', active: 'aktif' }; // invalid: nama kosong & active bukan boolean
  const req = {
    method: 'PATCH',
    url: `${API}/metode-pembayaran/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Invalid schema seharusnya 400/422, dapat ${res.status}`);
}

async function t5_delete_not_found() {
  const name = 'MetodePembayaran: delete NOT FOUND';
  const req = { method: 'DELETE', url: `${API}/metode-pembayaran/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Delete not-found seharusnya 404/400, dapat ${res.status}`);
}

async function t5_delete_ok() {
  const name = 'MetodePembayaran: delete OK';
  const uuid = CREATED[1]; // hapus yang kedua
  const req = { method: 'DELETE', url: `${API}/metode-pembayaran/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete harus 200, dapat ${res.status}`);
}

async function t6_delete_all_ok() {
  const name = 'MetodePembayaran: delete ALL OK';
  const req = { method: 'DELETE', url: `${API}/metode-pembayaran/__all`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete all harus 200, dapat ${res.status}`);
}

async function main() {
  const summary = { startedAt: new Date().toISOString(), baseUrl: BASE_URL, apiBase: API };

  let failed = 0;
  const steps = [
    loginAdmin,

    // CREATE
    t1_create_ok,
    t1_create_error_missing_required,
    t1_create_error_invalid_schema,

    // LIST (no pagination)
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

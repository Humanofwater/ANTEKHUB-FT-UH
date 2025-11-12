// File: scripts/test-api-user-admin.js
// Tujuan: Otomatisasi testing CRUD user_admin + skenario error (selaras controller)
// Jalankan: node scripts/test-api-user-admin.js
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
const outFile = path.join(OUT_DIR, `test-user-admin-results-${stamp}.json`);

const results = [];
let TOKEN = null;

// pakai superadmin seeder yang sudah ada
const seededSuperAdmin = { username: 'superadmin_7843', password: 'SAdmin#7843' };

// simpan uuid admin yang dibuat
let CREATED = { one: null, two: null, usernames: {} };

// ========== utils ==========
function record(name, req, res, err, expect) {
  results.push({
    name,
    expect,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.bodyDescribe || req.data || undefined
    },
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
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function authHeader() { return { Authorization: `Bearer ${TOKEN}` }; }

async function http(opts) {
  const cfg = {
    method: opts.method,
    url: opts.url,
    headers: { ...(opts.headers || {}) },
    data: opts.data,
    validateStatus: () => true,
    timeout: 20000
  };
  return axios(cfg);
}

function randSuffix() {
  return Math.floor(100000 + Math.random() * 900000);
}

/* ================== STEPS ================== */

// LOGIN
async function loginAdmin() {
  const req = {
    method: 'POST',
    url: `${API}/auth/admin/login`,
    headers: { 'Content-Type': 'application/json' },
    data: { username: seededSuperAdmin.username, password: seededSuperAdmin.password },
    bodyDescribe: { username: seededSuperAdmin.username, password: '********' }
  };
  const res = await http(req);
  record('Auth: login admin', req, res, null, '200 + token');
  assert(res.status === 200, `Login harus 200, dapat ${res.status}`);
  assert(res.data && res.data.token, 'Response tidak mengandung token');
  TOKEN = res.data.token;
}

// CREATE OK (harus menyertakan "nama" sesuai controller)
async function create_Admin_OK() {
  const u1 = `admin_${randSuffix()}`;
  const u2 = `admin_${randSuffix()}`;

  // #1
  let req = {
    method: 'POST',
    url: `${API}/user-admin`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    data: {
      nama: 'Admin Satu',
      username: u1,
      nomor_telepon: '081234567810',
      password: 'AdminTest#1',
      role: 'Admin' // valid
    }
  };
  let res = await http(req);
  record('Create admin #1', req, res, null, '201 + uuid');
  assert(res.status === 201, `Create #1 harus 201, dapat ${res.status}`);
  CREATED.one = res.data?.data?.uuid;
  assert(CREATED.one, 'Create #1 tidak mengembalikan uuid');

  // #2
  req = {
    method: 'POST',
    url: `${API}/user-admin`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    data: {
      nama: 'Admin Dua',
      username: u2,
      nomor_telepon: '081234567811',
      password: 'AdminTest#2',
      role: 'Admin'
    }
  };
  res = await http(req);
  record('Create admin #2', req, res, null, '201 + uuid');
  assert(res.status === 201, `Create #2 harus 201, dapat ${res.status}`);
  CREATED.two = res.data?.data?.uuid;
  assert(CREATED.two, 'Create #2 tidak mengembalikan uuid');

  CREATED.usernames = { u1, u2 };
}

// CREATE error: missing required (nama/username/password wajib)
async function create_Admin_MissingFields() {
  const req = {
    method: 'POST',
    url: `${API}/user-admin`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    data: {
      // nama hilang
      // username hilang
      password: '' // kosong → invalid
    }
  };
  const res = await http(req);
  record('Create ERROR missing fields', req, res, null, '400');
  assert([400, 422].includes(res.status), `Missing fields harus 400/422, dapat ${res.status}`);
}

// CREATE error: role tidak valid (controller kembalikan 400)
async function create_Admin_InvalidRole() {
  const req = {
    method: 'POST',
    url: `${API}/user-admin`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    data: {
      nama: 'Admin Invalid Role',
      username: `admin_${randSuffix()}`,
      password: 'AdminTest#X',
      role: 'Owner' // tidak valid
    }
  };
  const res = await http(req);
  record('Create ERROR invalid role', req, res, null, '400');
  assert(res.status === 400, `Invalid role harus 400, dapat ${res.status}`);
}

// CREATE error: duplicate username → 409
async function create_Admin_DuplicateUsername() {
  const req = {
    method: 'POST',
    url: `${API}/user-admin`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    data: {
      nama: 'Admin Duplikat',
      username: CREATED.usernames.u1, // duplikat
      nomor_telepon: '081234567812',
      password: 'AdminTest#Dup',
      role: 'Admin'
    }
  };
  const res = await http(req);
  record('Create ERROR duplicate username', req, res, null, '409');
  assert(res.status === 409, `Duplicate username harus 409, dapat ${res.status}`);
}

// LIST
async function getAll_OK() {
  const req = { method: 'GET', url: `${API}/user-admin`, headers: authHeader() };
  const res = await http(req);
  record('GetAll admin', req, res, null, '200');
  assert(res.status === 200, `GetAll harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data?.data), 'GetAll data harus array');
  assert(typeof res.data?.total === 'number', 'GetAll response harus mengandung "total" (number)');
}

// DETAIL OK
async function getOne_OK() {
  const req = { method: 'GET', url: `${API}/user-admin/${CREATED.one}`, headers: authHeader() };
  const res = await http(req);
  record('GetOne admin OK', req, res, null, '200');
  assert(res.status === 200, `GetOne harus 200, dapat ${res.status}`);
  assert(res.data?.data?.uuid === CREATED.one, 'UUID getOne tidak cocok');
}

// DETAIL not found
async function getOne_NotFound() {
  const req = { method: 'GET', url: `${API}/user-admin/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record('GetOne NOT FOUND', req, res, null, '404');
  assert([404, 400].includes(res.status), `Not found harus 404/400, dapat ${res.status}`);
}

// UPDATE OK (ubah nomor_telepon & password)
async function update_OK() {
  const req = {
    method: 'PATCH',
    url: `${API}/user-admin/${CREATED.one}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    data: {
      nomor_telepon: '081299900001',
      password: 'AdminTest#1Updated'
    }
  };
  const res = await http(req);
  record('Update admin OK', req, res, null, '200');
  assert(res.status === 200, `Update harus 200, dapat ${res.status}`);
}

// UPDATE error: duplicate username → 409
async function update_DuplicateUsername() {
  const req = {
    method: 'PATCH',
    url: `${API}/user-admin/${CREATED.one}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    data: { username: CREATED.usernames.u2 } // duplikasi
  };
  const res = await http(req);
  record('Update ERROR duplicate username', req, res, null, '409');
  assert(res.status === 409, `Update duplicate username harus 409, dapat ${res.status}`);
}

// UPDATE error: invalid role → 400
async function update_InvalidRole() {
  const req = {
    method: 'PATCH',
    url: `${API}/user-admin/${CREATED.one}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    data: { role: 'Owner' } // tidak valid
  };
  const res = await http(req);
  record('Update ERROR invalid role', req, res, null, '400');
  assert(res.status === 400, `Invalid role saat update harus 400, dapat ${res.status}`);
}

// DELETE satu OK
async function delete_One_OK() {
  const req = { method: 'DELETE', url: `${API}/user-admin/${CREATED.two}`, headers: authHeader() };
  const res = await http(req);
  record('Delete admin satu OK', req, res, null, '200');
  assert(res.status === 200, `Delete satu harus 200, dapat ${res.status}`);
}

// DELETE banyak OK (pakai params uuid1,uuid2)
async function delete_Many_OK() {
  // buat 2 admin cepat untuk dihapus banyak
  const a = `admin_${randSuffix()}`;
  const b = `admin_${randSuffix()}`;

  let req = {
    method: 'POST',
    url: `${API}/user-admin`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    data: { nama: 'A', username: a, password: 'X1x#Pass', role: 'Admin' }
  };
  let res = await http(req);
  const aUuid = res.data?.data?.uuid;

  req = {
    method: 'POST',
    url: `${API}/user-admin`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    data: { nama: 'B', username: b, password: 'X1x#Pass', role: 'Admin' }
  };
  res = await http(req);
  const bUuid = res.data?.data?.uuid;

  const delReq = { method: 'DELETE', url: `${API}/user-admin/${aUuid},${bUuid}`, headers: authHeader() };
  const delRes = await http(delReq);
  record('Delete banyak OK', delReq, delRes, null, '200');
  assert(delRes.status === 200, `Delete banyak harus 200, dapat ${delRes.status}`);
}

// DELETE not found (controller bisa balas 200 dengan deleted=0)
async function delete_NotFound() {
  const req = { method: 'DELETE', url: `${API}/user-admin/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record('Delete NOT FOUND (controller bisa 200)', req, res, null, '200/404');
  assert([200, 404].includes(res.status), `Delete not found seharusnya 200/404, dapat ${res.status}`);
}

// DELETE ALL OK (awas jika ada FK aktif di DB)
async function delete_All_OK() {
  const req = { method: 'DELETE', url: `${API}/user-admin/__all`, headers: authHeader() };
  const res = await http(req);
  record('Delete ALL admin', req, res, null, '200');
  assert(res.status === 200, `Delete ALL harus 200, dapat ${res.status}`);
}

/* ================== RUNNER ================== */

async function main() {
  const summary = { startedAt: new Date().toISOString(), baseUrl: BASE_URL, apiBase: API };
  let failed = 0;

  const steps = [
    loginAdmin,
    // CREATE
    create_Admin_OK,
    create_Admin_MissingFields,
    create_Admin_InvalidRole,
    create_Admin_DuplicateUsername,
    // LIST
    getAll_OK,
    // DETAIL
    getOne_OK,
    getOne_NotFound,
    // UPDATE
    update_OK,
    update_DuplicateUsername,
    update_InvalidRole,
    // DELETE
    delete_One_OK,
    delete_Many_OK,
    delete_NotFound,
    delete_All_OK
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

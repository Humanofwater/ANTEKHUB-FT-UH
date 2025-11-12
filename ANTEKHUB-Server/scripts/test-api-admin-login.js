// File: scripts/test-api-admin-login.js
// Tujuan: Testing endpoint auth admin (login & /auth/me) dengan gaya konsisten skrip test lain
// Jalankan: node scripts/test-api-admin-login.js
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
// Log filename (sudah disesuaikan)
const outFile = path.join(OUT_DIR, `test-admin-login-results-${stamp}.json`);

const results = [];
let TOKEN = null;

// Seeder superadmin default
const seededSuperAdmin = { username: 'superadmin_7843', password: 'SAdmin#7843' };

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

// Pastikan sudah login bila butuh token
async function ensureLogin() {
  if (TOKEN) return;
  const req = {
    method: 'POST',
    url: `${API}/auth/admin/login`,
    headers: { 'Content-Type': 'application/json' },
    body: { username: seededSuperAdmin.username, password: seededSuperAdmin.password }
  };
  const res = await http(req);
  record('ensureLogin: login superadmin', req, res, null, '200 + token');
  assert(res.status === 200, `ensureLogin gagal: status ${res.status}`);
  assert(res.data && res.data.token, 'ensureLogin gagal: token tidak ada');
  TOKEN = res.data.token;
}

// ---------- tests: LOGIN ----------
async function t1_login_success() {
  const name = 'Auth: login success (superadmin seeder)';
  const req = {
    method: 'POST',
    url: `${API}/auth/admin/login`,
    headers: { 'Content-Type': 'application/json' },
    body: { username: seededSuperAdmin.username, password: seededSuperAdmin.password }
  };
  const res = await http(req);
  record(name, req, res, null, '200 + token');
  assert(res.status === 200, `Login harus 200, dapat ${res.status}`);
  assert(res.data && res.data.token, 'Response tidak mengandung token');
  TOKEN = res.data.token;
}

async function t1_login_wrong_password() {
  const name = 'Auth: login wrong password → 401';
  const req = {
    method: 'POST',
    url: `${API}/auth/admin/login`,
    headers: { 'Content-Type': 'application/json' },
    body: { username: seededSuperAdmin.username, password: 'WrongPassword123' }
  };
  const res = await http(req);
  record(name, req, res, null, '401');
  assert(res.status === 401, `Wrong password harus 401, dapat ${res.status}`);
}

async function t1_login_unknown_user() {
  const name = 'Auth: login unknown user → 404';
  const req = {
    method: 'POST',
    url: `${API}/auth/admin/login`,
    headers: { 'Content-Type': 'application/json' },
    body: { username: 'no_such_user_xxx', password: 'whatever' }
  };
  const res = await http(req);
  record(name, req, res, null, '404');
  assert(res.status === 404, `Unknown user harus 404, dapat ${res.status}`);
}

async function t1_login_missing_password() {
  const name = 'Auth: login missing password → 400';
  const req = {
    method: 'POST',
    url: `${API}/auth/admin/login`,
    headers: { 'Content-Type': 'application/json' },
    body: { username: seededSuperAdmin.username }
  };
  const res = await http(req);
  record(name, req, res, null, '400');
  assert(res.status === 400, `Missing password harus 400, dapat ${res.status}`);
}

async function t1_login_missing_username() {
  const name = 'Auth: login missing username → 400';
  const req = {
    method: 'POST',
    url: `${API}/auth/admin/login`,
    headers: { 'Content-Type': 'application/json' },
    body: { password: seededSuperAdmin.password }
  };
  const res = await http(req);
  record(name, req, res, null, '400');
  assert(res.status === 400, `Missing username harus 400, dapat ${res.status}`);
}

// ---------- tests: /auth/me ----------
async function t2_me_with_token() {
  const name = 'Auth: GET /auth/me with valid token → 200';
  // ✅ Pastikan TOKEN terisi
  await ensureLogin();

  const req = {
    method: 'GET',
    url: `${API}/auth/me`,
    headers: { ...authHeader() }
  };
  const res = await http(req);
  record(name, req, res, null, '200 + admin');
  assert(res.status === 200, `/auth/me harus 200, dapat ${res.status}`);
  assert(res.data && res.data.admin && res.data.admin.username, 'Response /auth/me tidak berisi admin');
}

async function t2_me_without_token() {
  const name = 'Auth: GET /auth/me without token → 401';
  const req = {
    method: 'GET',
    url: `${API}/auth/me`,
    headers: {} // tanpa Authorization
  };
  const res = await http(req);
  record(name, req, res, null, '401');
  assert(res.status === 401, `/auth/me tanpa token harus 401, dapat ${res.status}`);
}

async function t2_me_with_invalid_token() {
  const name = 'Auth: GET /auth/me with invalid token → 401';
  const req = {
    method: 'GET',
    url: `${API}/auth/me`,
    headers: { Authorization: 'Bearer invalid.token.here' }
  };
  const res = await http(req);
  record(name, req, res, null, '401');
  assert(res.status === 401, `/auth/me token invalid harus 401, dapat ${res.status}`);
}

// ---------- main ----------
async function main() {
  const summary = { startedAt: new Date().toISOString(), baseUrl: BASE_URL, apiBase: API };
  let failed = 0;

  const steps = [
    t1_login_success,
    t1_login_wrong_password,
    t1_login_unknown_user,
    t1_login_missing_password,
    t1_login_missing_username,

    t2_me_with_token,       // ← sekarang pasti pakai token yang valid
    t2_me_without_token,
    t2_me_with_invalid_token
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

// File: scripts/test-info.js
// Tujuan: Otomatisasi testing CRUD Info Alumni (Berita, Event, Lowongan)
// Jalankan: node scripts/test-info.js
// ENV opsional:
//   BASE_URL (default http://localhost:3000)
//   ADMIN_ID (default 1)

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const FormData = require('form-data');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API = `${BASE_URL}/api`;
const OUT_DIR = path.join(process.cwd(), 'logs');
mkdirp.sync(OUT_DIR);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = path.join(OUT_DIR, `test-info-results-${stamp}.json`);

const ADMIN_ID = Number(process.env.ADMIN_ID || 1); // ✅ wajib di controller/model
const seededSuperAdmin = { username: 'superadmin_7843', password: 'SAdmin#7843' };
let TOKEN = null;

const PUBLIC = path.join(process.cwd(), 'public');
const IMG_BERITA   = path.join(PUBLIC, 'dies-natalis-64-ftuh.jpg');
const IMG_EVENT    = path.join(PUBLIC, 'ftuh-teknik-open-day.jpg');
const IMG_LOWONGAN = path.join(PUBLIC, 'lowongan-kerja-teknik.jpg');

const results = [];
const CREATED = {}; // { Berita: <uuid>, Event: <uuid>, 'Lowongan Pekerjaan': <uuid> }

function record(name, req, res, err, expect) {
  results.push({
    name, expect,
    request: {
      method: req.method, url: req.url, headers: req.headers, body: req.bodyDescribe || undefined
    },
    response: res
      ? { status: res.status, statusText: res.statusText, headers: res.headers, data: res.data }
      : null,
    error: err
      ? { message: err.message, code: err.code || null, response: err.response ? { status: err.response.status, data: err.response.data } : null }
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

async function login() {
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

// --- helper: memastikan file ada
function requireFile(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`File tidak ditemukan: ${p}`);
  }
  return p;
}

// --- multipart POST pakai Buffer
async function multipartPost(url, fields, filePath) {
  const form = new FormData();
  Object.entries(fields || {}).forEach(([k, v]) =>
    form.append(k, typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))
  );
  if (filePath) {
    requireFile(filePath);
    form.append('image', fs.readFileSync(filePath), path.basename(filePath));
  }
  const buffer = form.getBuffer();
  const headers = { ...form.getHeaders(), ...authHeader() };
  const req = { method: 'POST', url, headers, data: buffer, bodyDescribe: { ...fields, image: filePath ? path.basename(filePath) : null } };
  const res = await http(req);
  record(`POST ${url}`, req, res, null, '201');
  return res;
}

// --- multipart PATCH pakai Buffer
async function multipartPatch(url, fields, filePath) {
  const form = new FormData();
  Object.entries(fields || {}).forEach(([k, v]) =>
    form.append(k, typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))
  );
  if (filePath) {
    requireFile(filePath);
    form.append('image', fs.readFileSync(filePath), path.basename(filePath));
  }
  const buffer = form.getBuffer();
  const headers = { ...form.getHeaders(), ...authHeader() };
  const req = { method: 'PATCH', url, headers, data: buffer, bodyDescribe: { ...fields, image: filePath ? path.basename(filePath) : null } };
  const res = await http(req);
  record(`PATCH ${url}`, req, res, null, '200');
  return res;
}

/* ===================== TEST STEPS ===================== */

async function create_Berita() {
  const res = await multipartPost(`${API}/info`, {
    user_admin_id: ADMIN_ID,
    title: 'Dies Natalis FT-UH 64',
    content: 'Peringatan Dies Natalis 64 Fakultas Teknik Unhas.',
    type_info: 'Berita',
    is_active: true
  }, IMG_BERITA);

  assert(res.status === 201, `Create Berita harus 201, dapat ${res.status}`);
  const uuid = res.data?.data?.uuid;
  assert(uuid, 'Response create Berita tidak mengandung uuid');
  CREATED['Berita'] = uuid;
}

async function create_Event() {
  const res = await multipartPost(`${API}/info`, {
    user_admin_id: ADMIN_ID,
    title: 'Open Day Teknik 2025',
    content: 'Acara open day untuk calon mahasiswa.',
    type_info: 'Event',
    is_active: true
  }, IMG_EVENT);

  assert(res.status === 201, `Create Event harus 201, dapat ${res.status}`);
  const uuid = res.data?.data?.uuid;
  assert(uuid, 'Response create Event tidak mengandung uuid');
  CREATED['Event'] = uuid;
}

async function create_Lowongan() {
  const res = await multipartPost(`${API}/info`, {
    user_admin_id: ADMIN_ID,
    title: 'Lowongan Engineer Fresh Graduate',
    content: 'PT Maju Bersama membuka lowongan engineer.',
    type_info: 'Lowongan Pekerjaan',
    is_active: true
  }, IMG_LOWONGAN);

  assert(res.status === 201, `Create Lowongan harus 201, dapat ${res.status}`);
  const uuid = res.data?.data?.uuid;
  assert(uuid, 'Response create Lowongan tidak mengandung uuid');
  CREATED['Lowongan Pekerjaan'] = uuid;
}

/* ----- Error cases for CREATE ----- */
async function create_Error_Missing() {
  // tanpa title/content/type_info/user_admin_id
  const form = new FormData();
  form.append('is_active', 'true');
  const headers = { ...form.getHeaders(), ...authHeader() };
  const req = { method: 'POST', url: `${API}/info`, headers, data: form, bodyDescribe: { is_active: true } };
  const res = await http(req);
  record('Create ERROR missing fields', req, res, null, '400');
  assert([400, 422].includes(res.status), `Missing fields harus 400/422, dapat ${res.status}`);
}

async function create_Error_BadType() {
  const res = await multipartPost(`${API}/info`, {
    user_admin_id: ADMIN_ID,
    title: 'Salah Tipe',
    content: 'Harusnya ditolak.',
    type_info: 'Pengumuman' // ❌ bukan enum valid
  }, IMG_BERITA);
  assert(res.status === 400, `Invalid type_info harus 400, dapat ${res.status}`);
}

/* ----- LIST + FILTER ----- */
async function list_Default() {
  const req = { method: 'GET', url: `${API}/info`, headers: authHeader() };
  const res = await http(req);
  record('List semua info', req, res, null, '200');
  assert(res.status === 200, `List harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data?.data), 'List data harus array');
}

async function list_Filter_Berita() {
  // ✅ controller terima ?type=Berita
  const req = { method: 'GET', url: `${API}/info?type=Berita`, headers: authHeader() };
  const res = await http(req);
  record('Filter type=Berita', req, res, null, '200');
  assert(res.status === 200, `Filter Berita harus 200, dapat ${res.status}`);
}

async function list_Search() {
  const req = { method: 'GET', url: `${API}/info?search=Engineer`, headers: authHeader() };
  const res = await http(req);
  record('Search title contains "Engineer"', req, res, null, '200');
  assert(res.status === 200, `Search harus 200, dapat ${res.status}`);
}

/* ----- DETAIL ----- */
async function detail_OK() {
  const uuid = CREATED['Berita'];
  const req = { method: 'GET', url: `${API}/info/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record('Detail Berita OK', req, res, null, '200');
  assert(res.status === 200, `Detail harus 200, dapat ${res.status}`);
}

async function detail_NotFound() {
  const req = { method: 'GET', url: `${API}/info/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record('Detail NOT FOUND', req, res, null, '404');
  assert([404, 400].includes(res.status), `Not found detail harus 404/400, dapat ${res.status}`);
}

/* ----- UPDATE ----- */
async function update_NoFile() {
  const uuid = CREATED['Event'];
  const form = new FormData();
  form.append('title', 'Open Day Teknik 2025 (Update Judul)');
  form.append('is_active', 'false');
  const headers = { ...form.getHeaders(), ...authHeader() };
  const req = { method: 'PATCH', url: `${API}/info/${uuid}`, headers, data: form, bodyDescribe: { title: 'Open Day Teknik 2025 (Update Judul)', is_active: false } };
  const res = await http(req);
  record('Update Event tanpa file', req, res, null, '200');
  assert(res.status === 200, `Update tanpa file harus 200, dapat ${res.status}`);
}

async function update_GantiFile() {
  const uuid = CREATED['Lowongan Pekerjaan'];
  const res = await multipartPatch(`${API}/info/${uuid}`, {
    title: 'Lowongan Engineer (Update + Ganti Foto)'
  }, IMG_EVENT);
  assert(res.status === 200, `Update ganti file harus 200, dapat ${res.status}`);
}

async function update_Error_BadType() {
  const uuid = CREATED['Berita'];
  const res = await multipartPatch(`${API}/info/${uuid}`, { type_info: 'SalahTipe' }, null);
  assert(res.status === 400, `Update type_info invalid harus 400, dapat ${res.status}`);
}

/* ----- DELETE ----- */
async function delete_One() {
  const uuid = CREATED['Berita'];
  const req = { method: 'DELETE', url: `${API}/info/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record('Delete satu (Berita)', req, res, null, '200');
  assert(res.status === 200, `Delete satu harus 200, dapat ${res.status}`);
}

async function delete_Many() {
  // hapus dua sisanya: Event + Lowongan
  const u1 = CREATED['Event'];
  const u2 = CREATED['Lowongan Pekerjaan'];
  const req = { method: 'DELETE', url: `${API}/info/${u1},${u2}`, headers: authHeader() };
  const res = await http(req);
  record('Delete banyak (Event, Lowongan)', req, res, null, '200');
  assert(res.status === 200, `Delete banyak harus 200, dapat ${res.status}`);
}

async function delete_Error_UUIDInvalid() {
  const req = { method: 'DELETE', url: `${API}/info/not-a-uuid-xxxx`, headers: authHeader() };
  const res = await http(req);
  record('Delete ERROR (uuid invalid)', req, res, null, '400/404');
  assert([400, 404].includes(res.status), `UUID invalid delete harus 400/404, dapat ${res.status}`);
}

/* ===================== RUNNER ===================== */

async function main() {
  const summary = { startedAt: new Date().toISOString(), baseUrl: BASE_URL, apiBase: API };
  let failed = 0;

  const steps = [
    login,

    // CREATE (3 tipe + error)
    create_Berita,
    create_Event,
    create_Lowongan,
    create_Error_Missing,
    create_Error_BadType,

    // LIST
    list_Default,
    list_Filter_Berita,
    list_Search,

    // DETAIL
    detail_OK,
    detail_NotFound,

    // UPDATE
    update_NoFile,
    update_GantiFile,
    update_Error_BadType,

    // DELETE
    delete_One,
    delete_Many,
    delete_Error_UUIDInvalid
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

  fs.writeFileSync(outFile, JSON.stringify({
    summary: { ...summary, finishedAt: new Date().toISOString(), failed },
    results
  }, null, 2), 'utf8');

  console.log(`Saved report: ${outFile}`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  try {
    fs.writeFileSync(outFile, JSON.stringify({ fatal: e.message, results }, null, 2), 'utf8');
    console.log(`Saved report (fatal): ${outFile}`);
  } catch {}
  process.exit(1);
});

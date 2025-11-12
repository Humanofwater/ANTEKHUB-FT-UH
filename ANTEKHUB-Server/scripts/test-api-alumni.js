// File: scripts/test-api-alumni.js (revisi untuk alumni.controller.js terbaru)

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
const outFile = path.join(OUT_DIR, `test-alumni-results-${stamp}.json`);

const ADMIN_USER = process.env.ADMIN_USER || 'superadmin_7843';
const ADMIN_PASS = process.env.ADMIN_PASS || 'SAdmin#7843';

const PRODI_1 = process.env.TEST_PRODI_1 || 'Teknik Informatika';
const PRODI_2 = process.env.TEST_PRODI_2 || 'Teknik Sipil';
const STRATA_OK = 'Sarjana';

const results = [];
let TOKEN = null;
let CREATED = [];

function record(name, req, res, err, expect) {
  results.push({
    name, expect,
    request: { method: req.method, url: req.url, headers: req.headers, body: req.data || req.body || undefined },
    response: res ? { status: res.status, data: res.data } : null,
    error: err ? { message: err.message, response: err.response ? err.response.data : null } : null,
    ts: new Date().toISOString()
  });
}

function assert(c, msg) { if (!c) throw new Error(msg); }
function authHeader() { return { Authorization: `Bearer ${TOKEN}` }; }
async function http(cfg) { return axios({ ...cfg, validateStatus: () => true, timeout: 20000 }); }

async function loginAdmin() {
  const req = {
    method: 'POST',
    url: `${API}/auth/admin/login`,
    headers: { 'Content-Type': 'application/json' },
    data: { username: ADMIN_USER, password: ADMIN_PASS },
  };
  const res = await http(req);
  record('Auth: login', req, res, null, '200 + token');
  assert(res.status === 200 && res.data?.token, `Login gagal (${res.status})`);
  TOKEN = res.data.token;
}

// === PAYLOADS ===
function makeCreatePayload(i) {
  const nim = `99${Date.now()}${i}`;
  return {
    nama: `Testing Alumni ${i}`,
    tempat_lahir: 'Makassar',
    tanggal_lahir: `1998-0${(i % 8) + 1}-10`,
    agama: 'Islam',
    alamat: `Jl. Testing No.${i}, Makassar`,
    no_telp: `08${Math.floor(1000000000 + Math.random() * 8999999999)}`,
    pendidikan: [
      {
        nim,
        program_studi: i % 2 === 0 ? PRODI_1 : PRODI_2,
        strata: STRATA_OK,
        tahun_masuk: 2017 + (i % 3),
        lama_studi_tahun: 4,
        lama_studi_bulan: 0,
        no_alumni: `AL${10000 + i}`,
        tanggal_lulus: '2021-08-31',
        nilai_ujian: 'A', // enum valid
        ipk: 3.45,
        predikat_kelulusan: 'Cum Laude',
        judul_tugas_akhir: `Analisis Sistem ${i}`,
        ipb: 3.40,
      },
    ],
  };
}

function makeBadPayload_missingRequired() {
  return {
    tempat_lahir: 'Makassar',
    agama: 'Islam',
    alamat: 'Jl. Kosong',
    no_telp: '08123456789',
    pendidikan: [
      {
        nim: `99${Date.now()}`,
        program_studi: PRODI_1,
        strata: STRATA_OK,
        tahun_masuk: 2018,
        lama_studi_tahun: 4,
        lama_studi_bulan: 0,
        no_alumni: 'AL1234',
        tanggal_lulus: '2022-08-31',
        nilai_ujian: 'B',
        ipk: 3.1,
        predikat_kelulusan: 'Memuaskan',
        judul_tugas_akhir: 'X',
        ipb: 3.0,
      },
    ],
  };
}

function makeBadPayload_invalidEnum() {
  return {
    nama: 'Enum Salah',
    tempat_lahir: 'Makassar',
    tanggal_lahir: '1999-10-10',
    agama: 'Islam',
    alamat: 'Jl. Salah Enum',
    no_telp: '08123456780',
    pendidikan: [
      {
        nim : `99${Date.now()}`,
        program_studi: PRODI_1, // valid prodi
        strata: STRATA_OK,
        tahun_masuk: 2018,
        lama_studi_tahun: 4,
        lama_studi_bulan: 0,
        no_alumni: 'AL1999',
        tanggal_lulus: '2022-08-31',
        nilai_ujian: 'Z', // invalid enum
        ipk: 5.1, // invalid
        predikat_kelulusan: 'TidakAda', // invalid
        judul_tugas_akhir: 'Wrong Enum',
        ipb: 5.0,
      },
    ],
  };
}

// === TEST CASES ===
async function t1_create_ok() {
  const created = [];
  for (let i = 1; i <= 2; i++) {
    const req = { method: 'POST', url: `${API}/alumni`, headers: { ...authHeader(), 'Content-Type': 'application/json' }, data: makeCreatePayload(i) };
    const res = await http(req);
    record(`Create OK #${i}`, req, res, null, '201');
    assert(res.status === 201 && res.data?.data?.uuid, `Create gagal: ${res.status}`);
    created.push(res.data.data.uuid);
  }
  CREATED = created;
}

async function t1_create_error_missing_required() {
  const req = { method: 'POST', url: `${API}/alumni`, headers: { ...authHeader(), 'Content-Type': 'application/json' }, data: makeBadPayload_missingRequired() };
  const res = await http(req);
  record('Create ERROR missing', req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Harus 400/422, dapat ${res.status}`);
}

async function t1_create_error_invalid_enum() {
  const req = { method: 'POST', url: `${API}/alumni`, headers: { ...authHeader(), 'Content-Type': 'application/json' }, data: makeBadPayload_invalidEnum() };
  const res = await http(req);
  record('Create ERROR invalid-enum', req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Harus 400/422, dapat ${res.status}`);
}

async function t2_get_list_default() {
  const req = { method: 'GET', url: `${API}/alumni?page=1&limit=20`, headers: authHeader() };
  const res = await http(req);
  record('List default', req, res, null, '200');
  assert(res.status === 200 && Array.isArray(res.data?.data), `List gagal: ${res.status}`);
}

async function t2_get_list_filters() {
  const r1 = await http({ method: 'GET', url: `${API}/alumni?strata=${encodeURIComponent(STRATA_OK)}`, headers: authHeader() });
  record(`Filter strata=${STRATA_OK}`, { method: 'GET', url: `${API}/alumni?strata=${STRATA_OK}`, headers: authHeader() }, r1, null, '200');
  assert(r1.status === 200, 'Filter strata gagal');

  const r2 = await http({ method: 'GET', url: `${API}/alumni?program_studi=${encodeURIComponent(PRODI_1)}`, headers: authHeader() });
  record(`Filter program_studi=${PRODI_1}`, { method: 'GET', url: `${API}/alumni?program_studi=${PRODI_1}`, headers: authHeader() }, r2, null, '200');
  assert(r2.status === 200, 'Filter prodi gagal');

  const r3 = await http({ method: 'GET', url: `${API}/alumni?angkatan=2018`, headers: authHeader() });
  record('Filter angkatan=2018', { method: 'GET', url: `${API}/alumni?angkatan=2018`, headers: authHeader() }, r3, null, '200');
  assert(r3.status === 200, 'Filter angkatan gagal');

  const r4 = await http({ method: 'GET', url: `${API}/alumni?search=${encodeURIComponent('Testing Alumni 1')}`, headers: authHeader() });
  record('Search nama', { method: 'GET', url: `${API}/alumni?search=Testing%20Alumni%201`, headers: authHeader() }, r4, null, '200');
  assert(r4.status === 200, 'Search gagal');
}

async function t3_get_detail_ok() {
  const uuid = CREATED[0];
  const req = { method: 'GET', url: `${API}/alumni/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record('Detail OK', req, res, null, '200');
  assert(res.status === 200 && res.data?.data?.uuid === uuid, `Detail gagal: ${res.status}`);
}

async function t4_update_ok() {
  const uuid = CREATED[0];
  const body = { alamat: 'Jl. Updated No.123', no_telp: '081234500000' };
  const req = { method: 'PATCH', url: `${API}/alumni/${uuid}`, headers: { ...authHeader(), 'Content-Type': 'application/json' }, data: body };
  const res = await http(req);
  record('Update OK', req, res, null, '200');
  assert(res.status === 200, `Update gagal: ${res.status}`);
}

async function t5_delete_ok() {
  const uuid = CREATED[1];
  const req = { method: 'DELETE', url: `${API}/alumni/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record('Delete OK', req, res, null, '200');
  assert(res.status === 200, `Delete gagal: ${res.status}`);
}

async function main() {
  let failed = 0;
  const steps = [
    loginAdmin,
    t1_create_ok,
    t1_create_error_missing_required,
    t1_create_error_invalid_enum,
    t2_get_list_default,
    t2_get_list_filters,
    t3_get_detail_ok,
    t4_update_ok,
    t5_delete_ok,
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
  fs.writeFileSync(outFile, JSON.stringify({ summary: { finishedAt: new Date().toISOString(), failed }, results }, null, 2), 'utf8');
  console.log('Saved report:', outFile);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => {
  console.error('Fatal:', e);
  fs.writeFileSync(outFile, JSON.stringify({ fatal: e.message, results }, null, 2), 'utf8');
  process.exit(1);
});

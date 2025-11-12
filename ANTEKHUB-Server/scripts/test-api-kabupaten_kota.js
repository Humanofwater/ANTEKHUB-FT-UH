// File: scripts/test-api-kabupaten-kota.js
// Tujuan: End-to-end testing kabupaten-kota (global & scoped) + seeder negara & provinsi
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
const outFile = path.join(OUT_DIR, `test-kabupaten-kota-${stamp}.json`);

const seededSuperAdmin = { username: 'superadmin_7843', password: 'SAdmin#7843' };

const results = [];
let TOKEN = null;

// Seeder hasil
let BANGSA = {};   // { ID: { id, uuid, ... }, SG: { id, uuid, ... } }
let PROVINSI = {}; // { ID: { id, uuid, ... }, SG: { id, uuid, ... } }

// Data dibuat saat test
let CREATED = [];  // uuid kabupaten/kota yang dibuat

function record(name, req, res, err, expect) {
  results.push({
    name,
    expect,
    request: req,
    response: res ? {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      data: res.data
    } : null,
    error: err ? {
      message: err.message,
      code: err.code || null,
      response: err.response ? { status: err.response.status, data: err.response.data } : null
    } : null,
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

/* ============================
   AUTH: Login Super Admin
============================ */
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

/* ============================
   SEED: Bangsa (Indonesia & Singapura)
============================ */
async function ensureBangsaSeed() {
  // Cek existing
  const q = { method: 'GET', url: `${API}/negara?iso2=ID&iso2=SG`, headers: authHeader() };
  const got = await http(q);
  record('Bangsa: get existing (iso2=ID,SG)', q, got, null, '200');
  assert(got.status === 200, `GET bangsa harus 200, dapat ${got.status}`);
  const rows = Array.isArray(got.data?.data) ? got.data.data : [];
  const byIso2 = (iso2) => rows.find(r => String(r.iso2).toUpperCase() === iso2);
  let ID = byIso2('ID');
  let SG = byIso2('SG');

  // Create jika belum ada
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

  if (!ID?.id || !SG?.id) {
    const req = { method: 'GET', url: `${API}/negara?iso2=ID&iso2=SG`, headers: authHeader() };
    const res = await http(req);
    record('Bangsa: re-fetch after seed', req, res, null, '200');
    assert(res.status === 200, `Re-fetch bangsa harus 200, dapat ${res.status}`);
    const rows2 = Array.isArray(res.data?.data) ? res.data.data : [];
    const byIso2b = (iso2) => rows2.find(r => String(r.iso2).toUpperCase() === iso2);
    ID = ID?.id ? ID : byIso2b('ID');
    SG = SG?.id ? SG : byIso2b('SG');
  }

  assert(ID?.id, 'Gagal memastikan bangsa Indonesia (ID) tersedia');
  assert(SG?.id, 'Gagal memastikan bangsa Singapura (SG) tersedia');

  BANGSA = { ID, SG };
}

/* ============================
   SEED: Provinsi (masing-masing negara)
============================ */
async function ensureProvinsiSeed() {
  // Buat 1 provinsi untuk ID dan 1 untuk SG
  async function createProv(bangsa, label, fallbackIso) {
    const body = {
      bangsa_id: bangsa.id,
      nama: `${label} Seed ${Date.now()}`,
      iso2: fallbackIso,
      iso3166_2: `${bangsa.iso2 || 'ID'}-${fallbackIso}`,
      longitude: 100.0,
      latitude: 0.0
    };
    const req = {
      method: 'POST',
      url: `${API}/provinsi`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body
    };
    const res = await http(req);
    record(`Provinsi: seed ${label} (${bangsa.iso2})`, req, res, null, '201');
    assert(res.status === 201, `Create provinsi ${label} harus 201, dapat ${res.status}`);
    return res.data?.data;
  }

  // Coba ambil list provinsi untuk tiap negara dulu (kalau sudah ada, pilih satu)
  async function pickOrCreate(bangsaKey, label, fallbackIso) {
    const bangsa = BANGSA[bangsaKey];
    const getReq = { method: 'GET', url: `${API}/provinsi?bangsa_id=${bangsa.id}`, headers: authHeader() };
    const got = await http(getReq);
    record(`Provinsi: list existing for ${bangsaKey}`, getReq, got, null, '200');
    assert(got.status === 200, `List provinsi harus 200, dapat ${got.status}`);
    const exists = Array.isArray(got.data?.data) ? got.data.data : [];
    if (exists.length) return exists[0];
    return await createProv(bangsa, label, fallbackIso);
  }

  const provID = await pickOrCreate('ID', 'Prov-ID', 'JK');
  const provSG = await pickOrCreate('SG', 'Prov-SG', 'SG');

  assert(provID?.id && provID?.uuid, 'Provinsi untuk ID tidak valid');
  assert(provSG?.id && provSG?.uuid, 'Provinsi untuk SG tidak valid');

  PROVINSI = { ID: provID, SG: provSG };
}

/* ============================
   Helper payload kabupaten-kota
============================ */
function makeCreatePayload(i) {
  const useSG = i % 2 === 0;
  const prov = useSG ? PROVINSI.SG : PROVINSI.ID;
  return {
    provinsi_id: prov.id,
    nama: `Kab/Kota Uji ${i}-${Date.now()}`, // unik
    longitude: 110 + i,
    latitude: -7 - i
  };
}

function makeBadPayload_missingRequired() {
  return {
    // provinsi_id hilang
    // nama hilang
    longitude: 110
  };
}

function makeBadPayload_invalidSchema() {
  return {
    provinsi_id: 'SATU',   // harus number
    nama: '',              // required
    longitude: 'timur',    // harus number
    latitude: 'selatan'    // harus number
  };
}

/* ============================
   TESTS: CREATE
============================ */
async function t1_create_ok() {
  const name = 'KabKota: create OK (2 rows)';
  const createdLocal = [];
  for (let i = 1; i <= 2; i++) {
    const req = {
      method: 'POST',
      url: `${API}/kabupaten-kota`,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: makeCreatePayload(i)
    };
    const res = await http(req);
    record(`${name} #${i}`, req, res, null, '201 + data.uuid');
    assert(res.status === 201, `Create harus 201, dapat ${res.status}`);
    assert(res.data?.data?.uuid, 'Response tidak mengandung data.uuid');
    createdLocal.push(res.data.data.uuid);
  }
  CREATED = createdLocal;
}

async function t1_create_error_missing_required() {
  const name = 'KabKota: create ERROR missing required';
  const req = {
    method: 'POST',
    url: `${API}/kabupaten-kota`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_missingRequired()
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Missing required harus 400/422, dapat ${res.status}`);
}

async function t1_create_error_invalid_schema() {
  const name = 'KabKota: create ERROR invalid schema';
  const req = {
    method: 'POST',
    url: `${API}/kabupaten-kota`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: makeBadPayload_invalidSchema()
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Invalid schema harus 400/422, dapat ${res.status}`);
}

/* ============================
   TESTS: LIST (GLOBAL & FILTER)
============================ */
async function t2_get_list_global() {
  const name = 'KabKota: list global (no pagination)';
  const req = { method: 'GET', url: `${API}/kabupaten-kota`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array');
  assert(res.status === 200, `List harus 200, dapat ${res.status}`);
  assert(Array.isArray(res.data?.data), 'data harus array');
  assert(typeof res.data?.meta?.total === 'number', 'meta.total harus number');
}

async function t2_get_list_filter_provinsi_id() {
  const name = 'KabKota: filter by provinsi_id';
  const req = { method: 'GET', url: `${API}/kabupaten-kota?provinsi_id=${PROVINSI.ID.id}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Filter provinsi_id harus 200, dapat ${res.status}`);
}

/* ============================
   TESTS: LIST (SCOPED)
============================ */
async function t2b_get_by_negara_uuid() {
  const name = 'KabKota: list by negara UUID';
  const req = { method: 'GET', url: `${API}/negara/${BANGSA.ID.uuid}/kabupaten-kota`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array scoped negara');
  assert(res.status === 200, `List by negara harus 200, dapat ${res.status}`);
}

async function t2c_get_by_provinsi_uuid() {
  const name = 'KabKota: list by provinsi UUID';
  const req = { method: 'GET', url: `${API}/provinsi/${PROVINSI.ID.uuid}/kabupaten-kota`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + array scoped provinsi');
  assert(res.status === 200, `List by provinsi harus 200, dapat ${res.status}`);
}

async function t2d_get_by_bangsa_and_provinsi_uuid_ok() {
  const name = 'KabKota: list by negara+provinsi UUID (valid pair)';
  const req = {
    method: 'GET',
    url: `${API}/negara/${BANGSA.ID.uuid}/provinsi/${PROVINSI.ID.uuid}/kabupaten-kota`,
    headers: authHeader()
  };
  const res = await http(req);
  record(name, req, res, null, '200 + valid pair');
  assert(res.status === 200, `List by negara+provinsi harus 200, dapat ${res.status}`);
}

async function t2e_get_by_bangsa_and_provinsi_uuid_mismatch() {
  const name = 'KabKota: list by negara+provinsi UUID (mismatch → 400/404)';
  // Pakai provinsi milik SG dengan negara ID untuk memicu mismatch
  const req = {
    method: 'GET',
    url: `${API}/negara/${BANGSA.ID.uuid}/provinsi/${PROVINSI.SG.uuid}/kabupaten-kota`,
    headers: authHeader()
  };
  const res = await http(req);
  record(name, req, res, null, '400/404');
  assert([400, 404].includes(res.status), `Mismatch negara↔provinsi harus 400/404, dapat ${res.status}`);
}

/* ============================
   TESTS: DETAIL
============================ */
async function t3_get_detail_ok() {
  const name = 'KabKota: detail OK';
  const uuid = CREATED[0];
  const req = { method: 'GET', url: `${API}/kabupaten-kota/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200 + uuid match');
  assert(res.status === 200, `Detail harus 200, dapat ${res.status}`);
  assert(res.data?.data?.uuid === uuid, 'UUID detail tidak cocok');
}

async function t3_get_detail_not_found() {
  const name = 'KabKota: detail NOT FOUND';
  const req = { method: 'GET', url: `${API}/kabupaten-kota/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Not-found harus 404/400, dapat ${res.status}`);
}

/* ============================
   TESTS: UPDATE
============================ */
async function t4_update_ok() {
  const name = 'KabKota: update OK';
  const uuid = CREATED[0];
  const body = { nama: 'Kab/Kota Uji (Updated)' };
  const req = {
    method: 'PATCH',
    url: `${API}/kabupaten-kota/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Update harus 200, dapat ${res.status}`);
}

async function t4_update_error_invalid_schema() {
  const name = 'KabKota: update ERROR invalid schema';
  const uuid = CREATED[0];
  const body = { provinsi_id: 'SATU', longitude: 'barat' }; // tipe salah
  const req = {
    method: 'PATCH',
    url: `${API}/kabupaten-kota/${uuid}`,
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body
  };
  const res = await http(req);
  record(name, req, res, null, '400/422');
  assert([400, 422].includes(res.status), `Invalid schema seharusnya 400/422, dapat ${res.status}`);
}

/* ============================
   TESTS: DELETE
============================ */
async function t5_delete_not_found() {
  const name = 'KabKota: delete NOT FOUND';
  const req = { method: 'DELETE', url: `${API}/kabupaten-kota/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '404/400');
  assert([404, 400].includes(res.status), `Delete not-found seharusnya 404/400, dapat ${res.status}`);
}

async function t5_delete_ok() {
  const name = 'KabKota: delete OK';
  const uuid = CREATED[1]; // hapus yang kedua
  const req = { method: 'DELETE', url: `${API}/kabupaten-kota/${uuid}`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete harus 200, dapat ${res.status}`);
}

async function t6_delete_all_ok() {
  const name = 'KabKota: delete ALL OK';
  const req = { method: 'DELETE', url: `${API}/kabupaten-kota/__all`, headers: authHeader() };
  const res = await http(req);
  record(name, req, res, null, '200');
  assert(res.status === 200, `Delete all harus 200, dapat ${res.status}`);
}

/* ============================
   MAIN
============================ */
async function main() {
  const summary = { startedAt: new Date().toISOString(), baseUrl: BASE_URL, apiBase: API };

  let failed = 0;
  const steps = [
    loginAdmin,

    // Seeder dulu
    ensureBangsaSeed,
    ensureProvinsiSeed,

    // CREATE
    t1_create_ok,
    t1_create_error_missing_required,
    t1_create_error_invalid_schema,

    // LIST (global + filter)
    t2_get_list_global,
    t2_get_list_filter_provinsi_id,

    // LIST (scoped)
    t2b_get_by_negara_uuid,
    t2c_get_by_provinsi_uuid,
    t2d_get_by_bangsa_and_provinsi_uuid_ok,
    t2e_get_by_bangsa_and_provinsi_uuid_mismatch,

    // DETAIL
    t3_get_detail_ok,
    t3_get_detail_not_found,

    // UPDATE
    t4_update_ok,
    t4_update_error_invalid_schema,

    // DELETE
    t5_delete_not_found,
    t5_delete_ok,

    // DELETE ALL (cleanup)
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

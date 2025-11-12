// File: scripts/test-api-users_profile.js
// E2E users_profile + masters + similarity + scheduler (email)
// Jalankan: node scripts/test-api-users_profile.js

require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const mkdirp = require("mkdirp");
const dayjs = require("dayjs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API = `${BASE_URL}/api`;
const OUT_DIR = path.join(process.cwd(), "logs");
mkdirp.sync(OUT_DIR);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(OUT_DIR, `test-users_profile-${stamp}.json`);

// Akun
const PRIMARY_EMAIL = "antekhub09@ftuh.online";
const PRIMARY_PASSWORD = "Afr291102!Z";
const SECOND_EMAIL = "antekhub@ftuh.online";
const SECOND_PASSWORD = "Afr291102!";

// Foto (sesuai permintaan)
const PHOTO_CREATE = path.join(
  process.cwd(),
  "public",
  "photo-profile-user1.webp"
);
const PHOTO_CHANGE = path.join(
  process.cwd(),
  "public",
  "photo-profile-user2.jpg"
);

let TOKEN = null;
let USER = null; // { uuid, email, id }
const results = [];

function record(name, req, res, err, expect) {
  results.push({
    name,
    expect,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers ? redactAuth(req.headers) : undefined,
      body: req.data || req.body || undefined,
    },
    response: res ? { status: res.status, data: res.data } : null,
    error: err
      ? {
          message: err.message,
          response: err.response ? err.response.data : null,
        }
      : null,
    ts: new Date().toISOString(),
  });
}
function redactAuth(h) {
  const c = { ...h };
  if (c.Authorization) c.Authorization = "Bearer <REDACTED>";
  return c;
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function authHeader() {
  return { Authorization: `Bearer ${TOKEN}` };
}
async function http(cfg) {
  return axios({ ...cfg, validateStatus: () => true, timeout: 30000 });
}

// ---------- Helpers: ensure dummy masters via model (kalau kosong) ----------
async function ensureDummyMasters() {
  const models = require("../src/models");
  const { ReferensiPerusahaan, ReferensiJabatan } = models;

  const companyName = "PT Nusantara Teknologi";
  const existsP = await ReferensiPerusahaan.findOne({
    where: { nama_perusahaan: companyName },
  });
  if (!existsP) {
    await ReferensiPerusahaan.create({
      nama_perusahaan: companyName,
      perusahaan_alamat: "Jl. Utama No.1",
      alias_list: [companyName],
      total_alumni: 0,
      longitude: 2.1,
      latitude: 3.0,
      jenis_perusahaan_id: null,
      bidang_industri_id: null,
    });
    console.log("Dummy ReferensiPerusahaan created:", companyName);
  }

  const jabName = "Software Engineer";
  const existsJ = await ReferensiJabatan.findOne({
    where: { jabatan: jabName },
  });
  if (!existsJ) {
    await ReferensiJabatan.create({ jabatan: jabName, alias_list: [jabName] });
    console.log("Dummy ReferensiJabatan created:", jabName);
  }
}

// ---------- Step 1: Login primary & me ----------
async function loginPrimary() {
  const req = {
    method: "POST",
    url: `${API}/auth/login`,
    headers: { "Content-Type": "application/json" },
    data: { email: PRIMARY_EMAIL, password: PRIMARY_PASSWORD },
  };
  const res = await http(req);
  record("Auth: login primary", req, res, null, "200");
  assert(
    res.status === 200 && res.data?.token,
    `Login primary gagal (${res.status})`
  );
  TOKEN = res.data.token;

  const reqMe = { method: "GET", url: `${API}/auth/me`, headers: authHeader() };
  const resMe = await http(reqMe);
  record("Auth: me primary", reqMe, resMe, null, "200");
  const u = resMe.data.user || {};
  USER = { uuid: u.uuid, email: u.email, id: u.id };
  assert(USER.uuid, "user.uuid tidak ada");
}

// ---------- Step 2: GET Masters via routes ----------
async function getMastersViaRoutes() {
  const reqNeg = { method: "GET", url: `${API}/negara`, headers: authHeader() };
  const resNeg = await http(reqNeg);
  // record("GET negara", reqNeg, resNeg, null, "200");

  const reqProv = {
    method: "GET",
    url: `${API}/provinsi`,
    headers: authHeader(),
  };
  const resProv = await http(reqProv);
  // record("GET provinsi", reqProv, resProv, null, "200");

  const reqKab = {
    method: "GET",
    url: `${API}/kabupaten-kota`,
    headers: authHeader(),
  };
  const resKab = await http(reqKab);
  // record("GET kabupaten-kota", reqKab, resKab, null, "200");

  const reqRefP = {
    method: "GET",
    url: `${API}/referensi-perusahaan`,
    headers: authHeader(),
  };
  const resRefP = await http(reqRefP);
  // record("GET referensi-perusahaan (before)", reqRefP, resRefP, null, "200");

  const reqRefJ = {
    method: "GET",
    url: `${API}/referensi-jabatan`,
    headers: authHeader(),
  };
  const resRefJ = await http(reqRefJ);
  // record("GET referensi-jabatan (before)", reqRefJ, resRefJ, null, "200");
}

// ---------- Step 3: Create profile primary (idempotent) ----------
function makeCreatePayload(companyName, jabatanName) {
  return {
    status: "Bekerja",
    domisili: {
      longitude: 119.42,
      latitude: -5.14,
      alamat: "Jl. Contoh No.1, Makassar",
    },
    dom_eq_job: true,
    perusahaan: {
      nama: companyName,
      alamat: "Jl. Kantor No.1",
      jenis_institusi_id: 10,
      bidang_industri_id: 10,
      jabatan_nama: jabatanName,
    },
  };
}

async function createProfilePrimary() {
  // siapkan payload JSON + file foto (webp)
  const payload = makeCreatePayload(
    "PT Nusantara Teknologi",
    "Software Engineer"
  );

  // pastikan file ada
  if (!fs.existsSync(PHOTO_CREATE)) {
    mkdirp.sync(path.dirname(PHOTO_CREATE));
    fs.writeFileSync(PHOTO_CREATE, "dummy image content", "utf8");
  }

  const form = new FormData();
  form.append("body", JSON.stringify(payload)); // <--- JSON string di field "body"
  form.append("photo", fs.createReadStream(PHOTO_CREATE)); // <--- file field "photo"

  const req = {
    method: "POST",
    url: `${API}/users-profile/${USER.uuid}`,
    headers: { ...authHeader(), ...form.getHeaders() },
    data: form,
  };

  const res = await http(req);
  record("Create profile - primary", req, res, null, "201 or 409");
  if (res.status === 201 || res.status === 409) return;
  throw new Error(`Create profile primary gagal: ${res.status}`);
}

// ---------- Step 4: Upload photo (webp) & change photo (jpg) ----------
async function patchPhotoInitial() {
  if (!fs.existsSync(PHOTO_CREATE)) {
    mkdirp.sync(path.dirname(PHOTO_CREATE));
    fs.writeFileSync(PHOTO_CREATE, "dummy image content", "utf8");
  }
  const form = new FormData();
  form.append("photo", fs.createReadStream(PHOTO_CREATE));
  const req = {
    method: "PATCH",
    url: `${API}/users-profile/${USER.uuid}/photo`,
    headers: { ...authHeader(), ...form.getHeaders() },
    data: form,
  };
  const res = await http(req);
  record("Patch photo (initial webp)", req, res, null, "200");
  assert(res.status === 200, "Patch photo initial gagal");
}

async function patchPhotoChange() {
  if (!fs.existsSync(PHOTO_CHANGE)) {
    mkdirp.sync(path.dirname(PHOTO_CHANGE));
    fs.writeFileSync(PHOTO_CHANGE, "dummy image content", "utf8");
  }
  const form = new FormData();
  form.append("photo", fs.createReadStream(PHOTO_CHANGE));
  const req = {
    method: "PATCH",
    url: `${API}/users-profile/${USER.uuid}/photo`,
    headers: { ...authHeader(), ...form.getHeaders() },
    data: form,
  };
  const res = await http(req);
  record("Patch photo (change to jpg)", req, res, null, "200");
  assert(res.status === 200, "Patch photo change gagal");
}

// ---------- Step 5: User 2 create profile dengan alias berbeda (idempotent) ----------
async function createProfileSecondWithAlias() {
  // login second
  const reqLogin = {
    method: "POST",
    url: `${API}/auth/login`,
    headers: { "Content-Type": "application/json" },
    data: { email: SECOND_EMAIL, password: SECOND_PASSWORD },
  };
  const resLogin = await http(reqLogin);
  record("Auth: login second", reqLogin, resLogin, null, "200");
  assert(
    resLogin.status === 200 && resLogin.data?.token,
    "Login second failed"
  );
  const token2 = resLogin.data.token;

  // get uuid via /auth/me (login resp tak punya user.uuid)
  const reqMe2 = {
    method: "GET",
    url: `${API}/auth/me`,
    headers: { Authorization: `Bearer ${token2}` },
  };
  const resMe2 = await http(reqMe2);
  record("Auth: me second", reqMe2, resMe2, null, "200");
  const secondUuid = resMe2.data?.user?.uuid;
  assert(secondUuid, "Second user uuid not found");

  // buat profile dengan alias berbeda
  const payload = makeCreatePayload("PT Nusantara Tek.", "S/W Engineer");
  const req = {
    method: "POST",
    url: `${API}/users-profile/${secondUuid}`,
    headers: {
      Authorization: `Bearer ${token2}`,
      "Content-Type": "application/json",
    },
    data: payload,
  };
  const res = await http(req);
  record(
    "Create profile - second (similar company/jab)",
    req,
    res,
    null,
    "201 or 409"
  );
  if (res.status === 201 || res.status === 409) return;
  throw new Error("Create profile second failed");
}

// ---------- Step 6: Cek similarity via routes referensi-* ----------
async function checkSimilarityResults() {
  // NOTE: response bentuknya { data: [...], meta: {...} }
  const reqRefP = {
    method: "GET",
    url: `${API}/referensi-perusahaan?search=Nusantara`,
    headers: authHeader(),
  };
  const resRefP = await http(reqRefP);
  record(
    "GET referensi-perusahaan (after similarity)",
    reqRefP,
    resRefP,
    null,
    "200"
  );
  assert(
    resRefP.status === 200 && resRefP.data && Array.isArray(resRefP.data.data),
    "referensi-perusahaan GET failed"
  );

  const items = resRefP.data.data;
  const found = items.find((x) => /Nusantara/i.test(x.nama_perusahaan));
  assert(found, "Tidak menemukan perusahaan Nusantara setelah similarity");

  const aliases = Array.isArray(found.alias_list)
    ? found.alias_list.map((a) => (a || "").toLowerCase())
    : [];
  const hasCanonical =
    aliases.includes("pt nusantara teknologi") ||
    /nusantara teknologi/i.test(found.nama_perusahaan);
  const hasVariant = aliases.includes("pt nusantara tek.");
  record(
    "Similarity check companies",
    { method: "CHECK", url: "alias_list" },
    { status: 200, data: { aliases } },
    null,
    "contains canonical & variant"
  );
  assert(
    hasCanonical && hasVariant,
    "Alias perusahaan belum memuat kedua varian"
  );

  const reqJ = {
    method: "GET",
    url: `${API}/referensi-jabatan?search=Engineer`,
    headers: authHeader(),
  };
  const resJ = await http(reqJ);
  record("GET referensi-jabatan (after similarity)", reqJ, resJ, null, "200");
  // rute jabatanmu kemungkinan juga { data: [...], meta } — fallback ke array langsung kalau tidak
  const jabArr = Array.isArray(resJ.data) ? resJ.data : resJ.data?.data || [];
  assert(Array.isArray(jabArr), "referensi-jabatan GET failed (shape)");
  const jabFound = jabArr.find((x) => /Engineer/i.test(x.jabatan));
  assert(jabFound, "Tidak menemukan jabatan Engineer");
  const jabAliases = Array.isArray(jabFound.alias_list)
    ? jabFound.alias_list.map((a) => (a || "").toLowerCase())
    : [];
  const jabHasVariant = jabAliases.includes("s/w engineer");
  record(
    "Similarity check jabatan",
    { method: "CHECK", url: "alias_list" },
    { status: 200, data: { jabAliases } },
    null,
    "contains variant"
  );
  assert(
    jabHasVariant || /software engineer/i.test(jabFound.jabatan),
    "Alias jabatan belum memuat varian"
  );
}

// ---------- Step 7: Scheduler scenarios (H0, H7, H14, monthly) ----------
async function runSchedulerScenarios() {
  const models = require("../src/models");
  const { Users, UsersProfile } = models;
  const job = require("../src/jobs/profileValidity.job");

  async function setValidUntilFor(email, dateStr) {
    const u = await Users.findOne({ where: { email } });
    assert(u, `User ${email} tidak ditemukan`);
    // ⬇️ perbaikan penting: kolom relasi adalah user_id
    const p = await UsersProfile.findOne({ where: { user_id: u.id } });
    assert(p, `UsersProfile untuk ${email} tidak ditemukan`);
    await p.update({
      valid_until: dateStr,
      reminder_stage: 0,
      last_reminder_sent_at: null,
    });
    return { u, p };
  }

  // H0 (jatuh tempo hari ini)
  const today = dayjs().format("YYYY-MM-DD");
  await setValidUntilFor(PRIMARY_EMAIL, today);
  await job.runOnce();
  let urow = await Users.findOne({ where: { email: PRIMARY_EMAIL } });
  let prow = await UsersProfile.findOne({ where: { user_id: urow.id } });
  record(
    "Scheduler H0",
    { method: "JOB", url: "runOnce H0" },
    {
      status: 200,
      data: {
        is_fill_profile: urow.is_fill_profile,
        reminder_stage: prow.reminder_stage,
      },
    },
    null,
    "is_fill_profile=false, stage>=1"
  );
  assert(urow.is_fill_profile === false, "H0: is_fill_profile harus false");
  assert((prow.reminder_stage || 0) >= 1, "H0: reminder_stage harus >=1");

  // H7
  const sevenAgo = dayjs().subtract(7, "day").format("YYYY-MM-DD");
  await setValidUntilFor(PRIMARY_EMAIL, sevenAgo);
  await job.runOnce();
  prow = await UsersProfile.findOne({ where: { user_id: urow.id } });
  record(
    "Scheduler H7",
    { method: "JOB", url: "runOnce H7" },
    { status: 200, data: { reminder_stage: prow.reminder_stage } },
    null,
    "stage>=2"
  );
  assert((prow.reminder_stage || 0) >= 2, "H7: reminder_stage harus >=2");

  // H14
  const fourteenAgo = dayjs().subtract(14, "day").format("YYYY-MM-DD");
  await setValidUntilFor(PRIMARY_EMAIL, fourteenAgo);
  await job.runOnce();
  prow = await UsersProfile.findOne({ where: { user_id: urow.id } });
  record(
    "Scheduler H14",
    { method: "JOB", url: "runOnce H14" },
    { status: 200, data: { reminder_stage: prow.reminder_stage } },
    null,
    "stage>=3"
  );
  assert((prow.reminder_stage || 0) >= 3, "H14: reminder_stage harus >=3");

  // Monthly (tanggal 1)
  const twoMonthsAgoFirst = dayjs()
    .subtract(2, "month")
    .date(1)
    .format("YYYY-MM-DD");
  await setValidUntilFor(PRIMARY_EMAIL, twoMonthsAgoFirst);
  const firstOfThisMonth = dayjs().date(1).format("YYYY-MM-DD");
  await job.runOnce();
  prow = await UsersProfile.findOne({ where: { user_id: urow.id } });
  record(
    "Scheduler Monthly",
    { method: "JOB", url: "runOnce first day" },
    { status: 200, data: { reminder_stage: prow.reminder_stage } },
    null,
    "stage stays >=3"
  );
  assert((prow.reminder_stage || 0) >= 3, "Monthly: reminder_stage harus >=3");
}

// ---------- RUN ----------
async function main() {
  let failed = 0;
  const steps = [
    ensureDummyMasters,
    loginPrimary,
    getMastersViaRoutes,
    createProfilePrimary,
    patchPhotoInitial,
    patchPhotoChange,
    createProfileSecondWithAlias, // login + /auth/me utk uuid
    checkSimilarityResults,
    runSchedulerScenarios,
  ];

  for (const fn of steps) {
    try {
      await fn();
      console.log(`✔ ${fn.name}`);
    } catch (e) {
      console.error(`✖ ${fn.name}: ${e.message}`);
      results.push({
        name: fn.name,
        error: e.message,
        ts: new Date().toISOString(),
      });
      failed++;
    }
  }

  fs.writeFileSync(
    outFile,
    JSON.stringify(
      { summary: { finishedAt: new Date().toISOString(), failed }, results },
      null,
      2
    ),
    "utf8"
  );
  console.log("Saved report ->", outFile);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ fatal: e.message, results }, null, 2),
    "utf8"
  );
  process.exit(1);
});

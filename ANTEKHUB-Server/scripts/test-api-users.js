// File: scripts/test-api-users.js
// Tujuan: E2E test alur user: seed alumni -> register -> login (2 skenario device) -> change email -> reset password -> logout
// ENV: BASE_URL, ADMIN_USER, ADMIN_PASS, DATABASE_URL
// Run: node scripts/test-api-users.js

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const { Client } = require("pg");
require("dotenv").config();

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API = `${BASE_URL}/api`;
const OUT_DIR = path.join(process.cwd(), "logs");
mkdirp.sync(OUT_DIR);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(OUT_DIR, `test-users-${stamp}.json`);

const ADMIN_USER = process.env.ADMIN_USER || "superadmin_7843";
const ADMIN_PASS = process.env.ADMIN_PASS || "SAdmin#7843";

const DATABASE_URL = process.env.DATABASE_URL; // e.g. postgres://user:pass@localhost:5432/db

// ====== DATA ALUMNI (sesuai permintaan) ======
const DATA = {
  alumni: {
    nama: "Adnan Fauzan",
    tempat_lahir: "Pinrang",
    tanggal_lahir: "2002-11-29",
    agama: "Islam",
    suku: "Bugis",
    bangsa: "Indonesia",
    alamat: "BTP",
    no_telp: "082134567890",
  },
  pendidikan: {
    nim: "D121201078",
    program_studi: "Teknik Informatika",
    strata: "Sarjana",
    tahun_masuk: 2020,
    lama_studi_tahun: 4,
    lama_studi_bulan: 5,
    no_alumni: "0987554",
    tanggal_lulus: "2025-02-09",
    nilai_ujian: "A",
    ipk: 3.78,
    predikat_kelulusan: "Sangat Memuaskan",
    judul_tugas_akhir: "Ini adalah ujian akhir",
    ipb: 3.4,
  },
  registerEmail: "antekhub@ftuh.online",
  password: "Afr291102!",
};

// Email baru (masih 1 domain agar Postmark sandbox enak dites)
const NEW_EMAIL = "antekhub09@ftuh.online";
const NEW_PASSWORD = "Afr291102!Z";

// ===== infra utils =====
const results = [];
let ADMIN_TOKEN = null;
let USER_TOKEN = null;

function record(name, req, res, err, expect) {
  results.push({
    name,
    expect,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.bodyDescribe || req.dataDescribe || undefined,
    },
    response: res
      ? {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
          data: res.data,
        }
      : null,
    error: err
      ? {
          message: err.message,
          code: err.code || null,
          response: err.response
            ? { status: err.response.status, data: err.response.data }
            : null,
        }
      : null,
    ts: new Date().toISOString(),
  });
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function authAdmin() {
  return { Authorization: `Bearer ${ADMIN_TOKEN}` };
}
function authUser() {
  return { Authorization: `Bearer ${USER_TOKEN}` };
}
async function http(cfg) {
  return axios({ ...cfg, validateStatus: () => true, timeout: 60000 });
}

// ===== PG helpers =====
async function one(pg, sql, params = []) {
  const { rows } = await pg.query(sql, params);
  return rows[0] || null;
}
async function getLatestToken(pg, purpose, email) {
  const q = `
    SELECT token, purpose, email, expires_at
    FROM auth_tokens
    WHERE purpose = $1 AND LOWER(email) = LOWER($2) AND used_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `;
  const { rows } = await pg.query(q, [purpose, email]);
  return rows[0]?.token || null;
}

// ===== steps =====
async function loginAdmin() {
  const req = {
    method: "POST",
    url: `${API}/auth/admin/login`,
    headers: { "Content-Type": "application/json" },
    data: { username: ADMIN_USER, password: ADMIN_PASS },
    bodyDescribe: { username: ADMIN_USER, password: "********" },
  };
  const res = await http(req);
  record("Admin login", req, res, null, "200 + token");
  assert(
    res.status === 200 && res.data?.token,
    `Admin login gagal: ${res.status}`
  );
  ADMIN_TOKEN = res.data.token;
}

async function ensureAlumniExists() {
  // cek via filter nama + strata + prodi
  const qs = `search=${encodeURIComponent(
    DATA.alumni.nama
  )}&strata=${encodeURIComponent(
    DATA.pendidikan.strata
  )}&program_studi=${encodeURIComponent(
    DATA.pendidikan.program_studi
  )}&limit=1`;
  const r1 = await http({
    method: "GET",
    url: `${API}/alumni?${qs}`,
    headers: authAdmin(),
  });
  record(
    "Cek alumni exists",
    { method: "GET", url: `${API}/alumni?${qs}`, headers: authAdmin() },
    r1,
    null,
    "200"
  );
  if (r1.status !== 200) throw new Error("Gagal cek alumni");

  const already =
    Array.isArray(r1.data?.data) &&
    r1.data.data.find((a) => {
      const dobOk = a.tanggal_lahir?.slice(0, 10) === DATA.alumni.tanggal_lahir;
      const hasNim = (a.riwayat_pendidikan || []).some(
        (p) => p.nim === DATA.pendidikan.nim
      );
      return dobOk && hasNim;
    });

  if (already) return; // sudah ada

  // create via API
  const body = {
    ...DATA.alumni,
    pendidikan: [{ ...DATA.pendidikan }],
  };
  const req = {
    method: "POST",
    url: `${API}/alumni`,
    headers: { ...authAdmin(), "Content-Type": "application/json" },
    data: body,
    bodyDescribe: {
      ...body,
      pendidikan: [{ ...body.pendidikan[0], judul_tugas_akhir: "..." }],
    },
  };
  const res = await http(req);
  record("Create alumni (seed)", req, res, null, "201");
  assert(res.status === 201, `Gagal seed alumni: ${res.status}`);
}

async function registerRequest() {
  const req = {
    method: "POST",
    url: `${API}/auth/register/request`,
    headers: { "Content-Type": "application/json" },
    data: {
      email: DATA.registerEmail,
      nim: DATA.pendidikan.nim,
      tanggal_lahir: DATA.alumni.tanggal_lahir,
    },
    bodyDescribe: {
      email: DATA.registerEmail,
      nim: DATA.pendidikan.nim,
      tanggal_lahir: DATA.alumni.tanggal_lahir,
    },
  };
  const res = await http(req);
  record("Register request", req, res, null, "200");
  assert(res.status === 200, `Register request gagal: ${res.status}`);
}

async function registerComplete(pg, opts = {}) {
  // ambil token REGISTER terakhir dari DB
  const token = await getLatestToken(pg, "REGISTER", DATA.registerEmail);
  assert(token, "Token REGISTER tidak ditemukan di DB");

  // device token untuk testing
  const device_token =
    opts.device_token ||
    `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const payload = {
    token,
    password: DATA.password,
    device_token,
    platform: opts.platform || "android",
    app_version: opts.app_version || "1.0.0",
  };

  const req = {
    method: "POST",
    url: `${API}/auth/register/complete`,
    headers: { "Content-Type": "application/json" },
    data: payload,
    bodyDescribe: { ...payload, token: "<hidden>", password: "********" },
  };

  const res = await http(req);
  record("Register complete", req, res, null, "201");
  assert([200, 201].includes(res.status), `Register complete gagal: ${res.status}`);

  // verifikasi device_token tersimpan
  const row = await one(
    pg,
    `SELECT id, user_id, token, platform, app_version
       FROM device_tokens
      WHERE token = $1
      ORDER BY id DESC LIMIT 1`,
    [device_token]
  );
  assert(row, "Device token tidak tersimpan di DB");
  return device_token;
}

async function userLoginWithDevice(pg, { device_token, platform, app_version, label }) {
  const req = {
    method: "POST",
    url: `${API}/auth/login`,
    headers: { "Content-Type": "application/json" },
    data: {
      email: DATA.registerEmail,
      password: DATA.password,
      device_token,
      platform,
      app_version,
    },
    bodyDescribe: { email: DATA.registerEmail, password: "********", device_token, platform, app_version },
  };
  const res = await http(req);
  record(`User login (${label})`, req, res, null, "200 + token");
  assert(
    res.status === 200 && res.data?.token,
    `Login user gagal (${label}): ${res.status}`
  );
  USER_TOKEN = res.data.token;

  // cek jumlah token unik di DB
  const row = await one(
    pg,
    `SELECT COUNT(*)::int AS cnt FROM device_tokens
      WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER($1))`,
    [DATA.registerEmail]
  );
  return row?.cnt || 0;
}

async function resetPasswordRequest() {
  const req = {
    method: "POST",
    url: `${API}/auth/password/reset/request`,
    headers: { "Content-Type": "application/json" },
    data: {
      email: DATA.registerEmail,
      nim: DATA.pendidikan.nim,
      tanggal_lahir: DATA.alumni.tanggal_lahir,
    },
    bodyDescribe: {
      email: DATA.registerEmail,
      nim: DATA.pendidikan.nim,
      tanggal_lahir: DATA.alumni.tanggal_lahir,
    },
  };
  const res = await http(req);
  record("Reset password request", req, res, null, "200");
  assert(res.status === 200, `Reset request gagal: ${res.status}`);
}

async function resetPasswordConfirm(pg) {
  const token = await getLatestToken(pg, "RESET", DATA.registerEmail);
  assert(token, "Token RESET tidak ditemukan");

  const req = {
    method: "POST",
    url: `${API}/auth/password/reset/confirm`,
    headers: { "Content-Type": "application/json" },
    data: { token, new_password: NEW_PASSWORD },
    bodyDescribe: { token: "<hidden>", new_password: "********" },
  };
  const res = await http(req);
  record("Reset password confirm", req, res, null, "200");
  assert(res.status === 200, `Reset confirm gagal: ${res.status}`);

  // ganti credential di memori agar login berikutnya pakai password baru
  DATA.password = NEW_PASSWORD;
}

async function changeEmailRequest() {
  const req = {
    method: "POST",
    url: `${API}/auth/change-email/request`,
    headers: { ...authUser(), "Content-Type": "application/json" },
    data: {
      new_email: NEW_EMAIL,
      nim: DATA.pendidikan.nim,
      tanggal_lahir: DATA.alumni.tanggal_lahir,
    },
    bodyDescribe: {
      new_email: NEW_EMAIL,
      nim: DATA.pendidikan.nim,
      tanggal_lahir: DATA.alumni.tanggal_lahir,
    },
  };
  const res = await http(req);
  record("Change email request", req, res, null, "200");
  assert(res.status === 200, `Change email request gagal: ${res.status}`);
}

async function changeEmailConfirm(pg) {
  const token = await getLatestToken(pg, "CHANGE_EMAIL", NEW_EMAIL);
  assert(token, "Token CHANGE_EMAIL tidak ditemukan");

  const req = {
    method: "POST",
    url: `${API}/auth/change-email/confirm`,
    headers: { "Content-Type": "application/json" },
    data: { token },
    bodyDescribe: { token: "<hidden>" },
  };
  const res = await http(req);
  record("Change email confirm", req, res, null, "200");
  assert(res.status === 200, `Change email confirm gagal: ${res.status}`);

  // update email untuk langkah berikutnya
  DATA.registerEmail = NEW_EMAIL;
}

async function logoutUser() {
  const req = {
    method: "POST",
    url: `${API}/auth/logout`,
    headers: { ...authUser(), "Content-Type": "application/json" },
    data: {},
  };
  const res = await http(req);
  record("User logout", req, res, null, "200");
  assert(res.status === 200, `Logout gagal: ${res.status}`);
}

async function logoutAdmin() {
  const req = {
    method: "POST",
    url: `${API}/auth/admin/logout`,
    headers: { ...authAdmin(), "Content-Type": "application/json" },
    data: {},
  };
  const res = await http(req);
  record("Admin logout", req, res, null, "200");
  assert(res.status === 200, `Logout admin gagal: ${res.status}`);
}

// ===== main =====
(async function main() {
  const summary = { startedAt: new Date().toISOString(), baseUrl: BASE_URL };
  let pg;
  try {
    if (!DATABASE_URL) {
      throw new Error(
        "DATABASE_URL wajib di .env untuk mengambil token dari tabel auth_tokens"
      );
    }
    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();

    // 1) Admin login & seed alumni
    await loginAdmin();
    await ensureAlumniExists();

    // 2) Register (request -> complete) + device token pertama
    await registerRequest();
    await sleep(400);
    const regDeviceToken = await registerComplete(pg, {
      platform: "android",
      app_version: "1.0.0",
    });

    // // 3) Login skenario 1: device token SAMA
    // const cntAfterSame = await userLoginWithDevice(pg, {
    //   device_token: regDeviceToken,
    //   platform: "android",
    //   app_version: "1.0.1",
    //   label: "same device",
    // });
    // console.log("🔢 Device token count (same device) =", cntAfterSame);
    // assert(cntAfterSame >= 1, "Device token tidak tercatat saat login (same)");

    // // 4) Login skenario 2: device token BERBEDA
    // const newDeviceToken = `dev_new_${Date.now()}`;
    // const cntAfterNew = await userLoginWithDevice(pg, {
    //   device_token: newDeviceToken,
    //   platform: "ios",
    //   app_version: "1.0.2",
    //   label: "new device",
    // });
    // console.log("🔢 Device token count (after new device) =", cntAfterNew);
    // assert(cntAfterNew >= 2, "Device token baru tidak tercatat saat login (new)");

    // // 5) Reset password (request -> confirm)
    // await resetPasswordRequest();
    // await sleep(400);
    // await resetPasswordConfirm(pg);

    // // 6) Logout user & admin
    // await logoutUser();
    // await logoutAdmin();

    // // 7) Change email (request -> confirm)
    // //    (User tidak perlu login lagi di test ini; jika API-mu butuh auth, login ulang dulu)
    // //    Di sini diasumsikan /auth/change-email/request butuh USER_TOKEN → login lagi cepat:
    // const relog = await http({
    //   method: "POST",
    //   url: `${API}/auth/login`,
    //   headers: { "Content-Type": "application/json" },
    //   data: { email: DATA.registerEmail, password: DATA.password },
    //   bodyDescribe: { email: DATA.registerEmail, password: "********" },
    // });
    // record("User login (for change email)", {
    //   method: "POST",
    //   url: `${API}/auth/login`,
    //   headers: { "Content-Type": "application/json" },
    //   data: { email: DATA.registerEmail, password: "********" },
    // }, relog, null, "200");
    // assert(relog.status === 200 && relog.data?.token, `Login ulang gagal: ${relog.status}`);
    // USER_TOKEN = relog.data.token;

    // await changeEmailRequest();
    // await sleep(400);
    // await changeEmailConfirm(pg);

    summary.status = "OK";
  } catch (e) {
    console.error("❌ Fatal:", e.message);
    summary.status = "FAILED";
    summary.error = e.message;
  } finally {
    if (pg) await pg.end().catch(() => {});
    summary.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      outFile,
      JSON.stringify({ summary, results }, null, 2),
      "utf8"
    );
    console.log("📝 Saved report:", outFile);
    process.exit(summary.status === "OK" ? 0 : 1);
  }
})();
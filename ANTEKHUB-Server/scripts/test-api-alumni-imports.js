// File: scripts/test-api-alumni-imports.js
// Jalankan: node scripts/test-api-alumni-imports.js
// Pastikan .env berisi BASE_URL dan kredensial admin

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const mkdirp = require("mkdirp");
require("dotenv").config();

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API = `${BASE_URL}/api`;
const IMPORT_DIR = process.env.IMPORT_DIR || path.join(process.cwd(), "Data Alumni");
const COMMIT_ALL = String(process.env.COMMIT_ALL || "true").toLowerCase() === "true";
const ONLY_SHEETS = (process.env.SHEETS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ADMIN_USER = process.env.ADMIN_USER || "superadmin_7843";
const ADMIN_PASS = process.env.ADMIN_PASS || "SAdmin#7843";

const OUT_DIR = path.join(process.cwd(), "logs");
mkdirp.sync(OUT_DIR);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(OUT_DIR, `test-alumni-imports-${stamp}.json`);

const results = [];
let TOKEN = null;

// =====================================================
// 🧾 Utility functions
// =====================================================

function record(name, req, res, err, expect) {
  results.push({
    name,
    expect,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.bodyDescribe || undefined,
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

function authHeader() {
  return { Authorization: `Bearer ${TOKEN}` };
}

async function http(cfg) {
  return axios({ ...cfg, validateStatus: () => true, timeout: 120000 });
}

// =====================================================
// 🔑 Login Admin
// =====================================================

async function login() {
  const name = "Auth: login admin";
  const req = {
    method: "POST",
    url: `${API}/auth/admin/login`,
    headers: { "Content-Type": "application/json" },
    data: { username: ADMIN_USER, password: ADMIN_PASS },
    bodyDescribe: { username: ADMIN_USER, password: "********" },
  };
  const res = await http(req);
  record(name, req, res, null, "200 + token");

  assert(res.status === 200 && res.data?.token, `Login gagal: ${res.status}`);
  TOKEN = res.data.token;
  console.log(`🔐 Login berhasil sebagai ${ADMIN_USER}`);
}

// =====================================================
// 📂 Ambil daftar file Excel
// =====================================================

function listExcelFiles(dir) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  return files
    .filter((f) => /\.(xls|xlsx)$/i.test(f))
    .map((f) => path.join(dir, f));
}

// =====================================================
// 🧩 Upload Preview File
// =====================================================

async function previewFile(filePath) {
  const name = `Preview: ${path.basename(filePath)}`;
  const form = new FormData();
  form.append("file", fs.readFileSync(filePath), path.basename(filePath));

  const req = {
    method: "POST",
    url: `${API}/alumni/imports/preview`,
    headers: { ...form.getHeaders(), ...authHeader() },
    data: form,
    bodyDescribe: { file: path.basename(filePath) },
  };

  const res = await http(req);
  record(name, req, res, null, "200");

  // ✅ Ambil run_id dari struktur response yang benar
  const payload = res.data?.data ?? res.data;
  const runId = payload?.run_id;
  const sheets = payload?.sheets;

  if (res.status !== 200) {
    throw new Error(`Preview gagal: HTTP ${res.status}`);
  }
  if (!runId) {
    throw new Error(`Preview gagal: run_id tidak ditemukan`);
  }

  console.log(`✅ Preview sukses. Run ID: ${runId}`);
  return { run_id: runId, sheets };
}

// =====================================================
// 📦 Pilih sheet untuk commit
// =====================================================

function chooseSheets(sheets) {
  let chosen = sheets.filter((s) => !s.skipped && !s.skip).map((s) => s.sheet_name);
  if (ONLY_SHEETS.length) {
    chosen = chosen.filter((n) => ONLY_SHEETS.includes(n));
  }
  return chosen;
}

// =====================================================
// 💾 Commit hasil preview
// =====================================================

async function commitSheets(run_id, sheets) {
  const name = `Commit: ${run_id} -> [${sheets.join(", ")}]`;
  const req = {
    method: "POST",
    url: `${API}/alumni/imports/${run_id}/commit`,
    headers: { ...authHeader(), "Content-Type": "application/json" },
    data: { sheets },
    bodyDescribe: { sheets },
  };
  const res = await http(req);
  record(name, req, res, null, "200");

  assert(res.status === 200, `Commit gagal: ${res.status}`);
  console.log(`✅ Commit sukses untuk run_id: ${run_id}`);
  return res.data;
}

// =====================================================
// 🚀 MAIN LOGIC
// =====================================================

async function main() {
  const all = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    apiBase: API,
  };

  try {
    await login();

    const excelFiles = listExcelFiles(IMPORT_DIR);
    if (excelFiles.length === 0) {
      console.warn(`⚠️  Tidak ada file Excel di: ${IMPORT_DIR}`);
      return;
    }

    // ✅ Hanya ambil file pertama
    const firstFile = excelFiles[0];
    console.log(`📂 Menggunakan file pertama: ${path.basename(firstFile)}`);

    try {
      const prev = await previewFile(firstFile);
      const sheets = prev.sheets || [];
      const chosen = COMMIT_ALL ? chooseSheets(sheets) : ONLY_SHEETS;

      console.log(
        `📄 File: ${path.basename(firstFile)} -> ${sheets.length} sheet (akan commit: ${chosen.length})`
      );

      if (chosen.length > 0) {
        await commitSheets(prev.run_id, chosen);
      } else {
        console.log("⏭ Tidak ada sheet yang perlu di-commit.");
      }
    } catch (err) {
      console.error(`❌ Gagal memproses ${path.basename(firstFile)}:`, err.message);
      results.push({
        name: `Error on ${path.basename(firstFile)}`,
        error: { message: err.message },
        ts: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error("❌ Fatal:", e.message);
  } finally {
    fs.writeFileSync(
      outFile,
      JSON.stringify(
        {
          summary: { ...all, finishedAt: new Date().toISOString() },
          results,
        },
        2
      ),
      "utf8"
    );
    console.log("📝 Saved report:", outFile);
  }
}


main();

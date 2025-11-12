// File: scripts/test-api-payments.js
// Jalankan: node scripts/test-api-payments.js
// ENV yang dipakai:
//   BASE_URL (default http://localhost:3000)
//   TEST_USER_EMAIL / TEST_USER_PASS (default dari seeder contoh)
//   MIDTRANS_SERVER_KEY (wajib untuk membuat signature webhook simulasi)
//   PAYMENT_DEFAULT_AMOUNT (opsional, default di server)

const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
require("dotenv").config();

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API = `${BASE_URL}/api`;
const USER_EMAIL = process.env.TEST_USER_EMAIL || "antekhub@ftuh.online";
const USER_PASS = process.env.TEST_USER_PASS || "Afr291102!";
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ""; // sandbox key

const OUT_DIR = path.join(process.cwd(), "logs");
mkdirp.sync(OUT_DIR);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(OUT_DIR, `test-payments-${stamp}.json`);

const results = [];
let TOKEN = null;

function record(name, req, res, err, expect) {
  results.push({
    name,
    expect,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.dataDescribe || req.bodyDescribe || undefined,
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
  return axios({ ...cfg, validateStatus: () => true, timeout: 60000 });
}

// 1) LOGIN user biasa
async function loginUser() {
  const req = {
    method: "POST",
    url: `${API}/auth/login`,
    headers: { "Content-Type": "application/json" },
    data: { email: USER_EMAIL, password: USER_PASS },
    dataDescribe: { email: USER_EMAIL, password: "********" },
  };
  const res = await http(req);
  record("Login user", req, res, null, "200 + token");
  assert(res.status === 200 && res.data?.token, `Login gagal: ${res.status}`);
  TOKEN = res.data.token;
}

// 2) CREATE transaksi pembayaran
async function createPayment() {
  const body = {
    tujuan_pembayaran: "Iuran", // bebas sesuai enum kamu
    // nominal: 50000, // opsional; kalau tidak diisi pakai default server
    // saluran_pembayaran_id: null // opsional
  };
  const req = {
    method: "POST",
    url: `${API}/payments`,
    headers: { ...authHeader(), "Content-Type": "application/json" },
    data: body,
    dataDescribe: body,
  };
  const res = await http(req);
  record("Create payment", req, res, null, "201");
  assert(
    res.status === 201 && res.data?.data?.order_id,
    `Create payment gagal: ${res.status}`
  );
  return res.data.data; // { order_id, nominal, snap_token, snap_redirect_url, ... }
}

// Util: Midtrans signature = sha512(order_id + status_code + gross_amount + server_key)
function buildMidtransSignature({
  order_id,
  status_code,
  gross_amount,
  server_key,
}) {
  const raw = `${order_id}${status_code}${gross_amount}${server_key}`;
  return crypto.createHash("sha512").update(raw).digest("hex");
}

// 3) SIMULATE WEBHOOK settlement (paid)
async function simulateWebhookSettlement(order_id, gross_amount) {
  if (!MIDTRANS_SERVER_KEY)
    throw new Error(
      "MIDTRANS_SERVER_KEY kosong di .env — butuh untuk simulasi webhook."
    );

  const status_code = "200";
  const signature_key = buildMidtransSignature({
    order_id,
    status_code,
    gross_amount: String(gross_amount),
    server_key: MIDTRANS_SERVER_KEY,
  });

  const payload = {
    order_id,
    status_code,
    gross_amount: String(gross_amount),
    signature_key,
    transaction_status: "settlement",
    fraud_status: "accept",
    payment_type: "bank_transfer",
    transaction_time: new Date().toISOString(),
    settlement_time: new Date().toISOString(),
    va_numbers: [{ bank: "bni", va_number: "1234567890" }],
  };

  const req = {
    method: "POST",
    url: `${API}/payments/midtrans/notify`,
    headers: { "Content-Type": "application/json" },
    data: payload,
    dataDescribe: payload,
  };
  const res = await http(req);
  record("Webhook: settlement", req, res, null, "200 {received:true}");
  assert(res.status === 200, `Webhook notify gagal: ${res.status}`);
}

// 4) GET detail transaksi by order_id
async function getPayment(order_id) {
  const req = {
    method: "GET",
    url: `${API}/payments/${encodeURIComponent(order_id)}`,
    headers: { ...authHeader() },
  };
  const res = await http(req);
  record("Get by order_id", req, res, null, "200");
  assert(
    res.status === 200 && res.data?.data?.order_id === order_id,
    `Get by order_id gagal: ${res.status}`
  );
  return res.data.data;
}

// 5) GET list transaksi user
async function getMyPayments() {
  const req = {
    method: "GET",
    url: `${API}/payments/my`,
    headers: { ...authHeader() },
  };
  const res = await http(req);
  record("My payments", req, res, null, "200");
  assert(
    res.status === 200 && Array.isArray(res.data?.data),
    `My payments gagal: ${res.status}`
  );
  return res.data.data;
}

async function main() {
  const start = new Date().toISOString();
  let failed = 0;
  try {
    await loginUser();

    const created = await createPayment();
    console.log("✅ Payment created:", {
      order_id: created.order_id,
      nominal: created.nominal,
      snap_token: created.snap_token,
    });

    // Simulasikan webhook settle (bayar sukses)
    await simulateWebhookSettlement(created.order_id, created.nominal);

    const detail = await getPayment(created.order_id);
    console.log("ℹ️  Detail sesudah webhook:", {
      status: detail.status,
      paid_at: detail.paid_at,
      settled_at: detail.settled_at,
    });

    const mine = await getMyPayments();
    console.log(`🧾 Total transaksi user: ${mine.length}`);
  } catch (e) {
    failed++;
    console.error("❌ Fatal:", e.message);
    results.push({
      name: "Fatal",
      error: { message: e.message },
      ts: new Date().toISOString(),
    });
  } finally {
    fs.writeFileSync(
      outFile,
      JSON.stringify(
        {
          summary: {
            startedAt: start,
            finishedAt: new Date().toISOString(),
            failed,
            baseUrl: BASE_URL,
          },
          results,
        },
        null,
        2
      ),
      "utf8"
    );
    console.log("📝 Saved report:", outFile);
    process.exit(failed ? 1 : 0);
  }
}

main();

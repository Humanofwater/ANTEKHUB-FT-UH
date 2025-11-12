// File: src/config/midtrans.js
const midtransClient = require("midtrans-client");

const IS_SANDBOX = String(process.env.MIDTRANS_IS_SANDBOX || "true") === "true";
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY;

if (!SERVER_KEY) {
  console.warn(
    "[midtrans] MIDTRANS_SERVER_KEY belum di-set (Sandbox tetap bisa dibuat setelah diisi)."
  );
}

const snap = new midtransClient.Snap({
  isProduction: !IS_SANDBOX,
  serverKey: SERVER_KEY,
  clientKey: CLIENT_KEY,
});

function verifyNotificationSignature({
  order_id,
  status_code,
  gross_amount,
  signature_key,
}) {
  const crypto = require("crypto");
  const raw = `${order_id}${status_code}${gross_amount}${SERVER_KEY}`;
  const expected = crypto.createHash("sha512").update(raw).digest("hex");
  return expected === signature_key;
}

module.exports = { snap, verifyNotificationSignature };

// File: src/services/paymentService.js
const { v4: uuidv4 } = require("uuid");
const dayjs = require("dayjs");
const { snap, verifyNotificationSignature } = require("../../config/midtrans");

const DEFAULT_AMOUNT = Number(process.env.PAYMENT_DEFAULT_AMOUNT || 50000);
const DEFAULT_CURRENCY = process.env.PAYMENT_CURRENCY || "IDR";
const EXPIRE_MIN = Number(process.env.PAYMENT_EXPIRE_MINUTES || 60);
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

// Midtrans → status_pembayaran_enum
function mapMidtransStatus({ transaction_status, fraud_status }) {
  // settle: paid & captured, capture: cc paid, pending, cancel, deny, expire
  switch (transaction_status) {
    case "capture":
      return fraud_status === "challenge" ? "PENDING" : "PAID";
    case "settlement":
      return "SETTLED";
    case "pending":
      return "PENDING";
    case "cancel":
      return "CANCELED";
    case "deny":
      return "FAILED";
    case "expire":
      return "EXPIRED";
    case "refund":
    case "partial_refund":
      return "PAID"; // atau bikin enum REFUNDED kalau kamu siapkan
    default:
      return "PENDING";
  }
}

function buildOrderId({ userId, purpose }) {
  // Contoh: ALUMNI-<purpose>-<YYYYMMDD>-<userId>-<random>
  const stamp = dayjs().format("YYYYMMDD-HHmmss");
  return `ALUMNI-${purpose}-${stamp}-${userId}-${uuidv4().slice(0, 8)}`;
}

async function createSnapTransaction({
  user,
  pembayaranRow,
  grossAmount,
  channelHint,
}) {
  const expiry = {
    start_time: dayjs().format("YYYY-MM-DD HH:mm:ss Z"),
    unit: "minutes",
    duration: EXPIRE_MIN,
  };

  const customerDetails = {
    first_name: user?.nama || "User",
    email: user?.email || undefined,
    // optional: phone, address
  };

  const enabled_payments = channelHint?.length ? channelHint : undefined;
  // contoh isi channelHint: ['bri_va','bni_va','qris','gopay']

  const payload = {
    transaction_details: {
      order_id: pembayaranRow.order_id,
      gross_amount: grossAmount,
    },
    customer_details: customerDetails,
    item_details: [
      {
        id: pembayaranRow.order_id,
        price: grossAmount,
        quantity: 1,
        name: pembayaranRow.tujuan_pembayaran || "Biaya Alumni",
      },
    ],
    credit_card: { secure: true },
    callbacks: {
      finish: `${APP_BASE_URL}/api/payments/finish`, // optional (browser)
      error: `${APP_BASE_URL}/api/payments/error`,
      pending: `${APP_BASE_URL}/api/payments/pending`,
    },
    expiry,
  };

  if (enabled_payments) payload.enabled_payments = enabled_payments;

  // Snap.createTransaction -> { token, redirect_url }
  return snap.createTransaction(payload);
}

module.exports = {
  mapMidtransStatus,
  buildOrderId,
  createSnapTransaction,
  verifyNotificationSignature,
};

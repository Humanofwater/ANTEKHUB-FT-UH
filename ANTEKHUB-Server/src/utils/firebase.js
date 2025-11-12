// src/utils/firebase.js
const admin = require("firebase-admin");

// ENV yang dibutuhkan:
// FIREBASE_PROJECT_ID=xxx
// FIREBASE_CLIENT_EMAIL=xxx
// FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
// (ingat: untuk .env, \n harus di-unescape jadi baris baru)

let initialized = false;

function initFirebase() {
  if (initialized) return admin;

  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.warn("[firebase] ENV belum lengkap; inisialisasi dilewati");
    return null;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    initialized = true;
    console.log("[firebase] initialized");
  } catch (e) {
    if (!/already exists/i.test(String(e))) {
      console.error("[firebase] init error:", e.message);
      return null;
    }
  }
  return admin;
}

async function sendNotification({ token, topic, title, body, data }) {
  const app = initFirebase();
  if (!app) return { skipped: true, reason: "firebase not initialized" };

  const payload = {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [k, String(v ?? "")])
    ),
  };

  try {
    if (token) {
      const res = await app.messaging().send({ token, ...payload });
      return { ok: true, id: res };
    }
    if (topic) {
      const res = await app.messaging().send({ topic, ...payload });
      return { ok: true, id: res };
    }
    return { ok: false, error: "no token/topic" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { initFirebase, sendNotification };
// File: src/controllers/auth.controller.js
// Tujuan: Auth end-to-end: Admin login, User register/confirm, change-email, reset password,
//         login/logout user. Email via Postmark; token sekali-pakai via tabel auth_tokens.

// ====== DEPENDENCIES ======
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");
const { Op } = require("sequelize");

// Models
const models = require("../models");
const { UsersAdmin, Users, DeviceToken, Alumni, PendidikanAlumni } = models;

// Services (pakai yang sudah kita buat sebelumnya)
const { sendMail, buildActionEmail } = require("../services/postmarkService");
const {
  issueToken,
  consumeToken,
  markUsed,
} = require("../services/tokenService");

// ====== ENV / CONST ======
const JWT_SECRET = process.env.JWT_SECRET || "antekhub_secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
const APP_BASE_URL =
  process.env.APP_BASE_URL || process.env.BASE_URL || "http://localhost:3000";

// ====== HELPERS ======
// Password policy: min 8, ada kecil, besar, angka, simbol
const PW_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
function validatePassword(pw) {
  return PW_POLICY.test(String(pw || ""));
}
async function hashPassword(pw) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pw, salt);
}
function signAdmin(admin) {
  return jwt.sign(
    {
      id: admin.id,
      uuid: admin.uuid,
      username: admin.username,
      role: admin.role,
      type: "admin",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}
function signUser(user) {
  return jwt.sign(
    {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      role: user.role || "User",
      type: "user",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}
async function findAlumniByNimDob({ nim, tanggal_lahir }) {
  return Alumni.findOne({
    where: { tanggal_lahir },
    include: [
      {
        model: PendidikanAlumni,
        as: "riwayat_pendidikan",
        where: { nim },
        required: true,
      },
    ],
  });
}

function inferPlatformFromUA(ua = "") {
  const s = String(ua || "");
  if (/iPhone|iPad|iPod|iOS/i.test(s)) return "ios";
  if (/Android/i.test(s)) return "android";
  if (/Windows Phone/i.test(s)) return "windows";
  return "web";
}

async function upsertDeviceToken({ userId, token, platform, appVersion }) {
  if (!token || String(token).trim().length < 5) return; // abaikan token tak valid
  const normPlat = (platform || "").toLowerCase() || "unknown";

  // cari: kombinasi user_id + token (satu perangkat per user)
  const found = await DeviceToken.findOne({
    where: { user_id: userId, token },
  });

  if (!found) {
    await DeviceToken.create({
      user_id: userId,
      token,
      platform: normPlat,
      app_version: appVersion || null,
    });
  } else {
    // update metadata kalau berubah
    const patch = {};
    if (normPlat && found.platform !== normPlat) patch.platform = normPlat;
    if (appVersion && found.app_version !== appVersion)
      patch.app_version = appVersion;
    if (Object.keys(patch).length) {
      await found.update(patch);
    }
  }
}

// ====================================================================
// ADMIN AUTH
// ====================================================================
exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res
        .status(400)
        .json({ message: "Username dan password wajib diisi." });

    const admin = await UsersAdmin.findOne({ where: { username } });
    if (!admin)
      return res.status(404).json({ message: "Akun admin tidak ditemukan." });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ message: "Password salah." });

    const token = signAdmin(admin);
    return res.status(200).json({
      message: "Login berhasil.",
      token,
      admin: { uuid: admin.uuid, username: admin.username, role: admin.role },
    });
  } catch (err) {
    console.error("loginAdmin error:", err);
    return res
      .status(500)
      .json({ message: "Terjadi kesalahan server.", detail: err.message });
  }
};

exports.logoutAdmin = async (req, res) => {
  try {
    // JWT stateless: cukup hapus token di klien. Endpoint ini hanya konfirmasi.
    // Jika suatu saat butuh blacklist, tambahkan tabel revocation lalu catat jti di sini.
    return res
      .status(200)
      .json({ message: "Logout admin berhasil (hapus token di klien)" });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Gagal logout admin", detail: e.message });
  }
};

exports.me = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.type === "admin") {
      const admin = await UsersAdmin.findByPk(req.user.id);
      if (!admin)
        return res.status(404).json({ message: "Admin tidak ditemukan" });
      return res.status(200).json({
        admin: {
          uuid: admin.uuid,
          username: admin.username,
          role: admin.role,
        },
      });
    }
    if (req.user.type === "user") {
      const user = await Users.findByPk(req.user.id);
      if (!user)
        return res.status(404).json({ message: "User tidak ditemukan" });
      return res.status(200).json({
        user: {
          uuid: user.uuid,
          email: user.email,
          nama: user.nama,
          role: user.role,
        },
      });
    }
    return res.status(400).json({ message: "Invalid token type" });
  } catch (err) {
    console.error("auth.me error:", err);
    return res.status(500).json({ message: "Terjadi kesalahan server." });
  }
};

// ====================================================================
// USER REGISTER (REQUEST LINK) -> COMPLETE
// ====================================================================
exports.registerRequest = async (req, res) => {
  try {
    const { email, nim, tanggal_lahir } = req.body || {};
    if (!email || !nim || !tanggal_lahir)
      return res
        .status(400)
        .json({ message: "email, nim, dan tanggal_lahir wajib diisi" });

    const alumni = await findAlumniByNimDob({ nim, tanggal_lahir });
    if (!alumni)
      return res
        .status(404)
        .json({ message: "Alumni tidak ditemukan / data tidak cocok" });

    const existUser = await Users.findOne({
      where: { email: email.toLowerCase() },
    });
    if (existUser)
      return res.status(409).json({ message: "Email sudah terdaftar" });

    const rec = await issueToken(models, {
      purpose: "REGISTER",
      email,
      alumniId: alumni.id,
      ttlMinutes: 60,
      meta: { nim },
    });

    const link = `${APP_BASE_URL}/auth/complete?token=${encodeURIComponent(
      rec.token
    )}`;
    const html = buildActionEmail({
      title: "Verifikasi Pendaftaran Akun",
      greeting: `Halo ${alumni.nama || "Alumni"},`,
      bodyLines: [
        `Kami menerima permintaan pendaftaran menggunakan email <b>${email}</b>.`,
        `Token berlaku sampai <b>${dayjs(rec.expires_at).format(
          "DD MMM YYYY HH:mm"
        )}</b>.`,
      ],
      buttonText: "Selesaikan Pendaftaran",
      actionUrl: link,
    });

    await sendMail({
      to: email,
      subject: "AntekHub – Verifikasi Pendaftaran",
      html,
    });
    return res
      .status(200)
      .json({ message: "Link verifikasi dikirim", expires_at: rec.expires_at });
  } catch (e) {
    console.error("[registerRequest] error:", e);
    return res
      .status(500)
      .json({ message: "Gagal memproses permintaan", detail: e.message });
  }
};

exports.registerComplete = async (req, res) => {
  const t = await models.sequelize.transaction();
  try {
    const {
      token,
      password = {},
      device_token,
      platform = "unknown",
      app_version = null,
    } = req.body || {};

    if (!token || !password)
      return res
        .status(400)
        .json({ message: "token dan password wajib diisi" });
    if (!validatePassword(password))
      return res.status(422).json({
        message:
          "Password tidak memenuhi kebijakan (min 8; kecil/besar/angka/simbol)",
      });

    const rec = await consumeToken(models, token, "REGISTER");
    const alumni = await Alumni.findByPk(rec.alumni_id);
    if (!alumni)
      throw Object.assign(new Error("Alumni terkait token tidak ditemukan"), {
        code: 404,
      });

    const exist = await Users.findOne({
      where: { email: rec.email.toLowerCase() },
    });
    if (exist)
      throw Object.assign(new Error("Email sudah terdaftar"), { code: 409 });

    const pwHash = await hashPassword(password);
    const user = await Users.create(
      {
        email: rec.email.toLowerCase(),
        password: pwHash,
        nama: alumni.nama,
        role: "User",
      },
      { transaction: t }
    );

    await markUsed(models, rec, user.id, t);

    // Tambahkan device_token jika tersedia
    if (device_token) {
      await models.DeviceToken.create(
        {
          user_id: user.id,
          token: device_token,
          platform,
          app_version,
          last_seen_at: new Date(),
          is_active: true,
        },
        { transaction: t }
      );
    }

    await t.commit();

    return res.status(201).json({
      message: "Pendaftaran berhasil",
      data: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        nama: user.nama,
      },
    });
  } catch (e) {
    await t.rollback();
    const code = e.code && Number.isInteger(e.code) ? e.code : 500;
    return res
      .status(code)
      .json({ message: "Gagal menyelesaikan pendaftaran", detail: e.message });
  }
};

// ====================================================================
// USER CHANGE EMAIL (REQUEST) -> CONFIRM
// ====================================================================
exports.changeEmailRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { new_email, nim, tanggal_lahir } = req.body || {};
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });
    if (!new_email || !nim || !tanggal_lahir)
      return res
        .status(400)
        .json({ message: "new_email, nim, tanggal_lahir wajib" });

    const targetExists = await Users.findOne({
      where: { email: new_email.toLowerCase() },
    });
    if (targetExists)
      return res.status(409).json({ message: "Email baru sudah dipakai" });

    const alumni = await findAlumniByNimDob({ nim, tanggal_lahir });
    if (!alumni)
      return res.status(404).json({ message: "Data alumni tidak cocok" });

    const rec = await issueToken(models, {
      purpose: "CHANGE_EMAIL",
      email: new_email,
      userId,
      alumniId: alumni.id,
      ttlMinutes: 60,
      meta: { new_email },
    });

    const link = `${APP_BASE_URL}/auth/change-email/confirm?token=${encodeURIComponent(
      rec.token
    )}`;
    const html = buildActionEmail({
      title: "Konfirmasi Perubahan Email",
      greeting: "Halo,",
      bodyLines: [
        `Permintaan perubahan email ke <b>${new_email}</b>. Klik tombol di bawah untuk konfirmasi.`,
      ],
      buttonText: "Konfirmasi Email Baru",
      actionUrl: link,
    });

    await sendMail({
      to: new_email,
      subject: "AntekHub – Konfirmasi Perubahan Email",
      html,
    });
    return res.status(200).json({
      message: "Email konfirmasi telah dikirim",
      expires_at: rec.expires_at,
    });
  } catch (e) {
    console.error("[changeEmailRequest] error:", e);
    return res
      .status(500)
      .json({ message: "Gagal memproses", detail: e.message });
  }
};

exports.changeEmailConfirm = async (req, res) => {
  const t = await models.sequelize.transaction();
  try {
    const { token } = req.body || {};
    if (!token) {
      await t.rollback();
      return res.status(400).json({ message: "token wajib" });
    }

    const rec = await consumeToken(models, token, "CHANGE_EMAIL", {
      transaction: t,
    });

    const user = await Users.findByPk(rec.user_id, { transaction: t });
    if (!user)
      throw Object.assign(new Error("User tidak ditemukan"), { code: 404 });

    const newEmail = (rec.meta?.new_email || rec.email || "").toLowerCase();
    if (!newEmail)
      throw Object.assign(new Error("Email baru tidak valid"), { code: 400 });

    const exist = await Users.findOne({
      where: { email: newEmail, id: { [Op.ne]: user.id } },
      transaction: t,
    });
    if (exist)
      throw Object.assign(new Error("Email baru sudah digunakan"), {
        code: 409,
      });

    user.email = newEmail;
    await user.save({ transaction: t });

    await markUsed(models, rec, user.id, t);

    await t.commit();

    return res.status(200).json({
      message: "Email berhasil diubah",
      data: { id: user.id, email: user.email },
    });
  } catch (e) {
    await t.rollback();
    const code = e.code && Number.isInteger(e.code) ? e.code : 500;
    return res.status(code).json({
      message: "Gagal konfirmasi email",
      detail: e.message,
    });
  }
};

// ====================================================================
// USER RESET PASSWORD (REQUEST) -> CONFIRM
// ====================================================================
exports.resetPasswordRequest = async (req, res) => {
  try {
    const { email, nim, tanggal_lahir } = req.body || {};
    if (!email || !nim || !tanggal_lahir)
      return res
        .status(400)
        .json({ message: "email, nim, tanggal_lahir wajib" });

    const user = await Users.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    const alumni = await findAlumniByNimDob({ nim, tanggal_lahir });
    if (!alumni)
      return res.status(404).json({ message: "Data alumni tidak cocok" });

    const rec = await issueToken(models, {
      purpose: "RESET",
      email: user.email,
      userId: user.id,
      alumniId: alumni.id,
      ttlMinutes: 60,
    });

    const link = `${APP_BASE_URL}/auth/reset/confirm?token=${encodeURIComponent(
      rec.token
    )}`;
    const html = buildActionEmail({
      title: "Reset Password Akun",
      greeting: `Halo ${user.nama || ""},`,
      bodyLines: [
        `Kami menerima permintaan reset password untuk akun <b>${user.email}</b>.`,
        `Token berlaku sampai <b>${dayjs(rec.expires_at).format(
          "DD MMM YYYY HH:mm"
        )}</b>.`,
      ],
      buttonText: "Atur Ulang Password",
      actionUrl: link,
    });

    await sendMail({
      to: user.email,
      subject: "AntekHub – Reset Password",
      html,
    });
    return res.status(200).json({
      message: "Link reset telah dikirim",
      expires_at: rec.expires_at,
    });
  } catch (e) {
    console.error("[resetPasswordRequest] error:", e);
    return res
      .status(500)
      .json({ message: "Gagal memproses", detail: e.message });
  }
};

exports.resetPasswordConfirm = async (req, res) => {
  const transaction = await models.sequelize.transaction();
  try {
    const { token, new_password } = req.body || {};
    if (!token || !new_password)
      return res.status(400).json({ message: "token dan new_password wajib" });
    if (!validatePassword(new_password))
      return res
        .status(422)
        .json({ message: "Password tidak memenuhi kebijakan" });

    const rec = await consumeToken(models, token, "RESET", {
      transaction: transaction,
    });
    const user = await Users.findByPk(rec.user_id);
    if (!user)
      throw Object.assign(new Error("User tidak ditemukan"), { code: 404 });

    user.password = await hashPassword(new_password);
    await user.save();
    await markUsed(models, rec, user.id, transaction);
    await transaction.commit();
    return res.status(200).json({ message: "Password berhasil diubah" });
  } catch (e) {
    const code = e.code && Number.isInteger(e.code) ? e.code : 500;
    return res
      .status(code)
      .json({ message: "Gagal reset password", detail: e.message });
  }
};

// ====================================================================
// USER LOGIN / LOGOUT
// ====================================================================
exports.loginUser = async (req, res) => {
  try {
    const { email, password, device_token, platform, app_version } =
      req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email dan password wajib diisi" });
    }

    const user = await Users.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok)
      return res.status(401).json({ message: "Email atau password salah" });

    // deteksi platform jika tidak dikirim
    const ua = req.headers["user-agent"] || "";
    const platformFinal = platform || inferPlatformFromUA(ua);

    // simpan / update device token bila ada
    if (device_token) {
      try {
        await upsertDeviceToken({
          userId: user.id,
          token: device_token,
          platform: platformFinal,
          appVersion: app_version,
        });
      } catch (e) {
        // jangan gagalkan login kalau penyimpanan device token gagal
        console.warn("[loginUser] warn: gagal simpan device_token:", e.message);
      }
    }

    const token = signUser(user);
    return res.status(200).json({
      message: "Login berhasil",
      token,
      user: {
        uuid: user.uuid,
        email: user.email,
        nama: user.nama,
        role: user.role || "User",
      },
    });
  } catch (e) {
    console.error("[loginUser] error:", e);
    return res.status(500).json({ message: "Gagal login", detail: e.message });
  }
};

// Logout stateless (JWT) → klien cukup hapus token. Jika perlu blacklist, tambahkan tabel revocation.
exports.logoutUser = async (_req, res) => {
  try {
    return res
      .status(200)
      .json({ message: "Logout berhasil (hapus token di klien)" });
  } catch (e) {
    return res.status(500).json({ message: "Gagal logout", detail: e.message });
  }
};

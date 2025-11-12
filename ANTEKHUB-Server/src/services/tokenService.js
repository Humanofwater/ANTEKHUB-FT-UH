// File: src/services/tokenService.js
// Tujuan: generate, simpan, dan konsumsi token sekali-pakai (REGISTER/RESET/CHANGE_EMAIL)
const crypto = require("crypto");
const { Op } = require("sequelize");

function createRandomToken(len = 48) {
  return crypto.randomBytes(len).toString("hex");
}

async function issueToken(
  models,
  { purpose, email, alumniId = null, userId = null, ttlMinutes = 60, meta = {} }
) {
  const token = createRandomToken(24);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  return models.AuthToken.create({
    token,
    purpose,
    email: String(email).toLowerCase(),
    user_id: userId || null,
    alumni_id: alumniId || null,
    expires_at: expiresAt,
    meta,
  });
}

async function consumeToken(
  models,
  token,
  expectedPurpose,
  { transaction } = {}
) {
  const rec = await models.AuthToken.findOne({
    where: {
      token,
      used_at: null,
      expires_at: { [Op.gt]: new Date() },
      ...(expectedPurpose ? { purpose: expectedPurpose } : {}),
    },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined, // FOR UPDATE
  });
  if (!rec) {
    const err = new Error("Token tidak ditemukan / sudah dipakai / kadaluarsa");
    err.code = 404;
    throw err;
  }
  return rec;
}

async function markUsed(models, rec, usedByUserId = null, transaction) {
  rec.used_at = new Date();
  rec.used_by_user_id = usedByUserId || null;
  await rec.save({ transaction });
}

module.exports = { issueToken, consumeToken, markUsed };

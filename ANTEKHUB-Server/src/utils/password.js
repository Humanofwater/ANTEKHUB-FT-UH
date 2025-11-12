// File: src/utils/password.js
const bcrypt = require("bcryptjs");

const POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function validatePassword(pw) {
  return POLICY.test(String(pw || ""));
}
async function hashPassword(pw) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pw, salt);
}

module.exports = { validatePassword, hashPassword };

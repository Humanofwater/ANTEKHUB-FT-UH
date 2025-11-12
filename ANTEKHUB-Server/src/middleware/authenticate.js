// File: src/middleware/authenticate.js
// Tujuan: Middleware JWT authentication
// Catatan: Pastikan ada process.env.JWT_SECRET

const jwt = require('jsonwebtoken');
const { UsersAdmin, Users } = require('../models');

module.exports = async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token tidak ditemukan' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'supersecret_fallback';

    // Verifikasi token
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({ message: 'Token tidak valid atau kedaluwarsa' });
    }

    // Struktur payload token yang diharapkan:
    // { id, type: 'admin' | 'user', role, email, exp, iat }
    if (!decoded || !decoded.id || !decoded.type) {
      return res.status(401).json({ message: 'Token tidak lengkap' });
    }

    let account = null;

    if (decoded.type === 'admin') {
      account = await UsersAdmin.findByPk(decoded.id);
      if (!account) {
        return res.status(401).json({ message: 'Admin tidak ditemukan' });
      }
      req.user = {
        id: account.id,
        uuid: account.uuid,
        username: account.username,
        role: account.role,
        type: 'admin'
      };
    } else if (decoded.type === 'user') {
      account = await Users.findByPk(decoded.id);
      if (!account) {
        return res.status(401).json({ message: 'User tidak ditemukan' });
      }
      req.user = {
        id: account.id,
        uuid: account.uuid,
        email: account.email,
        role: account.role || 'USER',
        type: 'user'
      };
    } else {
      return res.status(401).json({ message: 'Jenis akun tidak dikenali' });
    }

    next();
  } catch (err) {
    console.error('Authenticate error:', err);
    return res.status(401).json({ message: 'Autentikasi gagal' });
  }
};

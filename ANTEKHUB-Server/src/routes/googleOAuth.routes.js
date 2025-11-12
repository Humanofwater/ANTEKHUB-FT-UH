// Tujuan: Integrasi OAuth2 Google Drive dengan refresh token (redirect URI disesuaikan)

const express = require('express');
const router = express.Router();
const {
  generateAuthUrl,
  exchangeCodeForToken,
  TOKEN_PATH
} = require('../services/googleDrive');

// ✅ GET /api/google-o2auth → Redirect user ke consent screen Google
router.get('/', (req, res) => {
  try {
    const url = generateAuthUrl();
    console.log('Redirecting to Google OAuth URL:', url);
    return res.redirect(url);
  } catch (error) {
    console.error('Error saat membuat OAuth URL:', error);
    return res.status(500).json({ message: 'Gagal membuat URL OAuth Google' });
  }
});

// ✅ GET /api/google-o2auth/callback → Terima kode, tukar dengan refresh token
router.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Authorization code tidak ditemukan di query.');
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    console.log('✅ OAuth Token berhasil disimpan di:', TOKEN_PATH);
    return res.send(`
      <h3>🎉 Autentikasi Google Drive berhasil!</h3>
      <p>Token berhasil disimpan di: <code>${TOKEN_PATH}</code></p>
      <p>Refresh Token: <code>${tokens.refresh_token || '(tidak tersedia)'}</code></p>
      <p>Anda dapat menutup halaman ini sekarang.</p>
    `);
  } catch (error) {
    console.error('❌ Gagal menukar authorization code:', error);
    return res.status(500).send(`
      <h3>❌ Gagal mendapatkan token Google:</h3>
      <pre>${error.message}</pre>
    `);
  }
});

module.exports = router;

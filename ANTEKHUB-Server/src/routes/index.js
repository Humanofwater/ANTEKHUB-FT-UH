// File: src/routes/index.js
const express = require('express');
const router = express.Router();

// Import setiap route module
const authRoutes = require('./auth.routes');
const userAdminRoutes = require('./usersAdmin.routes');
const alumniRoutes = require('./alumni.routes');
const googleOAuthRoutes = require('./googleOAuth.routes');
const infoAlumniRoutes = require('./infoAlumni.routes');
const bangsaRoutes = require('./bangsa.routes');
const provinsiRoutes = require('./provinsi.routes');
const kabupaten_kotaRoutes = require('./kabupaten_kota.routes');
const sukuRoutes = require('./suku.routes');
const programStudiRoutes = require('./program_studi.routes');
const alumniImportsRoutes = require('./alumniImports.routes');
const bankRoutes = require('./bank.routes');
const metodePembayaranRoutes = require('./metode_pembayaran.routes');
const saluranPembayaranRoutes = require('./saluran_pembayaran.routes');
const rekeningRoutes = require('./rekening.routes');
const bidangIndustriRoutes = require('./bidang_industri.routes');
const JenisInstitusiRoutes = require('./jenis_institusi.routes');
const referensiJabatanRoutes = require('./referensi_jabatan.routes');
const referensiPerusahaanRoutes = require('./referensi_perusahaan.routes');
const paymentsRoutes = require('./payments.routes');
const usersProfileRoutes = require('./users_profile.routes');

// Mounting
router.use('/google-o2auth', googleOAuthRoutes); // => /api/google-o2auth dan /api/google-o2auth/callback
router.use('/auth', authRoutes);
router.use('/user-admin', userAdminRoutes);
router.use('/alumni', alumniRoutes);
router.use('/alumni', alumniImportsRoutes);
router.use('/info', infoAlumniRoutes);
router.use('/negara', bangsaRoutes);
router.use('/provinsi', provinsiRoutes);
router.use('/kabupaten-kota', kabupaten_kotaRoutes);
router.use('/suku', sukuRoutes);
router.use('/program-studi', programStudiRoutes);
router.use('/bank', bankRoutes);
router.use('/metode-pembayaran', metodePembayaranRoutes);
router.use('/saluran-pembayaran', saluranPembayaranRoutes);
router.use('/rekening', rekeningRoutes);
router.use('/bidang-industri', bidangIndustriRoutes);
router.use('/jenis-institusi', JenisInstitusiRoutes);
router.use('/referensi-jabatan', referensiJabatanRoutes);
router.use('/referensi-perusahaan', referensiPerusahaanRoutes);
router.use('/payments', paymentsRoutes);
router.use('/users-profile', usersProfileRoutes);
// Tambahkan route lain di sini ke depannya:
// router.use('/alumni', alumniRoutes);
// router.use('/pendidikan', pendidikanRoutes);

module.exports = router;
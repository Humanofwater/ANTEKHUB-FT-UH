// File: src/routes/bangsa.routes.js
const express = require('express');
const ctrl = require('../controllers/bangsa.controller');
const provinsiCtrl = require('../controllers/provinsi.controller');
const kabkotaCtrl = require('../controllers/kabupaten_kota.controller');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const rateLimit = require('express-rate-limit');

const writeLimiter = rateLimit({ windowMs: 10 * 1000, max: 20 });

const router = express.Router({ mergeParams: true });

// Semua endpoint butuh autentikasi
router.use(authenticate);

// CREATE → Admin & Super Admin
router.post('/', authorizeRoles('Admin', 'Super Admin'), writeLimiter, ctrl.add);

// READ ALL (master: tanpa limit/pagination) → semua user terautentikasi
router.get('/', ctrl.getAll);

// GET semua provinsi berdasarkan UUID negara (bangsa)
router.get('/:bangsa_uuid/provinsi', provinsiCtrl.getAllByBangsaUuid);

// === KABUPATEN/KOTA ===
// 1) Semua kab/kota milik negara (melalui join via provinsi)
router.get('/:bangsa_uuid/kabupaten-kota', kabkotaCtrl.getAllByBangsaUuid);

// 2) Semua kab/kota milik satu provinsi *dan* validasi memang milik negara tsb
router.get('/:bangsa_uuid/provinsi/:provinsi_uuid/kabupaten-kota', kabkotaCtrl.getAllByBangsaAndProvinsiUuid);

// READ ONE → semua user terautentikasi
router.get('/:uuid', ctrl.getOne);

// UPDATE → Admin & Super Admin
router.patch('/:uuid', authorizeRoles('Admin', 'Super Admin'), ctrl.updateByUuid);

// DELETE ALL (berbahaya) → Super Admin
router.delete('/__all', authorizeRoles('Super Admin'), ctrl.deleteAll);

// DELETE single / batch → Super Admin
router.delete('/:uuid', authorizeRoles('Super Admin'), ctrl.deleteByUuid);
router.delete('/', authorizeRoles('Super Admin'), ctrl.deleteByUuid);

module.exports = router;

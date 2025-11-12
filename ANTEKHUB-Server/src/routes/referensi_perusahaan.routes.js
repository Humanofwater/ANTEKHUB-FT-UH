// File: src/routes/referensi_perusahaan.routes.js
// Tujuan: Routing CRUD "ReferensiPerusahaan" (gaya mengikuti bangsa.routes)
// Catatan: seluruh filter getAll via req.query (bukan params)

const express = require('express');
const ctrl = require('../controllers/referensi_perusahaan.controller');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const rateLimit = require('express-rate-limit');

const writeLimiter = rateLimit({ windowMs: 10 * 1000, max: 20 });
const router = express.Router({ mergeParams: true });

// Semua endpoint butuh autentikasi
router.use(authenticate);

// CREATE → Admin & Super Admin
router.post('/', authorizeRoles('Admin', 'Super Admin'), writeLimiter, ctrl.add);

// READ ALL (master: tanpa pagination; semua filter via query)
router.get('/', ctrl.getAll);

// READ ONE
router.get('/:uuid', ctrl.getOne);

// UPDATE → Admin & Super Admin
router.patch('/:uuid', authorizeRoles('Admin', 'Super Admin'), ctrl.updateByUuid);

// DELETE ALL → Super Admin
router.delete('/__all', authorizeRoles('Super Admin'), ctrl.deleteAll);

// DELETE single/batch → Super Admin
router.delete('/:uuid', authorizeRoles('Super Admin'), ctrl.deleteByUuid);
router.delete('/', authorizeRoles('Super Admin'), ctrl.deleteByUuid);

module.exports = router;

/*
Contoh kueri:
GET /api/referensi-perusahaan?search=bni
GET /api/referensi-perusahaan?bangsa_uuid=UUID-NEGARA
GET /api/referensi-perusahaan?bangsa_uuid=UUID-NEGARA&provinsi_uuid=UUID-PROV
GET /api/referensi-perusahaan?bangsa_uuid=UUID-NEGARA&provinsi_uuid=UUID-PROV&kabupaten_uuid=UUID-KAB
GET /api/referensi-perusahaan?jenis_institusi_uuid=UUID-JENIS
GET /api/referensi-perusahaan?bidang_industri_uuid=UUID-BIDANG
GET /api/referensi-perusahaan?alias=ALI1&alias=ALI2
// Semua filter di atas dapat dikombinasikan (AND).
*/

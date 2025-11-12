// File: src/routes/saluran_pembayaran.routes.js
// Tujuan: Routing CRUD "SaluranPembayaran" (gaya seperti provinsi.routes)

const express = require('express');
const ctrl = require('../controllers/saluran_pembayaran.controller');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const rateLimit = require('express-rate-limit');

const router = express.Router({ mergeParams: true });
const writeLimiter = rateLimit({ windowMs: 10 * 1000, max: 20 });

// Semua endpoint butuh autentikasi
router.use(authenticate);

// CREATE → Admin, Super Admin
router.post('/', authorizeRoles('Admin', 'Super Admin'), writeLimiter, ctrl.add);

// READ ALL (tanpa pagination)
router.get('/', ctrl.getAll);

// READ ONE
router.get('/:uuid', ctrl.getOne);

// UPDATE → Admin, Super Admin
router.patch('/:uuid', authorizeRoles('Admin', 'Super Admin'), ctrl.updateByUuid);

// DELETE ALL → Super Admin
router.delete('/__all', authorizeRoles('Super Admin'), ctrl.deleteAll);

// DELETE single/batch → Super Admin
router.delete('/:uuid', authorizeRoles('Super Admin'), ctrl.deleteByUuid);
router.delete('/', authorizeRoles('Super Admin'), ctrl.deleteByUuid);

module.exports = router;
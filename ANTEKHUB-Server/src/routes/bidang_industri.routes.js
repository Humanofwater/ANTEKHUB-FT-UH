// File: src/routes/bidang_industri.routes.js
// Tujuan: Routing CRUD untuk master "BidangIndustri"

const express = require('express');
const ctrl = require('../controllers/bidang_industri.controller');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const rateLimit = require('express-rate-limit');

const writeLimiter = rateLimit({ windowMs: 10 * 1000, max: 20 });
const router = express.Router({ mergeParams: true });

// Semua endpoint butuh autentikasi
router.use(authenticate);

// CREATE → Admin & Super Admin
router.post('/', authorizeRoles('Admin', 'Super Admin'), writeLimiter, ctrl.add);

// READ ALL (master: tanpa pagination)
router.get('/', ctrl.getAll);

// READ ONE
router.get('/:uuid', ctrl.getOne);

// UPDATE → Admin & Super Admin
router.patch('/:uuid', authorizeRoles('Admin', 'Super Admin'), ctrl.updateByUuid);

// DELETE ALL → Super Admin
router.delete('/__all', authorizeRoles('Super Admin'), ctrl.deleteAll);

// DELETE single / batch → Super Admin
router.delete('/:uuid', authorizeRoles('Super Admin'), ctrl.deleteByUuid);
router.delete('/', authorizeRoles('Super Admin'), ctrl.deleteByUuid);

module.exports = router;

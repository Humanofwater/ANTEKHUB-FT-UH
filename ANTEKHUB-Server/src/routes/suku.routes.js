// File: src/routes/suku.routes.js
// Tujuan: Routing CRUD untuk master table "Suku"

const express = require('express');
const ctrl = require('../controllers/suku.controller');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const writeLimiter = rateLimit({ windowMs: 10 * 1000, max: 20 });

// Semua endpoint butuh autentikasi
router.use(authenticate);

// CREATE
router.post('/', authorizeRoles('Admin', 'Super Admin'), writeLimiter, ctrl.add);

// READ ALL (tanpa pagination)
router.get('/', ctrl.getAll);

// GET satu data suku by UUID
router.get('/:uuid', ctrl.getOne);

// UPDATE by UUID
router.patch('/:uuid', authorizeRoles('Admin', 'Super Admin'), ctrl.updateByUuid);

// DELETE semua data (hanya Super Admin)
router.delete('/__all', authorizeRoles('Super Admin'), ctrl.deleteAll);

// DELETE by UUID
router.delete('/:uuid', authorizeRoles('Super Admin'), ctrl.deleteByUuid);

module.exports = router;

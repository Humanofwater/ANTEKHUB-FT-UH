// File: src/routes/program_studi.routes.js
// Tujuan: Routing CRUD untuk master table "ProgramStudi"

const express = require('express');
const ctrl = require('../controllers/program_studi.controller');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const writeLimiter = rateLimit({ windowMs: 10 * 1000, max: 20 });

// Semua endpoint butuh autentikasi kecuali GET
router.use((req, res, next) => {
  if (req.method === 'GET') return next();
  return authenticate(req, res, next);
});

// CREATE (Admin, Super Admin) — add diletakkan paling atas sesuai permintaan
router.post('/', authorizeRoles('Admin', 'Super Admin'), writeLimiter, ctrl.add);

// READ ALL (tanpa pagination)
router.get('/', ctrl.getAll);

// READ ONE by UUID
router.get('/:uuid', ctrl.getOne);

// UPDATE by UUID
router.patch('/:uuid', authorizeRoles('Admin', 'Super Admin'), ctrl.updateByUuid);

// DELETE ALL (Super Admin)
router.delete('/__all', authorizeRoles('Super Admin'), ctrl.deleteAll);

// DELETE single/batch
router.delete('/:uuid', authorizeRoles('Super Admin'), ctrl.deleteByUuid);
router.delete('/', authorizeRoles('Super Admin'), ctrl.deleteByUuid);

module.exports = router;

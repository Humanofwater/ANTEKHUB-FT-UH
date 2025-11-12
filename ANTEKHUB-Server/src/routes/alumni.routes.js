// File: src/routes/alumni.routes.js
const express = require('express');
const ctrl = require('../controllers/alumni.controller');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const rateLimit = require('express-rate-limit');

const writeLimiter = rateLimit({ windowMs: 10 * 1000, max: 20 });

const router = express.Router();

router.use(authenticate);

// CREATE → hanya 'Super Admin' & 'Admin'
router.post('/', authenticate, authorizeRoles('Admin','Super Admin'), writeLimiter, ctrl.add);

// READ ALL (pagination, filter, search) → Admin & Super Admin
router.get('/', authorizeRoles('Admin', 'Super Admin'), ctrl.getAll);

// READ ONE → Admin & Super Admin
router.get('/:uuid', authorizeRoles('Admin', 'Super Admin'), ctrl.getOne);

// UPDATE (parsial + pendidikan dinamis) → Admin & Super Admin
router.patch('/:uuid', authorizeRoles('Admin', 'Super Admin'), ctrl.updateByUuid);

// DELETE ALL → Super Admin (sangat berbahaya)
router.delete('/__all', authorizeRoles('Super Admin'), ctrl.deleteAll);

// DELETE single / batch → Super Admin saja
router.delete('/:uuid', authorizeRoles('Super Admin'), ctrl.deleteByUuid);
router.delete('/', authorizeRoles('Super Admin'), ctrl.deleteByUuid);


module.exports = router;

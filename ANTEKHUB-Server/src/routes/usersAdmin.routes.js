// File: src/routes/userAdmin.routes.js
const express = require('express');
const ctrl = require('../controllers/usersAdmin.controller');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const router = express.Router();

router.use(authenticate);

// CREATE admin → hanya Super Admin
router.post('/', authorizeRoles('Super Admin'), ctrl.add);

// READ ALL → Admin & Super Admin
router.get('/', authorizeRoles('Admin', 'Super Admin'), ctrl.getAll);

// READ ONE → Admin & Super Admin
router.get('/:uuid', authorizeRoles('Admin', 'Super Admin'), ctrl.getOne);

// UPDATE → hanya Super Admin
router.patch('/:uuid', authorizeRoles('Super Admin'), ctrl.updateByUuid);

// DELETE ALL (sangat berbahaya) → Super Admin
router.delete('/__all', authorizeRoles('Super Admin'), ctrl.deleteAll);

// DELETE single / batch (param :uuid bisa koma-separated, atau body { uuids: [] }) → Super Admin
router.delete('/:uuid', authorizeRoles('Super Admin'), ctrl.deleteByUuid);
router.delete('/', authorizeRoles('Super Admin'), ctrl.deleteByUuid);


module.exports = router;
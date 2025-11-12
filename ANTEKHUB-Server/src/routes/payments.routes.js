// File: src/routes/payments.routes.js
const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const ctrl = require('../controllers/payments.controller');

const router = express.Router();

// webhook (tidak perlu auth; diamankan oleh signature)
router.post('/midtrans/notify', express.json({ type: '*/*' }), ctrl.notify);

// user harus login
router.use(authenticate);

// inisiasi pembayaran (user biasa boleh)
router.post('/', ctrl.create);

// daftar transaksi saya
router.get('/my', ctrl.myList);

// detail berdasarkan orderId
router.get('/:orderId', ctrl.getByOrderId);


module.exports = router;
// File: src/routes/auth.routes.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const ctrl = require("../controllers/auth.controller");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");

const router = express.Router();

// Rate limit dasar untuk endpoint tulis
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// =====================
// ADMIN AUTH (WEB)
// =====================
router.post("/admin/login", writeLimiter, ctrl.loginAdmin);

// Semua endpoint admin selanjutnya harus terautentikasi + role admin
router.post(
  "/admin/logout",
  authenticate,
  authorizeRoles("Admin", "Super Admin"),
  ctrl.logoutAdmin
);

// =====================
// SIAPA SAYA (ADMIN/USER)
// =====================
router.get("/me", authenticate, ctrl.me);

// =====================
// USER AUTH (MOBILE/WEB APP)
// =====================

// Register via email link
router.post("/register/request", writeLimiter, ctrl.registerRequest);
router.post("/register/complete", writeLimiter, ctrl.registerComplete);

// Change email
router.post(
  "/change-email/request",
  authenticate, // user harus login
  writeLimiter,
  ctrl.changeEmailRequest
);
router.post("/change-email/confirm", writeLimiter, ctrl.changeEmailConfirm);

// Reset password
router.post("/password/reset/request", writeLimiter, ctrl.resetPasswordRequest);
router.post("/password/reset/confirm", writeLimiter, ctrl.resetPasswordConfirm);

// Login & Logout user
router.post("/login", writeLimiter, ctrl.loginUser);
router.post("/logout", authenticate, ctrl.logoutUser);

module.exports = router;

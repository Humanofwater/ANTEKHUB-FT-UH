// File: src/routes/users_profile.routes.js
const express = require("express");
const ctrl = require("../controllers/users_profile.controller");
const authenticate = require("../middleware/authenticate");
const rateLimit = require("express-rate-limit");
const upload = require("../middleware/uploadInfoImage");

// Rate limiter untuk operasi tulis
const writeLimiter = rateLimit({ windowMs: 10 * 1000, max: 20 });

const router = express.Router();

// Semua endpoint membutuhkan autentikasi
router.use(authenticate);

/**
 * CREATE user profile
 * Path: /users-profile/:users_uuid
 * Method: POST
 * Photo opsional (field: "photo")
 */
router.post(
  "/:users_uuid",
  writeLimiter,
  upload.single("photo"),
  ctrl.createByUsersUuid
);

/**
 * GET profile user (tampilan profil)
 * Path: /users-profile/:users_uuid
 * Method: GET
 */
router.get("/:users_uuid", ctrl.getByUsersUuid);

/**
 * UPDATE PHOTO (ganti foto profil)
 * Path: /users-profile/:users_uuid/photo
 * Method: PATCH
 */
router.patch(
  "/:users_uuid/photo",
  writeLimiter,
  upload.single("photo"),
  ctrl.updatePhoto
);

/**
 * DELETE PHOTO (kembalikan ke default)
 * Path: /users-profile/:users_uuid/photo
 * Method: DELETE
 */
router.delete("/:users_uuid/photo", writeLimiter, ctrl.deletePhoto);

/**
 * PERIODIC UPDATE (update tahunan)
 * Path: /users-profile/:users_uuid/update
 * Method: PUT
 */
router.put("/:users_uuid/update", writeLimiter, ctrl.periodicUpdate);

/**
 * GET tracking map (untuk admin)
 * Path: /users-profile/tracking
 * Method: GET
 */
router.get("/tracking", ctrl.getAllTracking);

module.exports = router;

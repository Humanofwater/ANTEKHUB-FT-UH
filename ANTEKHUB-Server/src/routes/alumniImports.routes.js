// =============================================
// File: src/routes/alumniImports.routes.js
// =============================================
const express = require("express");
const multer = require("multer");
const path = require("path");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const rateLimit = require("express-rate-limit");
const ctrl = require("../controllers/alumniImports.controller");

const max = process.env.NODE_ENV === 'production' ? 10 : 1000;
const windowMs = process.env.NODE_ENV === 'production' ? 10_000 : 10_000;

const writeLimiter = rateLimit({ windowMs, max });
const router = express.Router();
// const writeLimiter = rateLimit({ windowMs: 10 * 1000, max: 10 });

// =============================================
// Upload Config: in-memory only (pakai buffer)
// =============================================
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".xls", ".xlsx"].includes(ext)) {
      return cb(new Error("Hanya file Excel (.xls / .xlsx) yang diperbolehkan"));
    }
    cb(null, true);
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Semua endpoint hanya untuk Admin & Super Admin
router.use(authenticate);
router.use(authorizeRoles("Admin", "Super Admin"));

// === PREVIEW ===
// Upload file Excel → hasil preview per sheet (pakai buffer)
router.post(
  "/imports/preview",
  writeLimiter,
  upload.single("file"),
  ctrl.preview
);

// === COMMIT ===
// Commit hasil preview ke database
router.post("/imports/:runId/commit", writeLimiter, ctrl.commit);

// === REVIEW OPSIONAL ===
// Lihat riwayat import (hanya untuk admin monitoring)
router.get("/imports/runs", ctrl.listRuns);
router.get("/imports/runs/:id", ctrl.getRun);

// Lihat dan resolve potensi duplikat
router.get("/imports/duplicates", ctrl.listDuplicates);
router.post("/imports/duplicates/:id/resolve", ctrl.resolveDuplicate);

module.exports = router;
// =============================================
// File: src/controllers/alumniImports.controller.js
// Tujuan: Controller untuk fitur impor Excel data Alumni per sheet
// URL Base: /api/alumni/imports
// =============================================
const { buildPreview } = require("../services/previewService");
const { commitSheets } = require("../services/commitService");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");
const models = require("../models");

// =============================================
// PREVIEW: upload file excel → tampilkan hasil parsing tiap sheet
// =============================================
exports.preview = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File Excel wajib diunggah" });
    }

    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const actorId = req.user?.id || req.user?.uuid || "system";

    // Buat direktori tmp jika belum ada
    const tmpDir = path.resolve(process.cwd(), "uploads/tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    // Tulis file sementara ke disk
    const tmpFilePath = path.resolve(tmpDir, `${Date.now()}-${originalName}`);
    const workbook = xlsx.read(fileBuffer, { cellDates: false });
    xlsx.writeFile(workbook, tmpFilePath);

    // Jalankan preview dengan actorId user yang sedang login
    const data = await buildPreview(tmpFilePath, actorId);

    // Hapus file sementara
    try {
      fs.unlinkSync(tmpFilePath);
    } catch (e) {
      console.warn("[preview] gagal hapus file tmp:", e.message);
    }

    return res.status(200).json({
      message: "Preview berhasil dibuat",
      data,
    });
  } catch (error) {
    console.error("[alumniImports.preview] error:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan saat membuat preview",
      error: error.message,
    });
  }
};

// =============================================
// COMMIT: simpan hasil preview ke database
// =============================================
exports.commit = async (req, res) => {
  const t = await models.sequelize.transaction();
  try {
    const { runId } = req.params;
    const { sheets } = req.body || {};
    const actorId = req.user?.id || "system";

    if (!runId) {
      return res.status(400).json({ message: "Parameter runId wajib diisi" });
    }
    if (!Array.isArray(sheets) || sheets.length === 0) {
      return res
        .status(400)
        .json({ message: "Body.sheets harus berupa array nama sheet" });
    }

    const result = await commitSheets(runId, sheets, models, { actorId });
    await t.commit();

    return res.status(200).json({
      message: "Commit data berhasil",
      data: result,
    });
  } catch (error) {
    await t.rollback();
    console.error("[alumniImports.commit] error:", error);

    if (error.name === "SequelizeValidationError") {
      return res.status(422).json({ message: error.message });
    }
    if (error.message?.includes("RUN tidak ditemukan")) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Gagal menyimpan data hasil impor",
      error: error.message,
    });
  }
};

// =============================================
// REVIEW: daftar run import yang pernah dibuat
// =============================================
exports.listRuns = async (_req, res) => {
  try {
    const data = await models.ImportRun.findAll({
      order: [["created_at", "DESC"]],
      limit: 100,
    });
    return res.status(200).json({
      message: "Berhasil mendapatkan daftar run impor",
      data,
    });
  } catch (error) {
    console.error("[alumniImports.listRuns] error:", error);
    return res.status(500).json({
      message: "Gagal memuat daftar run impor",
      error: error.message,
    });
  }
};

// =============================================
// REVIEW DETAIL: detail per-run (beserta items)
// =============================================
exports.getRun = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await models.ImportRun.findByPk(id, {
      include: [{ model: models.ImportItem, as: "items" }],
    });

    if (!data) {
      return res.status(404).json({ message: "Run tidak ditemukan" });
    }

    return res.status(200).json({
      message: "Berhasil mendapatkan detail run impor",
      data,
    });
  } catch (error) {
    console.error("[alumniImports.getRun] error:", error);
    return res.status(500).json({
      message: "Gagal memuat detail run impor",
      error: error.message,
    });
  }
};

// =============================================
// DUPLIKAT: daftar potensi duplikat
// =============================================
exports.listDuplicates = async (_req, res) => {
  try {
    const data = await models.PotensiDuplikat.findAll({
      order: [["id", "DESC"]],
      limit: 200,
    });
    return res.status(200).json({
      message: "Berhasil mendapatkan daftar potensi duplikat",
      data,
    });
  } catch (error) {
    console.error("[alumniImports.listDuplicates] error:", error);
    return res.status(500).json({
      message: "Gagal memuat daftar potensi duplikat",
      error: error.message,
    });
  }
};

// =============================================
// RESOLVE DUPLIKAT: tandai duplikat sudah direview
// =============================================
exports.resolveDuplicate = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body || {};
    const actorId = req.user?.id || "system";

    const row = await models.PotensiDuplikat.findByPk(id);
    if (!row) {
      return res.status(404).json({ message: "Data duplikat tidak ditemukan" });
    }

    await row.update({
      resolved_by: actorId,
      resolved_at: new Date(),
      resolution_note: `${action || "reviewed"}: ${note || ""}`,
    });

    return res.status(200).json({
      message: "Berhasil menyelesaikan potensi duplikat",
      data: row,
    });
  } catch (error) {
    console.error("[alumniImports.resolveDuplicate] error:", error);
    return res.status(500).json({
      message: "Gagal memperbarui status duplikat",
      error: error.message,
    });
  }
};

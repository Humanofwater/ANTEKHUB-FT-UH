// =============================================
// File: src/controllers/imports.controller.js
// =============================================
const { buildPreview } = require("../services/previewService");
const { commitSheets } = require("../services/commitService");
const models = require("../models"); // asumsi index.js export Sequelize models

async function preview(req, res) {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ message: "File excel wajib diunggah (field: file)" });
    const actorId = req.user?.id || "system"; // sesuaikan auth Anda
    const { run_id, sheets } = await buildPreview(
      req.file.buffer,
      models,
      actorId
    );
    res.status(200).json({ run_id, sheets });
  } catch (e) {
    console.error("preview error:", e);
    res.status(500).json({ message: e.message || "Gagal membuat preview" });
  }
}

async function commit(req, res) {
  try {
    const { runId } = req.params;
    const { sheets } = req.body || {};
    if (!Array.isArray(sheets) || sheets.length === 0) {
      return res
        .status(400)
        .json({
          message: "Body.sheets harus array nama sheet yang akan di-commit",
        });
    }
    const result = await commitSheets(runId, sheets, models, {
      actorId: req.user?.id || "system",
    });
    res.status(200).json(result);
  } catch (e) {
    console.error("commit error:", e);
    res.status(500).json({ message: e.message || "Gagal commit impor" });
  }
}

module.exports = { preview, commit };

// =============================================
// File: src/controllers/imports.review.controller.js
// =============================================
const models2 = require("../models");

async function listRuns(_req, res) {
  const runs = await models2.ImportRun.findAll({
    order: [["created_at", "DESC"]],
    limit: 100,
  });
  res.json({ data: runs });
}
async function getRun(req, res) {
  const run = await models2.ImportRun.findByPk(req.params.id, {
    include: [{ model: models2.ImportItem, as: "items" }],
  });
  if (!run) return res.status(404).json({ message: "Run tidak ditemukan" });
  res.json({ data: run });
}
async function listDuplicates(_req, res) {
  const rows = await models2.PotensiDuplikat.findAll({
    order: [["id", "DESC"]],
    limit: 200,
  });
  res.json({ data: rows });
}
async function resolveDuplicate(req, res) {
  const id = req.params.id;
  const { action, note } = req.body || {}; // action: 'keep-left' | 'keep-right' | 'merge-manual' | 'dismiss'
  const row = await models2.PotensiDuplikat.findByPk(id);
  if (!row)
    return res.status(404).json({ message: "Duplikat tidak ditemukan" });
  await row.update({
    resolved_by: req.user?.id || "system",
    resolved_at: new Date(),
    resolution_note: `${action || "reviewed"}: ${note || ""}`,
  });
  res.json({ message: "Resolved", data: row });
}
module.exports = { listRuns, getRun, listDuplicates, resolveDuplicate };

// =============================================
// File: src/utils/excel.js
// =============================================
const XLSX = require("xlsx");
function loadWorkbook(input) {
  return Buffer.isBuffer(input)
    ? XLSX.read(input, { type: "buffer" })
    : XLSX.readFile(String(input));
}
function excelSerialDateToISO(n) {
  if (typeof n !== "number") return null;
  const d = new Date(Math.round((n - 25569) * 86400 * 1000));
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function sheetToAoA(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
}
module.exports = { loadWorkbook, sheetToAoA, excelSerialDateToISO };

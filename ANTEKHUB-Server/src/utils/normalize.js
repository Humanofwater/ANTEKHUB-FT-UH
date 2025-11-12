// =============================================
// File: src/utils/normalize.js
// =============================================
const { ENUMS, ALIAS } = require("./enums");
const { excelSerialDateToISO } = require("./excel");
function normalizeName(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function parseDateFlexible(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return excelSerialDateToISO(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
function parseIpk(v) {
  if (v == null || v === "") return null;
  const n = Number(
    String(v)
      .replace(",", ".")
      .replace(/[^0-9.]/g, "")
  );
  return Number.isNaN(n) ? null : n;
}
function parseLamaStudi(v) {
  const s = String(v || "").toLowerCase();
  let tahun = null,
    bulan = null;
  let m = s.match(/(\d+)\s*(th|tahun)/);
  if (m) tahun = Number(m[1]);
  m = s.match(/(\d+)\s*(bln|bulan)/);
  if (m) bulan = Number(m[1]);
  if (!m && !tahun) {
    const x = s.match(/(\d+)\s*bulan/);
    if (x) {
      tahun = Math.floor(Number(x[1]) / 12);
      bulan = Number(x[1]) % 12;
    }
  }
  return { tahun, bulan };
}
function mapEnum(value, domain) {
  if (value == null || value === "") return null;
  const v = String(value).trim();
  const vLower = v.toLowerCase();
  const aliasMap = ALIAS[domain] || {};
  const mapped = aliasMap[vLower] || v;
  return ENUMS[domain].has(mapped) ? mapped : null;
}
function stripNonDigits(s) {
  return String(s || "").replace(/\D+/g, "");
}
module.exports = {
  normalizeName,
  parseDateFlexible,
  parseIpk,
  parseLamaStudi,
  mapEnum,
  stripNonDigits,
};

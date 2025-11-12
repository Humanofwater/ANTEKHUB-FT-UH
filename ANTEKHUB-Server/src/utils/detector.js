// =============================================
// File: src/utils/detector.js
// =============================================
function detectAdapter(aoa) {
  const tokens = [
    "nim",
    "nama",
    "lahir",
    "ipk",
    "predikat",
    "tahun",
    "nilai",
    "yudisium",
    "wisuda",
    "lulus",
    "no",
    "alumni",
    "ijazah",
  ];
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 30); i++) {
    const row = (aoa[i] || []).join(" ").toLowerCase();
    const score = tokens.reduce((acc, t) => acc + (row.includes(t) ? 1 : 0), 0);
    if (score >= 3) {
      headerRowIdx = i;
      break;
    }
  }
  let hasTempatTgl = false,
    hasNoCol = false;
  const header = aoa[headerRowIdx] || [];
  for (const c of header) {
    const s = String(c).toLowerCase();
    if (/tempat.*tanggal.*lahir/.test(s)) hasTempatTgl = true;
    if (s === "no" || /^no\.?$/i.test(s)) hasNoCol = true;
  }
  if (hasTempatTgl && hasNoCol) return { kind: "maret2023", headerRowIdx };
  return { kind: "default", headerRowIdx };
}
module.exports = { detectAdapter };

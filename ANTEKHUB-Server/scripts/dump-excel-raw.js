/**
 * ==========================================
 * File: scripts/dump-excel-raw.js
 * Jalankan:
 *    node scripts/dump-excel-raw.js "Data Alumni/Wisuda Maret 2018.xls"
 * ==========================================
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

if (process.argv.length < 3) {
  console.error("❌  Gunakan: node dump-excel-raw.js <path ke file Excel>");
  process.exit(1);
}

const inputPath = process.argv[2];
const absPath = path.resolve(process.cwd(), `Data Alumni/${inputPath}`);
if (!fs.existsSync(absPath)) {
  console.error("❌  File tidak ditemukan:", absPath);
  process.exit(1);
}

console.log("📖 Membaca file:", absPath);
const buf = fs.readFileSync(absPath);

// Baca workbook
const wb = XLSX.read(buf, { type: "buffer", cellDates: true, raw: false });
console.log(`📚 Terdapat ${wb.SheetNames.length} sheet:`, wb.SheetNames);

// Ambil semua sheet dan ubah jadi AoA (Array of Arrays)
const allSheets = {};
wb.SheetNames.forEach((name) => {
  const ws = wb.Sheets[name];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  allSheets[name] = aoa;
});

// Tentukan output
const baseName = path.basename(absPath, path.extname(absPath));
const outFile = path.join(
  process.cwd(),
  "logs",
  `${baseName}-raw-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
);

// Pastikan folder logs ada
fs.mkdirSync(path.dirname(outFile), { recursive: true });

// Simpan hasil mentah
fs.writeFileSync(outFile, JSON.stringify(allSheets, null, 2), "utf8");

console.log("✅  Data mentah berhasil disimpan di:");
console.log("   ", outFile);

// Tampilkan ringkasan tiap sheet
for (const [name, rows] of Object.entries(allSheets)) {
  console.log(`\n🧾 Sheet: ${name}`);
  console.log(`   Jumlah baris: ${rows.length}`);
  console.log(`   Contoh baris pertama:`, rows[0]);
}

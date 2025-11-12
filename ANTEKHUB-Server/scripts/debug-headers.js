// File: scripts/debug-headers.js
// Jalankan:
//   node scripts/debug-headers.js "Nama File.xls" [SheetName]
// Output: cetakan header mentah, header gabungan, dan mapping kolom

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

// ===== util =====
function normHeader(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
function normKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    // samakan "no. alumni" == "no alumni"
    .replace(/[.\-_/\\]/g, "");
}
function detectHeader(aoa, maxScan = 15) {
  let headerIdx = 0;
  let subIdx = -1;

  for (let i = 0; i < Math.min(maxScan, aoa.length); i++) {
    const row = aoa[i] || [];
    const cells = row.filter((x) => String(x || "").trim() !== "");
    const longText = cells.some((c) => String(c).length > 50);
    if (cells.length <= 2 || longText) continue;

    headerIdx = i;
    const next = aoa[i + 1] || [];
    const nextCells = next.filter((x) => String(x || "").trim() !== "");
    if (nextCells.length > 0) subIdx = i + 1;
    break;
  }

  const main = (aoa[headerIdx] || []).map(normHeader);
  const sub = subIdx >= 0 ? (aoa[subIdx] || []).map(normHeader) : [];

  const headers = [];
  let lastMain = "";
  for (let i = 0; i < Math.max(main.length, sub.length); i++) {
    const m = normHeader(main[i] || "");
    const s = normHeader(sub[i] || "");
    const currentMain = m || lastMain;
    lastMain = currentMain;
    headers.push(s && currentMain ? `${currentMain}.${s}` : currentMain);
  }

  return { main, sub, headers, headerRowIdx: subIdx >= 0 ? subIdx : headerIdx };
}

function buildCols(headers) {
  return headers.map((h) => {
    const [m, s] = String(h || "").split(".");
    return {
      raw: h,
      main: m || "",
      sub: s || "",
      mainNorm: normKey(m || ""),
      subNorm: normKey(s || ""),
      normCombined: normKey(h || ""),
    };
  });
}

function probeKeys(cols, ...keys) {
  const wanted = keys.map(normKey);
  const hits = [];
  cols.forEach((c, idx) => {
    for (const k of wanted) {
      if (c.mainNorm.includes(k) || c.subNorm.includes(k) || c.normCombined.includes(k)) {
        hits.push({ idx, raw: c.raw, main: c.main, sub: c.sub });
        break;
      }
    }
  });
  return hits;
}

// ===== main =====
(async function main() {
  const inputPath = process.argv[2];
  const onlySheet = process.argv[3];

  if (!inputPath) {
    console.error("❌ Gunakan: node scripts/debug-headers.js \"Nama File.xls\" [SheetName]");
    process.exit(1);
  }

  const absPath = path.resolve(process.cwd(), "Data Alumni", inputPath);
  if (!fs.existsSync(absPath)) {
    console.error("❌ File tidak ditemukan:", absPath);
    process.exit(1);
  }

  console.log("📖 Membaca file:", absPath);
  const buf = fs.readFileSync(absPath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true, raw: false });

  const sheets = onlySheet ? [onlySheet] : wb.SheetNames;

  for (const name of sheets) {
    const ws = wb.Sheets[name];
    if (!ws) {
      console.warn(`⚠️  Sheet ${name} tidak ada.`);
      continue;
    }

    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    console.log("\n==================================================");
    console.log("📄 Sheet:", name);

    // tampilkan 15 baris pertama mentah
    const sample = aoa.slice(0, 15);
    console.log("🔎 15 baris pertama (raw AOA):");
    sample.forEach((row, i) => {
      console.log(String(i + 1).padStart(2, " "), "|", row.map((c) => String(c)).join(" | "));
    });

    const { main, sub, headers, headerRowIdx } = detectHeader(aoa);
    const cols = buildCols(headers);

    console.log("\n🧩 Header MAIN    :", main);
    console.log("🧩 Header SUB     :", sub);
    console.log("🧩 Header Combined:", headers);
    console.log("📍 headerRowIdx    :", headerRowIdx);

    // Cetak tabel mapping kolom
    console.log("\n📚 Mapping kolom (index | raw | main | sub | mainNorm | subNorm):");
    cols.forEach((c, i) => {
      console.log(
        String(i).padStart(2, " "),
        "|", c.raw,
        "|", c.main,
        "|", c.sub,
        "|", c.mainNorm,
        "|", c.subNorm
      );
    });

    // Cari kandidat kolom untuk beberapa kunci penting
    const probes = [
      { label: "nim", keys: ["nim", "no induk", "nrp"] },
      { label: "no_alumni", keys: ["no. alumni", "no alumni", "no ijazah"] },
      { label: "alamat", keys: ["alamat & no. tlp", "alamat"] },
      { label: "nilai_ujian", keys: ["nilai ujian", "nilai"] },
      { label: "tgl_lulus", keys: ["tgl lulus", "tanggal lulus"] },
      { label: "ttl", keys: ["tempat & tgl lahir", "tempat lahir", "tanggal lahir"] },
    ];

    console.log("\n🔍 Probe hasil pencarian kolom:");
    probes.forEach((p) => {
      const hits = probeKeys(cols, ...p.keys);
      console.log(`- ${p.label}:`, hits.length ? hits : "(tidak ketemu)");
    });

    // Hentikan kalau hanya 1 sheet
    if (onlySheet) break;
  }
})();

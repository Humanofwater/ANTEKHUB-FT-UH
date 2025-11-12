// =============================================
// File: src/services/previewService.js
// =============================================
const XLSX = require("xlsx");
const { Op } = require("sequelize");
const previewStore = require("../stores/previewStore");
const { adaptDefault } = require("../utils/adapters/defaultAdapter");
const { adaptMaret2023 } = require("../utils/adapters/maret2023Adapter");
const models = require("../models"); // pastikan index.js export ProgramStudi

// ---------- Helpers: ekstraksi banner prodi ----------
function extractProdiBanner(aoa) {
  const MAX_SCAN = Math.min(14, aoa.length);
  for (let r = 0; r < MAX_SCAN; r++) {
    const row = aoa[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (!cell) continue;

      // Pola umum: "PROGRAM STUDI : TEKNIK SIPIL"
      const m = cell.match(/program\s*studi\s*:?\s*(.+)$/i);
      if (m && m[1]) return m[1].trim();

      // Kadang langsung nama prodi berdiri sendiri (e.g. "TEKNIK SIPIL") di kolom pertama
      if (
        c === 0 &&
        /^[A-Z][A-Z\s.&/()-]+$/.test(cell) &&
        !/kementerian|universitas|fakultas|data wisudawan/i.test(cell)
      ) {
        return cell.trim();
      }
    }
  }
  return null;
}

// ---------- Helpers: strata & kode dari sheet ----------
function strataFromSheetName(sheetName) {
  const code = String(sheetName || "")
    .trim()
    .toUpperCase();
  if (!code) return null;
  if (code === "D014") return "Insinyur";
  if (code === "D024") return "Profesi Arsitektur";
  if (code.length >= 4) {
    const s = code.charAt(3);
    if (s === "1") return "Sarjana";
    if (s === "2") return "Magister";
    if (s === "3") return "Doktor";
  }
  return null;
}
function code3FromSheetName(sheetName) {
  const code = String(sheetName || "")
    .trim()
    .toUpperCase();
  // Format umum D011 → D01 (3 char depan)
  if (/^[A-Z]\d{3,}$/.test(code)) return code.slice(0, 3);
  return code.slice(0, 3) || null;
}

// ---------- Helpers: deteksi adapter Maret 2023 ----------
function looksLikeMaret2023(headers) {
  const normalized = headers.map((h) => String(h || "").toLowerCase());
  const hasSemesterMasuk = normalized.some((h) => h.includes("semester masuk"));
  const hasNilaiTA = normalized.some((h) => h.includes("nilai ta"));
  const hasTanggalLulusSub = normalized.some(
    (h) => h.includes("tanggal lulus.tgl") || h.includes("tgl lulus.tgl")
  );
  return hasSemesterMasuk && hasNilaiTA && hasTanggalLulusSub;
}

// ---------- Resolver: cari nama prodi terbaik untuk PREVIEW ----------
async function resolveProdiName({ sheetName, aoa }) {
  const ProgramStudi = models.ProgramStudi;

  // 1) Coba dari banner (aliases/nama)
  const banner = extractProdiBanner(aoa); // e.g. "TEKNIK SIPIL"
  if (banner && ProgramStudi) {
    const bannerNorm = banner.replace(/\s+/g, " ").trim();

    try {
      // a) cocokan ke aliases array (Postgres ARRAY TEXT) atau nama
      // NOTE: sesuaikan nama kolom alias jika perlu. Umumnya "aliases" bertipe ARRAY(TEXT)
      const byAliasOrName = await ProgramStudi.findOne({
        where: {
          [Op.or]: [
            // aliases mengandung banner (case-insensitive); jika kolom "aliases" bertipe ARRAY(TEXT),
            // biasanya kita pakai Op.contains dengan array persis. Untuk longgar, fallback ke iLike di nama.
            // GUNAKAN SATU opsi yang cocok dengan skema kamu:
            // { aliases: { [Op.contains]: [bannerNorm] } },  // jika exact alias match
            { nama: { [Op.iLike]: bannerNorm } },
            { nama: { [Op.iLike]: `%${bannerNorm}%` } },
          ],
        },
      });
      if (byAliasOrName) return byAliasOrName.nama;
    } catch (e) {
      // lanjut ke langkah 2
    }
  }

  // 2) Coba dari kode sheet (3 char depan)
  const code3 = code3FromSheetName(sheetName); // e.g. "D01"
  if (code3 && ProgramStudi) {
    try {
      // Sesuaikan nama kolom di bawah ini dengan skema tabel kamu:
      // Misal ada "kode3" atau "kode_prefix" atau "kode" yang menyimpan D01
      const byCode = await ProgramStudi.findOne({
        where: {
          [Op.or]: [
            { kode3: code3 }, // <<— jika ada
            { kode_prefix: code3 }, // <<— jika ada
            { kode: code3 }, // <<— fallback kalau kode disimpan 3 char
            { kode: { [Op.iLike]: `${code3}%` } }, // kalau kode lengkapnya D011x
          ],
        },
      });
      if (byCode) return byCode.nama;
    } catch (e) {
      // abaikan, fallback terakhir:
    }
  }

  // 3) Fallback: pakai banner apa adanya, atau null
  return banner || null;
}

// ---------- Filter sheet relevan ----------
function isRelevantSheet(sheetName) {
  const upper = String(sheetName || "")
    .toUpperCase()
    .trim();
  if (upper.startsWith("P")) return false; // skip P...
  if (upper.includes("TERBAIK")) return false; // skip Wisudawan Terbaik
  if (upper.startsWith("D")) return true; // ambil Dxxx
  if (/^SHEET\s*\d+$/i.test(upper)) return false; // Sheet1/2/3 → skip (generic)
  return false;
}

// ---------- Build Preview ----------
async function buildPreview(filePath, actorId = null) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const resultSheets = [];

  for (const sheetName of workbook.SheetNames) {
    if (!isRelevantSheet(sheetName)) {
      console.log(`⏩ Skip sheet: ${sheetName}`);
      continue;
    }

    console.log(`📄 Proses sheet: ${sheetName}`);
    const ws = workbook.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!aoa || !aoa.length) continue;

    // Deteksi adapter otomatis
    let adapterUsed = "default";
    try {
      const headerSample = aoa
        .slice(0, 10)
        .flat()
        .filter((x) => String(x || "").trim() !== "")
        .map((x) => String(x).trim());
      if (looksLikeMaret2023(headerSample)) adapterUsed = "maret2023";
    } catch (_) {}

    const parsed =
      adapterUsed === "maret2023" ? adaptMaret2023(aoa) : adaptDefault(aoa);

    // Safety filter baris kosong benar-benar
    parsed.rows = (parsed.rows || []).filter((r) =>
      Object.values(r).some((v) => String(v ?? "").trim() !== "")
    );
    while (
      parsed.rows.length > 0 &&
      Object.values(parsed.rows[parsed.rows.length - 1]).every(
        (v) => String(v || "").trim() === ""
      )
    ) {
      parsed.rows.pop();
    }

    // Prodi & strata (preview-friendly)
    const prodiName = await resolveProdiName({ sheetName, aoa });
    const strataName = strataFromSheetName(sheetName);
    const prodiCode3 = code3FromSheetName(sheetName);

    const rowsEnriched = parsed.rows.map((row) => ({
      ...row,
      prodi_name: prodiName, // ✅ tampilkan nama prodi yang ramah user
      strata: strataName || null,
      prodi_code3: prodiCode3 || null,
    }));

    const summary = {
      total: rowsEnriched.length,
      valid: rowsEnriched.length,
      error: 0,
    };

    resultSheets.push({
      sheet_name: sheetName,
      adapter: adapterUsed,
      prodi: prodiName, // sheet-level, juga tampilkan
      strata: strataName || null,
      warnings: parsed.warnings || [],
      summary,
      rows: rowsEnriched,
    });
  }

  // === 🔥 Simpan ke previewStore ===
  const runId = previewStore.createRun({
    created_by: actorId || "system",
    status: "preview",
    sheets: resultSheets,
  });

  console.log(`✅ Preview siap dengan run_id: ${runId}`);

  return {
    run_id: runId,
    sheets: resultSheets,
  };
}

module.exports = { buildPreview };

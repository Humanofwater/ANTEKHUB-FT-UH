// =============================================
// File: src/utils/adapters/maret2023Adapter.js
// =============================================
const {
  normalizeName,
  parseDateFlexible,
  parseIpk,
  parseLamaStudi,
  mapEnum,
  stripNonDigits,
} = require("../normalize");

/**
 * Normalisasi header cell (trim, kompres spasi)
 */
function normHeader(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

/**
 * Deteksi baris header dan sub-header:
 * - scan beberapa baris, lewati baris dekoratif (sedikit sel terisi / teks sangat panjang)
 * - setelah ketemu header, paksa ambil 1 baris di bawahnya sebagai sub-header (kalau tidak kosong)
 * - sub kolom mewarisi main kolom di kiri jika main kolom kosong
 */
function detectHeaderWithSub(aoa, maxScan = 20) {
  let headerIdx = 0;
  let subIdx = -1;

  for (let i = 0; i < Math.min(maxScan, aoa.length); i++) {
    const row = aoa[i] || [];
    const cells = row.filter((x) => String(x || "").trim() !== "");
    const longText = cells.some((c) => String(c).length > 50);
    if (cells.length <= 2 || longText) continue; // skip dekoratif

    headerIdx = i;
    const next = aoa[i + 1] || [];
    const nextCells = next.filter((x) => String(x || "").trim() !== "");
    if (nextCells.length > 0) subIdx = i + 1; // selalu ambil baris di bawah bila ada isi
    break;
  }

  const main = (aoa[headerIdx] || []).map(normHeader);
  const sub = subIdx >= 0 ? (aoa[subIdx] || []).map(normHeader) : [];

  // Gabungkan dengan "inherit" logic (main kosong => pakai lastMain)
  const headers = [];
  let lastMain = "";
  for (let i = 0; i < Math.max(main.length, sub.length); i++) {
    const m = normHeader(main[i] || "");
    const s = normHeader(sub[i] || "");
    const currentMain = m || lastMain;
    lastMain = currentMain || lastMain;
    if (s && currentMain) headers.push(`${currentMain}.${s}`);
    else headers.push(currentMain);
  }

  const finalHeaders = headers.some((h) => h.includes(".")) ? headers : main.map(normHeader);
  return { headers: finalHeaders, headerRowIdx: subIdx >= 0 ? subIdx : headerIdx };
}

/**
 * Ambil indeks semua kolom yang main-nya mengandung fragment
 */
function buildCols(headers) {
  return headers.map((h) => {
    const parts = String(h || "").split(".");
    const main = (parts[0] || "").trim().toLowerCase();
    const sub = (parts[1] || "").trim().toLowerCase();
    return { raw: h, main, sub };
  });
}
function findGroupIdx(cols, mainKey) {
  const key = String(mainKey).toLowerCase();
  return cols
    .map((c, i) => ({ i, main: c.main }))
    .filter(({ main }) => main.includes(key))
    .map(({ i }) => i);
}
function getSubFromGroup(row, cols, mainKey, ...subKeys) {
  const groupIdx = findGroupIdx(cols, mainKey);
  const subMap = {};
  const lowered = subKeys.map((s) => String(s).toLowerCase());
  for (const gi of groupIdx) {
    const sub = cols[gi].sub;
    if (!sub) continue;
    const hitAt = lowered.findIndex((sk) => sub.includes(sk));
    if (hitAt >= 0) {
      subMap[lowered[hitAt]] = String(row[gi] ?? "").trim();
    }
  }
  return subMap;
}
function getCell(row, cols, ...mainKeys) {
  for (const k of mainKeys) {
    const key = String(k).toLowerCase();
    const idx = cols.findIndex((c) => c.main.includes(key) && !c.sub);
    if (idx >= 0) return String(row[idx] ?? "").trim();
    const grp = findGroupIdx(cols, key);
    if (grp.length > 0) return String(row[grp[0]] ?? "").trim();
  }
  return "";
}

/**
 * Mapping opsional kode predikat → label panjang
 */
function mapPredikat(val) {
  const s = String(val || "").trim();
  const m = {
    S: "Sangat Memuaskan",
    M: "Memuaskan",
    C: "Cum Laude",
    "CUM LAUDE": "Cum Laude",
  };
  return m[s] || s || null;
}

/**
 * Parse tahun_masuk dari "SEMESTER MASUK" (contoh: 20172 → 2017)
 */
function parseTahunMasukFromSemester(code) {
  const s = String(code || "").trim();
  const year4 = s.match(/^\d{4}/)?.[0];
  return year4 ? Number(year4) : null;
}

/**
 * Adapter khusus format "Maret 2023"
 * - Fokus pada kolom: NIM, NAMA, TGL LULUS (TGL/BLN/THN), NO. ALUMNI, SEMESTER MASUK, LAMA STUDI (THN/BLN),
 *   NILAI TA, IPK, PREDIKAT KELULUSAN
 * - TTL biasanya tidak tersedia → tidak dianggap error jika kosong.
 */
function adaptMaret2023(aoa) {
  // 1) Deteksi header & sub
  const { headers, headerRowIdx } = detectHeaderWithSub(aoa);
  const cols = buildCols(headers);

  // 2) Ambil baris data (setelah subheader)
  const dataRows = aoa
    .slice(headerRowIdx + 1)
    .filter((r) => (r || []).some((c) => String(c ?? "").trim() !== ""));

  const rows = dataRows.map((r, i) => {
    const row_no = i + headerRowIdx + 2;

    // --- kolom dasar ---
    const nim = getCell(r, cols, "nim");
    const nama = normalizeName(getCell(r, cols, "nama"));

    // TTL tidak tersedia → kosong (jangan jadikan error)
    const tempat_lahir = "";
    const tanggal_lahir = null;

    // TGL LULUS (grup subkolom)
    const lulusSubs = getSubFromGroup(r, cols, "tanggal lulus", "tgl", "bln", "thn");
    const tanggal_lulus =
      parseDateFlexible(
        [lulusSubs["tgl"], lulusSubs["bln"], lulusSubs["thn"]].filter(Boolean).join(" ")
      ) || parseDateFlexible(getCell(r, cols, "tanggal lulus", "tgl lulus"));

    // LAMA STUDI (grup subkolom)
    const lamaSubs = getSubFromGroup(r, cols, "lama studi", "thn", "bln", "bulan");
    const { tahun: lsT, bulan: lsB } = parseLamaStudi(getCell(r, cols, "lama studi", "masa studi"));
    const lama_studi_tahun = Number(stripNonDigits(lamaSubs["thn"])) || lsT || 0;
    const lama_studi_bulan =
      Number(stripNonDigits(lamaSubs["bln"] || lamaSubs["bulan"])) || lsB || 0;

    // Lain-lain
    const no_alumni = getCell(r, cols, "no. alumni", "no alumni");
    const semesterMasuk = getCell(r, cols, "semester masuk");
    const tahun_masuk = parseTahunMasukFromSemester(semesterMasuk);
    const nilai_ujian = mapEnum(getCell(r, cols, "nilai ta", "nilai"), "nilai_ujian");
    const ipk = parseIpk(getCell(r, cols, "ipk", "ipk akhir"));
    const predikat_kelulusan = mapPredikat(getCell(r, cols, "predikat kelulusan", "predikat"));

    // Status & validasi ringan:
    const messages = [];
    if (!nim) messages.push("NIM kosong");
    if (!nama) messages.push("Nama kosong");
    if (!tanggal_lulus) messages.push("Tanggal lulus invalid");
    if (ipk != null && ipk !== "" && (Number(ipk) < 0 || Number(ipk) > 4.0))
      messages.push("IPK di luar batas 0–4");

    const status = messages.length ? "error" : "valid";

    return {
      row_no,
      status,
      messages,
      // raw tidak diisi di sini; jika perlu, tambahkan { raw: Object.fromEntries(...) }
      normalized: {
        alumni: {
          nama,
          tempat_lahir,
          tanggal_lahir,
          agama: null,
          suku: null,
          bangsa: null,
          alamat: "",
          no_telp: "",
        },
        pendidikan: {
          nim,
          tahun_masuk,
          lama_studi_tahun,
          lama_studi_bulan,
          no_alumni,
          tanggal_lulus,
          nilai_ujian,
          ipk,
          predikat_kelulusan,
          judul_tugas_akhir: null,
          ipb: null,
          // kamu bisa tambahkan key bantuan: semester_masuk: semesterMasuk
        },
      },
    };
  });

  return {
    adapter: "maret2023",
    rows,
    headerRowIdx,
    headerMap: { headers },
    warnings: [],
  };
}

module.exports = { adaptMaret2023 };

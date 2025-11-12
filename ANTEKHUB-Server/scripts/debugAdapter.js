/**
 * ===============================================
 * File: src/utils/adapters/defaultAdapter.js
 * ===============================================
 * Fungsi utama:
 *   - detectHeader(aoa)
 *   - adaptDefault(aoa)
 * Exported:
 *   module.exports = { adaptDefault };
 */

const dayjs = require("dayjs");

// ======================== UTILITIES ========================
function stripNonDigits(str) {
  return String(str || "").replace(/\D+/g, "");
}
function normHeader(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
function normalizeName(str) {
  return String(str || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(\w)/g, (x) => x.toUpperCase());
}
function parseDateFlexible(input) {
  if (!input) return null;
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  const s = String(input).trim().replace(/\s+/g, " ");
  if (!s) return null;
  const months = {
    januari: "01", februari: "02", maret: "03", april: "04", mei: "05",
    juni: "06", juli: "07", agustus: "08", september: "09",
    oktober: "10", november: "11", desember: "12"
  };
  const parts = s.split(" ");
  if (parts.length === 3 && months[parts[1].toLowerCase()]) {
    return `${parts[2]}-${months[parts[1].toLowerCase()]}-${parts[0].padStart(2, "0")}`;
  }
  const tryDayjs = dayjs(s);
  return tryDayjs.isValid() ? tryDayjs.format("YYYY-MM-DD") : null;
}
function parseIpk(val) {
  const num = Number(String(val || "").replace(",", "."));
  return isNaN(num) ? null : num;
}
function parseLamaStudi(value) {
  if (!value) return { tahun: 0, bulan: 0 };
  const s = String(value).trim();
  const tahun = Number(s.match(/(\d+)\s*(th|tahun)/i)?.[1] || s.split(/\D+/)[0] || 0);
  const bulan = Number(s.match(/(\d+)\s*(bl|bulan)/i)?.[1] || s.split(/\D+/)[1] || 0);
  return { tahun, bulan };
}
function mapEnum(v) {
  const s = String(v || "").trim();
  return s || null;
}
function splitAlamatTelp(raw) {
  const s = String(raw || "").trim();
  if (!s) return { alamat: "", no_telp: "" };
  // hanya pecah di kata telp/hp
  const re = /(telp|telepon|hp)\s*[:.]?\s*/i;
  const m = s.match(re);
  if (!m) return { alamat: s, no_telp: "" };
  const idx = m.index;
  const after = s.slice(idx + m[0].length);
  const num = after.match(/[+]?[\d()\-\s]+/);
  const no_telp = num ? num[0].replace(/\s+/g, "") : after.trim();
  const alamat = s.slice(0, idx).trim();
  return { alamat, no_telp };
}

// ==================== HEADER DETECTOR =====================
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
  for (let i = 0; i < main.length; i++) {
    const m = normHeader(main[i]);
    const s = normHeader(sub[i] || "");
    const currentMain = m || lastMain; // pewarisan kolom utama
    lastMain = currentMain;
    if (s && currentMain) {
      headers.push(`${currentMain}.${s}`);
    } else {
      headers.push(currentMain);
    }
  }

  return { headers, headerRowIdx: subIdx >= 0 ? subIdx : headerIdx };
}

// ======================== ADAPTER ========================
function adaptDefault(aoa) {
  const { headers, headerRowIdx } = detectHeader(aoa);

  const cols = headers.map((h) => {
    const parts = String(h || "").split(".");
    const main = parts[0].trim().toLowerCase();
    const sub = (parts[1] || "").trim().toLowerCase();
    return { raw: h, main, sub };
  });

  

  // 🔹 Hapus baris kosong di bagian akhir
  while (
    dataRows.length > 0 &&
    dataRows[dataRows.length - 1].every((c) => String(c || "").trim() === "")
  ) {
    dataRows.pop();
  }

  const findGroupIdx = (mainKey) => {
    const key = String(mainKey).toLowerCase();
    return cols
      .map((c, i) => ({ i, main: c.main }))
      .filter(({ main }) => main.includes(key))
      .map(({ i }) => i);
  };

  const getSubFromGroup = (row, mainKey, ...subKeys) => {
    const groupIdx = findGroupIdx(mainKey);
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
  };

  const get = (row, ...mainKeys) => {
    for (const k of mainKeys) {
      const key = String(k).toLowerCase();
      const idx = cols.findIndex((c) => c.main.includes(key) && !c.sub);
      if (idx >= 0) return String(row[idx] ?? "").trim();
      const grp = findGroupIdx(key);
      if (grp.length > 0) return String(row[grp[0]] ?? "").trim();
    }
    return "";
  };

  const dataRows = aoa
    .slice(headerRowIdx + 1)
    .filter((r) => (r || []).some((c) => String(c ?? "").trim() !== ""));
  
    // 🔹 Hapus baris kosong di bagian akhir
  while (
    dataRows.length > 0 &&
    dataRows[dataRows.length - 1].every((c) => String(c || "").trim() === "")
  ) {
    dataRows.pop();
  }

  const rows = dataRows.map((r, i) => {
    const row_no = i + headerRowIdx + 2;
    const nim = get(r, "nim", "no induk", "nrp");
    const nama = normalizeName(get(r, "nama"));

    const ttlSubs = getSubFromGroup(r, "tempat & tgl lahir", "tempat", "tanggal", "tgl");
    const tempat_lahir = ttlSubs["tempat"] ?? get(r, "tempat lahir");
    const tanggal_lahir = parseDateFlexible(
      ttlSubs["tanggal"] ?? ttlSubs["tgl"] ?? get(r, "tanggal lahir")
    );

    const agama = get(r, "agama");
    const suku = get(r, "suku");
    const bangsa = get(r, "bangsa", "negara", "kewarganegaraan");

    const alamatRaw = get(r, "alamat & no. tlp", "alamat");
    const { alamat, no_telp } = splitAlamatTelp(alamatRaw);

    const tahun_masuk = Number(stripNonDigits(get(r, "thn msk", "angkatan", "tahun masuk"))) || null;

    const lulusSubs = getSubFromGroup(r, "tgl lulus", "tgl", "bln", "thn", "tanggal");
    const tanggal_lulus =
      parseDateFlexible(
        [lulusSubs["tgl"], lulusSubs["bln"], lulusSubs["thn"], lulusSubs["tanggal"]]
          .filter(Boolean)
          .join(" ")
      ) || parseDateFlexible(get(r, "tgl lulus", "tanggal lulus"));

    const lamaSubs = getSubFromGroup(r, "lama studi", "thn", "bulan", "bln");
    const { tahun: lsT, bulan: lsB } = parseLamaStudi(get(r, "lama studi", "masa studi"));
    const lama_studi_tahun = Number(stripNonDigits(lamaSubs["thn"])) || lsT || 0;
    const lama_studi_bulan =
      Number(stripNonDigits(lamaSubs["bln"] || lamaSubs["bulan"])) || lsB || 0;
    
    console.log("DEBUG no_alumni cols:", cols.map(c => c.raw));
    const no_alumni = get(r, "no.  alumni", "no alumni", "no ijazah");
    const nilai_ujian = mapEnum(get(r, "nilai ujian", "nilai"));
    const ipk = parseIpk(get(r, "ipk", "ipk akhir"));
    const predikat_kelulusan = mapEnum(
      get(r, "predikat kelulusan", "predikat"), "predikat_kelulusan"
    );
    const judul_tugas_akhir = get(r, "judul tugas akhir", "judul skripsi", "judul tesis", "judul disertasi");
    const ipb = get(r, "ipb");

    return {
      row_no,
      nim,
      nama,
      tempat_lahir,
      tanggal_lahir,
      agama,
      suku,
      bangsa,
      alamat,
      no_telp,
      tahun_masuk,
      tanggal_lulus,
      nilai_ujian,
      ipk,
      predikat_kelulusan,
      no_alumni,
      lama_studi_tahun,
      lama_studi_bulan,
      ipb,
      judul_tugas_akhir,
    };
  });

  return { headers, rows };
}

// ======================== EXPORT ========================
module.exports = { adaptDefault };
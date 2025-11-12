// File: src/utils/refs.js
const STRIP_RE = /[^\p{L}\p{N}\s]/gu; // buang simbol (unicode)
const SPACE_RE = /\s+/g;

function normalizeBase(s) {
  return (s || "")
    .toLowerCase()
    .replace(STRIP_RE, " ")
    .replace(SPACE_RE, " ")
    .trim();
}

function expandAbbrev(s) {
  // ekspansi singkatan umum
  return s
    .replace(/\bs\/w\b/g, "software")
    .replace(/\bengr\b/g, "engineer")
    .replace(/\bswe\b/g, "software engineer")
    .replace(/\bdev\b/g, "developer")
    .replace(/\bpt\b/g, "pt") // biarkan
    .trim();
}

function normalizeFull(s) {
  return normalizeBase(expandAbbrev(s));
}

// Dice coefficient (bigram)
function dice(a, b) {
  const bigrams = (t) => {
    const x = t.replace(/\s+/g, " ");
    const arr = [];
    for (let i = 0; i < x.length - 1; i++) arr.push(x.slice(i, i + 2));
    return arr;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.length === 0 || B.length === 0) return 0;
  let count = 0;
  const map = new Map();
  for (const k of A) map.set(k, (map.get(k) || 0) + 1);
  for (const k of B) {
    const c = map.get(k) || 0;
    if (c > 0) {
      count++;
      map.set(k, c - 1);
    }
  }
  return (2 * count) / (A.length + B.length);
}

async function mergeAliasIfSimilar({
  rows,
  incoming,
  threshold = 0.74, // cukup agresif agar "s/w engineer" ~ "software engineer"
  getName = (r) => r.jabatan || r.nama_perusahaan,
  getAlias = (r) => r.alias_list || [],
}) {
  const incN = normalizeFull(incoming);
  let best = null, bestScore = 0;

  for (const r of rows) {
    const nameN = normalizeFull(getName(r));
    const scoreName = dice(nameN, incN);
    let scoreAlias = 0;
    for (const al of getAlias(r)) {
      const aln = normalizeFull(al);
      scoreAlias = Math.max(scoreAlias, dice(aln, incN));
    }
    const score = Math.max(scoreName, scoreAlias);
    if (score > bestScore) { best = r; bestScore = score; }
  }
  return (bestScore >= threshold) ? best : null;
}

// ==== JABATAN ====
async function findOrCreateRefJabatanBySimilarity({ models, jabatan_nama, t }) {
  const { ReferensiJabatan } = models;
  const all = await ReferensiJabatan.findAll({ transaction: t });

  // cari kandidat merge
  const found = await mergeAliasIfSimilar({
    rows: all,
    incoming: jabatan_nama,
    getName: (r) => r.jabatan,
    getAlias: (r) => r.alias_list || [],
  });

  if (found) {
    const aliasSet = new Set([...(found.alias_list || []), jabatan_nama]);
    await found.update({ alias_list: Array.from(aliasSet) }, { transaction: t });
    return found; // ← kembalikan entri lama (alias ter-update)
  }

  // tidak mirip → buat baru
  return await ReferensiJabatan.create({
    jabatan: jabatan_nama,
    alias_list: [jabatan_nama],
  }, { transaction: t });
}

// ==== PERUSAHAAN ====
async function findOrCreateRefPerusahaanBySimilarity({ models, nama, jenis_institusi_id, bidang_industri_id, alamat, t }) {
  const { ReferensiPerusahaan } = models;
  const all = await ReferensiPerusahaan.findAll({ transaction: t });

  const found = await mergeAliasIfSimilar({
    rows: all,
    incoming: nama,
    getName: (r) => r.nama_perusahaan,
    getAlias: (r) => r.alias_list || [],
  });

  if (found) {
    // update alias & metadata ringan (alamat bila belum ada)
    const aliasSet = new Set([...(found.alias_list || []), nama]);
    await found.update({
      alias_list: Array.from(aliasSet),
      perusahaan_alamat: found.perusahaan_alamat || alamat || null,
    }, { transaction: t });
    return found;
  }

  return await ReferensiPerusahaan.create({
    nama_perusahaan: nama,
    alias_list: [nama],
    perusahaan_alamat: alamat || null,
    jenis_perusahaan_id: jenis_institusi_id || null,
    bidang_industri_id: bidang_industri_id || null,
    total_alumni: 0,
  }, { transaction: t });
}

module.exports = {
  findOrCreateRefJabatanBySimilarity,
  findOrCreateRefPerusahaanBySimilarity,
};

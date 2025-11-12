// src/services/commitService.js
const previewStore = require("../stores/previewStore");
const { Op } = require("sequelize");
const dayjs = require("dayjs");

function toInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? parseInt(n) : def;
}

function normalizeDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return dayjs(value).format("YYYY-MM-DD");
  if (typeof value === "number" && value > 59) {
    const epoch = new Date(Math.round((value - 25569) * 86400 * 1000));
    return dayjs(epoch).format("YYYY-MM-DD");
  }
  const s = String(value).trim();
  if (!s) return null;
  const fmts = [
    "YYYY-MM-DD",
    "DD-MM-YYYY",
    "D-M-YYYY",
    "DD/MM/YYYY",
    "D/M/YYYY",
    "DD MMMM YYYY",
    "D MMMM YYYY",
    "DD MMM YYYY",
    "D MMM YYYY",
  ];
  for (const f of fmts) {
    const d = dayjs(s, f, true);
    if (d.isValid()) return d.format("YYYY-MM-DD");
  }
  const d2 = dayjs(s);
  return d2.isValid() ? d2.format("YYYY-MM-DD") : null;
}

// Sesuaikan dengan enum DB kamu.
// Jika enum kamu: ['A','A-','B+','B','B-','C+','C','C-','D','E','F']
// maka turunkan A+ => A; (tambahkan mapping lain jika perlu)
function mapNilaiUjian(v) {
  if (!v) return null;
  const raw = String(v).trim().toUpperCase();
  const allowed = new Set([
    "A",
    "A-",
    "B+",
    "B",
    "B-",
    "C+",
    "C",
    "C-",
    "D",
    "E",
    "F",
  ]);
  const normalized = raw.replace(/\s+/g, "");
  if (allowed.has(normalized)) return normalized;
  if (normalized === "A+") return "A";
  return null; // biarkan null jika tidak cocok
}

async function resolveProgramStudi(
  models,
  { prodiName, sheetName, strata, actorId, t }
) {
  const ProgramStudi = models.ProgramStudi;
  const kode3 = String(sheetName || "").slice(0, 3);

  // Cari by nama / alias[] / kode prefix (ARRAY match)
  let ps = await ProgramStudi.findOne({
    where: {
      [Op.or]: [
        prodiName ? { nama: { [Op.iLike]: prodiName } } : null,
        prodiName ? { alias: { [Op.contains]: [prodiName] } } : null, // ARRAY(TEXT)
        // Ganti iLike → contains karena 'kode' bertipe ARRAY(TEXT)
        kode3 ? { kode: { [Op.contains]: [kode3] } } : null,
      ].filter(Boolean),
    },
    transaction: t,
  });

  if (!ps) {
    ps = await ProgramStudi.create(
      {
        nama: prodiName || `Program ${kode3}`,
        strata: strata || null,
        // PENTING: 'kode' harus array agar cocok dengan ARRAY(TEXT)
        kode: kode3 ? [kode3] : [],
        created_by: actorId,
      },
      { transaction: t }
    );
  }
  return ps;
}

async function commitSheets(
  runId,
  sheets,
  models,
  { actorId = "system", transaction: outerTrx } = {}
) {
  const run = previewStore.getRun(runId);
  if (!run || run.status !== "preview") {
    throw new Error("RUN tidak ditemukan / bukan status preview");
  }

  const { Alumni, PendidikanAlumni, Bangsa, Suku } = models;

  // Proses tiap sheet secara berurutan. Gagal satu sheet -> hentikan semuanya (fail-fast).
  for (const sheetName of sheets) {
    const sheet = run.sheets.find((s) => s.sheet_name === sheetName);
    if (!sheet) {
      throw new Error(`Sheet tidak ditemukan: ${sheetName}`);
    }

    // satu transaksi per-sheet (jangan gunakan outerTrx untuk atomic per-sheet)
    const t = await models.sequelize.transaction();

    try {
      for (const row of sheet.rows) {
        const nama = (row.nama || "").trim();
        const tglLahir = normalizeDate(row.tanggal_lahir);
        const nim = (row.nim || "").trim();
        if (!nama || !tglLahir || !nim) {
          throw new Error(
            `Row ${row.row_no}: nama/tanggal_lahir/nim wajib (nama="${nama}", tgl="${row.tanggal_lahir}", nim="${nim}")`
          );
        }

        // Master Bangsa & Suku (dalam transaksi)
        let bangsa_id = null, suku_id = null;
        if (row.bangsa) {
          const [b] = await Bangsa.findOrCreate({
            where: { nama: { [Op.iLike]: row.bangsa.trim() } },
            defaults: { nama: row.bangsa.trim() },
            transaction: t,
          });
          bangsa_id = b.id;
        }
        if (row.suku) {
          const [s] = await Suku.findOrCreate({
            where: { nama: { [Op.iLike]: row.suku.trim() } },
            defaults: { nama: row.suku.trim() },
            transaction: t,
          });
          suku_id = s.id;
        }

        // Alumni by (nama + tanggal_lahir)
        let alumni = await Alumni.findOne({
          where: { nama: { [Op.iLike]: nama }, tanggal_lahir: tglLahir },
          transaction: t,
        });

        let alumniJustCreated = false;
        if (!alumni) {
          alumni = await Alumni.create(
            {
              nama,
              tempat_lahir: row.tempat_lahir || "",
              tanggal_lahir: tglLahir, // YYYY-MM-DD
              agama: row.agama || null,
              alamat: row.alamat || "",
              no_telp: row.no_telp || "",
              bangsa_id,
              suku_id,
            },
            { transaction: t }
          );
          alumniJustCreated = true;
        } else {
          // patch alumni (hanya overwrite jika ada nilai)
          const patch = {
            tempat_lahir: row.tempat_lahir || alumni.tempat_lahir,
            agama: row.agama || alumni.agama,
            alamat: row.alamat || alumni.alamat,
            no_telp: row.no_telp || alumni.no_telp,
            bangsa_id: bangsa_id || alumni.bangsa_id,
            suku_id: suku_id || alumni.suku_id,
          };
          await Alumni.update(patch, { where: { id: alumni.id }, transaction: t });
        }

        // Resolve Program Studi (preview sudah isi prodi/strata)
        const prodiName = sheet.prodi || row.prodi || null;
        const strata = sheet.strata || row.strata || null;
        const programStudi = await resolveProgramStudi(models, {
          prodiName, sheetName, strata, actorId, t,
        });
        if (!programStudi || !programStudi.id) {
          throw new Error(`Row ${row.row_no}: Program studi tidak ter-resolve (sheet=${sheetName}, prodi_preview=${prodiName})`);
        }

        // Payload pendidikan (judul TA null untuk Insinyur)
        const payload = {
          alumni_id: alumni.id,
          program_studi_id: programStudi.id,
          nim,
          tahun_masuk: toInt(row.tahun_masuk),
          tanggal_lulus: normalizeDate(row.tanggal_lulus), // YYYY-MM-DD
          lama_studi_tahun: toInt(row.lama_studi_tahun, 0),
          lama_studi_bulan: toInt(row.lama_studi_bulan, 0),
          no_alumni: row.no_alumni || null,
          ipk: row.ipk != null ? Number(row.ipk) : null,
          nilai_ujian: mapNilaiUjian(row.nilai_ujian),
          predikat_kelulusan: row.predikat_kelulusan || null,
          judul_tugas_akhir: /insinyur/i.test(programStudi.nama) ? null : (row.judul_tugas_akhir || null),
          ipb: row.ipb != null ? Number(row.ipb) : null,
          strata, // simpan strata bila kolom ada di model
        };

        if (alumniJustCreated) {
          // Alumni baru -> langsung buat pendidikan
          await PendidikanAlumni.create(payload, { transaction: t });
        } else {
          // Upsert pendidikan
          const existing = await PendidikanAlumni.findOne({
            where: { nim, program_studi_id: programStudi.id },
            transaction: t,
          });

          if (!existing) {
            await PendidikanAlumni.create(payload, { transaction: t });
          } else {
            await existing.update(
              {
                tahun_masuk: payload.tahun_masuk ?? existing.tahun_masuk,
                tanggal_lulus: payload.tanggal_lulus ?? existing.tanggal_lulus,
                lama_studi_tahun: payload.lama_studi_tahun ?? existing.lama_studi_tahun,
                lama_studi_bulan: payload.lama_studi_bulan ?? existing.lama_studi_bulan,
                no_alumni: payload.no_alumni ?? existing.no_alumni,
                ipk: payload.ipk ?? existing.ipk,
                nilai_ujian: payload.nilai_ujian ?? existing.nilai_ujian,
                predikat_kelulusan: payload.predikat_kelulusan ?? existing.predikat_kelulusan,
                judul_tugas_akhir: payload.judul_tugas_akhir ?? existing.judul_tugas_akhir,
                ipb: payload.ipb ?? existing.ipb,
                strata: payload.strata ?? existing.strata,
              },
              { transaction: t }
            );
          }
        }
      } // end for rows

      await t.commit(); // ✅ sheet sukses full
    } catch (e) {
      await t.rollback(); // ❌ batalkan semua perubahan sheet ini

      // FAIL-FAST: hentikan seluruh commit; lempar error ke controller
      throw new Error(`Commit sheet "${sheetName}" gagal: ${e.message}`);

      // Jika kamu mau lanjut ke sheet berikutnya (non fail-fast), ganti 2 baris di atas dengan:
      // errors.push({ sheet: sheetName, error: e.message }); continue;
    }
  } // end for sheets

  // semua sheet sukses
  return { run_id: runId, message: "Commit sukses", sheets: sheets.length };
}

module.exports = { commitSheets };

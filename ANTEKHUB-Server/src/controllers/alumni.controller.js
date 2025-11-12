// File: src/controllers/alumni.controller.js
// Tujuan: CRUD Alumni + PendidikanAlumni (dinamis, 1..N)
// Keamanan/Validasi: add & edit wajib minimal 1 record pendidikan; validasi enum & field krusial
// Catatan: gunakan transaction agar konsisten antara alumni & pendidikan

const { Op } = require("sequelize");
const {
  sequelize,
  Alumni,
  PendidikanAlumni,
  ProgramStudi,
} = require("../models");
const {
  createSchema,
  updateSchema,
} = require("../validators/alumni.validator");

// ===== Util =====
const ALLOWED_LIMITS = new Set([20, 50, 100]);

const sanitizeAlumni = (row) => {
  if (!row) return row;
  const plain = row.get ? row.get({ plain: true }) : row;
  return plain; // tidak ada field sensitif pada model Alumni
};

// const normalizeLimit = (raw) => {
//   const n = Number(raw || 20);
//   return ALLOWED_LIMITS.has(n) ? n : 20;
// };

// Helper: normalisasi limit agar tidak kebablasan
function normalizeLimit(val, fallback = 20, max = 100) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

// Helper: ubah input jadi array (dukung ?a=x&a=y atau ?a=x,y)
function toArray(q) {
  if (q == null) return [];
  if (Array.isArray(q)) return q.flatMap(v => String(v).split(','));
  return String(q).split(',');
}

// Helper: map error DB enum → 400
function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || "";
  if (/invalid input value for enum/i.test(msg) || /enum/i.test(msg)) {
    return { status: 400, message: "Input enum tidak valid", detail: msg };
  }
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: "Format UUID tidak valid", detail: msg };
  }
  return null;
}

// ====== ADD ======
exports.add = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // ✅ VALIDASI AWAL
    const payload = await createSchema.validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    // Insert alumni (mengikuti model Alumni) — field inti tersedia di model
    const alumni = await Alumni.create(
      {
        nama: payload.nama,
        tempat_lahir: payload.tempat_lahir,
        tanggal_lahir: payload.tanggal_lahir,
        agama: payload.agama,
        suku_id: payload.suku_id || null,
        bangsa_id: payload.bangsa_id || null,
        alamat: payload.alamat,
        no_telp: payload.no_telp,
      },
      { transaction: t }
    );

    // Insert pendidikan (1..n) — resolve program_studi via nama + strata
    for (const p of payload.pendidikan) {
      const prodi = await ProgramStudi.findOne({
        where: { nama: p.program_studi, strata: p.strata },
        transaction: t,
      });
      if (!prodi) {
        throw new Error(
          `Program studi '${p.program_studi}' dengan strata '${p.strata}' tidak ditemukan`
        );
      }

      await PendidikanAlumni.create(
        {
          alumni_id: alumni.id,
          nim: p.nim,
          program_studi_id: prodi.id,
          tahun_masuk: p.tahun_masuk,
          lama_studi_tahun: p.lama_studi_tahun,
          lama_studi_bulan: p.lama_studi_bulan,
          no_alumni: p.no_alumni,
          tanggal_lulus: p.tanggal_lulus,
          nilai_ujian: p.nilai_ujian,
          ipk: p.ipk,
          predikat_kelulusan: p.predikat_kelulusan,
          judul_tugas_akhir: p.judul_tugas_akhir ?? null,
          ipb: p.ipb ?? null,
        },
        { transaction: t }
      );
    }

    await t.commit();
    return res.status(201).json({ message: "Alumni dibuat", data: alumni });
  } catch (err) {
    await t.rollback();

    if (err.isJoi) {
      return res.status(422).json({
        message: "Validasi gagal",
        errors: err.details.map((d) => ({
          path: d.path.join("."),
          message: d.message,
        })),
      });
    }

    const mapped = mapSequelizeError(err);
    if (mapped) {
      return res
        .status(mapped.status)
        .json({ message: mapped.message, detail: mapped.detail });
    }

    console.error("alumni.add error:", err);
    return res
      .status(500)
      .json({ message: "Gagal membuat alumni", detail: err.message });
  }
};

// ====== GET ALL (pagination, filter, search) ======
// Query:
//   page=1&limit=20|50|100
//   strata=... (boleh banyak: ?strata=Sarjana&strata=Magister)
//   program_studi=Teknik Sipil (boleh banyak, exact match nama)
//   angkatan=2020 (tahun_masuk; boleh banyak)
//   search=nama (iLike)
exports.getAll = async (req, res) => {
  try {
    // --- Pagination ---
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = normalizeLimit(req.query.limit);
    const offset = (page - 1) * limit;

    // --- Filters (support repeat & comma-separated) ---
    const search = (req.query.search || '').trim();

    const strata = toArray(req.query.strata)
      .map(s => s && String(s).trim())
      .filter(Boolean);

    const prodi = toArray(req.query.program_studi)
      .map(s => s && String(s).trim())
      .filter(Boolean);

    const angkatan = toArray(req.query.angkatan)
      .map(n => Number(n))
      .filter(Number.isFinite);

    // --- WHERE blocks ---
    const whereAlumni = {};
    if (search) {
      whereAlumni.nama = { [Op.iLike]: `%${search}%` };
    }

    const wherePendidikan = {};
    if (angkatan.length) {
      wherePendidikan.tahun_masuk = { [Op.in]: angkatan };
    }

    const whereProgram = {};
    if (prodi.length) {
      whereProgram.nama = { [Op.in]: prodi };
    }
    if (strata.length) {
      whereProgram.strata = { [Op.in]: strata };
    }

    // --- Required flags ---
    const needProgram = Object.keys(whereProgram).length > 0;
    const needPendidikan =
      Object.keys(wherePendidikan).length > 0 || needProgram;

    // --- Query utama ---
    const alumni = await Alumni.findAndCountAll({
      where: whereAlumni,
      include: [
        {
          model: PendidikanAlumni,
          as: 'riwayat_pendidikan',
          required: needPendidikan, // parent ikut join jika anak difilter
          where: needPendidikan ? wherePendidikan : undefined,
          include: [
            {
              model: ProgramStudi,
              as: 'program_studi',
              required: needProgram, // wajib kalau ada filter strata/prodi
              where: needProgram ? whereProgram : undefined,
            },
          ],
        },
      ],
      // Gunakan kolom milik tabel utama; tidak perlu kualifikasi berlebihan
      order: [['updated_at', 'DESC']],
      limit,
      offset,
      distinct: true,   // mencegah count dobel karena join
      subQuery: false,  // KUNCI: cegah alias hilang di outer query (PG)
      // logging: console.log, // aktifkan untuk debug query SQL jika perlu
    });

    return res.json({
      data: alumni.rows,
      meta: {
        total: alumni.count,
        page,
        limit,
        pages: Math.ceil(alumni.count / limit),
      },
    });
  } catch (err) {
    console.error('alumni.getAll error:', err);
    return res.status(500).json({
      message: 'Gagal mengambil data alumni',
      detail: err.message,
    });
  }
};

// ====== GET ONE by uuid ======
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await Alumni.findOne({
      where: { uuid },
      include: [
        {
          model: PendidikanAlumni,
          as: "riwayat_pendidikan",
          include: [{ model: ProgramStudi, as: "program_studi" }],
        },
      ],
      order: [
        [
          { model: PendidikanAlumni, as: "riwayat_pendidikan" },
          "updated_at",
          "DESC",
        ],
      ],
    });
    if (!row)
      return res.status(404).json({ message: "Alumni tidak ditemukan" });
    return res.json({ data: sanitizeAlumni(row) });
  } catch (err) {
    console.error("alumni.getOne error:", err);
    return res.status(500).json({ message: "Gagal mengambil data alumni" });
  }
};

// ====== UPDATE by uuid (parsial; pendidikan dinamis) ======
// Body boleh berisi:
//   alumni: {...} (optional)
//   pendidikan: [ { uuid?, ...fields }, ... ] (optional) → default: append baris baru
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await Alumni.findOne({ where: { uuid } });
    if (!row)
      return res.status(404).json({ message: "Alumni tidak ditemukan" });

    // ✅ VALIDASI AWAL (parsial)
    const payload = await updateSchema.validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    // Update field alumni jika ada
    const alumniUpdate = {};
    [
      "nama",
      "tempat_lahir",
      "tanggal_lahir",
      "agama",
      "alamat",
      "no_telp",
    ].forEach((k) => {
      if (typeof payload[k] !== "undefined") alumniUpdate[k] = payload[k];
    });
    if (Object.keys(alumniUpdate).length > 0) {
      await row.update(alumniUpdate, { transaction: t });
    }

    // Tambah baris pendidikan baru (append) bila ada
    if (Array.isArray(payload.pendidikan) && payload.pendidikan.length > 0) {
      for (const p of payload.pendidikan) {
        const prodi = await ProgramStudi.findOne({
          where: { nama: p.program_studi, strata: p.strata },
          transaction: t,
        });
        if (!prodi) {
          throw new Error(
            `Program studi '${p.program_studi}' dengan strata '${p.strata}' tidak ditemukan`
          );
        }

        await PendidikanAlumni.create(
          {
            alumni_id: row.id,
            nim: p.nim,
            program_studi_id: prodi.id,
            tahun_masuk: p.tahun_masuk,
            lama_studi_tahun: p.lama_studi_tahun,
            lama_studi_bulan: p.lama_studi_bulan,
            no_alumni: p.no_alumni,
            tanggal_lulus: p.tanggal_lulus,
            nilai_ujian: p.nilai_ujian,
            ipk: p.ipk,
            predikat_kelulusan: p.predikat_kelulusan,
            judul_tugas_akhir: p.judul_tugas_akhir ?? null,
            ipb: p.ipb ?? null,
          },
          { transaction: t }
        );
      }
    }

    await t.commit();
    return res.json({ message: "Alumni diperbarui", data: row });
  } catch (err) {
    await t.rollback();

    if (err.isJoi) {
      return res.status(422).json({
        message: "Validasi gagal",
        errors: err.details.map((d) => ({
          path: d.path.join("."),
          message: d.message,
        })),
      });
    }

    const mapped = mapSequelizeError(err);
    if (mapped) {
      return res
        .status(mapped.status)
        .json({ message: mapped.message, detail: mapped.detail });
    }

    console.error("alumni.update error:", err);
    return res.status(500).json({ message: "Gagal memperbarui alumni" });
  }
};

// ====== DELETE by uuid (single / batch "a,b,c") ======
exports.deleteByUuid = async (req, res) => {
  try {
    let uuids = [];

    if (req.params.uuid) {
      uuids = req.params.uuid
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    } else if (Array.isArray(req.body.uuids)) {
      uuids = req.body.uuids.filter(Boolean);
    }

    if (!uuids.length)
      return res.status(400).json({ message: "UUID tidak diberikan" });

    const found = await Alumni.findAll({
      where: { uuid: { [Op.in]: uuids } },
      attributes: ["uuid"],
    });

    if (!found.length)
      return res.status(404).json({ message: "Data alumni tidak ditemukan" });

    const deleted = await Alumni.destroy({
      where: { uuid: { [Op.in]: uuids } },
    });

    return res.json({
      message: `Berhasil menghapus ${deleted} data alumni`,
      deleted,
      uuids,
    });
  } catch (err) {
    console.error("alumni.deleteByUuid error:", err);
    return res.status(500).json({
      message: "Gagal menghapus alumni",
      detail: err.message,
    });
  }
};

// ====== DELETE ALL (opsional, lindungi dengan role ketat) ======
exports.deleteAll = async (_req, res) => {
  try {
    const del = await Alumni.destroy({ where: {} });
    return res.json({
      message: "Semua alumni & pendidikan terhapus",
      deleted: del,
    });
  } catch (err) {
    console.error("alumni.deleteAll error:", err);
    return res
      .status(500)
      .json({ message: "Gagal menghapus semua alumni", detail: err.message });
  }
};

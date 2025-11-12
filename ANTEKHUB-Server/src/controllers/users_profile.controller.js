const path = require("path");
const { z } = require("zod");
const { Op } = require("sequelize");

const {
  Users,
  Alumni,
  PendidikanAlumni,
  UsersProfile,
  ReferensiPerusahaan,
  ReferensiJabatan,
  BidangIndustri,
  JenisInstitusi,
  Bangsa,
  Provinsi,
  KabupatenKota,
} = require("../models");

const {
  uploadBufferToDrive,
  USERS_PROFILE_DRIVE_FOLDER_ID,
  deleteDriveFile,
} = require("../services/googleDrive");
const {
  findOrCreateRefPerusahaanBySimilarity,
  findOrCreateRefJabatanBySimilarity,
} = require("../utils/refs");

const FRESH_SET = new Set([
  "Fresh Graduate",
  "Sedang mencari pekerjaan",
  "Sedang Menempuh Studi Lanjut",
]);

// ===== Zod Schemas =====
const DomisiliSchema = z
  .object({
    alamat: z.string().max(255).nullish(),
    longitude: z.number().finite().min(-180).max(180).nullish(),
    latitude: z.number().finite().min(-90).max(90).nullish(),
  })
  .strict();

const PerusahaanSchema = z
  .object({
    nama: z.string().min(2).max(200),
    alamat: z.string().max(255).nullish(),
    jenis_institusi_id: z.number().int().positive().nullish(),
    bidang_industri_id: z.number().int().positive().nullish(),
    jabatan_nama: z.string().min(2).max(200).nullish(),
  })
  .strict();

const CreateProfileSchema = z
  .object({
    status: z.enum([
      "Bekerja",
      "Wirausaha",
      "Fresh Graduate",
      "Sedang mencari pekerjaan",
      "Sedang Menempuh Studi Lanjut",
    ]),
    domisili: DomisiliSchema.nullish(),
    dom_eq_job: z.boolean().nullish(),
    perusahaan: PerusahaanSchema.nullish(),
  })
  .strict();

// ===== Helpers =====
async function resolvePhoto(req) {
  if (req.file && req.file.buffer) {
    const uploaded = await uploadBufferToDrive(req.file, {
      folderId: USERS_PROFILE_DRIVE_FOLDER_ID,
      customFileName: `photo_${Date.now()}_${req.file.originalname}`,
    });
    return {
      photo_profile_path: uploaded.id || null,
      photo_profile_url: uploaded.webViewLink || null
    };
  }
  return {
    photo_profile_path: path.join(
      __dirname,
      "../../public/defaul-photo-profile.jpg"
    ),
    photo_profile_url: null,
  };
}

// ===== Helper: resolve Program Studi name aman jika model tidak ada =====
async function resolveProgramStudiName(program_studi_id) {
  try {
    const { ProgramStudi } = require("../models");
    if (ProgramStudi && program_studi_id) {
      const ps = await ProgramStudi.findByPk(program_studi_id);
      return ps?.nama ?? String(program_studi_id);
    }
  } catch (_) {}
  return program_studi_id ? String(program_studi_id) : null;
}

function dateOnlyPlusYears(yrs = 1, from = new Date()) {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + yrs);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Helper agar multipart "body" (JSON string) & nested stringified fields tetap kebaca
function parseBodyFromReq(req) {
  let raw = req.body?.body ?? req.body; // dukung field 'body' dari multipart
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch (_) {}
  }
  // parse nested jika dikirim sebagai string
  if (raw && typeof raw.domisili === "string") {
    try { raw.domisili = JSON.parse(raw.domisili); } catch (_) {}
  }
  if (raw && typeof raw.perusahaan === "string") {
    try { raw.perusahaan = JSON.parse(raw.perusahaan); } catch (_) {}
  }
  if (raw?.perusahaan && typeof raw.perusahaan.lokasi === "string") {
    try { raw.perusahaan.lokasi = JSON.parse(raw.perusahaan.lokasi); } catch (_) {}
  }
  return raw;
}


exports.createByUsersUuid = async (req, res) => {
  const usersUuid = req.params.users_uuid || req.params.usersUuid;
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const user = await Users.findOne({ where: { uuid: usersUuid } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (req.user.uuid !== usersUuid) return res.status(403).json({ message: "Forbidden" });

    let body = parseBodyFromReq(req);
    const parsed = CreateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(422).json({ message: "Invalid payload", issues: parsed.error.issues });
    }
    const { status, domisili, dom_eq_job: domEqReq, perusahaan } = parsed.data;

    // enforce rules:
    const isFresh = ["Fresh Graduate","Sedang Mencari Pekerjaan","Sedang Menempuh Studi Lanjut","Internship"].includes(status);
    const isWorkingOrEntre = ["Bekerja","Wirausaha"].includes(status);

    // dom_eq_job default
    let dom_eq_job = !!domEqReq;
    if (!isWorkingOrEntre) dom_eq_job = true; // non-working -> sama dengan domisili (tak ada lokasi perusahaan)

    await Users.sequelize.transaction(async (t) => {
      const exists = await UsersProfile.findOne({ where: { user_id: user.id }, transaction: t });
      if (exists) throw Object.assign(new Error("Profile already exists"), { http: 409 });

      // foto
      const { photo_profile_path, photo_profile_url } = await resolvePhoto(req);

      // Referensi (optional, dari input manual perusahaan/jabatan)
      let refPerusahaan = null, refJabatan = null;
      if (isWorkingOrEntre && perusahaan?.nama) {
        refPerusahaan = await findOrCreateRefPerusahaanBySimilarity({
          models: { ReferensiPerusahaan, JenisInstitusi, BidangIndustri },
          nama: perusahaan.nama,
          jenis_institusi_id: perusahaan.jenis_institusi_id,
          bidang_industri_id: perusahaan.bidang_industri_id,
          alamat: perusahaan.alamat,
          t,
        });
      }
      if (isWorkingOrEntre && perusahaan?.jabatan_nama) {
        refJabatan = await findOrCreateRefJabatanBySimilarity({
          models: { ReferensiJabatan },
          jabatan_nama: perusahaan.jabatan_nama,
          t,
        });
      }

      // Lokasi perusahaan final (ikut domisili jika dom_eq_job = true)
      const perusahaan_lokasi = (() => {
        if (!isWorkingOrEntre) return {}; // kosong untuk non-working
        if (dom_eq_job) {
          return {
            perusahaan_negara_id: domisili.negara_id,
            perusahaan_provinsi_id: domisili.provinsi_id,
            perusahaan_kabupaten_id: domisili.kabupaten_id,
            perusahaan_alamat: perusahaan?.lokasi?.alamat || perusahaan?.alamat || domisili.alamat,
            longitude: undefined, // privasi; boleh isi jika kamu ingin identik dengan domisili—model tidak punya long/lat domisili
            latitude: undefined,
          };
        }
        // Jika dom_eq_job = false, gunakan perusahaan.lokasi (bila ada)
        return perusahaan?.lokasi ? {
          perusahaan_negara_id: perusahaan.lokasi.negara_id,
          perusahaan_provinsi_id: perusahaan.lokasi.provinsi_id,
          perusahaan_kabupaten_id: perusahaan.lokasi.kabupaten_id,
          perusahaan_alamat: perusahaan.lokasi.alamat || perusahaan?.alamat || null,
          longitude: perusahaan.lokasi.longitude,
          latitude: perusahaan.lokasi.latitude,
        } : {};
      })();

      // valid_until (+1 tahun)
      const valid_until = dateOnlyPlusYears(1);

      const created = await UsersProfile.create({
        user_id: user.id,
        status,

        // DOMISILI (wajib)
        domisili_negara_id: domisili.negara_id,
        domisili_provinsi_id: domisili.provinsi_id,
        domisili_kabupaten_id: domisili.kabupaten_id,
        domisili_alamat: domisili.alamat,

        // PERUSAHAAN (input manual)
        nama_perusahaan: isWorkingOrEntre ? perusahaan?.nama || null : null,
        jenis_perusahaan_input_id: isWorkingOrEntre ? perusahaan?.jenis_institusi_id || null : null,
        bidang_industri_input_id: isWorkingOrEntre ? perusahaan?.bidang_industri_id || null : null,

        // referensi
        referensi_perusahaan_id: isWorkingOrEntre ? (refPerusahaan?.id || null) : null,
        referensi_jabatan_id: isWorkingOrEntre ? (refJabatan?.id || null) : null,

        // LOKASI PERUSAHAAN
        ...perusahaan_lokasi,

        // Jabatan (input manual)
        jabatan: isWorkingOrEntre ? (perusahaan?.jabatan_nama || null) : null,

        // flags & media
        dom_eq_job,
        photo_profile_path,
        photo_profile_url,
        valid_until,
        reminder_stage: 0,
        last_reminder_sent_at: null
      }, { transaction: t });

      // Update agregat referensi perusahaan (opsional)
      if (refPerusahaan && isWorkingOrEntre) {
        if (typeof refPerusahaan.total_alumni === "number") {
          refPerusahaan.total_alumni = (refPerusahaan.total_alumni || 0) + 1;
          await refPerusahaan.save({ transaction: t });
        }
      }

      await user.update({ is_fill_profile: true }, { transaction: t });

      return res.status(201).json({
        uuid: created.uuid,
        photo_profile_path,
        photo_profile_url,
        valid_until,
      });
    });
  } catch (err) {
    const status = err.http || 500;
    if (status === 500) console.error(err);
    return res.status(status).json({ message: err.message || "Internal error" });
  }
};

// ====== GET #1: Profil lengkap by users.uuid ======
exports.getByUsersUuid = async (req, res) => {
  const usersUuid = req.params.users_uuid || req.params.usersUuid;

  const user = await Users.findOne({ where: { uuid: usersUuid } });
  if (!user) return res.status(404).json({ message: "User not found" });

  const alumni = user.alumni_id ? await Alumni.findByPk(user.alumni_id) : null;
  const profile = await UsersProfile.findOne({ where: { user_id: user.id } });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  const edu = user.alumni_id
    ? await PendidikanAlumni.findOne({ where: { alumni_id: user.alumni_id }, order: [["id", "DESC"]] })
    : null;
  const program_studi = await resolveProgramStudiName(edu?.program_studi_id);

  const refPerusahaan = profile.referensi_perusahaan_id
    ? await ReferensiPerusahaan.findByPk(profile.referensi_perusahaan_id)
    : null;
  const refJabatan = profile.referensi_jabatan_id
    ? await ReferensiJabatan.findByPk(profile.referensi_jabatan_id)
    : null;

  // Ambil nama wilayah domisili (opsional)
  const domNeg = profile.domisili_negara_id ? await Bangsa.findByPk(profile.domisili_negara_id) : null;
  const domProv = profile.domisili_provinsi_id ? await Provinsi.findByPk(profile.domisili_provinsi_id) : null;
  const domKab = profile.domisili_kabupaten_id ? await KabupatenKota.findByPk(profile.domisili_kabupaten_id) : null;

  // Ambil nama wilayah perusahaan (opsional)
  const perNeg = profile.perusahaan_negara_id ? await Bangsa.findByPk(profile.perusahaan_negara_id) : null;
  const perProv = profile.perusahaan_provinsi_id ? await Provinsi.findByPk(profile.perusahaan_provinsi_id) : null;
  const perKab = profile.perusahaan_kabupaten_id ? await KabupatenKota.findByPk(profile.perusahaan_kabupaten_id) : null;

  return res.json({
    nama: alumni?.nama ?? null,
    tempat_lahir: alumni?.tempat_lahir ?? null,
    tanggal_lahir: alumni?.tanggal_lahir ?? null,
    email: user.email,

    program_studi,
    angkatan: edu?.tahun_masuk ?? null,

    status: profile.status,
    domisili: {
      negara: domNeg?.nama ?? null,
      provinsi: domProv?.nama ?? null,
      kabupaten: domKab?.nama ?? null,
      alamat: profile.domisili_alamat,
    },

    perusahaan: profile.nama_perusahaan ? {
      nama: refPerusahaan?.nama_perusahaan || profile.nama_perusahaan,
      alamat: profile.perusahaan_alamat,
      negara: perNeg?.nama ?? null,
      provinsi: perProv?.nama ?? null,
      kabupaten: perKab?.nama ?? null,
      longitude: profile.longitude,
      latitude: profile.latitude,
    } : null,

    jabatan: refJabatan?.jabatan || profile.jabatan || null,

    photo_profile_path: profile.photo_profile_path,
    photo_profile_url: profile.photo_profile_url,
  });
};

// ====== GET #2: Tracking Map (filters & nested) ======

// Query schema (semua opsional)
const TrackingQuerySchema = z
  .object({
    perusahaan: z.string().min(1).optional(),
    kabupaten: z.string().min(1).optional(),
    provinsi: z.string().min(1).optional(),
    negara: z.string().min(1).optional(), // bisa nama/ISO; kita cocokan by nama dulu
    bidang_industri_id: z.coerce.number().int().positive().optional(),
    jenis_institusi_id: z.coerce.number().int().positive().optional(),
  })
  .strict();

function ensureKey(obj, key, initVal) {
  if (!obj[key]) obj[key] = initVal;
  return obj[key];
}

async function findKabupatenByNameLike(n) {
  if (!n) return null;
  return await KabupatenKota.findOne({
    where: { nama: { [Op.iLike]: `%${n}%` } },
  });
}

async function findProvinsiByNameLike(n) {
  if (!n) return null;
  return await Provinsi.findOne({ where: { nama: { [Op.iLike]: `%${n}%` } } });
}

async function findNegaraByNameLike(n) {
  if (!n) return null;
  return await Bangsa.findOne({ where: { nama: { [Op.iLike]: `%${n}%` } } });
}

function alumnItem({ alumni, edu, jabatan, perusahaan }) {
  return {
    nama: alumni?.nama ?? null,
    program_studi: edu?.program_studi_nama ?? null,
    angkatan: edu?.tahun_masuk ?? null,
    jabatan: jabatan?.jabatan ?? null,
    nama_perusahaan: perusahaan?.nama_perusahaan ?? null,
  };
}

exports.getAllTracking = async (req, res) => {
  const parsed = TrackingQuerySchema.safeParse(req.query || {});
  if (!parsed.success)
    return res
      .status(422)
      .json({ message: "Invalid query", issues: parsed.error.issues });
  const q = parsed.data;

  // Pre-resolve lokasi filter (opsional)
  const kabFilter = await findKabupatenByNameLike(q.kabupaten);
  const provFilter = await findProvinsiByNameLike(q.provinsi);
  const negFilter = await findNegaraByNameLike(q.negara);

  // Build where untuk perusahaan (status Bekerja/Wirausaha)
  const whereCompany = {};
  if (q.perusahaan)
    whereCompany.nama_perusahaan = { [Op.iLike]: `%${q.perusahaan}%` };
  if (q.bidang_industri_id)
    whereCompany.bidang_industri_id = q.bidang_industri_id;
  if (q.jenis_institusi_id)
    whereCompany.jenis_perusahaan_id = q.jenis_institusi_id;
  if (kabFilter) whereCompany.perusahaan_kabupaten_id = kabFilter.id;
  if (provFilter) whereCompany.perusahaan_provinsi_id = provFilter.id;
  if (negFilter) whereCompany.perusahaan_negara_id = negFilter.id;

  // 1) Ambil profil Bekerja/Wirausaha (punya perusahaan)
  const workingProfiles = await UsersProfile.findAll({
  where: { status: { [Op.in]: ["Bekerja", "Wirausaha"] } },
  include: [
    { model: Users, as: "user", required: true }, // ⬅️ alias benar
    { model: ReferensiPerusahaan, as: "referensi_perusahaan", where: whereCompany, required: true },
    { model: ReferensiJabatan, as: "referensi_jabatan", required: false },
  ],
});

  // 2) Ambil profil Fresh/Sedang (tanpa perusahaan) → map ke Kab/Kota (heuristik by alamat/filters)
  const freshProfiles = await UsersProfile.findAll({
    where: {
      status: {
        [Op.in]: [
          "Fresh Graduate",
          "Sedang mencari pekerjaan",
          "Sedang Menempuh Studi Lanjut",
        ],
      },
    },
    include: [{ model: Users, as: "user", required: true }],
  });

  // Map edukasi untuk semua user yang tampil (cache by alumni_id)
  const userIds = Array.from(
    new Set(
      [...workingProfiles, ...freshProfiles]
        .map((p) => p.Users?.id)
        .filter(Boolean)
    )
  );
  // Ambil Alumni + Pendidikan terakhir
  const usersMap = new Map();
  for (const p of [...workingProfiles, ...freshProfiles]) {
    const u = p.users;
    if (!u || usersMap.has(u.id)) continue;
    const alumni = u.alumni_id ? await Alumni.findByPk(u.alumni_id) : null;
    let edu = null;
    if (u.alumni_id) {
      const e = await PendidikanAlumni.findOne({
        where: { alumni_id: u.alumni_id },
        order: [["id", "DESC"]],
      });
      edu = {
        tahun_masuk: e?.tahun_masuk ?? null, // :contentReference[oaicite:14]{index=14}
        program_studi_nama: await resolveProgramStudiName(e?.program_studi_id),
      };
    }
    usersMap.set(u.id, { alumni, edu });
  }

  // Struktur hasil
  const result = {};

  // ==== Masukkan Bekerja/Wirausaha → pakai lokasi perusahaan + hierarchy negara/provinsi/kab ====
  for (const p of workingProfiles) {
    const u = p.user;
    const { alumni, edu } = usersMap.get(u.id) || {};
    const perusahaan = p.referensi_perusahaan;
    const jabatan = p.referensi_jabatan;

    // Resolve hierarki lokasi dari FK perusahaan
    const negara = perusahaan.perusahaan_negara_id
      ? await Bangsa.findByPk(perusahaan.perusahaan_negara_id)
      : null;
    const prov = perusahaan.perusahaan_provinsi_id
      ? await Provinsi.findByPk(perusahaan.perusahaan_provinsi_id)
      : null;
    const kab = perusahaan.perusahaan_kabupaten_id
      ? await KabupatenKota.findByPk(perusahaan.perusahaan_kabupaten_id)
      : null;

    // Nama keys
    const keyNeg = negara?.nama || "Tidak Diketahui";
    const keyProv = prov?.nama || "Tidak Diketahui";
    const keyKab = kab?.nama || "Tidak Diketahui";
    const keyPeru = perusahaan?.nama_perusahaan || "Tidak Diketahui";

    const bucketNeg = ensureKey(result, keyNeg, {});
    const bucketProv = ensureKey(bucketNeg, keyProv, {});
    const bucketKab = ensureKey(bucketProv, keyKab, {});

    // node perusahaan
    const nodePerusahaan = ensureKey(bucketKab, keyPeru, {
      list: [],
      bidang_industri: null,
      jenis_institusi: null,
    });

    // bidang & jenis (lookup opsional)
    if (perusahaan.bidang_industri_id) {
      const bi = await BidangIndustri.findByPk(perusahaan.bidang_industri_id);
      nodePerusahaan.bidang_industri = bi?.nama ?? null; // :contentReference[oaicite:15]{index=15}
    }
    if (perusahaan.jenis_perusahaan_id) {
      const ji = await JenisInstitusi.findByPk(perusahaan.jenis_perusahaan_id);
      nodePerusahaan.jenis_institusi = ji?.nama ?? null; // :contentReference[oaicite:16]{index=16}
    }

    // list alumni
    nodePerusahaan.list.push(alumnItem({ alumni, edu, jabatan, perusahaan }));

    // koordinat node kabupaten (untuk marker cluster per kabupaten)
    bucketKab.longitude = kab?.longitude ?? null; // Kab: long/lat :contentReference[oaicite:17]{index=17}
    bucketKab.latitude = kab?.latitude ?? null;
  }

  // ==== Masukkan Fresh/Sedang → map ke kabupaten dari alamat / filter ====
  for (const p of freshProfiles) {
    const u = p.Users;
    const { alumni, edu } = usersMap.get(u.id) || {};

    // Prioritas mapping kabupaten:
    // 1) Jika query kabupaten/provinsi/negara ada → gunakan itu sebagai anchor
    // 2) Jika tidak, coba deteksi dari dom_alamat dengan LIKE
    let kab = kabFilter || (await findKabupatenByNameLike(p.dom_alamat || ""));
    let prov = kab
      ? await Provinsi.findByPk(kab.provinsi_id)
      : provFilter || null;
    let negara = prov
      ? await Bangsa.findByPk(prov.bangsa_id)
      : negFilter || null;

    const keyNeg = negara?.nama || "Tidak Diketahui";
    const keyProv = prov?.nama || "Tidak Diketahui";
    const keyKab = kab?.nama || "Tidak Diketahui";
    const keyPeru = "Tanpa Perusahaan";

    const bucketNeg = ensureKey(result, keyNeg, {});
    const bucketProv = ensureKey(bucketNeg, keyProv, {});
    const bucketKab = ensureKey(bucketProv, keyKab, {});
    const nodePerusahaan = ensureKey(bucketKab, keyPeru, {
      list: [],
      bidang_industri: null,
      jenis_institusi: null,
    });

    nodePerusahaan.list.push(
      alumnItem({ alumni, edu, jabatan: null, perusahaan: null })
    );

    // koordinat kabupaten (untuk fresh statuses): gunakan long/lat kabupaten
    bucketKab.longitude = kab?.longitude ?? null; // Kab: long/lat :contentReference[oaicite:18]{index=18}
    bucketKab.latitude = kab?.latitude ?? null;
  }

  return res.json(result);
};

// ===== Update Photo Only =====
exports.updatePhoto = async (req, res) => {
  const usersUuid = req.params.users_uuid;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const user = await Users.findOne({ where: { uuid: usersUuid } });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (req.user.uuid !== usersUuid)
    return res.status(403).json({ message: "Forbidden" });

  const profile = await UsersProfile.findOne({ where: { user_id: user.id } });
  if (!profile) return res.status(404).json({ message: "Profile not found" });
  if (!req.file || !req.file.buffer)
    return res.status(422).json({ message: "photo file is required" });

  // Hapus file lama di Drive bila path tampak sebagai fileId (tanpa slash)
  if (profile.photo_profile_path && !profile.photo_profile_path.includes("/")) {
    await deleteDriveFile(profile.photo_profile_path).catch(() => {});
  }

  const uploaded = await uploadBufferToDrive(req.file, {
    folderId: USERS_PROFILE_DRIVE_FOLDER_ID,
    customFileName: `photo_${Date.now()}_${req.file.originalname}`,
  });

  await profile.update({
    photo_profile_path: uploaded.id || null,
    photo_profile_url: uploaded.webViewLink || null,
  });

  return res.json({
    ok: true,
    photo_profile_path: profile.photo_profile_path,
    photo_profile_url: profile.photo_profile_url,
  });
};

// ===== Delete Photo =====
exports.deletePhoto = async (req, res) => {
  const usersUuid = req.params.users_uuid;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const user = await Users.findOne({ where: { uuid: usersUuid } });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (req.user.uuid !== usersUuid)
    return res.status(403).json({ message: "Forbidden" });

  const profile = await UsersProfile.findOne({ where: { user_id: user.id } });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  if (profile.photo_profile_path && !profile.photo_profile_path.includes("/")) {
    await deleteDriveFile(profile.photo_profile_path).catch(() => {});
  }

  await profile.update({
    photo_profile_path: path.join(
      __dirname,
      "../../public/defaul-photo-profile.jpg"
    ),
    photo_profile_url: null,
  });

  return res.json({
    ok: true,
    photo_profile_path: profile.photo_profile_path,
    photo_profile_url: profile.photo_profile_url,
  });
};

const PeriodicSchema = z
  .object({
    status: z.enum([
      "Bekerja",
      "Wirausaha",
      "Fresh Graduate",
      "Sedang mencari pekerjaan",
      "Sedang Menempuh Studi Lanjut",
    ]),
    domisili: DomisiliSchema.nullish(),
    dom_eq_job: z.boolean().nullish(),
    perusahaan: PerusahaanSchema.nullish(),
  })
  .strict();

exports.periodicUpdate = async (req, res) => {
  const usersUuid = req.params.users_uuid || req.params.usersUuid;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const user = await Users.findOne({ where: { uuid: usersUuid } });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (req.user.uuid !== usersUuid) return res.status(403).json({ message: "Forbidden" });

  let body = parseBodyFromReq(req);
  const parsed = PeriodicSchema.safeParse(body);
  if (!parsed.success)
    return res.status(422).json({ message: "Invalid payload", issues: parsed.error.issues });

  const profile = await UsersProfile.findOne({ where: { user_id: user.id } });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  const { status, domisili, dom_eq_job: domEqReq, perusahaan } = parsed.data;
  const isFresh = ["Fresh Graduate","Sedang Mencari Pekerjaan","Sedang Menempuh Studi Lanjut","Internship"].includes(status);
  const isWorkingOrEntre = ["Bekerja","Wirausaha"].includes(status);

  let dom_eq_job = !!domEqReq;
  if (!isWorkingOrEntre) dom_eq_job = true;

  // lokasi perusahaan final
  let perusahaanPatch = {};
  if (isWorkingOrEntre) {
    if (dom_eq_job) {
      perusahaanPatch = {
        perusahaan_negara_id: domisili.negara_id,
        perusahaan_provinsi_id: domisili.provinsi_id,
        perusahaan_kabupaten_id: domisili.kabupaten_id,
        perusahaan_alamat: perusahaan?.lokasi?.alamat || perusahaan?.alamat || domisili.alamat,
        longitude: undefined,
        latitude: undefined,
      };
    } else if (perusahaan?.lokasi) {
      perusahaanPatch = {
        perusahaan_negara_id: perusahaan.lokasi.negara_id,
        perusahaan_provinsi_id: perusahaan.lokasi.provinsi_id,
        perusahaan_kabupaten_id: perusahaan.lokasi.kabupaten_id,
        perusahaan_alamat: perusahaan.lokasi.alamat || perusahaan?.alamat || null,
        longitude: perusahaan.lokasi.longitude,
        latitude: perusahaan.lokasi.latitude,
      };
    }
  } else {
    // non-working: kosongkan lokasi perusahaan
    perusahaanPatch = {
      perusahaan_negara_id: null,
      perusahaan_provinsi_id: null,
      perusahaan_kabupaten_id: null,
      perusahaan_alamat: null,
      longitude: null,
      latitude: null,
    };
  }

  // referensi (opsional)
  let refPerusahaan = null, refJabatan = null;
  if (isWorkingOrEntre && perusahaan?.nama) {
    refPerusahaan = await findOrCreateRefPerusahaanBySimilarity({
      models: { ReferensiPerusahaan, JenisInstitusi, BidangIndustri },
      nama: perusahaan.nama,
      jenis_institusi_id: perusahaan.jenis_institusi_id,
      bidang_industri_id: perusahaan.bidang_industri_id,
      alamat: perusahaan.alamat,
      t: null,
    });
  }
  if (isWorkingOrEntre && perusahaan?.jabatan_nama) {
    refJabatan = await findOrCreateRefJabatanBySimilarity({
      models: { ReferensiJabatan },
      jabatan_nama: perusahaan.jabatan_nama,
      t: null,
    });
  }

  const valid_until = dateOnlyPlusYears(1);

  await profile.update({
    status,

    // DOMISILI
    domisili_negara_id: domisili.negara_id,
    domisili_provinsi_id: domisili.provinsi_id,
    domisili_kabupaten_id: domisili.kabupaten_id,
    domisili_alamat: domisili.alamat,

    // PERUSAHAAN (manual)
    nama_perusahaan: isWorkingOrEntre ? (perusahaan?.nama || null) : null,
    jenis_perusahaan_input_id: isWorkingOrEntre ? (perusahaan?.jenis_institusi_id || null) : null,
    bidang_industri_input_id: isWorkingOrEntre ? (perusahaan?.bidang_industri_id || null) : null,
    jabatan: isWorkingOrEntre ? (perusahaan?.jabatan_nama || null) : null,

    // referensi
    referensi_perusahaan_id: isWorkingOrEntre ? (refPerusahaan?.id || null) : null,
    referensi_jabatan_id: isWorkingOrEntre ? (refJabatan?.id || null) : null,

    // lokasi perusahaan final
    ...perusahaanPatch,

    dom_eq_job,
    valid_until,
    reminder_stage: 0,
    last_reminder_sent_at: null,
  });

  await user.update({ is_fill_profile: true });

  return res.json({ ok: true });
};

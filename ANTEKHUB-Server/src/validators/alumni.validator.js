// File: src/validators/alumni.validator.js
const Joi = require("joi");

const strataEnum = [
  "Sarjana",
  "Magister",
  "Doktor",
  "Profesi Arsitektur",
  "Insinyur",
  "Diploma 3",
];
const predikatEnum = [
  "Summa Cum Laude",
  "Cum Laude",
  "Sangat Memuaskan",
  "Memuaskan",
  "Baik",
  "Cukup",
  "Kurang",
];
const agamaEnum = [
  "Islam",
  "Kristen Protestan",
  "Kristen Katholik",
  "Hindu",
  "Buddha",
  "Konghucu",
  "Lain-lain",
];
// Jika kamu punya daftar prodi tetap, gunakan enum; kalau tidak, biarkan string.
const prodiAllow = [
  "Teknik Sipil",
  "Teknik Mesin",
  "Teknik Elektro",
  "Teknik Informatika",
  "Teknik Industri",
  "Teknik Arsitektur",
  "Teknik Geologi",
  "Teknik Perkapalan",
  "Teknik Lingkungan",
  "Teknik Sistem Perkapalan ",
  "Teknik Peng. Wilayah Kota",
  "Teknik Kelautan",
  "Teknik Pertambangan",
  "Perencanaan Wilayah dan Kota",
  "Ilmu Arsitektur",
  "Teknologi Kebumian dan  Lingkungan",
  "Profesi Insinyur",
  "Profesi Arsitektur",
];

const nilaiUjianEnum = [
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
];

const pendidikanItem = Joi.object({
  nim: Joi.string().trim().max(20).required(),
  program_studi: Joi.string()
    .trim()
    .valid(...prodiAllow)
    .required(),
  strata: Joi.string()
    .valid(...strataEnum)
    .required(),
  tahun_masuk: Joi.number().integer().min(1980).max(2100).required(),
  lama_studi_tahun: Joi.number().integer().min(0).max(10).required(),
  lama_studi_bulan: Joi.number().integer().min(0).max(11).required(),
  no_alumni: Joi.string().trim().max(20).required(),
  tanggal_lulus: Joi.date().required(),
  nilai_ujian: Joi.string()
    .valid(...nilaiUjianEnum)
    .required(),
  ipk: Joi.number().min(0).max(4).required(),
  predikat_kelulusan: Joi.string()
    .valid(...predikatEnum)
    .required(),
  judul_tugas_akhir: Joi.alternatives().try(
    Joi.string().trim().max(255),
    Joi.allow(null)
  ),
  ipb: Joi.number().min(0).max(4).allow(null),
}).custom((value, helpers) => {
  // Aturan khusus: jika strata = Profesi Arsitektur → judul_tugas_akhir harus null
  if (value.strata === "Profesi Arsitektur" && value.judul_tugas_akhir) {
    return helpers.error("any.invalid", {
      message: "judul_tugas_akhir harus null untuk strata Profesi Arsitektur",
    });
  }
  return value;
}, "aturan strata-profesi");

exports.createSchema = Joi.object({
  nama: Joi.string().trim().min(2).max(120).required(),
  tempat_lahir: Joi.string().trim().max(120).required(),
  tanggal_lahir: Joi.date().required(),
  agama: Joi.string()
    .valid(...agamaEnum)
    .required(),
  alamat: Joi.string().trim().max(255).required(),
  no_telp: Joi.string().trim().max(25).required(),
  pendidikan: Joi.array().items(pendidikanItem).min(1).required(),
});

exports.updateSchema = Joi.object({
  nama: Joi.string().trim().min(2).max(120),
  tempat_lahir: Joi.string().trim().max(120),
  tanggal_lahir: Joi.date().allow(null),
  agama: Joi.string().valid(...agamaEnum),
  alamat: Joi.string().trim().max(255),
  no_telp: Joi.string().trim().max(25),
  // update pendidikan opsional; item-partial diperbolehkan
  pendidikan: Joi.array().items(
    pendidikanItem.fork(
      // buat sebagian optional saat update
      ["program_studi", "strata", "tahun_masuk", "nim"],
      (s) => s.optional()
    )
  ),
}).min(1);

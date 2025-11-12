"use strict";

// File: models/index.js
// Tujuan: Inisialisasi Sequelize, load semua model, dan definisikan relasi di satu tempat.
// Catatan: Sudah disesuaikan agar membaca dari config/config.json.

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const configPath = path.join(__dirname, "../../config/config.json");
const config = require(configPath)[env];
const db = {};

// --- Inisialisasi koneksi database ---
let sequelize;
if (config.use_env_variable) {
  // jika kamu pakai URL database (mis. di render/vercel)
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

// --- Load semua file model di folder models ---
fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js"
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

// --- Definisikan relasi di sini saja ---
if (db.Alumni && db.PendidikanAlumni) {
  db.Alumni.hasMany(db.PendidikanAlumni, {
    foreignKey: "alumni_id",
    as: "riwayat_pendidikan",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
  db.PendidikanAlumni.belongsTo(db.Alumni, {
    foreignKey: "alumni_id",
    as: "alumni",
    references: { model: "alumni", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  });
}

if (db.ProgramStudi && db.PendidikanAlumni) {
  db.ProgramStudi.hasMany(db.PendidikanAlumni, {
    foreignKey: "program_studi_id",
    as: "pendidikan_alumni",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.PendidikanAlumni.belongsTo(db.ProgramStudi, {
    foreignKey: "program_studi_id",
    as: "program_studi",
    references: { model: "program_studi", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  });
}

if (db.Bangsa && db.Alumni) {
  db.Bangsa.hasMany(db.Alumni, {
    foreignKey: "bangsa_id",
    as: "alumni",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.Alumni.belongsTo(db.Bangsa, {
    foreignKey: "bangsa_id",
    as: "bangsa",
  });
}

if (db.Bangsa && db.Provinsi) {
  db.Bangsa.hasMany(db.Provinsi, {
    foreignKey: "bangsa_id",
    as: "provinsi",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
  db.Provinsi.belongsTo(db.Bangsa, {
    foreignKey: "bangsa_id",
    as: "bangsa",
  });
}

if (db.Provinsi && db.KabupatenKota) {
  db.Provinsi.hasMany(db.KabupatenKota, {
    foreignKey: "provinsi_id",
    as: "kabupaten_kota",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
  db.KabupatenKota.belongsTo(db.Provinsi, {
    foreignKey: "provinsi_id",
    as: "provinsi",
  });
}

if (db.Suku && db.Alumni) {
  db.Suku.hasMany(db.Alumni, {
    foreignKey: "suku_id",
    as: "alumni",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.Alumni.belongsTo(db.Suku, {
    foreignKey: "suku_id",
    as: "suku",
  });
}

if (db.Bank && db.Rekening) {
  db.Bank.hasMany(db.Rekening, {
    foreignKey: "bank_id",
    as: "rekening",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });
  db.Rekening.belongsTo(db.Bank, {
    foreignKey: "bank_id",
    as: "bank",
  });
}

if (db.MetodePembayaran && db.SaluranPembayaran) {
  db.MetodePembayaran.hasMany(db.SaluranPembayaran, {
    foreignKey: "metode_pembayaran_id",
    as: "saluran_pembayaran",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });
  db.SaluranPembayaran.belongsTo(db.MetodePembayaran, {
    foreignKey: "metode_pembayaran_id",
    as: "metode_pembayaran",
  });
}

if (db.SaluranPembayaran && db.Pembayaran) {
  db.SaluranPembayaran.hasMany(db.Pembayaran, {
    foreignKey: "saluran_pembayaran_id",
    as: "pembayaran",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.Pembayaran.belongsTo(db.SaluranPembayaran, {
    foreignKey: "saluran_pembayaran_id",
    as: "saluran_pembayaran",
  });
}

if (db.Rekening && db.Pembayaran) {
  db.Rekening.hasMany(db.Pembayaran, {
    foreignKey: "rekening_id",
    as: "pembayaran",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.Pembayaran.belongsTo(db.Rekening, {
    foreignKey: "rekening_id",
    as: "rekening",
  });
}

if (db.InfoAlumni && db.Pembayaran) {
  db.InfoAlumni.hasMany(db.Pembayaran, {
    foreignKey: "event_id",
    as: "pembayaran",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.Pembayaran.belongsTo(db.InfoAlumni, {
    foreignKey: "event_id",
    as: "event",
  });
}

if (db.Users && db.UsersProfile) {
  db.Users.hasOne(db.UsersProfile, {
    foreignKey: "user_id",
    as: "profile",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
  db.UsersProfile.belongsTo(db.Users, {
    foreignKey: "user_id",
    as: "user",
  });
}

if (db.Users && db.Alumni) {
  db.Users.belongsTo(db.Alumni, {
    foreignKey: "alumni_id",
    as: "alumni",
  });
  db.Alumni.hasOne(db.Users, {
    foreignKey: "alumni_id",
    as: "user",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
}

if (db.Users && db.Pembayaran) {
  db.Users.hasMany(db.Pembayaran, {
    foreignKey: "user_id",
    as: "pembayaran",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });
  db.Pembayaran.belongsTo(db.Users, {
    foreignKey: "user_id",
    as: "user",
  });
}

if (db.ReferensiJabatan && db.UsersProfile) {
  db.ReferensiJabatan.hasMany(db.UsersProfile, {
    foreignKey: "referensi_jabatan_id",
    as: "users_profiles",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.UsersProfile.belongsTo(db.ReferensiJabatan, {
    foreignKey: "referensi_jabatan_id",
    as: "referensi_jabatan",
  });
}

if (db.ReferensiPerusahaan && db.UsersProfile) {
  db.ReferensiPerusahaan.hasMany(db.UsersProfile, {
    foreignKey: "referensi_perusahaan_id",
    as: "users_profiles",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.UsersProfile.belongsTo(db.ReferensiPerusahaan, {
    foreignKey: "referensi_perusahaan_id",
    as: "referensi_perusahaan",
  });
}

if (db.JenisInstitusi && db.ReferensiPerusahaan) {
  db.JenisInstitusi.hasMany(db.ReferensiPerusahaan, {
    foreignKey: "jenis_perusahaan_id",
    as: "referensi_perusahaan",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.ReferensiPerusahaan.belongsTo(db.JenisInstitusi, {
    foreignKey: "jenis_perusahaan_id",
    as: "jenis_perusahaan",
  });
}
if (db.BidangIndustri && db.ReferensiPerusahaan) {
  db.BidangIndustri.hasMany(db.ReferensiPerusahaan, {
    foreignKey: "bidang_industri_id",
    as: "referensi_perusahaan",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.ReferensiPerusahaan.belongsTo(db.BidangIndustri, {
    foreignKey: "bidang_industri_id",
    as: "bidang_industri",
  });
}
if (db.Bangsa && db.ReferensiPerusahaan) {
  db.Bangsa.hasMany(db.ReferensiPerusahaan, {
    foreignKey: "perusahaan_negara_id",
    as: "perusahaan",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.ReferensiPerusahaan.belongsTo(db.Bangsa, {
    foreignKey: "perusahaan_negara_id",
    as: "perusahaan_negara",
  });
}
if (db.Provinsi && db.ReferensiPerusahaan) {
  db.Provinsi.hasMany(db.ReferensiPerusahaan, {
    foreignKey: "perusahaan_provinsi_id",
    as: "perusahaan",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.ReferensiPerusahaan.belongsTo(db.Provinsi, {
    foreignKey: "perusahaan_provinsi_id",
    as: "perusahaan_provinsi",
  });
}
if (db.KabupatenKota && db.ReferensiPerusahaan) {
  db.KabupatenKota.hasMany(db.ReferensiPerusahaan, {
    foreignKey: "perusahaan_kabupaten_id",
    as: "perusahaan",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  db.ReferensiPerusahaan.belongsTo(db.KabupatenKota, {
    foreignKey: "perusahaan_kabupaten_id",
    as: "perusahaan_kabupaten",
  });
}

if (db.UsersAdmin && db.InfoAlumni) {
  db.UsersAdmin.hasMany(db.InfoAlumni, {
    foreignKey: "user_admin_id",
    as: "info_alumni",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });
  db.InfoAlumni.belongsTo(db.UsersAdmin, {
    foreignKey: "user_admin_id",
    as: "admin",
  });
}

// === Users <-> DeviceToken (1-N) ===
if (db.Users && db.DeviceToken) {
  db.Users.hasMany(db.DeviceToken, {
    foreignKey: "user_id",
    as: "device_tokens",
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  });
  db.DeviceToken.belongsTo(db.Users, {
    foreignKey: "user_id",
    as: "user",
  });
}

// === Users <-> Notification (1-N) ===
if (db.Users && db.Notification) {
  db.Users.hasMany(db.Notification, {
    foreignKey: "user_id",
    as: "notifications",
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  });
  db.Notification.belongsTo(db.Users, {
    foreignKey: "user_id",
    as: "user",
  });
}

// === Users <-> NotificationPreference (1-1) ===
if (db.Users && db.NotificationPreference) {
  db.Users.hasOne(db.NotificationPreference, {
    foreignKey: "user_id",
    as: "notification_pref",
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  });
  db.NotificationPreference.belongsTo(db.Users, {
    foreignKey: "user_id",
    as: "user",
  });
}

// === Users <-> EmailEvent (1-N) ===
if (db.Users && db.EmailEvent) {
  db.Users.hasMany(db.EmailEvent, {
    foreignKey: "user_id",
    as: "email_events",
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  });
  db.EmailEvent.belongsTo(db.Users, {
    foreignKey: "user_id",
    as: "user",
  });
}

// === AuthToken relasi (Users, Alumni, UsedBy) ===
if (db.AuthToken) {
  if (db.Users) {
    db.AuthToken.belongsTo(db.Users, {
      foreignKey: "user_id",
      as: "user",
    });
    db.AuthToken.belongsTo(db.Users, {
      foreignKey: "used_by_user_id",
      as: "used_by",
    });
  }
  if (db.Alumni) {
    db.AuthToken.belongsTo(db.Alumni, {
      foreignKey: "alumni_id",
      as: "alumni",
    });
  }
}

// Contoh untuk ke depan (nanti kamu aktifkan kalau tabelnya sudah ada):
// if (db.Alumni && db.User) {
//   db.Alumni.hasOne(db.User, { foreignKey: 'alumni_id', as: 'akun' });
//   db.User.belongsTo(db.Alumni, { foreignKey: 'alumni_id', as: 'alumni' });
// }
//
// if (db.UserAdmin && db.InfoAlumni) {
//   db.UserAdmin.hasMany(db.InfoAlumni, { foreignKey: 'dibuat_oleh', as: 'konten' });
//   db.InfoAlumni.belongsTo(db.UserAdmin, { foreignKey: 'dibuat_oleh', as: 'admin' });
// }

// --- Export semua model & koneksi Sequelize ---
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;

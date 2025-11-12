"use strict";

// File: models/users_profile.js
// Tujuan: Model profil lengkap pengguna aplikasi alumni
// Catatan: satu ke satu dengan Users

module.exports = (sequelize, DataTypes) => {
  const UsersProfile = sequelize.define(
    "UsersProfile",
    {
      id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },

      user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
      },

      status: {
        type: DataTypes.ENUM(
          "Bekerja",
          "Fresh Graduate",
          "Sedang Mencari Pekerjaan",
          "Sedang Menempuh Studi Lanjut",
          "Wirausaha",
          "Internship"
        ),
        allowNull: true,
      },

      // DOMISILI (FK ke master wilayah)
      domisili_negara_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },
      domisili_provinsi_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },
      domisili_kabupaten_id: {
        type: DataTypes.BIGINT,
        defaultValue: null
      },
      domisili_alamat: { type: DataTypes.STRING(255), allowNull: false },

      // PERUSAHAAN (input manual + referensi)
      nama_perusahaan: { type: DataTypes.STRING(255), allowNull: true },
      referensi_perusahaan_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },
      jenis_perusahaan_input_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },
      bidang_industri_input_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },

      // LOKASI PERUSAHAAN
      perusahaan_negara_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },
      perusahaan_provinsi_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },
      perusahaan_kabupaten_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },
      perusahaan_alamat: { type: DataTypes.STRING(255), allowNull: true },
      longitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        validate: {
          min: -180,
          max: 180,
        },
      },
      latitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        validate: {
          min: -90,
          max: 90,
        },
      },

      // JABATAN
      jabatan: { type: DataTypes.STRING(255), allowNull: true },
      referensi_jabatan_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },

      // MEDIA / VALIDITAS
      photo_profile_path: { type: DataTypes.STRING(200), allowNull: true },
      photo_profile_url: { type: DataTypes.STRING(200), allowNull: true },
      valid_until: { type: DataTypes.DATEONLY, allowNull: false },
      reminder_stage: { type: DataTypes.INTEGER, allowNull: false },
      last_reminder_sent_at: { type: DataTypes.DATEONLY, allowNull: TransformStreamDefaultController },
      
      // flag apakah domisili = lokasi kerja
      dom_eq_job: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "users_profile",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return UsersProfile;
};

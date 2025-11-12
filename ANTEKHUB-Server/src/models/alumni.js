"use strict";

// File: src/models/alumni.js
// Tujuan: Model master informasi alumni (non-login)
// Catatan: relasi 1..N ke PendidikanAlumni di-setup di models/index.js

module.exports = (sequelize, DataTypes) => {
  const Alumni = sequelize.define(
    "Alumni",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },

      // --- Data pokok ---
      nama: { type: DataTypes.STRING(100), allowNull: false },
      tempat_lahir: { type: DataTypes.STRING(100), allowNull: true }, // impor kadang kosong
      tanggal_lahir: { type: DataTypes.DATEONLY, allowNull: false },   // YYYY-MM-DD (tanpa Z)

      // ⚠️ Gunakan STRING di ORM agar tidak bentrok dengan ENUM PG (hindari values.map error)
      // DB tetap bisa pakai ENUM; Postgres akan validasi nilai yang dikirim ORM.
      agama: { type: DataTypes.STRING(50), allowNull: true },

      suku_id: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
      bangsa_id: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },

      alamat: { type: DataTypes.STRING(255), allowNull: true },
      no_telp: { type: DataTypes.STRING(32), allowNull: true },

      // Status akun pengguna aplikasi (biarkan STRING di ORM; default sama seperti sebelumnya)
      user_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Belum Mendaftar",
      },
    },
    {
      tableName: "alumni",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["uuid"] },
        { fields: ["nama"] },
        { fields: ["tanggal_lahir"] },
      ],
    }
  );

  return Alumni;
};

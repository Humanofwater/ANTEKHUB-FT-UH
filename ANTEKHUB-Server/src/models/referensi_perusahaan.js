"use strict";

// File: models/referensi_perusahaan.js
// Tujuan: Model untuk data referensi perusahaan
// Catatan: memiliki relasi ke jenis_institusi, bidang_industri, bangsa, provinsi, kabupaten_kota

module.exports = (sequelize, DataTypes) => {
  const ReferensiPerusahaan = sequelize.define(
    "ReferensiPerusahaan",
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
      nama_perusahaan: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },
      jenis_perusahaan_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },
      bidang_industri_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },
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
      perusahaan_alamat: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      longitude: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        validate: {
          min: -180,
          max: 180,
        },
      },
      latitude: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        validate: {
          min: -90,
          max: 90,
        },
      },
      alias_list: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      total_alumni: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "referensi_perusahaan",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          fields: ["nama_perusahaan"],
          name: "idx_ref_perusahaan_nama",
        },
      ],
    }
  );

  return ReferensiPerusahaan;
};

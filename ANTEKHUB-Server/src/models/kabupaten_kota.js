"use strict";

// File: models/kabupaten_kota.js
// Tujuan: Model untuk data kabupaten/kota
// Catatan: memiliki relasi ke Provinsi

module.exports = (sequelize, DataTypes) => {
  const KabupatenKota = sequelize.define(
    "KabupatenKota",
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
      provinsi_id: { 
        type: DataTypes.BIGINT, 
        allowNull: false 
      },
      nama: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      longitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
    },
    {
      tableName: "kabupaten_kota",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          unique: true,
          fields: ["provinsi_id", "nama"],
          name: "uq_kabupaten_kota_provinsi_nama",
        },
      ],
    }
  );

  return KabupatenKota;
};

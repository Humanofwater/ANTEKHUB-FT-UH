"use strict";

// File: models/rekening.js
// Tujuan: Model untuk data rekening bank
// Catatan: memiliki relasi ke Bank

module.exports = (sequelize, DataTypes) => {
  const Rekening = sequelize.define(
    "Rekening",
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
      nama_rekening: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      nomor_rekening: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      bank_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      deskripsi: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      aktif: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "rekening",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          fields: ["bank_id"],
          name: "idx_rekening_bank",
        },
        {
          unique: true,
          fields: ["bank_id", "nomor_rekening"],
          name: "uq_rekening_bank_no",
        },
      ],
    }
  );

  return Rekening;
};

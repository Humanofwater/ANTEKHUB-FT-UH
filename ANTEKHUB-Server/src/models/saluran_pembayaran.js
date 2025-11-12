"use strict";

// File: models/saluran_pembayaran.js
// Tujuan: Model untuk data saluran pembayaran
// Catatan: memiliki relasi ke MetodePembayaran

module.exports = (sequelize, DataTypes) => {
  const SaluranPembayaran = sequelize.define(
    "SaluranPembayaran",
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
      metode_pembayaran_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      kode_saluran: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: "e.g. BRI_VA, OVO, QRIS",
      },
      nama: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "saluran_pembayaran",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          fields: ["metode_pembayaran_id"],
          name: "idx_saluran_metode_id",
        },
      ],
    }
  );

  return SaluranPembayaran;
};

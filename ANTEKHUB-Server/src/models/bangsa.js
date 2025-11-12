"use strict";

// File: models/bangsa.js
// Tujuan: Model untuk data bangsa/negara
// Catatan: memiliki relasi ke Provinsi

module.exports = (sequelize, DataTypes) => {
  const Bangsa = sequelize.define(
    "Bangsa",
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
      nama: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      iso3: {
        type: DataTypes.STRING(3),
        allowNull: true,
      },
      iso2: {
        type: DataTypes.STRING(2),
        allowNull: true,
      },
      kode_telepon: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      region: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      subregion: {
        type: DataTypes.STRING(100),
        allowNull: true,
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
      tableName: "bangsa",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Bangsa;
};

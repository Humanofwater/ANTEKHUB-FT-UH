"use strict";

module.exports = (sequelize, DataTypes) => {
  const MetodePembayaran = sequelize.define(
    "MetodePembayaran",
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
      kode_metode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: "e.g. VA, QRIS, E-WALLET",
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
      tableName: "metode_pembayaran",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return MetodePembayaran;
};

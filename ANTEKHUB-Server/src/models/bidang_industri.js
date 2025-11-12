"use strict";

module.exports = (sequelize, DataTypes) => {
  const BidangIndustri = sequelize.define(
    "BidangIndustri",
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
      kode: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      nama: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      deskripsi: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "bidang_industri",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return BidangIndustri;
};

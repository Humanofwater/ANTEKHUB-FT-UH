"use strict";

module.exports = (sequelize, DataTypes) => {
  const Bank = sequelize.define(
    "Bank",
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
      kategori: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: "BANK / E-WALLET / GATEWAY",
      },
    },
    {
      tableName: "bank",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Bank;
};

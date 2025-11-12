"use strict";

// File: models/suppression_list.js
// Tujuan: Simpan email yang harus di-suppress (bounce/complaint/manual)

module.exports = (sequelize, DataTypes) => {
  const SuppressionList = sequelize.define(
    "SuppressionList",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

      email: { type: DataTypes.STRING(200), allowNull: false, unique: true },
      reason: {
        type: DataTypes.ENUM("bounce", "complaint", "manual"),
        allowNull: false,
        defaultValue: "bounce",
      },
      provider: { type: DataTypes.STRING(50), allowNull: true },

      meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "suppression_list",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return SuppressionList;
};
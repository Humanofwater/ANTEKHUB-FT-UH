"use strict";

// File: models/auth_token.js
// Tujuan: Token sekali-pakai (REGISTER, RESET, CHANGE_EMAIL)

module.exports = (sequelize, DataTypes) => {
  const AuthToken = sequelize.define(
    "AuthToken",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      token: { type: DataTypes.STRING(256), allowNull: false, unique: true },
      purpose: {
        type: DataTypes.ENUM("REGISTER","RESET","CHANGE_EMAIL"),
        allowNull: false,
      },
      email: { type: DataTypes.STRING(200), allowNull: false },

      user_id: { type: DataTypes.BIGINT, allowNull: true },
      alumni_id: { type: DataTypes.BIGINT, allowNull: true },

      expires_at: { type: DataTypes.DATE, allowNull: false },
      used_at: { type: DataTypes.DATE, allowNull: true },
      used_by_user_id: { type: DataTypes.BIGINT, allowNull: true },

      meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "auth_tokens",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
  
  return AuthToken;
};
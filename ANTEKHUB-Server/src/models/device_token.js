"use strict";

// File: models/device_token.js
// Tujuan: Menyimpan FCM device token per user

module.exports = (sequelize, DataTypes) => {
  const DeviceToken = sequelize.define(
    "DeviceToken",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

      user_id: { type: DataTypes.BIGINT, allowNull: false },

      token: { type: DataTypes.TEXT, allowNull: false, unique: true },
      platform: {
        type: DataTypes.ENUM("android", "ios", "web", "unknown"),
        allowNull: false,
        defaultValue: "unknown",
      },
      app_version: { type: DataTypes.STRING(50), allowNull: true },

      last_seen_at: { type: DataTypes.DATE, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "device_tokens",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
  
  return DeviceToken;
};

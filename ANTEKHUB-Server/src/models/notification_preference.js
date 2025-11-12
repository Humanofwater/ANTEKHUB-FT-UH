"use strict";

// File: models/notification_preference.js
// Tujuan: Preferensi notifikasi per user (push/email, quiet hours)

module.exports = (sequelize, DataTypes) => {
  const NotificationPreference = sequelize.define(
    "NotificationPreference",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

      user_id: { type: DataTypes.BIGINT, allowNull: false, unique: true },

      push_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      email_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

      quiet_hours_from: { type: DataTypes.STRING(5), allowNull: true }, // '22:00'
      quiet_hours_to: { type: DataTypes.STRING(5), allowNull: true },   // '07:00'

      meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "notification_preferences",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return NotificationPreference;
};

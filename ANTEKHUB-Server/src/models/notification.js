"use strict";

// File: models/notification.js
// Tujuan: Penjadwalan & tracking notifikasi (profile_expiry)

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "Notification",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

      user_id: { type: DataTypes.BIGINT, allowNull: false },

      type: {
        type: DataTypes.ENUM("profile_expiry"),
        allowNull: false,
        defaultValue: "profile_expiry",
      },

      scheduled_for: { type: DataTypes.DATE, allowNull: false },
      status: {
        type: DataTypes.ENUM("SCHEDULED", "SENT", "OPENED", "FAILED", "CANCELED"),
        allowNull: false,
        defaultValue: "SCHEDULED",
      },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

      idempotency_key: { type: DataTypes.STRING(128), allowNull: false, unique: true },

      payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      provider_message_id: { type: DataTypes.STRING(200), allowNull: true },

      sent_at: { type: DataTypes.DATE, allowNull: true },
      opened_at: { type: DataTypes.DATE, allowNull: true },
      failed_at: { type: DataTypes.DATE, allowNull: true },

      meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "notifications",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Notification;
};

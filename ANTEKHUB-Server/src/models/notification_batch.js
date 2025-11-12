"use strict";

// File: models/notification_batch.js
// Tujuan: Audit per batch pengiriman notifikasi

module.exports = (sequelize, DataTypes) => {
  const NotificationBatch = sequelize.define(
    "NotificationBatch",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

      type: { type: DataTypes.STRING(50), allowNull: false }, // mis. 'profile_expiry'
      scheduled_for: { type: DataTypes.DATE, allowNull: false },

      total: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      success: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      failed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

      concurrency: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

      status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "CREATED", // CREATED/RUNNING/DONE/FAILED
      },

      meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "notification_batches",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return NotificationBatch;
};

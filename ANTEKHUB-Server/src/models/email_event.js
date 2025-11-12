"use strict";

// File: models/email_event.js
// Tujuan: Log pengiriman email (Postmark)

module.exports = (sequelize, DataTypes) => {
  const EmailEvent = sequelize.define(
    "EmailEvent",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

      provider: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "postmark",
      },
      provider_message_id: { type: DataTypes.STRING(200), allowNull: true },

      to_email: { type: DataTypes.STRING(200), allowNull: false },
      template: { type: DataTypes.STRING(100), allowNull: true },

      status: {
        type: DataTypes.ENUM(
          "QUEUED",
          "SENT",
          "DELIVERED",
          "BOUNCED",
          "COMPLAINED",
          "FAILED"
        ),
        allowNull: false,
        defaultValue: "QUEUED",
      },
      error_code: { type: DataTypes.STRING(50), allowNull: true },
      error_message: { type: DataTypes.TEXT, allowNull: true },

      payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },

      user_id: { type: DataTypes.BIGINT, allowNull: true },
    },
    {
      tableName: "email_events",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return EmailEvent;
};

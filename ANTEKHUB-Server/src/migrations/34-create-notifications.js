// Migration: 04-create-notifications.js
// Penjadwalan & tracking notifikasi (contoh: profile_expiry)
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN
          CREATE TYPE notification_type_enum AS ENUM ('profile_expiry');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status_enum') THEN
          CREATE TYPE notification_status_enum AS ENUM ('SCHEDULED','SENT','OPENED','FAILED','CANCELED');
        END IF;
      END $$;
    `);

    await queryInterface.createTable("notifications", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },

      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      type: { type: "notification_type_enum", allowNull: false, defaultValue: "profile_expiry" },
      scheduled_for: { type: Sequelize.DATE, allowNull: false }, // app-layer: set 06:00 WITA
      status: { type: "notification_status_enum", allowNull: false, defaultValue: "SCHEDULED" },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      idempotency_key: { type: Sequelize.STRING(128), allowNull: false, unique: true },

      payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} }, // title, body, deep_link
      provider_message_id: { type: Sequelize.STRING(200), allowNull: true },

      sent_at: { type: Sequelize.DATE, allowNull: true },
      opened_at: { type: Sequelize.DATE, allowNull: true },
      failed_at: { type: Sequelize.DATE, allowNull: true },

      meta: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addIndex("notifications", ["user_id"], { name: "idx_notifications_user_id" });
    await queryInterface.addIndex("notifications", ["status", "scheduled_for"], { name: "idx_notifications_status_scheduled" });
    await queryInterface.addIndex("notifications", ["created_at"], { name: "idx_notifications_created_at" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("notifications");
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN
          DROP TYPE notification_type_enum;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status_enum') THEN
          DROP TYPE notification_status_enum;
        END IF;
      END $$;
    `);
  },
};

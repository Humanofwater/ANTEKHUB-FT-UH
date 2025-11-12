// Migration: 02-create-email_events.js
// Log event kirim email (Postmark): queued/sent/delivered/bounced/complained/failed
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_status_enum') THEN
          CREATE TYPE email_status_enum AS ENUM ('QUEUED','SENT','DELIVERED','BOUNCED','COMPLAINED','FAILED');
        END IF;
      END $$;
    `);

    await queryInterface.createTable("email_events", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },

      provider: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "postmark" },
      provider_message_id: { type: Sequelize.STRING(200), allowNull: true },

      to_email: { type: Sequelize.STRING(200), allowNull: false },
      template: { type: Sequelize.STRING(100), allowNull: true },

      status: { type: "email_status_enum", allowNull: false, defaultValue: "QUEUED" },
      error_code: { type: Sequelize.STRING(50), allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },

      payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      meta: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

      user_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addIndex("email_events", ["to_email"], { name: "idx_email_events_to_email" });
    await queryInterface.addIndex("email_events", ["status"], { name: "idx_email_events_status" });
    await queryInterface.addIndex("email_events", ["created_at"], { name: "idx_email_events_created_at" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("email_events");
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_status_enum') THEN
          DROP TYPE email_status_enum;
        END IF;
      END $$;
    `);
  },
};

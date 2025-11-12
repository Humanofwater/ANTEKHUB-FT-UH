// Migration: 03-create-device_tokens.js
// Token FCM per perangkat user
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_platform_enum') THEN
          CREATE TYPE device_platform_enum AS ENUM ('android','ios','web','unknown');
        END IF;
      END $$;
    `);

    await queryInterface.createTable("device_tokens", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },

      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      token: { type: Sequelize.TEXT, allowNull: false, unique: true },
      platform: { type: "device_platform_enum", allowNull: false, defaultValue: "unknown" },
      app_version: { type: Sequelize.STRING(50), allowNull: true },

      last_seen_at: { type: Sequelize.DATE, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addIndex("device_tokens", ["user_id"], { name: "idx_device_tokens_user_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("device_tokens");
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_platform_enum') THEN
          DROP TYPE device_platform_enum;
        END IF;
      END $$;
    `);
  },
};

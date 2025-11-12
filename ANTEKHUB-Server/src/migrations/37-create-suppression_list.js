// Migration: 07-create-suppression_list.js
// Menyimpan email yang harus di-suppress (bounce/complaint/manual)
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'suppression_reason_enum') THEN
          CREATE TYPE suppression_reason_enum AS ENUM ('bounce','complaint','manual');
        END IF;
      END $$;
    `);

    await queryInterface.createTable("suppression_list", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },

      email: { type: Sequelize.STRING(200), allowNull: false, unique: true },
      reason: { type: "suppression_reason_enum", allowNull: false, defaultValue: "bounce" },
      provider: { type: Sequelize.STRING(50), allowNull: true }, // ex: 'postmark'

      meta: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addIndex("suppression_list", ["email"], { name: "idx_suppression_email" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("suppression_list");
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'suppression_reason_enum') THEN
          DROP TYPE suppression_reason_enum;
        END IF;
      END $$;
    `);
  },
};

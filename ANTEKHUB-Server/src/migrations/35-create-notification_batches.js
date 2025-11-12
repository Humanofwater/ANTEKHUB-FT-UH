// Migration: 05-create-notification_batches.js
// Audit per batch pengiriman (berguna untuk 10k target)
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("notification_batches", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },

      type: { type: Sequelize.STRING(50), allowNull: false }, // ex: 'profile_expiry'
      scheduled_for: { type: Sequelize.DATE, allowNull: false },

      total: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      success: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      failed: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      concurrency: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "CREATED" }, // CREATED/RUNNING/DONE/FAILED
      meta: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addIndex("notification_batches", ["type", "scheduled_for"], { name: "idx_notification_batches_type_scheduled" });
    await queryInterface.addIndex("notification_batches", ["status"], { name: "idx_notification_batches_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("notification_batches");
  },
};

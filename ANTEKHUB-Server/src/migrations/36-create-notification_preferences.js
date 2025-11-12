// Migration: 06-create-notification_preferences.js
// Preferensi user untuk push/email, jam tenang, dsb.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("notification_preferences", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },

      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      push_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      email_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      quiet_hours_from: { type: Sequelize.STRING(5), allowNull: true }, // '22:00'
      quiet_hours_to: { type: Sequelize.STRING(5), allowNull: true },   // '07:00'

      meta: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("notification_preferences");
  },
};

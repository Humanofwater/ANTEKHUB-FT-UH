"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("import_runs", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      filename: { type: Sequelize.STRING },
      actor_id: { type: Sequelize.STRING },
      status: { type: Sequelize.STRING, defaultValue: "preview" },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("import_runs");
  },
};

"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    // Unique composite untuk idempoten (nim, program_studi_id)
    await queryInterface.addConstraint("pendidikan_alumni", {
      fields: ["nim", "program_studi_id"],
      type: "unique",
      name: "uniq_pendidikan_nim_prodi",
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(
      "pendidikan_alumni",
      "uniq_pendidikan_nim_prodi"
    );
  },
};

'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('bidang_industri', {
      id:   { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID,  allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },

      kode: { type: Sequelize.STRING(50) },
      nama: { type: Sequelize.STRING(255), allowNull: false },
      deskripsi: { type: Sequelize.TEXT },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('bidang_industri', ['nama'], { unique: true, name: 'uq_bidang_industri_nama' });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('bidang_industri');
  }
};

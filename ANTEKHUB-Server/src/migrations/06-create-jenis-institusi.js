'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('jenis_institusi', {
      id:   { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID,  allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },

      kode: { type: Sequelize.STRING(50) },
      nama: { type: Sequelize.STRING(255), allowNull: false },
      deskripsi: { type: Sequelize.TEXT },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('jenis_institusi', ['nama'], { unique: true, name: 'uq_jenis_institusi_nama' });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('jenis_institusi');
  }
};

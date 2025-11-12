'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('bank', {
      id:   { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID,  allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },

      nama: { type: Sequelize.STRING(255), allowNull: false },
      kategori: { type: Sequelize.STRING(50) }, // BANK / E-WALLET / GATEWAY (opsional)

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('bank', ['nama'], { unique: true, name: 'uq_bank_nama' });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('bank');
  }
};

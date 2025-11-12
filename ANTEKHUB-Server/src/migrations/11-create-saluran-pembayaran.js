'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('saluran_pembayaran', {
      id:   { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID,  allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },

      metode_pembayaran_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'metode_pembayaran', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      kode_saluran: { type: Sequelize.STRING(50), allowNull: false, unique: true }, // e.g. BRI_VA, OVO, QRIS
      nama: { type: Sequelize.STRING(100), allowNull: false },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('saluran_pembayaran', ['metode_pembayaran_id'], { name: 'idx_saluran_metode_id' });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('saluran_pembayaran');
  }
};

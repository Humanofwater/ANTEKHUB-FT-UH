'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('rekening', {
      id:   { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID,  allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },

      nama_rekening:  { type: Sequelize.STRING(255), allowNull: false },
      nomor_rekening: { type: Sequelize.STRING(255), allowNull: false },
      bank_id: {
        type: Sequelize.BIGINT,
        references: { model: 'bank', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      deskripsi: { type: Sequelize.TEXT },
      aktif: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('rekening', ['bank_id'], { name: 'idx_rekening_bank' });
    await queryInterface.addIndex('rekening', ['bank_id', 'nomor_rekening'], { unique: true, name: 'uq_rekening_bank_no' });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('rekening');
  }
};

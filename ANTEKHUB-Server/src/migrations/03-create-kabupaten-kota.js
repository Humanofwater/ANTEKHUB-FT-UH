'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('kabupaten_kota', {
      id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },
      provinsi_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'provinsi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      nama: { type: Sequelize.STRING(255), allowNull: false },
      longitude: { type: Sequelize.DOUBLE },
      latitude: { type: Sequelize.DOUBLE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('kabupaten_kota', ['provinsi_id', 'nama'], { unique: true, name: 'uq_kabupaten_kota_provinsi_nama' });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('kabupaten_kota');
  }
};

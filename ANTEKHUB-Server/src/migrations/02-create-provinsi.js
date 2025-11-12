'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('provinsi', {
      id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },
      bangsa_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'bangsa', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      nama: { type: Sequelize.STRING(255), allowNull: false },
      iso2: { type: Sequelize.STRING(50) },
      iso3166_2: { type: Sequelize.STRING(50) },
      longitude: { type: Sequelize.DOUBLE },
      latitude: { type: Sequelize.DOUBLE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('provinsi', ['bangsa_id', 'nama'], { unique: true, name: 'uq_provinsi_bangsa_nama' });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('provinsi');
  }
};

'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('bangsa', {
      id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },
      nama: { type: Sequelize.STRING(255), allowNull: false },
      iso3: { type: Sequelize.STRING(3) },
      iso2: { type: Sequelize.STRING(2) },
      kode_telepon: { type: Sequelize.INTEGER },
      region: { type: Sequelize.STRING(100) },
      subregion: { type: Sequelize.STRING(100) },
      longitude: { type: Sequelize.DOUBLE },
      latitude: { type: Sequelize.DOUBLE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('bangsa', ['nama'], { unique: true, name: 'uq_bangsa_nama' });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('bangsa');
  }
};

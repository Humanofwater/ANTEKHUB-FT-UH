'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('referensi_jabatan', {
      id:   { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID,  allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },

      jabatan: { type: Sequelize.STRING(255), allowNull: false },
      slug:    { type: Sequelize.STRING(255), allowNull: true, unique: true },
      alias_list: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('referensi_jabatan', ['jabatan'], { name: 'idx_ref_jabatan_nama' });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('referensi_jabatan');
  }
};

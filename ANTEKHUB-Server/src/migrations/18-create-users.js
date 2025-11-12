'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id:   { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID,  allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },

      email: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      password: { type: Sequelize.TEXT, allowNull: false }, // simpan hash
      alumni_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'alumni', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      is_paid: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_fill_profile: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('users', ['alumni_id'], { name: 'idx_users_alumni_id' });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('users');
  }
};

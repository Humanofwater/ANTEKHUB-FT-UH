'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('api_request_logs', {
      id:           { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      request_id:   { type: Sequelize.UUID,  allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },

      actor_user_id:   { type: Sequelize.BIGINT, allowNull: true },
      actor_email:     { type: Sequelize.STRING(150), allowNull: true },

      method:       { type: Sequelize.STRING(10),  allowNull: false },
      path:         { type: Sequelize.STRING(1024), allowNull: false },
      ip:           { type: Sequelize.STRING(100), allowNull: true },
      user_agent:   { type: Sequelize.STRING(512), allowNull: true },

      status_code:  { type: Sequelize.INTEGER, allowNull: true },
      latency_ms:   { type: Sequelize.INTEGER, allowNull: true },

      payload:      { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      response:     { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },

      created_at:   { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('api_request_logs', ['created_at'], { name: 'idx_api_req_when' });
    await queryInterface.addIndex('api_request_logs', ['actor_user_id'], { name: 'idx_api_req_actor' });
    await queryInterface.addIndex('api_request_logs', ['request_id'], { unique: true, name: 'uq_api_req_request_id' });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('api_request_logs');
  }
};

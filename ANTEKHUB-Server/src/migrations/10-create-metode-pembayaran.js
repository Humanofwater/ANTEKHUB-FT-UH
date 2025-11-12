'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('metode_pembayaran', {
      id:   { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID,  allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },

      // jika ingin mengacu enum 'metode_pembayaran_enum' di kolom lain (mis. transaksi),
      // tabel ini menjadi master list kode2 yang dipakai UI
      kode_metode: { type: Sequelize.STRING(50), allowNull: false, unique: true }, // e.g. VA, QRIS, E-WALLET
      nama: { type: Sequelize.STRING(100), allowNull: false },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('metode_pembayaran');
  }
};

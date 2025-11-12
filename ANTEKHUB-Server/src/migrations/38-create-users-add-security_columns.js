// Migration: 08-alter-users-add-security_columns.js
// Tambah kolom bantu untuk verifikasi & invalidasi sesi
module.exports = {
  async up(queryInterface, Sequelize) {
    // Gunakan raw ALTER TABLE IF NOT EXISTS agar idempotent
    await queryInterface.sequelize.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS email_verified_at,
        DROP COLUMN IF EXISTS token_version;
    `);
  },
};

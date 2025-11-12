// File: src/seeders/20251022-seed-user-admin.js
// Tujuan: Seed 2 akun admin: 1 Super Admin & 1 Admin (password di-hash)

'use strict';

const bcrypt = require('bcryptjs');

/**
 * Creds untuk testing (tetap sama agar kamu tahu untuk login)
 * - Super Admin:
 *    username: superadmin_7843
 *    password (plain): SAdmin#7843
 * - Admin:
 *    username: admin_2199
 *    password (plain): Admin#2199
 */
const SUPERADMIN_USER = 'superadmin_7843';
const SUPERADMIN_PASS = 'SAdmin#7843';

const ADMIN_USER = 'admin_2199';
const ADMIN_PASS = 'Admin#2199';

module.exports = {
  async up (queryInterface) {
    const now = new Date();

    const superHash = await bcrypt.hash(SUPERADMIN_PASS, 12);
    const adminHash  = await bcrypt.hash(ADMIN_PASS, 12);

    await queryInterface.bulkInsert('users_admin', [
      {
        // uuid dibuat default oleh DB (uuid_generate_v4())
        username: SUPERADMIN_USER,
        nama: 'Super Admin',
        nomor_telepon: '081234567843',
        password: superHash,
        role: 'Super Admin',
        created_at: now,
        updated_at: now
      },
      {
        username: ADMIN_USER,
        nama: 'Admin',
        nomor_telepon: '081234562199',
        password: adminHash,
        role: 'Admin',
        created_at: now,
        updated_at: now
      }
    ], {});
  },

  async down (queryInterface) {
    await queryInterface.bulkDelete('users_admin', {
      username: ['superadmin_7843', 'admin_2199']
    }, {});
  }
};

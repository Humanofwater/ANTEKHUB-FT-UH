// File: migrations/20251108_add_reminder_stage_to_users_profile.js
"use strict";

/**
 * Migration untuk menambah kolom reminder_stage & last_reminder_sent_at
 * pada tabel users_profile (dipakai oleh scheduler profileValidity.job.js)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Periksa apakah kolom sudah ada (biar aman idempotent)
    const table = await queryInterface.describeTable("users_profile");

    // valid_until pastikan DATEONLY
    if (table.valid_until && table.valid_until.type !== "DATEONLY") {
      await queryInterface.changeColumn("users_profile", "valid_until", {
        type: Sequelize.DATEONLY,
        allowNull: false,
      });
    }

    // reminder_stage
    if (!table.reminder_stage) {
      await queryInterface.addColumn("users_profile", "reminder_stage", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment:
          "Tahapan pengingat profil: 0=belum, 1=H0, 2=H+7, 3=H+14, >=3=bulanan",
      });
    }

    // last_reminder_sent_at
    if (!table.last_reminder_sent_at) {
      await queryInterface.addColumn("users_profile", "last_reminder_sent_at", {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Waktu terakhir notifikasi/email dikirim oleh scheduler",
      });
    }

    // Pastikan kolom photo_profile_path & url ada dan bertipe aman
    if (!table.photo_profile_path) {
      await queryInterface.addColumn("users_profile", "photo_profile_path", {
        type: Sequelize.STRING(200),
        allowNull: true,
      });
    }
    if (!table.photo_profile_url) {
      await queryInterface.addColumn("users_profile", "photo_profile_url", {
        type: Sequelize.STRING(200),
        allowNull: true,
      });
    }

    console.log(
      "✅ Migration up: users_profile updated with scheduler columns"
    );
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("users_profile");

    if (table.reminder_stage) {
      await queryInterface.removeColumn("users_profile", "reminder_stage");
    }
    if (table.last_reminder_sent_at) {
      await queryInterface.removeColumn(
        "users_profile",
        "last_reminder_sent_at"
      );
    }

    console.log(
      "🧹 Migration down: removed reminder columns from users_profile"
    );
  },
};

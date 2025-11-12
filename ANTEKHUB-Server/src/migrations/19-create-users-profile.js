"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users_profile", {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        defaultValue: Sequelize.literal("uuid_generate_v4()"),
      },

      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      status: {
        type: "status_enum",
        allowNull: true,
      },

      // DOMISILI (FK ke master wilayah)
      domisili_negara_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "bangsa", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      domisili_provinsi_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "provinsi", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      domisili_kabupaten_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "kabupaten_kota", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      domisili_alamat: { type: Sequelize.STRING(255), allowNull: false },

      // PERUSAHAAN (input manual + referensi)
      nama_perusahaan: { type: Sequelize.STRING(255), allowNull: true },
      referensi_perusahaan_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "referensi_perusahaan", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      jenis_perusahaan_input_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "jenis_institusi", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      bidang_industri_input_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "bidang_industri", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      // LOKASI PERUSAHAAN
      perusahaan_negara_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "bangsa", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      perusahaan_provinsi_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "provinsi", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      perusahaan_kabupaten_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "kabupaten_kota", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      perusahaan_alamat: { type: Sequelize.STRING(255), allowNull: true },
      longitude: {
        type: Sequelize.DOUBLE,
        allowNull: true,
        validate: {
          min: -180,
          max: 180,
        },
      },
      latitude: {
        type: Sequelize.DOUBLE,
        allowNull: true,
        validate: {
          min: -90,
          max: 90,
        },
      },

      // JABATAN
      jabatan: { type: Sequelize.STRING(255), allowNull: true },
      referensi_jabatan_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "referensi_jabatan", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      // MEDIA / VALIDITAS
      photo_profile_path: { type: Sequelize.STRING(200), allowNull: true },
      photo_profile_url: { type: Sequelize.STRING(200), allowNull: true },
      valid_until: { type: Sequelize.DATEONLY, allowNull: false },

      // flag apakah domisili = lokasi kerja
      dom_eq_job: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("users_profile", ["status"], {
      name: "idx_users_profile_status",
    });
    await queryInterface.addIndex(
      "users_profile",
      ["referensi_perusahaan_id"],
      { name: "idx_users_profile_ref_perusahaan" }
    );
    await queryInterface.addIndex("users_profile", ["referensi_jabatan_id"], {
      name: "idx_users_profile_ref_jabatan",
    });

    await queryInterface.addConstraint("users_profile", {
      fields: ["longitude"],
      type: "check",
      name: "ck_users_profile_longitude_range",
      where: {
        longitude: { [Sequelize.Op.between]: [-180, 180] },
      },
    });

    await queryInterface.addConstraint("users_profile", {
      fields: ["latitude"],
      type: "check",
      name: "ck_users_profile_latitude_range",
      where: {
        latitude: { [Sequelize.Op.between]: [-90, 90] },
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("users_profile");
  },
};

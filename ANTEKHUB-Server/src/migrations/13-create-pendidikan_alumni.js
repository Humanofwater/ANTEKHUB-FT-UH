// Migration: create_pendidikan_alumni_table
// Riwayat pendidikan alumni (S1/S2/S3/profesi, dll)
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("pendidikan_alumni", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        defaultValue: Sequelize.literal("uuid_generate_v4()"),
      },

      alumni_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "alumni", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      nim: { type: Sequelize.STRING(20), allowNull: false },
      program_studi_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
        references: { model: "program_studi", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      tahun_masuk: { type: Sequelize.INTEGER, allowNull: false },
      lama_studi_tahun: { type: Sequelize.INTEGER, allowNull: false },
      lama_studi_bulan: { type: Sequelize.INTEGER, allowNull: false },

      no_alumni: { type: Sequelize.STRING(20), allowNull: false },

      tanggal_lulus: { type: Sequelize.DATEONLY, allowNull: false },

      nilai_ujian: { type: "nilai_ujian_enum", allowNull: false }, // enum
      ipk: { type: Sequelize.FLOAT, allowNull: false },

      predikat_kelulusan: { type: "predikat_enum", allowNull: false }, // enum
      judul_tugas_akhir: { type: Sequelize.TEXT, allowNull: true },

      ipb: { type: Sequelize.FLOAT, allowNull: true },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addIndex("pendidikan_alumni", ["alumni_id"]);
    await queryInterface.addIndex("pendidikan_alumni", ["nim"]);
    await queryInterface.addIndex("pendidikan_alumni", ["program_studi_id"]);

    // Tambahan untuk filter & performa (fitur map & dashboard)
    await queryInterface.addIndex("pendidikan_alumni", ["tahun_masuk"], {
      name: "idx_pendidikan_alumni_tahun_masuk",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "pendidikan_alumni",
      "idx_pendidikan_alumni_tahun_masuk"
    );
    await queryInterface.dropTable("pendidikan_alumni");
  },
};

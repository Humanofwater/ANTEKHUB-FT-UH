// Migration: create_alumni_table
// Tabel master data alumni (informasi, bukan akun login)
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("alumni", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        defaultValue: Sequelize.literal("uuid_generate_v4()"),
      },

      nama: { type: Sequelize.STRING(100), allowNull: false },
      tempat_lahir: { type: Sequelize.STRING(100), allowNull: false },
      tanggal_lahir: { type: Sequelize.DATEONLY, allowNull: false },

      agama: { type: "agama_enum" }, // enum
      suku_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
        references: { model: "suku", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      bangsa_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
        references: { model: "bangsa", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      alamat: { type: Sequelize.STRING(100), allowNull: false },
      no_telp: { type: Sequelize.STRING(20), allowNull: false },

      user_status: {
        type: "user_status_enum",
        allowNull: false,
        defaultValue: "Belum Mendaftar",
      },

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

    await queryInterface.addIndex("alumni", ["uuid"]);
    await queryInterface.addIndex("alumni", ["nama"]);
    await queryInterface.addIndex("alumni", ["tanggal_lahir"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("alumni");
  },
};

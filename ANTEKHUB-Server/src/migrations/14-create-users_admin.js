// Migration: create_users_admin_table
// Tabel admin web (bukan user alumni)
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users_admin", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        defaultValue: Sequelize.literal("uuid_generate_v4()"),
      },
      nama: { type: Sequelize.STRING(255), allowNull: false },
      username: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      nomor_telepon: { type: Sequelize.STRING(20) },
      password: { type: Sequelize.STRING(200), allowNull: false }, // simpan hash
      role: { type: "role_enum", allowNull: false, defaultValue: "Admin" },

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

    await queryInterface.addIndex("users_admin", ["uuid"]);
    await queryInterface.addIndex("users_admin", ["username"], {
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("users_admin");
  },
};

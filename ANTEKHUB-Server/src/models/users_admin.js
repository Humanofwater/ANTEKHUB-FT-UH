// File: models/user_admin.js
// Tujuan: Model admin web (akun pengelola konten)
// Kontrak: username unik, role pakai ENUM('Admin','Super Admin')
// Catatan: kolom password adalah HASH (bcrypt)

module.exports = (sequelize, DataTypes) => {
  const UsersAdmin = sequelize.define(
    "UsersAdmin",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      nama: { type: DataTypes.STRING(255), allowNull: false },
      username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      nomor_telepon: { type: DataTypes.STRING(20) },
      password: { type: DataTypes.STRING(200), allowNull: false },
      role: {
        type: DataTypes.ENUM("Admin", "Super Admin"),
        allowNull: false,
        defaultValue: "Admin",
      },
    },
    {
      tableName: "users_admin",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return UsersAdmin;
};

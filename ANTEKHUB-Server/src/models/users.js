"use strict";

// File: models/users.js
// Tujuan: Model akun aplikasi alumni (login ke aplikasi mobile/web)
// Catatan: satu ke satu dengan Alumni, satu ke satu dengan UsersProfile

module.exports = (sequelize, DataTypes) => {
  const Users = sequelize.define(
    "Users",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },

      email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      password: { type: DataTypes.TEXT, allowNull: false }, // simpan hash
      alumni_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },

      is_paid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_fill_profile: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      
      email_verified_at: { type: DataTypes.DATE, allowNull: true },
      token_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: "users",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Users;
};

"use strict";

module.exports = (sequelize, DataTypes) => {
  const ReferensiJabatan = sequelize.define(
    "ReferensiJabatan",
    {
      id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      jabatan: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },
      alias_list: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      tableName: "referensi_jabatan",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          fields: ["jabatan"],
          name: "idx_ref_jabatan_nama",
        },
      ],
    }
  );

  return ReferensiJabatan;
};

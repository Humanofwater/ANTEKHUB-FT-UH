"use strict";

module.exports = (sequelize, DataTypes) => {
  const Provinsi = sequelize.define(
    "Provinsi",
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
      bangsa_id: {
        type: DataTypes.BIGINT, 
        allowNull: false
      },
      nama: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      iso2: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      iso3166_2: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
    },
    {
      tableName: "provinsi",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          unique: true,
          fields: ["bangsa_id", "nama"],
          name: "uq_provinsi_bangsa_nama",
        },
      ],
    }
  );

  return Provinsi;
};

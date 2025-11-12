// File: models/program_studi.js
// Tujuan: Model master program studi

module.exports = (sequelize, DataTypes) => {
  const ProgramStudi = sequelize.define(
    "ProgramStudi",
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
      kode: {
        type: DataTypes.ARRAY(DataTypes.STRING(20)),
        allowNull: false,
        defaultValue: [],
      },
      nama: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      strata: DataTypes.STRING(32),
      alias: {
        type: DataTypes.ARRAY(DataTypes.STRING(200)),
        allowNull: true,
        defaultValue: [],
      },
    },
    {
      tableName: "program_studi",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return ProgramStudi;
};

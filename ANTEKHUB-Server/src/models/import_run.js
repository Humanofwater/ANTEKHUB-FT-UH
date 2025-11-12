// =============================================
// File: src/models/import_run.js (Sequelize Model)
// =============================================
module.exports = (sequelize, DataTypes) => {
  const ImportRun = sequelize.define(
    "ImportRun",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      filename: DataTypes.STRING,
      actor_id: DataTypes.STRING,
      status: { type: DataTypes.STRING, defaultValue: "preview" },
    },
    {
      tableName: "import_runs",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
  ImportRun.associate = (models) => {
    ImportRun.hasMany(models.ImportItem, { as: "items", foreignKey: "run_id" });
  };
  return ImportRun;
};

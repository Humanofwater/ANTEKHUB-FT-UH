// =============================================
// File: src/models/import_item.js (Sequelize Model)
// =============================================
module.exports = (sequelize, DataTypes) => {
  const ImportItem = sequelize.define(
    "ImportItem",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      run_id: { type: DataTypes.UUID, allowNull: false },
      sheet: DataTypes.STRING,
      row_no: DataTypes.INTEGER,
      status: DataTypes.STRING,
      message: DataTypes.TEXT,
      alumni_id: DataTypes.BIGINT,
      pendidikan_id: DataTypes.BIGINT,
      payload_json: DataTypes.JSONB,
    },
    { tableName: "import_items", underscored: true, timestamps: false }
  );
  ImportItem.associate = (models) => {
    ImportItem.belongsTo(models.ImportRun, { as: "run", foreignKey: "run_id" });
  };
  return ImportItem;
};

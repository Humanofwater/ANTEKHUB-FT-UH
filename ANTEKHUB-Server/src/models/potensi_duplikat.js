// =============================================
// File: src/models/potensi_duplikat.js (Sequelize Model)
// =============================================
module.exports = (sequelize, DataTypes) => {
  const PotensiDuplikat = sequelize.define(
    "PotensiDuplikat",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      tipe: DataTypes.STRING, // 'alumni' | 'nim'
      kunci: DataTypes.STRING,
      left_ref: DataTypes.JSONB,
      right_ref: DataTypes.JSONB,
      reason: DataTypes.STRING,
      resolved_by: DataTypes.STRING,
      resolved_at: DataTypes.DATE,
      resolution_note: DataTypes.TEXT,
    },
    { tableName: "potensi_duplikat", underscored: true, timestamps: false }
  );
  return PotensiDuplikat;
};

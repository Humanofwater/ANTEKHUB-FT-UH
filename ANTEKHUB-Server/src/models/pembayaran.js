// File: models/pembayaran.js
// Tujuan: Model transaksi pembayaran alumni (Midtrans integration)
// Relasi: banyak ke satu dengan Users

module.exports = (sequelize, DataTypes) => {
  const Pembayaran = sequelize.define(
    "Pembayaran",
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

      user_id: { type: DataTypes.BIGINT, allowNull: false },

      tujuan_pembayaran: { type: "tujuan_pembayaran_enum", allowNull: false },

      rekening_id: { type: DataTypes.BIGINT, allowNull: true },

      // Jika di SQL-mu event_id → info_alumni, kita ikutkan:
      event_id: { type: DataTypes.BIGINT, allowNull: true },

      order_id: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      midtrans_transaction_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },

      saluran_pembayaran_id: { type: DataTypes.BIGINT, allowNull: true },

      nominal: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
      total_fee: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      },

      status: { type: "status_pembayaran_enum", allowNull: false },

      expired_at: { type: DataTypes.DATE, allowNull: true },
      paid_at: { type: DataTypes.DATE, allowNull: true },
      settled_at: { type: DataTypes.DATE, allowNull: true },
      canceled_at: { type: DataTypes.DATE, allowNull: true },

      va_number: { type: DataTypes.STRING(100), allowNull: true },
      qris_payload: { type: DataTypes.TEXT, allowNull: true },
      ewallet_ref: { type: DataTypes.STRING(100), allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "pembayaran",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Pembayaran;
};

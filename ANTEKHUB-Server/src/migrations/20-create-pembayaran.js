"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("pembayaran", {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        defaultValue: Sequelize.literal("uuid_generate_v4()"),
      },

      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      tujuan_pembayaran: { type: "tujuan_pembayaran_enum", allowNull: false },

      rekening_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "rekening", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      // Jika di SQL-mu event_id → info_alumni, kita ikutkan:
      event_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "info_alumni", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      order_id: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      midtrans_transaction_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },

      saluran_pembayaran_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "saluran_pembayaran", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      nominal: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      total_fee: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      },

      status: { type: "status_pembayaran_enum", allowNull: false },

      expired_at: { type: Sequelize.DATE, allowNull: true },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      settled_at: { type: Sequelize.DATE, allowNull: true },
      canceled_at: { type: Sequelize.DATE, allowNull: true },

      va_number: { type: Sequelize.STRING(100), allowNull: true },
      qris_payload: { type: Sequelize.TEXT, allowNull: true },
      ewallet_ref: { type: Sequelize.STRING(100), allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("pembayaran", ["user_id"], {
      name: "idx_pembayaran_user",
    });
    await queryInterface.addIndex("pembayaran", ["status"], {
      name: "idx_pembayaran_status",
    });
    await queryInterface.addIndex("pembayaran", ["order_id"], {
      name: "idx_pembayaran_order",
    });
    await queryInterface.addIndex("pembayaran", ["midtrans_transaction_id"], {
      name: "idx_pembayaran_midtrx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("pembayaran");
  },
};

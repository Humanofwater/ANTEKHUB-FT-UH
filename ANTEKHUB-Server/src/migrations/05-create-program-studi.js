"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1️⃣ Buat tabel program_studi
    await queryInterface.createTable("program_studi", {
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

      // Kolom array string dengan constraint elemen unik
      kode: {
        type: Sequelize.ARRAY(Sequelize.STRING(20)),
        allowNull: false,
        defaultValue: [],
      },

      nama: { type: Sequelize.STRING(100), allowNull: false },

      // ENUM dari migration 00-create-enum.js
      strata: { type: "strata_enum", allowNull: false },

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

    // 2️⃣ Tambahkan index nama (opsional, untuk pencarian cepat)
    try {
      await queryInterface.addIndex("program_studi", ["nama"], {
        name: "idx_program_studi_nama",
      });
    } catch (error) {
      // Index sudah ada, abaikan error
      if (!error.message.includes("already exists")) {
        throw error;
      }
    }

    // 3️⃣ Buat trigger function untuk validasi elemen array unik
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION validate_unique_array_elements()
      RETURNS trigger AS $$
      BEGIN
        -- Cek apakah array memiliki elemen duplikat
        IF array_length(NEW.kode, 1) != (
          SELECT COUNT(DISTINCT element)
          FROM unnest(NEW.kode) AS element
          WHERE element IS NOT NULL AND element != ''
        ) THEN
          RAISE EXCEPTION 'Array elements in kode column must be unique and non-empty';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 4️⃣ Pasang trigger pada tabel program_studi
    await queryInterface.sequelize.query(`
      CREATE TRIGGER trg_validate_kode_unique
      BEFORE INSERT OR UPDATE ON program_studi
      FOR EACH ROW EXECUTE FUNCTION validate_unique_array_elements();
    `);
  },

  async down(queryInterface) {
    // Hapus trigger dan function
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_validate_kode_unique ON program_studi;
      DROP FUNCTION IF EXISTS validate_unique_array_elements();
    `);

    await queryInterface.dropTable("program_studi");
    // ⚠️ ENUM "strata_enum" jangan dihapus di sini (sudah di-handle di 00-create-enum.js)
  },
};

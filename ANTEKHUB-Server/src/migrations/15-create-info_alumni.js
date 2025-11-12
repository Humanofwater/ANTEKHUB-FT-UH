// Tujuan: Membuat tabel info_alumni (Berita/Event/Lowongan) yang scalable

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("info_alumni", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        defaultValue: Sequelize.literal("uuid_generate_v4()"),
      },

      // penulis/pengunggah konten (opsional)
      user_admin_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users_admin", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      // konten utama
      title: { type: Sequelize.STRING(200), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },

      // tipe konten (enum: 'Berita' | 'Event' | 'Lowongan Pekerjaan')
      type_info: { type: "type_info_enum", allowNull: false },

      // media (disimpan di GDrive, path/url opsional)
      info_image_path: { type: Sequelize.STRING(200), allowNull: true },
      info_image_url: { type: Sequelize.STRING(200), allowNull: true },

      // ===== scalability-friendly fields =====
      // slug opsional (kalau nanti perlu permalink), unique jika terisi
      slug: { type: Sequelize.STRING(220), allowNull: true, unique: false },

      // status publikasi & waktu publish
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      // metadata fleksibel untuk future (misal: lokasi event, kontak, fee item, dsb)
      // contoh penyimpanan: { "event": { "location": "...", "fees": [...] }, "tags": ["..."] }
      metadata: { type: Sequelize.JSONB, allowNull: true },
      add_payment: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    // Index untuk performa query & filter
    await queryInterface.addIndex("info_alumni", ["uuid"]);
    await queryInterface.addIndex("info_alumni", ["type_info"], {
      name: "idx_info_alumni_type",
    });
    await queryInterface.addIndex("info_alumni", ["user_admin_id"], {
      name: "idx_info_alumni_admin",
    });
    await queryInterface.addIndex("info_alumni", ["is_active"], {
      name: "idx_info_alumni_active",
    });

    // Jika nanti kamu ingin cari berdasarkan title cepat, bisa tambah trigram index via raw query:
    // await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    // await queryInterface.sequelize.query('CREATE INDEX idx_info_alumni_title_trgm ON info_alumni USING gin (title gin_trgm_ops);');
  },

  async down(queryInterface) {
    // Hapus index (jika diberi nama, hapus dengan nama yang sama)
    await queryInterface.removeIndex("info_alumni", "idx_info_alumni_active");
    await queryInterface.removeIndex("info_alumni", "idx_info_alumni_admin");
    await queryInterface.removeIndex("info_alumni", "idx_info_alumni_type");
    // index 'uuid' default tanpa nama bisa diabaikan saat drop table

    await queryInterface.dropTable("info_alumni");
  },
};

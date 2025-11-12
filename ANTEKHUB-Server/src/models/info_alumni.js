// Tujuan: Model konten info alumni (Berita/Event/Lowongan) yang fleksibel & scalable
// Catatan: ENUM dibuat lewat migration; di model tetap didefinisikan untuk konsistensi.

module.exports = (sequelize, DataTypes) => {
  const InfoAlumni = sequelize.define(
    "InfoAlumni",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },

      user_admin_id: { type: DataTypes.INTEGER, allowNull: false },

      title: { type: DataTypes.STRING(200), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },

      type_info: {
        type: DataTypes.ENUM("Berita", "Event", "Lowongan Pekerjaan"),
        allowNull: false,
      },

      info_image_path: { type: DataTypes.STRING(200), allowNull: true },
      info_image_url: { type: DataTypes.STRING(200), allowNull: true },

      slug: { type: DataTypes.STRING(220), allowNull: true },

      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      // fleksibel untuk atribut khusus per tipe (event/lowongan/berita)
      metadata: { type: DataTypes.JSONB, allowNull: true },
      add_payment: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      tableName: "info_alumni",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",

      defaultScope: {
        order: [
          ["updated_at", "DESC"],
        ],
      },
      indexes: [
        // agar konsisten dengan migration, tidak wajib; biarkan migration yang buat index
      ],
    }
  );

  return InfoAlumni;
};

// File: src/models/pendidikan_alumni.js
// Tujuan: Model riwayat pendidikan alumni (S1/S2/S3/profesi)

module.exports = (sequelize, DataTypes) => {
  const PendidikanAlumni = sequelize.define(
    "PendidikanAlumni",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },

      alumni_id: { type: DataTypes.BIGINT, allowNull: false },
      program_studi_id: { type: DataTypes.BIGINT, allowNull: false }, // wajib (kita resolve di commit)
      nim: { type: DataTypes.STRING(20), allowNull: false },

      tahun_masuk: { type: DataTypes.INTEGER, allowNull: true }, // impor bisa kosong → true
      lama_studi_tahun: { type: DataTypes.INTEGER, allowNull: true }, // impor bisa kosong → true
      lama_studi_bulan: { type: DataTypes.INTEGER, allowNull: true }, // impor bisa kosong → true

      no_alumni: { type: DataTypes.STRING(32), allowNull: true }, // ada file yg kosong
      tanggal_lulus: { type: DataTypes.DATEONLY, allowNull: true }, // beberapa excel kosong/subkolom gagal

      // ⚠️ ENUM harus pakai array values agar Sequelize tidak error values.map
      nilai_ujian: { type: DataTypes.STRING(3), allowNull: true },
      ipk: { type: DataTypes.FLOAT, allowNull: true }, // biarkan null kalau kosong

      predikat_kelulusan: { type: DataTypes.STRING(32), allowNull: true },

      judul_tugas_akhir: { type: DataTypes.TEXT, allowNull: true }, // insinyur → kita set null di service
      ipb: { type: DataTypes.FLOAT, allowNull: true },
    },
    {
      tableName: "pendidikan_alumni",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        // selaras dengan constraint unik di DB: (nim, program_studi_id)
        {
          fields: ["nim", "program_studi_id"],
          unique: true,
          name: "uniq_pendidikan_nim_prodi",
        },
      ],
    }
  );

  return PendidikanAlumni;
};

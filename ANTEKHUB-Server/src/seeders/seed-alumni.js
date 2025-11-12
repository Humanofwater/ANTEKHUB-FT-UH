// File: src/seeders/20251023-seed-alumni.js
// Tujuan: Seed 10 data alumni (tanpa NIM di tabel alumni) + pendidikan_alumni (1–2 per alumni)
// Catatan: NIM disimpan di pendidikan_alumni.nim (bukan di alumni)

'use strict';

const agamaEnum = [
  'Islam',
  'Kristen Protestan',
  'Kristen Katholik',
  'Hindu',
  'Buddha',
  'Konghucu',
  'Lain-lain'
];

const strataEnum = [
  'Sarjana',
  'Magister',
  'Doktor',
  'Profesi Arsitektur',
  'Insinyur',
  'Diploma 3'
];

const predikatEnum = [
  'Summa Cum Laude',
  'Cum Laude',
  'Sangat Memuaskan',
  'Memuaskan',
  'Baik',
  'Cukup',
  'Kurang'
];

const prodiEnum = [
  'Teknik Sipil',
  'Teknik Mesin',
  'Teknik Elektro',
  'Teknik Informatika',
  'Teknik Industri',
  'Arsitektur',
  'Teknik Geologi',
  'Teknik Perkapalan',
  'Teknik Lingkungan'
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const randFloat = (min, max, dec = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const mkDate = (y, m, d) => new Date(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);

module.exports = {
  async up (queryInterface) {
    const now = new Date();
    const t = await queryInterface.sequelize.transaction();
    try {
      for (let i = 1; i <= 10; i++) {
        // NIM unik per alumni — DISIMPAN di pendidikan_alumni
        const nim = `FT${String(240000 + i).padStart(6, '0')}`;

        const tahunLahir = rand(1996, 2000);
        const bulanLahir = rand(1, 12);
        const hariLahir = rand(1, 28);

        // 1) INSERT ke tabel alumni (TANPA kolom NIM)
        const [res] = await queryInterface.sequelize.query(
          `
          INSERT INTO alumni
            (nama, tempat_lahir, tanggal_lahir, agama, alamat, no_telp, created_at, updated_at)
          VALUES
            (:nama, :tmp, :tgl, :agama, :alamat, :telp, :now, :now)
          RETURNING id;
          `,
          {
            replacements: {
              nama: `Alumni ${i}`,
              tmp: pick(['Makassar','Gowa','Maros','Parepare','Bone','Takalar']),
              tgl: mkDate(tahunLahir, bulanLahir, hariLahir),
              agama: pick(agamaEnum),
              bangsa: 'Indonesia',
              suku: pick(['Bugis','Makassar','Toraja','Mandar','Minang','Jawa','Batak']),
              alamat: `Jl. Contoh No.${i}, Makassar`,
              telp: `08${rand(1000000000, 9999999999)}`,
              now
            },
            type: queryInterface.sequelize.QueryTypes.INSERT,
            transaction: t
          }
        );

        // Ambil id alumni dari RETURNING
        const alumniId = Array.isArray(res) ? res[0].id : res.id;

        // 2) INSERT pendidikan_alumni (wajib 1 baris)
        const tahunMasuk1 = rand(2015, 2020);
        const strata1 = pick(strataEnum);
        const tahunLulus1 = strata1 === 'Diploma 3' ? tahunMasuk1 + 3 : tahunMasuk1 + 4;

        const pendidikan1 = {
          alumni_id: alumniId,
          nim, // ⬅️ NIM disimpan di sini
          program_studi: pick(prodiEnum),
          strata: strata1,
          tahun_masuk: tahunMasuk1,
          tanggal_lulus: mkDate(tahunLulus1, 7, 31),
          lama_studi_tahun: tahunLulus1 - tahunMasuk1,
          lama_studi_bulan: pick([0,1,2,3,4,5,6,7,8,9,10,11]),
          ipk: randFloat(2.75, 4.0),
          predikat_kelulusan: pick(predikatEnum),
          // Jika strata Profesi Arsitektur → judul_penelitian = null
          judul_tugas_akhir: strata1 === 'Profesi Arsitektur' ? null : `Analisis Sistem & Kinerja ${i}`,
          created_at: now,
          updated_at: now
        };

        await queryInterface.bulkInsert('pendidikan_alumni', [pendidikan1], { transaction: t });

        // 3) Pendidikan ke-2 (acak 40%)
        if (Math.random() < 0.4) {
          const strata2 = pick(['Magister', 'Insinyur', 'Doktor', 'Profesi Arsitektur']);
          const tahunMasuk2 = tahunLulus1 + 1;
          const tahunLulus2 = strata2 === 'Doktor' ? tahunMasuk2 + 3 : tahunMasuk2 + 2;

          const pendidikan2 = {
            alumni_id: alumniId,
            nim, // ⬅️ tetap NIM yang sama
            program_sturdi: pick(['Teknik Informatika','Teknik Industri','Teknik Sipil','Teknik Elektro']),
            strata: strata2,
            tahun_masuk: tahunMasuk2,
            tanggal_lulus: mkDate(tahunLulus2, 8, 31),
            ipk: randFloat(3.0, 4.0),
            predikat_kelulusan: pick(predikatEnum),
            judul_tugas_akhir: strata2 === 'Profesi Arsitektur' ? null : `Pengembangan Sistem Akademik ${i}`,
            created_at: now,
            updated_at: now
          };

          await queryInterface.bulkInsert('pendidikan_alumni', [pendidikan2], { transaction: t });
        }
      }

      await t.commit();
      console.log('✅ Seeder alumni OK: 10 alumni dibuat; pendidikan 1–2 per alumni; NIM di pendidikan_alumni.');
    } catch (err) {
      await t.rollback();
      console.error('❌ Seeder alumni gagal:', err);
      throw err;
    }
  },

  async down (queryInterface) {
    // Bersihkan data dummy berdasarkan pola NIM di pendidikan_alumni
    const t = await queryInterface.sequelize.transaction();
    try {
      // Hapus baris pendidikan dengan NIM pattern FT24xxxx
      await queryInterface.sequelize.query(
        `DELETE FROM pendidikan_alumni WHERE nim LIKE 'FT24%';`,
        { transaction: t }
      );

      // Hapus alumni yang tidak lagi punya riwayat pendidikan (opsional aman)
      await queryInterface.sequelize.query(
        `
        DELETE FROM alumni
        WHERE id IN (
          SELECT a.id
          FROM alumni a
          LEFT JOIN pendidikan_alumni p ON p.alumni_id = a.id
          GROUP BY a.id
          HAVING COUNT(p.id) = 0
        );
        `,
        { transaction: t }
      );

      await t.commit();
      console.log('↩️ Undo seeder alumni: selesai (hapus pendidikan_alumni NIM FT24%, lalu alumni yatim).');
    } catch (err) {
      await t.rollback();
      console.error('❌ Undo seeder alumni gagal:', err);
      throw err;
    }
  }
};

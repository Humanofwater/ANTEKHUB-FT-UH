// File: seeders/90-seed-testing-user-alumni.js
// Jalankan: npx sequelize-cli db:seed --seed 90-seed-testing-user-alumni.js
const bcrypt = require('bcryptjs');

async function one(qi, sql, replacements = {}, t) {
  const [rows] = await qi.sequelize.query(sql, { replacements, transaction: t });
  return rows[0] || null;
}

async function getOrCreateByName(qi, table, nameCol, nameVal, extraCols = {}, t) {
  const exists = await one(
    qi,
    `SELECT id FROM "${table}" WHERE ${nameCol} ILIKE :name LIMIT 1`,
    { name: nameVal },
    t
  );
  if (exists) return exists.id;

  const cols = [nameCol, ...Object.keys(extraCols)];
  const params = cols.map((_, i) => `:v${i}`);
  const repl = cols.reduce((acc, c, i) => {
    acc[`v${i}`] = c === nameCol ? nameVal : extraCols[c];
    return acc;
  }, {});
  const sql = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')})
               VALUES (${params.join(', ')})
               RETURNING id`;
  const inserted = await one(qi, sql, repl, t);
  return inserted.id;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      const ALUMNI = {
        nama: "Adnan Fauzan",
        tempat_lahir: "Pinrang",
        tanggal_lahir: "2002-11-29",
        agama: "Islam",
        suku: "Bugis",
        bangsa: "Indonesia",
        alamat: "BTP",
        no_telp: "082134567890",
      };

      const PEND = {
        nim: "D121201078",
        program_studi: "Teknik Informatika",
        strata: "Sarjana",
        tahun_masuk: 2020,
        lama_studi_tahun: 4,
        lama_studi_bulan: 5,
        no_alumni: "0987554",
        tanggal_lulus: "2025-02-09",
        nilai_ujian: "A", // enum valid
        ipk: 3.78,
        predikat_kelulusan: "Sangat Memuaskan",
        judul_tugas_akhir: "Ini adalah ujian akhir",
        ipb: 3.4,
      };

      const USER = {
        email: "adnanxyz789@gmail.com",
        password: "Afr291102!",
        role: "User",
      };

      // Master bangsa & suku
      const bangsaId = await getOrCreateByName(queryInterface, "bangsa", "nama", ALUMNI.bangsa, {}, t);
      const sukuId   = await getOrCreateByName(queryInterface, "suku",   "nama", ALUMNI.suku,   {}, t);

      // === Program Studi: kode = ARRAY(text), alias = ARRAY(text) ===
      const nmLike = `%${PEND.program_studi}%`;
      const prefix = 'D121'; // kode prefix untuk Teknik Informatika FT Unhas (ubah bila perlu)

      let prodi = await one(
        queryInterface,
        `
        SELECT id FROM "program_studi"
        WHERE strata = :strata
          AND (
            EXISTS (SELECT 1 FROM unnest(COALESCE(kode, ARRAY[]::text[])) k WHERE k ILIKE :prefixLike)
            OR nama ILIKE :nmLike
            OR EXISTS (
                SELECT 1 FROM unnest(COALESCE(alias, ARRAY[]::text[])) a
                WHERE a ILIKE :nmLike
            )
          )
        LIMIT 1
        `,
        { strata: PEND.strata, nmLike, prefixLike: `${prefix}%` },
        t
      );

      let programStudiId;
      if (prodi) {
        programStudiId = prodi.id;
      } else {
        const ins = await one(
          queryInterface,
          `
          INSERT INTO "program_studi" (kode, nama, strata, alias, created_at, updated_at)
          VALUES (ARRAY[:k1]::text[], :nama, :strata, ARRAY[:a1, :a2, :a3]::text[], NOW(), NOW())
          RETURNING id
          `,
          { k1: prefix, nama: PEND.program_studi, strata: PEND.strata, a1: 'Teknik Informatika', a2: 'Informatika', a3: 'TI' },
          t
        );
        programStudiId = ins.id;
      }

      // Alumni by (nama + tanggal_lahir) – gunakan DATEONLY ("YYYY-MM-DD")
      const alumniExisting = await one(
        queryInterface,
        `SELECT id FROM "alumni" WHERE nama ILIKE :nama AND tanggal_lahir = :dob LIMIT 1`,
        { nama: ALUMNI.nama, dob: ALUMNI.tanggal_lahir },
        t
      );

      let alumniId;
      if (!alumniExisting) {
        const insAlumni = await one(
          queryInterface,
          `
          INSERT INTO "alumni"
            (uuid, nama, tempat_lahir, tanggal_lahir, agama, suku_id, bangsa_id, alamat, no_telp, user_status, created_at, updated_at)
          VALUES
            (gen_random_uuid(), :nama, :tmp, :dob, :agm, :suku, :bangsa, :alamat, :no, 'Belum Mendaftar', NOW(), NOW())
          RETURNING id
          `,
          {
            nama: ALUMNI.nama,
            tmp: ALUMNI.tempat_lahir,
            dob: ALUMNI.tanggal_lahir,
            agm: ALUMNI.agama,
            suku: sukuId,
            bangsa: bangsaId,
            alamat: ALUMNI.alamat,
            no: ALUMNI.no_telp,
          },
          t
        );
        alumniId = insAlumni.id;
      } else {
        alumniId = alumniExisting.id;
      }

      // Pendidikan alumni by (nim + program_studi_id)
      const paExisting = await one(
        queryInterface,
        `SELECT id FROM "pendidikan_alumni" WHERE nim = :nim AND program_studi_id = :psid LIMIT 1`,
        { nim: PEND.nim, psid: programStudiId },
        t
      );

      if (!paExisting) {
        await queryInterface.sequelize.query(
          `
          INSERT INTO "pendidikan_alumni"
            (alumni_id, program_studi_id, nim, tahun_masuk, tanggal_lulus,
             lama_studi_tahun, lama_studi_bulan, no_alumni, nilai_ujian, ipk,
             predikat_kelulusan, judul_tugas_akhir, ipb, created_at, updated_at)
          VALUES
            (:alumni_id, :program_studi_id, :nim, :tahun_masuk, :tanggal_lulus,
             :lama_studi_tahun, :lama_studi_bulan, :no_alumni, :nilai_ujian, :ipk,
             :predikat_kelulusan, :judul_tugas_akhir, :ipb, NOW(), NOW())
          `,
          {
            replacements: {
              alumni_id: alumniId,
              program_studi_id: programStudiId,
              nim: PEND.nim,
              tahun_masuk: PEND.tahun_masuk,
              tanggal_lulus: PEND.tanggal_lulus,
              lama_studi_tahun: PEND.lama_studi_tahun,
              lama_studi_bulan: PEND.lama_studi_bulan,
              no_alumni: PEND.no_alumni,
              nilai_ujian: PEND.nilai_ujian,
              ipk: PEND.ipk,
              predikat_kelulusan: PEND.predikat_kelulusan,
              judul_tugas_akhir: PEND.judul_tugas_akhir,
              ipb: PEND.ipb,
            },
            transaction: t,
          }
        );
      }

      // Users
      const user = await one(
        queryInterface,
        `SELECT id FROM "users" WHERE LOWER(email) = LOWER(:email) LIMIT 1`,
        { email: USER.email },
        t
      );

      if (!user) {
        const passwordHash = await bcrypt.hash(USER.password, 10);
        await queryInterface.sequelize.query(
          `
          INSERT INTO "users"
            (uuid, email, password, alumni_id, created_at, updated_at)
          VALUES
            (gen_random_uuid(), LOWER(:email), :pwd, :alumni_id, NOW(), NOW())
          `,
          {
            replacements: {
              email: USER.email,
              pwd: passwordHash,
              alumni_id: alumniId,
            },
            transaction: t,
          }
        );
      }

      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },

  async down(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `DELETE FROM "users" WHERE LOWER(email) = LOWER(:email)`,
        { replacements: { email: "adnanxyz789@gmail.com" }, transaction: t }
      );
      await queryInterface.sequelize.query(
        `DELETE FROM "pendidikan_alumni" WHERE nim = :nim`,
        { replacements: { nim: "D121201078" }, transaction: t }
      );
      await queryInterface.sequelize.query(
        `DELETE FROM "alumni" WHERE nama ILIKE :nama AND tanggal_lahir = :dob`,
        { replacements: { nama: "Adnan Fauzan", dob: "2002-11-29" }, transaction: t }
      );
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },
};

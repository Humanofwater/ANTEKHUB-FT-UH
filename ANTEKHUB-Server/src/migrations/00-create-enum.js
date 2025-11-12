'use strict';

/**
 * ENUM master migration untuk PostgreSQL
 * --------------------------------------
 * File ini membuat semua ENUM yang digunakan di seluruh skema ANTEKHUB.
 * Gunakan `Sequelize.ENUM({ name: 'nama_enum', values: [...] })`
 * di model / migration lain agar mengacu ke type ini tanpa membuat duplikat baru.
 */

module.exports = {
  async up (queryInterface) {
    const enums = [
      {
        name: 'agama_enum',
        values: [
          'Islam',
          'Kristen Protestan',
          'Kristen Katholik',
          'Hindu',
          'Budha',
          'Konghucu',
          'Lain-lain'
        ]
      },
      {
        name: 'nilai_ujian_enum',
        values: ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'E', 'F']
      },
      {
        name: 'predikat_enum',
        values: [
          'Summa Cum Laude',
          'Cum Laude',
          'Sangat Memuaskan',
          'Memuaskan',
          'Baik',
          'Cukup',
          'Kurang'
        ]
      },
      {
        name: 'user_status_enum',
        values: [
          'Belum Mendaftar',
          'Belum Konfirmasi Akun',
          'Terdaftar, Belum Membayar',
          'Terdaftar, Sudah Membayar'
        ]
      },
      {
        name: 'role_enum',
        values: ['Admin', 'Super Admin']
      },
      {
        name: 'type_info_enum',
        values: ['Berita', 'Event', 'Lowongan Pekerjaan']
      },
      {
        name: 'status_enum',
        values: [
          'Bekerja',
          'Fresh Graduate',
          'Sedang Mencari Pekerjaan',
          'Sedang Menempuh Studi Lanjut',
          'Wirausaha',
          'Internship'
        ]
      },
      {
        name: 'strata_enum',
        values: [
          'Sarjana',
          'Magister',
          'Doktor',
          'Profesi Arsitektur',
          'Insinyur',
          'Diploma 3'
        ]
      },
      {
        name: 'tujuan_pembayaran_enum',
        values: ['Iuran', 'Pendaftaran', 'Sumbangan', 'Lainnya']
      },
      {
        name: 'metode_pembayaran_enum',
        values: [
          'Kartu Kredit & Debit',
          'Transfer Bank/Virtual Account (VA)',
          'E-Wallet',
          'Over The Counter',
          'PayLater',
          'Direct Debit'
        ]
      },
      {
        name: 'status_pembayaran_enum',
        values: [
          'INIT',
          'PENDING',
          'AWAITING_PAYMENT',
          'PAID',
          'SETTLED',
          'EXPIRED',
          'CANCELED',
          'FAILED',
          'REFUNDED'
        ]
      }
    ];

    for (const e of enums) {
      const formatted = e.values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
      await queryInterface.sequelize.query(`CREATE TYPE "${e.name}" AS ENUM (${formatted});`);
    }
  },

  async down (queryInterface) {
    // Urutan dibalik agar tidak ada ketergantungan yang nyangkut
    const names = [
      'status_pembayaran_enum',
      'metode_pembayaran_enum',
      'tujuan_pembayaran_enum',
      'strata_enum',
      'status_enum',
      'type_info_enum',
      'role_enum',
      'user_status_enum',
      'predikat_enum',
      'nilai_ujian_enum',
      'agama_enum'
    ];
    for (const name of names) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${name}" CASCADE;`);
    }
  }
};

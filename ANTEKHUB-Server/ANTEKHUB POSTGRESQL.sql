CREATE TABLE `jenis_institusi` (
  `id` int,
  `uuid` uuid,
  `nama` varchar(255),
  `aktif` boolean
);

CREATE TABLE `bidang_industri` (
  `id` int,
  `uuid` uuid,
  `nama` varchar(255),
  `aktif` boolean
);

CREATE TABLE `bank` (
  `id` int,
  `uuid` uuid,
  `nama` varchar(255),
  `kategori` varchar(255)
);

CREATE TABLE `bangsa` (
  `id` int,
  `uuid` uuid,
  `nama` varchar(255),
  `iso3` varchar(10),
  `iso2` varchar(10),
  `kode_telepon` int,
  `region` varchar(100),
  `subregion` varchar(100),
  `longitude` float,
  `latitude` float
);

CREATE TABLE `provinsi` (
  `id` int,
  `uuid` uuid,
  `bangsa_id` int,
  `nama` varchar(255),
  `iso2` varchar(50),
  `iso3166_2` varchar(50),
  `longitude` float,
  `latitude` float
);

CREATE TABLE `kabupaten_kota` (
  `id` int,
  `uuid` uuid,
  `provinsi_id` int,
  `nama` varchar(255),
  `longitude` float,
  `latitude` float
);

CREATE TABLE `suku` (
  `id` int,
  `uuid` uuid,
  `nama` varchar(255)
);

CREATE TABLE `program_studi` (
  `id` int,
  `uuid` uuid,
  `kode` varchar(20),
  `nama` varchar(100),
  `strata` ENUM ('Sarjana', 'Magister', 'Doktor', 'Profesi Arsitektur', 'Insinyur', 'Diploma 3')
);

CREATE TABLE `alumni` (
  `id` int,
  `uuid` uuid,
  `nama` varchar(100),
  `tempat_lahir` varchar(100),
  `tanggal_lahir` datetime,
  `agama` ENUM ('Islam', 'Kristen Protestan', 'Kristen Katholik', 'Hindu', 'Buddha', 'Konghucu', 'Lain-lain'),
  `suku_id` int,
  `bangsa_id` int,
  `alamat` varchar(100),
  `no_telp` varchar(20),
  `pendidikan_alumni` array(int),
  `user_status` ENUM ('Belum Mendaftar', 'Belum Konfirmasi Akun', 'Terdaftar, Belum Membayar', 'Terdaftar, Sudah Membayar')
);

CREATE TABLE `pendidikan_alumni` (
  `id` int,
  `uuid` uuid,
  `alumni_id` int,
  `nim` varchar(20),
  `program_studi_id` int,
  `tahun_masuk` int,
  `lama_studi_tahun` int,
  `lama_studi_bulan` int,
  `no_alumni` varchar(20),
  `tanggal_lulus` datetime,
  `nilai_ujian` ENUM ('A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'E', 'F'),
  `ipk` float,
  `predikat_kelulusan` ENUM ('Summa Cum Laude', 'Cum Laude', 'Sangat Memuaskan', 'Memuaskan', 'Baik', 'Cukup', 'Kurang'),
  `judul_tugas_akhir` text,
  `ipb` float
);

CREATE TABLE `users` (
  `id` int,
  `uuid` uuid,
  `email` varchar(100),
  `password` password,
  `alumni_id` int,
  `is_paid` boolean,
  `is_fill_profile` boolean
);

CREATE TABLE `users_admin` (
  `id` int,
  `uuid` uuid,
  `nama` varchar(100),
  `username` varchar(50),
  `nomor_telepon` varchar(20),
  `password` password,
  `role` ENUM ('Admin', 'Super Admin')
);

CREATE TABLE `users_profile` (
  `id` int,
  `uuid` uuid,
  `user_id` int,
  `status` ENUM ('Bekerja', 'Fresh Graduate', 'Sedang Mencari Pekerjaan', 'Sedang Menempuh Studi Lanjut', 'Wirausaha', 'Internship'),
  `domisili_negara_id` int,
  `domisili_provinsi_id` int,
  `domisili_kabupaten_id` int,
  `domisili_alamat` varchar(255),
  `nama_perusahaan` varchar(255),
  `referensi_perusahaan_id` int,
  `jenis_perusahaan_input_id` int,
  `bidang_industri_input_id` int,
  `dom_eq_job` boolean,
  `perusahaan_negara_id` int,
  `perusahaan_provinsi_id` int,
  `perusahaan_kabupaten_id` int,
  `perusahaan_alamat` varchar(255),
  `longitude` float,
  `latitude` float,
  `jabatan` varchar(255),
  `referensi_jabatan_id` int,
  `photo_profile_path` varchar(200),
  `photo_profile_url` varchar(200),
  `valid_until` date
);

CREATE TABLE `referensi_perusahaan` (
  `id` int,
  `uuid` uuid,
  `nama_perusahaan` varchar(255),
  `slug` varchar(255),
  `jenis_perusahaan_id` int,
  `bidang_industri_id` int,
  `perusahaan_negara_id` int,
  `perusahaan_provinsi_id` int,
  `perusahaan_kabupaten_id` int,
  `perusahaan_alamat_id` int,
  `longitude` float,
  `latitude` float,
  `alias_list` JSON,
  `total_alumni` int
);

CREATE TABLE `referensi_jabatan` (
  `id` int,
  `uuid` uuid,
  `jabatan` varchar(255),
  `slug` varchar(255),
  `alis_list` JSON
);

CREATE TABLE `rekening` (
  `id` int,
  `uuid` uuid,
  `nama_rekening` varchar(255),
  `nomor_rekening` varchar(255),
  `bank_id` int,
  `deskripsi` text,
  `aktif` boolean
);

CREATE TABLE `metode_pembayaran` (
  `id` int,
  `kode_metode` varchar(50) UNIQUE,
  `nama` varchar(100),
  `active` boolean
);

CREATE TABLE `saluran_pembayaran` (
  `id` int,
  `uuid` uuid,
  `metode_pembayaran_id` int,
  `kode_saluran` varchar(50) UNIQUE,
  `nama` varchar(100),
  `active` boolean
);

CREATE TABLE `pembayaran` (
  `id` int,
  `uuid` uuid,
  `user_id` int,
  `tujuan_pembayaran` ENUM ('Iuran', 'Pendaftaran', 'Sumbangan', 'Lainnya'),
  `rekening_id` int,
  `event_id` int,
  `order_id` varchar(255) UNIQUE,
  `midtrans_transaction_id` varchar(255) UNIQUE,
  `saluran_pembayaran_id` int,
  `nominal` decimal,
  `total_fee` decimal,
  `status` ENUM ('INIT', 'PENDING', 'AWAITING_PAYMENT', 'PAID', 'SETTLED', 'EXPIRED', 'CANCELED', 'FAILED', 'REFUNDED'),
  `expired_at` date,
  `paid_at` date,
  `settled_at` date,
  `canceled_at` date,
  `va_number` varchar(100),
  `qris_payload` text,
  `ewallet_ref` varchar(100),
  `metadata` JSONB
);

CREATE TABLE `audit_logs_pembayaran` (
  `id` int,
  `pembayaran_id` int,
  `webhook_event` varchar(100),
  `status_from` ENUM ('INIT', 'PENDING', 'AWAITING_PAYMENT', 'PAID', 'SETTLED', 'EXPIRED', 'CANCELED', 'FAILED', 'REFUNDED'),
  `status_to` ENUM ('INIT', 'PENDING', 'AWAITING_PAYMENT', 'PAID', 'SETTLED', 'EXPIRED', 'CANCELED', 'FAILED', 'REFUNDED'),
  `raw` JSONB
);

CREATE TABLE `info_alumni` (
  `id` int,
  `uuid` uuid,
  `user_admin_id` int,
  `title` varchar(200),
  `content` text,
  `type_info` ENUM ('Berita', 'Event', 'Lowongan Pekerjaan'),
  `active` boolean,
  `info_image_path` varchar(200),
  `info_image_url` varchar(200)
);

-- === RELASI ALUMNI / USERS / PROFILE ===
ALTER TABLE users
  ADD FOREIGN KEY (alumni_id) REFERENCES alumni(id);

ALTER TABLE users_profile
  ADD FOREIGN KEY (user_id) REFERENCES users(id);

-- === PROFILE → MASTER REFERENSI ===
ALTER TABLE users_profile
  ADD FOREIGN KEY (referensi_perusahaan_id)   REFERENCES referensi_perusahaan(id),
  ADD FOREIGN KEY (jenis_perusahaan_input_id) REFERENCES jenis_institusi(id),
  ADD FOREIGN KEY (bidang_industri_input_id)  REFERENCES bidang_industri(id),
  ADD FOREIGN KEY (referensi_jabatan_id)      REFERENCES referensi_jabatan(id);

-- === REKENING / BANK ===
ALTER TABLE rekening
  ADD FOREIGN KEY (bank_id) REFERENCES bank(id);

-- === INFO_ALUMNI / USERS_ADMIN (admin yang tercantum di info_alumni) ===
ALTER TABLE info_alumni
  ADD FOREIGN KEY (user_admin_id) REFERENCES users_admin(id);

-- === SUKU & BANGSA DI ALUMNI ===
ALTER TABLE alumni
  ADD FOREIGN KEY (suku_id)  REFERENCES suku(id),
  ADD FOREIGN KEY (bangsa_id) REFERENCES bangsa(id);

-- === PENDIDIKAN ALUMNI ===
ALTER TABLE pendidikan_alumni
  ADD FOREIGN KEY (program_studi_id) REFERENCES program_studi(id),
  ADD FOREIGN KEY (alumni_id)        REFERENCES alumni(id);

-- === DOMISILI & LOKASI DI USERS_PROFILE ===
ALTER TABLE users_profile
  ADD FOREIGN KEY (domisili_negara_id)    REFERENCES bangsa(id),
  ADD FOREIGN KEY (domisili_provinsi_id)  REFERENCES provinsi(id),
  ADD FOREIGN KEY (domisili_kabupaten_id) REFERENCES kabupaten_kota(id),
  ADD FOREIGN KEY (perusahaan_negara_id)    REFERENCES bangsa(id),
  ADD FOREIGN KEY (perusahaan_provinsi_id)  REFERENCES provinsi(id),
  ADD FOREIGN KEY (perusahaan_kabupaten_id) REFERENCES kabupaten_kota(id);

-- === REFERENSI_PERUSAHAAN → MASTER ===
ALTER TABLE referensi_perusahaan
  ADD FOREIGN KEY (jenis_perusahaan_id)    REFERENCES jenis_institusi(id),
  ADD FOREIGN KEY (bidang_industri_id)     REFERENCES bidang_industri(id),
  ADD FOREIGN KEY (perusahaan_negara_id)   REFERENCES bangsa(id),
  ADD FOREIGN KEY (perusahaan_provinsi_id) REFERENCES provinsi(id),
  ADD FOREIGN KEY (perusahaan_kabupaten_id) REFERENCES kabupaten_kota(id);

-- === METODE & SALURAN PEMBAYARAN ===
ALTER TABLE saluran_pembayaran
  ADD FOREIGN KEY (metode_pembayaran_id) REFERENCES metode_pembayaran(id);

-- === PEMBAYARAN (MIDTRANS) ===
ALTER TABLE pembayaran
  ADD FOREIGN KEY (rekening_id)            REFERENCES rekening(id),
  ADD FOREIGN KEY (saluran_pembayaran_id)  REFERENCES saluran_pembayaran(id),
  ADD FOREIGN KEY (user_id)                REFERENCES users(id),
  ADD FOREIGN KEY (event_id)               REFERENCES info_alumni(id);  -- pakai info_alumni sesuai skema kamu sekarang

-- === AUDIT LOG PEMBAYARAN ===
ALTER TABLE audit_logs_pembayaran
  ADD FOREIGN KEY (pembayaran_id) REFERENCES pembayaran(id);


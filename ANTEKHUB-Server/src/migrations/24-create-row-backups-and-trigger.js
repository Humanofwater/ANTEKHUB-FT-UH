"use strict";

/**
 * Row-level backup & Audit Archive:
 *  - Tabel row_backups: Menyimpan backup row-level untuk tabel bisnis
 *  - Tabel audit_logs_archive: Menyimpan arsip audit logs harian
 *  - Trigger function: app__backup_trigger()
 *  - Dipasang ke: alumni, pendidikan_alumni, users_admin, info_alumni, users,
 *                 users_profile, referensi_perusahaan, referensi_jabatan, pembayaran
 *
 * Catatan:
 *  - Menggunakan fungsi app__get_setting() yang sudah dibuat di migration 21
 *  - Ambil aktor & konteks dari current_setting (sama seperti audit)
 *  - Simpan old/new beserta operation dan pk
 *  - Backup audit logs harian dengan pg_cron (opsional)
 */

module.exports = {
  async up(queryInterface) {
    const sql = `
    -- 0) Pastikan ekstensi uuid-ossp aktif (untuk uuid_generate_v4)
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 1) Tabel storage backup row-level
    CREATE TABLE IF NOT EXISTS row_backups (
      id            BIGSERIAL PRIMARY KEY,
      uuid          uuid NOT NULL DEFAULT uuid_generate_v4(),
      occurred_at   timestamptz NOT NULL DEFAULT now(),

      table_name    text NOT NULL,
      operation     text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
      row_pk        text,           -- id baris sumber
      actor_user_id bigint,
      actor_email   text,
      request_id    uuid,

      old_data      jsonb,
      new_data      jsonb
    );
    CREATE INDEX IF NOT EXISTS idx_row_backups_when  ON row_backups(occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_row_backups_table ON row_backups(table_name);
    CREATE INDEX IF NOT EXISTS idx_row_backups_pk    ON row_backups(row_pk);

    -- 2) Trigger function backup
    -- CATATAN: Menggunakan app__get_setting() yang sudah dibuat di migration 21
    CREATE OR REPLACE FUNCTION app__backup_trigger()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      v_tbl text := TG_TABLE_NAME;
      v_op  text := TG_OP;
      v_pk  text;
      v_old jsonb;
      v_new jsonb;
      v_actor_user_id bigint := nullif(app__get_setting('app.user_id'), '')::bigint;
      v_actor_email   text   := nullif(app__get_setting('app.user_email'), '');
      v_request_id    uuid   := nullif(app__get_setting('app.request_id'), '')::uuid;
    BEGIN
      IF (v_op = 'INSERT') THEN
        v_pk := (NEW).id::text;
        v_new := to_jsonb(NEW);
        v_old := NULL;
      ELSIF (v_op = 'DELETE') THEN
        v_pk := (OLD).id::text;
        v_new := NULL;
        v_old := to_jsonb(OLD);
      ELSE -- UPDATE
        v_pk := (NEW).id::text;
        v_new := to_jsonb(NEW);
        v_old := to_jsonb(OLD);
      END IF;

      INSERT INTO row_backups (table_name, operation, row_pk, actor_user_id, actor_email, request_id, old_data, new_data)
      VALUES (v_tbl, v_op, v_pk, v_actor_user_id, v_actor_email, v_request_id, v_old, v_new);

      IF (v_op = 'DELETE') THEN
        RETURN OLD;
      ELSE
        RETURN NEW;
      END IF;
    END $$;

    -- 3) Pasang trigger ke tabel yang diminta
    DO $$
    DECLARE
      t text;
      tables text[] := ARRAY[
        'alumni',
        'pendidikan_alumni',
        'users_admin',
        'info_alumni',
        'users',
        'users_profile',
        'referensi_perusahaan',
        'referensi_jabatan',
        'pembayaran'
      ];
    BEGIN
      FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_backup_%I ON %I;', t, t);
        EXECUTE format('CREATE TRIGGER trg_backup_%I
                        AFTER INSERT OR UPDATE OR DELETE ON %I
                        FOR EACH ROW EXECUTE FUNCTION app__backup_trigger();', t, t);
      END LOOP;
    END $$;

    -- 4) Tabel arsip audit harian
    CREATE TABLE IF NOT EXISTS audit_logs_archive (
      id BIGSERIAL PRIMARY KEY,
      occurred_at timestamptz NOT NULL,
      table_name text NOT NULL,
      operation text NOT NULL,
      row_pk text,
      actor_user_id bigint,
      actor_email text,
      request_id uuid,
      actor_ip text,
      actor_user_agent text,
      http_method text,
      http_path text,
      http_status integer,
      latency_ms integer,
      changed_fields text[],
      old_data jsonb,
      new_data jsonb,
      archived_at timestamptz DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_archive_when ON audit_logs_archive(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_audit_archive_table ON audit_logs_archive(table_name);

    -- 5) Fungsi untuk menyalin audit_logs ke arsip (backup harian)
    CREATE OR REPLACE FUNCTION app__backup_audit_logs()
    RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO audit_logs_archive (
        occurred_at, table_name, operation, row_pk, actor_user_id, actor_email,
        request_id, actor_ip, actor_user_agent, http_method, http_path, http_status,
        latency_ms, changed_fields, old_data, new_data, archived_at
      )
      SELECT 
        occurred_at, table_name, operation, row_pk, actor_user_id, actor_email,
        request_id, actor_ip, actor_user_agent, http_method, http_path, http_status,
        latency_ms, changed_fields, old_data, new_data, now()
      FROM audit_logs
      WHERE occurred_at::date = current_date - 1; -- backup data kemarin
    END $$;

    -- 6) Fungsi untuk menghapus data lama dari audit_logs setelah 30 hari
    CREATE OR REPLACE FUNCTION app__cleanup_old_audit_logs()
    RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      DELETE FROM audit_logs WHERE occurred_at < (current_date - INTERVAL '30 days');
    END $$;

    -- 7) Buat job pg_cron (jika ekstensi aktif)
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Hapus job lama jika ada
        PERFORM cron.unschedule('audit_backup_daily');
        
        -- Jalankan backup setiap jam 00:00
        PERFORM cron.schedule(
          'audit_backup_daily',
          '0 0 * * *',
          $cron$
          SELECT app__backup_audit_logs();
          SELECT app__cleanup_old_audit_logs();
          $cron$
        );
      END IF;
    END $$;
    `;
    await queryInterface.sequelize.query(sql);
  },

  async down(queryInterface) {
    const sql = `
    -- 1) Hapus pg_cron job jika ada
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('audit_backup_daily');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Abaikan error jika job tidak ditemukan
      NULL;
    END $$;

    -- 2) Hapus trigger dari semua tabel
    DO $$
    DECLARE
      t text;
      tables text[] := ARRAY[
        'alumni',
        'pendidikan_alumni',
        'users_admin',
        'info_alumni',
        'users',
        'users_profile',
        'referensi_perusahaan',
        'referensi_jabatan',
        'pembayaran'
      ];
    BEGIN
      FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_backup_%I ON %I;', t, t);
      END LOOP;
    END $$;

    -- 3) Hapus fungsi-fungsi dengan CASCADE untuk menghapus dependensi
    DROP FUNCTION IF EXISTS app__cleanup_old_audit_logs() CASCADE;
    DROP FUNCTION IF EXISTS app__backup_audit_logs() CASCADE;
    DROP FUNCTION IF EXISTS app__backup_trigger() CASCADE;

    -- 4) Hapus tabel
    DROP TABLE IF EXISTS audit_logs_archive CASCADE;
    DROP TABLE IF EXISTS row_backups CASCADE;
    `;
    await queryInterface.sequelize.query(sql);
  },
};

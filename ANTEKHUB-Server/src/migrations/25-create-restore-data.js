"use strict";

/**
 *
 * Fitur restore TANPA approval:
 * - Keamanan: 2FA sekali pakai + role check (current_user = 'postgres' ATAU app.is_super_admin = 'true')
 * - Sumber snapshot: tabel row_backups (sudah dibuat migration sebelumnya)
 * - Table log: restore_exec_logs (mencatat setiap eksekusi restore)
 *
 * Syarat dari aplikasi:
 * - Setelah re-auth (password/biometric) + TOTP sukses, panggil:
 *     SELECT app__open_2fa_session(<user_id>, <ttl_detik>, <ip>, <ua>);
 *   untuk memperoleh two_fa_session_id (UUID).
 * - Saat eksekusi restore dalam 1 transaksi:
 *     SELECT set_config('app.restore_2fa_session', '<two_fa_session_id>', true);
 *     SELECT set_config('app.is_super_admin', 'true', true);   -- jika aktor Super Admin
 *   Lalu panggil app__execute_restore_2fa(...)
 */

module.exports = {
  async up(queryInterface) {
    const sql = `
    -- Opsional: untuk utilitas crypto
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    /* ===============================
       1) Tabel sesi 2FA sekali pakai
       =============================== */
    CREATE TABLE IF NOT EXISTS restore_2fa_sessions (
      id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id     bigint NOT NULL,
      issued_at   timestamptz NOT NULL DEFAULT now(),
      expires_at  timestamptz NOT NULL,
      ip          text,
      ua          text,
      used_at     timestamptz,
      CONSTRAINT ck_restore_2fa_not_expired CHECK (expires_at > issued_at)
    );
    CREATE INDEX IF NOT EXISTS idx_restore_2fa_user    ON restore_2fa_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_restore_2fa_expires ON restore_2fa_sessions(expires_at);

    -- Buka sesi 2FA: dipanggil SETELAH password+TOTP lolos di aplikasi
    CREATE OR REPLACE FUNCTION app__open_2fa_session(
      p_user_id bigint,
      p_ttl_seconds int,
      p_ip text,
      p_ua text
    ) RETURNS uuid
    LANGUAGE plpgsql AS $$
    DECLARE
      v_id uuid;
    BEGIN
      INSERT INTO restore_2fa_sessions(user_id, expires_at, ip, ua)
      VALUES (p_user_id, now() + make_interval(secs => GREATEST(p_ttl_seconds, 60)), p_ip, p_ua)
      RETURNING id INTO v_id;
      RETURN v_id;
    END $$;

    -- Validasi & consume sesi 2FA (sekali pakai)
    CREATE OR REPLACE FUNCTION app__require_and_consume_2fa_session(
      p_session_id uuid,
      p_user_id    bigint
    ) RETURNS void
    LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM 1
      FROM restore_2fa_sessions
      WHERE id = p_session_id
        AND user_id = p_user_id
        AND expires_at > now()
        AND used_at IS NULL
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION '2FA session invalid/expired/already used';
      END IF;

      UPDATE restore_2fa_sessions
        SET used_at = now()
      WHERE id = p_session_id;
    END $$;

    /* ===============================
       2) Log eksekusi restore (audit)
       =============================== */
    CREATE TABLE IF NOT EXISTS restore_exec_logs (
      id             BIGSERIAL PRIMARY KEY,
      executed_at    timestamptz NOT NULL DEFAULT now(),
      actor_user_id  bigint,
      actor_db_user  text NOT NULL DEFAULT current_user,
      table_name     text NOT NULL,
      row_pk         text NOT NULL,
      backup_id      bigint NOT NULL,
      snapshot_used  text NOT NULL CHECK (snapshot_used IN ('OLD','NEW')),
      note           text
    );
    CREATE INDEX IF NOT EXISTS idx_restore_exec_when ON restore_exec_logs(executed_at DESC);

    /* ===============================
       3) Eksekusi restore (2FA + otorisasi)
       =============================== */
    -- Kebijakan otorisasi:
    --  - IZIN jika: current_user = 'postgres'  ATAU  current_setting('app.is_super_admin') = 'true'
    --  - WAJIB 2FA session: current_setting('app.restore_2fa_session') berisi UUID valid (dan di-consume)
    --
    -- Param:
    --  * p_table_name: nama tabel yang direstore
    --  * p_row_pk:     PK baris target (BIGINT)
    --  * p_backup_id:  id di row_backups sebagai sumber snapshot
    --  * p_snapshot:   'OLD' atau 'NEW' (pilih snapshot yang akan dipakai memulihkan)
    --  * p_actor_user_id: id user aplikasi (Super Admin) yang mengeksekusi
    --  * p_note:       alasan singkat (opsional)
    --
    CREATE OR REPLACE FUNCTION app__execute_restore_2fa(
      p_table_name     text,
      p_row_pk         bigint,
      p_backup_id      bigint,
      p_snapshot       text,
      p_actor_user_id  bigint,
      p_note           text DEFAULT NULL
    ) RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      v_rb  row_backups;
      v_json jsonb;
      v_sql  text;
      v_table regclass;
      v_twofa uuid;
      v_is_super text;
    BEGIN
      -- 0) Validasi input dasar
      IF p_snapshot NOT IN ('OLD','NEW') THEN
        RAISE EXCEPTION 'p_snapshot must be OLD or NEW';
      END IF;
      IF p_actor_user_id IS NULL THEN
        RAISE EXCEPTION 'p_actor_user_id is required';
      END IF;

      -- 1) Otorisasi: hanya postgres atau Super Admin (disuntik aplikasi)
      v_is_super := NULLIF(current_setting('app.is_super_admin', true), '');
      IF current_user <> 'postgres' AND COALESCE(v_is_super, 'false') <> 'true' THEN
        RAISE EXCEPTION 'Restore not allowed: requires postgres DB user or app.is_super_admin = true';
      END IF;

      -- 2) 2FA: wajib ada & valid (sekali pakai)
      v_twofa := NULLIF(current_setting('app.restore_2fa_session', true), '')::uuid;
      IF v_twofa IS NULL THEN
        RAISE EXCEPTION 'Missing 2FA session for restore';
      END IF;
      PERFORM app__require_and_consume_2fa_session(v_twofa, p_actor_user_id);

      -- 3) Ambil snapshot dari row_backups
      SELECT * INTO v_rb FROM row_backups WHERE id = p_backup_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Backup id % not found in row_backups', p_backup_id;
      END IF;

      v_json := CASE WHEN p_snapshot = 'OLD' THEN v_rb.old_data ELSE v_rb.new_data END;
      IF v_json IS NULL THEN
        RAISE EXCEPTION 'Selected snapshot (%) has no data', p_snapshot;
      END IF;

      v_table := to_regclass(p_table_name);
      IF v_table IS NULL THEN
        RAISE EXCEPTION 'Table % not found', p_table_name;
      END IF;

      -- 4) Lakukan restore berdasarkan operasi sumber (INSERT/UPDATE/DELETE saat itu)
      IF v_rb.operation = 'UPDATE' THEN
        -- kembalikan semua kolom sesuai snapshot
        v_sql := format($fmt$
          UPDATE %I AS t
          SET    (%s)
                 = (SELECT %s FROM jsonb_populate_record(NULL::%I, $1))
          WHERE  t.id = $2
        $fmt$,
          p_table_name,
          (SELECT string_agg(quote_ident(k), ',') FROM jsonb_object_keys(v_json) AS k),
          (SELECT string_agg(format('(%s)', quote_ident(k)), ',') FROM jsonb_object_keys(v_json) AS k),
          p_table_name
        );
        EXECUTE v_sql USING v_json, p_row_pk;

      ELSIF v_rb.operation = 'DELETE' THEN
        -- pulihkan baris yang dulu dihapus
        v_sql := format($fmt$
          INSERT INTO %I
          SELECT (r).*
          FROM jsonb_populate_record(NULL::%I, $1) AS r
          ON CONFLICT (id) DO UPDATE
          SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::%I, $1))
        $fmt$,
          p_table_name,
          p_table_name,
          (SELECT string_agg(quote_ident(k), ',') FROM jsonb_object_keys(v_json) AS k),
          (SELECT string_agg(format('(%s)', quote_ident(k)), ',') FROM jsonb_object_keys(v_json) AS k),
          p_table_name
        );
        EXECUTE v_sql USING v_json;

      ELSIF v_rb.operation = 'INSERT' THEN
        -- hapus baris untuk kembali ke keadaan sebelum INSERT
        v_sql := format('DELETE FROM %I WHERE id = $1', p_table_name);
        EXECUTE v_sql USING p_row_pk;

      ELSE
        RAISE EXCEPTION 'Unsupported backup operation: %', v_rb.operation;
      END IF;

      -- 5) Catat eksekusi
      INSERT INTO restore_exec_logs(actor_user_id, table_name, row_pk, backup_id, snapshot_used, note)
      VALUES (p_actor_user_id, p_table_name, p_row_pk::text, p_backup_id, p_snapshot, p_note);

      RETURN 'RESTORED';
    END $$;
    `;
    await queryInterface.sequelize.query(sql);
  },

  async down(queryInterface) {
    const sql = `
      DROP FUNCTION IF EXISTS app__execute_restore_2fa(text, bigint, bigint, text, bigint, text);
      DROP FUNCTION IF EXISTS app__require_and_consume_2fa_session(uuid, bigint);
      DROP FUNCTION IF EXISTS app__open_2fa_session(bigint, int, text, text);

      DROP TABLE IF EXISTS restore_exec_logs;
      DROP TABLE IF EXISTS restore_2fa_sessions;
    `;
    await queryInterface.sequelize.query(sql);
  },
};

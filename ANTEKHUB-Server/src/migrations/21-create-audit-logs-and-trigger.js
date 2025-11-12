"use strict";

/**
 * Audit row-level:
 * - Merekam INSERT/UPDATE/DELETE pada tabel bisnis.
 * - Mengambil aktor dari current_setting('app.user_id', true) dkk yang di-set oleh middleware.
 * - Menyimpan diff kolom, old_data, new_data, pk, dll.
 *
 * Catatan:
 * - Asumsi PK = kolom "id". Jika beda, sesuaikan bagian pk_expr.
 * - Tambah atau kurangi daftar tablesToAudit sesuai kebutuhan.
 */

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    // 1) Tabel audit_logs
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id                BIGSERIAL PRIMARY KEY,
        uuid              uuid NOT NULL DEFAULT uuid_generate_v4(),
        occurred_at       timestamptz NOT NULL DEFAULT now(),

        -- konteks aktor (diisi dari current_setting yang di-set middleware)
        actor_user_id     bigint,
        actor_email       text,
        request_id        uuid,
        actor_ip          text,
        actor_user_agent  text,
        http_method       text,
        http_path         text,
        http_status       integer,
        latency_ms        integer,

        -- metadata perubahan
        table_name        text NOT NULL,
        operation         text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
        row_pk            text,            -- disimpan sebagai string (mis. id)
        changed_fields    text[],

        old_data          jsonb,
        new_data          jsonb
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_when ON audit_logs(occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_reqid ON audit_logs(request_id);
    `);

    // 2) Helper function: ambil setting aman
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION app__get_setting(key text)
      RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
      BEGIN
        BEGIN
          RETURN current_setting(key, true);
        EXCEPTION WHEN others THEN
          RETURN NULL;
        END;
      END $$;
    `);

    // 3) Trigger function audit untuk semua tabel
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION app__audit_trigger()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        v_actor_user_id bigint;
        v_actor_email   text;
        v_request_id    uuid;
        v_ip            text;
        v_ua            text;
        v_method        text;
        v_path          text;
        v_status        integer;
        v_latency       integer;

        v_tbl           text := TG_TABLE_NAME;
        v_op            text := TG_OP; -- INSERT/UPDATE/DELETE

        v_pk            text;
        v_old           jsonb;
        v_new           jsonb;
        v_changed       text[];
      BEGIN
        -- Baca context yang diset middleware (NULL-safe)
        v_actor_user_id := nullif(app__get_setting('app.user_id'), '')::bigint;
        v_actor_email   := nullif(app__get_setting('app.user_email'), '');
        v_request_id    := nullif(app__get_setting('app.request_id'), '')::uuid;
        v_ip            := nullif(app__get_setting('app.ip'), '');
        v_ua            := nullif(app__get_setting('app.ua'), '');
        v_method        := nullif(app__get_setting('app.method'), '');
        v_path          := nullif(app__get_setting('app.path'), '');
        v_status        := nullif(app__get_setting('app.status'), '')::int;
        v_latency       := nullif(app__get_setting('app.latency_ms'), '')::int;

        -- Ambil PK (asumsi kolom "id")
        IF (v_op = 'INSERT') THEN
          v_pk  := (NEW).id::text;
          v_new := to_jsonb(NEW);
          v_old := NULL;
          v_changed := ARRAY(SELECT key FROM jsonb_each_text(v_new));
        ELSIF (v_op = 'DELETE') THEN
          v_pk  := (OLD).id::text;
          v_new := NULL;
          v_old := to_jsonb(OLD);
          v_changed := ARRAY(SELECT key FROM jsonb_each_text(v_old));
        ELSE -- UPDATE
          v_pk  := (NEW).id::text;
          v_new := to_jsonb(NEW);
          v_old := to_jsonb(OLD);
          -- daftar kolom yang benar2 berubah nilainya
          v_changed := ARRAY(
            SELECT COALESCE(n.key, o.key) AS key
            FROM jsonb_each(v_new) n
            FULL OUTER JOIN jsonb_each(v_old) o USING (key)
            WHERE n.value IS DISTINCT FROM o.value
          );
        END IF;

        INSERT INTO audit_logs (
          actor_user_id, actor_email, request_id, actor_ip, actor_user_agent,
          http_method, http_path, http_status, latency_ms,
          table_name, operation, row_pk, changed_fields, old_data, new_data
        )
        VALUES (
          v_actor_user_id, v_actor_email, v_request_id, v_ip, v_ua,
          v_method, v_path, v_status, v_latency,
          v_tbl, v_op, v_pk, v_changed, v_old, v_new
        );

        IF (v_op = 'DELETE') THEN
          RETURN OLD;
        ELSE
          RETURN NEW;
        END IF;
      END $$;
    `);

    // 4) Pasang trigger ke tabel-tabel bisnis (edit daftar sesuai kebutuhan)
    const tablesToAudit = [
      "bangsa",
      "provinsi",
      "kabupaten_kota",
      "suku",
      "program_studi",
      "jenis_institusi",
      "bidang_industri",
      "bank",
      "rekening",
      "referensi_perusahaan",
      "referensi_jabatan",
      "users",
      "users_profile",
      "users_admin",
      "metode_pembayaran",
      "saluran_pembayaran",
      "pembayaran",
      //   NOTE: JANGAN audit 'audit_logs' / 'audit_logs_pembayaran' agar tidak rekursi
    ];

    for (const t of tablesToAudit) {
      await sequelize.query(`
        DROP TRIGGER IF EXISTS trg_audit_${t} ON "${t}";
        CREATE TRIGGER trg_audit_${t}
        AFTER INSERT OR UPDATE OR DELETE ON "${t}"
        FOR EACH ROW EXECUTE FUNCTION app__audit_trigger();
      `);
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;

    const tablesToAudit = [
      "bangsa",
      "provinsi",
      "kabupaten_kota",
      "suku",
      "program_studi",
      "jenis_institusi",
      "bidang_industri",
      "bank",
      "rekening",
      "referensi_perusahaan",
      "referensi_jabatan",
      "users",
      "users_profile",
      "users_admin",
      "metode_pembayaran",
      "saluran_pembayaran",
      "pembayaran",
    ];

    // Hapus trigger dari semua tabel
    for (const t of tablesToAudit) {
      await sequelize.query(`DROP TRIGGER IF EXISTS trg_audit_${t} ON "${t}";`);
    }

    // Hapus fungsi dengan CASCADE untuk menghapus semua dependensi
    await sequelize.query(
      `DROP FUNCTION IF EXISTS app__audit_trigger() CASCADE;`
    );
    await sequelize.query(
      `DROP FUNCTION IF EXISTS app__get_setting(text) CASCADE;`
    );
    await sequelize.query(`DROP TABLE IF EXISTS audit_logs CASCADE;`);
  },
};

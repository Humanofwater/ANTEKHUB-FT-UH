'use strict';

/**
 * Buat:
 *  - app__redact_jsonb(jsonb) -> jsonb : masking field sensitif.
 *  - VIEW audit_logs_flat : 1 baris per kolom yang berubah (pretty diff).
 */

module.exports = {
  async up (queryInterface) {
    const sql = `
    -- 1) Redaction helper: mask field sensitif (tambah/kurangi sesuai kebutuhan)
    CREATE OR REPLACE FUNCTION app__redact_jsonb(data jsonb)
    RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
      SELECT COALESCE(
        (
          SELECT jsonb_object_agg(k,
            CASE
              WHEN lower(k) IN ('password','password_hash','token','access_token','refresh_token','secret','otp','nomor_kartu','cvv')
                THEN '"***REDACTED***"'::jsonb
              WHEN lower(k) IN ('nomor_rekening','va_number','qris_payload','ewallet_ref')
                THEN '"***REDACTED***"'::jsonb
              ELSE v
            END
          )
          FROM jsonb_each(data) AS t(k, v)
        ),
        '{}'::jsonb
      );
    $$;

    -- 2) Tampilkan diff audit per field (dengan redaction)
    CREATE OR REPLACE VIEW audit_logs_flat AS
    SELECT
      a.id,
      a.occurred_at,
      a.table_name,
      a.operation,
      a.row_pk,
      a.actor_user_id,
      a.actor_email,
      a.request_id,
      a.actor_ip,
      a.actor_user_agent,
      a.http_method,
      a.http_path,
      a.http_status,
      a.latency_ms,
      key AS field,
      (a.old_data -> key) AS old_value_raw,
      (a.new_data -> key) AS new_value_raw,
      (app__redact_jsonb(a.old_data) -> key) AS old_value,
      (app__redact_jsonb(a.new_data) -> key) AS new_value,
      ((a.new_data -> key) IS DISTINCT FROM (a.old_data -> key)) AS is_changed
    FROM audit_logs a
    LEFT JOIN LATERAL (
      SELECT key
      FROM jsonb_object_keys(COALESCE(a.new_data, '{}'::jsonb) || COALESCE(a.old_data, '{}'::jsonb)) AS allk(key)
    ) AS k ON true
    WHERE ((a.new_data -> k.key) IS DISTINCT FROM (a.old_data -> k.key));
    `;
    await queryInterface.sequelize.query(sql);
  },

  async down (queryInterface) {
    await queryInterface.sequelize.query(`
      DROP VIEW IF EXISTS audit_logs_flat;
      DROP FUNCTION IF EXISTS app__redact_jsonb(jsonb);
    `);
  }
};

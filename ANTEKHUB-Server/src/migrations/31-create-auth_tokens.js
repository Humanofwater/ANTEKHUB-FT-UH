// Migration: 01-create-auth_tokens.js (fixed)
// Token sekali-pakai untuk REGISTER, RESET password, dan CHANGE_EMAIL
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_token_purpose_enum') THEN
          CREATE TYPE auth_token_purpose_enum AS ENUM ('REGISTER','RESET','CHANGE_EMAIL');
        END IF;
      END $$;
    `);

    await queryInterface.createTable("auth_tokens", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },

      token: { type: Sequelize.STRING(256), allowNull: false, unique: true },
      purpose: { type: "auth_token_purpose_enum", allowNull: false },

      email: { type: Sequelize.STRING(200), allowNull: false }, // lower-cased di app-layer
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      alumni_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "alumni", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      expires_at: { type: Sequelize.DATE, allowNull: false },
      used_at: { type: Sequelize.DATE, allowNull: true },
      used_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      meta: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    // Indeks umum
    await queryInterface.addIndex("auth_tokens", ["purpose", "email"], { name: "idx_auth_tokens_purpose_email" });
    await queryInterface.addIndex("auth_tokens", ["expires_at"], { name: "idx_auth_tokens_expires_at" });

    // ✅ Partial index tanpa NOW(): hanya token yang belum dipakai
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_tokens_unused
      ON auth_tokens (token)
      WHERE used_at IS NULL;
    `);

    // ✅ (Opsional) bantu query kadaluarsa untuk token yang belum dipakai
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_unused
      ON auth_tokens (expires_at)
      WHERE used_at IS NULL;
    `);
  },

  async down(queryInterface) {
    // Drop indeks manual (aman jika tidak ada)
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_auth_tokens_unused;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_auth_tokens_expires_unused;`);

    await queryInterface.removeIndex("auth_tokens", "idx_auth_tokens_purpose_email").catch(() => {});
    await queryInterface.removeIndex("auth_tokens", "idx_auth_tokens_expires_at").catch(() => {});

    await queryInterface.dropTable("auth_tokens");
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_token_purpose_enum') THEN
          DROP TYPE auth_token_purpose_enum;
        END IF;
      END $$;
    `);
  },
};

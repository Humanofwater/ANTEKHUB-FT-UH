// scripts/test-db.js
require('dotenv').config();
const { Sequelize } = require('sequelize');

function now() {
  return new Date().toISOString();
}

const cfg = {
  database: process.env.DB_NAME || 'antekhub_db',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'tabriz',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: (msg) => console.log(`[${now()}] [sequelize]`, msg),
  dialectOptions: { connectTimeout: 5000 } // 5s
};

console.log(`[${now()}] 🔧 Using config:`, {
  DB_NAME: cfg.database,
  DB_USER: cfg.username,
  DB_HOST: cfg.host,
  DB_PORT: cfg.port,
  DIALECT: cfg.dialect
});

let sequelize;
(async () => {
  // hard timeout 8s kalau driver hang
  const hardTimeout = setTimeout(() => {
    console.error(`[${now()}] ⏳ Timeout: tidak bisa connect dalam 8 detik. Cek service DB/port/kredensial.`);
    process.exit(2);
  }, 8000);

  try {
    sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, cfg);
    console.log(`[${now()}] ⏱️  Mencoba sequelize.authenticate() ...`);
    await sequelize.authenticate();
    clearTimeout(hardTimeout);
    console.log(`[${now()}] ✅ Connection to PostgreSQL successful!`);
  } catch (err) {
    clearTimeout(hardTimeout);
    console.error(`[${now()}] ❌ Connection failed:`, err?.message || err);
    console.error(err); // detail stack
    process.exit(1);
  } finally {
    try {
      await sequelize?.close();
      console.log(`[${now()}] 🔌 Closed connection.`);
    } catch {}
  }
})();

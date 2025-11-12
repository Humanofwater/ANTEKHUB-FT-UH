// File: scripts/run-seed.js
// Jalankan: npm run db:seed <nama-file>
// Contoh: npm run db:seed 20251022-seed-alumni.js

const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Harap masukkan nama file seeder.\nContoh: npm run db:seed 20251022-seed-alumni.js');
  process.exit(1);
}

const seedName = args[0];
const seedPath = path.join('src', 'seeders', seedName);

try {
  console.log(`🚀 Menjalankan seeder: ${seedPath}`);
  execSync(`npx sequelize-cli db:seed --seed ${seedPath}`, { stdio: 'inherit' });
  console.log('✅ Seeder selesai dijalankan.');
} catch (err) {
  console.error('❌ Gagal menjalankan seeder:', err.message);
  process.exit(1);
}

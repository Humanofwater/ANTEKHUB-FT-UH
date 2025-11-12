// File: scripts/run-seed-undo.js
const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Harap masukkan nama file seeder untuk di-undo.\nContoh: npm run db:seed:undo 20251022-seed-alumni.js');
  process.exit(1);
}

const seedName = args[0];
const seedPath = path.join('src', 'seeders', seedName);

try {
  console.log(`↩️  Undo seeder: ${seedPath}`);
  execSync(`npx sequelize-cli db:seed:undo --seed ${seedPath}`, { stdio: 'inherit' });
  console.log('✅ Undo seeder selesai.');
} catch (err) {
  console.error('❌ Gagal undo seeder:', err.message);
  process.exit(1);
}

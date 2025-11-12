// File: scripts/run-test-all.js
// Menjalankan SEMUA file di folder scripts/ yang NAMANYA DIAWALI "test" dan berakhiran .js
// Contoh file yang akan dijalankan: scripts/test-api.js, scripts/test-auth.js, scripts/test-alumni.js

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = path.join(process.cwd(), 'scripts');
if (!fs.existsSync(dir)) {
  console.error('❌ Folder scripts/ tidak ditemukan.');
  process.exit(1);
}

const files = fs.readdirSync(dir)
  .filter((f) => /^test.*\.js$/i.test(f))
  .sort();

if (files.length === 0) {
  console.warn('⚠️ Tidak ada file test dengan pola "test*.js" di folder scripts/.');
  process.exit(0);
}

console.log('🧪 Menjalankan semua test:');
files.forEach((f, i) => console.log(`${i + 1}. ${f}`));

let failures = 0;
for (const f of files) {
  const full = path.join(dir, f);
  console.log(`\n▶️  Running: ${f}`);
  const res = spawnSync(process.execPath, [full], { stdio: 'inherit' });
  if (res.status !== 0) {
    failures++;
    console.error(`❌ Test gagal: ${f} (exit code ${res.status})`);
  } else {
    console.log(`✅ Sukses: ${f}`);
  }
}

if (failures > 0) {
  console.error(`\n❌ ${failures} test gagal.`);
  process.exit(1);
} else {
  console.log('\n✅ Semua test lulus.');
  process.exit(0);
}

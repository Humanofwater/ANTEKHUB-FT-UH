// File: scripts/run-test.js
// Jalankan 1 file test custom di folder scripts/
// Contoh: npm run test test-api.js  → akan menjalankan node scripts/test-api.js

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Harap masukkan nama file test.\nContoh: npm run test test-api.js');
  process.exit(1);
}

const fileName = args[0];
const testPath = path.join('scripts', fileName);

if (!fs.existsSync(testPath)) {
  console.error(`❌ File test tidak ditemukan: ${testPath}`);
  process.exit(1);
}

console.log(`🧪 Menjalankan test: ${testPath}`);
const child = spawn(process.execPath, [testPath], { stdio: 'inherit' });

child.on('exit', (code) => {
  if (code === 0) {
    console.log('✅ Test selesai tanpa error.');
  } else {
    console.error(`❌ Test gagal dengan exit code ${code}.`);
  }
  process.exit(code);
});

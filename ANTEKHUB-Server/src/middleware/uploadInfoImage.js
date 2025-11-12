// File: src/middleware/uploadInfoImage.js
// Tujuan: upload image untuk info_alumni, menerima format umum & iOS (HEIC/HEIF).
const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage(); // kita upload langsung ke GDrive dari buffer

// daftar ekstensi yang kita izinkan (tambahkan bila perlu)
const ALLOWED_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg',
  '.heic', '.heif', '.heics', '.heifs'
]);

// sebagian perangkat iOS mengirim mimetype non-standar; kita cek mimetype ATAU ekstensi
function isAllowed(file) {
  const mime = (file.mimetype || '').toLowerCase();
  const ext  = path.extname(file.originalname || '').toLowerCase();

  // izinkan semua mimetype image/*
  if (mime.startsWith('image/')) return true;

  // beberapa HEIC di Windows kadang "application/octet-stream" — cek lewat ekstensi
  if (ALLOWED_EXT.has(ext)) return true;

  return false;
}

function fileFilter(_req, file, cb) {
  if (isAllowed(file)) return cb(null, true);
  cb(new Error('Tipe file tidak didukung. Gunakan format gambar (jpg/png/webp/gif/bmp/tiff/svg/heic/heif).'));
}

// batas ukuran opsional (mis. 10MB)
const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = upload;

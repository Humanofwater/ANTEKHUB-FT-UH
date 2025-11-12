# 🎓 ANTEKHUB Backend API

**ANTEKHUB** adalah aplikasi penghubung alumni Fakultas Teknik Universitas Hasanuddin.  
Project ini berfungsi sebagai **backend API service** untuk platform mobile & web ANTEKHUB,  
dengan fitur utama:

- 🔍 **Tracking alumni** berdasarkan status, lokasi, dan perusahaan.
- 💰 **Pembayaran iuran dana abadi alumni** (QRIS/VA/E-Wallet – Coming Soon).
- 📰 **Informasi berita, event, dan lowongan kerja**.
- 🧑‍🎓 **Manajemen data alumni & pendidikan alumni**.
- 🔐 **Sistem login & role-based access (Admin / Super Admin)**.

---

## 🧩 Teknologi Utama

| Komponen | Teknologi |
|-----------|------------|
| **Runtime** | Node.js (v18 – 23) |
| **Framework API** | Express.js |
| **ORM Database** | Sequelize |
| **Database** | PostgreSQL |
| **Storage Image** | Google Drive API (OAuth2) |
| **Auth** | JWT (JSON Web Token) |
| **Frontend Web** | HTML + CSS + JS (Vanilla) |
| **Frontend Mobile** | Flutter |
| **Testing** | Axios + Custom Node.js Script |
| **Server Env (Production)** | Alpine Linux (Server Kampus) |

---

## ⚙️ Instalasi & Setup Environment

### 1️⃣ Clone Repository

```bash
git clone https://github.com/<username>/ANTEKHUB-Server.git
cd ANTEKHUB-Server
npm install
```
Install PostgreSQL
Windows (via installer)
- Unduh PostgreSQL
- Jalankan installer, gunakan user postgres dan password (misal: admin123)
- Buka pgAdmin atau terminal:
  CREATE DATABASE antekhub_db;
  
🔧 Konfigurasi
{
  "development": {
    "username": "postgres",
    "password": "admin123",
    "database": "antekhub_db",
    "host": "127.0.0.1",
    "dialect": "postgres"
  }
}

Buat file .env:
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
GOOGLE_CREDENTIALS_PATH=./config/gdrive-oauth-credentials.json
GOOGLE_TOKEN_PATH=./config/credentials/google-token.json
GOOGLE_DRIVE_FOLDER_ID=1VBzqmCizb8qUCjoNa66ION9srI4Sv_GF

🧱 Migrasi & Seeder Database
- Jalankan migrasi:
    npx sequelize-cli db:migrate
- Jalankan seeder tertentu:
  npm run db:seed seed-admin.js
- Undo seeder tertentu:
  npm run db:seed:undo seed-admin.js
Seeder seed-admin.js akan membuat dua akun:
Super Admin → superadmin_7843 / SAdmin#7843
Admin → admin_XXXX / Admin#XXXX

🚀 Menjalankan Server
Development Mode
   npm run dev
Production Mode
   npm start
Server akan berjalan di:
http://localhost:3000


ANTEKHUB-Server/
├── config/
│   ├── config.json
│   ├── gdrive-oauth-credentials.json
│   └── credentials/
│       └── google-token.json
├── src/
│   ├── app.js
│   ├── server.js
│   ├── controllers/
│   ├── middleware/
│   ├── migrations/
│   ├── models/
│   ├── routes/
│   ├── seeders/
│   ├── validators/
│   └── tests/
├── scripts/
│   ├── test-api.js
│   ├── test-alumni.js
│   ├── test-info.js
│   └── test-user-admin.js
├── public/
│   └── (contoh gambar info alumni)
└── logs/
    └── (hasil test otomatis)

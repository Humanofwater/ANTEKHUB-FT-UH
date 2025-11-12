// File: src/routes/infoAlumni.routes.js
// Tujuan: Routes untuk info/berita/lowongan
// Upload file gambar menggunakan multer (memory storage)

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/infoAlumni.controller');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const uploadImage = require('../middleware/uploadInfoImage');

// Semua endpoint di bawah wajib login Admin/Super Admin
router.use(authenticate);

// CREATE (dengan upload gambar opsional)
router.post('/',
  authorizeRoles('Admin', 'Super Admin'),
  uploadImage.single('image'),
  ctrl.add
);

// LIST (filter: ?type=Berita|Lowongan%20Pekerjaan&active=true|false&search=judul)
router.get('/',
  authorizeRoles('Admin', 'Super Admin'),
  ctrl.getAll
);

// DETAIL
router.get('/:uuid',
  authorizeRoles('Admin', 'Super Admin'),
  ctrl.getOne
);

// UPDATE (parsial; dukung ganti foto)
router.patch('/:uuid',
  authorizeRoles('Admin', 'Super Admin'),
  uploadImage.single('image'),
  ctrl.updateByUuid
);

// DELETE ALL (sangat berbahaya)
router.delete('/__all',
  authorizeRoles('Super Admin'),
  ctrl.deleteAll
);

// DELETE satu/banyak (param :uuid boleh koma-separated atau body { uuids: [] })
router.delete('/:uuid',
  authorizeRoles('Super Admin'),
  ctrl.deleteByUuid
);

router.delete('/',
  authorizeRoles('Super Admin'),
  ctrl.deleteByUuid
);


module.exports = router;
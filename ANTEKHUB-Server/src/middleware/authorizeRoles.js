// File: src/middleware/authorizeRoles.js
// Tujuan: Middleware otorisasi berbasis role yang dinamis.
// Cara pakai: authorizeRoles('Super Admin') atau authorizeRoles('Admin','Super Admin')
//
// Asumsi: middleware autentikasi sudah menaruh objek user ke req.user
//         dengan properti "role" (contoh: 'Admin' | 'Super Admin').
//         Saat dev, bisa override via header X-Role (opsional, untuk testing lokal).

module.exports = function authorizeRoles(...allowed) {
  const allowedSet = new Set(allowed.map(r => String(r).toLowerCase()));
  return (req, res, next) => {
    const fromHeader = req.headers['x-role'];
    const roleRaw =
      (req.user && req.user.role) ||
      (req.admin && req.admin.role) ||
      fromHeader;

    if (!roleRaw) {
      return res.status(401).json({ message: 'Unauthorized: role not found' });
    }

    const role = String(roleRaw).toLowerCase();

    // jika allowed kosong, treat as open (boleh semua) — tapi default kita selalu isi di routes
    if (allowedSet.size === 0 || allowedSet.has(role)) {
      return next();
    }

    return res.status(403).json({
      message: 'Forbidden: role is not allowed',
      required: [...allowedSet],
      got: roleRaw
    });
  };
};

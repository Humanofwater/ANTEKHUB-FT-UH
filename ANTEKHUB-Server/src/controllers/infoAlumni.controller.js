// File: controllers/infoAlumni.controller.js
// Tujuan: CRUD Info Alumni (Berita, Event, Lowongan Pekerjaan) + integrasi upload GDrive
// Kontrak: req.body => { user_admin_id*, title*, content*, type_info*, is_active?, slug?, metadata?, add_payment? }, file? (image buffer via multer)
// Error: 400 untuk input invalid; 404 untuk data tak ditemukan; 500 untuk error tak terduga
// Catatan: Integrasi Google Drive dipertahankan sesuai implementasi awal

const { Op } = require("sequelize");
const { sequelize, InfoAlumni } = require("../models");
const {
  uploadBufferToDrive,
  getDriveClient,
  INFO_ALUMNI_DRIVE_FOLDER_ID,
} = require("../services/googleDrive");
const { validate: uuidValidate } = require("uuid");

// Helper: sanitize output
const sanitize = (row) => (row?.get ? row.get({ plain: true }) : row);

// Slugifier sederhana (hindari dep eksternal)
const toSlug = (text = "") =>
  String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // diakritik
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 220); // batas sesuai model

// ✅ Validasi type_info mengikuti enum DB
const assertTypeInfo = (type) => {
  const allowed = new Set(["Berita", "Event", "Lowongan Pekerjaan"]);
  if (!allowed.has(type)) {
    const list = Array.from(allowed).join(", ");
    const err = new Error(
      `type_info tidak valid. Harus salah satu dari: ${list}`
    );
    err.status = 400;
    throw err;
  }
};

async function deleteDriveFileSafe(drive, fileId, ctx = "") {
  if (!fileId) return;
  try {
    await drive.files.delete({ fileId });
  } catch (e) {
    console.warn(
      `Gagal hapus file GDrive ${fileId}${ctx ? " (" + ctx + ")" : ""}:`,
      e?.message
    );
  }
}

// ========== ADD ==========
exports.add = async (req, res) => {
  try {
    const {
      user_admin_id,
      title,
      content,
      type_info,
      is_active,
      slug,
      metadata,
      add_payment,
    } = req.body;

    // Wajib sesuai model: user_admin_id, title, content, type_info
    if (
      user_admin_id === undefined ||
      !title ||
      !content ||
      !type_info
    ) {
      return res.status(400).json({
        message:
          "user_admin_id, title, content, dan type_info wajib diisi",
      });
    }
    assertTypeInfo(type_info);

    const payload = {
      user_admin_id: Number(user_admin_id),
      title,
      content,
      type_info,
      is_active: typeof is_active === "boolean" ? is_active : true,
      slug: slug ? toSlug(slug) : toSlug(title),
      metadata: metadata
        ? typeof metadata === "string"
          ? JSON.parse(metadata)
          : metadata
        : {},
      add_payment:
        typeof add_payment === "boolean" ? add_payment : false,
    };

    // Upload gambar ke Drive jika ada
    if (req.file) {
      const customFileName = `${type_info}-${Date.now()}-${
        req.file.originalname
      }`.replace(/\s+/g, "_");
      const driveResp = await uploadBufferToDrive(req.file, {
        folderId: INFO_ALUMNI_DRIVE_FOLDER_ID,
        customFileName,
      });
      payload.info_image_url =
        driveResp.direct || driveResp.webContentLink || null;
      payload.info_image_path = driveResp.name || null;
      payload.metadata = {
        ...(payload.metadata || {}),
        gdriveFileId: driveResp.id,
        driveLinks: {
          webViewLink: driveResp.webViewLink,
          webContentLink: driveResp.webContentLink,
        },
      };
    }

    const created = await InfoAlumni.create(payload);
    return res
      .status(201)
      .json({ message: "Info dibuat", data: sanitize(created) });
  } catch (err) {
    console.error("info.add error:", err);
    return res
      .status(err.status || 500)
      .json({ message: err.message || "Gagal membuat info" });
  }
};

// ========== GET ALL (filter/search) ==========
// Query: ?type=Berita|Event|Lowongan%20Pekerjaan & ?active=true|false & ?search=judul
exports.getAll = async (req, res) => {
  try {
    const { type, active, search } = req.query;

    const where = {};
    if (type) {
      assertTypeInfo(type);
      where.type_info = type;
    }
    if (typeof active !== "undefined") {
      const val = String(active).toLowerCase();
      if (val === "true") where.is_active = true;
      else if (val === "false") where.is_active = false;
    }
    if (search && search.trim()) {
      where.title = { [Op.iLike]: `%${search.trim()}%` };
    }

    // Catatan: model tak mendefinisikan published_at; gunakan updated_at/created_at
    const rows = await InfoAlumni.findAll({
      where,
      order: [
        ["updated_at", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    return res.json({ data: rows.map(sanitize), total: rows.length });
  } catch (err) {
    console.error("info.getAll error:", err);
    return res.status(500).json({ message: "Gagal mengambil data info", detail: err.message });
  }
};

// ========== GET ONE ==========
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await InfoAlumni.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: "Info tidak ditemukan" });
    return res.json({ data: sanitize(row) });
  } catch (err) {
    console.error("info.getOne error:", err);
    return res.status(500).json({ message: "Gagal mengambil detail info" });
  }
};

// ========== UPDATE (parsial; dukung ganti foto) ==========
exports.updateByUuid = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await InfoAlumni.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: "Info tidak ditemukan" });

    const body = { ...req.body };
    const updates = {};

    if (typeof body.user_admin_id !== "undefined")
      updates.user_admin_id = Number(body.user_admin_id);
    if (typeof body.title !== "undefined") updates.title = body.title;
    if (typeof body.content !== "undefined") updates.content = body.content;
    if (typeof body.is_active !== "undefined")
      updates.is_active = body.is_active;
    if (typeof body.type_info !== "undefined") {
      assertTypeInfo(body.type_info);
      updates.type_info = body.type_info;
    }
    if (typeof body.slug !== "undefined")
      updates.slug = body.slug ? toSlug(body.slug) : null;
    if (typeof body.add_payment !== "undefined")
      updates.add_payment = !!body.add_payment;

    // Merge metadata
    let currentMeta = row.metadata || {};
    if (typeof body.metadata !== "undefined") {
      const incomingMeta =
        typeof body.metadata === "string"
          ? JSON.parse(body.metadata)
          : body.metadata;
      currentMeta = { ...currentMeta, ...incomingMeta };
      updates.metadata = currentMeta;
    }

    // Ganti foto jika ada file baru (hapus yang lama jika ada)
    if (req.file) {
      const drive = getDriveClient();
      const oldFileId = currentMeta?.gdriveFileId;
      if (oldFileId) {
        try {
          await drive.files.delete({ fileId: oldFileId });
        } catch (e) {
          console.warn("Gagal hapus file lama di GDrive (lanjut):", e?.message);
        }
      }

      const effectiveType = updates.type_info || row.type_info || "Info";
      const customFileName = `${effectiveType}-${Date.now()}-${
        req.file.originalname
      }`.replace(/\s+/g, "_");
      const driveResp = await uploadBufferToDrive(req.file, {
        folderId: INFO_ALUMNI_DRIVE_FOLDER_ID,
        customFileName,
      });

      updates.info_image_url =
        driveResp.webViewLink || driveResp.webContentLink || null;
      updates.info_image_path = driveResp.name || null;

      const newMeta = {
        ...(updates.metadata || currentMeta || {}),
        gdriveFileId: driveResp.id,
        driveLinks: {
          webViewLink: driveResp.webViewLink,
          webContentLink: driveResp.webContentLink,
        },
      };
      updates.metadata = newMeta;
    }

    await row.update(updates);
    return res.json({ message: "Info diperbarui", data: sanitize(row) });
  } catch (err) {
    console.error("info.updateByUuid error:", err);
    return res
      .status(err.status || 500)
      .json({ message: err.message || "Gagal memperbarui info" });
  }
};

// ========== DELETE (hapus file GDrive juga) ==========
exports.deleteByUuid = async (req, res) => {
  try {
    let uuids = [];
    if (req.params.uuid) {
      uuids = req.params.uuid
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    } else if (Array.isArray(req.body.uuids)) {
      uuids = req.body.uuids.filter(Boolean);
    }
    if (!uuids.length)
      return res.status(400).json({ message: "UUID tidak diberikan" });

    // validasi format
    const invalid = uuids.find((u) => !uuidValidate(u));
    if (invalid)
      return res
        .status(400)
        .json({ message: `Format UUID tidak valid: ${invalid}` });

    const rows = await InfoAlumni.findAll({
      where: { uuid: { [Op.in]: uuids } },
    });
    if (!rows.length)
      return res.status(404).json({ message: "Data tidak ditemukan" });

    // hapus file-file di GDrive paralel (safe)
    const drive = getDriveClient();
    await Promise.allSettled(
      rows.map((r) => {
        const fid = r?.metadata?.gdriveFileId;
        return deleteDriveFileSafe(drive, fid, `uuid=${r.uuid}`);
      })
    );

    // hapus data DB
    const deleted = await InfoAlumni.destroy({
      where: { uuid: { [Op.in]: uuids } },
    });
    return res.json({ message: "Hapus info selesai", deleted, uuids });
  } catch (err) {
    console.error("info.deleteByUuid error:", err);
    return res
      .status(500)
      .json({ message: "Gagal menghapus info", detail: err?.message });
  }
};

// ========== DELETE ALL ==========
exports.deleteAll = async (_req, res) => {
  const t = await sequelize.transaction();
  try {
    // ambil semua fileId dulu agar masih bisa dibaca sebelum destroy
    const rows = await InfoAlumni.findAll({
      attributes: ["uuid", "metadata"],
      transaction: t,
      lock: false,
    });

    const drive = getDriveClient();
    await Promise.allSettled(
      rows.map((r) => {
        const fid = r?.metadata?.gdriveFileId;
        return deleteDriveFileSafe(drive, fid, `deleteAll uuid=${r.uuid}`);
      })
    );

    await InfoAlumni.destroy({ where: {}, transaction: t });
    await t.commit();
    return res.json({ message: "Semua info alumni & file gambar dihapus" });
  } catch (err) {
    await t.rollback();
    console.error("info.deleteAll error:", err);
    return res
      .status(500)
      .json({ message: "Gagal menghapus semua info", detail: err?.message });
  }
};
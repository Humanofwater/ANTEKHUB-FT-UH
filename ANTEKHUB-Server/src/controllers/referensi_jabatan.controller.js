// File: src/controllers/referensi_jabatan.controller.js
// Tujuan: CRUD master "ReferensiJabatan" (tanpa pagination; gaya mengikuti bangsa.controller)

const { Op } = require('sequelize');
const Joi = require('joi');
const { sequelize, ReferensiJabatan } = require('../models');

// ===== Validasi =====
const createSchema = Joi.object({
  jabatan: Joi.string().max(255).trim().required(),
  slug: Joi.string().max(255).trim().allow(null, ''),
  alias_list: Joi.array().items(Joi.string().trim()).default([]),
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  jabatan: Joi.string().max(255).trim(),
  slug: Joi.string().max(255).trim().allow(null, ''),
  alias_list: Joi.array().items(Joi.string().trim()),
}).min(1).options({ stripUnknown: true });

// ===== Util =====
const toPlain = (row) => (row?.get ? row.get({ plain: true }) : row);
const normAlias = (arr) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const a of arr) {
    const s = String(a || '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
};

function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || '';
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: 'Format UUID tidak valid', detail: msg };
  }
  if (/duplicate key value/i.test(msg) || /unique constraint/i.test(msg)) {
    // unik ada di kolom slug
    return { status: 409, message: 'Data duplikat (slug sudah digunakan)', detail: msg };
  }
  return null;
}

// ===== CREATE =====
exports.add = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });

    const row = await ReferensiJabatan.create(
      {
        jabatan: payload.jabatan,
        slug: payload.slug ? payload.slug : null,
        alias_list: normAlias(payload.alias_list),
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ message: 'Referensi jabatan dibuat', data: toPlain(row) });
  } catch (err) {
    await t.rollback();
    if (err.isJoi) {
      return res.status(422).json({
        message: 'Validasi gagal',
        errors: err.details.map((d) => ({ path: d.path.join('.'), message: d.message })),
      });
    }
    const mapped = mapSequelizeError(err);
    if (mapped) return res.status(mapped.status).json({ message: mapped.message, detail: mapped.detail });

    console.error('referensi_jabatan.add error:', err);
    return res.status(500).json({ message: 'Gagal membuat referensi jabatan' });
  }
};

// ===== GET ALL (tanpa pagination) =====
// Query opsional:
//   search=...                  → iLike ke jabatan/slug
//   slug=manager&slug=cto       → multi exact slug
//   alias=ketua&alias=head      → JSONB contains salah satu (Op.contains per item)
// Catatan: untuk filter alias, setiap parameter `alias=` akan dicari dengan contains terhadap array berisi 1 elemen
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const slugs = ([]).concat(req.query.slug || []).map((v) => String(v).trim()).filter(Boolean);
    const aliases = ([]).concat(req.query.alias || []).map((v) => String(v).trim()).filter(Boolean);

    const where = {};
    if (search) {
      where[Op.or] = [
        { jabatan: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (slugs.length) where.slug = { [Op.in]: slugs };

    // Untuk JSONB array: cari baris yang alias_list mengandung semua alias yang diminta (AND)
    // Jika ingin OR, ubah jadi Op.or dengan beberapa contains terpisah.
    if (aliases.length === 1) {
      where.alias_list = { [Op.contains]: [aliases[0]] };
    } else if (aliases.length > 1) {
      where[Op.and] = aliases.map((a) => ({ alias_list: { [Op.contains]: [a] } }));
    }

    const rows = await ReferensiJabatan.findAll({
      where,
      order: [['jabatan', 'ASC']],
    });

    return res.json({ data: rows.map(toPlain), meta: { total: rows.length } });
  } catch (err) {
    console.error('referensi_jabatan.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data referensi jabatan' });
  }
};

// ===== GET ONE =====
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await ReferensiJabatan.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Referensi jabatan tidak ditemukan' });
    return res.json({ data: toPlain(row) });
  } catch (err) {
    console.error('referensi_jabatan.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil detail referensi jabatan' });
  }
};

// ===== UPDATE (parsial) =====
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await ReferensiJabatan.findOne({ where: { uuid } });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: 'Referensi jabatan tidak ditemukan' });
    }

    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });

    const update = {};
    if (Object.prototype.hasOwnProperty.call(payload, 'jabatan')) update.jabatan = payload.jabatan;
    if (Object.prototype.hasOwnProperty.call(payload, 'slug')) update.slug = payload.slug || null;
    if (Object.prototype.hasOwnProperty.call(payload, 'alias_list')) update.alias_list = normAlias(payload.alias_list);

    await row.update(update, { transaction: t });
    await t.commit();
    return res.json({ message: 'Referensi jabatan diperbarui', data: toPlain(row) });
  } catch (err) {
    await t.rollback();
    if (err.isJoi) {
      return res.status(422).json({
        message: 'Validasi gagal',
        errors: err.details.map((d) => ({ path: d.path.join('.'), message: d.message })),
      });
    }
    const mapped = mapSequelizeError(err);
    if (mapped) return res.status(mapped.status).json({ message: mapped.message, detail: mapped.detail });

    console.error('referensi_jabatan.update error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui referensi jabatan' });
  }
};

// ===== DELETE single/batch =====
exports.deleteByUuid = async (req, res) => {
  try {
    let uuids = [];
    if (req.params.uuid) {
      uuids = req.params.uuid.split(',').map((v) => v.trim()).filter(Boolean);
    } else if (Array.isArray(req.body.uuids)) {
      uuids = req.body.uuids.filter(Boolean);
    }
    if (!uuids.length) return res.status(400).json({ message: 'UUID tidak diberikan' });

    const found = await ReferensiJabatan.findAll({
      where: { uuid: { [Op.in]: uuids } },
      attributes: ['uuid'],
    });
    if (!found.length) return res.status(404).json({ message: 'Data referensi jabatan tidak ditemukan' });

    const deleted = await ReferensiJabatan.destroy({ where: { uuid: { [Op.in]: uuids } } });
    return res.json({ message: `Berhasil menghapus ${deleted} data referensi jabatan`, deleted, uuids });
  } catch (err) {
    console.error('referensi_jabatan.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus referensi jabatan', detail: err.message });
  }
};

// ===== DELETE ALL (hati-hati) =====
exports.deleteAll = async (_req, res) => {
  try {
    const del = await ReferensiJabatan.destroy({ where: {} });
    return res.json({ message: 'Semua referensi jabatan terhapus', deleted: del });
  } catch (err) {
    console.error('referensi_jabatan.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua referensi jabatan', detail: err.message });
  }
};

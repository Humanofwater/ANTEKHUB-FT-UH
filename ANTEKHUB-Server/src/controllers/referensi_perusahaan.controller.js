// File: src/controllers/referensi_perusahaan.controller.js
// Tujuan: CRUD master "ReferensiPerusahaan" (tanpa pagination; gaya mengikuti bangsa.controller)
// Filter getAll: by bangsa/provinsi/kabupaten (uuid), jenis_institusi (uuid), bidang_industri (uuid)
// Catatan: tidak ada filter berdasar "jabatan" pada versi ini (akan ditambah setelah users_profile API siap)

const { Op } = require('sequelize');
const Joi = require('joi');
const {
  sequelize,
  ReferensiPerusahaan,
  Bangsa,
  Provinsi,
  KabupatenKota,
  JenisInstitusi,
  BidangIndustri,
} = require('../models');

// ===== Validasi =====
const createSchema = Joi.object({
  nama_perusahaan: Joi.string().max(255).trim().required(),
  slug: Joi.string().max(255).trim().allow(null, ''),

  jenis_perusahaan_id: Joi.number().integer().allow(null),
  bidang_industri_id: Joi.number().integer().allow(null),
  perusahaan_negara_id: Joi.number().integer().allow(null),
  perusahaan_provinsi_id: Joi.number().integer().allow(null),
  perusahaan_kabupaten_id: Joi.number().integer().allow(null),

  perusahaan_alamat: Joi.string().max(255).trim().required(),
  longitude: Joi.number().min(-180).max(180).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  alias_list: Joi.array().items(Joi.string().trim()).default([]),
  total_alumni: Joi.number().integer().min(0).default(0),
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  nama_perusahaan: Joi.string().max(255).trim(),
  slug: Joi.string().max(255).trim().allow(null, ''),

  jenis_perusahaan_id: Joi.number().integer().allow(null),
  bidang_industri_id: Joi.number().integer().allow(null),
  perusahaan_negara_id: Joi.number().integer().allow(null),
  perusahaan_provinsi_id: Joi.number().integer().allow(null),
  perusahaan_kabupaten_id: Joi.number().integer().allow(null),

  perusahaan_alamat: Joi.string().max(255).trim(),
  longitude: Joi.number().min(-180).max(180),
  latitude: Joi.number().min(-90).max(90),
  alias_list: Joi.array().items(Joi.string().trim()),
  total_alumni: Joi.number().integer().min(0),
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
    return { status: 409, message: 'Data duplikat (slug sudah digunakan)', detail: msg };
  }
  if (/violates foreign key constraint/i.test(msg)) {
    return { status: 422, message: 'FK tidak valid (periksa *_id)', detail: msg };
  }
  return null;
}

// ===== CREATE =====
exports.add = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });

    const row = await ReferensiPerusahaan.create(
      {
        nama_perusahaan: payload.nama_perusahaan,
        slug: payload.slug || null,

        jenis_perusahaan_id: payload.jenis_perusahaan_id ?? null,
        bidang_industri_id: payload.bidang_industri_id ?? null,
        perusahaan_negara_id: payload.perusahaan_negara_id ?? null,
        perusahaan_provinsi_id: payload.perusahaan_provinsi_id ?? null,
        perusahaan_kabupaten_id: payload.perusahaan_kabupaten_id ?? null,

        perusahaan_alamat: payload.perusahaan_alamat,
        longitude: payload.longitude,
        latitude: payload.latitude,
        alias_list: normAlias(payload.alias_list),
        total_alumni: payload.total_alumni ?? 0,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ message: 'Referensi perusahaan dibuat', data: toPlain(row) });
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

    console.error('referensi_perusahaan.add error:', err);
    return res.status(500).json({ message: 'Gagal membuat referensi perusahaan' });
  }
};

// ===== GET ALL (tanpa pagination) =====
// Semua filter via req.query:
//   search=...                        → iLike nama_perusahaan/slug
//   alias=alias1&alias=alias2         → alias_list contains setiap alias (AND)
//   bangsa_uuid=...                   → filter negara by uuid
//   provinsi_uuid=...                 → filter provinsi by uuid
//   kabupaten_uuid=...                → filter kabupaten by uuid
//   jenis_institusi_uuid=...          → filter jenis institusi by uuid
//   bidang_industri_uuid=...          → filter bidang industri by uuid
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const aliases = ([]).concat(req.query.alias || []).map((v) => String(v).trim()).filter(Boolean);

    const bangsaUuid = (req.query.bangsa_uuid || '').trim();
    const provinsiUuid = (req.query.provinsi_uuid || '').trim();
    const kabupatenUuid = (req.query.kabupaten_uuid || '').trim();
    const jenisInstUuid = (req.query.jenis_institusi_uuid || '').trim();
    const bidangIndUuid = (req.query.bidang_industri_uuid || '').trim();

    const where = {};

    // 0) Search teks
    if (search) {
      where[Op.or] = [
        { nama_perusahaan: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // 1) Alias (JSONB array) — requires all alias
    if (aliases.length === 1) {
      where.alias_list = { [Op.contains]: [aliases[0]] };
    } else if (aliases.length > 1) {
      where[Op.and] = (where[Op.and] || []).concat(
        aliases.map((a) => ({ alias_list: { [Op.contains]: [a] } }))
      );
    }

    // 2) Resolusi UUID → id (Bangsa/Provinsi/Kabupaten/Jenis/Bidang)
    const lookups = [];

    if (bangsaUuid) {
      lookups.push(
        Bangsa.findOne({ where: { uuid: bangsaUuid }, attributes: ['id'] })
          .then((r) => {
            if (!r) throw { status: 404, message: 'Negara (bangsa) tidak ditemukan' };
            where.perusahaan_negara_id = r.id;
          })
      );
    }

    if (provinsiUuid) {
      lookups.push(
        Provinsi.findOne({ where: { uuid: provinsiUuid }, attributes: ['id'] })
          .then((r) => {
            if (!r) throw { status: 404, message: 'Provinsi tidak ditemukan' };
            where.perusahaan_provinsi_id = r.id;
          })
      );
    }

    if (kabupatenUuid) {
      lookups.push(
        KabupatenKota.findOne({ where: { uuid: kabupatenUuid }, attributes: ['id'] })
          .then((r) => {
            if (!r) throw { status: 404, message: 'Kabupaten/Kota tidak ditemukan' };
            where.perusahaan_kabupaten_id = r.id;
          })
      );
    }

    if (jenisInstUuid) {
      lookups.push(
        JenisInstitusi.findOne({ where: { uuid: jenisInstUuid }, attributes: ['id'] })
          .then((r) => {
            if (!r) throw { status: 404, message: 'Jenis institusi tidak ditemukan' };
            where.jenis_perusahaan_id = r.id;
          })
      );
    }

    if (bidangIndUuid) {
      lookups.push(
        BidangIndustri.findOne({ where: { uuid: bidangIndUuid }, attributes: ['id'] })
          .then((r) => {
            if (!r) throw { status: 404, message: 'Bidang industri tidak ditemukan' };
            where.bidang_industri_id = r.id;
          })
      );
    }

    if (lookups.length) await Promise.all(lookups);

    const rows = await ReferensiPerusahaan.findAll({
      where,
      order: [
        ['nama_perusahaan', 'ASC'],
        ['total_alumni', 'DESC'],
      ],
    });

    return res.json({ data: rows.map(toPlain), meta: { total: rows.length } });
  } catch (err) {
    if (err && err.status && err.message) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('referensi_perusahaan.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data referensi perusahaan' });
  }
};

// ===== GET ONE =====
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await ReferensiPerusahaan.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Referensi perusahaan tidak ditemukan' });
    return res.json({ data: toPlain(row) });
  } catch (err) {
    console.error('referensi_perusahaan.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil detail referensi perusahaan' });
  }
};

// ===== UPDATE =====
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await ReferensiPerusahaan.findOne({ where: { uuid } });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: 'Referensi perusahaan tidak ditemukan' });
    }

    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });

    const update = {};
    [
      'nama_perusahaan', 'slug',
      'jenis_perusahaan_id', 'bidang_industri_id',
      'perusahaan_negara_id', 'perusahaan_provinsi_id', 'perusahaan_kabupaten_id',
      'perusahaan_alamat', 'longitude', 'latitude', 'total_alumni',
    ].forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(payload, k)) update[k] = payload[k];
    });
    if (Object.prototype.hasOwnProperty.call(payload, 'alias_list')) {
      update.alias_list = normAlias(payload.alias_list);
    }

    await row.update(update, { transaction: t });
    await t.commit();
    return res.json({ message: 'Referensi perusahaan diperbarui', data: toPlain(row) });
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

    console.error('referensi_perusahaan.update error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui referensi perusahaan' });
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

    const found = await ReferensiPerusahaan.findAll({
      where: { uuid: { [Op.in]: uuids } },
      attributes: ['uuid'],
    });
    if (!found.length) return res.status(404).json({ message: 'Data referensi perusahaan tidak ditemukan' });

    const deleted = await ReferensiPerusahaan.destroy({ where: { uuid: { [Op.in]: uuids } } });
    return res.json({ message: `Berhasil menghapus ${deleted} data referensi perusahaan`, deleted, uuids });
  } catch (err) {
    console.error('referensi_perusahaan.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus referensi perusahaan', detail: err.message });
  }
};

// ===== DELETE ALL (hati-hati) =====
exports.deleteAll = async (_req, res) => {
  try {
    const del = await ReferensiPerusahaan.destroy({ where: {} });
    return res.json({ message: 'Semua referensi perusahaan terhapus', deleted: del });
  } catch (err) {
    console.error('referensi_perusahaan.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua referensi perusahaan', detail: err.message });
  }
};

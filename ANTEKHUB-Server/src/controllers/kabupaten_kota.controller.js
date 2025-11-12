// File: src/controllers/kabupaten_kota.controller.js
// Tujuan: CRUD master Kabupaten/Kota mengikuti gaya bangsa & provinsi (tanpa pagination)
// Unik: (provinsi_id, nama)

const { Op } = require('sequelize');
const { sequelize, KabupatenKota } = require('../models');
const Joi = require('joi');

const createSchema = Joi.object({
  provinsi_id: Joi.number().integer().required(),
  nama: Joi.string().max(255).required(),
  longitude: Joi.number().allow(null),
  latitude: Joi.number().allow(null),
}).options({ stripUnknown: true });

const updateSchema = Joi.object({
  provinsi_id: Joi.number().integer(),
  nama: Joi.string().max(255),
  longitude: Joi.number().allow(null),
  latitude: Joi.number().allow(null),
}).min(1).options({ stripUnknown: true });

const toPlain = (row) => (row?.get ? row.get({ plain: true }) : row);

function mapSequelizeError(err) {
  const msg = err?.original?.message || err?.message || '';
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return { status: 400, message: 'Format UUID tidak valid', detail: msg };
  }
  if (/duplicate key value violates unique constraint/i.test(msg) || /uq_kabupaten_kota_provinsi_nama/i.test(msg)) {
    return { status: 409, message: 'Data duplikat: kombinasi provinsi_id & nama sudah ada', detail: msg };
  }
  return null;
}

// ===== Create =====
exports.add = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const p = await createSchema.validateAsync(req.body, { abortEarly: false });
    const created = await KabupatenKota.create({
      provinsi_id: p.provinsi_id,
      nama: p.nama,
      longitude: typeof p.longitude === 'number' ? p.longitude : null,
      latitude: typeof p.latitude === 'number' ? p.latitude : null,
    }, { transaction: t });

    await t.commit();
    return res.status(201).json({ message: 'Kabupaten/Kota dibuat', data: toPlain(created) });
  } catch (err) {
    await t.rollback();
    if (err.isJoi) {
      return res.status(422).json({
        message: 'Validasi gagal',
        errors: err.details.map(d => ({ path: d.path.join('.'), message: d.message })),
      });
    }
    const mapped = mapSequelizeError(err);
    if (mapped) return res.status(mapped.status).json({ message: mapped.message, detail: mapped.detail });
    console.error('kabupaten_kota.add error:', err);
    return res.status(500).json({ message: 'Gagal membuat kabupaten/kota' });
  }
};

// ===== GET ALL (global; tanpa pagination) =====
exports.getAll = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const provinsiIds = ([]).concat(req.query.provinsi_id || [])
      .filter(v => v !== '').map(Number).filter(n => !Number.isNaN(n));

    const where = {};
    if (search) where.nama = { [Op.iLike]: `%${search}%` };
    if (provinsiIds.length) where.provinsi_id = { [Op.in]: provinsiIds };

    const rows = await KabupatenKota.findAll({
      where,
      order: [['provinsi_id', 'ASC'], ['nama', 'ASC']],
    });

    return res.json({ data: rows.map(toPlain), meta: { total: rows.length } });
  } catch (err) {
    console.error('kabupaten_kota.getAll error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data kabupaten/kota' });
  }
};

// ===== GET ALL by UUID Provinsi =====
exports.getAllByProvinsiUuid = async (req, res) => {
  try {
    const { Provinsi } = require('../models');
    const { provinsi_uuid } = req.params;
    const search = (req.query.search || '').trim();

    const prov = await Provinsi.findOne({ where: { uuid: provinsi_uuid } });
    if (!prov) return res.status(404).json({ message: 'Provinsi tidak ditemukan' });

    const where = { provinsi_id: prov.id };
    if (search) where.nama = { [Op.iLike]: `%${search}%` };

    const rows = await KabupatenKota.findAll({ where, order: [['nama', 'ASC']] });
    return res.json({ data: rows.map(toPlain), meta: { total: rows.length, provinsi_uuid } });
  } catch (err) {
    console.error('kabupaten_kota.getAllByProvinsiUuid error:', err);
    return res.status(500).json({ message: 'Gagal mengambil kabupaten/kota berdasarkan provinsi' });
  }
};

// ===== GET ALL by UUID Bangsa (Negara) =====
exports.getAllByBangsaUuid = async (req, res) => {
  try {
    const { Bangsa, Provinsi } = require('../models');
    const { bangsa_uuid } = req.params;
    const search = (req.query.search || '').trim();

    const negara = await Bangsa.findOne({ where: { uuid: bangsa_uuid } });
    if (!negara) return res.status(404).json({ message: 'Negara (bangsa) tidak ditemukan' });

    const provs = await Provinsi.findAll({ where: { bangsa_id: negara.id }, attributes: ['id'] });
    const provIds = provs.map(p => p.id);
    if (!provIds.length) return res.json({ data: [], meta: { total: 0, bangsa_uuid } });

    const rows = await KabupatenKota.findAll({
      where: { provinsi_id: { [Op.in]: provIds }, ...(search ? { nama: { [Op.iLike]: `%${search}%` } } : {}) },
      order: [['provinsi_id', 'ASC'], ['nama', 'ASC']],
    });

    return res.json({ data: rows.map(toPlain), meta: { total: rows.length, bangsa_uuid } });
  } catch (err) {
    console.error('kabupaten_kota.getAllByBangsaUuid error:', err);
    return res.status(500).json({ message: 'Gagal mengambil kabupaten/kota berdasarkan negara' });
  }
};

// ===== GET ALL by UUID Bangsa + UUID Provinsi (validasi konsistensi) =====
exports.getAllByBangsaAndProvinsiUuid = async (req, res) => {
  try {
    const { Bangsa, Provinsi } = require('../models');
    const { bangsa_uuid, provinsi_uuid } = req.params;
    const search = (req.query.search || '').trim();

    const negara = await Bangsa.findOne({ where: { uuid: bangsa_uuid }, attributes: ['id'] });
    if (!negara) return res.status(404).json({ message: 'Negara (bangsa) tidak ditemukan' });

    const prov = await Provinsi.findOne({
      where: { uuid: provinsi_uuid, bangsa_id: negara.id },
      attributes: ['id'],
    });
    if (!prov) return res.status(400).json({ message: 'Provinsi tidak sesuai dengan negara yang diberikan' });

    const rows = await KabupatenKota.findAll({
      where: { provinsi_id: prov.id, ...(search ? { nama: { [Op.iLike]: `%${search}%` } } : {}) },
      order: [['nama', 'ASC']],
    });

    return res.json({ data: rows.map(toPlain), meta: { total: rows.length, bangsa_uuid, provinsi_uuid } });
  } catch (err) {
    console.error('kabupaten_kota.getAllByBangsaAndProvinsiUuid error:', err);
    return res.status(500).json({ message: 'Gagal mengambil kabupaten/kota (scope negara+provinsi)' });
  }
};

// ===== GET ONE =====
exports.getOne = async (req, res) => {
  try {
    const { uuid } = req.params;
    const row = await KabupatenKota.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Kabupaten/Kota tidak ditemukan' });
    return res.json({ data: toPlain(row) });
  } catch (err) {
    console.error('kabupaten_kota.getOne error:', err);
    return res.status(500).json({ message: 'Gagal mengambil kabupaten/kota' });
  }
};

// ===== UPDATE =====
exports.updateByUuid = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { uuid } = req.params;
    const row = await KabupatenKota.findOne({ where: { uuid } });
    if (!row) return res.status(404).json({ message: 'Kabupaten/Kota tidak ditemukan' });

    const p = await updateSchema.validateAsync(req.body, { abortEarly: false });
    const update = {};
    ['provinsi_id', 'nama', 'longitude', 'latitude'].forEach(k => {
      if (typeof p[k] !== 'undefined') update[k] = p[k] === '' ? null : p[k];
    });

    await row.update(update, { transaction: t });
    await t.commit();
    return res.json({ message: 'Kabupaten/Kota diperbarui', data: toPlain(row) });
  } catch (err) {
    await t.rollback();
    if (err.isJoi) {
      return res.status(422).json({
        message: 'Validasi gagal',
        errors: err.details.map(d => ({ path: d.path.join('.'), message: d.message })),
      });
    }
    const mapped = mapSequelizeError(err);
    if (mapped) return res.status(mapped.status).json({ message: mapped.message, detail: mapped.detail });
    console.error('kabupaten_kota.update error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui kabupaten/kota' });
  }
};

// ===== DELETE =====
exports.deleteByUuid = async (req, res) => {
  try {
    let uuids = [];
    if (req.params.uuid) uuids = req.params.uuid.split(',').map(v => v.trim()).filter(Boolean);
    else if (Array.isArray(req.body.uuids)) uuids = req.body.uuids.filter(Boolean);
    if (!uuids.length) return res.status(400).json({ message: 'UUID tidak diberikan' });

    const deleted = await KabupatenKota.destroy({ where: { uuid: { [Op.in]: uuids } } });
    if (!deleted) return res.status(404).json({ message: 'Data kabupaten/kota tidak ditemukan' });

    return res.json({ message: `Berhasil menghapus ${deleted} data kabupaten/kota`, deleted, uuids });
  } catch (err) {
    console.error('kabupaten_kota.deleteByUuid error:', err);
    return res.status(500).json({ message: 'Gagal menghapus kabupaten/kota', detail: err.message });
  }
};

// ===== DELETE ALL =====
exports.deleteAll = async (_req, res) => {
  try {
    const del = await KabupatenKota.destroy({ where: {} });
    return res.json({ message: 'Semua kabupaten/kota terhapus', deleted: del });
  } catch (err) {
    console.error('kabupaten_kota.deleteAll error:', err);
    return res.status(500).json({ message: 'Gagal menghapus semua kabupaten/kota', detail: err.message });
  }
};

// File: src/controllers/payments.controller.js
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const models = require('../models');
const {
  mapMidtransStatus,
  buildOrderId,
  createSnapTransaction,
  verifyNotificationSignature,
} = require('../services/paymentService');

const DEFAULT_AMOUNT = Number(process.env.PAYMENT_DEFAULT_AMOUNT || 50000);

// Guard: pastikan user sudah complete profile (kamu bisa adjust logic-nya)
async function assertProfileCompleted(userId) {
  const profile = await models.UsersProfile.findOne({ where: { user_id: userId } });
  if (!profile) throw new Error('Profil belum dibuat.');
}

/**
 * POST /api/payments
 * Body:
 *  - tujuan_pembayaran: 'REGISTER_FEE' | 'PROFILE_FEE' | dll (ikut enum kamu)
 *  - nominal (opsional, default dari ENV)
 *  - saluran_pembayaran_id (opsional, untuk hint channel)
 */
exports.create = async (req, res) => {
  const t = await models.sequelize.transaction();
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    await assertProfileCompleted(userId);

    const {
      tujuan_pembayaran,
      nominal,
      saluran_pembayaran_id,   // optional
      event_id,                // optional jika ada “event”
    } = req.body || {};

    if (!tujuan_pembayaran) {
      await t.rollback();
      return res.status(400).json({ message: 'tujuan_pembayaran wajib diisi' });
    }

    const gross = Number(nominal || DEFAULT_AMOUNT);
    if (!Number.isFinite(gross) || gross <= 0) {
      await t.rollback();
      return res.status(400).json({ message: 'nominal tidak valid' });
    }

    // Idempoten: kalau ada PENDING untuk purpose yang sama & belum kadaluarsa, pakai itu
    const existing = await models.Pembayaran.findOne({
      where: {
        user_id: userId,
        tujuan_pembayaran,
        status: { [Op.in]: ['PENDING'] },
      },
      order: [['id', 'DESC']],
      transaction: t,
    });

    let pembayaran = existing;
    if (!pembayaran) {
      // buat baru
      const order_id = buildOrderId({ userId, purpose: tujuan_pembayaran });
      pembayaran = await models.Pembayaran.create(
        {
          user_id: userId,
          tujuan_pembayaran,
          rekening_id: null,
          event_id: event_id || null,
          order_id,
          saluran_pembayaran_id: saluran_pembayaran_id || null,
          nominal: gross,
          total_fee: 0,
          status: 'PENDING',
          expired_at: dayjs().add(Number(process.env.PAYMENT_EXPIRE_MINUTES||60), 'minute').toDate(),
          paid_at: null,
          settled_at: null,
          canceled_at: null,
          va_number: null,
          qris_payload: null,
          ewallet_ref: null,
          metadata: {},
        },
        { transaction: t }
      );
    }

    // Hint channel (optional) → mapping kode saluran → daftar Snap enabled_payments
    let channelHint = undefined;
    if (saluran_pembayaran_id) {
      const saluran = await models.SaluranPembayaran.findByPk(saluran_pembayaran_id, { transaction: t });
      if (saluran?.kode_saluran) {
        // contoh map cepat:
        const k = saluran.kode_saluran.toLowerCase();
        if (k.includes('bri')) channelHint = ['bri_va'];
        else if (k.includes('bni')) channelHint = ['bni_va'];
        else if (k.includes('permata')) channelHint = ['permata_va'];
        else if (k.includes('qris')) channelHint = ['qris'];
        else if (k.includes('gopay')) channelHint = ['gopay'];
      }
    }

    // Snap transaction
    const user = await models.Users.findByPk(userId, { transaction: t });
    const tx = await createSnapTransaction({
      user,
      pembayaranRow: pembayaran,
      grossAmount: pembayaran.nominal,
      channelHint,
    });

    // simpan token/url ke metadata
    await pembayaran.update(
      {
        metadata: {
          ...(pembayaran.metadata || {}),
          snap_token: tx.token,
          snap_redirect_url: tx.redirect_url,
        },
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({
      message: 'Transaksi dibuat',
      data: {
        id: pembayaran.id,
        uuid: pembayaran.uuid,
        order_id: pembayaran.order_id,
        nominal: pembayaran.nominal,
        status: pembayaran.status,
        expired_at: pembayaran.expired_at,
        snap_token: tx.token,
        snap_redirect_url: tx.redirect_url,
      },
    });
  } catch (err) {
    await t.rollback();
    console.error('[payments.create] error:', err);
    return res.status(500).json({ message: 'Gagal membuat transaksi', detail: err.message });
  }
};

/**
 * POST /api/payments/midtrans/notify
 * (Webhook)
 */
exports.notify = async (req, res) => {
  try {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      transaction_time,
      settlement_time,
      va_numbers,
      payment_type,
    } = req.body || {};

    if (!order_id) return res.status(400).json({ message: 'order_id kosong' });

    // Verifikasi signature Midtrans
    if (!verifyNotificationSignature({ order_id, status_code, gross_amount, signature_key })) {
      return res.status(403).json({ message: 'Invalid signature' });
    }

    const pembayaran = await models.Pembayaran.findOne({ where: { order_id } });
    if (!pembayaran) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

    const mapped = mapMidtransStatus({ transaction_status, fraud_status });

    // Simpan data metadata dan status
    const patch = {
      status: mapped,
      metadata: {
        ...(pembayaran.metadata || {}),
        last_midtrans: req.body,
      },
    };

    if (va_numbers && Array.isArray(va_numbers) && va_numbers.length) {
      patch.va_number = va_numbers[0]?.va_number || pembayaran.va_number;
    }
    if (payment_type === 'qris' && req.body?.qr_string) {
      patch.qris_payload = req.body.qr_string;
    }

    if (mapped === 'PAID' || mapped === 'SETTLED') {
      patch.paid_at = pembayaran.paid_at || new Date(transaction_time || Date.now());
    }
    if (mapped === 'SETTLED') {
      patch.settled_at = new Date(settlement_time || Date.now());
    }
    if (['EXPIRED', 'CANCELED', 'FAILED'].includes(mapped)) {
      patch.canceled_at = new Date();
    }

    await pembayaran.update(patch);

    // ✅ Tambahan: ubah status alumni jika transaksi sukses
    if (['PAID', 'SETTLED'].includes(mapped)) {
      try {
        const alumni = await models.Alumni.findOne({
          where: { user_id: pembayaran.user_id },
        });

        if (alumni) {
          await alumni.update({
            user_status: 'Terdaftar, Sudah Membayar',
            is_paid: true
          });
          console.log(`[payments.notify] ✅ Alumni ${alumni.nama} ditandai sebagai "Terdaftar, Sudah Membayar"`);
        } else {
          console.warn(`[payments.notify] ⚠️ Alumni tidak ditemukan untuk user_id=${pembayaran.user_id}`);
        }
      } catch (err) {
        console.error(`[payments.notify] ⚠️ Gagal update status alumni:`, err.message);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[payments.notify] error:', err);
    return res.status(500).json({ message: 'Notify gagal', detail: err.message });
  }
};


/**
 * GET /api/payments/my
 */
exports.myList = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const rows = await models.Pembayaran.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
    });

    return res.json({ data: rows });
  } catch (err) {
    console.error('[payments.myList] error:', err);
    return res.status(500).json({ message: 'Gagal mengambil data' });
  }
};

/**
 * GET /api/payments/:orderId
 */
exports.getByOrderId = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;
    const row = await models.Pembayaran.findOne({ where: { order_id: orderId, user_id: userId } });
    if (!row) return res.status(404).json({ message: 'Tidak ditemukan' });
    return res.json({ data: row });
  } catch (err) {
    console.error('[payments.getByOrderId] error:', err);
    return res.status(500).json({ message: 'Gagal mengambil detail' });
  }
};

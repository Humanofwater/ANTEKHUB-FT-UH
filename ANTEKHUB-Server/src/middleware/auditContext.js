// middleware/auditContext.js
const { v4: uuidv4 } = require('uuid');

module.exports = function auditContext(sequelize) {
  return async function (req, res, next) {
    const started = Date.now();
    const requestId = uuidv4();

    // Dapatkan identitas user (sesuaikan)
    const actorUserId = req.user?.id ?? null;
    const actorEmail  = req.user?.email ?? null;

    // Jalankan request dalam satu transaksi supaya SET LOCAL nempel
    const t = await sequelize.transaction();
    // simpan transaksi di req agar controller pakai transaksi yang sama
    req.tx = t;

    // SET LOCAL context untuk trigger
    await sequelize.query(`
      SELECT
        set_config('app.user_id',      $1, true),
        set_config('app.user_email',   $2, true),
        set_config('app.request_id',   $3, true),
        set_config('app.ip',           $4, true),
        set_config('app.ua',           $5, true),
        set_config('app.method',       $6, true),
        set_config('app.path',         $7, true)
    `, {
      transaction: t,
      bind: [
        actorUserId ? String(actorUserId) : '',
        actorEmail  ? String(actorEmail)  : '',
        requestId,
        req.ip || '',
        req.headers['user-agent'] || '',
        req.method,
        req.originalUrl || req.url
      ]
    });

    // Hook untuk selesai respon -> tulis log & commit/rollback
    res.on('finish', async () => {
      const latency = Date.now() - started;
      try {
        await sequelize.query(`
          SELECT
            set_config('app.status',      $1, true),
            set_config('app.latency_ms',  $2, true)
        `, { transaction: t, bind: [ String(res.statusCode), String(latency) ] });

        // Simpan rekam jejak API
        await sequelize.query(`
          INSERT INTO api_request_logs
            (request_id, actor_user_id, actor_email, method, path, ip, user_agent, status_code, latency_ms, payload)
          VALUES
            ($1,        $2,            $3,          $4,    $5,  $6, $7,        $8,          $9,       $10)
        `, {
          transaction: t,
          bind: [
            requestId, actorUserId, actorEmail,
            req.method, (req.originalUrl || req.url),
            req.ip || '', req.headers['user-agent'] || '',
            res.statusCode, latency,
            // hati-hati menyimpan body sensitif
            req.body ? JSON.stringify(req.body) : JSON.stringify({})
          ]
        });

        await t.commit();
      } catch (e) {
        await t.rollback();
        console.error('auditContext error:', e);
      }
    });

    next();
  };
};

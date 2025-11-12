// File: src/jobs/profileValidity.job.js
// Pengingat 06:00 Asia/Makassar: bila valid_until terlewati → is_fill_profile=false,
// kirim reminder H+0, H+7, H+14, lalu tiap tanggal 1 (bulanan).
const cron = require("node-cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const tz = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(tz);

const { Op } = require("sequelize");
const { Users, UsersProfile } = require("../models");
const { sendNotification } = require("../utils/firebase"); // firebase.js kamu
const { sendMail, buildActionEmail } = require("../services/postmarkService"); // postmarkService.js kamu

const APP_URL = process.env.APP_URL || "https://app.example.com";
const WITA = "Asia/Makassar";

/* ===================== Helpers ===================== */

function toYMDWITA(d) {
  // balikan "YYYY-MM-DD" dalam zona WITA (date-only)
  return dayjs(d).tz(WITA).format("YYYY-MM-DD");
}

function ymdToStartOfDayWITA(ymd) {
  return dayjs.tz(ymd, "YYYY-MM-DD", WITA).startOf("day");
}

function daysAfterDue(validUntilYMD, nowYMD) {
  // Selisih hari (now - due) sebagai DATE-only, aman boundary
  const due = ymdToStartOfDayWITA(validUntilYMD);
  const now = ymdToStartOfDayWITA(nowYMD);
  return now.diff(due, "day"); // >=0 artinya sudah jatuh tempo
}

function isSameYMDWITA(a, b) {
  return toYMDWITA(a) === toYMDWITA(b);
}

async function fetchNotificationTargets(user) {
  return { email: user.email, fcmToken: user.fcm_token || null };
}

async function notifyUser({ user, daysAfterDue }) {
  const { email, fcmToken } = await fetchNotificationTargets(user);
  const title = "Perbarui Profil Alumni";
  const body =
    daysAfterDue <= 0
      ? "Masa berlaku profil Anda telah berakhir. Mohon perbarui sekarang."
      : `Profil Anda belum diperbarui sejak ${daysAfterDue} hari. Mohon perbarui.`;

  // Push (abaikan error jika tidak ada token)
  if (fcmToken) {
    await sendNotification({
      token: fcmToken,
      title,
      body,
      data: { action: "update_profile", url: `${APP_URL}/profile` },
    }).catch(() => {});
  }

  // Email
  if (email) {
    const html = buildActionEmail({
      title,
      greeting: "Halo,",
      bodyLines: [
        "Masa berlaku profil alumni Anda telah habis.",
        "Silakan melakukan pembaruan profil agar data tetap akurat.",
      ],
      buttonText: "Perbarui Sekarang",
      actionUrl: `${APP_URL}/profile`,
      footer: "Pengingat otomatis — abaikan bila sudah diperbarui.",
    });
    await sendMail({
      to: email,
      subject: "[Reminder] Perbarui Profil Alumni",
      html,
    }).catch(() => {});
  }
}

/**
 * Tentukan apakah perlu mengirim reminder & stage berikutnya.
 * @returns { nextStage | 'monthly' | 0 }
 */
function computeTargetStage(days) {
  if (days >= 14) return 3;
  if (days >= 7)  return 2;
  if (days >= 0)  return 1;
  return 0;
}

function decideStage({ days, stage, nowYMD, lastSentAt }) {
  // cegah kirim dobel di hari yang sama
  if (lastSentAt && isSameYMDWITA(lastSentAt, nowYMD)) return 0;

  const target = computeTargetStage(days);
  if (target > stage) {
    // langsung loncat ke stage target (0->2, 0->3, 1->3, dst)
    return target;
  }

  // reminder bulanan tiap tanggal 1 jika sudah stage >=3
  const isFirstDay = ymdToStartOfDayWITA(nowYMD).date() === 1;
  if (stage >= 3 && isFirstDay) return "monthly";

  return 0;
}

/* ===================== Core job ===================== */

async function runOnce(now = dayjs().tz(WITA)) {
  // Normalisasi "hari ini" sebagai YMD WITA.
  const todayYMD = toYMDWITA(now);

  // Ambil semua profile yang memiliki valid_until (DATEONLY, NOT NULL)
  const profiles = await UsersProfile.findAll({
    where: { valid_until: { [Op.ne]: null } },
    include: [{ model: Users, as: "user", required: true }],
  });

  for (const p of profiles) {
    try {
      if (!p.valid_until) continue;

      // Hitung selisih hari (DATE-only WITA)
      const days = daysAfterDue(p.valid_until, todayYMD);

      // Jika jatuh tempo → paksa is_fill_profile=false
      if (days >= 0 && p.user?.is_fill_profile !== false) {
        await p.user.update({ is_fill_profile: false }).catch(() => {});
      }

      // reminder_stage NULL diperlakukan 0
      const currentStage = Number.isInteger(p.reminder_stage) ? p.reminder_stage : 0;
      const decision = decideStage({
        days,
        stage: currentStage,
        nowYMD: todayYMD,
        lastSentAt: p.last_reminder_sent_at,
      });

      if (!decision) continue;

      // Kirim notif/email
      await notifyUser({ user: p.user, daysAfterDue: days }).catch(() => {});

      // Update stage / timestamp
      if (decision === "monthly") {
        await p
          .update({ last_reminder_sent_at: new Date() })
          .catch(() => {});
      } else {
        await p
          .update({
            reminder_stage: decision,          // 1 / 2 / 3
            last_reminder_sent_at: new Date(),
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error("[scheduler] profile error", p?.id, e?.message);
    }
  }
}

/* ===================== Scheduler (cron) ===================== */

function scheduleProfileValidityJob() {
  // 06:00 Asia/Makassar setiap hari
  cron.schedule("0 6 * * *", () => runOnce().catch(console.error), {
    timezone: WITA,
  });
  console.log("[scheduler] profile validity job scheduled at 06:00 Asia/Makassar");
}

module.exports = { scheduleProfileValidityJob, runOnce };
// File: src/services/postmarkService.js
// Tujuan: pembungkus Postmark + helper kirim email template sederhana

const postmark = require("postmark");

const SERVER_TOKEN = process.env.POSTMARK_SERVER_TOKEN;
if (!SERVER_TOKEN) {
  // Jangan crash; tapi log keras agar env disiapkan
  console.warn("[postmark] POSTMARK_SERVER_TOKEN not set");
}

const client = SERVER_TOKEN ? new postmark.ServerClient(SERVER_TOKEN) : null;

async function sendMail({ to, subject, html, text, messageStream = "outbound" }) {
  if (!client) throw new Error("Postmark client not configured");
  const From = process.env.MAIL_FROM;
  const FromName = process.env.MAIL_FROM_NAME || "AntekHub";
  const payload = {
    From: FromName ? `${FromName} <${From}>` : From,
    To: to,
    Subject: subject,
    HtmlBody: html,
    TextBody: text || html?.replace(/<[^>]+>/g, " "),
    MessageStream: messageStream,
  };
  return client.sendEmail(payload);
}

function buildActionEmail({ title, greeting, bodyLines = [], buttonText, actionUrl, footer }) {
  const lines = bodyLines.map(l => `<p style="margin:0 0 12px">${l}</p>`).join("");
  const btn = actionUrl ? `
    <p style="margin:20px 0">
      <a href="${actionUrl}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">
        ${buttonText || "Open"}
      </a>
    </p>` : "";
  return `
  <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;max-width:520px;margin:auto;padding:24px">
    <h2 style="margin:0 0 12px">${title}</h2>
    <p style="margin:0 0 12px">${greeting}</p>
    ${lines}
    ${btn}
    <p style="color:#6b7280;font-size:12px;margin-top:24px">${footer || "Jika kamu tidak meminta ini, abaikan email ini."}</p>
  </div>`;
}

module.exports = { sendMail, buildActionEmail };
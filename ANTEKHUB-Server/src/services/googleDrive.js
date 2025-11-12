// File: src/services/googleDrive.js
// Tujuan: Client Google Drive + helper upload public image/file
// Kontrak: uploadFiletoGdrive(fileLike, { folderId?, customFileName? }) -> { id,name,webViewLink,webContentLink,directView,directDownload }
// Error: Lempar Error bila kredensial/token tidak tersedia atau upload gagal
// Catatan: kompatibel dengan controller infoAlumni & users_profile

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream"); // ✅ FIX: diperlukan oleh toReadable

// ==== Konfigurasi Path Creds & Token ====
const CREDENTIALS_PATH =
  process.env.GOOGLE_CREDENTIALS_PATH ||
  path.join(__dirname, "../../config/credentials/gdrive-oauth-credentials.json");

const TOKEN_PATH =
  process.env.GOOGLE_TOKEN_PATH ||
  path.join(__dirname, "../../config/credentials/google-token.json");

// Default folders (bisa override via ENV)
const INFO_ALUMNI_DRIVE_FOLDER_ID =
  process.env.GOOGLE_DRIVE_FOLDER_ID || "1VBzqmCizb8qUCjoNa66ION9srI4Sv_GF";
const USERS_PROFILE_DRIVE_FOLDER_ID =
  process.env.GOOGLE_DRIVE_USERS_PROFILE_FOLDER_ID ||
  "18vkF-YHJeV5HXL6dOgTySKur4DwaoAQ7";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

let _drive = null;
let _oAuth2Client = null;

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Google OAuth credentials not found at ${CREDENTIALS_PATH}`);
  }
  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  return raw.web || raw.installed || raw;
}

function loadTokenIfAny() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
}

/** Buat stream dari beragam input */
function toReadable(fileLike) {
  if (!fileLike) throw new Error("No file provided to upload");
  if (fileLike.buffer) return Readable.from(fileLike.buffer);         // multer memory
  if (Buffer.isBuffer(fileLike)) return Readable.from(fileLike);
  if (typeof fileLike === "string") return fs.createReadStream(fileLike);
  throw new Error("Unsupported fileLike type for upload");
}

/** Deteksi mimeType sederhana */
function detectMime(fileLike, fallback = "application/octet-stream") {
  const known = fileLike.mimetype || fileLike.mimeType;
  if (known) return known;
  const name =
    fileLike.originalname ||
    fileLike.name ||
    fileLike.filename ||
    fileLike.path ||
    "";
  const ext = (path.extname(name) || "").toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".pdf") return "application/pdf";
  return fallback;
}

function saveToken(tokens) {
  const dir = path.dirname(TOKEN_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

function getOAuth2Client() {
  if (_oAuth2Client) return _oAuth2Client;

  const { client_id, client_secret, redirect_uris } = loadCredentials();
  const redirectUri =
    (redirect_uris && redirect_uris[0]) || process.env.GOOGLE_REDIRECT_URI;
  if (!redirectUri) throw new Error("Missing redirect URI for Google OAuth");

  _oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );

  const token = loadTokenIfAny();
  if (token) {
    _oAuth2Client.setCredentials(token);
    _oAuth2Client.on("tokens", (tokens) => {
      const current = loadTokenIfAny() || {};
      const merged = { ...current, ...tokens };
      saveToken(merged);
    });
  }
  return _oAuth2Client;
}

function getDriveClient() {
  if (_drive) return _drive;
  const auth = getOAuth2Client();
  _drive = google.drive({ version: "v3", auth });
  return _drive;
}

// ===== Helper publik =====
function generateAuthUrl() {
  const auth = getOAuth2Client();
  return auth.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

async function exchangeCodeForToken(code) {
  const auth = getOAuth2Client();
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);
  saveToken(tokens);
  return tokens;
}

async function setFilePublic(fileId) {
  const drive = getDriveClient();
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });
}

function ensureExt(name, mime) {
  const hasExt = !!path.extname(name || "");
  if (hasExt) return name || "untitled";
  const ext =
    mime.includes("jpeg")
      ? ".jpg"
      : mime.includes("png")
      ? ".png"
      : mime.includes("webp")
      ? ".webp"
      : mime.includes("gif")
      ? ".gif"
      : mime.includes("pdf")
      ? ".pdf"
      : "";
  return (name || "untitled") + ext;
}

function buildPublicLinks(fileId) {
  const directView = `https://drive.google.com/uc?id=${fileId}`;
  const directDownload = `https://drive.google.com/uc?export=download&id=${fileId}`;
  return { directView, directDownload };
}

/** Fungsi baru yang diminta: uploadFiletoGdrive */
async function uploadFiletoGdrive(fileLike, { folderId, customFileName } = {}) {
  const drive = getDriveClient();

  const mimeType = detectMime(fileLike);
  const srcName =
    customFileName ||
    fileLike.originalname ||
    fileLike.name ||
    (typeof fileLike === "string" ? path.basename(fileLike) : "") ||
    "untitled";
  const safeName = ensureExt(srcName, mimeType);
  const bodyStream = toReadable(fileLike);

  const res = await drive.files.create({
    requestBody: {
      name: safeName,
      parents: folderId ? [folderId] : [],
      mimeType,
    },
    media: { mimeType, body: bodyStream },
    fields: "id,name,mimeType,size,webViewLink,webContentLink,md5Checksum",
  });

  await setFilePublic(res.data.id);
  const links = buildPublicLinks(res.data.id);

  return {
    ...res.data, // id,name,mimeType,size,webViewLink,webContentLink,md5Checksum
    ...links, // directView,directDownload
  };
}

/** Back-compat: alias ke nama lama yang sudah dipakai controller */
async function uploadBufferToDrive(fileLike, opts) {
  return uploadFiletoGdrive(fileLike, opts);
}

async function deleteFolderAndContents(folderId) {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents`,
    fields: "files(id, name)",
  });
  for (const f of res.data.files || []) {
    await drive.files.delete({ fileId: f.id });
  }
  await drive.files.delete({ fileId: folderId });
}

async function deleteDriveFile(fileId) {
  // opsional: service account untuk delete
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/drive"]
  );
  const drive = google.drive({ version: "v3", auth });
  try {
    await drive.files.delete({ fileId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  getDriveClient,
  getOAuth2Client,
  generateAuthUrl,
  exchangeCodeForToken,
  uploadFiletoGdrive,   // ✅ nama baru
  uploadBufferToDrive,  // ✅ alias kompatibel
  deleteFolderAndContents,
  setFilePublic,
  deleteDriveFile,
  INFO_ALUMNI_DRIVE_FOLDER_ID,
  USERS_PROFILE_DRIVE_FOLDER_ID,
  CREDENTIALS_PATH,
  TOKEN_PATH,
};

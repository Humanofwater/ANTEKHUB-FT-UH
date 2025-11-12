// File: app.js
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const auditContext = require("./middleware/auditContext");
const app = express();

// Security & DX middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(auditContext(require("./models").sequelize));

// Health check
app.get("/health", (req, res) => res.json({ status: "OK" }));

// Routes (mengacu struktur: src/routes/index.js => module.exports = router)
const routes = require("./routes");
app.use("/api", routes);

// === Import & jalankan scheduler ===
const { scheduleProfileValidityJob } = require("./jobs/profileValidity.job");
scheduleProfileValidityJob(); // ✅ Aktifkan cron job (jalan otomatis tiap 06:00 WITA)

// 404 handler
app.use((req, res, next) => {
  if (res.headersSent) return next();
  return res.status(404).json({ message: "Endpoint not found" });
});

// Centralized error handler
// Pastikan controller/route melempar next(err) bila perlu
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  const code = err.status || 500;
  res.status(code).json({ message: err.message || "Internal Server Error" });
});

module.exports = app;

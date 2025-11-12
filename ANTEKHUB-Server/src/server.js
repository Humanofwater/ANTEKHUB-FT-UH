// File: server.js
const app = require('./app');
const { sequelize } = require('./models'); // ⬅️ mengacu ke src/models sesuai struktur

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB Connected');

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      try {
        console.log(`\n${signal} received, shutting down...`);
        server.close(() => console.log('HTTP server closed'));
        await sequelize.close();
        console.log('DB connection closed');
        process.exit(0);
      } catch (e) {
        console.error('Error during shutdown', e);
        process.exit(1);
      }
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('DB connection error:', error);
    process.exit(1);
  }
})();

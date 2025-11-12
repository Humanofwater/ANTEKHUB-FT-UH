require('dotenv').config();

module.exports = {
    development: {
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'tabriz',
        database: process.env.DB_NAME || 'antekhub_db',
        host: process.env.DB_HOST || '127.0.0.1',
        dialect: 'postgres',
        logging: false
    },
    test: {
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'tabriz',
        database: process.env.DB_NAME || 'antekhub_db',
        host: process.env.DB_HOST || '127.0.0.1',
        dialect: 'postgres',
        logging: false
    },
    production: {
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'tabriz',
        database: process.env.DB_NAME || 'anetekhub_db',
        host: process.env.DB_HOST || '127.0.0.1',
        dialect: 'postgres',
        dialectOptions: {
            ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false
        },
        logging: false 
    }
};
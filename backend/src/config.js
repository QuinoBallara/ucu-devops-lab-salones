const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

const SLOT_START = 8;
const SLOT_END = 22;

module.exports = {
  DB_PATH,
  SLOT_START,
  SLOT_END,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  PORT: process.env.PORT || 3000,
};

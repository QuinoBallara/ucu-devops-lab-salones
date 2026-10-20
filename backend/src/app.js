const express = require('express');
const { createDb } = require('./db');
const { buildRoutes } = require('./routes');
const { SLOT_START, SLOT_END } = require('./config');

function createApp(dbPath) {
  const app = express();
  app.use(express.json());

  const db = createDb(dbPath);
  app.locals.db = db;

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/slots', (req, res) => res.json({ start: SLOT_START, end: SLOT_END }));
  app.use('/api', buildRoutes(db));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'error interno' });
  });

  return app;
}

module.exports = { createApp };

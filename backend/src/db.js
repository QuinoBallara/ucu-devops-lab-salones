const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH } = require('./config');

function createDb(dbPath = DB_PATH) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  seed(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      capacity INTEGER NOT NULL,
      equipment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      date TEXT NOT NULL,
      start_slot INTEGER NOT NULL,
      end_slot INTEGER NOT NULL,
      owner_name TEXT NOT NULL,
      group_name TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reservation_slots (
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      date TEXT NOT NULL,
      slot INTEGER NOT NULL,
      reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
      UNIQUE (room_id, date, slot)
    );

    CREATE INDEX IF NOT EXISTS idx_slots_lookup ON reservation_slots (date, room_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_owner ON reservations (owner_name, status);
  `);
}

function seed(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM rooms').get().c;
  if (count > 0) return;
  const insert = db.prepare('INSERT INTO rooms (name, capacity, equipment) VALUES (?, ?, ?)');
  const rooms = [
    ['Salón 101', 40, 'proyector, pizarra'],
    ['Salón 102', 30, 'pizarra'],
    ['Laboratorio A', 24, '24 PCs, proyector'],
    ['Laboratorio B', 24, '24 PCs, pizarra'],
    ['Salón Multiusos', 80, 'proyector, sonido, micrófono'],
    ['Sala de reuniones', 10, 'pantalla, pizarra'],
  ];
  const tx = db.transaction(() => rooms.forEach((r) => insert.run(...r)));
  tx();
}

module.exports = { createDb };

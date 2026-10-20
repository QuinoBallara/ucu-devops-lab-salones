const express = require('express');
const { auth, requireRole, issueToken, checkPassword } = require('./auth');
const { SLOT_START, SLOT_END } = require('./config');

function isValidDate(d) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
}

function buildRoutes(db) {
  const router = express.Router();

  router.post('/auth/role', (req, res) => {
    const { role, name, password } = req.body || {};
    if (role === 'alumno') {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'nombre requerido' });
      }
      return res.json({ token: issueToken({ name: name.trim(), role: 'alumno' }), role, name: name.trim() });
    }
    if (role === 'admin') {
      if (!checkPassword(password)) {
        return res.status(401).json({ error: 'clave incorrecta' });
      }
      return res.json({ token: issueToken({ name: 'admin', role: 'admin' }), role, name: 'admin' });
    }
    return res.status(400).json({ error: 'rol inválido (alumno | admin)' });
  });

  router.get('/rooms', (req, res) => {
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY name').all();
    res.json(rooms.map((r) => ({ ...r, equipment: r.equipment.split(',').map((s) => s.trim()).filter(Boolean) })));
  });

  router.get('/availability', (req, res) => {
    const { date, start, end } = req.query;
    if (!isValidDate(date)) return res.status(400).json({ error: 'date requerida (YYYY-MM-DD)' });
    const startSlot = Number.isInteger(Number(start)) ? Number(start) : SLOT_START;
    const endSlot = Number.isInteger(Number(end)) ? Number(end) : SLOT_END;
    if (startSlot < SLOT_START || endSlot > SLOT_END || startSlot >= endSlot) {
      return res.status(400).json({ error: `franja inválida (permitido ${SLOT_START}-${SLOT_END})` });
    }
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY name').all();
    const takenStmt = db.prepare(
      `SELECT s.slot, r.owner_name, r.group_name FROM reservation_slots s
       JOIN reservations r ON r.id = s.reservation_id
       WHERE s.room_id = ? AND s.date = ? AND s.slot >= ? AND s.slot < ? AND r.status = 'active'`
    );
    const result = rooms.map((room) => {
      const taken = takenStmt.all(room.id, date, startSlot, endSlot);
      const takenBySlot = new Map(taken.map((t) => [t.slot, t]));
      const slots = [];
      for (let s = startSlot; s < endSlot; s++) {
        const t = takenBySlot.get(s);
        slots.push({ slot: s, free: !t, owner: t ? t.group_name || t.owner_name : null });
      }
      return { room: { ...room, equipment: room.equipment.split(',').map((x) => x.trim()).filter(Boolean) }, slots };
    });
    res.json(result);
  });

  router.post('/reservations', auth, (req, res) => {
    const { room_id, date, start_slot, end_slot, group_name } = req.body || {};
    if (!isValidDate(date)) return res.status(400).json({ error: 'date inválida (YYYY-MM-DD)' });
    const start = Number(start_slot);
    const end = Number(end_slot);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < SLOT_START || end > SLOT_END || start >= end) {
      return res.status(400).json({ error: `franja inválida (permitido ${SLOT_START}-${SLOT_END})` });
    }
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
    if (!room) return res.status(404).json({ error: 'salón inexistente' });
    const owner = req.user.role === 'admin' ? (req.body.owner_name || req.user.name) : req.user.name;
    if (!owner || !String(owner).trim()) return res.status(400).json({ error: 'owner_name requerido' });

    const create = db.transaction(() => {
      const info = db
        .prepare('INSERT INTO reservations (room_id, date, start_slot, end_slot, owner_name, group_name) VALUES (?, ?, ?, ?, ?, ?)')
        .run(room.id, date, start, end, String(owner).trim(), group_name ? String(group_name).trim() : null);
      const insertSlot = db.prepare('INSERT INTO reservation_slots (room_id, date, slot, reservation_id) VALUES (?, ?, ?, ?)');
      for (let s = start; s < end; s++) {
        insertSlot.run(room.id, date, s, info.lastInsertRowid);
      }
      return info.lastInsertRowid;
    });

    try {
      const id = create();
      res.status(201).json({ id, room_id: room.id, date, start_slot: start, end_slot: end, owner_name: owner, group_name: group_name || null, status: 'active' });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'el salón ya está reservado en esa franja' });
      }
      throw e;
    }
  });

  router.get('/reservations/mine', auth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT r.*, rooms.name AS room_name FROM reservations r
         JOIN rooms ON rooms.id = r.room_id
         WHERE r.owner_name = ? ORDER BY r.date DESC, r.start_slot DESC`
      )
      .all(req.user.name);
    res.json(rows);
  });

  router.delete('/reservations/:id', auth, (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'reserva inexistente' });
    if (req.user.role !== 'admin' && row.owner_name !== req.user.name) {
      return res.status(403).json({ error: 'solo podés cancelar tus propias reservas' });
    }
    const tx = db.transaction(() => {
      db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(id);
      db.prepare('DELETE FROM reservation_slots WHERE reservation_id = ?').run(id);
    });
    tx();
    res.json({ ok: true, id });
  });

  // ---- admin ----
  router.post('/admin/rooms', auth, requireRole('admin'), (req, res) => {
    const { name, capacity, equipment } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name requerido' });
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap <= 0) return res.status(400).json({ error: 'capacity inválida' });
    const eq = Array.isArray(equipment) ? equipment.join(', ') : String(equipment || '');
    try {
      const info = db.prepare('INSERT INTO rooms (name, capacity, equipment) VALUES (?, ?, ?)').run(String(name).trim(), cap, eq);
      res.status(201).json({ id: info.lastInsertRowid, name: String(name).trim(), capacity: cap, equipment: eq.split(',').map((s) => s.trim()).filter(Boolean) });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'ya existe un salón con ese nombre' });
      throw e;
    }
  });

  router.put('/admin/rooms/:id', auth, requireRole('admin'), (req, res) => {
    const id = Number(req.params.id);
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) return res.status(404).json({ error: 'salón inexistente' });
    const { name, capacity, equipment } = req.body || {};
    const newName = name ? String(name).trim() : room.name;
    const newCap = capacity !== undefined ? Number(capacity) : room.capacity;
    if (!Number.isInteger(newCap) || newCap <= 0) return res.status(400).json({ error: 'capacity inválida' });
    const eq = equipment !== undefined ? (Array.isArray(equipment) ? equipment.join(', ') : String(equipment)) : room.equipment;
    db.prepare('UPDATE rooms SET name = ?, capacity = ?, equipment = ? WHERE id = ?').run(newName, newCap, eq, id);
    res.json({ id, name: newName, capacity: newCap, equipment: eq.split(',').map((s) => s.trim()).filter(Boolean) });
  });

  router.delete('/admin/rooms/:id', auth, requireRole('admin'), (req, res) => {
    const id = Number(req.params.id);
    const active = db
      .prepare(
        `SELECT COUNT(*) AS c FROM reservation_slots s
         JOIN reservations r ON r.id = s.reservation_id
         WHERE s.room_id = ? AND r.status = 'active'`
      )
      .get(id).c;
    if (active > 0) return res.status(409).json({ error: 'el salón tiene reservas activas' });
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
    if (!room) return res.status(404).json({ error: 'salón inexistente' });
    db.transaction(() => {
      db.prepare('DELETE FROM reservation_slots WHERE room_id = ?').run(id);
      db.prepare('DELETE FROM reservations WHERE room_id = ?').run(id);
      db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    })();
    res.json({ ok: true, id });
  });

  router.get('/admin/reservations', auth, requireRole('admin'), (req, res) => {
    const rows = db
      .prepare(
        `SELECT r.*, rooms.name AS room_name FROM reservations r
         JOIN rooms ON rooms.id = r.room_id ORDER BY r.date DESC, r.start_slot DESC`
      )
      .all();
    res.json(rows);
  });

  router.get('/admin/stats', auth, requireRole('admin'), (req, res) => {
    const totalActive = db.prepare("SELECT COUNT(*) AS c FROM reservations WHERE status = 'active'").get().c;
    const cancelled = db.prepare("SELECT COUNT(*) AS c FROM reservations WHERE status = 'cancelled'").get().c;
    const byRoom = db
      .prepare(
        `SELECT rooms.name AS room, COUNT(s.slot) AS slots
         FROM reservation_slots s JOIN rooms ON rooms.id = s.room_id
         JOIN reservations r ON r.id = s.reservation_id
         WHERE r.status = 'active' GROUP BY rooms.id ORDER BY slots DESC`
      )
      .all();
    const byDate = db
      .prepare(
        `SELECT date, COUNT(DISTINCT reservation_id) AS reservations
         FROM reservation_slots GROUP BY date ORDER BY date DESC LIMIT 30`
      )
      .all();
    const byOwner = db
      .prepare(
        `SELECT owner_name, COUNT(*) AS reservations FROM reservations
         WHERE status = 'active' GROUP BY owner_name ORDER BY reservations DESC LIMIT 10`
      )
      .all();
    res.json({ totalActive, cancelled, byRoom, byDate, byOwner });
  });

  return router;
}

module.exports = { buildRoutes };

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

function freshApp() {
  const app = createApp(':memory:');
  return app;
}

async function loginAlumno(app, name = 'Ana') {
  const res = await request(app).post('/api/auth/role').send({ role: 'alumno', name });
  return res.body.token;
}

async function loginAdmin(app, password = 'admin123') {
  const res = await request(app).post('/api/auth/role').send({ role: 'admin', password });
  return res.body.token;
}

test('salones seedeados', async () => {
  const app = freshApp();
  const res = await request(app).get('/api/rooms');
  assert.equal(res.status, 200);
  assert.ok(res.body.length >= 5);
  assert.ok(res.body[0].capacity > 0);
  assert.ok(Array.isArray(res.body[0].equipment));
});

test('login por rol', async () => {
  const app = freshApp();
  const ok = await request(app).post('/api/auth/role').send({ role: 'alumno', name: 'Ana' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);

  const noName = await request(app).post('/api/auth/role').send({ role: 'alumno' });
  assert.equal(noName.status, 400);

  const badPass = await request(app).post('/api/auth/role').send({ role: 'admin', password: 'x' });
  assert.equal(badPass.status, 401);

  const admin = await request(app).post('/api/auth/role').send({ role: 'admin', password: 'admin123' });
  assert.equal(admin.status, 200);
});

test('reserva básica y disponibilidad', async () => {
  const app = freshApp();
  const token = await loginAlumno(app);
  const rooms = await request(app).get('/api/rooms');
  const roomId = rooms.body[0].id;

  const res = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({ room_id: roomId, date: '2026-10-27', start_slot: 10, end_slot: 12 });
  assert.equal(res.status, 201);

  const avail = await request(app).get(`/api/availability?date=2026-10-27`);
  const room = avail.body.find((r) => r.room.id === roomId);
  const slots10to12 = room.slots.filter((s) => s.slot >= 10 && s.slot < 12);
  assert.ok(slots10to12.every((s) => !s.free));
  const other = room.slots.find((s) => s.slot === 13);
  assert.ok(other.free);

  const mine = await request(app).get('/api/reservations/mine').set('Authorization', `Bearer ${token}`);
  assert.equal(mine.body.length, 1);
  assert.equal(mine.body[0].status, 'active');
});

test('dos reservas solapadas: la segunda recibe 409', async () => {
  const app = freshApp();
  const tokenA = await loginAlumno(app, 'Ana');
  const tokenB = await loginAlumno(app, 'Bruno');
  const rooms = await request(app).get('/api/rooms');
  const roomId = rooms.body[0].id;

  const a = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ room_id: roomId, date: '2026-10-28', start_slot: 9, end_slot: 11 });
  assert.equal(a.status, 201);

  const b = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ room_id: roomId, date: '2026-10-28', start_slot: 10, end_slot: 12 });
  assert.equal(b.status, 409);

  const noOverlap = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ room_id: roomId, date: '2026-10-28', start_slot: 11, end_slot: 13 });
  assert.equal(noOverlap.status, 201);
});

test('dos reservas simultáneas: solo una queda', async () => {
  const app = freshApp();
  const tokenA = await loginAlumno(app, 'Ana');
  const tokenB = await loginAlumno(app, 'Bruno');
  const rooms = await request(app).get('/api/rooms');
  const roomId = rooms.body[1].id;

  const payload = { room_id: roomId, date: '2026-10-29', start_slot: 14, end_slot: 16 };
  const [ra, rb] = await Promise.all([
    request(app).post('/api/reservations').set('Authorization', `Bearer ${tokenA}`).send(payload),
    request(app).post('/api/reservations').set('Authorization', `Bearer ${tokenB}`).send(payload),
  ]);
  const statuses = [ra.status, rb.status].sort();
  assert.deepEqual(statuses, [201, 409]);

  const db = app.locals.db;
  const count = db.prepare('SELECT COUNT(*) AS c FROM reservation_slots WHERE room_id = ? AND date = ?').get(roomId, '2026-10-29').c;
  assert.equal(count, 2);
});

test('cancelar reserva propia libera la franja', async () => {
  const app = freshApp();
  const tokenA = await loginAlumno(app, 'Ana');
  const tokenB = await loginAlumno(app, 'Bruno');
  const rooms = await request(app).get('/api/rooms');
  const roomId = rooms.body[2].id;

  const a = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ room_id: roomId, date: '2026-10-30', start_slot: 8, end_slot: 10, group_name: 'Grupo DevOps' });
  assert.equal(a.status, 201);

  const del = await request(app).delete(`/api/reservations/${a.body.id}`).set('Authorization', `Bearer ${tokenA}`);
  assert.equal(del.status, 200);

  const b = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ room_id: roomId, date: '2026-10-30', start_slot: 8, end_slot: 10 });
  assert.equal(b.status, 201);
});

test('alumno no puede cancelar reserva ajena ni usar endpoints admin', async () => {
  const app = freshApp();
  const tokenA = await loginAlumno(app, 'Ana');
  const tokenB = await loginAlumno(app, 'Bruno');
  const rooms = await request(app).get('/api/rooms');
  const roomId = rooms.body[3].id;

  const a = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ room_id: roomId, date: '2026-11-02', start_slot: 12, end_slot: 13 });

  const del = await request(app).delete(`/api/reservations/${a.body.id}`).set('Authorization', `Bearer ${tokenB}`);
  assert.equal(del.status, 403);

  const adminRooms = await request(app).post('/api/admin/rooms').set('Authorization', `Bearer ${tokenB}`).send({ name: 'X', capacity: 5 });
  assert.equal(adminRooms.status, 403);
});

test('admin: crear salón, ver todas las reservas, cancelar cualquiera, stats', async () => {
  const app = freshApp();
  const tokenA = await loginAlumno(app, 'Ana');
  const admin = await loginAdmin(app);

  const newRoom = await request(app)
    .post('/api/admin/rooms')
    .set('Authorization', `Bearer ${admin}`)
    .send({ name: 'Salón Nuevo', capacity: 15, equipment: ['pizarra', 'tv'] });
  assert.equal(newRoom.status, 201);

  const res = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ room_id: newRoom.body.id, date: '2026-11-03', start_slot: 18, end_slot: 20 });
  assert.equal(res.status, 201);

  const all = await request(app).get('/api/admin/reservations').set('Authorization', `Bearer ${admin}`);
  assert.equal(all.body.length, 1);

  const cancel = await request(app).delete(`/api/reservations/${res.body.id}`).set('Authorization', `Bearer ${admin}`);
  assert.equal(cancel.status, 200);

  const stats = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${admin}`);
  assert.equal(stats.status, 200);
  assert.equal(stats.body.totalActive, 0);
  assert.equal(stats.body.cancelled, 1);
});

test('validación de franjas y fechas', async () => {
  const app = freshApp();
  const token = await loginAlumno(app);
  const rooms = await request(app).get('/api/rooms');
  const roomId = rooms.body[0].id;

  const badDate = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({ room_id: roomId, date: '27-10-2026', start_slot: 10, end_slot: 12 });
  assert.equal(badDate.status, 400);

  const badRange = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({ room_id: roomId, date: '2026-10-27', start_slot: 7, end_slot: 9 });
  assert.equal(badRange.status, 400);

  const inverted = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({ room_id: roomId, date: '2026-10-27', start_slot: 12, end_slot: 10 });
  assert.equal(inverted.status, 400);
});

test('reservas de grupo registran group_name', async () => {
  const app = freshApp();
  const token = await loginAlumno(app, 'Ana');
  const rooms = await request(app).get('/api/rooms');
  const res = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({ room_id: rooms.body[4].id, date: '2026-11-05', start_slot: 9, end_slot: 11, group_name: 'Equipo 3' });
  assert.equal(res.status, 201);
  assert.equal(res.body.group_name, 'Equipo 3');
  assert.equal(res.body.owner_name, 'Ana');
});

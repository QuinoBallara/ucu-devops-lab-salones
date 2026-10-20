import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatSlotRange } from '../dates';

const emptyForm = { name: '', capacity: '', equipment: '' };

export default function AdminView() {
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadAll() {
    try {
      const [r, res, s] = await Promise.all([api.rooms(), api.adminReservations(), api.adminStats()]);
      setRooms(r);
      setReservations(res);
      setStats(s);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function submitRoom(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    const payload = {
      name: form.name,
      capacity: Number(form.capacity),
      equipment: form.equipment.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editing) {
        await api.adminUpdateRoom(editing, payload);
        setMessage('Salón actualizado');
      } else {
        await api.adminRooms(payload);
        setMessage('Salón creado');
      }
      setForm(emptyForm);
      setEditing(null);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(room) {
    setEditing(room.id);
    setForm({ name: room.name, capacity: String(room.capacity), equipment: room.equipment.join(', ') });
  }

  async function removeRoom(id) {
    setError('');
    setMessage('');
    try {
      await api.adminDeleteRoom(id);
      setMessage('Salón eliminado');
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  }

  async function cancelReservation(id) {
    try {
      await api.cancelReservation(id);
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h2>Administración</h2>
      {message && <p className="ok">{message}</p>}
      {error && <p className="error">{error}</p>}

      {stats && (
        <div className="grid stats">
          <div className="card stat">
            <span className="stat-num">{stats.totalActive}</span>
            <span className="muted">reservas activas</span>
          </div>
          <div className="card stat">
            <span className="stat-num">{stats.cancelled}</span>
            <span className="muted">canceladas</span>
          </div>
          <div className="card stat">
            <span className="stat-num">{rooms.length}</span>
            <span className="muted">salones</span>
          </div>
        </div>
      )}

      <div className="admin-cols">
        <section className="card">
          <h3>{editing ? 'Editar salón' : 'Nuevo salón'}</h3>
          <form className="stack" onSubmit={submitRoom}>
            <label>
              Nombre
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              Capacidad
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                required
              />
            </label>
            <label>
              Equipamiento (separado por comas)
              <input
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                placeholder="proyector, pizarra"
              />
            </label>
            <div className="row-actions">
              <button className="primary" type="submit">
                {editing ? 'Guardar' : 'Crear'}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <h3>Salones</h3>
          <div className="list">
            {rooms.map((room) => (
              <div key={room.id} className="row compact">
                <span>
                  {room.name} · {room.capacity} pers.
                </span>
                <div className="row-actions">
                  <button onClick={() => startEdit(room)}>Editar</button>
                  <button className="danger" onClick={() => removeRoom(room.id)}>
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>Todas las reservas</h3>
          {!reservations.length && <p className="muted">Sin reservas.</p>}
          <div className="list">
            {reservations.map((r) => (
              <div key={r.id} className={`row compact ${r.status}`}>
                <span>
                  <strong>{r.room_name}</strong> · {r.date} · {formatSlotRange(r.start_slot, r.end_slot)}
                  <br />
                  <span className="muted">
                    {r.owner_name}
                    {r.group_name ? ` (${r.group_name})` : ''}
                  </span>
                </span>
                {r.status === 'active' ? (
                  <button className="danger" onClick={() => cancelReservation(r.id)}>
                    Cancelar
                  </button>
                ) : (
                  <span className="badge cancelled">Cancelada</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {stats && stats.byRoom?.length > 0 && (
        <section className="card">
          <h3>Ocupación por salón (franjas reservadas)</h3>
          <div className="list">
            {stats.byRoom.map((b) => (
              <div key={b.room} className="row compact">
                <span>{b.room}</span>
                <span className="badge">{b.slots} franjas</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { SLOT_END, SLOT_START, formatSlot, formatSlotRange, todayISO } from '../dates';

export default function AvailabilityView() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState(9);
  const [end, setEnd] = useState(11);
  const [data, setData] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [asGroup, setAsGroup] = useState(false);
  const [message, setMessage] = useState('');

  const slots = useMemo(() => {
    const arr = [];
    for (let s = SLOT_START; s < SLOT_END; s++) arr.push(s);
    return arr;
  }, []);

  async function load() {
    setError('');
    setLoading(true);
    setMessage('');
    try {
      const res = await api.availability(date, start, end);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, start, end]);

  async function reservar(roomId) {
    setMessage('');
    setError('');
    try {
      await api.createReservation({
        room_id: roomId,
        date,
        start_slot: start,
        end_slot: end,
        group_name: asGroup ? groupName : undefined,
      });
      setMessage(`Reserva confirmada en ${formatSlotRange(start, end)}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const freeRooms = data.filter((r) => r.slots.every((s) => s.free));

  return (
    <div>
      <h2>Disponibilidad</h2>
      <div className="filters card">
        <label>
          Día
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Desde
          <select value={start} onChange={(e) => setStart(Number(e.target.value))}>
            {slots.map((s) => (
              <option key={s} value={s}>
                {formatSlot(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hasta
          <select value={end} onChange={(e) => setEnd(Number(e.target.value))}>
            {slots
              .filter((s) => s > start)
              .map((s) => (
                <option key={s} value={s}>
                  {formatSlot(s)}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="reserve-options card">
        <label className="inline">
          <input type="checkbox" checked={asGroup} onChange={(e) => setAsGroup(e.target.checked)} />
          Reservar a nombre de un grupo
        </label>
        {asGroup && (
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nombre del grupo"
          />
        )}
        <span className="muted">
          Reservando como <strong>{user?.name}</strong> · {formatSlotRange(start, end)}
        </span>
      </div>

      {message && <p className="ok">{message}</p>}
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Consultando…</p>}

      <h3>{freeRooms.length} salones libres en la franja</h3>
      <div className="grid">
        {data.map((row) => {
          const free = row.slots.every((s) => s.free);
          return (
            <div key={row.room.id} className={`card room-card ${free ? '' : 'busy'}`}>
              <h3>{row.room.name}</h3>
              <p className="capacity">👥 {row.room.capacity} personas</p>
              <div className="slot-row">
                {row.slots.map((s) => (
                  <span key={s.slot} className={`slot ${s.free ? 'free' : 'taken'}`} title={s.owner || ''}>
                    {formatSlot(s.slot)}
                  </span>
                ))}
              </div>
              <button
                className="primary"
                disabled={!free || (asGroup && !groupName.trim())}
                onClick={() => reservar(row.room.id)}
              >
                {free ? 'Reservar' : 'Ocupado'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { SLOT_END, SLOT_START, WEEKDAYS, formatSlot, startOfWeek, todayISO, weekDates } from '../dates';

export default function CalendarView() {
  const { isAdmin } = useAuth();
  const [anchor, setAnchor] = useState(startOfWeek(todayISO()));
  const [roomId, setRoomId] = useState('all');
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');

  const dates = useMemo(() => weekDates(anchor), [anchor]);

  useEffect(() => {
    api.rooms().then(setRooms).catch((e) => setError(e.message));
  }, []);

  const hours = useMemo(() => {
    const arr = [];
    for (let s = SLOT_START; s < SLOT_END; s++) arr.push(s);
    return arr;
  }, []);

  return (
    <div>
      <h2>Calendario semanal</h2>
      {error && <p className="error">{error}</p>}

      <div className="filters card">
        <button onClick={() => setAnchor(anchor ? shift(anchor, -7) : anchor)}>← Semana anterior</button>
        <span className="muted">Semana del {anchor}</span>
        <button onClick={() => setAnchor(shift(anchor, 7))}>Semana siguiente →</button>
        <label>
          Salón
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="all">Todos</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cal-scroll">
        <div className="cal-grid">
          <div className="cal-head cal-time">Hora</div>
          {dates.map((d, i) => (
            <div key={d} className="cal-head">
              {WEEKDAYS[i]}
              <div className="muted">{d.slice(5)}</div>
            </div>
          ))}

          {hours.map((h) => (
            <WeekRow
              key={h}
              hour={h}
              dates={dates}
              roomId={roomId}
              allRooms={rooms}
              showOwner={isAdmin}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function shift(anchor, days) {
  const d = new Date(anchor + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function WeekRow({ hour, dates, roomId, showOwner }) {
  return (
    <>
      <div className="cal-time">{formatSlot(hour)}</div>
      {dates.map((d) => (
        <DayCell key={d + hour} date={d} hour={hour} roomId={roomId} showOwner={showOwner} />
      ))}
    </>
  );
}

function DayCell({ date, hour, roomId, showOwner }) {
  const [cell, setCell] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .availability(date, hour, hour + 1)
      .then((rows) => {
        if (!active) return;
        const filtered = roomId === 'all' ? rows : rows.filter((r) => String(r.room.id) === String(roomId));
        const free = filtered.filter((r) => r.slots[0].free);
        const taken = filtered.find((r) => !r.slots[0].free);
        setCell({
          freeCount: free.length,
          total: filtered.length,
          owner: taken ? taken.slots[0].owner : null,
        });
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [date, hour, roomId]);

  let cls = 'cal-cell';
  if (loading) cls += ' loading';
  else if (cell && cell.freeCount === 0) cls += ' full';
  else if (cell && cell.freeCount < cell.total) cls += ' partial';
  else cls += ' free';

  return (
    <div className={cls} title={cell?.owner ? `Ocupado por ${cell.owner}` : ''}>
      {!loading && cell && (
        <span className="cal-count">
          {cell.freeCount === 0 ? (showOwner && cell.owner ? cell.owner : 'lleno') : `${cell.freeCount} libres`}
        </span>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatSlotRange } from '../dates';

export default function MyReservationsView() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setRows(await api.myReservations());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancel(id) {
    try {
      await api.cancelReservation(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) return <p className="muted">Cargando reservas…</p>;

  return (
    <div>
      <h2>Mis reservas</h2>
      {error && <p className="error">{error}</p>}
      {!rows.length && <p className="muted">Todavía no tenés reservas.</p>}
      <div className="list">
        {rows.map((r) => (
          <div key={r.id} className={`card row ${r.status}`}>
            <div>
              <h3>{r.room_name}</h3>
              <p className="muted">
                {r.date} · {formatSlotRange(r.start_slot, r.end_slot)}
                {r.group_name ? ` · Grupo: ${r.group_name}` : ''}
              </p>
            </div>
            <div className="row-actions">
              <span className={`badge ${r.status}`}>{r.status === 'active' ? 'Activa' : 'Cancelada'}</span>
              {r.status === 'active' && (
                <button className="danger" onClick={() => cancel(r.id)}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

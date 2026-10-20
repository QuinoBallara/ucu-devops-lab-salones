import { useEffect, useState } from 'react';
import { api } from '../api';

export default function RoomsView() {
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .rooms()
      .then(setRooms)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Cargando salones…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h2>Salones</h2>
      <p className="muted">{rooms.length} espacios disponibles</p>
      <div className="grid">
        {rooms.map((room) => (
          <div key={room.id} className="card room-card">
            <h3>{room.name}</h3>
            <p className="capacity">👥 {room.capacity} personas</p>
            <div className="tags">
              {room.equipment.length ? (
                room.equipment.map((eq) => (
                  <span key={eq} className="tag">
                    {eq}
                  </span>
                ))
              ) : (
                <span className="muted">Sin equipamiento listado</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

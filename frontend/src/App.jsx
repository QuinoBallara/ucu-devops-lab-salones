import { useState } from 'react';
import { useAuth } from './auth';
import LoginView from './views/LoginView';
import RoomsView from './views/RoomsView';
import AvailabilityView from './views/AvailabilityView';
import MyReservationsView from './views/MyReservationsView';
import CalendarView from './views/CalendarView';
import AdminView from './views/AdminView';
import './App.css';

const NAV = [
  { key: 'availability', label: 'Disponibilidad', roles: ['alumno', 'admin'], C: AvailabilityView },
  { key: 'rooms', label: 'Salones', roles: ['alumno', 'admin'], C: RoomsView },
  { key: 'calendar', label: 'Calendario', roles: ['alumno', 'admin'], C: CalendarView },
  { key: 'mine', label: 'Mis reservas', roles: ['alumno', 'admin'], C: MyReservationsView },
  { key: 'admin', label: 'Administración', roles: ['admin'], C: AdminView },
];

export default function App() {
  const { user, isAdmin, logout } = useAuth();
  const [tab, setTab] = useState('availability');

  if (!user) return <LoginView />;

  const items = NAV.filter((n) => n.roles.includes(user.role));
  const current = items.find((n) => n.key === tab) || items[0];
  const Current = current.C;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Reserva de Salones</div>
        <div className="user-info">
          <span className="badge">{isAdmin ? 'Administración' : 'Alumno'}</span>
          <span className="muted">{user.name}</span>
          <button className="ghost" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      <nav className="tabs">
        {items.map((n) => (
          <button key={n.key} className={n.key === current.key ? 'active' : ''} onClick={() => setTab(n.key)}>
            {n.label}
          </button>
        ))}
      </nav>

      <main className="content">
        <Current />
      </main>
    </div>
  );
}

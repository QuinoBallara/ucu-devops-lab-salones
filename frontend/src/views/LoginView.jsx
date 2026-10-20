import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

export default function LoginView() {
  const { login } = useAuth();
  const [role, setRole] = useState('alumno');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = role === 'admin' ? { role, password } : { role, name };
      const data = await api.login(payload);
      login(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <h1>Reserva de Salones</h1>
        <p className="muted">Ingresá como alumno o administración</p>

        <div className="role-toggle">
          <button
            type="button"
            className={role === 'alumno' ? 'active' : ''}
            onClick={() => setRole('alumno')}
          >
            Alumno
          </button>
          <button
            type="button"
            className={role === 'admin' ? 'active' : ''}
            onClick={() => setRole('admin')}
          >
            Administración
          </button>
        </div>

        {role === 'alumno' ? (
          <label>
            Tu nombre
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Ana Pérez"
              required
            />
          </label>
        ) : (
          <label>
            Clave de administración
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="clave"
              required
            />
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}

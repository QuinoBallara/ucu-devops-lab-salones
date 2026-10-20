const BASE = import.meta.env.VITE_API_BASE || '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error((data && data.error) || `Error ${res.status}`);
  }
  return data;
}

export const api = {
  login: (payload) => request('/auth/role', { method: 'POST', body: payload, auth: false }),
  slots: () => request('/slots', { auth: false }),
  rooms: () => request('/rooms', { auth: false }),
  availability: (date, start, end) =>
    request(`/availability?date=${date}&start=${start}&end=${end}`, { auth: false }),
  createReservation: (payload) => request('/reservations', { method: 'POST', body: payload }),
  myReservations: () => request('/reservations/mine'),
  cancelReservation: (id) => request(`/reservations/${id}`, { method: 'DELETE' }),
  adminRooms: (payload) => request('/admin/rooms', { method: 'POST', body: payload }),
  adminUpdateRoom: (id, payload) => request(`/admin/rooms/${id}`, { method: 'PUT', body: payload }),
  adminDeleteRoom: (id) => request(`/admin/rooms/${id}`, { method: 'DELETE' }),
  adminReservations: () => request('/admin/reservations'),
  adminStats: () => request('/admin/stats'),
};

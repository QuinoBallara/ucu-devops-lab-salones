import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  const value = useMemo(
    () => ({
      user,
      isAdmin: user?.role === 'admin',
      login: ({ token, role, name }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify({ role, name }));
        setUser({ role, name });
      },
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}

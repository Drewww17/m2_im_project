/**
 * Authentication Context
 * Provides auth state and methods throughout the app
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
      Cookies.set('token', data.token, { expires: 1 });
      setUser(data.user);
      return { success: true };
    }

    return { success: false, error: data.error };
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    Cookies.remove('token');
    setUser(null);
    router.push('/login');
  };

  const hasRole = (requiredRole) => {
    if (!user) return false;
    const hierarchy = { CASHIER: 1, CLERK: 2, MANAGER: 3 };
    return hierarchy[user.role] >= hierarchy[requiredRole];
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

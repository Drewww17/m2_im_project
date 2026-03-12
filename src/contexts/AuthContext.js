/**
 * Authentication Context
 * Provides auth state and methods throughout the app
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshSession = useCallback(async () => {
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin'
    });

    return refreshRes.ok;
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        const didRefresh = await refreshSession();

        if (!didRefresh) {
          setUser(null);
          return;
        }

        const retryRes = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          setUser(retryData.user);
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshSession]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password })
    });

    let data;
    try {
      data = await res.json();
    } catch {
      return {
        success: false,
        error: 'Server returned an invalid response',
        code: 'INVALID_RESPONSE'
      };
    }

    if (data.success) {
      setUser(data.user);
      return { success: true };
    }

    return { success: false, error: data.error, code: data.code, hint: data.hint };
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    setUser(null);
    router.push('/login');
  }, [router]);

  const hasRole = useCallback((requiredRole) => {
    if (!user) return false;
    const hierarchy = { CASHIER: 1, CLERK: 2, MANAGER: 3 };
    return hierarchy[user.role] >= hierarchy[requiredRole];
  }, [user]);

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

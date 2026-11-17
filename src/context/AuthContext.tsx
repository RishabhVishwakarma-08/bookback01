import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, getStoredToken, setStoredToken } from '../api/client';
import type { TeamPermission, User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  unreadCount: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasPermission: (permission: TeamPermission) => boolean;
  login: (identifier: string, password: string) => Promise<User>;
  register: (payload: {
    name: string;
    email: string;
    collegeId: string;
    branch: string;
    year: string;
    semester: number;
    campusId?: string;
    password: string;
  }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = Boolean(
    user && (user.role === 'super_admin' || user.role === 'team_admin' || user.role === 'admin'),
  );
  const isSuperAdmin = Boolean(user && user.role === 'super_admin');

  const hasPermission = useCallback(
    (permission: TeamPermission) => {
      if (!user) return false;
      if (user.role === 'super_admin' || user.role === 'admin') return true;
      if (user.role === 'team_admin') {
        return Array.isArray(user.permissions) && user.permissions.includes(permission);
      }
      return false;
    },
    [user],
  );

  const refreshUnreadCount = useCallback(async () => {
    if (!getStoredToken()) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await apiFetch<{ unreadCount: number }>('/notifications');
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // ignore transient poll failures
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch<{ user: User }>('/auth/me');
      setUser(res.user);
      await refreshUnreadCount();
    } catch {
      setStoredToken(null);
      setUser(null);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(refreshUnreadCount, 20000);
    return () => window.clearInterval(id);
  }, [user, refreshUnreadCount]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const res = await apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      setStoredToken(res.token);
      setUser(res.user);
      await refreshUnreadCount();
      return res.user;
    },
    [refreshUnreadCount],
  );

  const register = useCallback(
    async (payload: {
      name: string;
      email: string;
      collegeId: string;
      branch: string;
      year: string;
      semester: number;
      campusId?: string;
      password: string;
    }) => {
      const res = await apiFetch<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStoredToken(res.token);
      setUser(res.user);
      setUnreadCount(0);
      return res.user;
    },
    [],
  );

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setUnreadCount(0);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        unreadCount,
        isAdmin,
        isSuperAdmin,
        hasPermission,
        login,
        register,
        logout,
        refreshUser,
        refreshUnreadCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

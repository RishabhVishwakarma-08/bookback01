import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getCurrentUserId,
  getDemoUser,
  getNotifications,
  loginDemoUser,
  registerDemoUser,
  setCurrentUserId,
  subscribeToLocalChanges,
} from '../data/localStore';
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
    const userId = getCurrentUserId();
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    setUnreadCount(getNotifications(userId).filter((notification) => !notification.isRead).length);
  }, []);

  const refreshUser = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setUser(null);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    const storedUser = getDemoUser(userId);
    if (!storedUser) {
      setCurrentUserId(null);
      setUser(null);
      setUnreadCount(0);
    } else {
      setUser(storedUser);
      await refreshUnreadCount();
    }
    setLoading(false);
  }, [refreshUnreadCount]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    return subscribeToLocalChanges(() => {
      void refreshUser();
    });
  }, [refreshUser]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const signedInUser = loginDemoUser(identifier, password);
      setCurrentUserId(signedInUser.id);
      setUser(signedInUser);
      await refreshUnreadCount();
      return signedInUser;
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
      const registeredUser = registerDemoUser(payload);
      setCurrentUserId(registeredUser.id);
      setUser(registeredUser);
      setUnreadCount(0);
      return registeredUser;
    },
    [],
  );

  const logout = useCallback(() => {
    setCurrentUserId(null);
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

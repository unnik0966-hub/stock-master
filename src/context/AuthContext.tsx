import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { UserDTO } from '../types/inventory.ts';
import { apiRequest } from '../utils/apiClient.ts';

interface AuthContextValue {
  user: UserDTO | null;
  token: string | null;
  needsSetup: boolean;
  initializing: boolean;
  refreshAuthStatus: () => Promise<void>;
  setupAdmin: (input: { name: string; email: string; password: string }) => Promise<void>;
  registerStaff: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  updateSessionUser: (user: UserDTO, newToken?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // JWT Bearer token is held strictly in React memory (never persisted to localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const status = await apiRequest<{ needsSetup: boolean }>('/auth/status');
      setNeedsSetup(status.needsSetup);
    } catch {
      setNeedsSetup(false);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuthStatus();
  }, [refreshAuthStatus]);

  const setupAdmin = useCallback(async (input: { name: string; email: string; password: string }) => {
    const res = await apiRequest<{ token: string; user: UserDTO }>('/auth/setup', {
      method: 'POST',
      body: input,
    });
    setToken(res.token);
    setUser(res.user);
    setNeedsSetup(false);
  }, []);

  const registerStaff = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const res = await apiRequest<{ token: string; user: UserDTO }>('/auth/register', {
        method: 'POST',
        body: input,
      });
      setToken(res.token);
      setUser(res.user);
    },
    []
  );

  const login = useCallback(async (input: { email: string; password: string }) => {
    const res = await apiRequest<{ token: string; user: UserDTO }>('/auth/login', {
      method: 'POST',
      body: input,
    });
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const updateSessionUser = useCallback((updatedUser: UserDTO, newToken?: string) => {
    setUser(updatedUser);
    if (newToken) {
      setToken(newToken);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        needsSetup,
        initializing,
        refreshAuthStatus,
        setupAdmin,
        registerStaff,
        login,
        logout,
        updateSessionUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

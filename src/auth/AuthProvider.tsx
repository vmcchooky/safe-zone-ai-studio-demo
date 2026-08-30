import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { AuthSession } from '../lib/types';

interface AuthContextValue {
  error: string | null;
  loading: boolean;
  session: AuthSession | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// This session is intentionally local to the AI Studio showcase. It never
// represents the Henry/admin account and is not exchanged for a VPS cookie.
const DEMO_SESSION: AuthSession = {
  username: 'AI Studio',
  role: 'demo',
  read_only: true,
  can_mutate: true,
  can_view_settings: true,
  guest_message: 'Đây là bản trình diễn AI Studio. Các nút điều khiển chỉ mô phỏng và không thay đổi Safe Zone production.',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(DEMO_SESSION);

  const refreshSession = useCallback(async () => {
    setSession(DEMO_SESSION);
  }, []);

  const login = useCallback(async () => {
    setSession(DEMO_SESSION);
  }, []);

  const logout = useCallback(async () => {
    // The production UI keeps this control for visual parity. Logging out of
    // the showcase simply restores the local demo session and never calls VPS.
    setSession(DEMO_SESSION);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    error: null,
    loading: false,
    session,
    login,
    logout,
    refreshSession,
  }), [login, logout, refreshSession, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

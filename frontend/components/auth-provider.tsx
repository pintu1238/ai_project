"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type User = {
  id: string;
  email: string;
  name?: string | null;
  timezone: string;
};

type AuthState = {
  user: User | null;
  workspaces: Workspace[];
  loading: boolean;
  refresh: () => Promise<void>;
  setSession: (payload: { user: User; workspaces: Workspace[] }) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: User; workspaces: Workspace[] }>("/api/auth/me");
      setUser(data.user);
      setWorkspaces(data.workspaces);
    } catch {
      setUser(null);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bootstrap session from API
    void refresh();
  }, [refresh]);

  const setSession = (payload: { user: User; workspaces: Workspace[] }) => {
    setUser(payload.user);
    setWorkspaces(payload.workspaces);
    setLoading(false);
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    setWorkspaces([]);
  };

  return (
    <AuthContext.Provider value={{ user, workspaces, loading, refresh, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

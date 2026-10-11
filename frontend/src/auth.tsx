import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { router } from "expo-router";
import { storage } from "@/src/utils/storage";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL + "/api";
const TOKEN_KEY = "kgvac_access_token";

export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  disabled: boolean;
  must_change_password: boolean;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (t: string) => {
    try {
      const r = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
      if (r.ok) {
        const u = await r.json();
        setUser(u);
        return u;
      }
    } catch {}
    return null;
  }, []);

  useEffect(() => {
    (async () => {
      const t = await storage.secureGet<string>(TOKEN_KEY, "");
      if (t) {
        setToken(t);
        const u = await fetchMe(t);
        if (!u) {
          await storage.secureRemove(TOKEN_KEY);
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.detail || "Incorrect email or password");
    }
    const data = await r.json();
    await storage.secureSet(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      if (token) await fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch {}
    await storage.secureRemove(TOKEN_KEY);
    setToken(null);
    setUser(null);
    router.replace("/login");
  };

  const refresh = async () => {
    if (token) await fetchMe(token);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// -----------------------------------------------------------------------------
// API client
// -----------------------------------------------------------------------------
export async function api<T = any>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const t = token ?? (await storage.secureGet<string>(TOKEN_KEY, ""));
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${r.status})`);
  }
  return r.status === 204 ? (null as T) : r.json();
}

export { API_BASE, TOKEN_KEY };

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthContextValue = {
  token: string | null;
  userEmail: string | null;
  initialized: boolean;
  tokenExpiresAt: number | null;
  secondsUntilExpiry: number | null;
  isExpiringSoon: boolean;
  login: (token: string, email: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "smartcurator_token";
const EMAIL_KEY = "smartcurator_email";
const EXPIRY_WARNING_SECONDS = 5 * 60;

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64));
    const exp = Number(json?.exp);
    return Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [nowSeconds, setNowSeconds] = useState<number>(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const storedToken = window.localStorage.getItem(TOKEN_KEY);
      const storedEmail = window.localStorage.getItem(EMAIL_KEY);
      if (storedToken) setToken(storedToken);
      if (storedEmail) setUserEmail(storedEmail);
    } finally {
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleExpired = () => {
      setToken(null);
      setUserEmail(null);
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  const login = useCallback((newToken: string, email: string) => {
    setToken(newToken);
    setUserEmail(email);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_KEY, newToken);
      window.localStorage.setItem(EMAIL_KEY, email);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUserEmail(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(EMAIL_KEY);
    }
  }, []);

  const value = useMemo(() => {
    const tokenExpiresAt = token ? decodeJwtExp(token) : null;
    const secondsUntilExpiry = tokenExpiresAt ? tokenExpiresAt - nowSeconds : null;
    const isExpiringSoon =
      secondsUntilExpiry !== null &&
      secondsUntilExpiry > 0 &&
      secondsUntilExpiry <= EXPIRY_WARNING_SECONDS;

    return {
      token,
      userEmail,
      initialized,
      tokenExpiresAt,
      secondsUntilExpiry,
      isExpiringSoon,
      login,
      logout,
    };
  }, [token, userEmail, initialized, login, logout, nowSeconds]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  }
  return ctx;
}


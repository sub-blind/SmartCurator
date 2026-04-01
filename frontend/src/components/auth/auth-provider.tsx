"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";

type AuthContextValue = {
  token: string | null;
  refreshToken: string | null;
  userEmail: string | null;
  initialized: boolean;
  tokenExpiresAt: number | null;
  secondsUntilExpiry: number | null;
  isExpiringSoon: boolean;
  login: (token: string, email: string, refreshToken?: string | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "smartcurator_token";
const REFRESH_TOKEN_KEY = "smartcurator_refresh_token";
const EMAIL_KEY = "smartcurator_email";
const EXPIRY_WARNING_SECONDS = 5 * 60;
const AUTO_REFRESH_THRESHOLD_SECONDS = 2 * 60;

function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(EMAIL_KEY);
}

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
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [nowSeconds, setNowSeconds] = useState<number>(() => Math.floor(Date.now() / 1000));
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const storedToken = window.localStorage.getItem(TOKEN_KEY);
      const storedRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
      const storedEmail = window.localStorage.getItem(EMAIL_KEY);
      const now = Math.floor(Date.now() / 1000);
      const tokenExpiry = storedToken ? decodeJwtExp(storedToken) : null;
      const hasValidAccessToken = Boolean(storedToken && tokenExpiry && tokenExpiry > now);

      if (hasValidAccessToken && storedToken) {
        setToken(storedToken);
      }

      if (storedRefreshToken) {
        setRefreshToken(storedRefreshToken);
      }

      if (storedEmail && (hasValidAccessToken || storedRefreshToken)) {
        setUserEmail(storedEmail);
      }

      if (storedToken && !hasValidAccessToken && !storedRefreshToken) {
        clearStoredAuth();
      }
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
      setRefreshToken(null);
      setUserEmail(null);
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  const login = useCallback((newToken: string, email: string, newRefreshToken?: string | null) => {
    setToken(newToken);
    if (typeof newRefreshToken === "string") {
      setRefreshToken(newRefreshToken);
    }
    setUserEmail(email);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_KEY, newToken);
      if (typeof newRefreshToken === "string") {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
      }
      window.localStorage.setItem(EMAIL_KEY, email);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setRefreshToken(null);
    setUserEmail(null);
    clearStoredAuth();
  }, []);

  const performRefresh = useCallback(async () => {
    if (!refreshToken || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const res = await api.refresh(refreshToken);
      setToken(res.access_token);
      setRefreshToken(res.refresh_token);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TOKEN_KEY, res.access_token);
        window.localStorage.setItem(REFRESH_TOKEN_KEY, res.refresh_token);
      }
    } catch {
      logout();
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [refreshToken, logout]);

  useEffect(() => {
    if (!initialized) return;
    if (!token && refreshToken) {
      void performRefresh();
    }
  }, [initialized, token, refreshToken, performRefresh]);

  useEffect(() => {
    if (!initialized || !token || !refreshToken) return;
    const exp = decodeJwtExp(token);
    if (!exp) {
      setToken(null);
      return;
    }
    const secondsLeft = exp - nowSeconds;
    if (secondsLeft <= 0) {
      setToken(null);
      return;
    }
    if (secondsLeft > 0 && secondsLeft <= AUTO_REFRESH_THRESHOLD_SECONDS) {
      void performRefresh();
    }
  }, [initialized, token, refreshToken, nowSeconds, performRefresh]);

  const value = useMemo(() => {
    const tokenExpiresAt = token ? decodeJwtExp(token) : null;
    const secondsUntilExpiry = tokenExpiresAt ? tokenExpiresAt - nowSeconds : null;
    const isExpiringSoon =
      secondsUntilExpiry !== null &&
      secondsUntilExpiry > 0 &&
      secondsUntilExpiry <= EXPIRY_WARNING_SECONDS;

    return {
      token,
      refreshToken,
      userEmail,
      initialized,
      tokenExpiresAt,
      secondsUntilExpiry,
      isExpiringSoon,
      login,
      logout,
    };
  }, [token, refreshToken, userEmail, initialized, login, logout, nowSeconds]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  }
  return ctx;
}


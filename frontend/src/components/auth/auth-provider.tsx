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
  login: (token: string, email: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "smartcurator_token";
const EMAIL_KEY = "smartcurator_email";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

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

  const value = useMemo(
    () => ({
      token,
      userEmail,
      initialized,
      login,
      logout,
    }),
    [token, userEmail, initialized, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  }
  return ctx;
}


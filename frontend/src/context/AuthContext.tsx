import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, tokens } from "../services/api";
import type { AuthResponse, User } from "../types";

interface AuthApi {
  user: User | null;
  /** true tant que la session enregistrée est en cours de vérification. */
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (full_name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(tokens.access || tokens.refresh));

  useEffect(() => {
    if (!loading) return;
    let cancelled = false;
    api<User>("/users/me")
      .then((u) => !cancelled && setUser(u))
      .catch(() => tokens.clear())
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener("comptoir:logout", onLogout);
    return () => window.removeEventListener("comptoir:logout", onLogout);
  }, [queryClient]);

  const apply = useCallback(
    (res: AuthResponse) => {
      tokens.set(res.access_token, res.refresh_token);
      setUser(res.user);
      queryClient.clear();
      return res.user;
    },
    [queryClient],
  );

  const value = useMemo<AuthApi>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "ADMIN",
      setUser,
      login: async (email, password) =>
        apply(await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password }, auth: false })),
      register: async (full_name, email, password) =>
        apply(
          await api<AuthResponse>("/auth/register", {
            method: "POST",
            body: { full_name, email, password },
            auth: false,
          }),
        ),
      logout: () => {
        tokens.clear();
        setUser(null);
        queryClient.clear();
      },
    }),
    [user, loading, apply, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}

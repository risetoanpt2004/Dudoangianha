import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("estate-ai-token")) {
      setLoading(false);
      return;
    }
    api.me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("estate-ai-token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const storeResponse = useCallback(async (promise: ReturnType<typeof api.login>) => {
    const response = await promise;
    localStorage.setItem("estate-ai-token", response.access_token);
    setUser(response.user);
  }, []);
  const signIn = useCallback(
    (email: string, password: string) => storeResponse(api.login(email, password)),
    [storeResponse],
  );
  const signUp = useCallback(
    (name: string, email: string, password: string) => storeResponse(api.register(name, email, password)),
    [storeResponse],
  );
  const signOut = useCallback(() => {
    localStorage.removeItem("estate-ai-token");
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signUp, signOut }), [user, loading, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được sử dụng bên trong AuthProvider.");
  return context;
}

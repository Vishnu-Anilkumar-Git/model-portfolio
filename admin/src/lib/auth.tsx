import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, tokens, UNAUTHORIZED_EVENT, type ApiUser } from "./api";

interface AuthState {
  user: ApiUser | null;
  status: "loading" | "ready";
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokens.access && !tokens.refresh) {
        setStatus("ready");
        return;
      }
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        tokens.clear();
      } finally {
        if (!cancelled) setStatus("ready");
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onUnauthorized() {
      setUser(null);
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const nextUser = await api.login(username, password);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    // Fire-and-forget: blacklist the refresh token, then drop the session.
    void api.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, status, login, logout }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="font-mono text-xs tracking-[0.2em] text-fog uppercase">
          authenticating<span className="text-mint">...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

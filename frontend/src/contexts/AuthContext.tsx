import { createContext, useContext, useState, type ReactNode } from "react";

export type Role = "admin" | "employee";

interface AuthState {
  role: Role | null;
  token: string | null;
  name: string | null;
}

interface AuthCtx extends AuthState {
  login: (role: Role, token: string, name: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  role: null,
  token: null,
  name: null,
  login: () => {},
  logout: () => {},
});

const STORAGE_KEY = "face_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as AuthState;
    } catch {}
    return { role: null, token: null, name: null };
  });

  const login = (role: Role, token: string, name: string) => {
    const next = { role, token, name };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setState(next);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ role: null, token: null, name: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ApiService } from "../services/api";
import { LoginResponse } from "../types";

interface AuthContextType {
  token: string | null;
  admin: any | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [admin, setAdmin] = useState<any | null>(null);

  // On mount, restore token and attach to ApiService
  useEffect(() => {
    if (token) {
      ApiService.setAuthToken(token);
      ApiService.getMe()
        .then((data) => setAdmin(data))
        .catch(() => {
          logout(); // clear invalid token
        });
    }
  }, [token]);

  const login = async (username: string, password: string) => {
    const res: LoginResponse = await ApiService.login(username, password);

    setToken(res.access_token);
    localStorage.setItem("token", res.access_token);
    ApiService.setAuthToken(res.access_token);

    const me = await ApiService.getMe();
    setAdmin(me);
  };

  const logout = () => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem("token");
    ApiService.clearAuthToken();
  };

  return (
    <AuthContext.Provider value={{ token, admin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

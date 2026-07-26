//src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { ApiService } from '../services/api';
import { LoginResponse } from '../types';

interface AuthContextType {
  token: string | null;
  admin: any | null;
  initializing: boolean;
  login: (
    username: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<
  AuthContextType | undefined
>(undefined);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  );

  const [admin, setAdmin] = useState<any | null>(null);
  const [initializing, setInitializing] = useState(true);

  const clearSession = () => {
    setToken(null);
    setAdmin(null);

    localStorage.removeItem('token');
    ApiService.clearAuthToken();
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (token) {
          ApiService.setAuthToken(token);
          const user = await ApiService.getMe();
          setAdmin(user);
        }
      } catch {
        // getMe will automatically try /refresh through Axios.
        // If refresh also fails, clear the session.
        clearSession();
      } finally {
        setInitializing(false);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    const handleTokenRefresh = (event: Event) => {
      const refreshedToken = (
        event as CustomEvent<string>
      ).detail;

      setToken(refreshedToken);
    };

    const handleSessionExpired = () => {
      clearSession();
    };

    window.addEventListener(
      'auth:token-refreshed',
      handleTokenRefresh
    );

    window.addEventListener(
      'auth:session-expired',
      handleSessionExpired
    );

    return () => {
      window.removeEventListener(
        'auth:token-refreshed',
        handleTokenRefresh
      );

      window.removeEventListener(
        'auth:session-expired',
        handleSessionExpired
      );
    };
  }, []);

  const login = async (
    username: string,
    password: string
  ) => {
    const response: LoginResponse =
      await ApiService.login(username, password);

    localStorage.setItem(
      'token',
      response.access_token
    );

    ApiService.setAuthToken(response.access_token);
    setToken(response.access_token);

    const currentAdmin = await ApiService.getMe();
    setAdmin(currentAdmin);
  };

  const logout = async () => {
    try {
      await ApiService.logout();
    } catch {
      // The frontend session must still be cleared even if
      // the backend is unavailable.
    } finally {
      clearSession();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        admin,
        initializing,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return context;
};
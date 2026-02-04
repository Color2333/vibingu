'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 检查现有 token
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('vibingu_token');
      if (token) {
        try {
          const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          const data = await res.json();
          setIsAuthenticated(data.valid);
        } catch {
          setIsAuthenticated(false);
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.token) {
          localStorage.setItem('vibingu_token', data.token);
          setIsAuthenticated(true);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    const token = localStorage.getItem('vibingu_token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    }
    localStorage.removeItem('vibingu_token');
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

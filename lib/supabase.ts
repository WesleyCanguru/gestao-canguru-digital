
import { createClient } from '@supabase/supabase-js';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types';

// =================================================================
// ⚠️ PASSO FINAL: COLE SUAS CHAVES DO SUPABASE AQUI
// =================================================================

const SUPABASE_URL = 'https://wtzphiyybitcucwkfpgv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';

// =================================================================

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface AuthContextType {
  userRole: UserRole | null;
  login: (role: UserRole) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  userRole: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    // Persistência simples via localStorage
    return localStorage.getItem('next_app_role') as UserRole | null;
  });

  const login = (role: UserRole) => {
    setUserRole(role);
    localStorage.setItem('next_app_role', role);
  };

  const logout = () => {
    setUserRole(null);
    localStorage.removeItem('next_app_role');
  };

  return React.createElement(
    AuthContext.Provider,
    { value: { userRole, login, logout, isAuthenticated: !!userRole } },
    children
  );
};

export const useAuth = () => useContext(AuthContext);

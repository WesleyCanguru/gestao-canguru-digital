
import { createClient } from '@supabase/supabase-js';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, Client } from '../types';

const SUPABASE_URL = 'https://wtzphiyybitcucwkfpgv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const hashPassword = async (password: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

interface AuthContextType {
  userRole: UserRole | null;
  activeClient: Client | null;
  login: (role: UserRole) => void;
  loginByPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setActiveClient: (client: Client | null) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  userRole: null,
  activeClient: null,
  login: () => {},
  loginByPassword: async () => ({ success: false }),
  logout: () => {},
  setActiveClient: () => {},
  isAuthenticated: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole | null>(() =>
    localStorage.getItem('next_app_role') as UserRole | null
  );
  const [activeClient, setActiveClientState] = useState<Client | null>(() => {
    const stored = localStorage.getItem('next_app_client');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (role: UserRole) => {
    setUserRole(role);
    localStorage.setItem('next_app_role', role);
    if (role !== 'admin') {
      const nextSafety: Client = {
        id: '75b00b27-61ee-4b23-8721-70748ccb0789',
        name: 'NEXT Safety',
        segment: 'EPI / Segurança do Trabalho',
        responsible: 'Viviane',
        email: null,
        instagram: null,
        color: '#1e40af',
        initials: 'NS',
        logo_url: null,
        is_active: true,
        services: [] as string[],
        social_networks: [] as string[],
        traffic_platforms: [] as string[],
        reportei_url: null,
      };
      setActiveClientState(nextSafety);
      localStorage.setItem('next_app_client', JSON.stringify(nextSafety));
    }
  };

  const loginByPassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanPass = password.trim();

    // 1. Verificar senhas da agência (Hardcoded)
    if (cleanPass === 'Amor1106*') {
      login('admin');
      return { success: true };
    } else if (cleanPass === 'Vivi2026') {
      login('approver');
      return { success: true };
    } else if (cleanPass === 'Next2026') {
      login('team');
      return { success: true };
    }

    // 2. Verificar senhas de clientes no banco de dados
    const hashedPassword = await hashPassword(cleanPass);
    
    const { data, error } = await supabase
      .from('client_users')
      .select('id, client_id, role, password_hash')
      .eq('password_hash', hashedPassword)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: 'Chave de acesso inválida.' };
    }

    const { data: clientResult, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', data.client_id)
      .single();

    if (clientError || !clientResult) {
      return { success: false, error: 'Cliente não encontrado.' };
    }

    const role = data.role as UserRole;
    setUserRole(role);
    setActiveClientState(clientResult as Client);
    localStorage.setItem('next_app_role', role);
    localStorage.setItem('next_app_client', JSON.stringify(clientResult));

    return { success: true };
  };

  const logout = () => {
    setUserRole(null);
    setActiveClientState(null);
    localStorage.removeItem('next_app_role');
    localStorage.removeItem('next_app_client');
  };

  const setActiveClient = (client: Client | null) => {
    setActiveClientState(client);
    if (client) {
      localStorage.setItem('next_app_client', JSON.stringify(client));
    } else {
      localStorage.removeItem('next_app_client');
    }
  };

  return React.createElement(
    AuthContext.Provider,
    { value: { userRole, activeClient, login, loginByPassword, logout, setActiveClient, isAuthenticated: !!userRole } },
    children
  );
};

export const useAuth = () => useContext(AuthContext);

export const parseImageUrl = (url: string | string[] | null): string | string[] | null => {
  if (!url) return null;
  if (Array.isArray(url)) return url;
  try {
    if (typeof url === 'string' && url.trim().startsWith('[') && url.trim().endsWith(']')) {
      const parsed = JSON.parse(url);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return url;
};

export const stringifyImageUrl = (url: string | string[] | null): string | null => {
  if (!url) return null;
  if (Array.isArray(url)) return JSON.stringify(url);
  return url;
};

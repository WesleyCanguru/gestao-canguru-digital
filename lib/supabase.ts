
import { createClient } from '@supabase/supabase-js';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, Client } from '../types';
import OneSignal from 'react-onesignal';


const SUPABASE_URL = 'https://wtzphiyybitcucwkfpgv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

import SHA256 from 'crypto-js/sha256';

export const hashPassword = async (password: string): Promise<string> => {
  return SHA256(password).toString();
};

export const setupNotifications = async (agencyUser: { id: string; agency_id: number }) => {
  try {
    // Identificar o usuário pelo ID único
    await OneSignal.login(agencyUser.id);

    // Adicionar tag com o agency_id para direcionamento das notificações
    await OneSignal.User.addTag('agency_id', String(agencyUser.agency_id));

    // Solicitar permissão de notificação (aparece o popup do browser/iOS)
    await OneSignal.Notifications.requestPermission();
  } catch (error) {
    console.warn('OneSignal setup warning (pode ser ignorado se Web Push não estiver configurado no painel):', error);
  }
};


interface AuthContextType {
  userRole: UserRole | null;
  activeClient: Client | null;
  userType: 'agency' | 'client' | null;
  agencyId: number | null;
  agencyName: string | null;
  logoUrl: string | null;
  login: (role: UserRole) => void;
  loginByPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setActiveClient: (client: Client | null) => void;
  refreshActiveClient: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  userRole: null,
  activeClient: null,
  userType: null,
  agencyId: null,
  agencyName: null,
  logoUrl: null,
  login: () => {},
  loginByPassword: async () => ({ success: false }),
  logout: () => {},
  setActiveClient: () => {},
  refreshActiveClient: async () => {},
  isAuthenticated: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole | null>(() =>
    localStorage.getItem('next_app_role') as UserRole | null
  );
  const [userType, setUserType] = useState<'agency' | 'client' | null>(() => 
    localStorage.getItem('next_app_user_type') as 'agency' | 'client' | null
  );
  const [agencyId, setAgencyId] = useState<number | null>(() => {
    const aid = localStorage.getItem('next_app_agency_id');
    return aid ? parseInt(aid, 10) : null;
  });
  const [agencyName, setAgencyName] = useState<string | null>(() =>
    localStorage.getItem('next_app_agency_name')
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(() =>
    localStorage.getItem('next_app_logo_url')
  );

  const [activeClient, setActiveClientState] = useState<Client | null>(() => {
    try {
      const stored = localStorage.getItem('next_app_client');
      return (stored && stored !== 'undefined' && stored !== 'null') ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn('Failed to parse activeClient from localStorage', e);
      localStorage.removeItem('next_app_client');
      return null;
    }
  });

  useEffect(() => {
    // Refresh client in background on app load if we have one from localStorage
    if (activeClient?.id) {
       supabase
         .from('clients')
         .select('*')
         .eq('id', activeClient.id)
         .single()
         .then(({ data, error }) => {
            if (!error && data) {
               setActiveClientState(data as Client);
               localStorage.setItem('next_app_client', JSON.stringify(data));
            }
         });
    }

    // Configurar OneSignal para usuário da agência persistido
    const storedUserType = localStorage.getItem('next_app_user_type');
    const storedUserId = localStorage.getItem('next_app_user_id');
    const storedAgencyId = localStorage.getItem('next_app_agency_id');
    if (storedUserType === 'agency' && storedUserId && storedAgencyId) {
      setupNotifications({
        id: storedUserId,
        agency_id: parseInt(storedAgencyId, 10)
      }).catch(err => {
        console.error('Erro ao restaurar OneSignal do localStorage:', err);
      });
    }
  }, []);


  const login = (role: UserRole) => {
    // Fallback/Legacy direct login mechanism (usually won't be used now without agency context)
    setUserRole(role);
    localStorage.setItem('next_app_role', role);
  };

  const loginByPassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanPass = password.trim();
      const hashedPassword = await hashPassword(cleanPass);
      
      console.log('Tentando login com senha hash:', hashedPassword);

      // 1. Tentar encontrar na tabela agency_users
      const { data: agencyUser, error: agencyError } = await supabase
        .from('agency_users')
        .select('id, agency_id, role, agency_name, logo_url')
        .eq('password_hash', hashedPassword)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (agencyError) {
        console.error('Erro ao buscar agency_user:', agencyError);
      }

      if (agencyUser) {
          console.log('Login admin bem sucedido:', agencyUser.agency_name);
          setUserType('agency');
          setAgencyId(agencyUser.agency_id);
          setAgencyName(agencyUser.agency_name);
          setLogoUrl(agencyUser.logo_url);
          
          setUserRole(agencyUser.role as UserRole);
          
          localStorage.setItem('next_app_user_type', 'agency');
          localStorage.setItem('next_app_user_id', agencyUser.id);
          localStorage.setItem('next_app_agency_id', String(agencyUser.agency_id));
          localStorage.setItem('next_app_agency_name', agencyUser.agency_name || '');
          if (agencyUser.logo_url) {
              localStorage.setItem('next_app_logo_url', agencyUser.logo_url);
          } else {
              localStorage.removeItem('next_app_logo_url');
          }
          localStorage.setItem('next_app_role', agencyUser.role);
          
          // Chamar configuração de notificações do OneSignal
          setupNotifications({ id: agencyUser.id, agency_id: agencyUser.agency_id }).catch(err => {
              console.error('Erro ao configurar notificações no login:', err);
          });
          
          return { success: true };
      }


      // 2. Verificar senhas de clientes no banco de dados
      const { data, error } = await supabase
        .from('client_users')
        .select('id, client_id, role, password_hash, agency_id')
        .eq('password_hash', hashedPassword)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar client_user:', error);
        return { success: false, error: 'Erro ao validar acesso. Tente novamente.' };
      }

      if (!data) {
        console.log('Nenhum usuário encontrado com este hash.');
        return { success: false, error: 'Chave de acesso inválida.' };
      }

      console.log('Usuário cliente encontrado, buscando dados do cliente...');

      const { data: clientResult, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', data.client_id)
        .single();

      if (clientError || !clientResult) {
        console.error('Erro ao buscar cliente:', clientError);
        return { success: false, error: 'Cliente não encontrado.' };
      }

      const { data: clientAgency, error: clientAgencyError } = await supabase
        .from('agency_users')
        .select('agency_name, logo_url')
        .eq('agency_id', data.agency_id)
        .limit(1)
        .maybeSingle();

      if (clientAgencyError) {
        console.warn('Aviso: Erro ao buscar dados da agência do cliente:', clientAgencyError);
      }

      setUserType('client');
      setAgencyId(data.agency_id);
      setAgencyName(clientAgency?.agency_name || null);
      setLogoUrl(clientAgency?.logo_url || null);
      
      const role = data.role as UserRole;
      setUserRole(role);
      setActiveClientState(clientResult as Client);
      
      localStorage.setItem('next_app_user_type', 'client');
      localStorage.setItem('next_app_agency_id', String(data.agency_id));
      if (clientAgency?.agency_name) localStorage.setItem('next_app_agency_name', clientAgency.agency_name);
      if (clientAgency?.logo_url) localStorage.setItem('next_app_logo_url', clientAgency.logo_url);
      
      localStorage.setItem('next_app_role', role);
      localStorage.setItem('next_app_client', JSON.stringify(clientResult));

      console.log('Login cliente bem sucedido:', clientResult.name);
      return { success: true };
    } catch (fatalErr: any) {
      console.error('Erro fatal no loginByPassword:', fatalErr);
      return { success: false, error: 'Houve um erro técnico. Verifique sua conexão.' };
    }
  };

  const logout = () => {
    setUserRole(null);
    setUserType(null);
    setAgencyId(null);
    setAgencyName(null);
    setLogoUrl(null);
    setActiveClientState(null);
    
    localStorage.removeItem('next_app_role');
    localStorage.removeItem('next_app_client');
    localStorage.removeItem('next_app_user_type');
    localStorage.removeItem('next_app_agency_id');
    localStorage.removeItem('next_app_agency_name');
    localStorage.removeItem('next_app_logo_url');
    localStorage.removeItem('next_app_user_id');
    
    // Desvincular identidade no OneSignal ao fazer logout
    OneSignal.logout().catch(err => {
      console.warn('Aviso no logout do OneSignal (pode ser ignorado se não inicializado):', err);
    });
    
    window.location.href = '/';
  };

  const setActiveClient = (client: Client | null) => {
    setActiveClientState(client);
    if (client) {
      localStorage.setItem('next_app_client', JSON.stringify(client));
    } else {
      localStorage.removeItem('next_app_client');
    }
  };

  const refreshActiveClient = async () => {
    if (!activeClient?.id) return;
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', activeClient.id)
      .single();
    if (!error && data) {
      setActiveClientState(data as Client);
      localStorage.setItem('next_app_client', JSON.stringify(data));
    }
  };

  // Auto-login from URL (?chave=XXX&destino=YYY)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chave = params.get('chave');
    
    if (chave) {
      const performAutoLogin = async () => {
        const result = await loginByPassword(chave);
        if (result.success) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('chave');
          window.history.replaceState({}, '', newUrl.toString());
        }
      };
      performAutoLogin();
    }
  }, []);

  return React.createElement(
    AuthContext.Provider,
    { value: { userRole, activeClient, userType, agencyId, agencyName, logoUrl, login, loginByPassword, logout, setActiveClient, refreshActiveClient, isAuthenticated: !!userRole } },
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

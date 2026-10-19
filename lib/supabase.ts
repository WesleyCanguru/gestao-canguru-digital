import { createClient, Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserRole, Client } from '../types';
import OneSignal from 'react-onesignal';

const SUPABASE_URL = 'https://wtzphiyybitcucwkfpgv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';

const rawClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'bolsa-auth',
  },
});

// ---------------------------------------------------------------------
// Modo "Ver como cliente": bloqueia qualquer escrita enquanto ativo.
// ---------------------------------------------------------------------
let readOnlyMode = false;
export const isReadOnlyMode = () => readOnlyMode;

const READ_ONLY_ERROR = { message: 'Modo visualização: nada é salvo enquanto você vê como o cliente.', code: 'READ_ONLY' };

const blockedBuilder = (): any => {
  const result = Promise.resolve({ data: null, error: READ_ONLY_ERROR, count: null, status: 403, statusText: 'READ_ONLY' });
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      if (prop === 'then') return result.then.bind(result);
      if (prop === 'catch') return result.catch.bind(result);
      if (prop === 'finally') return result.finally.bind(result);
      return () => proxy;
    },
  };
  const proxy: any = new Proxy({}, handler);
  return proxy;
};

const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);

export const supabase: typeof rawClient = new Proxy(rawClient, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (table: string) => {
        const qb: any = target.from(table);
        if (!readOnlyMode) return qb;
        return new Proxy(qb, {
          get(q, p) {
            if (typeof p === 'string' && WRITE_METHODS.has(p)) return () => blockedBuilder();
            const v = (q as any)[p];
            return typeof v === 'function' ? v.bind(q) : v;
          },
        });
      };
    }
    if (prop === 'rpc' && readOnlyMode) {
      return (fn: string, args?: any, opts?: any) => {
        // leitura via RPC continua liberada; RPCs de escrita conhecidas são bloqueadas
        if (/^(create|update|delete|insert|set|claim)_/.test(fn)) return blockedBuilder();
        return (target as any).rpc(fn, args, opts);
      };
    }
    const v = Reflect.get(target, prop, receiver);
    return typeof v === 'function' ? v.bind(target) : v;
  },
}) as typeof rawClient;

// Mantido só para compatibilidade com telas antigas (não é mais usado no login).
import SHA256 from 'crypto-js/sha256';
export const hashPassword = async (password: string): Promise<string> => SHA256(password).toString();

export const setupNotifications = async (agencyUser: { id: string; agency_id: number }) => {
  try {
    await OneSignal.login(agencyUser.id);
    await OneSignal.User.addTag('agency_id', String(agencyUser.agency_id));
    await OneSignal.Notifications.requestPermission();
  } catch (error) {
    console.warn('OneSignal setup warning:', error);
  }
};

// ---------------------------------------------------------------------
// Links públicos (aprovação de post, mapa, temas, roteiro, NPS, contrato)
// Cria uma sessão anônima e libera só aquele item.
// ---------------------------------------------------------------------
export type PublicLinkScope = 'mapa' | 'post' | 'temas' | 'roteiro' | 'nps' | 'contrato';

export const ensurePublicAccess = async (scope: PublicLinkScope, token: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { data: { session } } = await rawClient.auth.getSession();
    if (!session) {
      const { error } = await rawClient.auth.signInAnonymously();
      if (error) return { ok: false, error: 'Não foi possível abrir o link. Tente novamente.' };
    }
    const { error } = await rawClient.rpc('claim_public_link', { p_scope: scope, p_token: token });
    if (error) return { ok: false, error: 'Link inválido ou expirado.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Não foi possível abrir o link.' };
  }
};

/** Chama uma Edge Function com a sessão atual. */
export const callFunction = async <T = any>(name: string, body: any): Promise<{ data: T | null; error: string | null }> => {
  const { data, error } = await rawClient.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch { /* ignore */ }
    return { data: null, error: msg };
  }
  if (data && (data as any).error) return { data: null, error: (data as any).error };
  return { data: data as T, error: null };
};

// ---------------------------------------------------------------------
// Contexto de autenticação
// ---------------------------------------------------------------------
export type PermissionKey =
  | 'view_finance' | 'edit_finance' | 'edit_contracts' | 'manage_clients' | 'delete_clients'
  | 'manage_team' | 'send_signup_links' | 'manage_proposals' | 'manage_crm';

export interface AgencyMembership {
  agency_id: number;
  agency_name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  role: 'master' | 'partner' | 'team';
  display_name: string | null;
  ref_code: string | null;
  permissions: Record<PermissionKey, boolean>;
}

interface MyContext {
  user_id: string;
  email: string;
  is_master: boolean;
  agencies: AgencyMembership[];
  clients: { client_id: string; agency_id: number; display_name: string | null }[];
}

interface AuthContextType {
  userRole: UserRole | null;
  activeClient: Client | null;
  userType: 'agency' | 'client' | null;
  agencyId: number | null;
  agencyName: string | null;
  userName: string | null;
  userId: string | null;
  userEmail: string | null;
  currentUser?: { name?: string; email?: string } | null;
  logoUrl: string | null;
  isMaster: boolean;
  memberRole: 'master' | 'partner' | 'team' | null;
  agencies: AgencyMembership[];
  currentMembership: AgencyMembership | null;
  can: (perm: PermissionKey) => boolean;
  switchAgency: (agencyId: number) => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  claimLegacyKey: (key: string, email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  /** @deprecated login antigo por chave. Mantido só para não quebrar telas antigas. */
  loginByPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  login: (role: UserRole) => void;
  logout: () => void;
  setActiveClient: (client: Client | null) => void;
  refreshActiveClient: () => Promise<void>;
  reloadContext: () => Promise<void>;
  isAuthenticated: boolean;
  authLoading: boolean;
  isViewingAsClient: boolean;
  viewAsClient: (client: Client) => void;
  exitViewAsClient: () => void;
}

const noop = async () => ({ success: false });
const AuthContext = createContext<AuthContextType>({
  userRole: null, activeClient: null, userType: null, agencyId: null, agencyName: null, userName: null,
  userId: null, userEmail: null, currentUser: null, logoUrl: null, isMaster: false, memberRole: null,
  agencies: [], currentMembership: null, can: () => false, switchAgency: () => {},
  signIn: noop, claimLegacyKey: noop, requestPasswordReset: noop, loginByPassword: noop, login: () => {},
  logout: () => {}, setActiveClient: () => {}, refreshActiveClient: async () => {}, reloadContext: async () => {},
  isAuthenticated: false, authLoading: true, isViewingAsClient: false, viewAsClient: () => {}, exitViewAsClient: () => {},
});

const LS_AGENCY = 'bolsa_selected_agency';
const LS_CLIENT = 'next_app_client';
const LS_VIEW_AS = 'bolsa_view_as_client';

const safeParse = <T,>(raw: string | null): T | null => {
  try { return raw && raw !== 'undefined' && raw !== 'null' ? JSON.parse(raw) as T : null; } catch { return null; }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [ctx, setCtx] = useState<MyContext | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(() => {
    const v = localStorage.getItem(LS_AGENCY); return v ? parseInt(v, 10) : null;
  });
  const [activeClient, setActiveClientState] = useState<Client | null>(() => safeParse<Client>(localStorage.getItem(LS_CLIENT)));
  const [viewAsClientState, setViewAsClientState] = useState<Client | null>(() => safeParse<Client>(sessionStorage.getItem(LS_VIEW_AS)));
  const notifiedRef = useRef<string | null>(null);

  readOnlyMode = !!viewAsClientState;

  const loadContext = useCallback(async (s: Session | null) => {
    if (!s || (s.user as any).is_anonymous) { setCtx(null); return; }
    const { data, error } = await rawClient.rpc('get_my_context');
    if (error || !data) { console.error('get_my_context', error); setCtx(null); return; }
    setCtx(data as MyContext);
  }, []);

  useEffect(() => {
    let mounted = true;
    rawClient.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadContext(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = rawClient.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        setTimeout(() => { loadContext(s).finally(() => setAuthLoading(false)); }, 0);
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadContext]);

  const agencies = ctx?.agencies ?? [];
  const isStaff = agencies.length > 0;
  const currentMembership = isStaff
    ? (agencies.find(a => a.agency_id === selectedAgencyId) ?? agencies[0])
    : null;

  // Cliente logado: carrega o próprio cliente
  useEffect(() => {
    if (!ctx || isStaff || ctx.clients.length === 0) return;
    const wanted = activeClient && ctx.clients.some(c => c.client_id === activeClient.id) ? activeClient.id : ctx.clients[0].client_id;
    rawClient.from('clients').select('*').eq('id', wanted).single().then(({ data }) => {
      if (data) { setActiveClientState(data as Client); localStorage.setItem(LS_CLIENT, JSON.stringify(data)); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, isStaff]);

  // Notificações push para a equipe
  useEffect(() => {
    if (ctx && currentMembership && notifiedRef.current !== `${ctx.user_id}-${currentMembership.agency_id}`) {
      notifiedRef.current = `${ctx.user_id}-${currentMembership.agency_id}`;
      setupNotifications({ id: ctx.user_id, agency_id: currentMembership.agency_id });
    }
  }, [ctx, currentMembership]);

  const can = useCallback((perm: PermissionKey) => {
    if (ctx?.is_master) return true;
    return !!currentMembership?.permissions?.[perm];
  }, [ctx, currentMembership]);

  const switchAgency = (id: number) => {
    setSelectedAgencyId(id);
    localStorage.setItem(LS_AGENCY, String(id));
    setActiveClientState(null);
    localStorage.removeItem(LS_CLIENT);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await rawClient.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      return { success: false, error: error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : error.message };
    }
    return { success: true };
  };

  const claimLegacyKey = async (key: string, email: string, password: string, name?: string) => {
    const { data: s } = await rawClient.auth.getSession();
    if (s.session && (s.session.user as any).is_anonymous) await rawClient.auth.signOut();
    const { error } = await callFunction('auth-legacy-claim', { legacy_key: key, email, password, name });
    if (error) return { success: false, error };
    return signIn(email, password);
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await rawClient.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const logout = async () => {
    sessionStorage.removeItem(LS_VIEW_AS);
    localStorage.removeItem(LS_CLIENT);
    localStorage.removeItem(LS_AGENCY);
    // limpa chaves do login antigo
    ['next_app_role', 'next_app_user_type', 'next_app_agency_id', 'next_app_agency_name', 'next_app_user_name', 'next_app_logo_url', 'next_app_user_id']
      .forEach(k => localStorage.removeItem(k));
    OneSignal.logout().catch(() => {});
    await rawClient.auth.signOut();
    window.location.href = '/';
  };

  const setActiveClient = (client: Client | null) => {
    setActiveClientState(client);
    if (client) localStorage.setItem(LS_CLIENT, JSON.stringify(client));
    else localStorage.removeItem(LS_CLIENT);
  };

  const refreshActiveClient = async () => {
    const target = viewAsClientState ?? activeClient;
    if (!target?.id) return;
    const { data } = await rawClient.from('clients').select('*').eq('id', target.id).single();
    if (data) {
      if (viewAsClientState) { setViewAsClientState(data as Client); sessionStorage.setItem(LS_VIEW_AS, JSON.stringify(data)); }
      else setActiveClient(data as Client);
    }
  };

  const viewAsClient = (client: Client) => {
    sessionStorage.setItem(LS_VIEW_AS, JSON.stringify(client));
    readOnlyMode = true;
    setViewAsClientState(client);
    rawClient.from('activity_log').insert({
      agency_id: client.agency_id, client_id: client.id, user_id: ctx?.user_id,
      actor_name: currentMembership?.display_name ?? ctx?.email, action: 'view_as', entity: 'clients', entity_id: client.id,
    }).then(() => {});
  };

  const exitViewAsClient = () => {
    sessionStorage.removeItem(LS_VIEW_AS);
    readOnlyMode = false;
    setViewAsClientState(null);
  };

  const legacyLoginRemoved = async () => ({ success: false, error: 'O acesso agora é por e-mail e senha.' });

  // ---------- valores derivados no formato que o app já usa ----------
  const isViewingAsClient = !!viewAsClientState && isStaff;
  const isAuthenticated = !!ctx && (isStaff || ctx.clients.length > 0);

  let userType: 'agency' | 'client' | null = null;
  let userRole: UserRole | null = null;
  if (isAuthenticated) {
    if (isViewingAsClient) { userType = 'client'; userRole = 'approver'; }
    else if (isStaff) { userType = 'agency'; userRole = currentMembership?.role === 'team' && !ctx?.is_master ? 'team' : 'admin'; }
    else { userType = 'client'; userRole = 'approver'; }
  }

  const effectiveClient = isViewingAsClient ? viewAsClientState : activeClient;
  const agencyId = isViewingAsClient
    ? (viewAsClientState?.agency_id ?? null)
    : isStaff ? (currentMembership?.agency_id ?? null)
    : (ctx?.clients.find(c => c.client_id === activeClient?.id)?.agency_id ?? ctx?.clients[0]?.agency_id ?? null);
  const agencyRow = isStaff ? currentMembership : null;
  const userName = isStaff
    ? (currentMembership?.display_name ?? session?.user?.user_metadata?.name ?? ctx?.email ?? null)
    : (ctx?.clients[0]?.display_name ?? session?.user?.user_metadata?.name ?? null);

  const [clientAgencyBrand, setClientAgencyBrand] = useState<{ name: string; logo_url: string | null } | null>(null);
  useEffect(() => {
    if (!isStaff && agencyId) {
      rawClient.from('agencies').select('name, logo_url').eq('id', agencyId).single()
        .then(({ data }) => { if (data) setClientAgencyBrand(data as any); });
    }
  }, [isStaff, agencyId]);

  const agencyName = agencyRow?.agency_name ?? clientAgencyBrand?.name ?? null;
  const logoUrl = agencyRow?.logo_url ?? clientAgencyBrand?.logo_url ?? null;

  const value: AuthContextType = {
    userRole, activeClient: effectiveClient, userType, agencyId, agencyName, userName,
    userId: ctx?.user_id ?? null, userEmail: ctx?.email ?? null,
    currentUser: userName ? { name: userName, email: ctx?.email } : null,
    logoUrl, isMaster: !!ctx?.is_master, memberRole: currentMembership?.role ?? null,
    agencies, currentMembership, can, switchAgency, signIn, claimLegacyKey, requestPasswordReset,
    loginByPassword: legacyLoginRemoved, login: () => {}, logout,
    setActiveClient, refreshActiveClient, reloadContext: () => loadContext(session),
    isAuthenticated, authLoading, isViewingAsClient, viewAsClient, exitViewAsClient,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
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

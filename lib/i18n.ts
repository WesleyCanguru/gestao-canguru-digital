import { useAuth } from './supabase';
import { EN } from './i18nEn';

/**
 * Idioma do portal do cliente.
 * - Cliente logado (ou equipe em "Ver como cliente"): idioma do cliente (cadastro).
 * - Equipe no painel: sempre português.
 * Espanhol ainda não tem tradução do portal: cai no inglês.
 */
export type UiLang = 'pt' | 'en';

export const toUiLang = (l?: string | null): UiLang => (l === 'en' || l === 'es' ? 'en' : 'pt');

/** Idioma de um cliente (mesma regra do cadastro: Joey sem idioma salvo = inglês). */
export const langOfClient = (client: any): UiLang =>
  toUiLang(client?.traffic_strategy_data?.language ?? (client?.agency_id === 7 ? 'en' : 'pt'));

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`).toString()) : s;

/** Tradutor: o texto em português é a chave. Sem tradução, mostra o português. */
export const makeT = (lang: UiLang) => {
  const t = (pt: string, vars?: Record<string, string | number>) => fill(lang === 'en' ? (EN[pt] ?? pt) : pt, vars);
  const locale = lang === 'en' ? 'en-US' : 'pt-BR';
  return { t, lang, locale };
};

export const useUiLang = (): UiLang => {
  const { userType, activeClient } = useAuth();
  return userType === 'client' ? langOfClient(activeClient) : 'pt';
};

export const useT = () => makeT(useUiLang());

/** Moeda no formato do idioma (US$ 1.848,85 em PT; $1,848.85 em EN). */
export const fmtMoney = (v: number, currency = 'BRL', locale = 'pt-BR') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: (currency || 'BRL').toUpperCase() }).format(Number(v || 0));

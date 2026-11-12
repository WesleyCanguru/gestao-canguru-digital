import { useEffect, useState } from 'react';

/**
 * Marca do aplicativo pelo endereço em que foi aberto.
 * - bolsa.cangurudigital.com.br (e o resto): Bolsa, by Canguru Digital, em português.
 * - *.joeygrowth.com: Pouch, by Joey Growth, em inglês (a bolsa do canguru, onde o joey vive).
 * Para testar antes do domínio existir: abrir com ?brand=pouch (vale para a aba; ?brand=bolsa volta).
 */
export type BrandId = 'bolsa' | 'pouch';
export type LoginLang = 'pt' | 'en' | 'es';

const detect = (): BrandId => {
  if (typeof window === 'undefined') return 'bolsa';
  try {
    const q = new URLSearchParams(window.location.search).get('brand');
    if (q === 'pouch' || q === 'bolsa') sessionStorage.setItem('bolsa_brand', q);
    const forced = sessionStorage.getItem('bolsa_brand');
    if (forced === 'pouch' || forced === 'bolsa') return forced;
  } catch { /* ignora */ }
  return /(^|\.)joeygrowth\.com$/i.test(window.location.hostname) ? 'pouch' : 'bolsa';
};

export const BRAND_ID: BrandId = detect();

export const BRAND = BRAND_ID === 'pouch'
  ? { id: 'pouch' as const, app: 'Pouch', by: 'Joey Growth', agencySlug: 'joey', defaultLang: 'en' as LoginLang, title: 'Pouch • Joey Growth' }
  : { id: 'bolsa' as const, app: 'Bolsa', by: 'Canguru Digital', agencySlug: 'canguru', defaultLang: 'pt' as LoginLang, title: 'Bolsa • Canguru Digital' };

export const TAGLINE: Record<LoginLang, string> = { pt: 'Gestão & Estratégia', en: 'Management & Strategy', es: 'Gestión & Estrategia' };

/** Título, ícones e manifesto da aba conforme a marca. Chamado uma vez ao abrir o app. */
export const applyBrandToDocument = () => {
  if (typeof document === 'undefined' || BRAND_ID !== 'pouch') return;
  document.title = BRAND.title;
  document.documentElement.lang = 'en';
  const set = (sel: string, attr: string, val: string) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };
  set('link[rel="icon"][sizes="any"]', 'href', '/pouch/favicon.png');
  set('link[rel="icon"][sizes="32x32"]', 'href', '/pouch/favicon-32x32.png');
  set('link[rel="icon"][sizes="16x16"]', 'href', '/pouch/favicon-16x16.png');
  set('link[rel="apple-touch-icon"]', 'href', '/pouch/apple-touch-icon.png');
  set('link[rel="manifest"]', 'href', '/manifest-pouch.json');
  set('meta[name="apple-mobile-web-app-title"]', 'content', 'Pouch');
};

/** Idioma da tela de login: na Pouch começa em inglês e a pessoa troca nas bandeiras. */
export const useLoginLang = (): [LoginLang, (l: LoginLang) => void] => {
  const [lang, setLang] = useState<LoginLang>(() => {
    try { const s = localStorage.getItem('login_lang'); if (s === 'pt' || s === 'en' || s === 'es') return s; } catch { /* ignora */ }
    if (BRAND_ID === 'pouch') return 'en';
    return 'pt';
  });
  const change = (l: LoginLang) => { setLang(l); try { localStorage.setItem('login_lang', l); } catch { /* ignora */ } };
  return [BRAND_ID === 'pouch' ? lang : 'pt', change];
};

/** Logo da agência da marca antes do login (nome e logo das agências são públicos). */
export const useBrandAgencyLogo = (enabled: boolean) => {
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || BRAND_ID !== 'pouch') return;
    import('./supabase').then(({ supabase }) =>
      supabase.from('agencies').select('logo_url').eq('slug', BRAND.agencySlug).maybeSingle().then(({ data }) => setLogo((data as any)?.logo_url ?? null)));
  }, [enabled]);
  return logo;
};

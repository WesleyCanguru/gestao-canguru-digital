/**
 * Endereço público da Bolsa para links enviados a clientes e equipe.
 * Em prévias (vercel.app) e localhost, usa o endereço oficial para o link
 * funcionar fora do ambiente de teste. Nos domínios próprios (Canguru, Kanoa),
 * mantém o domínio em que a pessoa está.
 */
export const OFFICIAL_APP_URL = 'https://bolsa.cangurudigital.com.br';

export const getAppUrl = (): string => {
  if (typeof window === 'undefined') return OFFICIAL_APP_URL;
  const host = window.location.host;
  if (!host || host.includes('vercel.app') || host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return OFFICIAL_APP_URL;
  }
  return `${window.location.protocol}//${host}`;
};

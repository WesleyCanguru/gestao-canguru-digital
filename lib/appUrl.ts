/**
 * Endereço público da Bolsa para links enviados a clientes e equipe.
 * Usa o domínio da AGÊNCIA ativa (agencies.domain), não o endereço em que a pessoa abriu a Bolsa.
 * Ex.: alguém que usa bolsa.kanoastudio.com mas está trabalhando na Canguru gera links
 * bolsa.cangurudigital.com.br. Agência sem domínio próprio (Joey, Canguru USA) usa o endereço oficial.
 */
export const OFFICIAL_APP_URL = 'https://bolsa.cangurudigital.com.br';

let agencyDomain: string | null = null;

/** Chamado pelo login quando a agência ativa muda. */
export const setAppAgencyDomain = (domain: string | null | undefined) => {
  const d = (domain || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  agencyDomain = d || null;
};

export const getAppUrl = (): string => (agencyDomain ? `https://${agencyDomain}` : OFFICIAL_APP_URL);

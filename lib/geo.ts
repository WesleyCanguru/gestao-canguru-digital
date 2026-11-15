// Cidade/região/país de quem abriu a página (Vercel preenche pelo IP; não guarda o IP).
export type Geo = { city: string; region: string; country: string };
let cached: Promise<Geo> | null = null;
export const getGeo = (): Promise<Geo> => {
  if (!cached) {
    cached = fetch('/api/geo', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => ({ city: j?.city || '', region: j?.region || '', country: j?.country || '' }))
      .catch(() => ({ city: '', region: '', country: '' }));
  }
  return cached;
};
export const geoLabel = (g: { city?: string | null; region?: string | null; country?: string | null }) =>
  [g.city, g.region, g.country].filter(Boolean).join(', ');

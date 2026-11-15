// Devolve a localização aproximada de quem chamou, a partir dos cabeçalhos que a Vercel preenche.
// Usada para registrar de onde abriram propostas e relatórios. Não guarda nada.
export const config = { runtime: 'edge' };

export default function handler(req: Request): Response {
  const h = req.headers;
  const dec = (v: string | null) => { try { return decodeURIComponent(v || ''); } catch { return v || ''; } };
  return new Response(
    JSON.stringify({ city: dec(h.get('x-vercel-ip-city')), region: h.get('x-vercel-ip-country-region') || '', country: h.get('x-vercel-ip-country') || '' }),
    { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  );
}

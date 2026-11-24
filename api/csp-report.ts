// Recebe os avisos da CSP em modo Report-Only (vercel.json) e grava uma linha curta no log da Vercel.
// Serve para descobrir o que a CSP bloquearia antes de ligar o bloqueio de verdade. Não guarda nada no banco.
export const config = { runtime: 'edge' };

const strip = (u: unknown) => String(u ?? '').split('?')[0].split('#')[0].slice(0, 200);

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  try {
    const raw = (await req.text()).slice(0, 20000);
    const body = JSON.parse(raw);
    const items = Array.isArray(body) ? body.map((r: any) => r?.body ?? r) : [body?.['csp-report'] ?? body];
    for (const r of items.slice(0, 10)) {
      console.log('CSP', JSON.stringify({
        dir: r?.['violated-directive'] ?? r?.effectiveDirective ?? r?.['effective-directive'],
        blocked: strip(r?.['blocked-uri'] ?? r?.blockedURL),
        page: strip(r?.['document-uri'] ?? r?.documentURL),
        src: strip(r?.['source-file'] ?? r?.sourceFile),
        line: r?.['line-number'] ?? r?.lineNumber,
      }));
    }
  } catch { /* corpo inválido: ignora */ }
  return new Response(null, { status: 204 });
}

// Prévia dos links (WhatsApp, iMessage, LinkedIn...): esses apps leem o HTML cru, sem rodar o app.
// Esta função devolve o mesmo index.html do app, só que com título, descrição, imagem e ícones certos:
// - no Pouch (*.joeygrowth.com): marca Pouch · Joey Growth em qualquer página;
// - em /g/<nome> (Bolsa e Pouch): o título e a imagem do guia (content.share, se existir).
// O app abre igual: o endereço continua o mesmo e o HTML é o mesmo, só muda o <head>.
export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://wtzphiyybitcucwkfpgv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';

type Meta = { title: string; description: string; image?: string; siteName: string; pouch: boolean };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function guideMeta(slug: string): Promise<{ title?: string; share?: { title?: string; description?: string; image?: string } } | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/guides?slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=title,share:content->share&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0] ?? null;
  } catch { return null; }
}

function inject(html: string, m: Meta, origin: string, url: string): string {
  const img = m.image ? (m.image.startsWith('http') ? m.image : origin + m.image) : '';
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`);
  if (m.pouch) {
    out = out
      .replace('<html lang="pt-BR">', '<html lang="en">')
      .replace(/<link rel="icon" href="\/favicon\.ico" sizes="any">/, '<link rel="icon" href="/pouch/favicon.png" sizes="any">')
      .replace(/href="\/favicon-32x32\.png"/, 'href="/pouch/favicon-32x32.png"')
      .replace(/href="\/favicon-16x16\.png"/, 'href="/pouch/favicon-16x16.png"')
      .replace(/<link rel="apple-touch-icon" href="[^"]*">/, '<link rel="apple-touch-icon" href="/pouch/apple-touch-icon.png">')
      .replace(/href="\/manifest\.json"/, 'href="/manifest-pouch.json"')
      .replace(/<meta name="apple-mobile-web-app-title" content="[^"]*">/, '<meta name="apple-mobile-web-app-title" content="Pouch">');
  }
  const tags = [
    `<meta name="description" content="${esc(m.description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(m.siteName)}">`,
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    ...(img ? [`<meta property="og:image" content="${esc(img)}">`, `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`, `<meta name="twitter:image" content="${esc(img)}">`] : []),
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(m.title)}">`,
    `<meta name="twitter:description" content="${esc(m.description)}">`,
  ].join('\n    ');
  return out.replace('</head>', `    ${tags}\n  </head>`);
}

export default async function handler(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const host = (req.headers.get('x-forwarded-host') || u.host).toLowerCase();
  const origin = `https://${host}`;
  const path = (u.searchParams.get('path') || '').replace(/^\/+/, '');
  const pageUrl = `${origin}/${path}`;

  const base = await fetch(`${origin}/index.html`, { headers: { 'x-share-fetch': '1' } });
  const html = await base.text();
  if (!base.ok) return new Response(html, { status: base.status, headers: { 'content-type': 'text/html; charset=utf-8' } });

  const pouch = /(^|\.)joeygrowth\.com$/.test(host);
  const m: Meta = pouch
    ? { title: 'Pouch • Joey Growth', description: 'The Joey Growth client portal: ads, leads, approvals and reports, live.', image: '/pouch/og/og-pouch.png', siteName: 'Pouch · Joey Growth', pouch }
    : { title: 'Bolsa • Canguru Digital', description: 'Bolsa, a plataforma da Canguru Digital.', siteName: 'Bolsa · Canguru Digital', pouch };

  const g = path.match(/^g\/([a-z0-9-]{3,80})\/?$/);
  if (g) {
    const row = await guideMeta(g[1]);
    if (row) {
      m.title = row.share?.title || row.title || m.title;
      if (row.share?.description) m.description = row.share.description;
      if (row.share?.image) m.image = row.share.image;
    }
  }

  return new Response(inject(html, m, origin, pageUrl), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
  });
}

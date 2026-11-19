// X-Ray: coleta o que dá para ver de fora sobre o marketing de um cliente,
// ANTES de qualquer estratégia. Nada aqui chama IA: são fatos medidos.
// - Site: tags no HTML + tags configuradas dentro de cada contêiner do Google Tag Manager
//   (o gtm.js é público), páginas do sitemap, SEO básico, contatos.
// - Instagram: pelo Apify, se houver APIFY_TOKEN.
// - Velocidade: PageSpeed, se houver PAGESPEED_API_KEY.
// Funciona em Deno (Edge Functions) e em Node 22+ (teste local).

export type XrayOptions = { apifyToken?: string | null; pagespeedKey?: string | null };

const UA = "Mozilla/5.0 (compatible; BolsaXRay/1.0; +https://bolsa.cangurudigital.com.br)";

async function get(url: string, ms = 15000): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow", signal: ctrl.signal });
    const text = await r.text();
    return { ok: r.ok, status: r.status, text, finalUrl: r.url || url };
  } catch (e) {
    return { ok: false, status: 0, text: String(e), finalUrl: url };
  } finally {
    clearTimeout(t);
  }
}

const uniq = <T>(a: T[]) => [...new Set(a)];
const all = (re: RegExp, s: string, g = 1) => uniq([...s.matchAll(re)].map((m) => m[g]));

export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u = raw.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u.replace(/^\/+/, "");
  try { return new URL(u).toString(); } catch { return null; }
}

/** IDs de rastreamento encontrados num texto (HTML ou gtm.js). */
export function findTags(s: string) {
  // Meta: fbq('init','123'), com aspas escapadas dentro do gtm.js, template da comunidade e noscript
  const meta = uniq([
    ...all(/fbq\(\s*\\?["']init\\?["']\s*,\s*\\?["'](\d{10,20})/g, s),
    ...all(/"vtp_pixelId"\s*:\s*"(\d{10,20})"/g, s),
    ...all(/facebook\.com\/tr\?id=(\d{10,20})/g, s),
  ]);
  const gtm = all(/\b(GTM-[A-Z0-9]{5,10})\b/g, s, 1);
  // GA4: G- seguido de 8 a 12 caracteres com pelo menos um número (evita falsos positivos de texto)
  const ga4 = all(/\b(G-(?=[A-Z0-9]*\d)[A-Z0-9]{8,12})\b/g, s, 1);
  const ads = all(/\b(AW-\d{8,12})\b/g, s, 1);
  const tiktok = all(/ttq\.load\(\s*\\?["']([A-Z0-9]{15,25})/g, s);
  const linkedin = all(/_linkedin_partner_id\s*=\s*\\?["']?(\d{5,10})/g, s);
  const clarity = all(/clarity\.ms\/tag\/([a-z0-9]{8,12})/g, s);
  // Dentro do GTM o pixel costuma ficar numa variável constante ("__c") de 15 ou 16 dígitos.
  // Só conta se o contêiner também carrega o Meta (fbevents/facebook).
  const metaInVars = /fbevents|facebook|fbq/i.test(s)
    ? all(/"function"\s*:\s*"__c"\s*,\s*"vtp_value"\s*:\s*"(\d{15,16})"/g, s)
    : [];
  // GTM do lado do servidor (server-side tagging): domínio próprio que recebe os eventos
  const serverSide = uniq(
    [...s.matchAll(/(?:https?:)?\\?\/\\?\/((?:server|sgtm|ss|tag|tags|data|track|metrics)\.[a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)]
      .map((m) => m[1].toLowerCase())
      .filter((h) => !/google|facebook|doubleclick|gstatic|cloudflare/.test(h)),
  );
  return { meta_pixel: uniq([...meta, ...metaInVars]), gtm, ga4, google_ads: ads, tiktok, linkedin, clarity, server_side: serverSide };
}

function metaTag(html: string, name: string) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i");
  return (html.match(re) ?? html.match(re2))?.[1] ?? null;
}

function pageFacts(html: string) {
  const strip = (x: string) => x.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const ldTypes: string[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const t of m[1].matchAll(/"@type"\s*:\s*"([^"]+)"/g)) ldTypes.push(t[1]);
    for (const t of m[1].matchAll(/"@type"\s*:\s*\[([^\]]+)\]/g)) t[1].split(",").forEach((x) => ldTypes.push(x.replace(/["\s]/g, "")));
  }
  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1])).filter(Boolean);
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const lower = html.toLowerCase();
  return {
    title: strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || null,
    meta_description: metaTag(html, "description"),
    h1: h1.slice(0, 5),
    h1_count: h1.length,
    lang: html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] ?? null,
    hreflang: all(/hreflang=["']([^"']+)["']/gi, html),
    schema_types: uniq(ldTypes),
    images: imgs.length,
    images_without_alt: imgs.filter((i) => !/\balt=["'][^"']+["']/i.test(i)).length,
    html_kb: Math.round(html.length / 1024),
    scripts: (html.match(/<script\b/gi) ?? []).length,
    contact: {
      whatsapp_links: all(/https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[^"'\s<]*/gi, html, 0).slice(0, 5),
      phone_links: all(/href=["']tel:([^"']+)["']/gi, html).slice(0, 5),
      email_links: all(/href=["']mailto:([^"'?]+)/gi, html).slice(0, 5),
      forms: (html.match(/<form\b/gi) ?? []).length,
      scheduling: ["calendly", "acuityscheduling", "hubspot.com/meetings", "youcanbook", "setmore"].filter((k) => lower.includes(k)),
    },
    platform: {
      wordpress: lower.includes("wp-content"),
      elementor: lower.includes("elementor"),
      rank_math: lower.includes("rank-math") || lower.includes("rank math"),
      yoast: lower.includes("yoast"),
      wp_rocket: lower.includes("wp-rocket") || lower.includes("wp rocket"),
      site_kit: lower.includes("site kit"),
      shopify: lower.includes("cdn.shopify.com"),
      wix: lower.includes("wixstatic.com"),
    },
    cookie_banner: ["cookieyes", "cookiebot", "complianz", "onetrust", "cookie-law-info", "cookie notice", "termly"].filter((k) => lower.includes(k)),
  };
}

const PAGE_KINDS: [string, RegExp][] = [
  ["preco", /price|pricing|msrp|preco|precos|preço|tabela/i],
  ["comparacao", /-vs-|\bvs\b|versus|compar/i],
  ["agendamento", /schedule|book|appointment|agendar|agende|consulta|demo|call/i],
  ["contato", /contact|contato|fale-conosco/i],
  ["blog", /\/blog|\/blogs\/|\/artigos?\/|\/news\//i],
  ["produto_ou_servico", /\/boats?\/|\/produto|\/product|\/servico|\/service|\/modelos?\//i],
  ["landing", /\/lp\/|landing|oferta|promo/i],
];

async function sitemapUrls(origin: string): Promise<string[]> {
  const seen = new Set<string>();
  const urls: string[] = [];
  const queue = ["/sitemap_index.xml", "/sitemap.xml", "/wp-sitemap.xml"].map((p) => origin + p);
  let fetched = 0;
  while (queue.length && fetched < 10 && urls.length < 600) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    const r = await get(sm, 10000);
    fetched++;
    if (!r.ok || !/<(urlset|sitemapindex)/i.test(r.text)) continue;
    const locs = all(/<loc>\s*([^<\s]+)\s*<\/loc>/gi, r.text);
    if (/<sitemapindex/i.test(r.text)) {
      // pula sitemaps de imagens, autores e tags
      locs.filter((l) => !/image|author|tag|category|attachment/i.test(l)).forEach((l) => queue.push(l));
    } else {
      locs.forEach((l) => urls.push(l));
      if (urls.length && fetched >= 1 && !queue.some((q) => q.includes("sitemap"))) break;
    }
    if (urls.length && sm.endsWith("/sitemap.xml")) break;
  }
  return uniq(urls).slice(0, 600);
}

async function instagram(username: string, token: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 70000);
  try {
    const r = await fetch("https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?timeout=60", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ usernames: [username] }),
      signal: ctrl.signal,
    });
    if (!r.ok) return { ok: false, error: `Apify ${r.status}` };
    const items = await r.json();
    const p = Array.isArray(items) ? items[0] : null;
    if (!p) return { ok: false, error: "perfil não encontrado" };
    const posts: any[] = (p.latestPosts ?? []).slice(0, 12);
    const followers = p.followersCount ?? 0;
    const inter = posts.map((x) => (x.likesCount ?? 0) + (x.commentsCount ?? 0));
    const avg = inter.length ? inter.reduce((a, b) => a + b, 0) / inter.length : 0;
    const captions = posts.map((x) => (x.caption ?? "").slice(0, 80));
    const repeated = captions.length - new Set(captions).size;
    return {
      ok: true,
      username: p.username,
      full_name: p.fullName ?? null,
      bio: p.biography ?? null,
      external_url: p.externalUrl ?? null,
      followers,
      following: p.followsCount ?? null,
      posts_total: p.postsCount ?? null,
      business: p.isBusinessAccount ?? null,
      category: p.businessCategoryName ?? null,
      last_posts: posts.map((x) => ({
        date: x.timestamp ?? null, type: x.type ?? null,
        likes: x.likesCount ?? 0, comments: x.commentsCount ?? 0, views: x.videoViewCount ?? null,
        caption: (x.caption ?? "").slice(0, 140),
      })),
      avg_interactions_last_12: Math.round(avg),
      engagement_rate_pct: followers ? Math.round((avg / followers) * 1000) / 10 : null,
      repeated_captions_last_12: repeated,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  } finally {
    clearTimeout(t);
  }
}

async function pagespeed(url: string, key: string) {
  const r = await get(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&key=${encodeURIComponent(key)}`, 60000);
  if (!r.ok) return { ok: false, error: `PageSpeed ${r.status}` };
  try {
    const j = JSON.parse(r.text);
    const a = j.lighthouseResult?.audits ?? {};
    return {
      ok: true,
      performance_mobile: Math.round((j.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
      lcp_s: a["largest-contentful-paint"]?.numericValue ? Math.round(a["largest-contentful-paint"].numericValue / 100) / 10 : null,
      total_kb: a["total-byte-weight"]?.numericValue ? Math.round(a["total-byte-weight"].numericValue / 1024) : null,
    };
  } catch { return { ok: false, error: "resposta inválida" }; }
}

/** Roda o X-Ray completo. Nunca lança erro: o que falhar vai em `errors`. */
export async function collectXray(input: { website?: string | null; instagram?: string | null }, opts: XrayOptions = {}) {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const notes: string[] = [];
  const url = normalizeUrl(input.website);
  const igUser = (input.instagram ?? "").replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").trim() || null;

  const out: any = { collected_at: startedAt, website: url, instagram_username: igUser };

  const igPromise = igUser && opts.apifyToken ? instagram(igUser, opts.apifyToken) : Promise.resolve(null);
  const psPromise = url && opts.pagespeedKey ? pagespeed(url, opts.pagespeedKey) : Promise.resolve(null);
  if (igUser && !opts.apifyToken) notes.push("Instagram não coletado: falta o segredo APIFY_TOKEN.");
  if (url && !opts.pagespeedKey) notes.push("Velocidade não medida: falta o segredo PAGESPEED_API_KEY.");

  if (url) {
    const home = await get(url);
    if (!home.ok) {
      errors.push(`Site não abriu (status ${home.status}).`);
    } else {
      const origin = new URL(home.finalUrl).origin;
      const html = home.text;
      const inHtml = findTags(html);
      // Baixa cada contêiner do GTM: é lá que muitas tags (pixel, GA4) ficam configuradas
      const containers: any[] = [];
      for (const id of inHtml.gtm.slice(0, 4)) {
        const g = await get(`https://www.googletagmanager.com/gtm.js?id=${id}`, 12000);
        if (!g.ok) { containers.push({ id, ok: false, status: g.status }); continue; }
        const inside = findTags(g.text);
        containers.push({ id, ok: true, kb: Math.round(g.text.length / 1024), tags_inside: { ...inside, gtm: undefined } });
      }
      const union = (k: keyof ReturnType<typeof findTags>) =>
        uniq([...(inHtml[k] as string[]), ...containers.flatMap((c) => (c.tags_inside?.[k] as string[]) ?? [])]);
      const tracking: any = {
        gtm_containers: inHtml.gtm,
        meta_pixels: union("meta_pixel"),
        ga4_properties: union("ga4"),
        google_ads_tags: union("google_ads"),
        tiktok_pixels: union("tiktok"),
        linkedin_insight: union("linkedin"),
        clarity: union("clarity"),
        server_side_gtm: union("server_side"),
        where_found: { html: inHtml, gtm: containers },
      };
      const alerts: string[] = [];
      if (tracking.gtm_containers.length > 1) alerts.push(`${tracking.gtm_containers.length} contêineres do Google Tag Manager no mesmo site (risco de evento contado em dobro).`);
      if (tracking.meta_pixels.length > 1) alerts.push(`${tracking.meta_pixels.length} pixels do Meta disparando (público e conversões divididos).`);
      if (tracking.ga4_properties.length > 1) alerts.push(`${tracking.ga4_properties.length} propriedades do Google Analytics 4 coletando ao mesmo tempo.`);
      if (tracking.server_side_gtm.length) alerts.push(`Há rastreamento do lado do servidor (${tracking.server_side_gtm.join(", ")}). Descobrir quem configurou antes de mexer: remover a tag errada pode quebrar esse envio.`);
      if (!tracking.meta_pixels.length) alerts.push("Nenhum pixel do Meta encontrado (conferir com o navegador: pode carregar só depois do consentimento).");
      if (!tracking.ga4_properties.length) alerts.push("Nenhum Google Analytics 4 encontrado.");
      if (!tracking.google_ads_tags.length) alerts.push("Nenhuma tag do Google Ads encontrada.");
      tracking.alerts = alerts;

      const pages = await sitemapUrls(origin);
      const byKind: Record<string, string[]> = {};
      for (const [k, re] of PAGE_KINDS) byKind[k] = pages.filter((p) => re.test(new URL(p).pathname));
      out.site = {
        final_url: home.finalUrl,
        facts: pageFacts(html),
        tracking,
        pages: {
          total_in_sitemap: pages.length,
          by_kind_counts: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.length])),
          by_kind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.slice(0, 25)])),
          sample: pages.filter((p) => !/\/blog|\/blogs\/|\/tag\/|\/category\//i.test(p)).slice(0, 80),
        },
      };
      notes.push("Tags lidas do HTML e de dentro dos contêineres do GTM. Tags que só disparam depois do aceite de cookies ou por outro carregador podem não aparecer; o que aparece está instalado.");
    }
  } else {
    errors.push("Cliente sem site no cadastro.");
  }

  const [ig, ps] = await Promise.all([igPromise, psPromise]);
  if (ig) out.instagram = ig;
  if (ps) out.speed = ps;
  out.errors = errors;
  out.notes = notes;
  out.finished_at = new Date().toISOString();
  return out;
}

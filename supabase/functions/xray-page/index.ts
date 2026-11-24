// Página pública do Raio-X (/x/<token>). Sem login: quem tem o link vê o Raio-X mais recente do cliente.
// Devolve só números e status (nada de dados brutos, URLs de páginas ou legendas).
import { adminClient, corsHeaders, json } from "../_shared/common.ts";

const n = (v: unknown) => (Array.isArray(v) ? v.length : 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!/^[a-f0-9]{32}$/.test(token)) return json({ error: "Link inválido." }, 400);
    const admin = adminClient();
    const { data: c } = await admin.from("clients").select("id, name, agency_id, traffic_strategy_data").eq("xray_public_token", token).maybeSingle();
    if (!c) return json({ error: "Link não encontrado." }, 404);
    const [{ data: a }, { data: au }] = await Promise.all([
      admin.from("agencies").select("name, logo_url, primary_color, contact_whatsapp").eq("id", c.agency_id).maybeSingle(),
      admin.from("client_audits").select("created_at, data").eq("client_id", c.id).eq("kind", "xray").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!au) return json({ error: "Raio-X ainda não feito." }, 404);
    const d: any = au.data || {};
    const tr = d.site?.tracking;
    const facts = d.site?.facts;
    const ig = d.instagram?.ok ? d.instagram : null;
    const l = c.traffic_strategy_data?.language;
    const lang = l === "en" || l === "es" || l === "pt" ? l : (c.agency_id === 7 ? "en" : "pt");
    return json({
      client: { name: c.name, lang, agency_id: c.agency_id },
      agency: a ?? null,
      xray: {
        collected_at: d.collected_at ?? au.created_at,
        website: d.site?.final_url ?? d.website ?? null,
        speed: d.speed?.ok ? { performance_mobile: d.speed.performance_mobile ?? null, lcp_s: d.speed.lcp_s ?? null, total_kb: d.speed.total_kb ?? null } : null,
        instagram: ig ? {
          username: ig.username ?? null, followers: ig.followers ?? null, posts_total: ig.posts_total ?? null,
          engagement_rate_pct: ig.engagement_rate_pct ?? null, avg_interactions: ig.avg_interactions_last_12 ?? null,
          repeated: ig.repeated_captions_last_12 ?? null,
          last_posts: (ig.last_posts ?? []).map((p: any) => ({ date: p.date ?? null, type: p.type ?? null, interactions: (p.likes ?? 0) + (p.comments ?? 0) })),
        } : null,
        tracking: tr ? {
          gtm: n(tr.gtm_containers), meta: n(tr.meta_pixels), ga4: n(tr.ga4_properties), ads: n(tr.google_ads_tags),
          tiktok: n(tr.tiktok_pixels), linkedin: n(tr.linkedin_insight), clarity: n(tr.clarity), server_side: n(tr.server_side_gtm) > 0,
        } : null,
        site: d.site ? {
          pages: d.site.pages?.total_in_sitemap ?? 0,
          kinds: d.site.pages?.by_kind_counts ?? {},
          contact: facts?.contact ? {
            forms: facts.contact.forms ?? 0, phone: n(facts.contact.phone_links), whatsapp: n(facts.contact.whatsapp_links),
            email: n(facts.contact.email_links), scheduling: n(facts.contact.scheduling),
          } : null,
          has_meta_description: !!facts?.meta_description,
          images_without_alt: facts?.images_without_alt ?? 0,
        } : null,
      },
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});

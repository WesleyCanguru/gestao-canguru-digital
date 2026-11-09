// Página pública da proposta gerada na Bolsa (/p/<slug>). Sem login. Rascunho não aparece.
// O registro de abertura continua na função proposal-track (mesmo slug).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { slug } = await req.json();
    if (typeof slug !== "string" || !/^[a-z0-9-]{3,80}$/.test(slug)) return json({ error: "Link inválido." }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: p } = await admin.from("proposals")
      .select("slug, agency_id, prospect_name, title, whatsapp, monthly_value, setup_value, currency, status, content, language, version, sent_at, created_at")
      .eq("slug", slug).maybeSingle();
    if (!p || p.status === "draft" || !p.content) return json({ error: "Proposta não encontrada." }, 404);
    const { data: agency } = await admin.from("agencies").select("name, logo_url, primary_color, contact_whatsapp").eq("id", p.agency_id).maybeSingle();
    const { pontos_em_aberto: _h, ...content } = p.content as Record<string, unknown>;
    return json({ proposal: { ...p, content }, agency });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});

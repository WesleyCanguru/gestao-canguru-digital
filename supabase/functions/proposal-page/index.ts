// Página pública da proposta (/p/<slug>): mostra, registra abertura e cliques.
// Sem login: quem tem o link vê.
// Ações: get, track.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const ONESIGNAL: Record<number, { appId: string; secret: string; url: string }> = {
  1: { appId: "dba12918-fbf1-4b24-9376-2740c1fd0e4b", secret: "ONESIGNAL_CANGURU_REST_KEY", url: "https://bolsa.cangurudigital.com.br/" },
};
const push = async (agencyId: number, title: string, body: string) => {
  const cfg = ONESIGNAL[agencyId] ?? ONESIGNAL[1];
  const key = Deno.env.get(cfg.secret);
  if (!key) return;
  try {
    await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify({
        app_id: cfg.appId,
        filters: [{ field: "tag", key: "agency_id", relation: "=", value: String(agencyId) }],
        headings: { en: title, pt: title }, contents: { en: body, pt: body }, url: cfg.url,
      }),
    });
  } catch (e) { console.error("onesignal", e); }
};
const fmtTime = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    const slug = str(body.slug, 120);
    if (!slug) return json({ error: "Slug inválido." }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: proposal } = await admin.from("proposals").select("*").eq("slug", slug).maybeSingle();
    if (!proposal) return json({ error: "Proposta não encontrada." }, 404);

    const action = str(body.action, 20);

    if (action === "get") {
      const { data: agency } = await admin.from("agencies").select("name, logo_url, primary_color, contact_whatsapp").eq("id", proposal.agency_id).maybeSingle();
      return json({ proposal, agency: agency ?? null });
    }

    if (action === "track") {
      const event = str(body.event, 30);
      if (!["open", "read_time", "whatsapp_click"].includes(event)) return json({ error: "bad event" }, 400);
      const sid = str(body.session, 64) || null;
      if (event === "read_time" && sid) {
        const secs = Math.max(0, Math.min(Number(body.seconds) || 0, 6 * 3600));
        const { data: ex } = await admin.from("proposal_events").select("id, seconds")
          .eq("proposal_id", proposal.id).eq("session_id", sid).eq("event_type", "read_time").maybeSingle();
        if (ex) {
          if (secs > (ex.seconds ?? 0)) await admin.from("proposal_events").update({ seconds: secs }).eq("id", ex.id);
        } else {
          await admin.from("proposal_events").insert({
            proposal_id: proposal.id, event_type: "read_time", session_id: sid, seconds: secs,
            user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
          });
        }
        return json({ ok: true });
      }

      if (event === "open" && sid) {
        const { count } = await admin.from("proposal_events").select("id", { count: "exact", head: true })
          .eq("proposal_id", proposal.id).eq("session_id", sid).eq("event_type", "open");
        if ((count ?? 0) > 0) return json({ ok: true, dup: true });
      }

      await admin.from("proposal_events").insert({
        proposal_id: proposal.id, event_type: event, session_id: sid,
        user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
      });

      if (event === "open") {
        const { count } = await admin.from("proposal_events").select("id", { count: "exact", head: true }).eq("proposal_id", proposal.id).eq("event_type", "open");
        const n = count ?? 1;
        const now = new Date();
        await push(proposal.agency_id, "Proposta aberta", `${proposal.prospect_name || "O cliente"} abriu a proposta${n > 1 ? ` (${n}ª vez)` : ""} às ${fmtTime(now)} (Brasília).`);
      }
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});

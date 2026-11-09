// Página pública da estratégia (/e/<token>): mostra, registra abertura e recebe a resposta do cliente.
// Sem login: quem tem o link (enviado no grupo do WhatsApp) vê e responde.
// Ações: get, track, respond. Rascunhos nunca aparecem.
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
    const token = str(body.token, 64);
    if (!/^[a-f0-9]{32}$/.test(token)) return json({ error: "Link inválido." }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: byToken } = await admin.from("client_strategies").select("id, client_id, agency_id, version, status").eq("public_token", token).maybeSingle();
    if (!byToken || byToken.status === "draft") return json({ error: "Estratégia não encontrada." }, 404);

    // Se já existe uma versão mais nova enviada, o link antigo mostra a nova.
    const { data: latestRows } = await admin.from("client_strategies")
      .select("id, client_id, agency_id, version, status, content, sent_at, responded_at, client_feedback, responded_name, public_token")
      .eq("client_id", byToken.client_id).neq("status", "draft").order("version", { ascending: false }).limit(1);
    const s = latestRows?.[0];
    if (!s) return json({ error: "Estratégia não encontrada." }, 404);

    const { data: client } = await admin.from("clients").select("name, responsible, agency_id, currency, traffic_strategy_data").eq("id", s.client_id).maybeSingle();
    const tsd = (client?.traffic_strategy_data ?? {}) as Record<string, unknown>;
    const lang = ["pt", "en", "es"].includes(String(tsd.language)) ? String(tsd.language) : (s.agency_id === 7 ? "en" : "pt");
    const action = str(body.action, 20);

    if (action === "get") {
      const { data: agency } = await admin.from("agencies").select("name, logo_url, primary_color, contact_whatsapp").eq("id", s.agency_id).maybeSingle();
      const { pontos_em_aberto: _hidden, ...content } = (s.content ?? {}) as Record<string, unknown>;
      return json({
        strategy: {
          version: s.version, status: s.status, content, sent_at: s.sent_at, responded_at: s.responded_at,
          client_feedback: s.client_feedback, responded_name: s.responded_name,
          token: s.public_token, newer_than_link: s.id !== byToken.id,
        },
        client: { name: client?.name ?? "", responsible: client?.responsible ?? "", lang, currency: client?.currency ?? null },
        agency: agency ?? null,
      });
    }

    if (action === "track") {
      const event = str(body.event, 20);
      if (!["open", "read_time", "whatsapp_click"].includes(event)) return json({ error: "bad event" }, 400);
      const sid = str(body.session, 64) || null;
      if (event === "read_time" && sid) {
        const secs = Math.max(0, Math.min(Number(body.seconds) || 0, 6 * 3600));
        const { data: ex } = await admin.from("strategy_events").select("id, seconds")
          .eq("strategy_id", s.id).eq("session_id", sid).eq("event_type", "read_time").maybeSingle();
        if (ex) { if (secs > (ex.seconds ?? 0)) await admin.from("strategy_events").update({ seconds: secs }).eq("id", ex.id); }
        else await admin.from("strategy_events").insert({ strategy_id: s.id, agency_id: s.agency_id, event_type: "read_time", session_id: sid, seconds: secs });
        const { data: all } = await admin.from("strategy_events").select("seconds").eq("strategy_id", s.id).eq("event_type", "read_time");
        const total = (all ?? []).reduce((a, r) => a + (r.seconds ?? 0), 0);
        await admin.from("client_strategies").update({ read_seconds: total }).eq("id", s.id);
        return json({ ok: true });
      }
      if (event === "open" && sid) {
        const { count } = await admin.from("strategy_events").select("id", { count: "exact", head: true })
          .eq("strategy_id", s.id).eq("session_id", sid).eq("event_type", "open");
        if ((count ?? 0) > 0) return json({ ok: true, dup: true });
      }
      await admin.from("strategy_events").insert({
        strategy_id: s.id, agency_id: s.agency_id, event_type: event, session_id: sid,
        user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
      });
      if (event === "open") {
        const { count } = await admin.from("strategy_events").select("id", { count: "exact", head: true }).eq("strategy_id", s.id).eq("event_type", "open");
        const n = count ?? 1;
        const now = new Date();
        const { data: cur } = await admin.from("client_strategies").select("first_opened_at").eq("id", s.id).maybeSingle();
        await admin.from("client_strategies").update({
          open_count: n, last_opened_at: now.toISOString(), first_opened_at: cur?.first_opened_at ?? now.toISOString(),
        }).eq("id", s.id);
        await push(s.agency_id, "Estratégia aberta", `${client?.name ?? "O cliente"} abriu a estratégia${n > 1 ? ` (${n}ª vez)` : ""} às ${fmtTime(now)} (Brasília).`);
      }
      return json({ ok: true });
    }

    if (action === "respond") {
      const decision = str(body.decision, 20);
      if (!["approved", "changes"].includes(decision)) return json({ error: "Resposta inválida." }, 400);
      const feedback = str(body.feedback, 4000);
      const name = str(body.name, 120);
      if (decision === "changes" && !feedback) return json({ error: "Conte o que você quer mudar." }, 400);
      if (s.status !== "sent") return json({ error: "Esta estratégia já foi respondida.", status: s.status }, 409);
      const now = new Date();
      const { error } = await admin.from("client_strategies").update({
        status: decision, responded_at: now.toISOString(), responded_via: "page", responded_name: name || null,
        client_feedback: feedback || null, updated_at: now.toISOString(),
      }).eq("id", s.id).eq("status", "sent");
      if (error) return json({ error: "Não foi possível salvar. Tente de novo." }, 500);
      await admin.from("strategy_events").insert({ strategy_id: s.id, agency_id: s.agency_id, event_type: decision, detail: (name || "").slice(0, 120) || null });
      const who = name ? `${name} (${client?.name ?? ""})` : (client?.name ?? "O cliente");
      await push(s.agency_id, decision === "approved" ? "Estratégia aprovada" : "Cliente pediu ajustes",
        decision === "approved" ? `${who} aprovou a estratégia v${s.version}.` : `${who} pediu ajustes na estratégia v${s.version}.`);
      return json({ ok: true, status: decision });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});

// Rastreio das páginas comerciais com portão de nome (ex.: bolsa.cangurudigital.com.br/advocacia).
// Sem login. A página manda: open (ao entrar), read_time (a cada 15 s e ao sair) e whatsapp_click.
// Grava em page_visits e avisa no Telegram: abertura (com nº da visita), tempo na página ao sair
// (só quando subiu 30 s ou mais desde o último aviso daquela sessão) e clique no WhatsApp.
// Aceita corpo em text/plain (fetch keepalive sem preflight).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendTelegram, tgEsc } from "./telegram.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Páginas aceitas: slug -> nome que aparece no aviso.
const PAGES: Record<string, { agency: number; label: string }> = {
  advocacia: { agency: 1, label: "Como trabalhamos (advocacia)" },
};

const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const idOk = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v);
const fmtDur = (s: number) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`);
const fmtWhen = () => new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = JSON.parse(await req.text());
    const { page, event, visitor, session, name, seconds, city, region, country } = body ?? {};
    const cfg = typeof page === "string" ? PAGES[page] : undefined;
    if (!cfg) return json({ error: "bad page" }, 400);
    if (!["open", "read_time", "whatsapp_click"].includes(event)) return json({ error: "bad event" }, 400);
    if (!idOk(visitor) || !idOk(session)) return json({ error: "bad id" }, 400);
    const who = clip(name, 80);
    if (!who) return json({ error: "name required" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const label = tgEsc(cfg.label);

    if (event === "open") {
      const { data: dup } = await db.from("page_visits").select("id").eq("session_id", session).eq("event_type", "open").maybeSingle();
      if (dup) return json({ ok: true, dup: true });
      const { count } = await db.from("page_visits").select("id", { count: "exact", head: true })
        .eq("page_slug", page).eq("visitor_id", visitor).eq("event_type", "open");
      const n = (count ?? 0) + 1;
      const geo = { city: clip(city, 80), region: clip(region, 40), country: clip(country, 8) };
      await db.from("page_visits").insert({
        agency_id: cfg.agency, page_slug: page, visitor_id: visitor, visitor_name: who, session_id: session,
        event_type: "open", visit_number: n, user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300), ...geo,
      });
      const where = [geo.city, geo.region].filter(Boolean).join(", ");
      await sendTelegram(`👀 <b>${tgEsc(who)}</b> abriu a página <i>${label}</i>${n > 1 ? ` (${n}ª visita)` : ""}\n🕒 ${fmtWhen()} (Brasília)${where ? `\n📍 ${tgEsc(where)}` : ""}`);
      return json({ ok: true, visit: n });
    }

    if (event === "read_time") {
      const secs = Math.max(0, Math.min(Math.round(Number(seconds) || 0), 6 * 3600));
      const { data: row } = await db.from("page_visits").select("id, seconds, notified_seconds")
        .eq("session_id", session).eq("event_type", "read_time").maybeSingle();
      let notified = row?.notified_seconds ?? 0;
      const final = body?.final === true;
      const shouldTell = final && secs >= 15 && secs - notified >= 30;
      if (shouldTell) notified = secs;
      if (row) {
        if (secs > (row.seconds ?? 0) || shouldTell) await db.from("page_visits").update({ seconds: Math.max(secs, row.seconds ?? 0), notified_seconds: notified, updated_at: new Date().toISOString() }).eq("id", row.id);
      } else {
        await db.from("page_visits").insert({ agency_id: cfg.agency, page_slug: page, visitor_id: visitor, visitor_name: who, session_id: session, event_type: "read_time", seconds: secs, notified_seconds: notified });
      }
      if (shouldTell) await sendTelegram(`⏱ <b>${tgEsc(who)}</b> ficou <b>${fmtDur(secs)}</b> na página <i>${label}</i>`);
      return json({ ok: true });
    }

    // whatsapp_click
    await db.from("page_visits").insert({ agency_id: cfg.agency, page_slug: page, visitor_id: visitor, visitor_name: who, session_id: session, event_type: "whatsapp_click" });
    await sendTelegram(`💬 <b>${tgEsc(who)}</b> clicou no WhatsApp da página <i>${label}</i>\nVai chamar você agora: responda rápido.`);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "unexpected" }, 500);
  }
});

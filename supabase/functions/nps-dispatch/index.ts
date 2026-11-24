// Pesquisa de satisfação automática (NPS), uma vez por dia (pg_cron):
// 1) No último dia do mês: cria a pesquisa do mês para cada cliente ativo com avisos ligados e manda o e-mail.
// 2) 48h depois, sem resposta: manda um lembrete.
// 3) Mais 48h sem resposta: avisa a equipe para cobrar pelo WhatsApp.
// Idempotente (dedupe na email_outbox). Só o pg_cron chama: exige o header x-cron-secret (check_cron_secret).
import { createClient } from "npm:@supabase/supabase-js@2";
import { brandOf, layout, sendEmail, teamRecipients, Lang } from "./mail.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { "Content-Type": "application/json" } });
const AGENCIES_ON = [1, 7];
const langOf = (c: any): Lang => { const l = c?.traffic_strategy_data?.language ?? (c?.agency_id === 7 ? "en" : "pt"); return l === "en" || l === "es" ? l : "pt"; };
const H48 = 48 * 3600 * 1000;

const TXT: Record<Lang, any> = {
  pt: { subject: (c: string) => `Como foi o mês? · ${c}`, title: "Como foi a sua experiência este mês?", intro: "Leva 30 segundos: uma nota de 0 a 10 e, se quiser, um comentário. A resposta vai direto para a diretoria da agência.", btn: "Responder a pesquisa", remSubject: (c: string) => `Lembrete: sua opinião sobre o mês · ${c}`, remTitle: "Ainda dá tempo de responder", remIntro: "Sua nota ajuda a gente a melhorar o que importa para você. São só 30 segundos." },
  en: { subject: (c: string) => `How was this month? · ${c}`, title: "How was your experience this month?", intro: "It takes 30 seconds: a score from 0 to 10 and, if you like, a comment. Your answer goes straight to the agency's leadership.", btn: "Answer the survey", remSubject: (c: string) => `Reminder: your feedback on this month · ${c}`, remTitle: "There's still time to answer", remIntro: "Your score helps us improve what matters to you. It only takes 30 seconds." },
  es: { subject: (c: string) => `¿Cómo fue el mes? · ${c}`, title: "¿Cómo fue tu experiencia este mes?", intro: "Toma 30 segundos: una nota de 0 a 10 y, si quieres, un comentario. La respuesta va directo a la dirección de la agencia.", btn: "Responder la encuesta", remSubject: (c: string) => `Recordatorio: tu opinión sobre el mes · ${c}`, remTitle: "Aún hay tiempo para responder", remIntro: "Tu nota nos ayuda a mejorar lo que te importa. Son solo 30 segundos." },
};

Deno.serve(async (req) => {
  const { data: okSecret } = await db.rpc("check_cron_secret", { p_secret: req.headers.get("x-cron-secret") ?? "" });
  if (okSecret !== true) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const body = await req.json().catch(() => ({}));
  const now = new Date();
  const br = new Date(now.getTime() - 3 * 3600 * 1000);
  const tomorrow = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() + 1));
  const lastDay = tomorrow.getUTCDate() === 1;
  const monthYear = `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}`;
  const { data: agencies } = await db.from("agencies").select("id, name, logo_url, domain, primary_color, access_email");
  const { data: settings } = await db.from("notification_settings").select("*");
  const ag = new Map((agencies || []).map((a: any) => [a.id, a]));
  const st = new Map((settings || []).map((s: any) => [s.agency_id, s]));
  const log: any[] = [];

  for (const agencyId of AGENCIES_ON) {
    const a = ag.get(agencyId); if (!a) continue;
    const appUrl = `https://${a.domain || "bolsa.cangurudigital.com.br"}`;
    const { data: clients } = await db.from("clients").select("*").eq("agency_id", agencyId).eq("client_status", "active");
    const eligible = (clients || []).filter((c: any) => !c.is_internal && !c.is_demo && c.notify_enabled && (c.notify_emails || []).length);

    if (lastDay) {
      for (const c of eligible) {
        const dedupe = `nps_invite:${c.id}:${monthYear}`;
        const { data: done } = await db.from("email_outbox").select("id").eq("dedupe_key", dedupe).maybeSingle();
        if (done) continue;
        let { data: nps } = await db.from("client_nps").select("*").eq("client_id", c.id).eq("month_year", monthYear).maybeSingle();
        if (nps?.responded_at) continue;
        if (!nps) {
          const ins = await db.from("client_nps").insert({ agency_id: agencyId, client_id: c.id, month_year: monthYear, token: crypto.randomUUID(), sent_at: now.toISOString() }).select().single();
          nps = ins.data;
        }
        if (!nps) continue;
        const lang = langOf(c); const b = brandOf(a, lang); const t = TXT[lang];
        const url = `${appUrl}/nps/${nps.token}`;
        const html = layout(b, lang, { title: t.title, intro: t.intro, button: { label: t.btn, url } });
        const res = await sendEmail({ from: b.from, to: c.notify_emails, subject: t.subject(c.name), html, reply_to: a.access_email });
        await db.from("email_outbox").insert({ agency_id: agencyId, client_id: c.id, audience: "client", kind: "nps_invite", ref_id: nps.id, dedupe_key: dedupe, status: res.ok ? "sent" : "failed", error: res.ok ? null : res.error, sent_at: now.toISOString(), to_emails: c.notify_emails, subject: t.subject(c.name) });
        log.push({ client: c.name, invite: res.ok });
      }
    }

    const { data: invites } = await db.from("email_outbox").select("client_id, ref_id, kind, sent_at, dedupe_key").eq("agency_id", agencyId).in("kind", ["nps_invite", "nps_reminder", "nps_team_alert"]).eq("status", "sent").gte("sent_at", new Date(now.getTime() - 20 * 24 * 3600 * 1000).toISOString());
    const byNps = new Map<string, any>();
    for (const r of invites || []) { const k = r.ref_id; const cur = byNps.get(k) || { client_id: r.client_id }; cur[r.kind] = r.sent_at; byNps.set(k, cur); }
    const lateForTeam: any[] = [];
    for (const [npsId, v] of byNps) {
      const { data: nps } = await db.from("client_nps").select("id, token, responded_at, month_year").eq("id", npsId).maybeSingle();
      if (!nps || nps.responded_at) continue;
      const c = (clients || []).find((x: any) => x.id === v.client_id); if (!c) continue;
      if (v.nps_invite && !v.nps_reminder && now.getTime() - new Date(v.nps_invite).getTime() >= H48 && c.notify_enabled && (c.notify_emails || []).length) {
        const lang = langOf(c); const b = brandOf(a, lang); const t = TXT[lang];
        const html = layout(b, lang, { title: t.remTitle, intro: t.remIntro, button: { label: t.btn, url: `${appUrl}/nps/${nps.token}` } });
        const res = await sendEmail({ from: b.from, to: c.notify_emails, subject: t.remSubject(c.name), html, reply_to: a.access_email });
        await db.from("email_outbox").insert({ agency_id: agencyId, client_id: c.id, audience: "client", kind: "nps_reminder", ref_id: npsId, dedupe_key: `nps_reminder:${c.id}:${nps.month_year}`, status: res.ok ? "sent" : "failed", error: res.ok ? null : res.error, sent_at: now.toISOString(), to_emails: c.notify_emails, subject: t.remSubject(c.name) });
        log.push({ client: c.name, reminder: res.ok });
      } else if (v.nps_reminder && !v.nps_team_alert && now.getTime() - new Date(v.nps_reminder).getTime() >= H48) {
        lateForTeam.push({ c, npsId, month: nps.month_year, token: nps.token });
      }
    }
    if (lateForTeam.length && st.get(agencyId)?.team_enabled) {
      const to = await teamRecipients(db, agencyId, st.get(agencyId));
      const b = brandOf(a, "pt");
      const html = layout(b, "pt", {
        title: lateForTeam.length === 1 ? `${lateForTeam[0].c.name} não respondeu a pesquisa` : `${lateForTeam.length} clientes não responderam a pesquisa`,
        intro: "Receberam o e-mail e o lembrete e não responderam. Vale mandar o link pelo WhatsApp.",
        items: lateForTeam.map((x) => ({ title: x.c.name, meta: `Pesquisa de ${x.month}`, url: `${appUrl}/nps/${x.token}` })),
        footnote: "Aviso automático para a equipe.",
      });
      const res = to.length ? await sendEmail({ from: b.from, to, subject: `Pesquisa de satisfação sem resposta · ${a.name}`, html }) : { ok: false, error: "sem equipe" };
      for (const x of lateForTeam) {
        await db.from("email_outbox").insert({ agency_id: agencyId, client_id: x.c.id, audience: "team", kind: "nps_team_alert", ref_id: x.npsId, dedupe_key: `nps_team_alert:${x.c.id}:${x.month}`, status: res.ok ? "sent" : "failed", error: res.ok ? null : res.error, sent_at: now.toISOString(), to_emails: to });
      }
      log.push({ agency: agencyId, teamAlert: lateForTeam.length });
    }
  }
  return json({ ok: true, lastDay, monthYear, log });
});

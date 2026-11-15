// Envia os avisos da fila email_outbox pelo Resend e gera os lembretes de 24h.
// Chamado pelo pg_cron a cada 5 minutos. Sem login de propósito: só processa a fila (idempotente).
import { createClient } from "npm:@supabase/supabase-js@2";
import { brandOf, layout, fmtPostDate, T, Lang, sendEmail, teamRecipients } from "./mail.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const langOf = (c: any): Lang => { const l = c?.traffic_strategy_data?.language ?? (c?.agency_id === 7 ? "en" : "pt"); return l === "en" || l === "es" ? l : "pt"; };
const postTitle = (p: any) => (p.theme_title || p.theme || (p.caption || "").slice(0, 70) || "Post").toString();

async function mark(ids: string[], patch: Record<string, unknown>) {
  if (ids.length) await db.from("email_outbox").update(patch).in("id", ids);
}

Deno.serve(async () => {
  const now = new Date();
  const report: Record<string, number> = { client: 0, team: 0, reminders: 0, skipped: 0, failed: 0 };
  const { data: agencies } = await db.from("agencies").select("id, name, logo_url, domain, primary_color, access_email");
  const { data: settings } = await db.from("notification_settings").select("*");
  const ag = new Map((agencies || []).map((a: any) => [a.id, a]));
  const st = new Map((settings || []).map((s: any) => [s.agency_id, s]));
  const clientCache = new Map<string, any>();
  const getClient = async (id: string) => {
    if (!clientCache.has(id)) {
      const { data } = await db.from("clients").select("id, name, agency_id, email, notify_enabled, notify_emails, is_demo, traffic_strategy_data, timezone").eq("id", id).maybeSingle();
      clientCache.set(id, data);
    }
    return clientCache.get(id);
  };

  const { data: queue } = await db.from("email_outbox").select("*").eq("status", "queued").lte("send_after", now.toISOString()).order("created_at").limit(300);
  const rows = queue || [];

  // ---------- Cliente: posts esperando aprovação (agrupa por cliente) ----------
  const byClient = new Map<string, any[]>();
  for (const r of rows.filter((r: any) => r.audience === "client" && r.kind === "post_pending")) {
    if (!byClient.has(r.client_id)) byClient.set(r.client_id, []);
    byClient.get(r.client_id)!.push(r);
  }
  for (const [clientId, list] of byClient) {
    const c = await getClient(clientId);
    const a = ag.get(c?.agency_id);
    const s = st.get(c?.agency_id);
    const ids = list.map((r) => r.id);
    const to = [...new Set((c?.notify_emails?.length ? c.notify_emails : []).filter(Boolean))] as string[];
    if (!c || !a || !c.notify_enabled || !to.length || (s && s.client_enabled === false)) {
      await mark(ids, { status: "skipped", error: !c ? "cliente não encontrado" : !c.notify_enabled ? "avisos desligados para o cliente" : "sem e-mail de aviso" });
      report.skipped += ids.length; continue;
    }
    const { data: posts } = await db.from("posts").select("id, date_key, theme, theme_title, caption, type, scheduled_time, status").in("id", list.map((r) => r.ref_id));
    const pend = (posts || []).filter((p: any) => p.status === "pending_approval");
    if (!pend.length) { await mark(ids, { status: "skipped", error: "post já saiu de esperando aprovação" }); report.skipped += ids.length; continue; }
    const lang = langOf(c); const b = brandOf(a, lang); const t = T[lang];
    const items = pend.map((p: any) => ({ title: postTitle(p), meta: fmtPostDate(p.date_key, p.scheduled_time, lang) + (p.type ? ` · ${p.type}` : ""), url: `${b.appUrl}/?mode=public&id=${encodeURIComponent(p.date_key)}` }));
    const one = items.length === 1;
    const subject = one ? t.pendOneSubject(c.name) : t.pendManySubject(items.length, c.name);
    const html = layout(b, lang, {
      title: one ? t.pendOneTitle : t.pendManyTitle(items.length),
      intro: one ? t.pendOneIntro : t.pendManyIntro,
      items,
      button: one ? { label: t.seeAndApprove, url: items[0].url } : { label: t.openPortal, url: b.appUrl },
      footnote: t.pendFoot,
    });
    const res = await sendEmail({ from: b.from, to, subject, html, reply_to: a.access_email });
    if (res.ok) {
      await mark([ids[0]], { status: "sent", sent_at: now.toISOString(), to_emails: to, subject });
      await mark(ids.slice(1), { status: "merged", sent_at: now.toISOString(), to_emails: to, subject });
      report.client += 1;
    } else { await mark(ids, { status: "failed", error: res.error }); report.failed += ids.length; }
  }

  // ---------- Equipe: cliente aprovou / pediu ajuste / reprovou; pedido de ajuda no onboarding ----------
  const teamRows = rows.filter((r: any) => r.audience === "team");
  const teamGroups = new Map<string, any[]>();
  for (const r of teamRows) { const k = `${r.agency_id}|${r.client_id}`; if (!teamGroups.has(k)) teamGroups.set(k, []); teamGroups.get(k)!.push(r); }
  for (const [, list] of teamGroups) {
    const ids = list.map((r) => r.id);
    const a = ag.get(list[0].agency_id); const s = st.get(list[0].agency_id);
    if (!a || !s?.team_enabled) { await mark(ids, { status: "skipped", error: "avisos da equipe desligados" }); report.skipped += ids.length; continue; }
    const to = await teamRecipients(db, a.id, s);
    if (!to.length) { await mark(ids, { status: "skipped", error: "equipe sem e-mail" }); report.skipped += ids.length; continue; }
    const c = list[0].client_id ? await getClient(list[0].client_id) : null;
    const postIds = list.filter((r) => r.ref_id).map((r) => r.ref_id);
    const { data: posts } = postIds.length ? await db.from("posts").select("id, date_key, theme, theme_title, caption").in("id", postIds) : { data: [] as any[] };
    const pm = new Map((posts || []).map((p: any) => [p.id, p]));
    const b = brandOf(a, "pt");
    const label: Record<string, string> = { post_approved: "Aprovou", post_changes_requested: "Pediu ajuste", post_rejected: "Reprovou", access_help: "Pediu ajuda" };
    const items = list.map((r) => {
      const p = pm.get(r.ref_id);
      if (r.kind === "access_help") return { title: `Conta do ${r.payload?.platform === "google" ? "Google Ads" : "Meta"}`, meta: "Pediu ajuda no onboarding para conectar a conta", url: b.appUrl, tag: label[r.kind] };
      return { title: p ? postTitle(p) : "Post", meta: p ? fmtPostDate(p.date_key, null, "pt") : "", url: p ? `${b.appUrl}/?mode=public&id=${encodeURIComponent(p.date_key)}` : b.appUrl, tag: label[r.kind] || r.kind };
    });
    const kinds = [...new Set(list.map((r) => r.kind))];
    const head = kinds.length === 1 ? label[kinds[0]] : "Respondeu";
    const subject = `${c?.name || "Cliente"} · ${head.toLowerCase()}${list.length > 1 ? ` (${list.length})` : ""}`;
    const html = layout(b, "pt", { title: `${c?.name || "Cliente"} ${head.toLowerCase()}`, intro: "Atualização feita pelo cliente agora há pouco.", items, button: { label: "Abrir a Bolsa", url: b.appUrl }, footnote: "Aviso automático para a equipe." });
    const res = await sendEmail({ from: b.from, to, subject, html });
    if (res.ok) { await mark(ids, { status: "sent", sent_at: now.toISOString(), to_emails: to, subject }); report.team += 1; }
    else { await mark(ids, { status: "failed", error: res.error }); report.failed += ids.length; }
  }

  // ---------- Lembrete: post esperando aprovação há 24h (até 3 lembretes, 1 a cada 24h) ----------
  const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const { data: sentRows } = await db.from("email_outbox").select("ref_id, client_id, kind, sent_at").eq("audience", "client").in("kind", ["post_pending", "post_reminder"]).in("status", ["sent", "merged"]).gte("sent_at", new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString());
  const last = new Map<string, { at: string; reminders: number; client: string }>();
  for (const r of sentRows || []) {
    const cur = last.get(r.ref_id) || { at: "", reminders: 0, client: r.client_id };
    if (r.sent_at > cur.at) cur.at = r.sent_at;
    if (r.kind === "post_reminder") cur.reminders += 1;
    last.set(r.ref_id, cur);
  }
  const due = [...last.entries()].filter(([, v]) => v.at <= since && v.reminders < 3);
  if (due.length) {
    const { data: posts } = await db.from("posts").select("id, client_id, date_key, theme, theme_title, caption, type, scheduled_time, status").in("id", due.map(([id]) => id));
    const still = (posts || []).filter((p: any) => p.status === "pending_approval");
    const groups = new Map<string, any[]>();
    for (const p of still) { if (!groups.has(p.client_id)) groups.set(p.client_id, []); groups.get(p.client_id)!.push(p); }
    for (const [clientId, ps] of groups) {
      const c = await getClient(clientId); const a = ag.get(c?.agency_id);
      const to = (c?.notify_emails || []).filter(Boolean);
      if (!c?.notify_enabled || !a || !to.length) continue;
      const lang = langOf(c); const b = brandOf(a, lang); const t = T[lang];
      const items = ps.map((p: any) => ({ title: postTitle(p), meta: fmtPostDate(p.date_key, p.scheduled_time, lang), url: `${b.appUrl}/?mode=public&id=${encodeURIComponent(p.date_key)}` }));
      const subject = t.remSubject(items.length, c.name);
      const html = layout(b, lang, { title: t.remTitle(items.length), intro: t.remIntro, items, button: items.length === 1 ? { label: t.seeAndApprove, url: items[0].url } : { label: t.openPortal, url: b.appUrl }, footnote: t.pendFoot });
      const res = await sendEmail({ from: b.from, to, subject, html, reply_to: a.access_email });
      const day = now.toISOString().slice(0, 10);
      await db.from("email_outbox").upsert(ps.map((p: any) => ({
        agency_id: c.agency_id, client_id: clientId, audience: "client", kind: "post_reminder", ref_id: p.id,
        dedupe_key: `post_reminder:${p.id}:${day}`, status: res.ok ? "sent" : "failed", error: res.ok ? null : res.error,
        sent_at: now.toISOString(), to_emails: to, subject,
      })), { onConflict: "dedupe_key", ignoreDuplicates: true });
      if (res.ok) report.reminders += 1; else report.failed += 1;
    }
  }

  // Tipos que esta função ainda não conhece ficam como estão (serão tratados por outra rotina).
  return json(report);
});

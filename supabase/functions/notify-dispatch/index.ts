// Envia os avisos da fila email_outbox pelo Resend e gera os lembretes de 24h.
// Avisos da equipe também vão para o Telegram (se TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID existirem)
// e, no caso de cadastro concluído, como notificação no iPhone/Mac (OneSignal).
// Linhas com audience 'telegram' (proposta aberta, estratégia, criativos) vão só para o Telegram.
// Chamado pelo pg_cron a cada 5 minutos. Sem login de propósito: só processa a fila (idempotente).
import { createClient } from "npm:@supabase/supabase-js@2";
import { brandOf, layout, fmtPostDate, T, Lang, sendEmail, teamRecipients } from "./mail.ts";
import { sendTelegram, telegramReady, tgEsc } from "./telegram.ts";
import { pushToAdmins } from "./push.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const langOf = (c: any): Lang => { const l = c?.traffic_strategy_data?.language ?? (c?.agency_id === 7 ? "en" : "pt"); return l === "en" || l === "es" ? l : "pt"; };
const postTitle = (p: any) => (p.theme_title || p.theme || (p.caption || "").slice(0, 70) || "Post").toString();

async function mark(ids: string[], patch: Record<string, unknown>) {
  if (ids.length) await db.from("email_outbox").update(patch).in("id", ids);
}

const TG_ICON: Record<string, string> = { post_approved: "✅", post_changes_requested: "✏️", post_rejected: "❌", access_help: "🆘", health_drop: "📉", signup_done: "🎉" };
const LANG_NAME: Record<string, string> = { pt: "português", en: "inglês", es: "espanhol" };

Deno.serve(async () => {
  const now = new Date();
  const report: Record<string, number> = { client: 0, team: 0, reminders: 0, skipped: 0, failed: 0, telegram: 0, telegram_failed: 0, push: 0, push_failed: 0 };
  const { data: agencies } = await db.from("agencies").select("id, name, logo_url, domain, primary_color, access_email");
  const { data: settings } = await db.from("notification_settings").select("*");
  const ag = new Map((agencies || []).map((a: any) => [a.id, a]));
  const st = new Map((settings || []).map((s: any) => [s.agency_id, s]));
  const clientCache = new Map<string, any>();
  const getClient = async (id: string) => {
    if (!clientCache.has(id)) {
      const { data } = await db.from("clients").select("id, name, agency_id, email, notify_enabled, notify_emails, is_demo, traffic_strategy_data, timezone, acquired_by_user_id").eq("id", id).maybeSingle();
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

  // ---------- Equipe: cliente aprovou / pediu ajuste / reprovou; ajuda no onboarding; saúde caiu; cadastro concluído ----------
  const teamRows = rows.filter((r: any) => r.audience === "team");
  const teamGroups = new Map<string, any[]>();
  for (const r of teamRows) { const k = `${r.agency_id}|${r.client_id}`; if (!teamGroups.has(k)) teamGroups.set(k, []); teamGroups.get(k)!.push(r); }
  for (const [, list] of teamGroups) {
    const ids = list.map((r) => r.id);
    const a = ag.get(list[0].agency_id); const s = st.get(list[0].agency_id);
    if (!a || !s?.team_enabled) { await mark(ids, { status: "skipped", error: "avisos da equipe desligados" }); report.skipped += ids.length; continue; }
    const c = list[0].client_id ? await getClient(list[0].client_id) : null;
    const postIds = list.filter((r) => r.ref_id).map((r) => r.ref_id);
    const { data: posts } = postIds.length ? await db.from("posts").select("id, date_key, theme, theme_title, caption").in("id", postIds) : { data: [] as any[] };
    const pm = new Map((posts || []).map((p: any) => [p.id, p]));
    const b = brandOf(a, "pt");
    // Quem trouxe o cliente (link de cadastro do sócio)
    let broughtBy: string | null = null;
    if (c?.acquired_by_user_id) {
      const { data: m } = await db.from("agency_members").select("display_name").eq("agency_id", a.id).eq("user_id", c.acquired_by_user_id).maybeSingle();
      broughtBy = (m?.display_name || "").split(" ")[0] || null;
    }
    const label: Record<string, string> = { post_approved: "Aprovou", post_changes_requested: "Pediu ajuste", post_rejected: "Reprovou", access_help: "Pediu ajuda", health_drop: "Saúde caiu", signup_done: "Terminou o cadastro" };
    const items = list.map((r) => {
      const p = pm.get(r.ref_id);
      if (r.kind === "health_drop") return { title: `Saúde caiu para ${r.payload?.score} (era ${r.payload?.prev})`, meta: (r.payload?.reasons || []).join(" · ") || "Sem motivo específico registrado", url: b.appUrl, tag: "Saúde do cliente" };
      if (r.kind === "access_help") return { title: `Conta do ${r.payload?.platform === "google" ? "Google Ads" : "Meta"}`, meta: "Pediu ajuda no onboarding para conectar a conta", url: b.appUrl, tag: label[r.kind] };
      if (r.kind === "signup_done") {
        const sv = (r.payload?.services || []).join(", ") || "sem serviço marcado";
        const meta = [r.payload?.responsible, broughtBy ? `via ${broughtBy}` : null, r.payload?.lang ? `em ${LANG_NAME[r.payload.lang] || r.payload.lang}` : null].filter(Boolean).join(" · ");
        return { title: `Serviços: ${sv}`, meta: `${meta}. Próximo passo: conferir acessos e montar o Raio-X.`, url: b.appUrl, tag: label[r.kind] };
      }
      return { title: p ? postTitle(p) : "Post", meta: p ? fmtPostDate(p.date_key, null, "pt") : "", url: p ? `${b.appUrl}/?mode=public&id=${encodeURIComponent(p.date_key)}` : b.appUrl, tag: label[r.kind] || r.kind };
    });
    const kinds = [...new Set(list.map((r) => r.kind))];
    const head = kinds.length === 1 ? label[kinds[0]] : "Respondeu";

    // Telegram: independente do e-mail. Falha aqui não muda nada no e-mail.
    {
      const clientName = c?.name || "Cliente";
      const agencyTag = a.id === 1 ? "" : ` · <i>${tgEsc(a.name)}</i>`;
      const lines = list.map((r, i) => {
        const it = items[i];
        const what = ["health_drop", "access_help", "signup_done"].includes(r.kind) ? `${it.title}${it.meta ? ` — ${it.meta}` : ""}` : `${label[r.kind] || r.kind}: ${it.title}${it.meta ? ` (${it.meta})` : ""}`;
        return `${TG_ICON[r.kind] || "•"} ${tgEsc(what)}${it.url ? `\n   <a href="${tgEsc(it.url)}">Abrir na Bolsa</a>` : ""}`;
      });
      const tg = await sendTelegram(`<b>${tgEsc(clientName)}</b> · ${tgEsc(head.toLowerCase())}${agencyTag}\n\n${lines.join("\n")}`);
      if (tg.ok) report.telegram += 1;
      else if (!tg.skipped) { report.telegram_failed += 1; console.error("telegram", tg.error); }
    }

    // Notificação no iPhone/Mac: só para cadastro concluído (o resto já chega pelo Telegram)
    if (kinds.includes("signup_done")) {
      const pu = await pushToAdmins(db, `🎉 ${c?.name || "Cliente novo"} terminou o cadastro`, `${a.id === 7 ? "Joey Growth" : a.name}${broughtBy ? ` · via ${broughtBy}` : ""}. Abra o onboarding para seguir.`);
      if (pu.ok) report.push += 1;
      else if (!pu.skipped) { report.push_failed += 1; console.error("push", pu.error); }
    }

    const to = await teamRecipients(db, a.id, s);
    if (!to.length) { await mark(ids, { status: "skipped", error: "equipe sem e-mail" }); report.skipped += ids.length; continue; }
    const subject = `${c?.name || "Cliente"} · ${head.toLowerCase()}${list.length > 1 ? ` (${list.length})` : ""}`;
    const intro = kinds.includes("health_drop") ? "A saúde do cliente caiu nesta semana. Veja os motivos abaixo."
      : kinds.includes("signup_done") ? "Um cliente novo terminou o cadastro. Ele já está no funil de onboarding."
      : "Atualização feita pelo cliente agora há pouco.";
    const html = layout(b, "pt", { title: `${c?.name || "Cliente"} ${head.toLowerCase()}`, intro, items, button: { label: "Abrir a Bolsa", url: b.appUrl }, footnote: "Aviso automático para a equipe." });
    const res = await sendEmail({ from: b.from, to, subject, html });
    if (res.ok) { await mark(ids, { status: "sent", sent_at: now.toISOString(), to_emails: to, subject }); report.team += 1; }
    else { await mark(ids, { status: "failed", error: res.error }); report.failed += ids.length; }
  }

  // ---------- Só Telegram: proposta aberta, estratégia, criativos ----------
  const tgRows = rows.filter((r: any) => r.audience === "telegram");
  if (tgRows.length && !telegramReady()) {
    await mark(tgRows.map((r: any) => r.id), { status: "skipped", error: "telegram não configurado" });
    report.skipped += tgRows.length;
  } else if (tgRows.length) {
    const fam = (k: string) => k.split("_")[0];
    const groups = new Map<string, any[]>();
    for (const r of tgRows) { const k = `${r.agency_id}|${r.client_id || r.ref_id}|${fam(r.kind)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(r); }
    for (const [, list] of groups) {
      const ids = list.map((r) => r.id);
      const a = ag.get(list[0].agency_id);
      const c = list[0].client_id ? await getClient(list[0].client_id) : null;
      const appUrl = brandOf(a || { id: 0, name: "" }, "pt").appUrl;
      const agencyTag = a && a.id !== 1 ? ` · <i>${tgEsc(a.name)}</i>` : "";
      const who = (r: any) => tgEsc(c?.name || r.payload?.name || "Cliente") + (c?.is_demo ? " (demo)" : "");
      let text = "";
      const f = fam(list[0].kind);
      if (f === "proposal") {
        const r = list[0]; const p = r.payload || {};
        const where = [p.city, p.country].filter(Boolean).join(", ");
        const opened = list.some((x) => x.kind === "proposal_open"); const wa = list.some((x) => x.kind === "proposal_whatsapp_click");
        text = `${wa ? "💬" : "👀"} <b>${who(r)}</b> ${opened ? "abriu a proposta" : ""}${opened && wa ? " e " : ""}${wa ? "clicou no WhatsApp da proposta" : ""}${agencyTag}`
          + (p.title ? `\n${tgEsc(p.title)}` : "") + (where ? `\n📍 ${tgEsc(where)}` : "")
          + `\n\n${wa ? "Ele quer conversar: responda rápido." : "Bom momento para ligar."}\n<a href="${tgEsc(appUrl)}">Abrir a Bolsa</a>`;
      } else if (f === "strategy") {
        const lines = list.map((r) => {
          const p = r.payload || {}; const v = p.version ? ` (v${p.version})` : "";
          if (r.kind === "strategy_open") return `👀 Abriu a estratégia${v}`;
          const s = String(p.status || "");
          const head = /approv|aprov/i.test(s) ? `✅ Aprovou a estratégia${v}` : /chang|ajust|revis/i.test(s) ? `✏️ Pediu ajuste na estratégia${v}` : `💬 Respondeu a estratégia${v}${s ? ` (${s})` : ""}`;
          return tgEsc(head) + (p.by ? ` · ${tgEsc(p.by)}` : "") + (p.feedback ? `\n   “${tgEsc(p.feedback)}”` : "");
        });
        text = `<b>${who(list[0])}</b> · estratégia${agencyTag}\n\n${lines.join("\n")}\n\n<a href="${tgEsc(appUrl)}">Abrir na Bolsa</a>`;
      } else if (f === "creative") {
        const ok = list.filter((r) => r.kind === "creative_approved").length; const ch = list.length - ok;
        const lines = list.map((r) => { const p = r.payload || {}; return `${r.kind === "creative_approved" ? "✅" : "✏️"} ${tgEsc(p.item || "Peça")}${p.batch ? ` · ${tgEsc(p.batch)}` : ""}${p.feedback && r.kind !== "creative_approved" ? `\n   “${tgEsc(p.feedback)}”` : ""}`; });
        const by = list.find((r) => r.payload?.by)?.payload?.by;
        text = `<b>${who(list[0])}</b> · criativos: ${ok ? `${ok} aprovad${ok > 1 ? "os" : "o"}` : ""}${ok && ch ? ", " : ""}${ch ? `${ch} com ajuste` : ""}${agencyTag}${by ? `\npor ${tgEsc(by)}` : ""}\n\n${lines.join("\n")}\n\n<a href="${tgEsc(appUrl)}">Abrir na Bolsa</a>`;
      } else {
        text = `<b>${who(list[0])}</b> · ${tgEsc(list[0].kind)}${agencyTag}`;
      }
      const tg = await sendTelegram(text);
      if (tg.ok) { await mark(ids, { status: "sent", sent_at: now.toISOString(), subject: "telegram" }); report.telegram += 1; }
      else { await mark(ids, { status: "failed", error: tg.error || "telegram" }); report.telegram_failed += 1; }
    }
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

  return json(report);
});

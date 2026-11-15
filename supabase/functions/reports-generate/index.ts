// Gera os relatórios em página e manda os e-mails.
// Automático (pg_cron, body {auto:true}): todo dia -> resumo diário da equipe (ontem);
//   segunda -> semanal dos clientes + semanal da equipe; dia 1 -> mensal dos clientes + mensal da equipe.
// Manual (equipe logada): {client_id, period: 'weekly'|'monthly'|'quarterly', start?, end?} -> gera na hora.
// O cliente só recebe por e-mail se notification_settings.client_reports_auto e o cliente tiver avisos ligados.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildClientData, buildTeamData, iso, addDays, Period } from "./data.ts";
import { brandOf, layout, sendEmail, teamRecipients, Lang } from "./mail.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const MODEL = "claude-sonnet-5-5";
const AGENCIES_ON = [1, 7];
const langOf = (c: any): Lang => { const l = c?.traffic_strategy_data?.language ?? (c?.agency_id === 7 ? "en" : "pt"); return l === "en" || l === "es" ? l : "pt"; };

// Datas no relógio de Brasília (referência da operação).
const todayBR = () => { const d = new Date(Date.now() - 3 * 3600 * 1000); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
const ranges = {
  daily: (t: Date) => ({ start: iso(addDays(t, -1)), end: iso(addDays(t, -1)) }),
  weekly: (t: Date) => { const dow = (t.getUTCDay() + 6) % 7; const mon = addDays(t, -dow - 7); return { start: iso(mon), end: iso(addDays(mon, 6)) }; },
  monthly: (t: Date) => { const s = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)); const e = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0)); return { start: iso(s), end: iso(e) }; },
  quarterly: (t: Date) => { const s = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 3, 1)); const e = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0)); return { start: iso(s), end: iso(e) }; },
};

const SUMMARY_TOOL = {
  name: "resumo",
  description: "Resumo do relatório para o cliente.",
  input_schema: { type: "object", properties: {
    headline: { type: "string", description: "Uma frase que resume o período." },
    highlights: { type: "array", items: { type: "string" }, description: "Até 4 pontos positivos ou fatos importantes, com número." },
    attention: { type: "array", items: { type: "string" }, description: "Até 3 pontos de atenção (o que caiu, o que está pendente)." },
    next_steps: { type: "array", items: { type: "string" }, description: "Até 3 próximos passos concretos da agência ou do cliente." },
  }, required: ["headline", "highlights", "attention", "next_steps"] },
};

async function aiSummary(clientName: string, period: Period, lang: Lang, data: any) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  const idioma = lang === "en" ? "inglês" : lang === "es" ? "espanhol" : "português do Brasil";
  const per = { daily: "dia", weekly: "semana", monthly: "mês", quarterly: "trimestre" }[period];
  const prompt = `Você escreve o resumo do relatório de marketing de um cliente da agência. Cliente: ${clientName}. Período: ${per} de ${data.start} a ${data.end}.
Dados em JSON (moeda ${data.currency}; *_prev é o período anterior de mesmo tamanho):
${JSON.stringify(data).slice(0, 20000)}

Regras:
- Escreva em ${idioma}, frases curtas, tom profissional e próximo, sem exagero e sem travessão.
- Use só números que estão nos dados. Não invente. Se uma área não tem dados, não fale dela.
- Compare com o período anterior quando houver (diga a variação em %).
- Tráfego: fale de investimento, resultados (conversões), custo por resultado e uso da verba do mês. Não prometa número de contatos.
- Vendas do CRM, quando houver, valem mais que número de contatos.
- Conteúdo: quantos posts foram publicados; se houver posts_per_month, compare a entrega com o contratado. Liste o que espera aprovação do cliente.
Chame a ferramenta resumo.`;
  for (let i = 0; i < 2; i++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, tools: [SUMMARY_TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: prompt }] }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) { console.error("claude", out); continue; }
    const res = (out.content || []).find((c: any) => c.type === "tool_use")?.input;
    if (res?.headline) return res;
  }
  return null;
}

async function findReport(row: Record<string, unknown>) {
  let q = db.from("reports").select("*").eq("agency_id", row.agency_id).eq("audience", row.audience).eq("period", row.period).eq("period_start", row.period_start);
  q = row.client_id ? q.eq("client_id", row.client_id) : q.is("client_id", null);
  const { data } = await q.maybeSingle();
  return data;
}

async function upsertReport(row: Record<string, unknown>) {
  const existing = await findReport(row);
  if (existing) {
    const { data } = await db.from("reports").update({ data: row.data, summary: row.summary, period_end: row.period_end, lang: row.lang }).eq("id", existing.id).select().single();
    return data;
  }
  const { data, error } = await db.from("reports").insert(row).select().single();
  if (error) throw error;
  return data;
}

const reportUrl = (a: any, token: string) => `https://${a.domain || "bolsa.cangurudigital.com.br"}/r/${token}`;
const PERIOD_LABEL: Record<Lang, Record<Period, string>> = {
  pt: { daily: "Resumo de ontem", weekly: "Resumo da semana", monthly: "Relatório do mês", quarterly: "Relatório do trimestre" },
  en: { daily: "Yesterday's summary", weekly: "Weekly summary", monthly: "Monthly report", quarterly: "Quarterly report" },
  es: { daily: "Resumen de ayer", weekly: "Resumen de la semana", monthly: "Informe del mes", quarterly: "Informe del trimestre" },
};
const fmtRange = (s: string, e: string, lang: Lang) => {
  const f = (d: string) => { const [, m, dd] = d.split("-"); return lang === "en" ? `${m}/${dd}` : `${dd}/${m}`; };
  return s === e ? f(s) : `${f(s)} – ${f(e)}`;
};

async function generateClient(client: any, agency: any, period: Period, start: string, end: string, createdBy: string | null, keepExisting = false) {
  if (keepExisting) { const ex = await findReport({ agency_id: client.agency_id, client_id: client.id, audience: "client", period, period_start: start }); if (ex) return ex; }
  const lang = langOf(client);
  const data = await buildClientData(db, client, start, end);
  const summary = (await aiSummary(client.name, period, lang, data)) || {};
  return await upsertReport({ agency_id: client.agency_id, client_id: client.id, audience: "client", period, period_start: start, period_end: end, lang, data, summary, created_by: createdBy });
}

async function emailClientReport(rep: any, client: any, agency: any, settings: any) {
  if (rep.sent_at) return false;
  if (!settings?.client_reports_auto || !client.notify_enabled || !(client.notify_emails || []).length) return false;
  const lang = rep.lang as Lang; const b = brandOf(agency, lang);
  const label = PERIOD_LABEL[lang][rep.period as Period];
  const url = reportUrl(agency, rep.token);
  const intro = rep.summary?.headline || "";
  const btn = lang === "en" ? "Open the report" : lang === "es" ? "Abrir el informe" : "Abrir o relatório";
  const html = layout(b, lang, { title: `${label} · ${fmtRange(rep.period_start, rep.period_end, lang)}`, intro, items: (rep.summary?.highlights || []).slice(0, 3).map((h: string) => ({ title: h })), button: { label: btn, url } });
  const res = await sendEmail({ from: b.from, to: client.notify_emails, subject: `${label} · ${client.name}`, html, reply_to: agency.access_email });
  if (res.ok) await db.from("reports").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", rep.id);
  return res.ok;
}

async function teamReport(agency: any, settings: any, period: Period, start: string, end: string, clientReports: any[]) {
  const prevRep = await findReport({ agency_id: agency.id, client_id: null, audience: "team", period, period_start: start });
  if (prevRep?.sent_at) return prevRep; // já gerado e enviado: não repete
  const data: any = await buildTeamData(db, agency.id, start, end);
  data.client_reports = clientReports.map((r) => ({ client_id: r.client_id, token: r.token, name: r._name }));
  const rep = await upsertReport({ agency_id: agency.id, client_id: null, audience: "team", period, period_start: start, period_end: end, lang: "pt", data, summary: {} });
  if (!settings?.team_enabled) return rep;
  const to = await teamRecipients(db, agency.id, settings);
  if (!to.length) return rep;
  const b = brandOf(agency, "pt");
  const real = data.clients.filter((c: any) => !c.is_demo);
  const items = real.map((c: any) => ({
    title: c.name,
    meta: [`${c.published} publicado(s)`, c.pending ? `${c.pending} esperando o cliente` : null, c.changesByClient ? `${c.changesByClient} ajuste(s) pedido(s)` : null, c.approvedByClient ? `${c.approvedByClient} aprovado(s)` : null, c.paid ? `${c.currency} ${Math.round(c.paid.investment)} em anúncios, ${c.paid.conversions} resultado(s)` : null].filter(Boolean).join(" · "),
  }));
  const extra = clientReports.length ? `<p style="margin:0 0 14px;font:400 14px/1.5 Arial,sans-serif;color:#4A5568">Relatórios dos clientes prontos: ${clientReports.map((r) => `<a href="${reportUrl(agency, r.token)}" style="color:${b.color}">${r._name}</a>`).join(" · ")}${settings?.client_reports_auto ? "" : " (ainda não enviados ao cliente: o envio automático está desligado)"}</p>` : "";
  const html = layout(b, "pt", {
    title: `${PERIOD_LABEL.pt[period]} · ${fmtRange(start, end, "pt")}`,
    intro: `${data.tasks.done} tarefa(s) concluída(s), ${data.tasks.overdue} atrasada(s).${data.npsPending ? ` ${data.npsPending} pesquisa(s) de satisfação sem resposta.` : ""}`,
    bodyHtml: extra, items, button: { label: "Abrir o resumo completo", url: reportUrl(agency, rep.token) }, footnote: "Resumo automático da equipe.",
  });
  await sendEmail({ from: b.from, to, subject: `${PERIOD_LABEL.pt[period]} · ${agency.name}`, html });
  await db.from("reports").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", rep.id);
  return rep;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const body = await req.json().catch(() => ({}));
  const { data: agencies } = await db.from("agencies").select("id, name, logo_url, domain, primary_color, access_email");
  const { data: settingsRows } = await db.from("notification_settings").select("*");
  const ag = new Map((agencies || []).map((a: any) => [a.id, a]));
  const st = new Map((settingsRows || []).map((s: any) => [s.agency_id, s]));

  // ---------- Manual: equipe pede um relatório de um cliente ----------
  if (!body.auto) {
    const auth = req.headers.get("Authorization") || "";
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false }, global: { headers: { Authorization: auth } } });
    const { data: who } = await user.auth.getUser();
    if (!who?.user || who.user.is_anonymous) return json({ error: "Faça login." }, 401);
    const { data: client } = await db.from("clients").select("*").eq("id", String(body.client_id || "")).maybeSingle();
    if (!client) return json({ error: "Cliente não encontrado." }, 404);
    const { data: isStaff } = await user.rpc("i_am_staff_of", { p_agency: client.agency_id });
    if (!isStaff) return json({ error: "Sem acesso." }, 403);
    const period: Period = ["weekly", "monthly", "quarterly"].includes(body.period) ? body.period : "monthly";
    const r = body.start && body.end ? { start: String(body.start), end: String(body.end) } : ranges[period](todayBR());
    const rep = await generateClient(client, ag.get(client.agency_id), period, r.start, r.end, who.user.id);
    return json({ ok: true, report: { id: rep.id, token: rep.token, url: reportUrl(ag.get(client.agency_id), rep.token) } });
  }

  // ---------- Automático ----------
  const today = todayBR();
  const isMonday = today.getUTCDay() === 1;
  const isFirst = today.getUTCDate() === 1;
  const only = body.only as string | undefined; // para testes: 'daily' | 'weekly' | 'monthly'
  const onlyAgency = body.agency_id ? Number(body.agency_id) : null;
  const log: Record<string, unknown>[] = [];
  for (const agencyId of AGENCIES_ON) {
    if (onlyAgency && agencyId !== onlyAgency) continue;
    const agency = ag.get(agencyId); const s = st.get(agencyId);
    if (!agency) continue;
    for (const period of ["monthly", "weekly"] as Period[]) {
      if (only ? only !== period : !(period === "monthly" ? isFirst : isMonday)) continue;
      const r = ranges[period](today);
      const { data: clients } = await db.from("clients").select("*").eq("agency_id", agencyId).eq("client_status", "active");
      const made: any[] = [];
      for (const c of (clients || []).filter((c: any) => !c.is_internal)) {
        try {
          const rep = await generateClient(c, agency, period, r.start, r.end, null, true);
          rep._name = c.name; made.push(rep);
          const sent = await emailClientReport(rep, c, agency, s);
          log.push({ agency: agencyId, client: c.name, period, token: rep.token, emailed: sent });
        } catch (e) { log.push({ agency: agencyId, client: c.name, period, error: String(e) }); }
      }
      await teamReport(agency, s, period, r.start, r.end, made);
    }
    if (only ? only === "daily" : true) {
      const r = ranges.daily(today);
      await teamReport(agency, s, "daily", r.start, r.end, []);
      log.push({ agency: agencyId, period: "daily" });
    }
  }
  return json({ ok: true, log });
});

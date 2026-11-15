// Monta os números de um relatório (cliente ou equipe) para um período.
type Db = any;
export type Period = "daily" | "weekly" | "monthly" | "quarterly";

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
export const keyDate = (dk: string): string | null => { const m = /(\d{2})-(\d{2})-(\d{4})/.exec(dk || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const title = (p: any) => (p.theme_title || p.theme || (p.caption || "").slice(0, 70) || "Post").toString();
const num = (v: unknown) => Number(v || 0);

/** Período anterior de mesmo tamanho (para comparar). */
export const previousRange = (start: string, end: string) => {
  const s = new Date(start + "T00:00:00Z"), e = new Date(end + "T00:00:00Z");
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return { start: iso(addDays(s, -days)), end: iso(addDays(s, -1)) };
};

async function paid(db: Db, clientId: string, start: string, end: string) {
  const { data } = await db.from("paid_traffic_daily").select("report_date, platform, investment, impressions, clicks, conversions")
    .eq("client_id", clientId).gte("report_date", start).lte("report_date", end);
  const rows = data || [];
  const by: Record<string, any> = {};
  const daily: Record<string, { investment: number; conversions: number }> = {};
  for (const r of rows) {
    const p = r.platform || "outro";
    by[p] ||= { investment: 0, impressions: 0, clicks: 0, conversions: 0 };
    by[p].investment += num(r.investment); by[p].impressions += num(r.impressions); by[p].clicks += num(r.clicks); by[p].conversions += num(r.conversions);
    daily[r.report_date] ||= { investment: 0, conversions: 0 };
    daily[r.report_date].investment += num(r.investment); daily[r.report_date].conversions += num(r.conversions);
  }
  const total = Object.values(by).reduce((a: any, b: any) => ({ investment: a.investment + b.investment, impressions: a.impressions + b.impressions, clicks: a.clicks + b.clicks, conversions: a.conversions + b.conversions }), { investment: 0, impressions: 0, clicks: 0, conversions: 0 });
  return { has: rows.length > 0, total, byPlatform: by, daily: Object.entries(daily).sort().map(([date, v]) => ({ date, ...v })) };
}

async function organic(db: Db, clientId: string, start: string, end: string) {
  const { data } = await db.from("social_metrics").select("date, platform, reach, impressions, likes, comments, shares, saves, followers_gained, followers_count, profile_visits")
    .eq("client_id", clientId).gte("date", start).lte("date", end).order("date");
  const rows = data || [];
  const t = { reach: 0, impressions: 0, engagement: 0, followers_gained: 0, profile_visits: 0, followers: 0 };
  for (const r of rows) {
    t.reach += num(r.reach); t.impressions += num(r.impressions); t.engagement += num(r.likes) + num(r.comments) + num(r.shares) + num(r.saves);
    t.followers_gained += num(r.followers_gained); t.profile_visits += num(r.profile_visits);
    if (r.followers_count) t.followers = num(r.followers_count);
  }
  const lastDate = rows.length ? rows[rows.length - 1].date : null;
  return { has: rows.length > 0, total: t, lastDate };
}

async function crm(db: Db, clientId: string, start: string, end: string) {
  const { data } = await db.from("client_leads").select("lead_date, created_at, source, closed, deal_value, kanban_stage, closed_at")
    .eq("client_id", clientId).gte("lead_date", start).lte("lead_date", end);
  const rows = data || [];
  const closed = rows.filter((r: any) => r.closed || r.kanban_stage === "Fechado");
  const bySource: Record<string, number> = {};
  for (const r of rows) bySource[r.source || "—"] = (bySource[r.source || "—"] || 0) + 1;
  return { has: rows.length > 0, leads: rows.length, closed: closed.length, revenue: closed.reduce((s: number, r: any) => s + num(r.deal_value), 0), bySource };
}

async function content(db: Db, clientId: string, start: string, end: string) {
  const { data } = await db.from("posts").select("id, date_key, theme, theme_title, caption, type, platform, status, scheduled_time, is_deleted")
    .eq("client_id", clientId).neq("status", "deleted");
  const all = (data || []).filter((p: any) => !p.is_deleted).map((p: any) => ({ ...p, d: keyDate(p.date_key) })).filter((p: any) => p.d);
  const inP = all.filter((p: any) => p.d >= start && p.d <= end);
  const item = (p: any) => ({ title: title(p), date: p.d, type: p.type || "", platform: p.platform || "meta", date_key: p.date_key, time: p.scheduled_time || null });
  const nextEnd = iso(addDays(new Date(end + "T00:00:00Z"), 7));
  return {
    published: inP.filter((p: any) => p.status === "published").map(item),
    planned: inP.length,
    pending: all.filter((p: any) => p.status === "pending_approval").map(item),
    changes: all.filter((p: any) => p.status === "changes_requested").map(item),
    upcoming: all.filter((p: any) => p.d > end && p.d <= nextEnd && ["scheduled", "approved", "pending_approval", "draft"].includes(p.status)).map((p: any) => ({ ...item(p), status: p.status })),
  };
}

async function budget(db: Db, clientId: string, end: string) {
  const ym = end.slice(0, 7);
  const { data: b } = await db.from("client_media_budgets").select("platform, budget_amount").eq("client_id", clientId).eq("month_year", ym);
  const total = (b || []).reduce((s: number, r: any) => s + num(r.budget_amount), 0);
  if (!total) return null;
  const { data: sp } = await db.from("paid_traffic_daily").select("investment").eq("client_id", clientId).gte("report_date", `${ym}-01`).lte("report_date", end);
  const spent = (sp || []).reduce((s: number, r: any) => s + num(r.investment), 0);
  return { month: ym, budget: total, spent };
}

export async function buildClientData(db: Db, client: any, start: string, end: string) {
  const services: string[] = client.services || [];
  const social = services.some((s) => /social/i.test(s));
  const traffic = services.some((s) => /tr[aá]fego/i.test(s));
  const prev = previousRange(start, end);
  const out: Record<string, unknown> = { start, end, services, currency: client.currency || "BRL", posts_per_month: client.posts_per_month ?? null };
  out.content = await content(db, client.id, start, end);
  if (social) { out.organic = await organic(db, client.id, start, end); out.organic_prev = await organic(db, client.id, prev.start, prev.end); }
  if (traffic) {
    out.paid = await paid(db, client.id, start, end); out.paid_prev = await paid(db, client.id, prev.start, prev.end);
    out.budget = await budget(db, client.id, end);
    out.crm = await crm(db, client.id, start, end);
  }
  return out;
}

/** Resumo da equipe: por cliente ativo, o que aconteceu no período. */
export async function buildTeamData(db: Db, agencyId: number, start: string, end: string) {
  const { data: clients } = await db.from("clients").select("id, name, services, currency, logo_url, color, client_status, is_demo, is_internal")
    .eq("agency_id", agencyId).eq("client_status", "active");
  const list = (clients || []).filter((c: any) => !c.is_internal);
  const startTs = `${start}T00:00:00Z`, endTs = `${end}T23:59:59Z`;
  const { data: events } = await db.from("email_outbox").select("client_id, kind, created_at").eq("agency_id", agencyId).eq("audience", "team").gte("created_at", startTs).lte("created_at", endTs);
  const out: any[] = [];
  for (const c of list) {
    const ct = await content(db, c.id, start, end);
    const traffic = (c.services || []).some((s: string) => /tr[aá]fego/i.test(s));
    const p = traffic ? await paid(db, c.id, start, end) : null;
    const ev = (events || []).filter((e: any) => e.client_id === c.id);
    out.push({
      id: c.id, name: c.name, logo_url: c.logo_url, color: c.color, currency: c.currency || "BRL", is_demo: !!c.is_demo,
      published: ct.published.length, planned: ct.planned, pending: ct.pending.length, changes: ct.changes.length,
      approvedByClient: ev.filter((e: any) => e.kind === "post_approved").length,
      changesByClient: ev.filter((e: any) => e.kind === "post_changes_requested").length,
      rejectedByClient: ev.filter((e: any) => e.kind === "post_rejected").length,
      helpRequests: ev.filter((e: any) => e.kind === "access_help").length,
      paid: p ? { investment: p.total.investment, conversions: p.total.conversions } : null,
    });
  }
  const { data: tasks } = await db.from("agency_tasks").select("status, completed_at, due_date, assignee_name, recurrence_type").eq("agency_id", agencyId);
  const t = tasks || [];
  const done = t.filter((x: any) => x.completed_at && x.completed_at >= startTs && x.completed_at <= endTs).length;
  const overdue = t.filter((x: any) => x.status !== "completed" && (!x.recurrence_type || x.recurrence_type === "none") && x.due_date && x.due_date < end).length;
  const { data: nps } = await db.from("client_nps").select("client_id, responded_at, month_year").eq("agency_id", agencyId).is("responded_at", null);
  return { start, end, clients: out, tasks: { done, overdue }, npsPending: (nps || []).length };
}

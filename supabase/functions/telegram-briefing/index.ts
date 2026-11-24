// Briefing da manhã no Telegram (pg_cron 10:30 UTC = 07:30 de Brasília).
// Só o pg_cron chama: exige o header x-cron-secret (check_cron_secret). Manda para o chat do Wesley, no máximo 1 vez por dia (trava na email_outbox).
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendTelegram, telegramReady, tgEsc } from "./telegram.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const dayIn = (tz: string, d = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { key: `${p.day}-${p.month}-${p.year}`, iso: `${p.year}-${p.month}-${p.day}` };
};
const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

Deno.serve(async (req) => {
  const { data: okSecret } = await db.rpc("check_cron_secret", { p_secret: req.headers.get("x-cron-secret") ?? "" });
  if (okSecret !== true) return json({ error: "unauthorized" }, 401);
  if (!telegramReady()) return json({ ok: false, skipped: "telegram não configurado" });
  const now = new Date();
  const sp = dayIn("America/Sao_Paulo", now);
  const lockKey = `tg:briefing:${sp.iso}`;
  const { data: lock } = await db.from("email_outbox").select("id").eq("dedupe_key", lockKey).eq("status", "sent").maybeSingle();
  if (lock) return json({ ok: true, skipped: "já enviado hoje" });

  // Janela de "ontem" em Brasília (UTC-3, sem horário de verão)
  const todayStart = new Date(`${sp.iso}T00:00:00-03:00`);
  const yStart = new Date(todayStart.getTime() - 24 * 3600 * 1000);

  const { data: agencies } = await db.from("agencies").select("id, name, domain");
  const { data: clients } = await db.from("clients").select("id, name, agency_id, timezone, is_demo, is_active");
  const real = (clients || []).filter((c: any) => !c.is_demo && c.is_active !== false);
  const cm = new Map(real.map((c: any) => [c.id, c]));

  // Posts de hoje (data no fuso de cada cliente)
  const keys = [...new Set(real.map((c: any) => dayIn(c.timezone || "America/Sao_Paulo", now).key))];
  const { data: todayPosts } = keys.length ? await db.from("posts").select("id, client_id, date_key, status, is_deleted")
    .or(keys.map((k) => `date_key.like.${k}%`).join(",")) : { data: [] as any[] };
  const postsToday = (todayPosts || []).filter((p: any) => {
    const c = cm.get(p.client_id); if (!c || p.is_deleted || ["deleted", "draft", "interested", "theme_pending"].includes(p.status)) return false;
    return p.date_key.startsWith(dayIn(c.timezone || "America/Sao_Paulo", now).key);
  });

  // Aprovações paradas há mais de 24h
  const { data: pend } = await db.from("posts").select("id, client_id, is_deleted").eq("status", "pending_approval").lt("last_updated", new Date(now.getTime() - 24 * 3600 * 1000).toISOString());
  const stale = (pend || []).filter((p: any) => cm.has(p.client_id) && !p.is_deleted);

  // Tarefas: vencem hoje / atrasadas
  const { data: tasks } = await db.from("agency_tasks").select("id, agency_id, due_date, status").eq("status", "pending").lte("due_date", sp.iso);

  // Propostas abertas ontem
  const { data: pev } = await db.from("proposal_events").select("proposal_id, event_type").in("event_type", ["open", "whatsapp_click"]).gte("created_at", yStart.toISOString()).lt("created_at", todayStart.toISOString());
  const pids = [...new Set((pev || []).map((e: any) => e.proposal_id))];
  const { data: props } = pids.length ? await db.from("proposals").select("id, agency_id, prospect_name, title").in("id", pids) : { data: [] as any[] };

  // Leads dos clientes ontem
  const { data: leads } = await db.from("client_leads").select("client_id").gte("created_at", yStart.toISOString()).lt("created_at", todayStart.toISOString());

  const countBy = (arr: any[], key: (x: any) => string) => { const m = new Map<string, number>(); for (const x of arr) { const k = key(x); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const sections: string[] = [];
  for (const a of (agencies || []).sort((x: any, y: any) => x.id - y.id)) {
    const inAg = (cid: string) => cm.get(cid)?.agency_id === a.id;
    const lines: string[] = [];
    const pt = postsToday.filter((p: any) => inAg(p.client_id));
    if (pt.length) {
      lines.push(`📅 <b>Posts de hoje (${pt.length})</b>`);
      for (const [cid, n] of countBy(pt, (p) => p.client_id)) {
        const waiting = pt.filter((p: any) => p.client_id === cid && p.status === "pending_approval").length;
        lines.push(`• ${tgEsc(cm.get(cid)!.name)}: ${n}${waiting ? ` (${waiting} sem aprovação ⚠️)` : ""}`);
      }
    }
    const st = stale.filter((p: any) => inAg(p.client_id));
    if (st.length) {
      lines.push(`⏳ <b>Esperando aprovação há +24h (${st.length})</b>`);
      for (const [cid, n] of countBy(st, (p) => p.client_id)) lines.push(`• ${tgEsc(cm.get(cid)!.name)}: ${n}`);
    }
    const tk = (tasks || []).filter((t: any) => t.agency_id === a.id);
    if (tk.length) {
      const today = tk.filter((t: any) => t.due_date === sp.iso).length; const late = tk.length - today;
      lines.push(`🗂 <b>Tarefas</b>: ${today} vencem hoje${late ? ` · ${late} atrasadas` : ""}`);
    }
    const pr = (props || []).filter((p: any) => p.agency_id === a.id);
    if (pr.length) {
      lines.push(`👀 <b>Propostas abertas ontem (${pr.length})</b>`);
      for (const p of pr) {
        const ev = (pev || []).filter((e: any) => e.proposal_id === p.id);
        const opens = ev.filter((e: any) => e.event_type === "open").length; const wa = ev.some((e: any) => e.event_type === "whatsapp_click");
        lines.push(`• ${tgEsc(p.prospect_name || p.title || "Proposta")}: ${opens}x${wa ? " · clicou no WhatsApp 💬" : ""}`);
      }
    }
    const ld = (leads || []).filter((l: any) => inAg(l.client_id));
    if (ld.length) lines.push(`📥 <b>Leads dos clientes ontem: ${ld.length}</b> (${countBy(ld, (l) => l.client_id).map(([cid, n]) => `${tgEsc(cm.get(cid)!.name)} ${n}`).join(", ")})`);
    if (lines.length) sections.push(`<b>${tgEsc(a.name)}</b>\n${lines.join("\n")}\n<a href="https://${tgEsc(a.domain || "bolsa.cangurudigital.com.br")}">Abrir a Bolsa</a>`);
  }

  const d = new Date(`${sp.iso}T12:00:00-03:00`);
  const title = `☀️ <b>Bom dia! Briefing de ${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MO[d.getUTCMonth()]}</b>`;
  const text = sections.length ? `${title}\n\n${sections.join("\n\n")}` : `${title}\n\nNada pendente hoje: sem posts, aprovações paradas, tarefas vencendo ou propostas abertas.`;
  const tg = await sendTelegram(text);
  await db.from("email_outbox").upsert({ agency_id: 1, audience: "telegram", kind: "briefing", dedupe_key: lockKey, status: tg.ok ? "sent" : "failed", error: tg.ok ? null : tg.error, sent_at: now.toISOString(), subject: "briefing telegram" }, { onConflict: "dedupe_key" });
  return json({ ok: tg.ok, error: tg.error, sections: sections.length });
});

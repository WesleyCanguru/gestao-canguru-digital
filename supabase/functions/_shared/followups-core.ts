// Núcleo dos follow-ups do CRM da agência. Sem dependências: usado pelo app (lib/followups.ts)
// e pela Edge Function telegram-briefing. Mudou aqui, vale nos dois.

export interface FollowUpCadence {
  /** "cadence" (padrão): dias úteis contados a partir da entrada na etapa. "date": usa form_data.retomar_em. */
  mode?: 'cadence' | 'date';
  /** Dias úteis desde a entrada na etapa para cada follow-up. Ex.: [2, 5]. */
  days?: number[];
  /** Nome de cada passo. Ex.: ["Follow-up 1 (prova)", "Despedida"]. */
  labels?: string[];
  /** Mensagem pronta de cada passo. Variáveis: {saudacao}, {tratamento}, {empresa}, {nota}. */
  templates?: string[];
  /** Depois do último follow-up, quantos dias úteis até sugerir "Perdido · Não respondeu". null = não sugere. */
  end_lose_after?: number | null;
}

export interface FollowUpStageLike {
  id: string;
  name: string;
  followup?: FollowUpCadence;
}

export interface FollowUpLeadLike {
  id: string;
  name: string;
  stage: string;
  stage_entered_at?: string | null;
  created_at: string;
  form_data?: Record<string, any> | null;
}

export interface FollowUpRecord {
  id?: string;
  lead_id: string;
  stage: string;
  step: number;
  outcome: 'feito' | 'pulado';
  created_at: string;
}

export type FollowUpStatus = 'atrasado' | 'hoje' | 'proximo';

export interface FollowUpDue {
  leadId: string;
  stageName: string;
  step: number;
  total: number;
  label: string;
  template: string;
  dueAt: Date;
  status: FollowUpStatus;
  daysLate: number;
  /** Passo final: sugerir marcar como perdido (Não respondeu). */
  isEnd: boolean;
  /** Etapa "Retomar depois" (data marcada). */
  isReturn: boolean;
}

const DAY = 24 * 3600 * 1000;

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addBusinessDays = (from: Date, n: number): Date => {
  const d = startOfDay(from);
  let left = Math.max(0, Math.round(n));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
};

const statusFor = (due: Date, today: Date): { status: FollowUpStatus; daysLate: number } => {
  const diff = Math.round((startOfDay(due).getTime() - startOfDay(today).getTime()) / DAY);
  if (diff < 0) return { status: 'atrasado', daysLate: -diff };
  if (diff === 0) return { status: 'hoje', daysLate: 0 };
  return { status: 'proximo', daysLate: 0 };
};

/** Data "AAAA-MM-DD" (ou ISO) para Date local, sem pular de dia por fuso. */
const parseDay = (v: unknown): Date | null => {
  if (!v || typeof v !== 'string') return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

export function computeFollowUp(
  lead: FollowUpLeadLike,
  stages: FollowUpStageLike[],
  history: FollowUpRecord[],
  today: Date = new Date(),
): FollowUpDue | null {
  const stage = stages.find(s => s.name === lead.stage);
  const cfg = stage?.followup;
  if (!stage || !cfg) return null;
  const entered = new Date(lead.stage_entered_at || lead.created_at);
  const done = history.filter(h => h.lead_id === lead.id && h.stage === lead.stage && new Date(h.created_at).getTime() >= entered.getTime() - 60000);

  if (cfg.mode === 'date') {
    if (done.length) return null;
    const due = parseDay(lead.form_data?.retomar_em);
    if (!due) return null;
    const st = statusFor(due, today);
    return { leadId: lead.id, stageName: stage.name, step: 0, total: 1, label: cfg.labels?.[0] || 'Retomar contato', template: cfg.templates?.[0] || '', dueAt: due, ...st, isEnd: false, isReturn: true };
  }

  const days = (cfg.days || []).filter(n => Number.isFinite(n) && n >= 0);
  const step = done.length;
  if (step < days.length) {
    const due = addBusinessDays(entered, days[step]);
    const st = statusFor(due, today);
    return { leadId: lead.id, stageName: stage.name, step, total: days.length, label: cfg.labels?.[step] || `Follow-up ${step + 1}`, template: cfg.templates?.[step] || '', dueAt: due, ...st, isEnd: false, isReturn: false };
  }
  if (cfg.end_lose_after != null && step === days.length && days.length > 0) {
    const due = addBusinessDays(entered, days[days.length - 1] + cfg.end_lose_after);
    const st = statusFor(due, today);
    return { leadId: lead.id, stageName: stage.name, step, total: days.length, label: 'Encerrar: sem resposta', template: '', dueAt: due, ...st, isEnd: true, isReturn: false };
  }
  return null;
}

export const greeting = (now: Date = new Date()): string => {
  let h = now.getHours();
  try {
    h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(now));
  } catch { /* usa a hora local */ }
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

export const leadTratamento = (lead: FollowUpLeadLike): string => {
  const fd = lead.form_data || {};
  if (typeof fd.tratamento === 'string' && fd.tratamento.trim()) return fd.tratamento.trim();
  const decisor = typeof fd.decisor === 'string' ? fd.decisor.split(/[/,]/)[0].trim() : '';
  if (decisor) return decisor.split(/\s+/)[0];
  return lead.name;
};

export const renderFollowUpTemplate = (template: string, lead: FollowUpLeadLike, now: Date = new Date()): string =>
  template
    .replace(/\{saudacao\}/g, greeting(now))
    .replace(/\{tratamento\}/g, leadTratamento(lead))
    .replace(/\{empresa\}/g, lead.name)
    .replace(/\{nota\}/g, String(lead.form_data?.retomar_nota || ''));

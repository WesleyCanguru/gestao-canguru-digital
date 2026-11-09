// Números do Financeiro para vários meses: base do Fluxo de caixa, do Resultado do mês e dos Sócios.
// Tudo na moeda base da agência. Regras:
//  - Recebido: received_amount_base > received_amount convertido > previsto convertido.
//  - Caixa (quando o dinheiro entra/sai): recebidos pelo mês do paid_at, abertos pelo mês do vencimento.
//  - Competência (a que mês pertence): cobranças pelo month_year; despesas pelo mês delas.
import dayjs from 'dayjs';
import { supabase } from './supabase';
import { AgencyBilling, AgencyExpense } from '../types';
import { parseExpenseRow, filterExpensesForMonth } from './expenses';
import { CurrencyCode, FxRates, asCurrency, toBase } from './money';

export const monthsBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  let d = dayjs(from + '-01');
  const end = dayjs(to + '-01');
  while (!d.isAfter(end)) { out.push(d.format('YYYY-MM')); d = d.add(1, 'month'); }
  return out;
};

const dueDateOf = (monthYear: string, dueDay?: number | null) => {
  const base = dayjs(monthYear + '-01');
  return base.date(Math.min(Math.max(1, dueDay || 10), base.daysInMonth())).format('YYYY-MM-DD');
};

export interface RangeData { months: string[]; billings: AgencyBilling[]; expensesByMonth: Record<string, AgencyExpense[]>; partnerMoves: { partner_name: string; kind: string; amount: number; move_date: string }[] }

/** Carrega cobranças (inclusive as que ainda não existem no banco, dos clientes ativos) e despesas de um intervalo. */
export async function loadFinanceRange(agencyId: number, from: string, to: string): Promise<RangeData> {
  const months = monthsBetween(from, to);
  // Busca 3 meses antes para pegar cobranças antigas pagas dentro do intervalo
  const fetchFrom = dayjs(from + '-01').subtract(3, 'month').format('YYYY-MM');
  const [{ data: billRows }, { data: clientRows }, { data: expRows }, { data: moveRows }] = await Promise.all([
    supabase.from('agency_billing').select('*, client:clients(*)').eq('agency_id', agencyId).gte('month_year', fetchFrom).lte('month_year', to),
    supabase.from('clients').select('*, contract:contract_forms(contract_start_date)').eq('agency_id', agencyId).neq('is_internal', true),
    supabase.from('agency_expenses').select('*').eq('agency_id', agencyId).not('is_deleted', 'is', true),
    // Retiradas e aportes dos sócios: mexem no caixa, não no lucro
    supabase.from('agency_partner_moves').select('partner_name, kind, amount, move_date').eq('agency_id', agencyId),
  ]);
  const real = ((billRows || []) as AgencyBilling[]).filter(b => b.is_sporadic || !(b.client as any)?.is_internal);
  const clients = (clientRows || []) as any[];

  const virtual: AgencyBilling[] = [];
  for (const m of months) {
    const has = new Set(real.filter(b => b.month_year === m && !b.is_sporadic).map(b => b.client_id));
    for (const c of clients) {
      if (c.is_internal || has.has(c.id) || !Number(c.base_value)) continue;
      if (c.client_type && c.client_type !== 'recurring') continue;
      const start = c.contract?.[0]?.contract_start_date || c.created_at;
      if (start && dayjs(start).format('YYYY-MM') > m) continue;
      if (c.client_status === 'cancelled' || c.client_status === 'completed') {
        const end = c.cancelled_at || c.service_end_date || c.updated_at;
        if (!end || dayjs(end).format('YYYY-MM') < m) continue;
      } else if (c.client_status && c.client_status !== 'active') continue;
      virtual.push({
        id: `temp-${c.id}-${m}`, client_id: c.id, agency_id: agencyId, month_year: m,
        base_value: Number(c.base_value) || 0, extra_value: 0, total_value: Number(c.base_value) || 0,
        due_day: c.due_day || 10, due_date: dueDateOf(m, c.due_day), status: 'pending', notes: null, paid_at: null,
        created_at: new Date().toISOString(), client: c, is_sporadic: false, currency: c.currency || null,
      } as AgencyBilling);
    }
  }

  const parsed = ((expRows || []) as any[]).map(parseExpenseRow);
  const expensesByMonth: Record<string, AgencyExpense[]> = {};
  for (const m of months) expensesByMonth[m] = filterExpensesForMonth(parsed, m);
  return { months, billings: [...real, ...virtual], expensesByMonth, partnerMoves: (moveRows || []) as any[] };
}

// ---------- valores de uma cobrança ----------
export const billCurrency = (b: any, base: CurrencyCode): CurrencyCode => asCurrency(b?.currency || b?.client?.currency, base);
const conv = (v: number, b: any, base: CurrencyCode, rates: FxRates | null) => toBase(v, billCurrency(b, base), base, rates) ?? v;
export const billTotalBase = (b: any, base: CurrencyCode, rates: FxRates | null) => conv(Number(b.base_value || 0) + Number(b.extra_value || 0), b, base, rates);
export const billReceivedBase = (b: any, base: CurrencyCode, rates: FxRates | null) => {
  if (b.status !== 'paid' && b.status !== 'partial') return 0;
  if (b.received_amount_base != null) return Number(b.received_amount_base);
  if (b.received_amount != null) return conv(Number(b.received_amount), b, base, rates);
  return billTotalBase(b, base, rates);
};
export const billOpenBase = (b: any, base: CurrencyCode, rates: FxRates | null) => {
  if (b.status === 'paid') return 0;
  const already = b.status === 'partial' ? Number(b.received_amount || 0) : 0;
  return conv(Math.max(0, Number(b.base_value || 0) + Number(b.extra_value || 0) - already), b, base, rates);
};
const billDue = (b: any) => (b.due_date ? String(b.due_date).slice(0, 10) : dueDateOf(b.month_year, b.due_day));
const expDue = (e: any, m: string) => (e.due_date ? String(e.due_date).slice(0, 10) : dueDateOf(m, e.due_day));
export const billName = (b: any) => (b.is_sporadic ? b.sporadic_name : b.client?.name) || 'Cobrança';

export const EXPENSE_TYPE_LABEL: Record<string, string> = { tools: 'Ferramentas', freelancer: 'Freelancers', freelancers: 'Freelancers', taxes: 'Impostos', impostos: 'Impostos', team: 'Equipe', marketing: 'Marketing', extras: 'Extras' };
export const expenseTypeLabel = (t?: string | null) => (t && EXPENSE_TYPE_LABEL[t]) || (t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Outros');

export interface CashItem { kind: 'in' | 'out'; name: string; date: string; value: number; done: boolean; assumed?: boolean; partner?: boolean }
export interface MonthNumbers {
  month: string;
  // competência
  revRecurring: number; revSporadic: number; revTotal: number; revHasForecast: boolean;
  expFixed: number; expVariable: number; expTotal: number; expByType: Record<string, number>;
  profit: number; margin: number;
  // caixa
  inDone: number; outDone: number; inPlanned: number; outPlanned: number; cashIn: number; cashOut: number; cashNet: number;
  items: CashItem[];
}

/** Números de cada mês. `today` decide o que já é realizado e o que é previsto. */
export function computeMonths(data: RangeData, base: CurrencyCode, rates: FxRates | null): MonthNumbers[] {
  const all = data.billings;
  return data.months.map(m => {
    // Competência
    const monthBills = all.filter(b => b.month_year === m);
    let revRecurring = 0, revSporadic = 0, revHasForecast = false;
    for (const b of monthBills) {
      const paid = b.status === 'paid';
      const v = paid ? billReceivedBase(b, base, rates) : billReceivedBase(b, base, rates) + billOpenBase(b, base, rates);
      if (!paid) revHasForecast = true;
      if (b.is_sporadic) revSporadic += v; else revRecurring += v;
    }
    const exps = data.expensesByMonth[m] || [];
    const expByType: Record<string, number> = {};
    let expFixed = 0, expVariable = 0;
    for (const e of exps) {
      const v = Number(e.amount) || 0;
      if (e.category === 'fixed' || e.is_fixed) expFixed += v; else expVariable += v;
      const k = expenseTypeLabel((e as any).expense_type);
      expByType[k] = (expByType[k] || 0) + v;
    }
    const revTotal = revRecurring + revSporadic;
    const expTotal = expFixed + expVariable;
    const profit = revTotal - expTotal;

    // Caixa
    const items: CashItem[] = [];
    const today = dayjs().format('YYYY-MM-DD');
    for (const b of all) {
      const rec = billReceivedBase(b, base, rates);
      if (rec > 0 && b.paid_at && dayjs(b.paid_at).format('YYYY-MM') === m) items.push({ kind: 'in', name: billName(b), date: dayjs(b.paid_at).format('YYYY-MM-DD'), value: rec, done: true });
      const open = billOpenBase(b, base, rates);
      if (open > 0 && billDue(b).slice(0, 7) === m) items.push({ kind: 'in', name: billName(b), date: billDue(b), value: open, done: false });
    }
    for (const mm of data.months) {
      for (const e of data.expensesByMonth[mm] || []) {
        const v = Number(e.amount) || 0;
        if (e.paid) {
          const when = e.paid_at ? dayjs(e.paid_at).format('YYYY-MM-DD') : expDue(e, mm);
          if (when.slice(0, 7) === m) items.push({ kind: 'out', name: e.description, date: when, value: v, done: true });
        } else if (expDue(e, mm).slice(0, 7) === m) {
          // Despesa sem marcar como paga e já vencida: conta como paga no vencimento (quase ninguém marca)
          const past = expDue(e, mm) < today;
          items.push({ kind: 'out', name: e.description, date: expDue(e, mm), value: v, done: past, assumed: past });
        }
      }
    }
    for (const mv of data.partnerMoves || []) {
      if (String(mv.move_date).slice(0, 7) !== m) continue;
      const when = String(mv.move_date).slice(0, 10);
      items.push({ kind: mv.kind === 'aporte' ? 'in' : 'out', name: `${mv.kind === 'aporte' ? 'Aporte' : 'Retirada'} · ${mv.partner_name}`, date: when, value: Number(mv.amount) || 0, done: true, partner: true });
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
    const sum = (k: 'in' | 'out', done: boolean) => items.filter(i => i.kind === k && i.done === done).reduce((a, i) => a + i.value, 0);
    const inDone = sum('in', true), outDone = sum('out', true), inPlanned = sum('in', false), outPlanned = sum('out', false);
    return {
      month: m, revRecurring, revSporadic, revTotal, revHasForecast, expFixed, expVariable, expTotal, expByType,
      profit, margin: revTotal > 0 ? (profit / revTotal) * 100 : 0,
      inDone, outDone, inPlanned, outPlanned, cashIn: inDone + inPlanned, cashOut: outDone + outPlanned, cashNet: inDone + inPlanned - outDone - outPlanned, items,
    };
  });
}

export const monthLabel = (m: string, long = false) => {
  const names = long
    ? ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    : ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const d = dayjs(m + '-01');
  return `${names[d.month()]}${long ? ' de ' + d.year() : '/' + d.format('YY')}`;
};

// ---------- configurações em agency_settings (chave e valor) ----------
export async function getAgencySetting<T>(agencyId: number, key: string): Promise<T | null> {
  const { data } = await supabase.from('agency_settings').select('value').eq('agency_id', agencyId).eq('key', key).maybeSingle();
  if (!data?.value) return null;
  try { return JSON.parse((data as any).value) as T; } catch { return null; }
}
export async function setAgencySetting(agencyId: number, key: string, value: unknown): Promise<string | null> {
  const text = JSON.stringify(value);
  const { data: existing } = await supabase.from('agency_settings').select('id').eq('agency_id', agencyId).eq('key', key).maybeSingle();
  const { error } = existing
    ? await supabase.from('agency_settings').update({ value: text, updated_at: new Date().toISOString() }).eq('id', (existing as any).id)
    : await supabase.from('agency_settings').insert({ agency_id: agencyId, key, value: text, enabled: true });
  return error?.message ?? null;
}

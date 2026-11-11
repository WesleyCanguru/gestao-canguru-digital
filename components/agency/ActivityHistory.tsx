import React, { useEffect, useMemo, useState } from 'react';
import { History, Loader2, Users, FileText, Wallet, UserCog, Eye, KeyRound, Circle, ChevronDown } from 'lucide-react';
import dayjs from 'dayjs';
import { supabase } from '../../lib/supabase';

interface LogRow {
  id: number;
  user_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  client_id: string | null;
  details: any;
  created_at: string;
}

type Period = 'today' | '7d' | '30d' | 'month' | 'all';
type Kind = 'all' | 'clients' | 'contracts' | 'finance' | 'team' | 'vault' | 'view_as' | 'other';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'month', label: 'Este mês' },
  { key: 'all', label: 'Tudo' },
];

const KINDS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'clients', label: 'Clientes' },
  { key: 'contracts', label: 'Contratos' },
  { key: 'finance', label: 'Financeiro' },
  { key: 'team', label: 'Equipe' },
  { key: 'vault', label: 'Cofre de senhas' },
  { key: 'view_as', label: 'Ver como cliente' },
  { key: 'other', label: 'Outros' },
];

const ENTITY_LABEL: Record<string, string> = {
  clients: 'o cliente', contract_forms: 'o contrato', agency_billing: 'uma cobrança', agency_expenses: 'uma despesa',
  agency_members: 'a equipe', client_members: 'um login de cliente', client_credentials: 'uma senha do cofre',
  client_revenue_events: 'uma receita', referral_commissions: 'uma comissão',
};
const ACTION_LABEL: Record<string, string> = { insert: 'criou', update: 'alterou', delete: 'excluiu' };

const kindOf = (l: LogRow): Kind => {
  if (l.action === 'view_as') return 'view_as';
  if (l.entity === 'clients') return 'clients';
  if (l.entity === 'contract_forms') return 'contracts';
  if (['agency_billing', 'agency_expenses', 'client_revenue_events', 'referral_commissions'].includes(l.entity)) return 'finance';
  if (['agency_members', 'client_members'].includes(l.entity)) return 'team';
  if (l.entity === 'client_credentials') return 'vault';
  return 'other';
};

const KIND_STYLE: Record<Kind, { icon: any; cls: string }> = {
  all: { icon: Circle, cls: 'bg-slate-50 text-slate-500' },
  clients: { icon: Users, cls: 'bg-blue-50 text-blue-600' },
  contracts: { icon: FileText, cls: 'bg-violet-50 text-violet-600' },
  finance: { icon: Wallet, cls: 'bg-emerald-50 text-emerald-600' },
  team: { icon: UserCog, cls: 'bg-amber-50 text-amber-600' },
  vault: { icon: KeyRound, cls: 'bg-rose-50 text-rose-600' },
  view_as: { icon: Eye, cls: 'bg-slate-100 text-slate-600' },
  other: { icon: Circle, cls: 'bg-slate-50 text-slate-500' },
};

// Campos técnicos que não interessam no resumo
const HIDDEN_FIELDS = new Set(['updated_at', 'created_at', 'id', 'agency_id', 'client_id', 'user_id']);
const FIELD_LABEL: Record<string, string> = {
  status: 'status', amount: 'valor', due_date: 'vencimento', paid_at: 'data de recebimento', name: 'nome',
  services: 'serviços', monthly_fee: 'mensalidade', is_active: 'ativo', permissions: 'permissões', role: 'papel',
  features_settings: 'módulos', logo_url: 'logo', notes: 'observação', password: 'senha',
};

const fromDate = (p: Period): string | null => {
  const now = dayjs();
  if (p === 'today') return now.startOf('day').toISOString();
  if (p === '7d') return now.subtract(6, 'day').startOf('day').toISOString();
  if (p === '30d') return now.subtract(29, 'day').startOf('day').toISOString();
  if (p === 'month') return now.startOf('month').toISOString();
  return null;
};

const dayTitle = (d: dayjs.Dayjs) => {
  const today = dayjs().startOf('day');
  if (d.isSame(today, 'day')) return 'Hoje';
  if (d.isSame(today.subtract(1, 'day'), 'day')) return 'Ontem';
  const wd = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.day()];
  return `${wd}, ${d.format('DD/MM')}`;
};

// Semana começando na segunda-feira
const weekStart = (d: dayjs.Dayjs) => d.startOf('day').subtract((d.day() + 6) % 7, 'day');

const ROLE_PT: Record<string, string> = { master: 'Administrador', partner: 'Sócio', team: 'Equipe' };

const PAGE = 100;

export const ActivityHistory: React.FC<{ agencyId: number; clientNames: Record<string, string> }> = ({ agencyId, clientNames }) => {
  const [period, setPeriod] = useState<Period>('7d');
  const [kind, setKind] = useState<Kind>('all');
  const [person, setPerson] = useState<string>('all');
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});

  const fetchPage = async (offset: number) => {
    let q = supabase.from('activity_log').select('*').eq('agency_id', agencyId)
      .order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
    const from = fromDate(period);
    if (from) q = q.gte('created_at', from);
    const { data } = await q;
    const list = (data as LogRow[]) || [];
    setMore(list.length === PAGE);
    return list;
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPage(0).then(list => { if (alive) { setRows(list); setLoading(false); } });
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [agencyId, period]);

  const loadMore = async () => {
    setLoading(true);
    const list = await fetchPage(rows.length);
    setRows(r => [...r, ...list]);
    setLoading(false);
  };

  const people = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => m.set(r.user_id || r.actor_name || '?', r.actor_name || 'Alguém'));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r =>
    (kind === 'all' || kindOf(r) === kind) &&
    (person === 'all' || (r.user_id || r.actor_name || '?') === person)
  ), [rows, kind, person]);

  const describe = (l: LogRow) => {
    const who = l.actor_name || 'Alguém';
    const cname = l.client_id ? clientNames[l.client_id] : null;
    if (l.action === 'view_as') return { who, text: `abriu o portal como ${cname || 'cliente'}` };
    // Equipe e logins (gravados pela função de logins, com o nome da pessoa)
    const d = l.details && typeof l.details === 'object' ? l.details : {};
    const person = d.pessoa?.para as string | undefined;
    if ((l.entity === 'agency_members' || l.entity === 'client_members') && person) {
      if (l.action === 'insert') return { who, text: l.entity === 'client_members' ? `criou o login de ${person}${cname ? ` (${cname})` : ''}` : `deu acesso a ${person}${d.role?.para ? ` como ${ROLE_PT[d.role.para] || d.role.para}` : ''}` };
      if (d.password) return { who, text: `definiu uma nova senha para ${person}` };
      if (d.is_active) return { who, text: `${d.is_active.para ? 'reativou' : 'desativou'} o acesso de ${person}` };
      const parts = [d.role ? `papel para ${ROLE_PT[d.role.para] || d.role.para}` : '', d.permissions ? 'permissões' : '', d.display_name ? 'nome' : ''].filter(Boolean);
      return { who, text: `alterou ${parts.join(', ') || 'o acesso'} de ${person}` };
    }
    const act = ACTION_LABEL[l.action] || l.action;
    const ent = ENTITY_LABEL[l.entity] || l.entity;
    const fields = l.action === 'update' && l.details && typeof l.details === 'object'
      ? Object.keys(l.details).filter(k => !HIDDEN_FIELDS.has(k)).slice(0, 3).map(k => FIELD_LABEL[k] || k.replace(/_/g, ' '))
      : [];
    return { who, text: `${act} ${ent}${cname ? ` ${cname}` : ''}${fields.length ? ` · ${fields.join(', ')}` : ''}` };
  };

  // Agrupa: semana > dia
  const groupByWeek = period === '30d' || period === 'month' || period === 'all';
  const groups = useMemo(() => {
    const weeks: { key: string; label: string; days: { key: string; label: string; items: LogRow[] }[] }[] = [];
    filtered.forEach(l => {
      const d = dayjs(l.created_at);
      const ws = weekStart(d);
      const wKey = groupByWeek ? ws.format('YYYY-MM-DD') : 'all';
      let w = weeks.find(x => x.key === wKey);
      if (!w) {
        w = { key: wKey, label: `Semana de ${ws.format('DD/MM')} a ${ws.add(6, 'day').format('DD/MM')}`, days: [] };
        weeks.push(w);
      }
      const dKey = d.format('YYYY-MM-DD');
      let day = w.days.find(x => x.key === dKey);
      if (!day) { day = { key: dKey, label: dayTitle(d), items: [] }; w.days.push(day); }
      day.items.push(l);
    });
    return weeks;
  }, [filtered, groupByWeek]);

  const currentWeek = weekStart(dayjs()).format('YYYY-MM-DD');
  const isWeekOpen = (k: string) => openWeeks[k] ?? (k === currentWeek || groups[0]?.key === k);

  const chip = (active: boolean) =>
    `shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${active ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`;

  const renderDay = (day: { key: string; label: string; items: LogRow[] }) => {
    const whoCount = new Set(day.items.map(i => i.user_id || i.actor_name)).size;
    return (
      <div key={day.key}>
        <div className="sticky top-0 z-[1] bg-white/95 backdrop-blur flex items-baseline justify-between gap-3 py-2">
          <p className="text-sm font-bold text-brand-dark">{day.label}</p>
          <p className="text-[11px] text-gray-400">{day.items.length} {day.items.length === 1 ? 'ação' : 'ações'} · {whoCount} {whoCount === 1 ? 'pessoa' : 'pessoas'}</p>
        </div>
        <ul className="divide-y divide-gray-50">
          {day.items.map(l => {
            const k = kindOf(l);
            const { icon: Icon, cls } = KIND_STYLE[k];
            const { who, text } = describe(l);
            return (
              <li key={l.id} className="py-2.5 flex items-center gap-3">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cls}`}><Icon size={15} /></span>
                <span className="text-sm text-gray-700 min-w-0 flex-1">
                  <span className="font-bold text-brand-dark">{who}</span> {text}
                </span>
                <span className="text-xs text-gray-400 shrink-0 tabular-nums">{dayjs(l.created_at).format('HH:mm')}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-brand-dark">
          <History size={18} /><h2 className="font-bold">Histórico de atividade</h2>
        </div>
        <select value={person} onChange={e => setPerson(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white self-start sm:self-auto">
          <option value="all">Todas as pessoas</option>
          {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PERIODS.map(p => <button key={p.key} onClick={() => setPeriod(p.key)} className={chip(period === p.key)}>{p.label}</button>)}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {KINDS.map(k => <button key={k.key} onClick={() => setKind(k.key)} className={chip(kind === k.key)}>{k.label}</button>)}
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">Nada registrado nesse período.</p>
      ) : (
        <div className="space-y-3">
          {groupByWeek ? groups.map(w => {
            const total = w.days.reduce((s, d) => s + d.items.length, 0);
            const open = isWeekOpen(w.key);
            return (
              <div key={w.key} className="rounded-2xl border border-gray-100">
                <button onClick={() => setOpenWeeks(o => ({ ...o, [w.key]: !open }))}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
                  <span className="text-sm font-bold text-gray-800">{w.label}</span>
                  <span className="flex items-center gap-2 text-xs text-gray-400">
                    {total} {total === 1 ? 'ação' : 'ações'}
                    <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {open && <div className="px-4 pb-3 space-y-2">{w.days.map(renderDay)}</div>}
              </div>
            );
          }) : <div className="space-y-2">{groups.flatMap(w => w.days).map(renderDay)}</div>}

          {more && (
            <button onClick={loadMore} disabled={loading}
              className="w-full py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60">
              {loading ? 'Carregando...' : 'Carregar mais'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

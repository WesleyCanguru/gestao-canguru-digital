import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Loader2, MessageCircle, Plus, Pencil, X, Check, AlertTriangle, Clock, UserPlus, Copy, CalendarClock, Eye, CheckCircle2, Users, ChevronDown, Timer } from 'lucide-react';
import { supabase, useAuth } from '../../lib/supabase';
import { TASK_STAGES, stageInfo, nudgeMessage, waNumber } from '../../lib/people';

/**
 * Pessoas e prazos: quem está fazendo o quê, o que está atrasado e o botão de cobrar no WhatsApp.
 * Responsáveis podem ser logins (equipe) ou pessoas sem login (freelancers, em agency_people).
 */

type Task = {
  id: string; title: string; due_date: string | null; status: string; completed_at: string | null; recurrence_type: string | null;
  assignee_name: string | null; assignee_user_id: string | null; front: string | null; stage: string | null; stage_changed_at: string | null;
  last_nudged_at: string | null; nudge_count: number | null; client_id: string | null; client?: { name: string; color?: string } | null; parent_task_id?: string | null;
};
type Person = { key: string; name: string; user_id: string | null; whatsapp: string | null; role_label: string | null; kind: 'login' | 'freelancer' | 'avulso'; people_id?: string };
type Freelancer = { id: string; name: string; role_label: string | null; whatsapp: string | null; is_active: boolean };

const FRONTS: Record<number, string[]> = { 1: ['Canguru', 'Joey'] };
const isDone = (t: Task) => t.status === 'completed' || t.status === 'done';
const fmtHours = (sec: number) => { if (!sec) return '0h'; const h = Math.floor(sec / 3600); const m = Math.round((sec % 3600) / 60); return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`; };

export const PessoasTab: React.FC = () => {
  const { agencyId } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [sessions, setSessions] = useState<{ user_id: string | null; task_id: string | null; duration_seconds: number; started_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [front, setFront] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [kpi, setKpi] = useState<'late' | 'soon' | 'review' | 'changes' | null>(null);
  const [editing, setEditing] = useState<Partial<Freelancer> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const fronts = (agencyId && FRONTS[agencyId]) || [];
  const today = dayjs().format('YYYY-MM-DD');
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  const weekAgo = dayjs().subtract(7, 'day');

  useEffect(() => {
    if (!agencyId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const since = dayjs().subtract(30, 'day').toISOString();
      const [t, m, p, s] = await Promise.all([
        supabase.from('agency_tasks').select('*, client:clients(name, color)').eq('agency_id', agencyId).or(`status.eq.pending,completed_at.gte.${dayjs().subtract(7, 'day').toISOString()}`),
        supabase.from('agency_members').select('user_id, display_name, email, contact_whatsapp, role, is_active').eq('agency_id', agencyId).eq('is_active', true),
        supabase.from('agency_people').select('*').eq('agency_id', agencyId).order('name'),
        supabase.from('task_sessions').select('user_id, task_id, duration_seconds, started_at').eq('agency_id', agencyId).gte('started_at', since),
      ]);
      if (!alive) return;
      const list = ((t.data as Task[]) || []).filter(x => !x.parent_task_id);
      const fl = ((p.data as Freelancer[]) || []);
      const map = new Map<string, Person>();
      ((m.data as any[]) || []).forEach(x => {
        const name = x.display_name || x.email;
        map.set(name, { key: name, name, user_id: x.user_id, whatsapp: x.contact_whatsapp || null, role_label: x.role === 'master' ? 'Administrador' : x.role === 'partner' ? 'Sócio' : 'Equipe', kind: 'login' });
      });
      fl.filter(f => f.is_active).forEach(f => { if (!map.has(f.name)) map.set(f.name, { key: f.name, name: f.name, user_id: null, whatsapp: f.whatsapp, role_label: f.role_label || 'Freelancer', kind: 'freelancer', people_id: f.id }); });
      list.forEach(x => { if (x.assignee_name && !map.has(x.assignee_name)) map.set(x.assignee_name, { key: x.assignee_name, name: x.assignee_name, user_id: x.assignee_user_id, whatsapp: null, role_label: 'Sem cadastro', kind: 'avulso' }); });
      setTasks(list); setFreelancers(fl); setPeople(Array.from(map.values())); setSessions((s.data as any[]) || []); setLoading(false);
    })();
    return () => { alive = false; };
  }, [agencyId, reload]);

  const visible = useMemo(() => tasks.filter(t => !front || t.front === front), [tasks, front]);
  // Prazos: só tarefas que não se repetem (rotinas ficam nas Tarefas)
  const deliveries = visible.filter(t => !t.recurrence_type || t.recurrence_type === 'none');
  const personOf = (t: Task) => t.assignee_name || '__none__';

  const stats = useMemo(() => {
    const out: Record<string, { open: number; late: number; soon: number; changes: number; review: number; doneWeek: number; secs: number }> = {};
    const get = (k: string) => (out[k] ||= { open: 0, late: 0, soon: 0, changes: 0, review: 0, doneWeek: 0, secs: 0 });
    for (const t of deliveries) {
      const s = get(personOf(t));
      if (isDone(t)) { if (t.completed_at && dayjs(t.completed_at).isAfter(weekAgo)) s.doneWeek++; continue; }
      s.open++;
      if (t.due_date && t.due_date < today) s.late++;
      else if (t.due_date && t.due_date <= tomorrow) s.soon++;
      if (t.stage === 'alteracao') s.changes++;
      if (t.stage === 'entregue') s.review++;
    }
    const byUser: Record<string, string> = {};
    people.forEach(p => { if (p.user_id) byUser[p.user_id] = p.key; });
    for (const se of sessions) {
      if (!dayjs(se.started_at).isAfter(weekAgo)) continue;
      const k = se.user_id ? byUser[se.user_id] : null;
      if (k) get(k).secs += se.duration_seconds || 0;
    }
    return out;
  }, [deliveries, sessions, people]); // eslint-disable-line react-hooks/exhaustive-deps

  // O que precisa de atenção: atrasado, vence hoje/amanhã, em alteração, entregue aguardando revisão
  const attention = deliveries.filter(t => !isDone(t) && (
    (t.due_date && t.due_date <= tomorrow) || t.stage === 'alteracao' || t.stage === 'entregue'
  )).filter(t => !selected || personOf(t) === selected)
    .filter(t => !kpi
      || (kpi === 'late' && !!t.due_date && t.due_date < today)
      || (kpi === 'soon' && !!t.due_date && t.due_date >= today && t.due_date <= tomorrow)
      || (kpi === 'review' && t.stage === 'entregue')
      || (kpi === 'changes' && t.stage === 'alteracao'))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));

  const others = deliveries.filter(t => !isDone(t) && !attention.includes(t) && (!selected || personOf(t) === selected))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));

  const hoursByClient = useMemo(() => {
    const taskClient: Record<string, string> = {};
    tasks.forEach(t => { taskClient[t.id] = t.client?.name || 'Agência (interno)'; });
    const out: Record<string, number> = {};
    sessions.forEach(s => { const c = (s.task_id && taskClient[s.task_id]) || 'Sem tarefa'; out[c] = (out[c] || 0) + (s.duration_seconds || 0); });
    return Object.entries(out).sort((a, b) => b[1] - a[1]);
  }, [tasks, sessions]);

  const personByName = (name: string | null) => people.find(p => p.name === name) || null;

  const nudge = async (t: Task) => {
    const p = personByName(t.assignee_name);
    const msg = nudgeMessage(t, t.assignee_name || '');
    const num = waNumber(p?.whatsapp);
    await supabase.from('agency_tasks').update({ last_nudged_at: new Date().toISOString(), nudge_count: (t.nudge_count || 0) + 1 }).eq('id', t.id);
    if (num) window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
    else { try { await navigator.clipboard.writeText(msg); } catch { /* ignore */ } setCopied(t.id); setTimeout(() => setCopied(null), 2500); }
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, last_nudged_at: new Date().toISOString(), nudge_count: (x.nudge_count || 0) + 1 } : x));
  };

  const setStage = async (t: Task, stage: string) => {
    const patch: any = { stage: stage || null, stage_changed_at: new Date().toISOString() };
    if (stage === 'aprovado') { patch.status = 'completed'; patch.completed_at = new Date().toISOString(); }
    const { error } = await supabase.from('agency_tasks').update(patch).eq('id', t.id);
    if (error) { setErr(error.message); return; }
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, ...patch } : x));
  };

  const saveFreelancer = async () => {
    if (!agencyId || !editing?.name?.trim()) { setErr('Informe o nome.'); return; }
    const row = { name: editing.name.trim(), role_label: editing.role_label?.trim() || null, whatsapp: editing.whatsapp?.trim() || null, is_active: editing.is_active ?? true };
    const { error } = editing.id
      ? await supabase.from('agency_people').update(row).eq('id', editing.id)
      : await supabase.from('agency_people').insert({ ...row, agency_id: agencyId });
    if (error) { setErr(error.message); return; }
    setEditing(null); setErr(''); setReload(r => r + 1);
  };

  const dueLabel = (t: Task) => {
    if (!t.due_date) return { text: 'sem prazo', cls: 'bg-gray-50 text-gray-500 border-gray-100' };
    const d = dayjs(t.due_date);
    const diff = d.diff(dayjs().startOf('day'), 'day');
    if (diff < 0) return { text: `atrasada ${-diff} ${-diff === 1 ? 'dia' : 'dias'}`, cls: 'bg-rose-50 text-rose-700 border-rose-100' };
    if (diff === 0) return { text: 'vence hoje', cls: 'bg-amber-50 text-amber-800 border-amber-100' };
    if (diff === 1) return { text: 'vence amanhã', cls: 'bg-amber-50 text-amber-800 border-amber-100' };
    return { text: `até ${d.format('DD/MM')}`, cls: 'bg-gray-50 text-gray-600 border-gray-100' };
  };

  const Avatar: React.FC<{ name: string; size?: string }> = ({ name, size = 'w-9 h-9 text-sm' }) => (
    <div className={`${size} rounded-xl bg-brand-dark text-white flex items-center justify-center font-bold shrink-0`}>{(name || '?').charAt(0).toUpperCase()}</div>
  );

  const row = (t: Task) => {
    const due = dueLabel(t);
    const p = personByName(t.assignee_name);
    const st = stageInfo(t.stage);
    return (
      <li key={t.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Avatar name={t.assignee_name || '?'} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-brand-dark truncate">{t.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
              <span className="font-semibold text-gray-700">{t.assignee_name || 'Sem responsável'}</span>
              {t.client?.name && <span>· {t.client.name}</span>}
              {t.front && <span className="px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.front}</span>}
              <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${due.cls}`}>{due.text}</span>
            </div>
            {(t.last_nudged_at || (st && t.stage_changed_at && (t.stage === 'entregue' || t.stage === 'alteracao'))) && (
              <p className="mt-1 text-[11px] text-gray-400">
                {t.last_nudged_at && <>cobrado {dayjs(t.last_nudged_at).isSame(dayjs(), 'day') ? `hoje ${dayjs(t.last_nudged_at).format('HH:mm')}` : dayjs(t.last_nudged_at).format('DD/MM HH:mm')}{(t.nudge_count || 0) > 1 ? ` (${t.nudge_count}x)` : ''}</>}
                {t.last_nudged_at && st && t.stage_changed_at && (t.stage === 'entregue' || t.stage === 'alteracao') && ' · '}
                {st && t.stage_changed_at && (t.stage === 'entregue' || t.stage === 'alteracao') && <>{st.short.toLowerCase()} desde {dayjs(t.stage_changed_at).format('DD/MM')}</>}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-12 md:pl-0">
          <select value={t.stage || ''} onChange={e => setStage(t, e.target.value)}
            className={`text-xs font-bold rounded-xl border px-2.5 py-2 ${st ? st.cls : 'bg-white text-gray-500 border-gray-200'}`}>
            <option value="">Sem etapa</option>
            {TASK_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {t.assignee_name && (
            <button onClick={() => nudge(t)} title={waNumber(p?.whatsapp) ? 'Abrir WhatsApp com a mensagem pronta' : 'Sem WhatsApp cadastrado: copia a mensagem'}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">
              {copied === t.id ? <><Check size={13} /> Copiada</> : waNumber(p?.whatsapp) ? <><MessageCircle size={13} /> Cobrar</> : <><Copy size={13} /> Cobrar</>}
            </button>
          )}
        </div>
      </li>
    );
  };

  const field = 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-dark/20 outline-none';
  const cardPeople = people.filter(p => stats[p.key] && (stats[p.key].open || stats[p.key].doneWeek || stats[p.key].secs));
  const noOwner = stats['__none__'];

  const totals = Object.entries(stats).filter(([k]) => !selected || k === selected).reduce((a, [, s]) => ({
    late: a.late + s.late, soon: a.soon + s.soon, review: a.review + s.review, changes: a.changes + s.changes, doneWeek: a.doneWeek + s.doneWeek,
  }), { late: 0, soon: 0, review: 0, changes: 0, doneWeek: 0 });
  const maxSecs = Math.max(1, ...cardPeople.map(p => stats[p.key]?.secs || 0));
  const maxClient = Math.max(1, ...hoursByClient.map(([, v]) => v));
  const SECTION = 'text-[9px] uppercase tracking-[0.15em] font-bold text-gray-400';

  const KPIS: { key: 'late' | 'soon' | 'review' | 'changes'; label: string; value: number; icon: any; tone: string; num: string }[] = [
    { key: 'late', label: 'Atrasadas', value: totals.late, icon: AlertTriangle, tone: 'bg-rose-50 text-rose-600', num: totals.late ? 'text-rose-600' : 'text-brand-dark' },
    { key: 'soon', label: 'Vencem hoje ou amanhã', value: totals.soon, icon: CalendarClock, tone: 'bg-amber-50 text-amber-600', num: totals.soon ? 'text-amber-600' : 'text-brand-dark' },
    { key: 'review', label: 'Entregues, em revisão', value: totals.review, icon: Eye, tone: 'bg-blue-50 text-blue-600', num: 'text-brand-dark' },
    { key: 'changes', label: 'Em alteração', value: totals.changes, icon: Pencil, tone: 'bg-orange-50 text-orange-600', num: 'text-brand-dark' },
  ];

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark">Pessoas e prazos</h2>
          <p className="text-sm text-gray-500 mt-1">Quem está fazendo o quê, o que atrasou e quem precisa ser cobrado. Rotinas que se repetem ficam em Tarefas.</p>
        </div>
        {fronts.length > 0 && (
          <div className="flex items-center gap-1.5 p-1.5 bg-stone-100/90 rounded-[2rem] border border-black/[0.04] self-start lg:self-auto shadow-inner">
            {['', ...fronts].map(f => (
              <button key={f || 'all'} onClick={() => setFront(f)}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${front === f ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-brand-dark hover:bg-white/50'}`}>{f || 'Tudo'}</button>
            ))}
          </div>
        )}
      </div>

      {err && <p className="text-sm font-bold text-rose-600">{err}</p>}

      {loading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-gray-300" /></div> : (
        <>
          {/* Números do topo: clicar filtra a lista */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {KPIS.map(k => {
              const Icon = k.icon;
              const on = kpi === k.key;
              return (
                <button key={k.key} onClick={() => setKpi(on ? null : k.key)}
                  className={`text-left bg-white p-5 rounded-3xl border shadow-sm transition-all ${on ? 'border-brand-dark ring-1 ring-brand-dark' : 'border-black/[0.04] hover:border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={SECTION}>{k.label}</span>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${k.tone}`}><Icon size={16} /></div>
                  </div>
                  <p className={`text-3xl font-bold tabular-nums ${k.num}`}>{k.value}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{on ? 'Filtrando a lista · clique para limpar' : 'Clique para filtrar'}</p>
                </button>
              );
            })}
          </div>

          {/* Precisa de atenção */}
          <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex flex-wrap items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><AlertTriangle size={16} /></div>
              <div>
                <p className="font-bold text-brand-dark">Precisa de atenção</p>
                <p className="text-[11px] text-gray-400">Atrasadas, vencendo, em revisão ou em alteração</p>
              </div>
              <div className="ml-auto flex flex-wrap gap-1.5">
                {selected && <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-dark text-white text-[11px] font-bold">{selected === '__none__' ? 'Sem responsável' : selected} <X size={12} /></button>}
                {kpi && <button onClick={() => setKpi(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-dark text-white text-[11px] font-bold">{KPIS.find(k => k.key === kpi)?.label} <X size={12} /></button>}
              </div>
            </div>
            {attention.length === 0
              ? <div className="px-5 pb-8 pt-4 text-center"><CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2" /><p className="text-sm text-gray-500">Tudo em dia. Nada atrasado, vencendo ou esperando revisão.</p></div>
              : <ul className="divide-y divide-gray-50 border-t border-gray-50">{attention.map(row)}</ul>}
          </div>

          {others.length > 0 && !kpi && (
            <details className="group bg-white rounded-3xl border border-black/[0.04] shadow-sm overflow-hidden">
              <summary className="px-5 py-4 flex items-center gap-2 cursor-pointer list-none">
                <span className="font-bold text-brand-dark">Demais entregas em aberto</span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold">{others.length}</span>
                <ChevronDown size={16} className="ml-auto text-gray-400 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="divide-y divide-gray-50 border-t border-gray-50">{others.map(row)}</ul>
            </details>
          )}

          {/* Equipe */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-gray-400" />
              <p className="font-bold text-brand-dark">Equipe</p>
              <p className="text-[11px] text-gray-400">Clique numa pessoa para ver só as entregas dela</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cardPeople.length === 0 && <p className="text-sm text-gray-400 col-span-full bg-white rounded-3xl border border-black/[0.04] p-6">Nenhuma tarefa com responsável ainda. Ao criar ou editar uma tarefa, escolha o Responsável e o prazo.</p>}
              {cardPeople.map(p => {
                const s = stats[p.key];
                const on = selected === p.key;
                return (
                  <button key={p.key} onClick={() => setSelected(on ? null : p.key)}
                    className={`text-left bg-white rounded-3xl border shadow-sm p-5 transition-all ${on ? 'border-brand-dark ring-1 ring-brand-dark' : 'border-black/[0.04] hover:border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} size="w-10 h-10 text-base" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-brand-dark truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{p.role_label}</p>
                      </div>
                      {p.kind === 'freelancer' && <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-violet-50 text-violet-700 border border-violet-100">Freelancer</span>}
                      {s.late > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold"><AlertTriangle size={11} /> {s.late}</span>}
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-1 text-center">
                      {([['Abertas', s.open, 'text-brand-dark'], ['Atrasadas', s.late, s.late ? 'text-rose-600' : 'text-gray-300'], ['Revisão', s.review, s.review ? 'text-blue-600' : 'text-gray-300'], ['Prontas 7d', s.doneWeek, s.doneWeek ? 'text-emerald-600' : 'text-gray-300']] as [string, number, string][]).map(([l, v, c]) => (
                        <div key={l} className="rounded-xl bg-gray-50/70 py-2"><p className={`text-lg font-bold tabular-nums ${c}`}>{v}</p><p className="text-[10px] text-gray-400 leading-tight">{l}</p></div>
                      ))}
                    </div>
                    {p.kind === 'login' && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-[11px] text-gray-500"><span className="inline-flex items-center gap-1"><Timer size={12} /> Horas na semana</span><span className="font-bold text-brand-dark tabular-nums">{fmtHours(s.secs)}</span></div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-brand-dark rounded-full" style={{ width: `${(s.secs / maxSecs) * 100}%` }} /></div>
                      </div>
                    )}
                    {s.changes > 0 && <p className="mt-3 text-[11px] font-semibold text-orange-600">{s.changes} em alteração</p>}
                  </button>
                );
              })}
            </div>
            {noOwner && noOwner.open > 0 && (
              <button onClick={() => setSelected(selected === '__none__' ? null : '__none__')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${selected === '__none__' ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white text-gray-600 border-gray-200'}`}>
                {noOwner.open} {noOwner.open === 1 ? 'entrega' : 'entregas'} sem responsável{noOwner.late ? ` · ${noOwner.late} atrasadas` : ''}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Horas por cliente */}
            <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center"><Clock size={16} /></div>
                <div><p className="font-bold text-brand-dark">Horas por cliente</p><p className="text-[11px] text-gray-400">Cronômetro dos últimos 30 dias</p></div>
              </div>
              {hoursByClient.length === 0
                ? <p className="text-sm text-gray-400">Ainda sem horas. Use o cronômetro (play) nas Tarefas: ele registra quem trabalhou.</p>
                : <ul className="space-y-3">{hoursByClient.map(([c, v]) => (
                  <li key={c}>
                    <div className="flex items-center justify-between text-sm"><span className="text-gray-700 truncate">{c}</span><span className="tabular-nums font-bold text-brand-dark shrink-0 ml-3">{fmtHours(v)}</span></div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${(v / maxClient) * 100}%` }} /></div>
                  </li>))}</ul>}
            </div>

            {/* Freelancers */}
            <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><UserPlus size={16} /></div>
                <div><p className="font-bold text-brand-dark">Freelancers e parceiros</p><p className="text-[11px] text-gray-400">Sem login na Bolsa</p></div>
                <button onClick={() => setEditing({ name: '', role_label: '', whatsapp: '', is_active: true })}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-dark text-white text-xs font-bold"><Plus size={13} /> Adicionar</button>
              </div>
              {freelancers.length === 0
                ? <p className="text-sm text-gray-400">Cadastre o video maker, designer etc. com o WhatsApp: eles aparecem como Responsável nas tarefas e o botão Cobrar abre a conversa.</p>
                : <ul className="divide-y divide-gray-50">{freelancers.map(f => (
                  <li key={f.id} className={`py-2.5 flex items-center gap-3 ${f.is_active ? '' : 'opacity-50'}`}>
                    <Avatar name={f.name} size="w-8 h-8 text-xs" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-brand-dark truncate">{f.name}{!f.is_active && <span className="text-gray-400 font-medium"> · inativo</span>}</span>
                      <span className="block text-[11px] text-gray-400 truncate">{f.role_label || 'Sem função'} · {f.whatsapp || 'sem WhatsApp'}</span>
                    </span>
                    <button onClick={() => setEditing({ ...f })} className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-brand-dark"><Pencil size={14} /></button>
                  </li>))}</ul>}
            </div>
          </div>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setEditing(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-brand-dark text-lg">{editing.id ? 'Editar freelancer' : 'Novo freelancer ou parceiro'}</h3>
              <button onClick={() => setEditing(null)} className="p-2 rounded-xl hover:bg-gray-50 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Nome</label>
                <input autoFocus value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className={field} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Função</label>
                <input value={editing.role_label || ''} onChange={e => setEditing({ ...editing, role_label: e.target.value })} placeholder="Ex.: video maker, designer" className={field} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">WhatsApp</label>
                <input value={editing.whatsapp || ''} onChange={e => setEditing({ ...editing, whatsapp: e.target.value })} placeholder="Com DDD (ou +DDI de fora)" className={field} inputMode="tel" /></div>
              {editing.id && (
                <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" className="accent-brand-dark" checked={editing.is_active ?? true} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} /> Ativo (aparece como responsável)</label>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancelar</button>
              <button onClick={saveFreelancer} className="flex-1 py-3 bg-brand-dark text-white rounded-xl text-sm font-bold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

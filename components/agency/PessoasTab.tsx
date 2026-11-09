import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Loader2, MessageCircle, Plus, Pencil, X, Check, AlertTriangle, Clock, UserPlus, Copy } from 'lucide-react';
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
        map.set(name, { key: name, name, user_id: x.user_id, whatsapp: x.contact_whatsapp || null, role_label: x.role === 'master' ? 'Sócio' : x.role === 'partner' ? 'Sócio' : 'Equipe', kind: 'login' });
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
    if (!t.due_date) return { text: 'sem prazo', cls: 'text-gray-400' };
    const d = dayjs(t.due_date);
    const diff = d.diff(dayjs().startOf('day'), 'day');
    if (diff < 0) return { text: `atrasada ${-diff} ${-diff === 1 ? 'dia' : 'dias'} (${d.format('DD/MM')})`, cls: 'text-rose-600 font-semibold' };
    if (diff === 0) return { text: 'vence hoje', cls: 'text-amber-600 font-semibold' };
    if (diff === 1) return { text: 'vence amanhã', cls: 'text-amber-600' };
    return { text: `até ${d.format('DD/MM')}`, cls: 'text-gray-500' };
  };

  const row = (t: Task) => {
    const due = dueLabel(t);
    const p = personByName(t.assignee_name);
    const st = stageInfo(t.stage);
    return (
      <li key={t.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{t.title}</p>
          <p className="text-xs text-gray-500 flex flex-wrap items-center gap-x-1.5">
            <span className="font-medium text-gray-700">{t.assignee_name || 'Sem responsável'}</span>
            {t.client?.name && <span>· {t.client.name}</span>}
            {t.front && <span>· {t.front}</span>}
            <span className={due.cls}>· {due.text}</span>
            {t.last_nudged_at && <span className="text-gray-400">· cobrado {dayjs(t.last_nudged_at).format('DD/MM HH:mm')}{(t.nudge_count || 0) > 1 ? ` (${t.nudge_count}x)` : ''}</span>}
            {st && t.stage_changed_at && (t.stage === 'entregue' || t.stage === 'alteracao') && <span className="text-gray-400">· {st.short.toLowerCase()} desde {dayjs(t.stage_changed_at).format('DD/MM')}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select value={t.stage || ''} onChange={e => setStage(t, e.target.value)}
            className={`text-xs font-semibold rounded-lg border px-2 py-1.5 ${st ? st.cls : 'bg-white text-gray-500 border-gray-200'}`}>
            <option value="">Sem etapa</option>
            {TASK_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {t.assignee_name && (
            <button onClick={() => nudge(t)} title={waNumber(p?.whatsapp) ? 'Abrir WhatsApp com a mensagem pronta' : 'Sem WhatsApp cadastrado: copia a mensagem'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
              {copied === t.id ? <><Check size={13} /> Copiada</> : waNumber(p?.whatsapp) ? <><MessageCircle size={13} /> Cobrar</> : <><Copy size={13} /> Cobrar</>}
            </button>
          )}
        </div>
      </li>
    );
  };

  const field = 'px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 w-full';
  const cardPeople = people.filter(p => stats[p.key] && (stats[p.key].open || stats[p.key].doneWeek || stats[p.key].secs));
  const noOwner = stats['__none__'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pessoas e prazos</h2>
          <p className="text-sm text-gray-500">Quem está fazendo o quê, o que atrasou e quem precisa ser cobrado. Rotinas que se repetem ficam só em Tarefas.</p>
        </div>
        {fronts.length > 0 && (
          <div className="inline-flex p-1 rounded-xl bg-gray-100 self-start">
            {['', ...fronts].map(f => <button key={f || 'all'} onClick={() => setFront(f)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${front === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>{f || 'Tudo'}</button>)}
          </div>
        )}
      </div>

      {err && <p className="text-sm text-rose-600">{err}</p>}

      {loading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-gray-300" /></div> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cardPeople.length === 0 && <p className="text-sm text-gray-400 col-span-full">Nenhuma tarefa com responsável ainda. Ao criar ou editar uma tarefa, escolha o Responsável e o prazo.</p>}
            {cardPeople.map(p => {
              const s = stats[p.key];
              const on = selected === p.key;
              return (
                <button key={p.key} onClick={() => setSelected(on ? null : p.key)}
                  className={`text-left bg-white rounded-2xl border p-4 transition-all ${on ? 'border-gray-900 ring-2 ring-gray-900/10' : 'border-gray-100 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">{p.name.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-400">{p.role_label}{p.kind === 'login' ? ` · ${fmtHours(s.secs)} na semana` : ''}</p>
                    </div>
                    {s.late > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold"><AlertTriangle size={11} /> {s.late}</span>}
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1 text-center">
                    {[['Em aberto', s.open, 'text-gray-900'], ['Atrasadas', s.late, s.late ? 'text-rose-600' : 'text-gray-300'], ['Hoje/amanhã', s.soon, s.soon ? 'text-amber-600' : 'text-gray-300'], ['Prontas 7d', s.doneWeek, 'text-emerald-600']].map(([l, v, c]) => (
                      <div key={l as string}><p className={`text-lg font-bold tabular-nums ${c}`}>{v as number}</p><p className="text-[10px] text-gray-400 leading-tight">{l}</p></div>
                    ))}
                  </div>
                  {(s.review > 0 || s.changes > 0) && <p className="mt-2 text-[11px] text-gray-500">{s.review > 0 && <>{s.review} em revisão </>}{s.changes > 0 && <span className="text-orange-600">· {s.changes} em alteração</span>}</p>}
                </button>
              );
            })}
          </div>
          {noOwner && noOwner.open > 0 && (
            <button onClick={() => setSelected(selected === '__none__' ? null : '__none__')} className={`text-sm ${selected === '__none__' ? 'font-bold text-gray-900' : 'text-gray-500'} underline-offset-2 hover:underline`}>
              {noOwner.open} {noOwner.open === 1 ? 'entrega' : 'entregas'} sem responsável{noOwner.late ? ` (${noOwner.late} atrasadas)` : ''}
            </button>
          )}

          <div className="bg-white rounded-2xl border border-gray-100">
            <div className="px-5 pt-4 pb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <p className="text-sm font-bold text-gray-900">Precisa de atenção{selected ? ` · ${selected === '__none__' ? 'sem responsável' : selected}` : ''}</p>
              {selected && <button onClick={() => setSelected(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-900">Ver todos</button>}
            </div>
            {attention.length === 0 ? <p className="px-5 pb-5 text-sm text-gray-400">Nada atrasado, vencendo ou esperando revisão.</p> : <ul className="divide-y divide-gray-50">{attention.map(row)}</ul>}
          </div>

          {others.length > 0 && (
            <details className="bg-white rounded-2xl border border-gray-100">
              <summary className="px-5 py-4 text-sm font-bold text-gray-900 cursor-pointer">Demais entregas em aberto ({others.length})</summary>
              <ul className="divide-y divide-gray-50 border-t border-gray-50">{others.map(row)}</ul>
            </details>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-5 pt-4 pb-2 flex items-center gap-2"><Clock size={16} className="text-gray-400" /><p className="text-sm font-bold text-gray-900">Horas de cronômetro por cliente (30 dias)</p></div>
              {hoursByClient.length === 0
                ? <p className="px-5 pb-5 text-sm text-gray-400">Ainda sem horas. Use o cronômetro (play) nas Tarefas: agora ele registra quem trabalhou.</p>
                : <ul className="divide-y divide-gray-50">{hoursByClient.map(([c, s]) => <li key={c} className="px-5 py-2.5 flex text-sm"><span className="flex-1 text-gray-700">{c}</span><span className="tabular-nums font-semibold text-gray-900">{fmtHours(s)}</span></li>)}</ul>}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-5 pt-4 pb-2 flex items-center gap-2">
                <UserPlus size={16} className="text-gray-400" /><p className="text-sm font-bold text-gray-900">Freelancers e parceiros (sem login)</p>
                <button onClick={() => setEditing({ name: '', role_label: '', whatsapp: '', is_active: true })} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"><Plus size={13} /> Adicionar</button>
              </div>
              {freelancers.length === 0
                ? <p className="px-5 pb-5 text-sm text-gray-400">Cadastre o video maker, designer etc. com o WhatsApp: eles aparecem como Responsável nas tarefas e o botão Cobrar abre a conversa.</p>
                : <ul className="divide-y divide-gray-50">{freelancers.map(f => (
                  <li key={f.id} className={`px-5 py-2.5 flex items-center gap-3 text-sm ${f.is_active ? '' : 'opacity-50'}`}>
                    <span className="flex-1 min-w-0"><b className="text-gray-900">{f.name}</b>{f.role_label && <span className="text-gray-500"> · {f.role_label}</span>}{!f.is_active && <span className="text-gray-400"> · inativo</span>}</span>
                    <span className="text-xs text-gray-400">{f.whatsapp || 'sem WhatsApp'}</span>
                    <button onClick={() => setEditing({ ...f })} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><Pencil size={13} /></button>
                  </li>))}</ul>}
            </div>
          </div>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setEditing(null)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center"><p className="font-bold text-gray-900">{editing.id ? 'Editar pessoa' : 'Nova pessoa sem login'}</p><button onClick={() => setEditing(null)} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button></div>
            <input autoFocus value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Nome" className={field} />
            <input value={editing.role_label || ''} onChange={e => setEditing({ ...editing, role_label: e.target.value })} placeholder="Função (ex.: video maker, designer)" className={field} />
            <input value={editing.whatsapp || ''} onChange={e => setEditing({ ...editing, whatsapp: e.target.value })} placeholder="WhatsApp com DDD (ou +DDI de fora)" className={field} inputMode="tel" />
            {editing.id && (
              <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={editing.is_active ?? true} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} /> Ativo (aparece como responsável)</label>
            )}
            <button onClick={saveFreelancer} className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">Salvar</button>
          </div>
        </div>
      )}
    </div>
  );
};

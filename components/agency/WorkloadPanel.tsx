import React, { useEffect, useMemo, useState } from 'react';
import { Gauge, Clock, AlertTriangle, CalendarDays, Loader2 } from 'lucide-react';
import { supabase, useAuth } from '../../lib/supabase';
import { isTaskPendingInCurrentCycle } from '../../lib/tasks';

/**
 * Carga de trabalho da semana:
 * - por pessoa: tarefas que vencem na semana, atrasadas, posts da semana dos clientes que ela cuida e horas registradas no modo foco;
 * - por cliente (últimos 30 dias): horas gastas x valor do contrato (quanto rende cada hora).
 */
const fmtH = (s: number) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m}min`; };

export const WorkloadPanel: React.FC = () => {
  const { agencyId } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!agencyId) return;
    (async () => {
      const now = new Date(); const dow = (now.getDay() + 6) % 7;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const [m, t, s, c, p] = await Promise.all([
        supabase.from('agency_members').select('user_id, display_name, role').eq('agency_id', agencyId).eq('is_active', true),
        supabase.from('agency_tasks').select('id, title, status, due_date, assignee_user_id, assignee_name, recurrence_type, recurrence_days, completed_at, client_id').eq('agency_id', agencyId),
        supabase.from('task_sessions').select('task_id, user_id, started_at, duration_seconds').eq('agency_id', agencyId).gte('started_at', since30),
        supabase.from('clients').select('id, name, base_value, currency, team_owners, client_status, is_internal').eq('agency_id', agencyId).eq('client_status', 'active'),
        supabase.from('posts').select('id, client_id, date_key, status').eq('agency_id', agencyId).in('status', ['draft', 'pending_approval', 'changes_requested', 'approved', 'scheduled', 'theme_pending']),
      ]);
      const members = (m.data as any[]) || []; const tasks = (t.data as any[]) || []; const sess = (s.data as any[]) || []; const clients = (c.data as any[]) || []; const posts = (p.data as any[]) || [];
      const weekStartTs = monday.toISOString();
      const postDate = (dk: string) => { const x = /(\d{2})-(\d{2})-(\d{4})/.exec(dk || ''); return x ? `${x[3]}-${x[2]}-${x[1]}` : ''; };
      const weekPosts = posts.filter(pp => { const d = postDate(pp.date_key); return d >= iso(monday) && d <= iso(sunday); });
      const people = members.map(mb => {
        const mine = tasks.filter(x => x.assignee_user_id === mb.user_id);
        const open = mine.filter(x => isTaskPendingInCurrentCycle(x));
        const dueWeek = open.filter(x => x.due_date && x.due_date >= iso(monday) && x.due_date <= iso(sunday)).length;
        const overdue = open.filter(x => (!x.recurrence_type || x.recurrence_type === 'none') && x.due_date && x.due_date < iso(now)).length;
        const ownedClients = clients.filter(cl => Object.values(cl.team_owners || {}).includes(mb.user_id)).map(cl => cl.id);
        const postsWeek = weekPosts.filter(pp => ownedClients.includes(pp.client_id)).length;
        const secsWeek = sess.filter(x => x.user_id === mb.user_id && x.started_at >= weekStartTs).reduce((a, x) => a + (x.duration_seconds || 0), 0);
        return { ...mb, open: open.length, dueWeek, overdue, postsWeek, secsWeek, owned: ownedClients.length };
      });
      const taskClient = new Map(tasks.map(x => [x.id, x.client_id]));
      const perClient = clients.filter(cl => !cl.is_internal).map(cl => {
        const secs = sess.filter(x => taskClient.get(x.task_id) === cl.id).reduce((a, x) => a + (x.duration_seconds || 0), 0);
        return { ...cl, secs, perHour: secs > 600 && cl.base_value ? Number(cl.base_value) / (secs / 3600) : null };
      }).sort((a, b) => b.secs - a.secs);
      setData({ people, perClient, range: `${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` });
    })();
  }, [agencyId]);

  const max = useMemo(() => Math.max(1, ...((data?.people || []).map((p: any) => p.open))), [data]);
  if (!data) return <div className="py-8 text-center text-gray-400"><Loader2 className="animate-spin inline" /></div>;
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between"><h3 className="text-lg font-bold text-brand-dark flex items-center gap-2"><Gauge size={18} /> Carga da semana <span className="text-sm font-medium text-gray-400">{data.range}</span></h3></div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {data.people.map((p: any) => (
          <div key={p.user_id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between"><span className="font-semibold text-gray-900">{p.display_name}</span><span className="text-[10px] uppercase tracking-widest text-gray-400">{p.role}</span></div>
            <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full ${p.open / max > 0.75 ? 'bg-rose-500' : p.open / max > 0.4 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${(p.open / max) * 100}%` }} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <span>{p.open} tarefa(s) aberta(s)</span>
              <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {p.dueWeek} vence(m) na semana</span>
              <span className={`inline-flex items-center gap-1 ${p.overdue ? 'text-rose-600 font-semibold' : ''}`}><AlertTriangle size={12} /> {p.overdue} atrasada(s)</span>
              <span className="inline-flex items-center gap-1"><Clock size={12} /> {fmtH(p.secsWeek)} no modo foco</span>
              {p.owned > 0 && <span className="col-span-2">{p.postsWeek} post(s) na semana de {p.owned} cliente(s) que cuida</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">Tempo por cliente · últimos 30 dias <span className="font-normal text-gray-400">(do modo foco, em tarefas ligadas ao cliente)</span></div>
        <div className="divide-y divide-gray-100">
          {data.perClient.map((c: any) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="flex-1 font-medium text-gray-800">{c.name}</span>
              <span className="text-gray-600 w-20 text-right">{c.secs ? fmtH(c.secs) : '—'}</span>
              <span className="text-gray-500 w-44 text-right">{c.perHour ? `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: c.currency || 'BRL', maximumFractionDigits: 0 }).format(c.perHour)} por hora` : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

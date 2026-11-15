import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Users, CalendarDays, ClipboardList, Kanban, Sparkles, FileBarChart, CornerDownLeft, Loader2 } from 'lucide-react';
import { supabase, useAuth } from '../lib/supabase';

/**
 * Busca geral da equipe (⌘K / Ctrl+K): clientes, posts, tarefas, leads da agência, propostas e relatórios.
 * Enter abre o resultado; ↑ ↓ navegam; Esc fecha.
 */
type Hit = { kind: 'client' | 'post' | 'task' | 'lead' | 'proposal' | 'report'; id: string; title: string; sub?: string; client?: any; token?: string };
const ICON = { client: Users, post: CalendarDays, task: ClipboardList, lead: Kanban, proposal: Sparkles, report: FileBarChart };
const LABEL = { client: 'Cliente', post: 'Post', task: 'Tarefa', lead: 'Lead', proposal: 'Proposta', report: 'Relatório' };

export const GlobalSearch: React.FC<{ onOpenClient: (c: any, view?: string) => void; onOpenAgencyTab: (tab: string) => void }> = ({ onOpenClient, onOpenAgencyTab }) => {
  const { agencyId, userRole, userType } = useAuth() as any;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const enabled = userRole === 'admin' && userType !== 'client';

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); }
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
  useEffect(() => { if (open) { setTimeout(() => inputRef.current?.focus(), 30); } else { setQ(''); setHits([]); } }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2 || !agencyId) { setHits([]); return; }
    const like = `%${term.replace(/[%_]/g, '')}%`;
    setLoading(true);
    const tm = setTimeout(async () => {
      const [cl, po, ta, le, pr] = await Promise.all([
        supabase.from('clients').select('*').eq('agency_id', agencyId).ilike('name', like).limit(6),
        supabase.from('posts').select('id, date_key, theme, theme_title, status, client_id, clients:client_id(*)').eq('agency_id', agencyId).neq('status', 'deleted').or(`theme.ilike.${like},theme_title.ilike.${like},caption.ilike.${like}`).limit(8),
        supabase.from('agency_tasks').select('id, title, status, assignee_name, due_date').eq('agency_id', agencyId).ilike('title', like).limit(6),
        supabase.from('agency_leads').select('id, name, stage').eq('agency_id', agencyId).ilike('name', like).limit(5),
        supabase.from('proposals').select('id, slug, prospect_name, title, status').eq('agency_id', agencyId).or(`prospect_name.ilike.${like},title.ilike.${like}`).limit(5),
      ]);
      const out: Hit[] = [];
      ((cl.data as any[]) || []).forEach(c => out.push({ kind: 'client', id: c.id, title: c.name, sub: c.segment || c.client_status, client: c }));
      ((po.data as any[]) || []).forEach(p => { const m = /(\d{2})-(\d{2})-(\d{4})/.exec(p.date_key || ''); out.push({ kind: 'post', id: p.id, title: p.theme_title || p.theme || 'Post', sub: `${p.clients?.name || ''}${m ? ` · ${m[1]}/${m[2]}/${m[3]}` : ''} · ${p.status}`, client: p.clients }); });
      ((ta.data as any[]) || []).forEach(t => out.push({ kind: 'task', id: t.id, title: t.title, sub: [t.assignee_name, t.status === 'completed' ? 'concluída' : 'pendente', t.due_date].filter(Boolean).join(' · ') }));
      ((le.data as any[]) || []).forEach(l => out.push({ kind: 'lead', id: l.id, title: l.name, sub: l.stage }));
      ((pr.data as any[]) || []).forEach(p => out.push({ kind: 'proposal', id: p.id, title: p.prospect_name || p.title, sub: `${p.title || ''} · ${p.status}` }));
      setHits(out); setSel(0); setLoading(false);
    }, 220);
    return () => clearTimeout(tm);
  }, [q, open, agencyId]);

  const go = (h: Hit) => {
    setOpen(false);
    if (h.kind === 'client') onOpenClient(h.client, 'dashboard');
    else if (h.kind === 'post' && h.client) onOpenClient(h.client, 'month-detail');
    else if (h.kind === 'task') onOpenAgencyTab('tasks');
    else if (h.kind === 'lead') onOpenAgencyTab('prospeccao');
    else if (h.kind === 'proposal') onOpenAgencyTab('propostas');
  };

  const grouped = useMemo(() => hits, [hits]);
  if (!enabled) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-[60] hidden md:inline-flex items-center gap-2 pl-3 pr-2 py-2 rounded-2xl bg-white/90 backdrop-blur border border-black/[0.06] shadow-lg text-sm text-stone-500 hover:text-stone-800">
        <Search size={15} /> Buscar <kbd className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-500">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] bg-stone-950/40 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-3" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-black/[0.06] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
              {loading ? <Loader2 size={18} className="text-stone-400 animate-spin" /> : <Search size={18} className="text-stone-400" />}
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente, post, tarefa, lead ou proposta…"
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(grouped.length - 1, s + 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
                  else if (e.key === 'Enter' && grouped[sel]) go(grouped[sel]);
                }}
                className="flex-1 bg-transparent outline-none text-[15px] text-stone-800 placeholder:text-stone-400" />
              <kbd className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-500">Esc</kbd>
            </div>
            <div className="max-h-[55vh] overflow-y-auto py-2">
              {q.trim().length < 2 ? <p className="px-5 py-6 text-sm text-stone-400">Digite pelo menos 2 letras.</p>
                : !loading && grouped.length === 0 ? <p className="px-5 py-6 text-sm text-stone-400">Nada encontrado.</p>
                : grouped.map((h, i) => { const Icon = ICON[h.kind]; return (
                  <button key={h.kind + h.id} onMouseEnter={() => setSel(i)} onClick={() => go(h)} className={`w-full flex items-center gap-3 px-5 py-2.5 text-left ${i === sel ? 'bg-stone-100/80' : ''}`}>
                    <span className="w-8 h-8 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center shrink-0"><Icon size={15} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-stone-800 truncate">{h.title}</span>{h.sub && <span className="block text-xs text-stone-400 truncate">{h.sub}</span>}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{LABEL[h.kind]}</span>
                    {i === sel && <CornerDownLeft size={14} className="text-stone-400" />}
                  </button>
                ); })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

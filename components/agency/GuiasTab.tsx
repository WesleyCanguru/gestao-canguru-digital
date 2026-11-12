import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Copy, Eye, Loader2, MessageCircle, Plus, RotateCcw, Sparkles, X, History, BookOpen, Check } from 'lucide-react';
import { callFunction, supabase, useAuth } from '../../lib/supabase';
import { getAppUrl } from '../../lib/appUrl';

type Guide = { id: string; slug: string; title: string; audience: 'socio' | 'cliente' | 'equipe'; language: 'pt' | 'en' | 'es'; services: string[]; version: number; is_published: boolean; updated_at: string };
type Version = { id: string; version: number; instructions: string | null; created_at: string };

const AUDIENCE: Record<string, string> = { socio: 'Sócios', cliente: 'Clientes', equipe: 'Equipe' };
const LANG: Record<string, string> = { pt: 'Português', en: 'Inglês', es: 'Espanhol' };
const SERVICES = ['Tráfego Pago', 'Social Media', 'Website', 'CRM'];

/** Operação › Guias: páginas com link próprio (/g/<nome>) para sócios e clientes. Mudanças são pedidas ao Claude. */
export const GuiasTab: React.FC = () => {
  const { agencyId } = useAuth();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'socio' | 'cliente' | 'equipe'>('todos');
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<Guide | null>(null);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<{ guide: Guide; versions: Version[] } | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', audience: 'cliente', language: 'pt', services: [] as string[], brief: '' });

  const load = async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data } = await supabase.from('guides').select('id, slug, title, audience, language, services, version, is_published, updated_at').eq('agency_id', agencyId).order('updated_at', { ascending: false });
    setGuides((data as Guide[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [agencyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkOf = (g: Guide) => `${getAppUrl()}/g/${g.slug}`;
  const copy = async (g: Guide) => { try { await navigator.clipboard.writeText(linkOf(g)); setCopied(g.id); setTimeout(() => setCopied(null), 1800); } catch { /* ignora */ } };
  const wa = (g: Guide) => `https://wa.me/?text=${encodeURIComponent(`${g.title}: ${linkOf(g)}`)}`;

  const revise = async () => {
    if (!editing || !instructions.trim()) return;
    setBusy(true); setErr(null);
    const { error } = await callFunction('guide-edit', { action: 'revise', guide_id: editing.id, instructions });
    setBusy(false);
    if (error) { setErr(error); return; }
    setEditing(null); setInstructions(''); load();
  };
  const openHistory = async (g: Guide) => {
    const { data } = await supabase.from('guide_versions').select('id, version, instructions, created_at').eq('guide_id', g.id).order('version', { ascending: false });
    setHistory({ guide: g, versions: (data as Version[]) || [] });
  };
  const restore = async (v: Version) => {
    if (!history) return;
    setBusy(true); setErr(null);
    const { error } = await callFunction('guide-edit', { action: 'restore', guide_id: history.guide.id, version_id: v.id });
    setBusy(false);
    if (error) { setErr(error); return; }
    setHistory(null); load();
  };
  const togglePublished = async (g: Guide) => {
    await supabase.from('guides').update({ is_published: !g.is_published, updated_at: new Date().toISOString() }).eq('id', g.id);
    load();
  };
  const create = async () => {
    setBusy(true); setErr(null);
    const { error } = await callFunction('guide-edit', { action: 'create', agency_id: agencyId, ...draft });
    setBusy(false);
    if (error) { setErr(error); return; }
    setCreating(false); setDraft({ title: '', audience: 'cliente', language: 'pt', services: [], brief: '' }); load();
  };

  const shown = guides.filter(g => filter === 'todos' || g.audience === filter);
  const counts = { todos: guides.length, socio: guides.filter(g => g.audience === 'socio').length, cliente: guides.filter(g => g.audience === 'cliente').length, equipe: guides.filter(g => g.audience === 'equipe').length };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Guias</h2>
          <p className="text-sm text-gray-500 mt-1">Páginas que explicam a Bolsa para sócios e clientes. Cada uma tem um link para mandar a quem quiser.</p>
        </div>
        <button type="button" onClick={() => { setCreating(true); setErr(null); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold">
          <Plus size={16} /> Novo guia
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['todos', 'socio', 'cliente', 'equipe'] as const).map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border ${filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {f === 'todos' ? 'Todos' : AUDIENCE[f]} <span className="opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : !shown.length ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Nenhum guia aqui ainda.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map(g => (
            <div key={g.id} className="rounded-2xl border border-gray-100 bg-white p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF2F8] text-[#456DA1] flex items-center justify-center shrink-0"><BookOpen size={18} /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 leading-snug">{g.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    <span className="px-2 py-0.5 rounded-full bg-gray-900 text-white">{AUDIENCE[g.audience]}</span>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{LANG[g.language]}</span>
                    {g.services?.map(s => <span key={s} className="px-2 py-0.5 rounded-full bg-[#EEF2F8] text-[#456DA1]">{s}</span>)}
                    {!g.is_published && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Fora do ar</span>}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">Versão {g.version} · atualizado {dayjs(g.updated_at).format('DD/MM HH:mm')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                <span className="truncate flex-1">{linkOf(g)}</span>
                <button type="button" onClick={() => copy(g)} className="inline-flex items-center gap-1 font-semibold text-gray-700 shrink-0">
                  {copied === g.id ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`/g/${g.slug}?preview`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"><Eye size={15} /> Ver</a>
                <a href={wa(g)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"><MessageCircle size={15} /> WhatsApp</a>
                <button type="button" onClick={() => { setEditing(g); setInstructions(''); setErr(null); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#13284D] text-white text-sm font-semibold"><Sparkles size={15} /> Pedir mudança ao Claude</button>
                <button type="button" onClick={() => openHistory(g)} title="Versões anteriores" aria-label="Versões anteriores" className="inline-flex items-center px-2.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><History size={15} /></button>
                <button type="button" onClick={() => togglePublished(g)} className="ml-auto text-xs font-semibold text-gray-500 hover:text-gray-800">{g.is_published ? 'Tirar do ar' : 'Colocar no ar'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !busy && setEditing(null)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-bold text-gray-900">Pedir mudança ao Claude</p><p className="text-sm text-gray-500 mt-0.5">{editing.title}</p></div>
              <button type="button" aria-label="Fechar" onClick={() => !busy && setEditing(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">O que mudar?</span>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={5} autoFocus
                placeholder="Ex.: no passo do funil, explique melhor o que é o contador vermelho. Tire a parte de O que ainda vem."
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#456DA1]/30" />
            </label>
            <p className="text-xs text-gray-400">A mudança vai direto para o link. A versão de agora fica guardada e dá para voltar.</p>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={busy} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Cancelar</button>
              <button type="button" onClick={revise} disabled={busy || !instructions.trim()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#13284D] text-white text-sm font-semibold disabled:opacity-50">
                {busy ? <><Loader2 size={15} className="animate-spin" /> O Claude está mudando…</> : <><Sparkles size={15} /> Aplicar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {history && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !busy && setHistory(null)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-bold text-gray-900">Versões anteriores</p><p className="text-sm text-gray-500 mt-0.5">{history.guide.title} · agora na versão {history.guide.version}</p></div>
              <button type="button" aria-label="Fechar" onClick={() => setHistory(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            {!history.versions.length ? <p className="text-sm text-gray-500">Nenhuma versão anterior ainda.</p> : (
              <ul className="space-y-2">
                {history.versions.map(v => (
                  <li key={v.id} className="rounded-xl border border-gray-100 p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Versão {v.version} · {dayjs(v.created_at).format('DD/MM HH:mm')}</p>
                      {v.instructions && <p className="text-xs text-gray-500 mt-0.5">Depois dela: {v.instructions}</p>}
                    </div>
                    <button type="button" onClick={() => restore(v)} disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold text-[#456DA1] shrink-0"><RotateCcw size={13} /> Voltar para esta</button>
                  </li>
                ))}
              </ul>
            )}
            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !busy && setCreating(false)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-bold text-gray-900">Novo guia</p><p className="text-sm text-gray-500 mt-0.5">O Claude escreve o primeiro rascunho. Os prints entram depois.</p></div>
              <button type="button" aria-label="Fechar" onClick={() => !busy && setCreating(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <label className="block"><span className="text-sm font-semibold text-gray-700">Título</span>
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Ex.: Como usar a Bolsa: só tráfego" className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-sm font-semibold text-gray-700">Para quem</span>
                <select value={draft.audience} onChange={e => setDraft({ ...draft, audience: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white">
                  <option value="cliente">Clientes</option><option value="socio">Sócios</option><option value="equipe">Equipe</option>
                </select></label>
              <label className="block"><span className="text-sm font-semibold text-gray-700">Idioma</span>
                <select value={draft.language} onChange={e => setDraft({ ...draft, language: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white">
                  <option value="pt">Português</option><option value="en">Inglês</option>
                </select></label>
            </div>
            <div><span className="text-sm font-semibold text-gray-700">Serviços do pacote</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {SERVICES.map(s => {
                  const on = draft.services.includes(s);
                  return <button key={s} type="button" onClick={() => setDraft({ ...draft, services: on ? draft.services.filter(x => x !== s) : [...draft.services, s] })}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${on ? 'bg-[#13284D] text-white border-[#13284D]' : 'bg-white text-gray-600 border-gray-200'}`}>{s}</button>;
                })}
              </div></div>
            <label className="block"><span className="text-sm font-semibold text-gray-700">O que o guia deve explicar</span>
              <textarea value={draft.brief} onChange={e => setDraft({ ...draft, brief: e.target.value })} rows={5}
                placeholder="Ex.: para o cliente que contratou só tráfego: como ver o dashboard, a estratégia, aprovar os criativos e acompanhar os leads no CRM."
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm" /></label>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} disabled={busy} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Cancelar</button>
              <button type="button" onClick={create} disabled={busy || !draft.title.trim() || !draft.brief.trim()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#13284D] text-white text-sm font-semibold disabled:opacity-50">
                {busy ? <><Loader2 size={15} className="animate-spin" /> O Claude está escrevendo…</> : <><Sparkles size={15} /> Criar guia</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

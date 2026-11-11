import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Check, ChevronLeft, ChevronRight, LayoutGrid, PlayCircle, Pencil, RotateCcw, Images, Film, Image as ImageIcon,
  PartyPopper, AlertCircle, Eye, Keyboard,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  CreativeBatch, CreativeItem, CreativeKind, CreativeStatus, KIND_LABEL, KIND_LABEL_PLURAL, STATUS_LABEL, STATUS_STYLE,
  counts as countItems, signMedia, getReviewerName, setReviewerName,
} from '../../lib/creatives';
import { CreativeStage, CreativeThumb } from './CreativeMedia';

type Mode = 'client' | 'public' | 'preview';
type Stage = 'intro' | 'grid' | 'focus' | 'done';

const QUICK_FIXES = ['Trocar a imagem', 'Ajustar o texto da arte', 'Ajustar a legenda', 'Mudar as cores', 'Trocar a chamada (CTA)'];
const KIND_ICON: Record<CreativeKind, any> = { image: ImageIcon, carousel: Images, video: Film };

interface Props {
  batchId?: string;
  token?: string;
  mode: Mode;
  clientName?: string;
  onClose?: () => void;
}

export const CreativeReviewer: React.FC<Props> = ({ batchId, token, mode, clientName, onClose }) => {
  const [batch, setBatch] = useState<CreativeBatch | null>(null);
  const [items, setItems] = useState<CreativeItem[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [cName, setCName] = useState(clientName || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<Stage>('intro');
  const [kind, setKind] = useState<CreativeKind | 'all'>('all');
  const [statusF, setStatusF] = useState<CreativeStatus | 'all'>('all');
  const [current, setCurrent] = useState<string | null>(null);
  const [name, setName] = useState(getReviewerName());
  const [asking, setAsking] = useState(false);
  const [fix, setFix] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const [finished, setFinished] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const readOnly = mode === 'preview';

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      let q = supabase.from('creative_batches').select('*');
      q = batchId ? q.eq('id', batchId) : q.eq('public_token', token || '');
      const { data: b, error: e1 } = await q.maybeSingle();
      if (!alive) return;
      if (e1 || !b) { setError('Não encontramos estes criativos.'); setLoading(false); return; }
      const { data: its } = await supabase.from('creative_items').select('*').eq('batch_id', (b as any).id).order('position').order('created_at');
      const list = ((its as CreativeItem[]) || []);
      const sig = await signMedia(list);
      if (!clientName) {
        const { data: c } = await supabase.from('clients').select('name').eq('id', (b as any).client_id).maybeSingle();
        if (alive && c) setCName((c as any).name || '');
      }
      if (!alive) return;
      setBatch(b as CreativeBatch); setItems(list); setSigned(sig); setLoading(false);
      const pend = list.filter(i => i.status === 'pending').length;
      setStage(list.length === 0 ? 'grid' : pend === 0 && mode !== 'preview' ? 'done' : 'intro');
    })();
    return () => { alive = false; };
  }, [batchId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = useMemo(() => countItems(items), [items]);
  const filtered = useMemo(() => items.filter(i => (kind === 'all' || i.kind === kind) && (statusF === 'all' || i.status === statusF)), [items, kind, statusF]);
  const idx = filtered.findIndex(i => i.id === current);
  const item = idx >= 0 ? filtered[idx] : null;
  const reviewed = c.total - c.pending;
  const pct = c.total ? Math.round((reviewed / c.total) * 100) : 0;
  const open = batch && (batch.status === 'sent' || batch.status === 'reviewed');
  const canDecide = !readOnly && !!open;

  const openFocus = (id: string) => { setCurrent(id); setAsking(false); setFix(''); setStage('focus'); };
  const startReview = () => {
    if (mode === 'public' && name.trim()) setReviewerName(name.trim());
    const firstPending = items.find(i => i.status === 'pending') || items[0];
    if (firstPending) openFocus(firstPending.id);
  };

  const go = useCallback((d: number) => {
    if (!filtered.length) return;
    const n = Math.min(filtered.length - 1, Math.max(0, idx + d));
    setCurrent(filtered[n].id); setAsking(false); setFix('');
  }, [filtered, idx]);

  const nextPendingAfter = (id: string, list: CreativeItem[]) => {
    const pos = list.findIndex(i => i.id === id);
    const after = [...list.slice(pos + 1), ...list.slice(0, pos)];
    return after.find(i => i.status === 'pending' && (kind === 'all' || i.kind === kind)) || null;
  };

  const decide = async (status: CreativeStatus, feedback?: string) => {
    if (!item || !canDecide || busy) return;
    setBusy(true);
    const { error: e } = await supabase.rpc('decide_creative', { p_item: item.id, p_status: status, p_feedback: feedback ?? null, p_name: name.trim() || null });
    setBusy(false);
    if (e) { setFlash({ text: e.message || 'Não foi possível salvar. Tente de novo.', tone: 'warn' }); return; }
    const updated = items.map(i => i.id === item.id ? { ...i, status, feedback: status === 'changes' ? (feedback || '') : status === 'approved' ? (feedback || null) : null, decided_at: status === 'pending' ? null : new Date().toISOString() } : i);
    setItems(updated);
    setAsking(false); setFix('');
    if (status === 'pending') { setFlash({ text: 'Voltou para pendente.', tone: 'ok' }); return; }
    setFlash({ text: status === 'approved' ? 'Aprovado' : 'Ajuste enviado', tone: status === 'approved' ? 'ok' : 'warn' });
    const next = nextPendingAfter(item.id, updated);
    setTimeout(() => {
      if (next) { setStatusF('all'); setCurrent(next.id); }
      else setStage('done');
    }, 450);
  };

  const finish = async () => {
    if (!batch || readOnly) return;
    setBusy(true);
    const { error: e } = await supabase.rpc('finish_creative_review', { p_batch: batch.id, p_name: name.trim() || null });
    setBusy(false);
    if (e) { setFlash({ text: 'Não foi possível concluir. Tente de novo.', tone: 'warn' }); return; }
    setBatch({ ...batch, status: 'reviewed', reviewed_at: new Date().toISOString() });
    setFinished(true);
  };

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 1600); return () => clearTimeout(t); }, [flash]);
  useEffect(() => { if (asking) setTimeout(() => textRef.current?.focus(), 50); }, [asking]);

  // Atalhos: ← → navegam, A aprova, R pede ajuste, G grade, Esc fecha o pedido
  useEffect(() => {
    if (stage !== 'focus') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') { if (e.key === 'Escape') setAsking(false); return; }
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if ((e.key === 'a' || e.key === 'A') && canDecide) decide('approved');
      else if ((e.key === 'r' || e.key === 'R') && canDecide) setAsking(true);
      else if (e.key === 'g' || e.key === 'G') setStage('grid');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-stone-400" /></div>;
  if (error || !batch) return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center">
        <AlertCircle className="mx-auto text-rose-500 mb-3" size={28} />
        <p className="font-bold text-brand-dark">{error || 'Não encontramos estes criativos.'}</p>
      </div>
    </div>
  );

  const kindTabs = (['all', 'image', 'carousel', 'video'] as const).filter(k => k === 'all' || c[k] > 0);
  const chip = (on: boolean) => `shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${on ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`;

  const Header = (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        {onClose && <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-gray-50 text-gray-500" aria-label="Voltar"><ChevronLeft size={20} /></button>}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 truncate">{cName || 'Criativos'}</p>
          <p className="font-bold text-brand-dark truncate">{batch.title}</p>
        </div>
        <div className="hidden sm:block w-44">
          <div className="flex justify-between text-[11px] text-gray-500"><span>{reviewed} de {c.total} revisados</span><span className="font-bold">{pct}%</span></div>
          <div className="h-1.5 rounded-full bg-gray-100 mt-1 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
        {stage === 'focus'
          ? <button onClick={() => setStage('grid')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700"><LayoutGrid size={14} /> <span className="hidden sm:inline">Ver todos</span></button>
          : c.total > 0 && stage !== 'intro' && <button onClick={startReview} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-dark text-white text-xs font-bold"><PlayCircle size={14} /> {c.pending ? 'Revisar' : 'Rever'}</button>}
      </div>
      <div className="sm:hidden h-1 bg-gray-100"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
      {readOnly && <div className="bg-amber-50 text-amber-800 text-xs font-bold text-center py-1.5 border-t border-amber-100 inline-flex w-full items-center justify-center gap-1.5"><Eye size={13} /> Pré-visualização da equipe: é assim que o cliente vê. Os botões não salvam.</div>}
      {!readOnly && batch.status === 'draft' && <div className="bg-gray-50 text-gray-600 text-xs font-bold text-center py-1.5 border-t">Este lote ainda não foi enviado.</div>}
      {batch.status === 'closed' && <div className="bg-gray-50 text-gray-600 text-xs font-bold text-center py-1.5 border-t">Lote encerrado pela agência. Só para consulta.</div>}
    </div>
  );

  // ---------------- Abertura ----------------
  if (stage === 'intro') {
    return (
      <div className="min-h-screen bg-[#F6F6F4]">
        {Header}
        <div className="max-w-xl mx-auto px-4 py-10 sm:py-16">
          <div className="bg-white rounded-[2rem] border border-black/[0.04] shadow-[0_20px_50px_rgba(0,0,0,0.06)] p-7 sm:p-10 text-center">
            <div className="flex justify-center -space-x-3 mb-6">
              {items.slice(0, 4).map(i => <CreativeThumb key={i.id} item={i} signed={signed} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ring-4 ring-white shadow" />)}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-dark tracking-tight">{batch.title}</h1>
            <p className="text-sm text-gray-500 mt-2">{c.total} {c.total === 1 ? 'criativo' : 'criativos'} para a sua aprovação{cName ? ` · ${cName}` : ''}</p>
            {batch.description && <p className="text-sm text-gray-600 mt-4 whitespace-pre-wrap text-left bg-gray-50 rounded-2xl p-4">{batch.description}</p>}
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {(['image', 'carousel', 'video'] as const).filter(k => c[k] > 0).map(k => {
                const Icon = KIND_ICON[k];
                return <span key={k} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100 text-xs font-bold text-gray-700"><Icon size={13} /> {c[k]} {c[k] === 1 ? KIND_LABEL[k].toLowerCase() : KIND_LABEL_PLURAL[k].toLowerCase()}</span>;
              })}
            </div>
            {canDecide && (
              <div className="mt-7 text-left space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Seu nome</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Para a agência saber quem aprovou"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-dark/20 outline-none" />
              </div>
            )}
            <div className="mt-6 grid gap-2">
              <button onClick={startReview} disabled={!c.total}
                className="w-full py-4 rounded-2xl bg-brand-dark text-white font-bold text-base inline-flex items-center justify-center gap-2 hover:bg-black disabled:opacity-50">
                <PlayCircle size={20} /> {c.pending === c.total ? 'Começar a revisão' : `Continuar (${c.pending} pendentes)`}
              </button>
              <button onClick={() => setStage('grid')} className="w-full py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-700 inline-flex items-center justify-center gap-2"><LayoutGrid size={16} /> Ver todos de uma vez</button>
            </div>
            <p className="text-[11px] text-gray-400 mt-5">Uma peça por vez: veja, toque em Aprovar ou Pedir ajuste e a próxima abre sozinha.</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Resumo final ----------------
  if (stage === 'done') {
    const changes = items.filter(i => i.status === 'changes');
    return (
      <div className="min-h-screen bg-[#F6F6F4]">
        {Header}
        <div className="max-w-xl mx-auto px-4 py-10 sm:py-14">
          <div className="bg-white rounded-[2rem] border border-black/[0.04] shadow-[0_20px_50px_rgba(0,0,0,0.06)] p-7 sm:p-10">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">{finished ? <Check size={28} /> : <PartyPopper size={28} />}</div>
              <h2 className="text-2xl font-bold text-brand-dark">{finished ? 'Pronto! A agência foi avisada.' : c.pending ? 'Quase lá' : 'Você revisou tudo'}</h2>
              <p className="text-sm text-gray-500 mt-1">{finished ? 'Os ajustes voltam para você revisar assim que ficarem prontos.' : c.pending ? `Faltam ${c.pending} ${c.pending === 1 ? 'peça' : 'peças'}.` : 'Confira o resumo e conclua.'}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-6 text-center">
              <div className="rounded-2xl bg-emerald-50 py-3"><p className="text-2xl font-bold text-emerald-700 tabular-nums">{c.approved}</p><p className="text-[11px] text-emerald-700/80 font-bold">Aprovados</p></div>
              <div className="rounded-2xl bg-amber-50 py-3"><p className="text-2xl font-bold text-amber-700 tabular-nums">{c.changes}</p><p className="text-[11px] text-amber-700/80 font-bold">Ajustes</p></div>
              <div className="rounded-2xl bg-gray-50 py-3"><p className="text-2xl font-bold text-gray-600 tabular-nums">{c.pending}</p><p className="text-[11px] text-gray-500 font-bold">Pendentes</p></div>
            </div>
            {changes.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ajustes que você pediu</p>
                {changes.map(i => (
                  <button key={i.id} onClick={() => { setStatusF('all'); setKind('all'); openFocus(i.id); }} className="w-full flex items-start gap-3 p-2 rounded-2xl hover:bg-gray-50 text-left">
                    <CreativeThumb item={i} signed={signed} className="w-12 h-12 rounded-xl shrink-0" />
                    <span className="min-w-0"><span className="block text-sm font-bold text-brand-dark truncate">{i.title || KIND_LABEL[i.kind]}</span><span className="block text-xs text-gray-500 line-clamp-2">{i.feedback}</span></span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-7 grid gap-2">
              {c.pending > 0 && <button onClick={startReview} className="w-full py-4 rounded-2xl bg-brand-dark text-white font-bold inline-flex items-center justify-center gap-2"><PlayCircle size={18} /> Revisar as {c.pending} pendentes</button>}
              {c.pending === 0 && canDecide && !finished && batch.status === 'sent' && (
                <button onClick={finish} disabled={busy} className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Concluir revisão e avisar a agência
                </button>
              )}
              <button onClick={() => setStage('grid')} className="w-full py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-700">Ver todos</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Grade ----------------
  if (stage === 'grid' || !item) {
    return (
      <div className="min-h-screen bg-[#F6F6F4]">
        {Header}
        <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {kindTabs.map(k => <button key={k} onClick={() => setKind(k)} className={chip(kind === k)}>{k === 'all' ? `Todos (${c.total})` : `${KIND_LABEL_PLURAL[k]} (${c[k]})`}</button>)}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['all', 'pending', 'approved', 'changes'] as const).map(s => (
                <button key={s} onClick={() => setStatusF(s)} className={chip(statusF === s)}>
                  {s === 'all' ? 'Qualquer status' : `${STATUS_LABEL[s]} (${c[s]})`}
                </button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-16">{c.total ? 'Nenhuma peça neste filtro.' : 'Nenhuma peça neste lote ainda.'}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((i, n) => (
                <button key={i.id} onClick={() => openFocus(i.id)} className="group text-left bg-white rounded-2xl border border-black/[0.04] shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative">
                    <CreativeThumb item={i} signed={signed} className="aspect-[4/5] w-full" />
                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md border text-[10px] font-bold ${STATUS_STYLE[i.status]}`}>
                      {i.status === 'approved' ? <span className="inline-flex items-center gap-0.5"><Check size={10} /> Aprovado</span> : STATUS_LABEL[i.status]}
                    </span>
                    {i.version > 1 && <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold">v{i.version}</span>}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold text-brand-dark truncate">{i.title || `${KIND_LABEL[i.kind]} ${n + 1}`}</p>
                    <p className="text-[11px] text-gray-400 truncate">{KIND_LABEL[i.kind]}{i.placement ? ` · ${i.placement}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------- Peça por peça ----------------
  const prev = item.history?.length ? item.history[item.history.length - 1] : null;
  const KIcon = KIND_ICON[item.kind];
  return (
    <div className="min-h-screen bg-[#F6F6F4] flex flex-col">
      {Header}
      <div className="flex-1 max-w-6xl w-full mx-auto lg:px-4 lg:py-5 grid lg:grid-cols-[1fr_380px] gap-0 lg:gap-5">
        <div className="relative bg-stone-950 lg:rounded-3xl overflow-hidden h-[58vh] lg:h-[calc(100vh-150px)] min-h-[320px]">
          <CreativeStage item={item} signed={signed} />
          {flash && (
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-bold shadow-lg ${flash.tone === 'ok' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-amber-950'}`}>{flash.text}</div>
          )}
          <button onClick={() => go(-1)} disabled={idx <= 0} className="hidden lg:flex absolute left-3 bottom-3 items-center gap-1 px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 disabled:opacity-30"><ChevronLeft size={14} /> Anterior</button>
          <button onClick={() => go(1)} disabled={idx >= filtered.length - 1} className="hidden lg:flex absolute right-3 bottom-3 items-center gap-1 px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 disabled:opacity-30">Próxima <ChevronRight size={14} /></button>
        </div>

        <div className="bg-white lg:rounded-3xl lg:border lg:border-black/[0.04] lg:shadow-sm flex flex-col lg:h-[calc(100vh-150px)]">
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-400 tabular-nums">Peça {idx + 1} de {filtered.length}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-600"><KIcon size={11} /> {KIND_LABEL[item.kind]}{item.kind === 'carousel' ? ` · ${item.media.length}` : ''}</span>
              {item.placement && <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-600">{item.placement}</span>}
              {item.version > 1 && <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[11px] font-bold text-blue-700">Versão {item.version}</span>}
              <span className={`ml-auto px-2 py-0.5 rounded-md border text-[11px] font-bold ${STATUS_STYLE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
            </div>
            {item.title && <h2 className="text-lg font-bold text-brand-dark leading-snug">{item.title}</h2>}
            {prev?.feedback && (
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Ajuste pedido na versão {prev.version}</p>
                <p className="text-sm text-blue-900 mt-1 whitespace-pre-wrap">{prev.feedback}</p>
              </div>
            )}
            {item.caption && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Legenda / texto do anúncio</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.caption}</p>
              </div>
            )}
            {item.status === 'changes' && item.feedback && !asking && (
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Seu pedido de ajuste</p>
                <p className="text-sm text-amber-900 mt-1 whitespace-pre-wrap">{item.feedback}</p>
              </div>
            )}
            {asking && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-brand-dark">O que precisa ajustar?</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_FIXES.map(q => (
                    <button key={q} onClick={() => setFix(f => (f ? `${f}${/[.\n]$/.test(f) ? '' : '.'} ${q}` : q))}
                      className="px-2.5 py-1 rounded-full border border-gray-200 text-[11px] font-bold text-gray-600 hover:bg-gray-50">{q}</button>
                  ))}
                </div>
                <textarea ref={textRef} value={fix} onChange={e => setFix(e.target.value)} rows={4} placeholder="Ex.: trocar a foto por uma com a fachada; aumentar o preço na arte"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none resize-none"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && fix.trim()) decide('changes', fix.trim()); }} />
              </div>
            )}
            {canDecide && !asking && (
              <p className="hidden lg:flex items-center gap-1.5 text-[11px] text-gray-400"><Keyboard size={12} /> Atalhos: A aprova · R pede ajuste · ← → navega</p>
            )}
          </div>

          <div className="sticky bottom-0 p-4 border-t border-gray-100 bg-white lg:rounded-b-3xl">
            {!canDecide ? (
              <div className="flex gap-2">
                <button onClick={() => go(-1)} disabled={idx <= 0} className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-700 disabled:opacity-40">Anterior</button>
                <button onClick={() => go(1)} disabled={idx >= filtered.length - 1} className="flex-1 py-3 rounded-2xl bg-brand-dark text-white text-sm font-bold disabled:opacity-40">Próxima</button>
              </div>
            ) : asking ? (
              <div className="flex gap-2">
                <button onClick={() => { setAsking(false); setFix(''); }} className="px-4 py-3.5 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600">Cancelar</button>
                <button onClick={() => decide('changes', fix.trim())} disabled={!fix.trim() || busy}
                  className="flex-1 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />} Enviar ajuste
                </button>
              </div>
            ) : item.status === 'pending' ? (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAsking(true)} disabled={busy} className="py-4 rounded-2xl border-2 border-amber-300 text-amber-700 hover:bg-amber-50 text-sm font-bold inline-flex items-center justify-center gap-2"><Pencil size={17} /> Pedir ajuste</button>
                <button onClick={() => decide('approved')} disabled={busy} className="py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={18} />} Aprovar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => decide('pending')} disabled={busy} className="px-4 py-3 rounded-2xl border border-gray-200 text-xs font-bold text-gray-600 inline-flex items-center gap-1.5"><RotateCcw size={14} /> Desfazer</button>
                <button onClick={() => go(1)} disabled={idx >= filtered.length - 1} className="flex-1 py-3 rounded-2xl bg-brand-dark text-white text-sm font-bold disabled:opacity-40 inline-flex items-center justify-center gap-1">Próxima <ChevronRight size={16} /></button>
              </div>
            )}
            {canDecide && c.pending === 0 && batch.status === 'sent' && (
              <button onClick={() => setStage('done')} className="w-full mt-2 py-3 rounded-2xl bg-emerald-50 text-emerald-700 text-sm font-bold">Tudo revisado · ver resumo e concluir</button>
            )}
          </div>
        </div>
      </div>
      <div className="lg:hidden flex justify-between px-4 py-3 text-xs font-bold text-gray-500">
        <button onClick={() => go(-1)} disabled={idx <= 0} className="inline-flex items-center gap-1 disabled:opacity-30"><ChevronLeft size={14} /> Anterior</button>
        <button onClick={() => go(1)} disabled={idx >= filtered.length - 1} className="inline-flex items-center gap-1 disabled:opacity-30">Próxima <ChevronRight size={14} /></button>
      </div>
    </div>
  );
};

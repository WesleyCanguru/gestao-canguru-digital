import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Loader2, Megaphone, ChevronLeft, Send, Eye, Link2, Copy, Check, MessageCircle, Trash2, UploadCloud, Images, Film,
  ArrowUp, ArrowDown, Pencil, RefreshCw, X, Lock, Unlock, MoreHorizontal, Layers, Ungroup, Image as ImageIcon, PlayCircle,
} from 'lucide-react';
import dayjs from 'dayjs';
import { supabase, useAuth } from '../../lib/supabase';
import {
  CreativeBatch, CreativeItem, CreativeMedia, CreativeKind, KIND_LABEL, STATUS_LABEL, STATUS_STYLE, BATCH_STATUS_LABEL, BATCH_STATUS_STYLE,
  PLACEMENTS, uploadCreativeFile, signMedia, counts as countItems, batchLink, batchMessage, isSupportedVideoLink, MAX_FILE_MB,
} from '../../lib/creatives';
import { CreativeThumb } from './CreativeMedia';
import { CreativeReviewer } from './CreativeReviewer';

const INPUT = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-dark/20 outline-none';
const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-gray-500';

/** Tela de criativos dentro do cliente: a agência monta e envia lotes; o cliente revisa. */
export const CreativesView: React.FC = () => {
  const { activeClient, userRole, isViewingAsClient } = useAuth();
  const isAgency = userRole === 'admin';
  const [batches, setBatches] = useState<CreativeBatch[]>([]);
  const [itemsByBatch, setItemsByBatch] = useState<Record<string, CreativeItem[]>>({});
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{ id: string; preview: boolean } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [err, setErr] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!activeClient?.id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: b } = await supabase.from('creative_batches').select('*').eq('client_id', activeClient.id).order('created_at', { ascending: false });
      const list = (b as CreativeBatch[]) || [];
      const ids = list.map(x => x.id);
      const { data: its } = ids.length
        ? await supabase.from('creative_items').select('*').in('batch_id', ids).order('position')
        : { data: [] as any[] };
      const by: Record<string, CreativeItem[]> = {};
      ((its as CreativeItem[]) || []).forEach(i => { (by[i.batch_id] ||= []).push(i); });
      // miniaturas: só as 4 primeiras peças de cada lote
      const sig = await signMedia(Object.values(by).flatMap(arr => arr.slice(0, 4)).map(i => ({ media: i.media.slice(0, 1), history: [] })));
      if (!alive) return;
      setBatches(list); setItemsByBatch(by); setSigned(sig); setLoading(false);
    })();
    return () => { alive = false; };
  }, [activeClient?.id, reload]);

  const createBatch = async () => {
    if (!activeClient || !newTitle.trim()) return;
    setErr('');
    const { data, error } = await supabase.from('creative_batches')
      .insert({ agency_id: activeClient.agency_id, client_id: activeClient.id, title: newTitle.trim() }).select().single();
    if (error) { setErr(error.message); return; }
    setNewTitle(''); setCreating(false);
    setEditing((data as any).id);
    setReload(r => r + 1);
  };

  if (!activeClient) return null;

  if (reviewing) {
    return (
      <div className="fixed inset-0 z-[150] overflow-y-auto bg-[#F6F6F4]">
        <CreativeReviewer batchId={reviewing.id} mode={reviewing.preview || isViewingAsClient ? 'preview' : 'client'} clientName={activeClient.name}
          onClose={() => { setReviewing(null); setReload(r => r + 1); }} />
      </div>
    );
  }

  if (editing && isAgency) {
    return <BatchEditor batchId={editing} clientName={activeClient.name}
      onBack={() => { setEditing(null); setReload(r => r + 1); }}
      onPreview={(id) => setReviewing({ id, preview: true })} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-brand-dark"><Megaphone size={22} /><h2 className="text-2xl font-bold tracking-tight">Criativos de anúncio</h2></div>
          <p className="text-sm text-gray-500 mt-1">{isAgency
            ? 'Monte um lote com os estáticos, carrosséis e vídeos e mande o link para o cliente aprovar peça por peça.'
            : 'Criativos que a agência preparou para os seus anúncios. Abra, veja peça por peça e aprove ou peça ajuste.'}</p>
        </div>
        {isAgency && !creating && (
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-dark text-white rounded-xl text-sm font-bold self-start"><Plus size={16} /> Novo lote</button>
        )}
      </div>

      {creating && (
        <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm p-5 flex flex-col sm:flex-row gap-2">
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createBatch()}
            placeholder="Nome do lote (ex.: Campanha novembro · Black Friday)" className={INPUT} />
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { setCreating(false); setNewTitle(''); }} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancelar</button>
            <button onClick={createBatch} disabled={!newTitle.trim()} className="px-4 py-2.5 bg-brand-dark text-white rounded-xl text-sm font-bold disabled:opacity-50">Criar e adicionar peças</button>
          </div>
        </div>
      )}
      {err && <p className="text-sm font-bold text-rose-600">{err}</p>}

      {loading ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-gray-300" /></div>
        : batches.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-10 text-center">
            <Megaphone className="mx-auto text-gray-300 mb-3" size={30} />
            <p className="font-bold text-brand-dark">{isAgency ? 'Nenhum lote ainda' : 'Nada para aprovar por enquanto'}</p>
            <p className="text-sm text-gray-500 mt-1">{isAgency ? 'Crie o primeiro lote e arraste os criativos para dentro.' : 'Quando a agência enviar criativos, eles aparecem aqui.'}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {batches.map(b => {
              const its = itemsByBatch[b.id] || [];
              const c = countItems(its);
              const done = c.total ? Math.round(((c.approved + c.changes) / c.total) * 100) : 0;
              return (
                <button key={b.id} onClick={() => (isAgency ? setEditing(b.id) : setReviewing({ id: b.id, preview: false }))}
                  className="text-left bg-white rounded-3xl border border-black/[0.04] shadow-sm p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="grid grid-cols-2 gap-1 w-20 h-20 shrink-0 rounded-2xl overflow-hidden bg-gray-50">
                      {its.slice(0, 4).map(i => <CreativeThumb key={i.id} item={{ kind: i.kind === 'carousel' ? 'image' : i.kind, media: i.media.slice(0, 1) }} signed={signed} className="w-full h-full" />)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="font-bold text-brand-dark leading-snug flex-1 min-w-0">{b.title}</p>
                        {(isAgency || b.status !== 'sent') && <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold ${BATCH_STATUS_STYLE[b.status]}`}>{BATCH_STATUS_LABEL[b.status]}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.total} {c.total === 1 ? 'peça' : 'peças'}{c.image ? ` · ${c.image} estát.` : ''}{c.carousel ? ` · ${c.carousel} carross.` : ''}{c.video ? ` · ${c.video} vídeo${c.video > 1 ? 's' : ''}` : ''}
                      </p>
                      <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
                        <div className="h-full bg-emerald-500" style={{ width: `${c.total ? (c.approved / c.total) * 100 : 0}%` }} />
                        <div className="h-full bg-amber-400" style={{ width: `${c.total ? (c.changes / c.total) * 100 : 0}%` }} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-gray-500">
                        <span><b className="text-emerald-700">{c.approved}</b> aprovados</span>
                        <span><b className="text-amber-700">{c.changes}</b> ajustes</span>
                        <span><b className="text-gray-700">{c.pending}</b> pendentes</span>
                        <span className="ml-auto text-gray-400">{done}% · {dayjs(b.sent_at || b.created_at).format('DD/MM')}</span>
                      </div>
                    </div>
                  </div>
                  {!isAgency && c.pending > 0 && b.status === 'sent' && (
                    <div className="mt-4 w-full py-2.5 rounded-xl bg-brand-dark text-white text-sm font-bold text-center">Revisar {c.pending} {c.pending === 1 ? 'peça' : 'peças'}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
};

// ======================================================================
// Editor do lote (agência)
// ======================================================================
const BatchEditor: React.FC<{ batchId: string; clientName: string; onBack: () => void; onPreview: (id: string) => void }> = ({ batchId, clientName, onBack, onPreview }) => {
  const [batch, setBatch] = useState<CreativeBatch | null>(null);
  const [items, setItems] = useState<CreativeItem[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [asCarousel, setAsCarousel] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [videoLink, setVideoLink] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'changes'>('all');
  const [share, setShare] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data: b } = await supabase.from('creative_batches').select('*').eq('id', batchId).single();
    const { data: its } = await supabase.from('creative_items').select('*').eq('batch_id', batchId).order('position').order('created_at');
    const list = (its as CreativeItem[]) || [];
    setBatch(b as CreativeBatch); setItems(list);
    setSigned(await signMedia(list));
    setLoading(false);
  };
  useEffect(() => { load(); }, [batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = useMemo(() => countItems(items), [items]);
  const visible = items.filter(i => filter === 'all' || i.status === filter);
  const flash = (type: 'ok' | 'err', text: string) => { setMsg({ type, text }); if (type === 'ok') setTimeout(() => setMsg(null), 2500); };
  const copy = (t: string, id: string) => { navigator.clipboard.writeText(t); setCopied(id); setTimeout(() => setCopied(null), 1800); };

  const patchBatch = async (patch: Partial<CreativeBatch>) => {
    if (!batch) return;
    const { error } = await supabase.from('creative_batches').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', batch.id);
    if (error) return flash('err', error.message);
    setBatch({ ...batch, ...patch });
  };

  const patchItem = async (id: string, patch: Partial<CreativeItem>) => {
    setItems(list => list.map(i => (i.id === id ? { ...i, ...patch } : i)));
    const { error } = await supabase.from('creative_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) flash('err', error.message);
  };

  const nextPos = () => (items.length ? Math.max(...items.map(i => i.position)) + 1 : 0);

  const addFiles = async (files: File[]) => {
    if (!batch || !files.length) return;
    const ok = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const big = ok.filter(f => f.size > MAX_FILE_MB * 1024 * 1024);
    const valid = ok.filter(f => f.size <= MAX_FILE_MB * 1024 * 1024).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!valid.length) { flash('err', big.length ? `Arquivo acima de ${MAX_FILE_MB} MB. Para vídeo grande, cole o link do Google Drive.` : 'Escolha imagens ou vídeos.'); return; }
    setUploading({ done: 0, total: valid.length }); setMsg(null);
    const uploaded: CreativeMedia[] = [];
    const failed: string[] = [];
    let done = 0;
    // sobe 4 por vez
    const queue = [...valid];
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift()!;
        try { uploaded[valid.indexOf(f)] = await uploadCreativeFile(batch.client_id, batch.id, f); }
        catch (e: any) { failed.push(e.message || f.name); }
        done++; setUploading({ done, total: valid.length });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    const media = uploaded.filter(Boolean);
    let pos = nextPos();
    const rows: any[] = [];
    const images = media.filter(m => m.type === 'image');
    const videos = media.filter(m => m.type === 'video');
    if (asCarousel && images.length > 1) rows.push({ batch_id: batch.id, client_id: batch.client_id, kind: 'carousel', media: images, position: pos++ });
    else images.forEach(m => rows.push({ batch_id: batch.id, client_id: batch.client_id, kind: 'image', media: [m], position: pos++ }));
    videos.forEach(m => rows.push({ batch_id: batch.id, client_id: batch.client_id, kind: 'video', media: [m], position: pos++ }));
    if (rows.length) {
      const { error } = await supabase.from('creative_items').insert(rows);
      if (error) failed.push(error.message);
    }
    setUploading(null); setAsCarousel(false);
    await load();
    if (failed.length || big.length) flash('err', [...failed, ...big.map(f => `"${f.name}" passa de ${MAX_FILE_MB} MB (use o link do Drive).`)].join(' '));
    else flash('ok', `${rows.length} ${rows.length === 1 ? 'peça adicionada' : 'peças adicionadas'}.`);
  };

  const addVideoLink = async () => {
    if (!batch) return;
    const url = videoLink.trim();
    if (!isSupportedVideoLink(url)) return flash('err', 'Cole um link do Google Drive, YouTube ou Vimeo. No Drive, deixe o arquivo como "Qualquer pessoa com o link".');
    const { error } = await supabase.from('creative_items').insert({ batch_id: batch.id, client_id: batch.client_id, kind: 'video', media: [{ type: 'link', url }], position: nextPos() });
    if (error) return flash('err', error.message);
    setVideoLink(''); await load(); flash('ok', 'Vídeo adicionado.');
  };

  const removeItem = async (it: CreativeItem) => {
    if (!window.confirm('Remover esta peça do lote?')) return;
    const { error } = await supabase.from('creative_items').delete().eq('id', it.id);
    if (error) return flash('err', error.message);
    setItems(list => list.filter(i => i.id !== it.id));
    setSelected(s => s.filter(x => x !== it.id));
  };

  const move = async (it: CreativeItem, dir: -1 | 1) => {
    const idx = items.findIndex(i => i.id === it.id);
    const other = items[idx + dir];
    if (!other) return;
    const list = [...items];
    list[idx] = { ...other, position: it.position }; list[idx + dir] = { ...it, position: other.position };
    if (it.position === other.position) { list[idx].position = idx; list[idx + dir].position = idx + dir; }
    setItems(list);
    await Promise.all([
      supabase.from('creative_items').update({ position: list[idx].position }).eq('id', list[idx].id),
      supabase.from('creative_items').update({ position: list[idx + dir].position }).eq('id', list[idx + dir].id),
    ]);
  };

  const mergeCarousel = async () => {
    const chosen = items.filter(i => selected.includes(i.id) && i.kind !== 'video');
    if (chosen.length < 2) return;
    const [first, ...rest] = chosen;
    const media = chosen.flatMap(i => i.media);
    const { error } = await supabase.from('creative_items').update({ kind: 'carousel', media, status: 'pending', feedback: null, decided_at: null, decided_by_name: null, updated_at: new Date().toISOString() }).eq('id', first.id);
    if (error) return flash('err', error.message);
    await supabase.from('creative_items').delete().in('id', rest.map(r => r.id));
    setSelected([]); await load(); flash('ok', `Carrossel com ${media.length} imagens criado.`);
  };

  const splitCarousel = async (it: CreativeItem) => {
    if (!batch || it.media.length < 2) return;
    const [first, ...rest] = it.media;
    await supabase.from('creative_items').update({ kind: 'image', media: [first] }).eq('id', it.id);
    let pos = nextPos();
    await supabase.from('creative_items').insert(rest.map(m => ({ batch_id: batch.id, client_id: batch.client_id, kind: 'image', media: [m], position: pos++ })));
    await load(); flash('ok', 'Carrossel separado em estáticos.');
  };

  const moveSlide = async (it: CreativeItem, i: number, dir: -1 | 1) => {
    const m = [...it.media]; const j = i + dir; if (j < 0 || j >= m.length) return;
    [m[i], m[j]] = [m[j], m[i]];
    patchItem(it.id, { media: m });
  };
  const removeSlide = async (it: CreativeItem, i: number) => {
    const m = it.media.filter((_, k) => k !== i);
    if (!m.length) return removeItem(it);
    patchItem(it.id, { media: m, kind: m.length === 1 && it.kind === 'carousel' ? 'image' : it.kind });
  };

  /** Troca o arquivo. Se o cliente já decidiu, vira nova versão e volta para aprovação. */
  const replaceMedia = async (it: CreativeItem, files: File[], link?: string) => {
    if (!batch) return;
    setUploading({ done: 0, total: files.length || 1 });
    try {
      let media: CreativeMedia[] = [];
      if (link) media = [{ type: 'link', url: link }];
      else {
        for (let k = 0; k < files.length; k++) { media.push(await uploadCreativeFile(batch.client_id, batch.id, files[k])); setUploading({ done: k + 1, total: files.length }); }
      }
      const decided = it.status !== 'pending';
      const kind: CreativeKind = media.length > 1 ? 'carousel' : media[0].type === 'image' ? 'image' : 'video';
      const patch: Partial<CreativeItem> = decided
        ? { media, kind, version: it.version + 1, status: 'pending', feedback: null, decided_at: null, decided_by_name: null,
            history: [...(it.history || []), { version: it.version, media: it.media, feedback: it.feedback, decided_at: it.decided_at }] }
        : { media, kind };
      await patchItem(it.id, patch);
      if (decided && batch.status === 'reviewed') await patchBatch({ status: 'sent' });
      setSigned(await signMedia(items.map(i => (i.id === it.id ? { ...i, ...patch } as CreativeItem : i))));
      flash('ok', decided ? `Versão ${it.version + 1} enviada para aprovação.` : 'Arquivo trocado.');
    } catch (e: any) { flash('err', e.message); }
    setUploading(null);
  };

  const send = async () => {
    if (!batch) return;
    if (!items.length) return flash('err', 'Adicione pelo menos uma peça antes de enviar.');
    if (batch.status === 'draft' || batch.status === 'closed') await patchBatch({ status: 'sent', sent_at: batch.sent_at || new Date().toISOString() });
    setShare(true);
  };

  const deleteBatch = async () => {
    if (!batch) return;
    if (!window.confirm(`Excluir o lote "${batch.title}" com ${items.length} peças? Isso não pode ser desfeito.`)) return;
    const { error } = await supabase.from('creative_batches').delete().eq('id', batch.id);
    if (error) return flash('err', error.message);
    const paths = items.flatMap(i => [...i.media, ...(i.history || []).flatMap(h => h.media)]).map(m => m.path).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from('ad-creatives').remove(paths);
    onBack();
  };

  if (loading || !batch) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-gray-300" /></div>;

  const link = batchLink(batch);
  const message = batchMessage(batch, clientName, c);
  const mergeable = items.filter(i => selected.includes(i.id) && i.kind !== 'video').length;

  return (
    <div className="space-y-5 pb-16">
      {/* Cabeçalho */}
      <div className="space-y-3">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-brand-dark"><ChevronLeft size={18} /> Criativos</button>
        <div className="space-y-1">
          <input defaultValue={batch.title} onBlur={e => e.target.value.trim() && e.target.value !== batch.title && patchBatch({ title: e.target.value.trim() })}
            className="w-full text-xl sm:text-2xl font-bold text-brand-dark bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-brand-dark outline-none px-0 py-1" />
          <textarea defaultValue={batch.description || ''} rows={2} placeholder="Recado para o cliente (opcional): objetivo da campanha, o que observar..."
            onBlur={e => e.target.value !== (batch.description || '') && patchBatch({ description: e.target.value.trim() || null })}
            className="w-full text-sm text-gray-600 bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-300 focus:bg-white rounded-xl outline-none px-2 py-1.5 -mx-2 resize-y" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${BATCH_STATUS_STYLE[batch.status]}`}>{BATCH_STATUS_LABEL[batch.status]}{batch.status === 'reviewed' && batch.reviewed_by_name ? ` · ${batch.reviewed_by_name}` : ''}</span>
          <button onClick={() => onPreview(batch.id)} disabled={!items.length} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 disabled:opacity-40"><Eye size={14} /> Ver como o cliente</button>
          <button onClick={send} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-dark text-white text-xs font-bold">
            {batch.status === 'draft' ? <><Send size={14} /> Enviar para o cliente</> : <><Link2 size={14} /> Link e mensagem</>}
          </button>
          <div className="relative">
            <button onClick={() => setMenu(m => !m)} className="p-2 rounded-xl border border-gray-200 text-gray-500"><MoreHorizontal size={16} /></button>
            {menu && (
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-2xl border border-gray-100 shadow-xl p-1.5 z-30" onMouseLeave={() => setMenu(false)}>
                {batch.status === 'reviewed' && <button onClick={() => { setMenu(false); patchBatch({ status: 'sent' }); }} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-gray-50 inline-flex items-center gap-2"><Unlock size={14} /> Reabrir para o cliente</button>}
                {batch.status !== 'closed' && batch.status !== 'draft' && <button onClick={() => { setMenu(false); patchBatch({ status: 'closed' }); }} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-gray-50 inline-flex items-center gap-2"><Lock size={14} /> Encerrar (só consulta)</button>}
                {batch.status === 'closed' && <button onClick={() => { setMenu(false); patchBatch({ status: 'sent' }); }} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-gray-50 inline-flex items-center gap-2"><Unlock size={14} /> Reabrir</button>}
                <button onClick={() => { setMenu(false); deleteBatch(); }} className="w-full text-left px-3 py-2 rounded-xl text-sm text-rose-600 hover:bg-rose-50 inline-flex items-center gap-2"><Trash2 size={14} /> Excluir lote</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {msg && <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{msg.text}</div>}

      {/* Números */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([['all', 'Peças', c.total, 'text-brand-dark'], ['approved', 'Aprovadas', c.approved, 'text-emerald-600'], ['changes', 'Pediram ajuste', c.changes, 'text-amber-600'], ['pending', 'Pendentes', c.pending, 'text-gray-600']] as const).map(([k, l, v, cls]) => (
          <button key={k} onClick={() => setFilter(k)} className={`text-left bg-white p-4 rounded-3xl border shadow-sm ${filter === k ? 'border-brand-dark ring-1 ring-brand-dark' : 'border-black/[0.04]'}`}>
            <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-gray-400">{l}</p>
            <p className={`text-2xl font-bold tabular-nums ${cls}`}>{v}</p>
          </button>
        ))}
      </div>

      {/* Adicionar */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-3">
        <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => !uploading && fileRef.current?.click()}
          className={`cursor-pointer rounded-3xl border-2 border-dashed p-6 text-center transition-colors ${dragOver ? 'border-brand-dark bg-brand-dark/[0.03]' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
          <input ref={fileRef} type="file" multiple accept="image/*,video/mp4,video/quicktime,video/webm" className="hidden"
            onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
          {uploading ? (
            <div className="space-y-2">
              <Loader2 className="mx-auto animate-spin text-brand-dark" />
              <p className="text-sm font-bold text-brand-dark">Subindo {uploading.done} de {uploading.total}...</p>
              <div className="max-w-xs mx-auto h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-brand-dark transition-all" style={{ width: `${(uploading.done / uploading.total) * 100}%` }} /></div>
            </div>
          ) : (
            <>
              <UploadCloud className="mx-auto text-gray-400" size={28} />
              <p className="text-sm font-bold text-brand-dark mt-2">Arraste os criativos aqui ou clique para escolher</p>
              <p className="text-xs text-gray-500 mt-1">Pode soltar dezenas de uma vez. Cada imagem vira um estático e cada vídeo uma peça. Até {MAX_FILE_MB} MB por arquivo.</p>
              <label onClick={e => e.stopPropagation()} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
                <input type="checkbox" checked={asCarousel} onChange={e => setAsCarousel(e.target.checked)} className="accent-brand-dark" />
                Juntar as imagens deste envio num carrossel (na ordem do nome do arquivo)
              </label>
            </>
          )}
        </div>
        <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm p-4 space-y-2">
          <p className={LABEL}>Vídeo grande? Cole o link</p>
          <input value={videoLink} onChange={e => setVideoLink(e.target.value)} onKeyDown={e => e.key === 'Enter' && addVideoLink()} placeholder="Google Drive, YouTube ou Vimeo" className={INPUT} />
          <button onClick={addVideoLink} disabled={!videoLink.trim()} className="w-full py-2.5 rounded-xl bg-brand-dark text-white text-xs font-bold disabled:opacity-40 inline-flex items-center justify-center gap-1.5"><Film size={14} /> Adicionar vídeo</button>
          <p className="text-[11px] text-gray-400">No Drive, compartilhe como "Qualquer pessoa com o link". O vídeo toca dentro da tela de aprovação.</p>
        </div>
      </div>

      {/* Barra de seleção */}
      {selected.length > 0 && (
        <div className="sticky top-2 z-20 flex items-center gap-2 bg-brand-dark text-white rounded-2xl px-4 py-2.5 shadow-lg">
          <span className="text-sm font-bold">{selected.length} {selected.length === 1 ? 'selecionada' : 'selecionadas'}</span>
          <button onClick={mergeCarousel} disabled={mergeable < 2} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-brand-dark text-xs font-bold disabled:opacity-40"><Layers size={14} /> Juntar em carrossel</button>
          <button onClick={() => setSelected([])} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} /></button>
        </div>
      )}

      {/* Peças */}
      {visible.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-10">{items.length ? 'Nenhuma peça neste filtro.' : 'Nenhuma peça ainda. Arraste os arquivos acima.'}</p>
      ) : (
        <div className="space-y-3">
          {visible.map(it => (
            <ItemRow key={it.id} it={it} signed={signed} n={items.indexOf(it)} total={items.length}
              selected={selected.includes(it.id)} onSelect={() => setSelected(s => (s.includes(it.id) ? s.filter(x => x !== it.id) : [...s, it.id]))}
              onPatch={p => patchItem(it.id, p)} onRemove={() => removeItem(it)} onMove={d => move(it, d)}
              onSplit={() => splitCarousel(it)} onMoveSlide={(i, d) => moveSlide(it, i, d)} onRemoveSlide={i => removeSlide(it, i)}
              onReplace={(f, l) => replaceMedia(it, f, l)} busy={!!uploading} />
          ))}
        </div>
      )}

      {/* Janela de envio */}
      {share && (
        <div className="fixed inset-0 z-[160] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setShare(false)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div><h3 className="font-bold text-brand-dark text-lg">Enviar para o cliente</h3><p className="text-xs text-gray-500">Abre sem login, no celular ou no computador. O cliente também vê no portal.</p></div>
              <button onClick={() => setShare(false)} className="p-2 rounded-xl hover:bg-gray-50 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <p className={LABEL}>Link</p>
                <div className="flex gap-2">
                  <code className="flex-1 min-w-0 truncate text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">{link}</code>
                  <button onClick={() => copy(link, 'link')} className="px-3 rounded-xl border border-gray-200 text-xs font-bold inline-flex items-center gap-1">{copied === 'link' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className={LABEL}>Mensagem</p>
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-2xl p-4">{message}</pre>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 grid grid-cols-2 gap-2">
              <button onClick={() => copy(message, 'msg')} className="py-3 rounded-xl border border-gray-200 text-sm font-bold inline-flex items-center justify-center gap-1.5">{copied === 'msg' ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />} Copiar mensagem</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5"><MessageCircle size={15} /> Abrir WhatsApp</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
const ItemRow: React.FC<{
  it: CreativeItem; signed: Record<string, string>; n: number; total: number; selected: boolean; busy: boolean;
  onSelect: () => void; onPatch: (p: Partial<CreativeItem>) => void; onRemove: () => void; onMove: (d: -1 | 1) => void;
  onSplit: () => void; onMoveSlide: (i: number, d: -1 | 1) => void; onRemoveSlide: (i: number) => void; onReplace: (files: File[], link?: string) => void;
}> = ({ it, signed, n, total, selected, busy, onSelect, onPatch, onRemove, onMove, onSplit, onMoveSlide, onRemoveSlide, onReplace }) => {
  const replaceRef = useRef<HTMLInputElement>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [link, setLink] = useState('');
  const isLink = it.media[0]?.type === 'link';
  const KIcon = it.kind === 'carousel' ? Images : it.kind === 'video' ? PlayCircle : ImageIcon;
  const replaceLabel = it.status === 'pending' ? 'Trocar arquivo' : 'Enviar nova versão';

  return (
    <div className={`bg-white rounded-3xl border shadow-sm p-4 flex flex-col md:flex-row gap-4 ${selected ? 'border-brand-dark ring-1 ring-brand-dark' : it.status === 'changes' ? 'border-amber-200' : 'border-black/[0.04]'}`}>
      <div className="flex md:flex-col items-start gap-3 shrink-0">
        <div className="relative">
          <CreativeThumb item={it} signed={signed} className="w-28 h-36 md:w-32 md:h-40 rounded-2xl" />
          {it.kind !== 'video' && (
            <button onClick={onSelect} title="Selecionar para juntar em carrossel"
              className={`absolute top-2 left-2 w-6 h-6 rounded-lg border-2 flex items-center justify-center ${selected ? 'bg-brand-dark border-brand-dark text-white' : 'bg-white/90 border-white text-transparent'}`}><Check size={14} /></button>
          )}
        </div>
        <div className="flex md:flex-row gap-1">
          <button onClick={() => onMove(-1)} disabled={n === 0} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30" title="Subir"><ArrowUp size={13} /></button>
          <button onClick={() => onMove(1)} disabled={n === total - 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30" title="Descer"><ArrowDown size={13} /></button>
          <button onClick={onRemove} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-600" title="Remover"><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-400 tabular-nums">#{n + 1}</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-600"><KIcon size={11} /> {KIND_LABEL[it.kind]}{it.kind === 'carousel' ? ` · ${it.media.length}` : ''}</span>
          {it.version > 1 && <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[11px] font-bold text-blue-700">v{it.version}</span>}
          <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${STATUS_STYLE[it.status]}`}>{STATUS_LABEL[it.status]}</span>
          {it.decided_at && <span className="text-[11px] text-gray-400">{it.decided_by_name ? `${it.decided_by_name} · ` : ''}{dayjs(it.decided_at).format('DD/MM HH:mm')}</span>}
        </div>

        {it.status === 'changes' && it.feedback && (
          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Ajuste pedido pelo cliente</p>
            <p className="text-sm text-amber-900 mt-1 whitespace-pre-wrap">{it.feedback}</p>
          </div>
        )}
        {it.status === 'approved' && it.feedback && <p className="text-xs text-emerald-700">Comentário: {it.feedback}</p>}

        <div className="grid sm:grid-cols-[1fr_200px] gap-2">
          <input defaultValue={it.title || ''} placeholder="Nome da peça (opcional, ex.: Oferta 30% · fachada)"
            onBlur={e => e.target.value !== (it.title || '') && onPatch({ title: e.target.value.trim() || null })} className={INPUT} />
          <select value={it.placement || ''} onChange={e => onPatch({ placement: e.target.value || null })} className={INPUT}>
            <option value="">Posicionamento</option>
            {PLACEMENTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <textarea defaultValue={it.caption || ''} rows={2} placeholder="Legenda / texto do anúncio que vai junto (opcional)"
          onBlur={e => e.target.value !== (it.caption || '') && onPatch({ caption: e.target.value.trim() || null })} className={`${INPUT} resize-y`} />

        {it.kind === 'carousel' && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {it.media.map((m, i) => (
              <div key={i} className="relative shrink-0 group">
                <CreativeThumb item={{ kind: 'image', media: [m] }} signed={signed} className="w-16 h-20 rounded-xl" />
                <span className="absolute bottom-1 left-1 px-1 rounded bg-black/60 text-white text-[9px] font-bold">{i + 1}</span>
                <div className="absolute inset-x-0 top-0 flex justify-between p-0.5 opacity-0 group-hover:opacity-100">
                  <button onClick={() => onMoveSlide(i, -1)} className="w-5 h-5 rounded bg-white/90 text-[10px]">‹</button>
                  <button onClick={() => onRemoveSlide(i)} className="w-5 h-5 rounded bg-white/90 text-rose-600 flex items-center justify-center"><X size={10} /></button>
                  <button onClick={() => onMoveSlide(i, 1)} className="w-5 h-5 rounded bg-white/90 text-[10px]">›</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <input ref={replaceRef} type="file" multiple={it.kind === 'carousel'} accept={it.kind === 'video' ? 'video/mp4,video/quicktime,video/webm' : 'image/*'} className="hidden"
            onChange={e => { const f = Array.from(e.target.files || []); if (f.length) onReplace(f); e.target.value = ''; }} />
          {isLink && linkMode ? (
            <div className="flex gap-2 w-full">
              <input value={link} onChange={e => setLink(e.target.value)} placeholder="Novo link do vídeo" className={INPUT} />
              <button onClick={() => { if (isSupportedVideoLink(link)) { onReplace([], link.trim()); setLinkMode(false); setLink(''); } }} className="px-3 rounded-xl bg-brand-dark text-white text-xs font-bold shrink-0">Salvar</button>
            </div>
          ) : (
            <button disabled={busy} onClick={() => (isLink ? setLinkMode(true) : replaceRef.current?.click())}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${it.status === 'changes' ? 'bg-amber-500 text-white hover:bg-amber-600' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {it.status === 'pending' ? <RefreshCw size={13} /> : <UploadCloud size={13} />} {replaceLabel}
            </button>
          )}
          {it.kind === 'carousel' && <button onClick={onSplit} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"><Ungroup size={13} /> Separar em estáticos</button>}
          {it.history?.length > 0 && <span className="self-center text-[11px] text-gray-400 inline-flex items-center gap-1"><Pencil size={11} /> {it.history.length} {it.history.length === 1 ? 'versão anterior guardada' : 'versões anteriores guardadas'}</span>}
        </div>
      </div>
    </div>
  );
};

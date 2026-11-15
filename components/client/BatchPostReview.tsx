import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Pencil, ChevronLeft, ChevronRight, X, Loader2, PartyPopper } from 'lucide-react';
import { supabase, useAuth, parseImageUrl } from '../../lib/supabase';
import { recordPostRevision } from '../../lib/postRevisions';
import { getPostGroupIdentifier } from '../../lib/scheduledPostsUtils';
import { useT } from '../../lib/i18n';

/**
 * Aprovação em sequência: o cliente revisa todos os posts esperando aprovação, um por vez.
 * Aprovar vale para todas as versões ligadas do post (Instagram, LinkedIn, TikTok do mesmo dia/tema).
 * Atalhos: A aprova, R pede ajuste, ← → navega.
 */
const QUICK = ['Ajustar legenda e tom de voz', 'Trocar imagem/vídeo', 'Corrigir texto da legenda', 'Ajustar data ou horário'];

export const BatchPostReview: React.FC<{ clientId: string; agencyId: number; onClose: () => void; onDone?: () => void }> = ({ clientId, agencyId, onClose, onDone }) => {
  const { activeClient, isViewingAsClient } = useAuth() as any;
  const { t, locale } = useT();
  const [groups, setGroups] = useState<any[][] | null>(null);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<Record<string, 'approved' | 'changes'>>({});
  const [askFix, setAskFix] = useState(false);
  const [fix, setFix] = useState('');
  const [busy, setBusy] = useState(false);
  const readOnly = !!isViewingAsClient;

  useEffect(() => {
    supabase.from('posts').select('id, date_key, theme, theme_title, caption, type, platform, image_url, video_thumbnail_url, scheduled_time, status, client_id')
      .eq('client_id', clientId).eq('status', 'pending_approval').or('is_deleted.is.null,is_deleted.eq.false')
      .then(({ data }) => {
        const m = new Map<string, any[]>();
        ((data as any[]) || []).forEach(p => { const k = getPostGroupIdentifier(p); if (!m.has(k)) m.set(k, []); m.get(k)!.push(p); });
        const list = [...m.values()].sort((a, b) => (a[0].date_key || '').split('-').slice(0, 3).reverse().join('').localeCompare((b[0].date_key || '').split('-').slice(0, 3).reverse().join('')));
        setGroups(list);
      });
  }, [clientId]);

  const g = groups?.[idx];
  const main = g?.find(p => !p.date_key.includes('linkedin') && !p.date_key.includes('tiktok')) || g?.[0];
  const images = useMemo(() => { const v = parseImageUrl(main?.image_url || null); return (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean) as string[]; }, [main]);
  const author = (activeClient?.responsible || activeClient?.name || 'Cliente') as string;
  const pending = (groups || []).filter(x => !result[x[0].id]).length;

  const act = useCallback(async (kind: 'approved' | 'changes') => {
    if (!g || busy || readOnly) return;
    if (kind === 'changes' && !fix.trim()) { setAskFix(true); return; }
    setBusy(true);
    const status = kind === 'approved' ? 'approved' : 'changes_requested';
    const content = kind === 'approved' ? '✅ APROVOU a publicação.' : `⚠️ SOLICITOU AJUSTES: ${fix.trim()}`;
    await supabase.from('comments').insert({ post_id: main.date_key, agency_id: agencyId, client_id: clientId, author_role: kind === 'approved' ? 'approver' : 'client', author_name: author, content, visible_to_admin: true });
    await supabase.from('posts').update({ status, last_updated: new Date().toISOString() }).in('id', g.map(p => p.id));
    await recordPostRevision({ postId: main.id, agencyId, clientId, action: kind === 'approved' ? 'approved' : 'revision_requested', actorRole: 'client', actorName: author, rejectionReason: kind === 'changes' ? fix.trim() : null, statusBefore: 'pending_approval', statusAfter: status });
    setResult(r => ({ ...r, [g[0].id]: kind }));
    setFix(''); setAskFix(false); setBusy(false);
    const next = (groups || []).findIndex((x, i) => i > idx && !result[x[0].id]);
    if (next >= 0) setIdx(next); else setIdx((groups || []).length);
  }, [g, busy, readOnly, fix, main, agencyId, clientId, author, groups, idx, result]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'a' || e.key === 'A') act('approved');
      else if (e.key === 'r' || e.key === 'R') setAskFix(true);
      else if (e.key === 'ArrowRight') setIdx(i => Math.min((groups?.length || 1) - 1, i + 1));
      else if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [act, groups, onClose]);

  const dateOf = (dk: string, time?: string | null) => {
    const m = /(\d{2})-(\d{2})-(\d{4})/.exec(dk || ''); if (!m) return '';
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12));
    return d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }) + (time ? ` · ${time}` : '');
  };

  return (
    <div className="fixed inset-0 z-[80] bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[94vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-stone-100">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400">{t('Aprovação em sequência')}</div>
            <div className="text-sm font-semibold text-stone-700">{groups ? (g ? t('Post {a} de {b}', { a: idx + 1, b: groups.length }) : t('Tudo revisado')) : '…'}{groups && pending > 0 && g ? ` · ${t('{n} pendente(s)', { n: pending })}` : ''}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500"><X size={20} /></button>
        </div>

        {!groups ? <div className="py-24 text-center text-stone-400"><Loader2 className="animate-spin inline" /></div> : !g ? (
          <div className="py-16 px-6 text-center">
            <PartyPopper size={40} className="mx-auto text-amber-500" />
            <h3 className="mt-4 text-2xl font-bold text-stone-900">{groups.length ? t('Você revisou tudo') : t('Nada esperando a sua aprovação')}</h3>
            {groups.length > 0 && <p className="mt-2 text-stone-500">{t('{a} aprovado(s) · {b} com ajuste pedido', { a: Object.values(result).filter(x => x === 'approved').length, b: Object.values(result).filter(x => x === 'changes').length })}</p>}
            <button onClick={() => { onDone?.(); onClose(); }} className="mt-6 px-6 py-3 rounded-2xl bg-stone-900 text-white font-bold">{t('Concluir')}</button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid md:grid-cols-[1.1fr_1fr]">
            <div className="bg-stone-50 flex items-center justify-center p-4 min-h-[280px]">
              {images.length ? (
                <div className="w-full flex gap-2 overflow-x-auto snap-x">
                  {images.map((src, i) => /\.(mp4|mov|webm)(\?|$)/i.test(src)
                    ? <video key={i} src={src} poster={main.video_thumbnail_url || undefined} controls className="max-h-[60vh] rounded-2xl snap-center mx-auto" />
                    : <img key={i} src={src} alt="" className="max-h-[60vh] rounded-2xl object-contain snap-center mx-auto" />)}
                </div>
              ) : <div className="text-stone-400 text-sm">{t('Sem imagem ainda')}</div>}
            </div>
            <div className="p-5 sm:p-7 flex flex-col gap-4">
              <div>
                <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">{dateOf(main.date_key, main.scheduled_time)}{main.type ? ` · ${t(main.type)}` : ''}</div>
                <h3 className="mt-1 text-xl font-bold text-stone-900">{main.theme_title || main.theme || 'Post'}</h3>
                {result[g[0].id] && <span className={`inline-block mt-2 text-xs font-bold px-2 py-1 rounded-lg ${result[g[0].id] === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>{result[g[0].id] === 'approved' ? t('Aprovado') : t('Ajuste enviado')}</span>}
              </div>
              {main.caption && <div className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed bg-stone-50 rounded-2xl p-4 max-h-64 overflow-y-auto">{main.caption}</div>}
              {askFix && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">{QUICK.map(q => <button key={q} onClick={() => setFix(f => f ? `${f}${/[.\n]$/.test(f) ? '' : '.'} ${t(q)}` : t(q))} className="text-xs px-2.5 py-1.5 rounded-full border border-stone-200 text-stone-600 hover:bg-stone-50">+ {t(q)}</button>)}</div>
                  <textarea autoFocus value={fix} onChange={e => setFix(e.target.value)} rows={3} placeholder={t('O que precisa ajustar?')} className="w-full rounded-2xl border border-stone-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <button disabled={busy || readOnly} onClick={() => act('approved')} className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-600 text-white font-bold disabled:opacity-40">{busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {t('Aprovar')}</button>
                <button disabled={busy || readOnly} onClick={() => act('changes')} className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-stone-200 text-stone-800 font-bold disabled:opacity-40"><Pencil size={17} /> {askFix ? t('Enviar ajuste') : t('Pedir ajuste')}</button>
              </div>
              <div className="flex items-center justify-between text-sm text-stone-500">
                <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} className="inline-flex items-center gap-1 disabled:opacity-30"><ChevronLeft size={16} /> {t('Anterior')}</button>
                <span className="hidden sm:inline text-[11px] text-stone-400">{t('Atalhos: A aprova · R pede ajuste · ← → navega')}</span>
                <button onClick={() => setIdx(i => Math.min(groups.length, i + 1))} className="inline-flex items-center gap-1">{t('Próxima')} <ChevronRight size={16} /></button>
              </div>
              {readOnly && <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-2">{t('Pré-visualização da equipe: é assim que o cliente vê. Os botões não salvam.')}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

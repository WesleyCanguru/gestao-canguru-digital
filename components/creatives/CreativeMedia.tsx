import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Film, Images, ExternalLink, ImageOff, PlayCircle } from 'lucide-react';
import { CreativeItem, CreativeMedia, embedUrl, linkThumb, mediaSrc } from '../../lib/creatives';
import { useT } from '../../lib/i18n';

/** Miniatura de uma peça (grade e listas). */
export const CreativeThumb: React.FC<{ item: Pick<CreativeItem, 'kind' | 'media'>; signed: Record<string, string>; className?: string }> = ({ item, signed, className = '' }) => {
  const { t } = useT();
  const first = item.media?.[0];
  const src = first ? mediaSrc(first, signed) : null;
  const badge = item.kind === 'carousel' ? (
    <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold"><Images size={11} /> {item.media.length}</span>
  ) : item.kind === 'video' ? (
    <span className="absolute inset-0 flex items-center justify-center pointer-events-none"><PlayCircle size={34} className="text-white drop-shadow-lg" /></span>
  ) : null;

  let inner: React.ReactNode = <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageOff size={22} /></div>;
  if (first?.type === 'image' && src) inner = <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />;
  else if (first?.type === 'video' && src) inner = <video src={`${src}#t=0.5`} muted playsInline preload="metadata" className="w-full h-full object-cover" />;
  else if (first?.type === 'link' && first.url) {
    const t = linkThumb(first.url);
    inner = (
      <div className="relative w-full h-full flex items-center justify-center bg-stone-900 text-white/60">
        <Film size={24} />
        {t && <img src={t} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
      </div>
    );
  }
  return <div className={`relative overflow-hidden bg-stone-100 ${className}`}>{inner}{badge}</div>;
};

const SingleMedia: React.FC<{ m: CreativeMedia; signed: Record<string, string>; active: boolean }> = ({ m, signed, active }) => {
  const { t } = useT();
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (!active && ref.current) ref.current.pause(); }, [active]);
  const src = mediaSrc(m, signed);
  if (m.type === 'image') return src
    ? <img src={src} alt={m.name || ''} className="max-h-full max-w-full object-contain select-none" draggable={false} />
    : <div className="text-white/50 text-sm">{t('Carregando...')}</div>;
  if (m.type === 'video') return src
    ? <video ref={ref} src={src} controls playsInline preload="metadata" className="max-h-full max-w-full rounded-lg bg-black" />
    : <div className="text-white/50 text-sm">{t('Carregando...')}</div>;
  const emb = m.url ? embedUrl(m.url) : null;
  if (emb) return (
    <div className="w-full h-full flex items-center justify-center">
      <iframe src={emb} title={m.name || 'Vídeo'} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen
        className="w-full h-full max-w-3xl rounded-lg bg-black" />
    </div>
  );
  return (
    <a href={m.url || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white text-brand-dark text-sm font-bold">
      <ExternalLink size={16} /> Abrir vídeo
    </a>
  );
};

/** Mídia em tamanho grande: imagem, carrossel deslizando ou vídeo tocando. */
export const CreativeStage: React.FC<{ item: Pick<CreativeItem, 'id' | 'kind' | 'media'>; signed: Record<string, string> }> = ({ item, signed }) => {
  const { t } = useT();
  const [idx, setIdx] = useState(0);
  const touch = useRef<number | null>(null);
  useEffect(() => { setIdx(0); }, [item.id]);
  const n = item.media?.length || 0;
  if (!n) return <div className="h-full flex items-center justify-center text-white/50 text-sm">{t('Sem arquivo')}</div>;
  const go = (d: number) => setIdx(i => Math.min(n - 1, Math.max(0, i + d)));

  return (
    <div className="relative w-full h-full flex items-center justify-center"
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}>
      {item.media.map((m, i) => (
        <div key={i} className={`absolute inset-0 flex items-center justify-center p-3 sm:p-6 transition-opacity duration-200 ${i === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {Math.abs(i - idx) <= 1 && <SingleMedia m={m} signed={signed} active={i === idx} />}
        </div>
      ))}
      {n > 1 && (
        <>
          <button onClick={() => go(-1)} disabled={idx === 0} aria-label={t('Anterior')}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-brand-dark shadow flex items-center justify-center disabled:opacity-0 transition-opacity"><ChevronLeft size={20} /></button>
          <button onClick={() => go(1)} disabled={idx === n - 1} aria-label={t('Próxima')}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-brand-dark shadow flex items-center justify-center disabled:opacity-0 transition-opacity"><ChevronRight size={20} /></button>
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
            {item.media.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} aria-label={`Imagem ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />
            ))}
          </div>
          <span className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/60 text-white text-[11px] font-bold tabular-nums">{idx + 1}/{n}</span>
        </>
      )}
    </div>
  );
};

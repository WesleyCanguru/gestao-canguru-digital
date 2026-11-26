import React, { useState } from 'react';
import { ChevronDown, Image as ImageIcon } from 'lucide-react';
import { Lang, tr } from '../../lib/accessGuides';
import { Shot } from '../../lib/accessShots';

/** Passo a passo com prints, aberto sob demanda para não pesar a página. */
export const ShotGallery: React.FC<{ shots: Shot[]; lang: Lang; label?: string; defaultOpen?: boolean }> = ({ shots, lang, label, defaultOpen }) => {
  const t = tr(lang);
  const [open, setOpen] = useState(!!defaultOpen);
  if (!shots.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50">
        <ImageIcon size={15} className="text-gray-500" />
        <span className="flex-1">{label || t('Ver o passo a passo com imagens', 'See it step by step with pictures', 'Ver el paso a paso con imágenes')}</span>
        <ChevronDown size={16} className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="divide-y divide-gray-100 border-t border-gray-100">
          {shots.map((s, i) => (
            <li key={s.src} className="p-4 space-y-2">
              <p className="text-sm text-gray-800"><span className="font-bold mr-1.5">{i + 1}.</span>{s.caption}</p>
              <a href={s.src} target="_blank" rel="noreferrer">
                <img src={s.src} alt={s.caption} loading="lazy" className="w-full rounded-lg border border-gray-200" />
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

import React from 'react';
import { X } from 'lucide-react';

/**
 * Fecha a visualização da equipe (proposta ou estratégia aberta pelo botão "Ver").
 * - Aba aberta pelo navegador (Mac): fecha a aba.
 * - Bolsa instalada no iPhone (tela de início): a página abre dentro do app, sem aba para fechar;
 *   então volta para a tela anterior ou, se não houver, para a Bolsa na aba indicada.
 */
export const closePreview = (fallbackTab: string) => {
  const cameFromBolsa = (() => {
    try { return !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch { return false; }
  })();
  if (cameFromBolsa && window.history.length > 1) { window.history.back(); return; }
  try { window.close(); } catch { /* ignora */ }
  setTimeout(() => { if (!window.closed) window.location.href = `/?tab=${fallbackTab}`; }, 250);
};

/** Botão fixo "Fechar" no canto superior direito. Só aparece na visualização da equipe. */
export const PreviewCloseButton: React.FC<{ fallbackTab: string }> = ({ fallbackTab }) => (
  <button
    type="button"
    onClick={() => closePreview(fallbackTab)}
    aria-label="Fechar visualização"
    className="fixed right-3 z-[60] inline-flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full bg-[#13284D] text-white text-[13px] font-semibold shadow-lg"
    style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
  >
    <X size={16} /> Fechar
  </button>
);

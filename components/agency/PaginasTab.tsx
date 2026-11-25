import React from 'react';
import { useAuth } from '../../lib/supabase';
import { PageVisitsPanel, pagesForAgency } from './PageVisitsPanel';

/** Comercial > Páginas de apresentação: páginas sem preço mandadas 1:1 no WhatsApp, uma por nicho (hoje só advocacia). */
export const PaginasTab: React.FC = () => {
  const { agencyId } = useAuth();
  const pages = pagesForAgency(agencyId);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Páginas de apresentação</h2>
        <p className="text-sm text-gray-500 mt-1">Como a Canguru trabalha, por nicho, sem preço. A pessoa digita o nome ao abrir; no mesmo aparelho não pergunta de novo. Mostra quantas vezes abriu, quanto tempo ficou, se chamou no WhatsApp e se foi para o site. Abrir com "Ver" não conta.</p>
      </div>
      {pages.length === 0
        ? <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-sm text-gray-500">Nenhuma página de apresentação nesta agência.</div>
        : pages.map(([slug]) => <PageVisitsPanel key={slug} slug={slug} />)}
    </div>
  );
};

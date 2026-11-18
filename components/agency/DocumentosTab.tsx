import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { ArrowLeft, ExternalLink, FolderLock, Loader2 } from 'lucide-react';
import { supabase, useAuth } from '../../lib/supabase';

type Doc = { id: string; slug: string; title: string; version: number; updated_at: string };

/**
 * Documentos internos: páginas da própria agência (manual da marca, time, plano...).
 * Ficam na tabela guides com audience = 'interno'. Só quem é da equipe ou sócio da agência lê
 * (regra no banco: o link /g/ desses documentos não abre sem login).
 * Mudanças pelo Claude Code, direto no banco, guardando a versão anterior em guide_versions.
 */
export const DocumentosTab: React.FC = () => {
  const { agencyId } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<{ doc: Doc; html: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!agencyId) return;
    let alive = true;
    setLoading(true);
    supabase.from('guides').select('id, slug, title, version, updated_at')
      .eq('agency_id', agencyId).eq('audience', 'interno').eq('is_published', true)
      .order('title')
      .then(({ data }) => { if (alive) { setDocs((data as Doc[]) || []); setLoading(false); } });
    return () => { alive = false; };
  }, [agencyId]);

  const openDoc = async (d: Doc) => {
    setOpening(d.id);
    const { data } = await supabase.from('guides').select('content').eq('id', d.id).single();
    setOpening(null);
    const html = (data as any)?.content?.html;
    if (html) setOpen({ doc: d, html });
  };

  if (open) return (
    <div className="px-2 sm:px-4 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setOpen(null)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Documentos internos
        </button>
        <a href={`/g/${open.doc.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900">
          Tela cheia <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      <iframe title={open.doc.title} srcDoc={open.html} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        className="w-full border border-gray-200 rounded-2xl bg-[#0B0D0F] block" style={{ height: 'calc(100dvh - 150px)', minHeight: 520 }} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documentos internos</h1>
        <p className="mt-1 text-gray-600">Material da casa para os sócios e a equipe: marca, time e plano. Só abre com login.</p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">Nenhum documento interno ainda.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map(d => (
            <button key={d.id} onClick={() => openDoc(d)} disabled={opening === d.id}
              className="text-left rounded-2xl border border-gray-200 bg-white p-5 hover:border-gray-400 hover:shadow-sm transition disabled:opacity-60">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {opening === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderLock className="w-4 h-4" />} Interno
              </div>
              <div className="mt-2 text-lg font-bold text-gray-900">{d.title}</div>
              <div className="mt-1 text-sm text-gray-500">Versão {d.version} · atualizado em {dayjs(d.updated_at).format('DD/MM/YYYY')}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

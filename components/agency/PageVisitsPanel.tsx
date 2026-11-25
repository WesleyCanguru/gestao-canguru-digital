import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Eye, Clock, MessageCircle, ChevronDown, Copy, ExternalLink, Monitor, Smartphone, RotateCw } from 'lucide-react';
import { supabase, useAuth } from '../../lib/supabase';
import { getAppUrl } from '../../lib/appUrl';
import { geoLabel } from '../../lib/geo';

/** Páginas comerciais com portão de nome (arquivos em public/paginas, rastreio pela função page-track). */
const PAGES: Record<string, { agency: number; path: string; label: string }> = {
  advocacia: { agency: 1, path: '/advocacia', label: 'Como trabalhamos (advocacia)' },
};

type Row = {
  id: number; page_slug: string; visitor_id: string; visitor_name: string | null; session_id: string;
  event_type: 'open' | 'read_time' | 'whatsapp_click'; seconds: number | null; visit_number: number | null;
  user_agent: string | null; city: string | null; region: string | null; country: string | null; created_at: string;
};
type Visit = { session: string; at: string; geo: string; ua: string | null; seconds: number; wa: boolean };
type Person = { id: string; name: string; page: string; visits: Visit[]; total: number; wa: number; last: string };

const fmtDur = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min${Math.round(s % 60) ? ` ${Math.round(s % 60)} s` : ''}`);
const device = (ua?: string | null) => {
  const u = ua || '';
  const mobile = /iPhone|Android.+Mobile|Mobile Safari/i.test(u);
  const name = /iPhone/i.test(u) ? 'iPhone' : /iPad/i.test(u) ? 'iPad' : /Android/i.test(u) ? 'Android' : /Mac OS X|Macintosh/i.test(u) ? 'Mac' : /Windows/i.test(u) ? 'Windows' : 'Outro';
  return { mobile, name };
};

/** Comercial > Propostas: quem abriu as páginas de apresentação, quantas vezes, por quanto tempo e se chamou no WhatsApp. */
export const PageVisitsPanel: React.FC = () => {
  const { agencyId } = useAuth();
  const pages = useMemo(() => Object.entries(PAGES).filter(([, p]) => p.agency === agencyId), [agencyId]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!agencyId || !pages.length) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('page_visits').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(2000);
      setRows((data as Row[]) || []);
      setLoading(false);
    })();
  }, [agencyId, pages.length, reload]);

  const people = useMemo<Person[]>(() => {
    const readBy: Record<string, number> = {};
    const waBy: Record<string, boolean> = {};
    rows.forEach(r => {
      if (r.event_type === 'read_time') readBy[r.session_id] = Math.max(readBy[r.session_id] || 0, r.seconds || 0);
      if (r.event_type === 'whatsapp_click') waBy[r.session_id] = true;
    });
    const map = new Map<string, Person>();
    rows.filter(r => r.event_type === 'open').forEach(r => {
      const key = `${r.page_slug}|${r.visitor_id}`;
      if (!map.has(key)) map.set(key, { id: key, name: r.visitor_name || 'Sem nome', page: r.page_slug, visits: [], total: 0, wa: 0, last: r.created_at });
      const p = map.get(key)!;
      const secs = readBy[r.session_id] || 0;
      p.visits.push({ session: r.session_id, at: r.created_at, geo: geoLabel(r), ua: r.user_agent, seconds: secs, wa: !!waBy[r.session_id] });
      p.total += secs;
      if (waBy[r.session_id]) p.wa += 1;
      if (r.created_at > p.last) p.last = r.created_at;
    });
    return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
  }, [rows]);

  if (!pages.length) return null;

  const copy = (path: string) => {
    navigator.clipboard?.writeText(`${getAppUrl()}${path}`);
    setToast('Link copiado.'); setTimeout(() => setToast(''), 1800);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">Página de apresentação</h3>
          <p className="text-xs text-gray-500 mt-1">Quem abriu, quantas vezes, por quanto tempo e se chamou no WhatsApp. A pessoa digita o nome ao abrir; no mesmo aparelho não pergunta de novo. Abrir com "Ver" não conta.</p>
        </div>
        <div className="flex flex-wrap gap-1.5 self-start">
          {pages.map(([slug, p]) => (
            <React.Fragment key={slug}>
              <a href={`${p.path}?preview`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"><ExternalLink size={14} /> Ver</a>
              <button onClick={() => copy(p.path)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold"><Copy size={14} /> Copiar link</button>
            </React.Fragment>
          ))}
          <button onClick={() => setReload(r => r + 1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Atualizar" title="Atualizar"><RotateCw size={15} /></button>
        </div>
      </div>

      {loading ? <p className="px-5 pb-5 text-sm text-gray-400">Carregando...</p> : people.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-gray-500">Ninguém abriu ainda.</p>
      ) : (
        <ul className="border-t border-gray-100 divide-y divide-gray-100">
          {people.map(p => {
            const isOpen = open === p.id;
            return (
              <li key={p.id}>
                <div className="px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    {pages.length > 1 && <p className="text-xs text-gray-500">{PAGES[p.page]?.label || p.page}</p>}
                  </div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">Visitas</p><p className="font-semibold text-gray-900 inline-flex items-center gap-1"><Eye size={14} /> {p.visits.length}</p></div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">Última visita</p><p className="font-semibold text-gray-900">{dayjs(p.last).format('DD/MM [às] HH:mm')}</p></div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">Tempo total</p><p className="font-semibold text-gray-900 inline-flex items-center gap-1"><Clock size={14} /> {fmtDur(p.total)}</p></div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">WhatsApp</p><p className={`font-semibold inline-flex items-center gap-1 ${p.wa ? 'text-emerald-700' : 'text-gray-900'}`}><MessageCircle size={14} /> {p.wa ? 'Clicou' : 'Não clicou'}</p></div>
                  <button onClick={() => setOpen(isOpen ? null : p.id)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 ml-auto" aria-label="Ver cada visita">
                    <ChevronDown size={16} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>
                </div>
                {isOpen && (
                  <div className="border-t border-gray-50 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-[11px] text-gray-400 uppercase tracking-wider text-left">
                        <th className="px-5 py-2.5 font-semibold">Quando</th><th className="px-5 py-2.5 font-semibold">De onde</th><th className="px-5 py-2.5 font-semibold">Aparelho</th><th className="px-5 py-2.5 font-semibold">Ficou</th><th className="px-5 py-2.5 font-semibold">WhatsApp</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {p.visits.map(v => {
                          const d = device(v.ua);
                          return (
                            <tr key={v.session}>
                              <td className="px-5 py-2.5 whitespace-nowrap">{dayjs(v.at).format('DD/MM/YYYY [às] HH:mm')}</td>
                              <td className="px-5 py-2.5 whitespace-nowrap text-gray-600">{v.geo || '—'}</td>
                              <td className="px-5 py-2.5 whitespace-nowrap"><span className="inline-flex items-center gap-1.5">{d.mobile ? <Smartphone size={14} /> : <Monitor size={14} />} {d.name}</span></td>
                              <td className="px-5 py-2.5 whitespace-nowrap">{v.seconds ? fmtDur(v.seconds) : '—'}</td>
                              <td className="px-5 py-2.5">{v.wa ? <span className="text-emerald-700 font-semibold">Clicou</span> : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>}
    </div>
  );
};

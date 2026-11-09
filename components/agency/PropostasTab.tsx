import React, { useEffect, useMemo, useState } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { getAppUrl } from '../../lib/appUrl';
import { formatMoney } from '../../lib/money';
import dayjs from 'dayjs';
import { ExternalLink, Copy, Eye, Clock, MessageCircle, Monitor, Smartphone, ChevronDown } from 'lucide-react';

type Proposal = { id: string; slug: string; prospect_name: string; title: string | null; monthly_value: number | null; setup_value: number | null; currency: string | null; status: string | null; created_at: string };
type Ev = { id: string; proposal_id: string; event_type: string; session_id: string | null; seconds: number | null; user_agent: string | null; created_at: string };

/** Navegador e aparelho a partir do user agent (sem biblioteca). */
const parseUA = (ua?: string | null) => {
  const u = ua || '';
  const mobile = /iPhone|Android.+Mobile|Mobile Safari/i.test(u);
  const device = /iPhone/i.test(u) ? 'iPhone' : /iPad/i.test(u) ? 'iPad' : /Android/i.test(u) ? 'Android' : /Mac OS X|Macintosh/i.test(u) ? 'Mac' : /Windows/i.test(u) ? 'Windows' : 'Outro';
  const browser = /Instagram/i.test(u) ? 'Instagram' : /FBAN|FBAV/i.test(u) ? 'Facebook' : /WhatsApp/i.test(u) ? 'WhatsApp' : /Edg\//i.test(u) ? 'Edge'
    : /OPR\//i.test(u) ? 'Opera' : /SamsungBrowser/i.test(u) ? 'Samsung' : /CriOS|Chrome\//i.test(u) ? 'Chrome' : /FxiOS|Firefox/i.test(u) ? 'Firefox' : /Safari/i.test(u) ? 'Safari' : 'Outro';
  return { mobile, device, browser };
};
const fmtDur = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);

/** Comercial > Propostas: quem abriu, quando, quanto tempo leu, em qual aparelho e se clicou no WhatsApp. */
export const PropostasTab: React.FC = () => {
  const { agencyId } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!agencyId) return;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase.from('proposals').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false });
      const list = (p as Proposal[]) || [];
      setProposals(list);
      if (list.length) {
        const { data: e } = await supabase.from('proposal_events').select('*').in('proposal_id', list.map(x => x.id)).order('created_at', { ascending: false });
        setEvents((e as Ev[]) || []);
      }
      setLoading(false);
    })();
  }, [agencyId]);

  const statsOf = useMemo(() => (id: string) => {
    const ev = events.filter(e => e.proposal_id === id);
    const opens = ev.filter(e => e.event_type === 'open');
    const read = ev.filter(e => e.event_type === 'read_time').reduce((a, e) => a + (e.seconds || 0), 0);
    const wa = ev.filter(e => e.event_type === 'whatsapp_click');
    const readBySession: Record<string, number> = {};
    ev.filter(e => e.event_type === 'read_time' && e.session_id).forEach(e => { readBySession[e.session_id!] = Math.max(readBySession[e.session_id!] || 0, e.seconds || 0); });
    return { opens, read, wa, readBySession, last: opens[0]?.created_at || null };
  }, [events]);

  const copy = (slug: string) => { navigator.clipboard?.writeText(`${getAppUrl()}/p/${slug}`); setToast('Link copiado.'); setTimeout(() => setToast(''), 1800); };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Propostas</h2>
        <p className="text-sm text-gray-500 mt-1">Quem abriu, quando, quanto tempo leu e em qual aparelho. Abrir com "Ver" (prévia) não conta.</p>
      </div>

      {loading ? <p className="text-sm text-gray-400">Carregando...</p> : proposals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-sm text-gray-500">Nenhuma proposta ainda.</div>
      ) : (
        <ul className="space-y-3">
          {proposals.map(p => {
            const s = statsOf(p.id);
            const isOpen = open === p.id;
            return (
              <li key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="p-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="font-semibold text-gray-900 truncate">{p.prospect_name}</p>
                    <p className="text-xs text-gray-500">{p.title || 'Proposta'} · criada em {dayjs(p.created_at).format('DD/MM/YYYY')}
                      {p.monthly_value ? ` · ${formatMoney(p.monthly_value, p.currency)}/mês` : ''}</p>
                  </div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">Aberturas</p><p className="font-semibold text-gray-900 inline-flex items-center gap-1"><Eye size={14} /> {s.opens.length}</p></div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">Última abertura</p><p className="font-semibold text-gray-900">{s.last ? dayjs(s.last).format('DD/MM [às] HH:mm') : 'Ainda não abriu'}</p></div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">Tempo de leitura</p><p className="font-semibold text-gray-900 inline-flex items-center gap-1"><Clock size={14} /> {fmtDur(s.read)}</p></div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">WhatsApp</p><p className={`font-semibold inline-flex items-center gap-1 ${s.wa.length ? 'text-emerald-700' : 'text-gray-900'}`}><MessageCircle size={14} /> {s.wa.length ? `${s.wa.length} clique(s)` : 'Não clicou'}</p></div>
                  <div className="flex gap-1.5 ml-auto">
                    <a href={`/p/${p.slug}?preview`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"><ExternalLink size={14} /> Ver</a>
                    <button onClick={() => copy(p.slug)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"><Copy size={14} /> Link</button>
                    {s.opens.length > 0 && (
                      <button onClick={() => setOpen(isOpen ? null : p.id)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Ver cada abertura">
                        <ChevronDown size={16} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                      </button>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-[11px] text-gray-400 uppercase tracking-wider text-left">
                        <th className="px-5 py-2.5 font-semibold">Quando</th><th className="px-5 py-2.5 font-semibold">Aparelho</th><th className="px-5 py-2.5 font-semibold">Navegador</th><th className="px-5 py-2.5 font-semibold">Leu por</th><th className="px-5 py-2.5 font-semibold">WhatsApp</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {s.opens.map(o => {
                          const ua = parseUA(o.user_agent);
                          const clicked = s.wa.some(w => w.session_id && w.session_id === o.session_id);
                          return (
                            <tr key={o.id}>
                              <td className="px-5 py-2.5 whitespace-nowrap">{dayjs(o.created_at).format('DD/MM/YYYY [às] HH:mm')}</td>
                              <td className="px-5 py-2.5 whitespace-nowrap"><span className="inline-flex items-center gap-1.5">{ua.mobile ? <Smartphone size={14} /> : <Monitor size={14} />} {ua.device}</span></td>
                              <td className="px-5 py-2.5">{ua.browser}</td>
                              <td className="px-5 py-2.5 whitespace-nowrap">{o.session_id && s.readBySession[o.session_id] ? fmtDur(s.readBySession[o.session_id]) : '—'}</td>
                              <td className="px-5 py-2.5">{clicked ? <span className="text-emerald-700 font-semibold">Clicou</span> : '—'}</td>
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
      {toast && <div className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[70] bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg">{toast}</div>}
    </div>
  );
};

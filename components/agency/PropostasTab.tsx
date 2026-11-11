import React, { useEffect, useMemo, useState } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { getAppUrl } from '../../lib/appUrl';
import { formatMoney } from '../../lib/money';
import dayjs from 'dayjs';
import { ExternalLink, Copy, Eye, Clock, MessageCircle, Monitor, Smartphone, ChevronDown, Plus, Sparkles, Send, Trash2, Loader2, X, History, RotateCcw } from 'lucide-react';
import { callFunction } from '../../lib/supabase';
import { NewProposalModal } from '../proposals/NewProposalModal';

type Proposal = { id: string; slug: string; prospect_name: string; title: string | null; whatsapp?: string | null; language?: string | null; version?: number; content?: any; draft_content?: any; draft_instructions?: string | null; draft_created_at?: string | null; monthly_value: number | null; setup_value: number | null; currency: string | null; status: string | null; created_at: string };
type Version = { id: string; version: number; created_at: string };
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
  const [creating, setCreating] = useState(false);
  const [adjustFor, setAdjustFor] = useState<Proposal | null>(null);
  const [adjustText, setAdjustText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<Proposal | null>(null);
  const [historyFor, setHistoryFor] = useState<Proposal | null>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [reload, setReload] = useState(0);
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  const linkOf = (p: Proposal) => `${getAppUrl()}/p/${p.slug}`;
  const messageOf = (p: Proposal) => p.language === 'en'
    ? `Hi! Here is our proposal for ${p.prospect_name}. Everything is on this page: ${linkOf(p)}`
    : p.language === 'es' ? `¡Hola! Aquí está nuestra propuesta para ${p.prospect_name}. Está todo en esta página: ${linkOf(p)}`
    : `Olá! Segue a nossa proposta para a ${p.prospect_name}. Está tudo nesta página: ${linkOf(p)}`;
  const publish = async (p: Proposal) => {
    setBusy(`pub-${p.id}`);
    const { error } = await supabase.from('proposals').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', p.id);
    setBusy(null);
    if (error) { notify(error.message); return; }
    setShareFor({ ...p, status: 'sent' }); setReload(r => r + 1);
  };
  const remove = async (p: Proposal) => {
    if (!window.confirm(`Excluir o rascunho da proposta para ${p.prospect_name}?`)) return;
    const { error } = await supabase.from('proposals').delete().eq('id', p.id);
    if (error) notify(error.message); else setReload(r => r + 1);
  };
  const askAdjust = async () => {
    if (!adjustFor || !adjustText.trim()) return;
    setBusy(`adj-${adjustFor.id}`);
    const { data, error } = await callFunction<{ pending?: boolean }>('generate-proposal', { action: 'revise', proposal_id: adjustFor.id, instructions: adjustText.trim() });
    setBusy(null);
    if (error) { notify(error); return; }
    setAdjustFor(null); setAdjustText(''); setReload(r => r + 1);
    notify(data?.pending ? 'Ajuste pronto. Clique em Ver ajuste para conferir.' : 'Nova versão pronta. Clique em Ver para conferir.');
  };
  const draftAction = async (p: Proposal, action: 'publish_draft' | 'discard_draft') => {
    const ok = action === 'publish_draft'
      ? window.confirm('Publicar o ajuste? O link do cliente passa a mostrar a versão nova.')
      : window.confirm('Descartar este ajuste? O cliente continua vendo a versão atual.');
    if (!ok) return;
    setBusy(`${action}-${p.id}`);
    const { error } = await callFunction('generate-proposal', { action, proposal_id: p.id });
    setBusy(null);
    if (error) { notify(error); return; }
    setReload(r => r + 1);
    notify(action === 'publish_draft' ? 'Ajuste publicado. O link continua o mesmo.' : 'Ajuste descartado.');
  };
  const openHistory = async (p: Proposal) => {
    setHistoryFor(p); setVersions(null);
    const { data } = await supabase.from('proposal_versions').select('id, version, created_at').eq('proposal_id', p.id).order('version', { ascending: false });
    setVersions((data as Version[]) || []);
  };
  const restore = async (v: Version) => {
    if (!historyFor) return;
    const isDraft = historyFor.status === 'draft';
    if (!window.confirm(isDraft ? `Voltar para a versão ${v.version}?` : `Voltar para a versão ${v.version}? Ela vira um ajuste para você revisar antes de publicar.`)) return;
    setBusy(`restore-${v.id}`);
    const { error } = await callFunction('generate-proposal', { action: 'restore', proposal_id: historyFor.id, version_id: v.id });
    setBusy(null);
    if (error) { notify(error); return; }
    setHistoryFor(null); setReload(r => r + 1);
    notify(isDraft ? 'Versão restaurada.' : 'Essa versão virou um ajuste para revisar. Publique quando quiser.');
  };

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
  }, [agencyId, reload]);

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Propostas</h2>
          <p className="text-sm text-gray-500 mt-1">Crie com o Claude a partir da reunião e acompanhe quem abriu, quando, por quanto tempo e em qual aparelho. Abrir com "Ver" não conta.</p>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold self-start"><Plus size={16} /> Nova proposta</button>
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
                    <p className="font-semibold text-gray-900 truncate">{p.prospect_name}
                      {p.status === 'draft' && <span className="ml-2 align-middle text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">Rascunho{p.version && p.version > 1 ? ` v${p.version}` : ''}</span>}
                      {p.status !== 'draft' && p.draft_content && <span className="ml-2 align-middle text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800">Ajuste para revisar</span>}
                    </p>
                    <p className="text-xs text-gray-500">{p.title || 'Proposta'} · criada em {dayjs(p.created_at).format('DD/MM/YYYY')}
                      {p.monthly_value ? ` · ${formatMoney(p.monthly_value, p.currency)}/mês` : ''}</p>
                  </div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">Aberturas</p><p className="font-semibold text-gray-900 inline-flex items-center gap-1"><Eye size={14} /> {s.opens.length}</p></div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">Última abertura</p><p className="font-semibold text-gray-900">{s.last ? dayjs(s.last).format('DD/MM [às] HH:mm') : 'Ainda não abriu'}</p></div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">Tempo de leitura</p><p className="font-semibold text-gray-900 inline-flex items-center gap-1"><Clock size={14} /> {fmtDur(s.read)}</p></div>
                  <div className="text-sm"><p className="text-[11px] text-gray-400">WhatsApp</p><p className={`font-semibold inline-flex items-center gap-1 ${s.wa.length ? 'text-emerald-700' : 'text-gray-900'}`}><MessageCircle size={14} /> {s.wa.length ? `${s.wa.length} clique(s)` : 'Não clicou'}</p></div>
                  <div className="flex gap-1.5 ml-auto">
                    <a href={`/p/${p.slug}?preview`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"><ExternalLink size={14} /> Ver</a>
                    {p.status === 'draft' ? (
                      <>
                        <button disabled={!!busy} onClick={() => { setAdjustFor(p); setAdjustText(''); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"><Sparkles size={14} /> Pedir ajuste</button>
                        <button disabled={!!busy} onClick={() => publish(p)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-50">{busy === `pub-${p.id}` ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publicar</button>
                        <button onClick={() => remove(p)} className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Excluir rascunho"><Trash2 size={15} /></button>
                      </>
                    ) : (
                      <>
                        {p.content && <button disabled={!!busy} onClick={() => { setAdjustFor(p); setAdjustText(''); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"><Sparkles size={14} /> Pedir ajuste</button>}
                        <button onClick={() => (p.content ? setShareFor(p) : copy(p.slug))} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"><Copy size={14} /> Link</button>
                      </>
                    )}
                    {p.content && (
                      <button onClick={() => openHistory(p)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Versões anteriores" title="Versões anteriores"><History size={16} /></button>
                    )}
                    {s.opens.length > 0 && (
                      <button onClick={() => setOpen(isOpen ? null : p.id)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Ver cada abertura">
                        <ChevronDown size={16} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                      </button>
                    )}
                  </div>
                </div>
                {p.status !== 'draft' && p.draft_content && (
                  <div className="mx-5 mb-4 -mt-1 p-3 rounded-xl bg-sky-50 border border-sky-100 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-sky-900 min-w-0 flex-1 basis-56 truncate">
                      <span className="font-semibold">Ajuste ainda não publicado</span>{p.draft_instructions ? `: ${p.draft_instructions}` : ''}
                    </p>
                    <a href={`/p/${p.slug}?preview&draft=1`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-sky-200 text-xs font-semibold text-sky-900"><ExternalLink size={13} /> Ver ajuste</a>
                    <button disabled={!!busy} onClick={() => draftAction(p, 'publish_draft')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-50">{busy === `publish_draft-${p.id}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Publicar ajuste</button>
                    <button disabled={!!busy} onClick={() => draftAction(p, 'discard_draft')} className="px-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-rose-600 disabled:opacity-50">{busy === `discard_draft-${p.id}` ? 'Descartando...' : 'Descartar'}</button>
                  </div>
                )}
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
      {creating && <NewProposalModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setReload(r => r + 1); notify('Rascunho pronto. Clique em Ver para revisar.'); }} />}

      {adjustFor && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => !busy && setAdjustFor(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center"><p className="font-bold text-gray-900">Ajustar a proposta para {adjustFor.prospect_name}</p><button onClick={() => setAdjustFor(null)} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button></div>
            <p className="text-xs text-gray-500">
              {adjustFor.status === 'draft' ? 'O Claude parte desta versão e muda só o que você pedir.'
                : adjustFor.draft_content ? 'O Claude parte do ajuste que ainda não foi publicado. O cliente continua vendo a versão atual.'
                : 'O cliente continua vendo a versão atual. Você confere o ajuste e só depois publica.'}
            </p>
            <textarea rows={5} autoFocus value={adjustText} onChange={e => setAdjustText(e.target.value)} placeholder="Ex.: tirar o plano mais barato, mensalidade de R$ 2.500, falar mais do Instagram"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
            <div className="flex justify-end">
              <button disabled={!!busy || !adjustText.trim()} onClick={askAdjust} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy ? 'Ajustando (cerca de 1 minuto)...' : 'Gerar versão ajustada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyFor && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => !busy && setHistoryFor(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center"><p className="font-bold text-gray-900">Versões anteriores · {historyFor.prospect_name}</p><button onClick={() => setHistoryFor(null)} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button></div>
            <p className="text-xs text-gray-500">Versão atual: {historyFor.version || 1}.{historyFor.status !== 'draft' ? ' Ao voltar uma versão, ela vira um ajuste para você revisar antes de publicar.' : ''}</p>
            {versions === null ? <p className="text-sm text-gray-400">Carregando...</p> : versions.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Ainda não há versões anteriores.</p>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {versions.map(v => (
                  <li key={v.id} className="py-2.5 flex items-center gap-3">
                    <p className="text-sm text-gray-800 flex-1">Versão {v.version} <span className="text-gray-400">· {dayjs(v.created_at).format('DD/MM/YYYY [às] HH:mm')}</span></p>
                    <button disabled={!!busy} onClick={() => restore(v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 disabled:opacity-50">
                      {busy === `restore-${v.id}` ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Voltar para esta
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {shareFor && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setShareFor(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center"><p className="font-bold text-gray-900">Pronto para mandar</p><button onClick={() => setShareFor(null)} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button></div>
            <input readOnly value={linkOf(shareFor)} onFocus={e => e.currentTarget.select()} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700" />
            <p className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-800 whitespace-pre-wrap break-words">{messageOf(shareFor)}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => { navigator.clipboard?.writeText(messageOf(shareFor)); notify('Mensagem copiada.'); }} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold"><Copy size={15} /> Copiar mensagem</button>
              <a href={`https://wa.me/${(shareFor.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(messageOf(shareFor))}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold">{shareFor.whatsapp ? 'Abrir conversa no WhatsApp' : 'Abrir WhatsApp'}</a>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[70] bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg">{toast}</div>}
    </div>
  );
};

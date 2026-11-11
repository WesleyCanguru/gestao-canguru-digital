import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, useAuth, callFunction } from '../../lib/supabase';
import { getAppUrl } from '../../lib/appUrl';
import { Client } from '../../types';
import { StrategyRow, StrategyView } from '../strategy/StrategyView';
import { BRIEFING_QUESTIONS } from '../BriefingOnboarding';
import {
  Copy, Check, X, Loader2, Sparkles, Send, Rocket, ExternalLink, Megaphone, Search, AlertCircle, RefreshCw, ChevronRight, Trash2,
} from 'lucide-react';
import dayjs from 'dayjs';

type AccessRow = {
  id: string; client_id: string; platform: 'meta' | 'google';
  situation: 'has_account' | 'needs_account' | 'unknown';
  status: 'pending' | 'client_done' | 'help' | 'agency_creating' | 'verified';
  account_ref: string | null; updated_at: string; contact_email?: string | null;
};
type StrategyFull = StrategyRow & {
  public_token?: string; open_count?: number; last_opened_at?: string | null; read_seconds?: number;
  responded_via?: string | null; responded_name?: string | null;
};

const fmtRead = (secs?: number) => {
  const s = Math.round(secs || 0);
  if (s < 60) return `${s} s`;
  return `${Math.round(s / 60)} min`;
};
const strategyLink = (token?: string) => (token ? `${getAppUrl()}/e/${token}` : '');
const strategyMessage = (lang: 'pt' | 'en' | 'es', client: string, link: string) =>
  lang === 'en' ? `Hi everyone! The ad strategy for ${client} is ready. Everything is in this link, and at the end of the page you can approve it or ask for changes: ${link}`
  : lang === 'es' ? `¡Hola a todos! La estrategia de anuncios de ${client} está lista. Está todo en este enlace, y al final de la página pueden aprobarla o pedir algún ajuste: ${link}`
  : `Olá, pessoal! A estratégia de anúncios da ${client} está pronta. Está tudo neste link, e no final da página tem o botão para aprovar ou pedir algum ajuste: ${link}`;
type Briefing = { client_id: string; briefing_type: string; responses: Record<string, unknown>; is_completed?: boolean };

type Stage = 'cadastro' | 'estrategia' | 'aprovacao' | 'subir' | 'no_ar';

const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: 'cadastro', label: 'Cadastro em andamento', hint: 'O cliente ainda não terminou o cadastro' },
  { id: 'estrategia', label: 'Montar estratégia', hint: 'Gerar com o Claude, revisar e enviar' },
  { id: 'aprovacao', label: 'Aguardando o cliente', hint: 'Estratégia enviada para aprovação' },
  { id: 'subir', label: 'Subir campanha', hint: 'Aprovada, falta colocar no ar' },
  { id: 'no_ar', label: 'No ar', hint: 'Últimos 30 dias' },
];

const ACCESS_LABEL: Record<AccessRow['status'], { text: string; cls: string }> = {
  pending: { text: 'Pendente', cls: 'bg-gray-100 text-gray-600' },
  client_done: { text: 'Cliente enviou', cls: 'bg-sky-50 text-sky-700' },
  help: { text: 'Pediu ajuda / chamada', cls: 'bg-amber-100 text-amber-800' },
  agency_creating: { text: 'Nós criamos', cls: 'bg-violet-50 text-violet-700' },
  verified: { text: 'Conferido', cls: 'bg-emerald-50 text-emerald-700' },
};

const BRIEFING_LABELS: Record<string, string> = {
  oferta: 'O que vende', ticket_medio: 'Ticket médio', objetivo: 'Objetivo', regiao: 'Onde estão os clientes',
  publico: 'Cliente ideal', faixas_etarias: 'Idade', diferencial: 'Diferencial', concorrentes: 'Concorrentes',
  investimento_mensal: 'Investimento em anúncios', ja_anunciou: 'Já anunciou', historico: 'O que funcionou',
  canal_de_venda: 'Como vende', observacoes: 'Observações',
  nicho: 'Nicho', target_location: 'Região', target_interests: 'Interesses', target_age_ranges: 'Idade',
  servicos: 'Serviços contratados', servicos_marcados: 'Serviços contratados',
};

export const OnboardingPipeline: React.FC<{ onOpenClient: (c: Client) => void }> = ({ onOpenClient }) => {
  const { agencyId, currentMembership } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [strategies, setStrategies] = useState<StrategyFull[]>([]);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const since = dayjs().subtract(180, 'day').toISOString();
    const { data: cl } = await supabase.from('clients').select('*').eq('agency_id', agencyId)
      .or(`created_at.gte.${since},campaign_live_at.gte.${dayjs().subtract(30, 'day').toISOString()}`)
      .order('created_at', { ascending: false });
    const list = ((cl as Client[]) || []).filter(c =>
      (c as any).traffic_strategy_data?.created_via === 'public_onboarding' || c.client_status === 'prospect' || (c as any).campaign_live_at);
    const { data: mem } = await supabase.from('agency_members').select('user_id, display_name').eq('agency_id', agencyId);
    setMembers(Object.fromEntries(((mem as any[]) || []).map(m => [m.user_id, (m.display_name || '').split(' ')[0]])));
    const ids = list.map(c => c.id);
    setClients(list);
    if (ids.length) {
      const [a, s, b] = await Promise.all([
        supabase.from('client_platform_access').select('*').in('client_id', ids),
        supabase.from('client_strategies').select('*').in('client_id', ids).order('version', { ascending: false }),
        supabase.from('client_briefings').select('client_id, briefing_type, responses, is_completed').in('briefing_type', ['onboarding', 'trafego_pago']).in('client_id', ids),
      ]);
      setAccess((a.data as AccessRow[]) || []);
      setStrategies((s.data as StrategyFull[]) || []);
      setBriefings((b.data as Briefing[]) || []);
    } else {
      setAccess([]); setStrategies([]); setBriefings([]);
    }
    setLoading(false);
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);

  const latestStrategy = (clientId: string) => strategies.find(s => s.client_id === clientId) || null;
  const accessOf = (clientId: string) => access.filter(a => a.client_id === clientId);
  const trafficBriefingOf = (clientId: string) => briefings.find(b => b.client_id === clientId && b.briefing_type === 'trafego_pago') || null;
  const onboardingBriefingOf = (clientId: string) => briefings.find(b => b.client_id === clientId && b.briefing_type === 'onboarding')?.responses || (clients.find(c => c.id === clientId) as any)?.traffic_strategy_data?.onboarding_briefing || null;

  const stageOf = (c: Client): Stage | null => {
    const any = c as any;
    if (any.campaign_live_at) return dayjs(any.campaign_live_at).isAfter(dayjs().subtract(30, 'day')) ? 'no_ar' : null;
    if (c.onboarding_status !== 'concluido') return 'cadastro';
    const s = latestStrategy(c.id);
    if (!s || s.status === 'draft' || s.status === 'changes') return 'estrategia';
    if (s.status === 'sent') return 'aprovacao';
    return 'subir';
  };

  const grouped = useMemo(() => {
    const g: Record<Stage, Client[]> = { cadastro: [], estrategia: [], aprovacao: [], subir: [], no_ar: [] };
    clients.forEach(c => { const st = stageOf(c); if (st) g[st].push(c); });
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, strategies]);

  const helpClients = clients.filter(c => accessOf(c.id).some(a => a.status === 'help'));
  // Cada pessoa copia o próprio link: o cliente fica marcado como trazido por ela e o contato final vai para ela
  const signupLink = `${getAppUrl()}/cadastro?agency=${currentMembership?.slug ?? ''}${currentMembership?.ref_code ? `&ref=${currentMembership.ref_code}` : ''}`;
  const copyLink = () => { navigator.clipboard?.writeText(signupLink); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  const open = clients.find(c => c.id === openId) || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Novos clientes</h2>
          <p className="text-sm text-gray-500">Do cadastro até a campanha no ar.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 pl-3 pr-1 py-1 rounded-xl border border-gray-200 bg-white max-w-md">
            <span className="text-xs text-gray-500 truncate">{signupLink}</span>
            <button onClick={copyLink} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold">
              {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copiado' : 'Copiar link de cadastro'}
            </button>
          </div>
          <button onClick={copyLink} className="sm:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold">
            {copied ? <Check size={14} /> : <Copy size={14} />} Link de cadastro
          </button>
          <button onClick={load} className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-900" title="Atualizar"><RefreshCw size={16} /></button>
        </div>
      </div>

      {!loading && helpClients.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <p className="text-sm font-bold text-amber-900 flex items-center gap-2"><AlertCircle size={16} /> {helpClients.length === 1 ? '1 cliente pediu ajuda com os acessos' : `${helpClients.length} clientes pediram ajuda com os acessos`}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {helpClients.map(c => (
              <button key={c.id} onClick={() => setOpenId(c.id)} className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-xs font-semibold text-amber-900 hover:border-amber-300">
                {c.name} · {accessOf(c.id).filter(a => a.status === 'help').map(a => (a.platform === 'meta' ? 'Meta' : 'Google')).join(' e ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center text-gray-400"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {STAGES.map(st => (
            <div key={st.id} className="bg-gray-50/80 rounded-2xl p-3 border border-gray-100 min-h-[140px]">
              <div className="px-1 mb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">{st.label}</h3>
                  <span className="text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">{grouped[st.id].length}</span>
                </div>
                <p className="text-[11px] text-gray-500">{st.hint}</p>
              </div>
              <div className="space-y-2">
                {grouped[st.id].map(c => {
                  const acc = accessOf(c.id);
                  const step = Number((c as any).traffic_strategy_data?.registration_step) || 1;
                  const s = latestStrategy(c.id);
                  return (
                    <button key={c.id} onClick={() => setOpenId(c.id)}
                      className="w-full text-left bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm p-3 transition">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: c.color || '#456da1' }}>{c.initials || c.name.slice(0, 2).toUpperCase()}</span>
                        <p className="font-semibold text-sm text-gray-900 truncate">{c.name}</p>
                      </div>
                      <p className="mt-1.5 text-[11px] text-gray-500">
                        {st.id === 'cadastro' ? `Parou na etapa ${Math.min(step + 1, 5)} de 5 · ` : ''}{dayjs(c.created_at).format('DD/MM')}
                        {s?.status === 'changes' ? ' · pediu ajustes' : ''}
                        {s?.status === 'sent' ? ((s.open_count || 0) > 0 ? ` · abriu ${s.open_count}x` : ' · ainda não abriu') : ''}
                        {(c as any).acquired_by_user_id && members[(c as any).acquired_by_user_id] ? ` · via ${members[(c as any).acquired_by_user_id]}` : ''}
                      </p>
                      {((acc.length > 0) || (st.id === 'estrategia' && ((c.services as string[]) || []).includes('Tráfego Pago') && !trafficBriefingOf(c.id)?.is_completed)) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {st.id === 'estrategia' && ((c.services as string[]) || []).includes('Tráfego Pago') && !trafficBriefingOf(c.id)?.is_completed && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800">
                              Briefing pendente
                            </span>
                          )}
                          {acc.map(a => (
                            <span key={a.platform} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${ACCESS_LABEL[a.status].cls}`}>
                              {a.platform === 'meta' ? 'Meta' : 'Google'}: {ACCESS_LABEL[a.status].text}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
                {grouped[st.id].length === 0 && <p className="text-xs text-gray-400 px-1 py-3">Ninguém aqui.</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <ClientDrawer
          client={open}
          stage={stageOf(open)}
          access={accessOf(open.id)}
          strategy={latestStrategy(open.id)}
          briefing={onboardingBriefingOf(open.id)}
          trafficBriefing={trafficBriefingOf(open.id)}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onOpenClient={() => onOpenClient(open)}
        />
      )}
    </div>
  );
};

const ClientDrawer: React.FC<{
  client: Client; stage: Stage | null; access: AccessRow[]; strategy: StrategyFull | null;
  briefing: Record<string, unknown> | null; trafficBriefing: Briefing | null;
  onClose: () => void; onChanged: () => void; onOpenClient: () => void;
}> = ({ client, stage, access, strategy, briefing, trafficBriefing, onClose, onChanged, onOpenClient }) => {
  const { can } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustText, setAdjustText] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedWhat, setCopiedWhat] = useState<'link' | 'msg' | null>(null);
  const tsd = (client as any).traffic_strategy_data || {};
  const lang = (tsd.language as 'pt' | 'en' | 'es') || (client.agency_id === 7 ? 'en' : 'pt');
  const hasPaidTraffic = ((client.services as string[]) || []).includes('Tráfego Pago');


  const run = async (key: string, fn: () => Promise<string | null | void>) => {
    setBusy(key); setErr('');
    try { const e = await fn(); if (e) setErr(e); else onChanged(); }
    catch (e: any) { setErr(e?.message || 'Erro inesperado.'); }
    setBusy(null);
  };

  const setAccessStatus = (platform: 'meta' | 'google', status: AccessRow['status']) => run(`acc-${platform}`, async () => {
    const { error } = await supabase.from('client_platform_access').upsert({
      client_id: client.id, agency_id: client.agency_id, platform, status, updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,platform' });
    return error?.message;
  });

  const generate = () => run('gen', async () => {
    const { error } = await callFunction('generate-strategy', { client_id: client.id, instructions: notes });
    if (!error) { setNotes(''); setShowNotes(false); }
    return error;
  });

  const askAdjust = () => run('adjust', async () => {
    if (!adjustText.trim()) return 'Escreva o que mudar.';
    const { error } = await callFunction('generate-strategy', { client_id: client.id, instructions: `AJUSTE PEDIDO PELA EQUIPE: ${adjustText.trim()}` });
    if (!error) { setAdjustText(''); setShowAdjust(false); }
    return error;
  });

  const sendToClient = () => run('send', async () => {
    if (!strategy) return 'Gere a estratégia primeiro.';
    const { error } = await supabase.from('client_strategies').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', strategy.id);
    if (!error) setShareOpen(true);
    return error?.message;
  });

  const link = strategyLink(strategy?.public_token);
  const message = strategyMessage(lang, client.name, link);
  const previewUrl = strategy?.public_token ? `${window.location.origin}/e/${strategy.public_token}?preview` : '';
  const copy = (what: 'link' | 'msg') => {
    navigator.clipboard?.writeText(what === 'link' ? link : message);
    setCopiedWhat(what); setTimeout(() => setCopiedWhat(null), 1800);
  };

  const markApproved = () => run('approve', async () => {
    if (!strategy) return null;
    const { error } = await supabase.from('client_strategies').update({ status: 'approved', responded_at: new Date().toISOString(), updated_at: new Date().toISOString(), client_feedback: 'Aprovado pela agência (combinado com o cliente fora do portal).' }).eq('id', strategy.id);
    return error?.message;
  });

  const discardDraft = () => run('discard', async () => {
    if (!strategy || strategy.status !== 'draft') return null;
    const { error } = await supabase.from('client_strategies').delete().eq('id', strategy.id);
    return error?.message;
  });

  const goLive = () => run('live', async () => {
    const { error } = await supabase.from('clients').update({ campaign_live_at: new Date().toISOString(), client_status: 'active', is_active: true }).eq('id', client.id);
    return error?.message;
  });

  const platforms: ('meta' | 'google')[] = ['meta', 'google'];
  const accessByPlat = (p: 'meta' | 'google') => access.find(a => a.platform === p);
  const allVerified = platforms.every(p => accessByPlat(p)?.status === 'verified' || accessByPlat(p)?.status === 'agency_creating');

  const fmt = (v: unknown) => Array.isArray(v) ? v.join(', ') : String(v ?? '');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-3xl h-full bg-white shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-5 sm:px-7 py-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: client.color || '#456da1' }}>{client.initials || client.name.slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{client.name}</p>
            <p className="text-xs text-gray-500 truncate">{client.responsible} · {client.email} {tsd.phone ? `· ${tsd.phone}` : ''}</p>
          </div>
          <button onClick={onOpenClient} className={`ml-auto hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:border-gray-300`}>Abrir cliente <ChevronRight size={14} /></button>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        <div className="px-5 sm:px-7 py-6 space-y-8">
          {err && <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm flex gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" />{err}</div>}

          {stage === 'cadastro' && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-sm text-amber-900">
              O cliente parou no meio do cadastro. Os dados abaixo já estão salvos. Vale chamar no WhatsApp{tsd.phone ? ` (${tsd.phone})` : ''} e mandar o link de novo: ele continua de onde parou, se usar o mesmo aparelho.
            </div>
          )}

          {/* Acessos */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Acessos às contas</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {platforms.map(p => {
                const a = accessByPlat(p);
                const st = a?.status || 'pending';
                return (
                  <div key={p} className="p-4 rounded-2xl border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      {p === 'meta' ? <Megaphone size={16} className="text-blue-600" /> : <Search size={16} className="text-amber-600" />}
                      <p className="font-semibold text-sm text-gray-900">{p === 'meta' ? 'Meta' : 'Google Ads'}</p>
                      <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${ACCESS_LABEL[st].cls}`}>{ACCESS_LABEL[st].text}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      {a?.situation === 'needs_account' ? 'Não tem conta: nós criamos.' : a?.situation === 'has_account' ? 'Já tem conta.' : 'Ainda não respondeu.'}
                      {a?.account_ref ? ` ID: ${a.account_ref}` : ''}
                    </p>
                    {p === 'google' && a?.contact_email && (
                      <p className="-mt-2 mb-3 text-xs text-gray-600 break-all">E-mail da conta Google: <span className="font-semibold">{a.contact_email}</span></p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {st !== 'verified' && (
                        <button disabled={!!busy} onClick={() => setAccessStatus(p, 'verified')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">
                          {busy === `acc-${p}` ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Acesso conferido
                        </button>
                      )}
                      {st === 'help' && (
                        <button disabled={!!busy} onClick={() => setAccessStatus(p, 'client_done')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold disabled:opacity-50">
                          <Check size={12} /> Ajuda feita
                        </button>
                      )}
                      {st === 'verified' && (
                        <button disabled={!!busy} onClick={() => setAccessStatus(p, 'pending')} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600">Desfazer</button>
                      )}
                      {st !== 'agency_creating' && st !== 'verified' && (
                        <button disabled={!!busy} onClick={() => setAccessStatus(p, 'agency_creating')} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600">Nós vamos criar</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Estratégia */}
          <section>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-gray-900">Estratégia de tráfego</h3>
              {strategy && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  v{strategy.version} · {{ draft: 'Rascunho', sent: 'Enviada ao cliente', approved: 'Aprovada', changes: 'Cliente pediu ajustes' }[strategy.status]}
                  {strategy.responded_name && (strategy.status === 'approved' || strategy.status === 'changes') ? ` por ${strategy.responded_name}` : ''}
                  {strategy.responded_via === 'page' && (strategy.status === 'approved' || strategy.status === 'changes') ? ' (pela página)' : ''}
                </span>
              )}
            </div>

            {hasPaidTraffic && !trafficBriefing?.is_completed && (!strategy || strategy.status === 'draft') && (
              <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-sm text-amber-900 space-y-2">
                <p>O cliente ainda não respondeu o briefing de tráfego. A estratégia sai bem melhor com ele.</p>
                {tsd.phone && (
                  <a
                    href={`https://wa.me/${String(tsd.phone).replace(/\D/g, '')}?text=${encodeURIComponent(
                      lang === 'en'
                        ? `Hi! Could you take 3 minutes to answer the quick questions in your portal so we can build your ad strategy? ${getAppUrl()}`
                        : lang === 'es'
                        ? `¡Hola! ¿Podrías responder las preguntas rápidas en tu portal para armar tu estrategia? ${getAppUrl()}`
                        : `Olá! Consegue responder as perguntinhas rápidas no seu portal para começarmos a sua estratégia? ${getAppUrl()}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-bold text-amber-950 underline hover:opacity-80"
                  >
                    Lembrar no WhatsApp
                  </a>
                )}
              </div>
            )}

            {strategy?.status === 'changes' && strategy.client_feedback && (
              <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-sm text-amber-900">
                <p className="font-semibold mb-1">O que o cliente pediu:</p>
                <p className="whitespace-pre-wrap">{strategy.client_feedback}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              {(!strategy || strategy.status === 'draft' || strategy.status === 'changes') && (
                <button disabled={!!busy || stage === 'cadastro'} onClick={() => (showNotes ? generate() : setShowNotes(true))}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
                  {busy === 'gen' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {busy === 'gen'
                    ? 'O Claude está montando (leva cerca de 1 minuto)...'
                    : showNotes
                    ? 'Gerar agora'
                    : hasPaidTraffic && !trafficBriefing?.is_completed
                    ? 'Gerar mesmo assim com o Claude'
                    : strategy
                    ? 'Gerar nova versão com o Claude'
                    : 'Gerar estratégia com o Claude'}
                </button>
              )}
              {strategy?.status === 'draft' && (
                <>
                  <button disabled={!!busy} onClick={sendToClient} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#456da1' }}>
                    {busy === 'send' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Enviar para o cliente
                  </button>
                  <button disabled={!!busy} onClick={() => setShowAdjust(v => !v)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">
                    <Sparkles size={15} /> Pedir ajuste ao Claude
                  </button>
                  <button disabled={!!busy} onClick={discardDraft} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"><Trash2 size={15} /> Descartar</button>
                </>
              )}
              {strategy?.public_token && (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-300">
                  <ExternalLink size={15} /> Ver como página
                </a>
              )}
              {strategy && strategy.status !== 'draft' && (
                <button onClick={() => setShareOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-300">
                  <Copy size={15} /> Copiar link e mensagem
                </button>
              )}
              {strategy?.status === 'sent' && (
                <button disabled={!!busy} onClick={markApproved} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Cliente aprovou por fora (marcar aprovada)</button>
              )}
              {(strategy?.status === 'approved' || stage === 'subir') && !(client as any).campaign_live_at && (
                <button disabled={!!busy} onClick={goLive} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
                  {busy === 'live' ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} Campanha no ar
                </button>
              )}
            </div>
            {strategy?.status === 'approved' && !allVerified && (
              <p className="text-xs text-amber-700 mb-4">Antes de subir: falta conferir algum acesso.</p>
            )}
            {stage === 'cadastro' && <p className="text-xs text-gray-500 mb-4">A estratégia libera quando o cliente terminar o cadastro.</p>}

            {showAdjust && strategy?.status === 'draft' && (
              <div className="mb-4 p-4 rounded-2xl border border-gray-200 space-y-2">
                <label className="block text-xs font-semibold text-gray-600">O que mudar? O Claude parte desta versão e muda só o que você pedir.</label>
                <textarea rows={4} autoFocus value={adjustText} onChange={e => setAdjustText(e.target.value)}
                  placeholder="Ex.: tirar a campanha de YouTube, investimento de R$ 3.000, público mais jovem"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAdjust(false)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Cancelar</button>
                  <button disabled={!!busy || !adjustText.trim()} onClick={askAdjust} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
                    {busy === 'adjust' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {busy === 'adjust' ? 'O Claude está ajustando (cerca de 1 minuto)...' : 'Gerar versão ajustada'}
                  </button>
                </div>
              </div>
            )}

            {strategy && strategy.status !== 'draft' && (
              <p className="mb-4 text-xs text-gray-600">
                {(strategy.open_count || 0) > 0
                  ? `Aberta ${strategy.open_count} ${strategy.open_count === 1 ? 'vez' : 'vezes'}${strategy.last_opened_at ? ` · última em ${dayjs(strategy.last_opened_at).format('DD/MM [às] HH:mm')}` : ''} · leitura de ${fmtRead(strategy.read_seconds)}`
                  : 'Ainda não abriu o link.'}
              </p>
            )}

            {showNotes && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Algo a mais para o Claude considerar? (opcional: resumo da reunião, valores, o que já foi combinado)</label>
                <textarea rows={5} value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
              </div>
            )}

            {strategy && (
              <div className="p-5 rounded-2xl border border-gray-200">
                <StrategyView content={strategy.content} internal lang={lang} />
              </div>
            )}
          </section>

          {/* Cadastro */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 mb-3">O que o cliente respondeu</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              {tsd.website_url && <Info label="Site" value={<a className="text-blue-600 inline-flex items-center gap-1" href={/^https?:/.test(tsd.website_url) ? tsd.website_url : `https://${tsd.website_url}`} target="_blank" rel="noreferrer">{tsd.website_url}<ExternalLink size={12} /></a>} />}
              {(client.instagram || tsd.instagram_url) && <Info label="Instagram" value={client.instagram || tsd.instagram_url} />}
              {briefing && Object.entries(briefing).filter(([, v]) => fmt(v).trim()).map(([k, v]) => (
                <Info key={k} label={BRIEFING_LABELS[k] || k} value={fmt(v)} wide={fmt(v).length > 60} />
              ))}
              {!briefing && <p className="text-gray-400 text-sm">Ainda não respondeu.</p>}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Briefing de tráfego</h4>
              {trafficBriefing?.responses && Object.keys(trafficBriefing.responses).length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  {Object.entries(trafficBriefing.responses).filter(([, v]) => fmt(v).trim()).map(([k, v]) => {
                    const specQ = BRIEFING_QUESTIONS.trafego_pago?.questions.find((q: any) => q.key === k);
                    const label = specQ?.label || k;
                    return <Info key={k} label={label} value={fmt(v)} wide={fmt(v).length > 60} />;
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Ainda não respondeu.</p>
              )}
            </div>
          </section>

          {shareOpen && strategy && link && (
            <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setShareOpen(false)}>
              <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900">Pronto para mandar no grupo</p>
                  <button onClick={() => setShareOpen(false)} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Link da estratégia</p>
                  <div className="flex gap-2">
                    <input readOnly value={link} className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700" onFocus={e => e.currentTarget.select()} />
                    <button onClick={() => copy('link')} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">
                      {copiedWhat === 'link' ? <Check size={15} /> : <Copy size={15} />} {copiedWhat === 'link' ? 'Copiado' : 'Copiar link'}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Mensagem ({lang === 'en' ? 'inglês' : lang === 'es' ? 'espanhol' : 'português'})</p>
                  <p className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-800 whitespace-pre-wrap break-words">{message}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => copy('msg')} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">
                    {copiedWhat === 'msg' ? <Check size={15} /> : <Copy size={15} />} {copiedWhat === 'msg' ? 'Mensagem copiada' : 'Copiar mensagem'}
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold">
                    Abrir WhatsApp
                  </a>
                </div>
                <p className="text-[11px] text-gray-400">Você vê aqui quando o cliente abrir. Para conferir sem contar abertura, use "Ver como página".</p>
              </div>
            </div>
          )}

          {can('manage_clients') && <p className="text-[11px] text-gray-400">Cliente criado em {dayjs(client.created_at).format('DD/MM/YYYY HH:mm')}.</p>}
        </div>
      </div>
    </div>
  );
};

const Info: React.FC<{ label: string; value: React.ReactNode; wide?: boolean }> = ({ label, value, wide }) => (
  <div className={`p-3 rounded-xl bg-gray-50 ${wide ? 'sm:col-span-2' : ''}`}>
    <p className="text-[11px] font-semibold text-gray-500">{label}</p>
    <div className="text-gray-900 whitespace-pre-wrap break-words">{value}</div>
  </div>
);

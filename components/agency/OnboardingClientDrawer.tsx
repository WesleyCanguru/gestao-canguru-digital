import React, { useEffect, useMemo, useState } from 'react';
import { supabase, useAuth, callFunction } from '../../lib/supabase';
import { getAppUrl } from '../../lib/appUrl';
import { Client } from '../../types';
import { StrategyRow, StrategyView } from '../strategy/StrategyView';
import { BRIEFING_QUESTIONS } from '../BriefingOnboarding';
import { summarizeXray } from '../strategy/strategyVisual';
import {
  Copy, Check, X, Loader2, Sparkles, Send, Rocket, ExternalLink, Megaphone, Search, AlertCircle, ChevronRight, ChevronDown,
  Trash2, MessageCircle, Clock, Eye, ListChecks, KeyRound, FileText, History, Globe, AtSign, Phone, Mail, ArrowRight, ScanSearch, Gauge, RefreshCw,
} from 'lucide-react';
import dayjs from 'dayjs';
import { clientAdPlatforms } from '../../lib/adPlatforms';
import { TeamChecklistCard } from './TeamChecklistCard';

/* ------------------------------------------------------------------ */
/* Tipos (os mesmos do funil)                                          */
/* ------------------------------------------------------------------ */
export type AccessRow = {
  id: string; client_id: string; platform: 'meta' | 'google';
  situation: 'has_account' | 'needs_account' | 'unknown';
  status: 'pending' | 'client_done' | 'help' | 'agency_creating' | 'verified';
  account_ref: string | null; updated_at: string; contact_email?: string | null;
};
export type StrategyFull = StrategyRow & {
  public_token?: string; open_count?: number; last_opened_at?: string | null; read_seconds?: number;
  responded_via?: string | null; responded_name?: string | null;
};
export type Briefing = { client_id: string; briefing_type: string; responses: Record<string, unknown>; is_completed?: boolean; created_at?: string };
export type Stage = 'cadastro' | 'estrategia' | 'aprovacao' | 'subir' | 'no_ar';

export const ACCESS_LABEL: Record<AccessRow['status'], { text: string; cls: string }> = {
  pending: { text: 'Pendente', cls: 'bg-gray-100 text-gray-600' },
  client_done: { text: 'Cliente diz que enviou', cls: 'bg-sky-50 text-sky-700' },
  help: { text: 'Pediu ajuda', cls: 'bg-amber-100 text-amber-800' },
  agency_creating: { text: 'Nós criamos', cls: 'bg-violet-50 text-violet-700' },
  verified: { text: 'Conferido', cls: 'bg-emerald-50 text-emerald-700' },
};

const STAGE_FLOW: { id: Stage; label: string }[] = [
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'estrategia', label: 'Estratégia' },
  { id: 'aprovacao', label: 'Aprovação' },
  { id: 'subir', label: 'Subir campanha' },
  { id: 'no_ar', label: 'No ar' },
];

const ONBOARDING_LABELS: Record<string, string> = {
  oferta: 'O que vende', ticket_medio: 'Ticket médio', objetivo: 'Objetivo', regiao: 'Onde estão os clientes',
  publico: 'Cliente ideal', faixas_etarias: 'Idade', diferencial: 'Diferencial', concorrentes: 'Concorrentes',
  investimento_mensal: 'Investimento em anúncios', ja_anunciou: 'Já anunciou', historico: 'O que funcionou',
  canal_de_venda: 'Como vende', observacoes: 'Observações',
  nicho: 'Nicho', target_location: 'Região', target_interests: 'Interesses', target_age_ranges: 'Idade',
  servicos: 'Serviços marcados', servicos_marcados: 'Serviços marcados',
};
// Ordem em que as respostas aparecem para a equipe
const BRIEFING_ORDER = ['onboarding', 'trafego_pago', 'site', 'persona', 'publico_alvo', 'posicionamento', 'tom_voz', 'conteudo_bastidores'];
const BRIEFING_TITLE: Record<string, string> = { onboarding: 'Cadastro (negócio)' };

const fmtRead = (secs?: number) => {
  const s = Math.round(secs || 0);
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
};
const fmtVal = (v: unknown): string => {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(fmtVal).filter(Boolean).join(', ');
  if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${fmtVal(x)}`).join(' · ');
  return String(v);
};
const humanize = (k: string) => k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
const when = (d?: string | null) => (d ? dayjs(d).format('DD/MM [às] HH:mm') : '');
const day = (d?: string | null) => (d ? dayjs(d).format('DD/MM') : '');

/** Número para o wa.me. Sem "+": 11 dígitos em português = Brasil (55); 10 dígitos = EUA (1). */
export const waNumber = (raw: unknown, lang: string) => {
  const s = String(raw || '').trim();
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  if (s.startsWith('+') || d.length > 11) return d;
  if (d.length === 11 && lang === 'pt') return `55${d}`;
  if (d.length === 10) return `1${d}`;
  return d;
};

const strategyLink = (token?: string) => (token ? `${getAppUrl()}/e/${token}` : '');
const strategyMessage = (lang: 'pt' | 'en' | 'es', client: string, link: string) =>
  lang === 'en' ? `Hi everyone! The ad strategy for ${client} is ready. Everything is in this link, and at the end of the page you can approve it or ask for changes: ${link}`
  : lang === 'es' ? `¡Hola a todos! La estrategia de anuncios de ${client} está lista. Está todo en este enlace, y al final de la página pueden aprobarla o pedir algún ajuste: ${link}`
  : `Olá, pessoal! A estratégia de anúncios da ${client} está pronta. Está tudo neste link, e no final da página tem o botão para aprovar ou pedir algum ajuste: ${link}`;

type Tab = 'resumo' | 'raiox' | 'acessos' | 'estrategia' | 'respostas' | 'historico';

/* ------------------------------------------------------------------ */
/* Janela do cliente no funil de novos clientes                        */
/* ------------------------------------------------------------------ */
export const OnboardingClientDrawer: React.FC<{
  client: Client; stage: Stage | null; access: AccessRow[]; strategy: StrategyFull | null; strategies: StrategyFull[];
  briefing: Record<string, unknown> | null; trafficBriefing: Briefing | null; broughtBy?: string | null;
  onClose: () => void; onChanged: () => void; onOpenClient: () => void;
}> = ({ client, stage, access, strategy, strategies, briefing, trafficBriefing, broughtBy, onClose, onChanged, onOpenClient }) => {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>('resumo');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustText, setAdjustText] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedWhat, setCopiedWhat] = useState<'link' | 'msg' | null>(null);
  const [allBriefings, setAllBriefings] = useState<Briefing[] | null>(null);
  const [xrayAt, setXrayAt] = useState<string | null>(null);
  const [xrayData, setXrayData] = useState<any>(null);
  const [xrayToken, setXrayToken] = useState<string | null>(null);
  const [xrayCopied, setXrayCopied] = useState(false);

  // Pedido de estratégia em andamento (Raio-X, rascunho e revisão em lote)
  const [job, setJob] = useState<{ id: string; status: string; error?: string | null } | null>(null);
  const jobOpen = !!job && ['queued', 'drafting', 'reviewing'].includes(job.status);

  useEffect(() => {
    let alive = true;
    supabase.from('strategy_jobs').select('id, status, error, created_at').eq('client_id', client.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (alive && data && ['queued', 'drafting', 'reviewing'].includes(data.status)) setJob(data); });
    supabase.from('client_briefings').select('client_id, briefing_type, responses, is_completed, created_at').eq('client_id', client.id)
      .then(({ data }) => { if (alive) setAllBriefings((data as Briefing[]) || []); });
    supabase.from('client_audits').select('created_at, data').eq('client_id', client.id).eq('kind', 'xray')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (alive) { setXrayAt((data as any)?.created_at || null); setXrayData((data as any)?.data || null); } });
    supabase.from('clients').select('xray_public_token').eq('id', client.id).maybeSingle()
      .then(({ data }) => { if (alive) setXrayToken((data as any)?.xray_public_token || null); });
    return () => { alive = false; };
  }, [client.id]);

  useEffect(() => {
    if (!jobOpen || !job) return;
    const t = setInterval(async () => {
      const { data } = await supabase.from('strategy_jobs').select('id, status, error').eq('id', job.id).maybeSingle();
      if (!data) return;
      if (data.status === 'done') { setJob(null); onChanged(); }
      else if (data.status === 'error') { setJob(null); setErr(data.error || 'O Claude não conseguiu montar a estratégia. Tente de novo.'); }
      else setJob(data);
    }, 15000);
    return () => clearInterval(t);
  }, [jobOpen, job?.id, onChanged]);

  // Fecha com Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !shareOpen) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, shareOpen]);

  const tsd = (client as any).traffic_strategy_data || {};
  const lang = (tsd.language as 'pt' | 'en' | 'es') || (client.agency_id === 7 ? 'en' : 'pt');
  const services = ((client.services as string[]) || []);
  const hasPaidTraffic = services.includes('Tráfego Pago');
  const liveAt: string | null = (client as any).campaign_live_at || null;
  const phoneWa = waNumber(tsd.phone, lang);

  /* ---------------- ações ---------------- */
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
    const { data, error } = await callFunction<{ job?: any }>('generate-strategy', { client_id: client.id, instructions: notes });
    if (!error) { setNotes(''); setShowNotes(false); if (data?.job) setJob(data.job); }
    return error;
  });
  const askAdjust = () => run('adjust', async () => {
    if (!adjustText.trim()) return 'Escreva o que mudar.';
    const { data, error } = await callFunction<{ job?: any }>('generate-strategy', { client_id: client.id, instructions: `AJUSTE PEDIDO PELA EQUIPE: ${adjustText.trim()}` });
    if (!error) { setAdjustText(''); setShowAdjust(false); if (data?.job) setJob(data.job); }
    return error;
  });
  const sendToClient = () => run('send', async () => {
    if (!strategy) return 'Gere a estratégia primeiro.';
    const { error } = await supabase.from('client_strategies').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', strategy.id);
    if (!error) setShareOpen(true);
    return error?.message;
  });
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
  const runXray = () => run('xray', async () => {
    const { error } = await callFunction('xray-collect', { client_id: client.id, force: true });
    if (error) return error;
    const { data } = await supabase.from('client_audits').select('created_at, data').eq('client_id', client.id).eq('kind', 'xray')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    setXrayAt((data as any)?.created_at || null); setXrayData((data as any)?.data || null);
  });
  // Link público do Raio-X (/x/<token>): um por cliente, sempre com o Raio-X mais recente
  const xrayLink = xrayToken ? `${getAppUrl()}/x/${xrayToken}` : '';
  const shareXray = () => run('xray-link', async () => {
    let tok = xrayToken;
    if (!tok) {
      tok = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
      const { error } = await supabase.from('clients').update({ xray_public_token: tok }).eq('id', client.id);
      if (error) return error.message;
      setXrayToken(tok);
    }
    navigator.clipboard?.writeText(`${getAppUrl()}/x/${tok}`);
    setXrayCopied(true); setTimeout(() => setXrayCopied(false), 1800);
    return null;
  });
  const goLive = () => run('live', async () => {
    const { error } = await supabase.from('clients').update({ campaign_live_at: new Date().toISOString(), client_status: 'active', is_active: true }).eq('id', client.id);
    return error?.message;
  });

  const link = strategyLink(strategy?.public_token);
  const message = strategyMessage(lang, client.name, link);
  const previewUrl = strategy?.public_token ? `${window.location.origin}/e/${strategy.public_token}?preview` : '';
  const copy = (what: 'link' | 'msg') => {
    navigator.clipboard?.writeText(what === 'link' ? link : message);
    setCopiedWhat(what); setTimeout(() => setCopiedWhat(null), 1800);
  };

  const platforms: ('meta' | 'google')[] = clientAdPlatforms(client as any);
  const accessByPlat = (p: 'meta' | 'google') => access.find(a => a.platform === p);
  const accessOk = (p: 'meta' | 'google') => ['verified', 'agency_creating'].includes(accessByPlat(p)?.status || '');
  const allAccessOk = platforms.every(accessOk);
  const trafficDone = !!trafficBriefing?.is_completed || !!(client as any).briefings_waived;
  const strategyStatusText = strategy ? ({ draft: 'Rascunho', sent: 'Enviada ao cliente', approved: 'Aprovada', changes: 'Cliente pediu ajustes' } as const)[strategy.status] : '';
  const approvedBy = strategy?.status === 'approved'
    ? (strategy.responded_via === 'page' ? `pelo cliente na página${strategy.responded_name ? ` (${strategy.responded_name})` : ''}` : 'pela equipe, combinado por fora')
    : '';

  /* ---------------- checklist: o que aconteceu e o que falta ---------------- */
  type Item = { label: string; state: 'done' | 'todo' | 'warn' | 'wait'; detail?: string; who?: 'Cliente' | 'Equipe'; tab?: Tab };
  const checklist: Item[] = useMemo(() => {
    const regStep = Number(tsd.registration_step) || 1;
    const accItem = (p: 'meta' | 'google'): Item => {
      const a = accessByPlat(p);
      const name = p === 'meta' ? 'Acesso ao Meta' : 'Acesso ao Google Ads';
      const st = a?.status || 'pending';
      if (st === 'verified') return { label: name, state: 'done', detail: `Conferido${a?.account_ref ? ` · ${a.account_ref}` : ''}`, tab: 'acessos' };
      if (st === 'agency_creating') return { label: name, state: 'done', detail: 'A conta vai ser criada por nós', who: 'Equipe', tab: 'acessos' };
      if (st === 'client_done') return { label: name, state: 'warn', detail: 'Cliente diz que liberou. Conferir na plataforma.', who: 'Equipe', tab: 'acessos' };
      if (st === 'help') return { label: name, state: 'warn', detail: 'Pediu ajuda. Marcar chamada.', who: 'Equipe', tab: 'acessos' };
      return { label: name, state: 'wait', detail: a?.situation === 'needs_account' ? 'Não tem conta' : 'Ainda não liberou', who: 'Cliente', tab: 'acessos' };
    };
    const list: Item[] = [
      client.onboarding_status === 'concluido'
        ? { label: 'Cadastro', state: 'done', detail: `Concluído${tsd.contract_accepted_at ? ` · termos aceitos em ${day(tsd.contract_accepted_at)}` : ''}`, tab: 'respostas' }
        : { label: 'Cadastro', state: 'wait', detail: `Parou na etapa ${Math.min(regStep + 1, 5)} de 5`, who: 'Cliente' },
    ];
    if (hasPaidTraffic) {
      list.push(...platforms.map(accItem));
      list.push(trafficDone
        ? { label: 'Briefing de tráfego', state: 'done', detail: 'Respondido', tab: 'respostas' }
        : { label: 'Briefing de tráfego', state: 'wait', detail: 'A estratégia sai melhor com ele', who: 'Cliente' });
    }
    list.push(xrayAt
      ? { label: 'Raio-X do site', state: 'done', detail: `Feito em ${when(xrayAt)}`, tab: 'raiox' }
      : { label: 'Raio-X do site', state: 'todo', detail: 'Ainda não rodou. Dá para rodar agora, antes da reunião.', who: 'Equipe', tab: 'raiox' });
    if (!strategy) list.push({ label: 'Estratégia', state: 'todo', detail: 'Ainda não foi gerada', who: 'Equipe', tab: 'estrategia' });
    else if (strategy.status === 'draft') list.push({ label: `Estratégia v${strategy.version}`, state: 'todo', detail: 'Rascunho: revisar e enviar', who: 'Equipe', tab: 'estrategia' });
    else if (strategy.status === 'changes') list.push({ label: `Estratégia v${strategy.version}`, state: 'warn', detail: 'Cliente pediu ajustes', who: 'Equipe', tab: 'estrategia' });
    else {
      list.push({ label: `Estratégia v${strategy.version} enviada`, state: 'done', detail: `Em ${when(strategy.sent_at)}`, tab: 'estrategia' });
      if (strategy.status === 'sent') {
        list.push((strategy.open_count || 0) > 0
          ? { label: 'Aprovação do cliente', state: 'wait', detail: `Abriu ${strategy.open_count}x, leu ${fmtRead(strategy.read_seconds)}. Falta aprovar.`, who: 'Cliente', tab: 'estrategia' }
          : { label: 'Aprovação do cliente', state: 'warn', detail: 'O link nunca foi aberto. Confirme se foi mandado.', who: 'Equipe', tab: 'estrategia' });
      } else {
        list.push({ label: 'Aprovação do cliente', state: 'done', detail: `Aprovada em ${when(strategy.responded_at)} ${approvedBy}`, tab: 'estrategia' });
      }
    }
    list.push(liveAt
      ? { label: 'Campanha no ar', state: 'done', detail: `Desde ${when(liveAt)}` }
      : { label: 'Campanha no ar', state: strategy?.status === 'approved' ? 'todo' : 'wait', detail: strategy?.status === 'approved' ? 'Liberada para subir' : 'Depois da aprovação', who: 'Equipe' });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, access, strategy, trafficBriefing, xrayAt]);
  const doneCount = checklist.filter(i => i.state === 'done').length;

  /* ---------------- próximo passo ---------------- */
  const next = (() => {
    const helpPlat = access.filter(a => a.status === 'help').map(a => (a.platform === 'meta' ? 'Meta' : 'Google Ads'));
    if (liveAt) return { who: 'ok' as const, title: 'Campanha no ar', sub: `Subiu em ${when(liveAt)}. Acompanhe pelo cliente.` };
    if (helpPlat.length) return { who: 'equipe' as const, title: `Ajudar com o acesso ao ${helpPlat.join(' e ao ')}`, sub: 'O cliente pediu ajuda. Uma chamada de 15 minutos com a tela compartilhada resolve.', cta: 'acessos' as Tab };
    if (stage === 'cadastro') return { who: 'cliente' as const, title: 'Cliente terminar o cadastro', sub: `Parou na etapa ${Math.min((Number(tsd.registration_step) || 1) + 1, 5)} de 5. Se trocar de aparelho, começa do zero.` };
    if (stage === 'estrategia') {
      if (jobOpen) return { who: 'equipe' as const, title: 'O Claude está montando a estratégia', sub: 'Fica pronta em alguns minutos e aparece aqui sozinha.' };
      if (strategy?.status === 'draft') return { who: 'equipe' as const, title: `Revisar e enviar a estratégia v${strategy.version}`, sub: 'Abra como página, confira e mande para o cliente.', cta: 'estrategia' as Tab };
      if (strategy?.status === 'changes') return { who: 'equipe' as const, title: 'Ajustar a estratégia', sub: 'O cliente pediu mudanças. Gere uma versão nova com o pedido dele.', cta: 'estrategia' as Tab };
      return { who: 'equipe' as const, title: 'Gerar a estratégia', sub: hasPaidTraffic && !trafficDone ? 'O briefing de tráfego ainda não foi respondido. Dá para gerar mesmo assim.' : 'Tudo pronto para o Claude montar.', cta: 'estrategia' as Tab };
    }
    if (stage === 'aprovacao') {
      if (!(strategy?.open_count || 0)) return { who: 'equipe' as const, title: 'Mandar o link da estratégia', sub: `Marcada como enviada em ${when(strategy?.sent_at)}, mas o cliente nunca abriu. Copie o link e mande no grupo.`, cta: 'estrategia' as Tab };
      return { who: 'cliente' as const, title: 'Cliente aprovar a estratégia', sub: `Abriu ${strategy?.open_count}x, última em ${when(strategy?.last_opened_at)}. Se ele aprovou por mensagem, marque aqui.`, cta: 'estrategia' as Tab };
    }
    if (stage === 'subir') {
      const missing = hasPaidTraffic ? platforms.filter(p => !accessOk(p)).map(p => (p === 'meta' ? 'Meta' : 'Google Ads')) : [];
      return { who: 'equipe' as const, title: 'Colocar a campanha no ar', sub: missing.length ? `Antes de subir: conferir o acesso ao ${missing.join(' e ao ')}.` : 'Acessos ok. Pode subir.', cta: missing.length ? 'acessos' as Tab : undefined, live: true };
    }
    return { who: 'equipe' as const, title: '—', sub: '' };
  })();

  /* ---------------- linha do tempo ---------------- */
  const timeline = useMemo(() => {
    const ev: { at: string; text: string; tone: 'client' | 'team' | 'system' }[] = [];
    ev.push({ at: client.created_at, text: `Começou o cadastro${broughtBy ? ` (link de ${broughtBy})` : ''}`, tone: 'client' });
    if (tsd.contract_accepted_at) ev.push({ at: tsd.contract_accepted_at, text: 'Aceitou os termos e criou a senha', tone: 'client' });
    access.forEach(a => ev.push({ at: a.updated_at, text: `${a.platform === 'meta' ? 'Meta' : 'Google Ads'}: ${ACCESS_LABEL[a.status].text.toLowerCase()}`, tone: a.status === 'verified' || a.status === 'agency_creating' ? 'team' : 'client' }));
    (allBriefings || []).filter(b => b.briefing_type !== 'onboarding' && b.is_completed && b.created_at)
      .forEach(b => ev.push({ at: b.created_at!, text: `Respondeu o briefing de ${(BRIEFING_QUESTIONS[b.briefing_type]?.title || humanize(b.briefing_type)).toLowerCase()}`, tone: 'client' }));
    if (xrayAt) ev.push({ at: xrayAt, text: 'Raio-X do site feito', tone: 'system' });
    strategies.forEach(s => {
      ev.push({ at: s.created_at, text: `Estratégia v${s.version} gerada`, tone: 'system' });
      if (s.sent_at) ev.push({ at: s.sent_at, text: `Estratégia v${s.version} marcada como enviada`, tone: 'team' });
      if (s.last_opened_at) ev.push({ at: s.last_opened_at, text: `Cliente abriu a v${s.version} (${s.open_count || 0}x no total)`, tone: 'client' });
      if (s.responded_at) ev.push({ at: s.responded_at, text: s.status === 'approved' ? `v${s.version} aprovada ${s.responded_via === 'page' ? 'pelo cliente na página' : 'pela equipe'}` : `Cliente pediu ajustes na v${s.version}`, tone: s.responded_via === 'page' ? 'client' : 'team' });
    });
    if (liveAt) ev.push({ at: liveAt, text: 'Campanha no ar', tone: 'team' });
    return ev.filter(e => e.at).sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, access, strategies, allBriefings, xrayAt, liveAt, broughtBy]);

  /* ---------------- respostas agrupadas ---------------- */
  const answerGroups = useMemo(() => {
    const list = [...(allBriefings || [])];
    if (briefing && !list.some(b => b.briefing_type === 'onboarding')) list.push({ client_id: client.id, briefing_type: 'onboarding', responses: briefing, is_completed: true });
    return list
      .filter(b => b.responses && Object.keys(b.responses).length)
      .sort((a, b) => (BRIEFING_ORDER.indexOf(a.briefing_type) + 99) % 99 - (BRIEFING_ORDER.indexOf(b.briefing_type) + 99) % 99)
      .map(b => {
        const spec = BRIEFING_QUESTIONS[b.briefing_type];
        const rows = Object.entries(b.responses)
          .map(([k, v]) => {
            const q = spec?.questions?.find((x: any) => x.key === k);
            return { key: k, label: q?.label || ONBOARDING_LABELS[k] || humanize(k), value: fmtVal(v) };
          })
          .filter(r => r.value.trim());
        return { type: b.briefing_type, title: BRIEFING_TITLE[b.briefing_type] || spec?.title || humanize(b.briefing_type), done: b.is_completed !== false, rows };
      });
  }, [allBriefings, briefing, client.id]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ onboarding: true, trafego_pago: true });

  // Fatos rápidos para a equipe bater o olho
  const answers = useMemo(() => {
    const all: Record<string, string> = {};
    answerGroups.forEach(g => g.rows.forEach(r => { if (!all[r.key]) all[r.key] = r.value; }));
    return all;
  }, [answerGroups]);
  const pick = (...keys: string[]) => keys.map(k => answers[k]).find(Boolean) || '';
  const facts = [
    { label: 'O que vende', value: pick('oferta') },
    { label: 'Objetivo', value: pick('objetivo', 'meta_principal') },
    { label: 'Região', value: pick('regiao', 'target_location', 'localizacao') || tsd.target_location || '' },
    { label: 'Verba de anúncios', value: pick('investimento_mensal', 'orcamento_midia') },
    { label: 'Ticket médio', value: pick('ticket_medio') },
    { label: 'Quem atende os leads', value: pick('atendimento_leads') },
  ].filter(f => f.value);

  /* ---------------- render ---------------- */
  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'resumo', label: 'Resumo', icon: <ListChecks size={15} />, badge: `${doneCount}/${checklist.length}` },
    { id: 'raiox', label: 'Raio-X', icon: <ScanSearch size={15} />, badge: xrayAt ? day(xrayAt) : undefined },
    ...(hasPaidTraffic || access.length ? [{ id: 'acessos' as Tab, label: 'Acessos', icon: <KeyRound size={15} />, badge: `${platforms.filter(accessOk).length}/${platforms.length}` }] : []),
    { id: 'estrategia', label: 'Estratégia', icon: <Sparkles size={15} />, badge: strategy ? `v${strategy.version}` : undefined },
    { id: 'respostas', label: 'Respostas', icon: <FileText size={15} />, badge: answerGroups.length ? String(answerGroups.length) : undefined },
    { id: 'historico', label: 'Histórico', icon: <History size={15} /> },
  ];
  const currentIdx = stage ? STAGE_FLOW.findIndex(s => s.id === stage) : -1;
  const stageDates: Partial<Record<Stage, string | null>> = {
    cadastro: tsd.contract_accepted_at || (client.onboarding_status === 'concluido' ? client.created_at : null),
    estrategia: strategy?.sent_at || null,
    aprovacao: strategy?.status === 'approved' ? strategy.responded_at : null,
    subir: liveAt,
    no_ar: liveAt,
  };

  const nextStyles = next.who === 'equipe'
    ? 'bg-gray-900 text-white'
    : next.who === 'cliente' ? 'bg-sky-50 text-sky-950 border border-sky-100' : 'bg-emerald-50 text-emerald-950 border border-emerald-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={client.name}
        className="w-full max-w-5xl h-full sm:h-[92vh] bg-[#F7F8FA] shadow-2xl flex flex-col sm:rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Cabeçalho */}
        <div className="bg-white border-b border-gray-100 px-5 sm:px-7 pt-4 pb-0 shrink-0">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-xl text-white text-sm font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: client.color || '#456da1' }}>{client.initials || client.name.slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 text-lg leading-tight truncate">{client.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                {client.responsible && <span>{client.responsible}</span>}
                {client.email && <span className="inline-flex items-center gap-1"><Mail size={12} />{client.email}</span>}
                {tsd.phone && <span className="inline-flex items-center gap-1"><Phone size={12} />{tsd.phone}</span>}
                <span className="inline-flex items-center gap-1"><Clock size={12} />desde {day(client.created_at)}</span>
                {broughtBy && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">via {broughtBy}</span>}
                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold uppercase">{lang}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {phoneWa && (
                <a href={`https://wa.me/${phoneWa}`} target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp do cliente"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
                  <MessageCircle size={14} /><span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
              <button onClick={onOpenClient} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:border-gray-300">Abrir cliente <ChevronRight size={14} /></button>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500" title="Fechar (Esc)"><X size={18} /></button>
            </div>
          </div>

          {/* Etapas */}
          <ol className="mt-5 grid grid-cols-5 gap-1.5">
            {STAGE_FLOW.map((s, i) => {
              const done = liveAt ? true : i < currentIdx;
              const current = !liveAt && i === currentIdx;
              return (
                <li key={s.id} className="min-w-0">
                  <span className={`block h-1.5 rounded-full ${done ? 'bg-emerald-500' : current ? 'bg-gray-900' : 'bg-gray-200'}`} />
                  <p className={`mt-1.5 text-[11px] font-semibold truncate ${current ? 'text-gray-900' : done ? 'text-emerald-700' : 'text-gray-400'}`}>{s.label}</p>
                  <p className="text-[10px] text-gray-400 h-3.5">{done && stageDates[s.id] ? day(stageDates[s.id]) : current ? 'agora' : ''}</p>
                </li>
              );
            })}
          </ol>

          {/* Abas */}
          <div className="mt-3 -mb-px flex gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 transition ${tab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                {t.icon}{t.label}
                {t.badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 space-y-5">
          {err && <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm flex gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" />{err}</div>}

          {/* Próximo passo (sempre no topo) */}
          <div className={`rounded-2xl p-5 ${nextStyles}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${next.who === 'equipe' ? 'text-white/60' : 'opacity-60'}`}>
              {next.who === 'equipe' ? 'Próximo passo · com a equipe' : next.who === 'cliente' ? 'Próximo passo · com o cliente' : 'Concluído'}
            </p>
            <p className="mt-1 text-lg font-bold leading-snug">{next.title}</p>
            {next.sub && <p className={`mt-1 text-sm ${next.who === 'equipe' ? 'text-white/75' : 'opacity-80'}`}>{next.sub}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {'live' in next && next.live && (
                <button disabled={!!busy} onClick={goLive} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50">
                  {busy === 'live' ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} Marcar campanha no ar
                </button>
              )}
              {stage === 'aprovacao' && strategy && (
                <button onClick={() => setShareOpen(true)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${next.who === 'equipe' ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'}`}>
                  <Copy size={15} /> Copiar link e mensagem
                </button>
              )}
              {stage === 'cadastro' && phoneWa && (
                <a href={`https://wa.me/${phoneWa}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold">
                  <MessageCircle size={15} /> Chamar no WhatsApp
                </a>
              )}
              {'cta' in next && next.cta && tab !== next.cta && (
                <button onClick={() => setTab(next.cta!)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${next.who === 'equipe' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white border border-gray-200 text-gray-800'}`}>
                  Ir para {tabs.find(t => t.id === next.cta)?.label.toLowerCase()} <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>

          {/* ---------------- RESUMO ---------------- */}
          {tab === 'resumo' && (
            <>
              <Card title="O que já aconteceu e o que falta" right={<span className="text-xs font-semibold text-gray-500">{doneCount} de {checklist.length}</span>}>
                <ul className="divide-y divide-gray-100">
                  {checklist.map((i, k) => (
                    <li key={k}>
                      <button type="button" disabled={!i.tab} onClick={() => i.tab && setTab(i.tab)}
                        className={`w-full flex items-center gap-3 py-3 text-left ${i.tab ? 'hover:bg-gray-50 -mx-2 px-2 rounded-lg' : 'cursor-default'}`}>
                        <StateDot state={i.state} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold ${i.state === 'done' ? 'text-gray-900' : 'text-gray-800'}`}>{i.label}</p>
                          {i.detail && <p className="text-xs text-gray-500 truncate">{i.detail}</p>}
                        </div>
                        {i.state !== 'done' && i.who && (
                          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${i.who === 'Equipe' ? 'bg-gray-900 text-white' : 'bg-sky-50 text-sky-700'}`}>{i.who}</span>
                        )}
                        {i.tab && <ChevronRight size={14} className="shrink-0 text-gray-300" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>

              <TeamChecklistCard client={client} />

              <div className="grid sm:grid-cols-2 gap-4">
                <Card title="Presença on-line">
                  <div className="space-y-2 text-sm">
                    <LinkRow icon={<Globe size={14} />} label="Site" value={tsd.website_url} href={tsd.website_url ? (/^https?:/.test(tsd.website_url) ? tsd.website_url : `https://${tsd.website_url}`) : ''} />
                    <LinkRow icon={<AtSign size={14} />} label="Instagram" value={client.instagram || tsd.instagram_url}
                      href={(client.instagram || tsd.instagram_url) ? `https://instagram.com/${String(client.instagram || tsd.instagram_url).replace(/^.*instagram\.com\//, '').replace(/^@/, '').replace(/\/$/, '')}` : ''} />
                    <LinkRow icon={<Search size={14} />} label="Google" value={tsd.google_business_url} href={tsd.google_business_url || ''} />
                  </div>
                </Card>
                <Card title="Serviços">
                  <div className="flex flex-wrap gap-1.5">
                    {services.length ? services.map(s => <span key={s} className="text-xs font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-700">{s}</span>) : <span className="text-sm text-gray-400">Nenhum</span>}
                  </div>
                  {Array.isArray(tsd.servicos_marcados) && tsd.servicos_marcados.includes('Não sei') && (
                    <p className="mt-3 text-xs text-amber-800 bg-amber-50 rounded-lg px-2.5 py-2">No cadastro o cliente marcou "Não sei". Confirmar com ele o que foi contratado.</p>
                  )}
                </Card>
              </div>

              {facts.length > 0 && (
                <Card title="O negócio em 30 segundos" right={<button onClick={() => setTab('respostas')} className="text-xs font-semibold text-gray-500 hover:text-gray-900">Ver todas as respostas</button>}>
                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                    {facts.map(f => (
                      <div key={f.label} className="min-w-0">
                        <dt className="text-[11px] font-semibold text-gray-500">{f.label}</dt>
                        <dd className="text-sm text-gray-900 line-clamp-3">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              )}
            </>
          )}

          {/* ---------------- RAIO-X ---------------- */}
          {tab === 'raiox' && <XrayPanel data={xrayData} at={xrayAt} busy={busy === 'xray'} onRun={runXray} canRun={!!tsd.website_url || !!client.instagram || !!tsd.instagram_url} link={xrayLink} onShare={shareXray} sharing={busy === 'xray-link'} copied={xrayCopied} />}

          {/* ---------------- ACESSOS ---------------- */}
          {tab === 'acessos' && (
            <div className="grid sm:grid-cols-2 gap-4">
              {platforms.map(p => {
                const a = accessByPlat(p);
                const st = a?.status || 'pending';
                return (
                  <div key={p} className="p-5 rounded-2xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${p === 'meta' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                        {p === 'meta' ? <Megaphone size={16} /> : <Search size={16} />}
                      </span>
                      <p className="font-bold text-gray-900">{p === 'meta' ? 'Meta' : 'Google Ads'}</p>
                      <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${ACCESS_LABEL[st].cls}`}>{ACCESS_LABEL[st].text}</span>
                    </div>
                    <dl className="space-y-1.5 text-sm mb-4">
                      <div className="flex justify-between gap-3"><dt className="text-gray-500">Conta</dt><dd className="text-gray-900 text-right">{a?.situation === 'needs_account' ? 'Não tem (nós criamos)' : a?.situation === 'has_account' ? 'Já tem' : 'Não respondeu'}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gray-500">ID da conta</dt><dd className="text-gray-900 text-right break-all">{a?.account_ref || <span className="text-gray-400">não informado</span>}</dd></div>
                      {p === 'google' && <div className="flex justify-between gap-3"><dt className="text-gray-500">E-mail Google</dt><dd className="text-gray-900 text-right break-all">{a?.contact_email || <span className="text-gray-400">não informado</span>}</dd></div>}
                      {a?.updated_at && <div className="flex justify-between gap-3"><dt className="text-gray-500">Atualizado</dt><dd className="text-gray-900">{when(a.updated_at)}</dd></div>}
                    </dl>
                    {st === 'client_done' && <p className="mb-3 text-xs text-sky-800 bg-sky-50 rounded-lg px-2.5 py-2">O cliente marcou que liberou, mas ninguém conferiu ainda. Abra a plataforma e veja se o convite chegou.</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {st !== 'verified' && (
                        <button disabled={!!busy} onClick={() => setAccessStatus(p, 'verified')} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">
                          {busy === `acc-${p}` ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Acesso conferido
                        </button>
                      )}
                      {st === 'help' && (
                        <button disabled={!!busy} onClick={() => setAccessStatus(p, 'client_done')} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold disabled:opacity-50"><Check size={12} /> Ajuda feita</button>
                      )}
                      {st === 'verified' && (
                        <button disabled={!!busy} onClick={() => setAccessStatus(p, 'pending')} className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600">Desfazer</button>
                      )}
                      {st !== 'agency_creating' && st !== 'verified' && (
                        <button disabled={!!busy} onClick={() => setAccessStatus(p, 'agency_creating')} className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600">Nós vamos criar</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ---------------- ESTRATÉGIA ---------------- */}
          {tab === 'estrategia' && (
            <>
              <Card title="Estratégia de tráfego" right={strategy && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">v{strategy.version} · {strategyStatusText}</span>
              )}>
                {strategy && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <Stat label="Gerada" value={day(strategy.created_at)} />
                    <Stat label="Enviada" value={strategy.sent_at ? day(strategy.sent_at) : '—'} />
                    <Stat label="Aberturas" value={strategy.status === 'draft' ? '—' : `${strategy.open_count || 0}${(strategy.open_count || 0) ? ` · ${fmtRead(strategy.read_seconds)}` : ''}`} warn={strategy.status === 'sent' && !(strategy.open_count || 0)} />
                    <Stat label={strategy.status === 'changes' ? 'Pediu ajuste' : 'Aprovada'} value={strategy.responded_at ? day(strategy.responded_at) : '—'} />
                  </div>
                )}
                {strategy?.status === 'approved' && <p className="mb-4 text-xs text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">Aprovada {approvedBy} em {when(strategy.responded_at)}.</p>}

                {hasPaidTraffic && !trafficDone && (!strategy || strategy.status === 'draft') && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-900 flex flex-wrap items-center gap-2">
                    <span className="flex-1 min-w-[200px]">O briefing de tráfego ainda não foi respondido. A estratégia sai bem melhor com ele.</span>
                    {phoneWa && (
                      <a href={`https://wa.me/${phoneWa}?text=${encodeURIComponent(lang === 'en'
                        ? `Hi! Could you take 3 minutes to answer the quick questions in your portal so we can build your ad strategy? ${getAppUrl()}`
                        : lang === 'es' ? `¡Hola! ¿Podrías responder las preguntas rápidas en tu portal para armar tu estrategia? ${getAppUrl()}`
                        : `Olá! Consegue responder as perguntinhas rápidas no seu portal para começarmos a sua estratégia? ${getAppUrl()}`)}`}
                        target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-200 font-semibold text-amber-950">
                        <MessageCircle size={14} /> Lembrar no WhatsApp
                      </a>
                    )}
                  </div>
                )}
                {strategy?.status === 'changes' && strategy.client_feedback && (
                  <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-900">
                    <p className="font-semibold mb-1">O que o cliente pediu:</p>
                    <p className="whitespace-pre-wrap">{strategy.client_feedback}</p>
                  </div>
                )}
                {jobOpen && (
                  <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 flex gap-2">
                    <Loader2 size={16} className="animate-spin mt-0.5 shrink-0" />
                    <span>{job?.status === 'reviewing' ? 'Rascunho pronto. Agora o Claude confere a estratégia contra o checklist da casa.' : 'O Claude está montando a estratégia com o Raio-X do site e o playbook da casa.'} Fica pronta em alguns minutos e aparece aqui sozinha.</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {(!strategy || strategy.status === 'draft' || strategy.status === 'changes') && (
                    <button disabled={!!busy || jobOpen || stage === 'cadastro'} onClick={() => (showNotes ? generate() : setShowNotes(true))}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
                      {busy === 'gen' || jobOpen ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                      {busy === 'gen' ? 'Lendo o site e as tags do cliente...' : jobOpen ? 'Montando...' : showNotes ? 'Gerar agora' : strategy ? 'Gerar nova versão' : 'Gerar estratégia com o Claude'}
                    </button>
                  )}
                  {strategy?.status === 'draft' && (
                    <>
                      <button disabled={!!busy} onClick={sendToClient} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#456da1' }}>
                        {busy === 'send' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Enviar para o cliente
                      </button>
                      <button disabled={!!busy} onClick={() => setShowAdjust(v => !v)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700"><Sparkles size={15} /> Pedir ajuste</button>
                      <button disabled={!!busy} onClick={discardDraft} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600"><Trash2 size={15} /> Descartar</button>
                    </>
                  )}
                  {strategy?.public_token && (
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-gray-300">
                      <Eye size={15} /> Ver como o cliente vê
                    </a>
                  )}
                  {strategy && strategy.status !== 'draft' && (
                    <button onClick={() => setShareOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-gray-300"><Copy size={15} /> Copiar link e mensagem</button>
                  )}
                  {strategy?.status === 'sent' && (
                    <button disabled={!!busy} onClick={markApproved} className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700">Aprovou por fora (marcar aprovada)</button>
                  )}
                </div>
                {stage === 'cadastro' && <p className="mt-3 text-xs text-gray-500">A estratégia libera quando o cliente terminar o cadastro.</p>}

                {showNotes && (
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Algo a mais para o Claude considerar? (opcional: resumo da reunião, valores, o que já foi combinado)</label>
                    <textarea rows={5} value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                  </div>
                )}
                {showAdjust && strategy?.status === 'draft' && (
                  <div className="mt-4 p-4 rounded-xl border border-gray-200 bg-white space-y-2">
                    <label className="block text-xs font-semibold text-gray-600">O que mudar? O Claude parte desta versão e muda só o que você pedir.</label>
                    <textarea rows={4} autoFocus value={adjustText} onChange={e => setAdjustText(e.target.value)} placeholder="Ex.: tirar a campanha de YouTube, investimento de US$ 1.500, público mais jovem"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowAdjust(false)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Cancelar</button>
                      <button disabled={!!busy || !adjustText.trim()} onClick={askAdjust} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
                        {busy === 'adjust' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Gerar versão ajustada
                      </button>
                    </div>
                  </div>
                )}
              </Card>

              {strategy && <StrategyDetails strategy={strategy} lang={lang} />}
              {strategies.length > 1 && (
                <p className="text-xs text-gray-400">Versões anteriores: {strategies.filter(s => s.id !== strategy?.id).map(s => `v${s.version} (${({ draft: 'rascunho', sent: 'enviada', approved: 'aprovada', changes: 'ajustes' } as const)[s.status]})`).join(', ')}.</p>
              )}
            </>
          )}

          {/* ---------------- RESPOSTAS ---------------- */}
          {tab === 'respostas' && (
            <>
              {allBriefings === null && <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" /></div>}
              {allBriefings !== null && answerGroups.length === 0 && <Card title="Respostas"><p className="text-sm text-gray-400">O cliente ainda não respondeu nada.</p></Card>}
              {answerGroups.map(g => {
                const isOpen = openGroups[g.type] ?? false;
                return (
                  <div key={g.type} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                    <button onClick={() => setOpenGroups(o => ({ ...o, [g.type]: !isOpen }))} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50">
                      <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><FileText size={15} /></span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900">{g.title}</p>
                        <p className="text-xs text-gray-500">{g.rows.length} {g.rows.length === 1 ? 'resposta' : 'respostas'}{g.done ? '' : ' · incompleto'}</p>
                      </div>
                      <ChevronDown size={16} className={`text-gray-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <dl className="border-t border-gray-100 divide-y divide-gray-50">
                        {g.rows.map(r => (
                          <div key={r.key} className="px-5 py-3 grid sm:grid-cols-[minmax(0,220px)_1fr] gap-1 sm:gap-6">
                            <dt className="text-xs font-semibold text-gray-500">{r.label}</dt>
                            <dd className="text-sm text-gray-900 whitespace-pre-wrap break-words">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* ---------------- HISTÓRICO ---------------- */}
          {tab === 'historico' && (
            <Card title="Linha do tempo">
              <ol className="relative border-l border-gray-200 ml-2 space-y-4">
                {timeline.map((e, i) => (
                  <li key={i} className="ml-4">
                    <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${e.tone === 'client' ? 'bg-sky-500' : e.tone === 'team' ? 'bg-gray-900' : 'bg-violet-500'}`} />
                    <p className="text-sm text-gray-900">{e.text}</p>
                    <p className="text-[11px] text-gray-400">{when(e.at)} · {e.tone === 'client' ? 'cliente' : e.tone === 'team' ? 'equipe' : 'sistema'}</p>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {can('manage_clients') && <p className="text-[11px] text-gray-400">Cliente criado em {dayjs(client.created_at).format('DD/MM/YYYY HH:mm')}.</p>}
        </div>

        {/* Janela de envio */}
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
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold">Abrir WhatsApp</a>
              </div>
              <p className="text-[11px] text-gray-400">Você vê aqui quando o cliente abrir. Para conferir sem contar abertura, use "Ver como o cliente vê".</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */
const Card: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-5">
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {right && <div className="ml-auto">{right}</div>}
    </div>
    {children}
  </section>
);

const StateDot: React.FC<{ state: 'done' | 'todo' | 'warn' | 'wait' }> = ({ state }) => {
  if (state === 'done') return <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"><Check size={13} strokeWidth={3} /></span>;
  if (state === 'warn') return <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><AlertCircle size={14} /></span>;
  if (state === 'todo') return <span className="w-6 h-6 rounded-full border-2 border-gray-900 shrink-0" />;
  return <span className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 shrink-0" />;
};

const Stat: React.FC<{ label: string; value: string; warn?: boolean }> = ({ label, value, warn }) => (
  <div className={`rounded-xl px-3 py-2.5 ${warn ? 'bg-amber-50' : 'bg-gray-50'}`}>
    <p className="text-[11px] font-semibold text-gray-500">{label}</p>
    <p className={`text-sm font-bold tabular-nums ${warn ? 'text-amber-800' : 'text-gray-900'}`}>{value}</p>
  </div>
);

const LinkRow: React.FC<{ icon: React.ReactNode; label: string; value?: string | null; href: string }> = ({ icon, label, value, href }) => (
  <div className="flex items-center gap-2 min-w-0">
    <span className="text-gray-400 shrink-0">{icon}</span>
    <span className="text-gray-500 w-20 shrink-0">{label}</span>
    {value ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-gray-900 font-medium truncate hover:underline inline-flex items-center gap-1">{value}<ExternalLink size={11} className="shrink-0 text-gray-400" /></a>
    ) : <span className="text-gray-400">não informado</span>}
  </div>
);

/** A estratégia completa fica recolhida: a equipe abre só quando precisa ler o detalhe. */
const StrategyDetails: React.FC<{ strategy: StrategyFull; lang: 'pt' | 'en' | 'es' }> = ({ strategy, lang }) => {
  const [open, setOpen] = useState(false);
  const c: any = strategy.content || {};
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50">
        <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><Sparkles size={15} /></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900">Estratégia completa (v{strategy.version})</p>
          <p className="text-xs text-gray-500 line-clamp-2">{c.resumo || 'Públicos, campanhas, verba, métricas e cronograma.'}</p>
        </div>
        <span className="text-xs font-semibold text-gray-500 shrink-0">{open ? 'Recolher' : 'Abrir'}</span>
        <ChevronDown size={16} className={`text-gray-400 transition shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-gray-100 p-5"><StrategyView content={strategy.content} internal lang={lang} /></div>}
    </div>
  );
};

/** Raio-X do site e do Instagram: o que a equipe mostra na reunião de fechamento. */
const XrayPanel: React.FC<{ data: any; at: string | null; busy: boolean; onRun: () => void; canRun: boolean; link: string; onShare: () => void; sharing: boolean; copied: boolean }> = ({ data, at, busy, onRun, canRun, link, onShare, sharing, copied }) => {
  const x = summarizeXray(data);
  const runBtn = (
    <button disabled={busy || !canRun} onClick={onRun} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
      {busy ? <Loader2 size={15} className="animate-spin" /> : at ? <RefreshCw size={15} /> : <ScanSearch size={15} />}
      {busy ? 'Lendo o site, as tags e o Instagram (até 1 min)...' : at ? 'Rodar de novo' : 'Rodar o Raio-X agora'}
    </button>
  );
  if (!x) {
    return (
      <Card title="Raio-X do site">
        <p className="text-sm text-gray-600 mb-4">{canRun ? 'Ainda não rodou para este cliente. Leva menos de um minuto e mostra velocidade do site, pixels e tags instalados e a saúde do Instagram.' : 'O cliente não informou site nem Instagram. Sem isso não dá para rodar.'}</p>
        {runBtn}
      </Card>
    );
  }
  const sp = x.speed; const ig = x.instagram; const tr = x.tracking; const site = x.site;
  const tone = (n: number | null | undefined, good: number, ok: number) => n == null ? 'text-gray-400' : n >= good ? 'text-emerald-600' : n >= ok ? 'text-amber-600' : 'text-rose-600';
  const dup = tr ? [tr.gtm > 1 && `${tr.gtm} GTM`, tr.meta > 1 && `${tr.meta} pixels do Meta`, tr.ga4 > 1 && `${tr.ga4} GA4`].filter(Boolean) as string[] : [];
  return (
    <>
      <Card title="Raio-X do site" right={<span className="text-xs text-gray-500">Feito em {when(at)}</span>}>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1.5"><Gauge size={13} /> Velocidade no celular</p>
            {sp ? (
              <>
                <p className={`mt-1 text-3xl font-bold tabular-nums ${tone(sp.performance_mobile, 90, 50)}`}>{sp.performance_mobile ?? '–'}<span className="text-sm text-gray-400 font-semibold">/100</span></p>
                <p className="text-xs text-gray-500 mt-1">{sp.lcp_s != null ? `Carrega em ${sp.lcp_s} s` : ''}{sp.total_kb != null ? ` · ${(sp.total_kb / 1024).toFixed(1)} MB` : ''}</p>
              </>
            ) : <p className="mt-2 text-sm text-gray-400">Não medido</p>}
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1.5"><AtSign size={13} /> Instagram</p>
            {ig ? (
              <>
                <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{ig.followers != null ? Number(ig.followers).toLocaleString('pt-BR') : '–'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {ig.username ? `@${ig.username} · ` : ''}<span className={tone(ig.engagement_rate_pct, 3, 1)}>{ig.engagement_rate_pct != null ? `${ig.engagement_rate_pct}% de engajamento` : ''}</span>
                  {ig.repeated ? ` · ${ig.repeated} legendas repetidas` : ''}
                </p>
              </>
            ) : <p className="mt-2 text-sm text-gray-400">Não lido</p>}
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1.5"><Globe size={13} /> Site</p>
            {site ? (
              <>
                <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{site.paginas || '–'}</p>
                <p className="text-xs text-gray-500 mt-1">páginas no sitemap{site.comparacoes ? ` · ${site.comparacoes} de comparação` : ''}{site.precos ? ` · ${site.precos} de preço` : ''}</p>
              </>
            ) : <p className="mt-2 text-sm text-gray-400">Não lido</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {runBtn}
          <button disabled={sharing} onClick={onShare} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">
            {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}{copied ? 'Link copiado' : 'Copiar link para o cliente'}
          </button>
          {link && <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50"><ExternalLink size={15} />Abrir a página</a>}
        </div>
        <p className="text-xs text-gray-500 mt-2">A página do Raio-X é o material da reunião de fechamento. O link é sempre o mesmo e mostra o Raio-X mais recente, no idioma do cliente.</p>
      </Card>

      {tr && (
        <Card title="Rastreamento (pixels e tags)">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            {[['GTM', tr.gtm], ['Pixel Meta', tr.meta], ['GA4', tr.ga4], ['Google Ads', tr.ads]].map(([l, n]) => (
              <div key={l as string} className={`rounded-xl px-3 py-2.5 ${n === 0 ? 'bg-rose-50' : (n as number) > 1 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                <p className="text-[11px] font-semibold text-gray-500">{l}</p>
                <p className={`text-lg font-bold tabular-nums ${n === 0 ? 'text-rose-700' : (n as number) > 1 ? 'text-amber-700' : 'text-emerald-700'}`}>{n}</p>
              </div>
            ))}
            <div className={`rounded-xl px-3 py-2.5 ${tr.server_side ? 'bg-emerald-50' : 'bg-gray-50'}`}>
              <p className="text-[11px] font-semibold text-gray-500">Server-side</p>
              <p className={`text-lg font-bold ${tr.server_side ? 'text-emerald-700' : 'text-gray-500'}`}>{tr.server_side ? 'Sim' : 'Não'}</p>
            </div>
          </div>
          {(dup.length > 0 || (tr.alerts || []).length > 0) && (
            <ul className="space-y-1.5">
              {dup.length > 0 && <li className="text-sm text-amber-900 bg-amber-50 rounded-lg px-3 py-2 flex gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0" />Instalado em dobro: {dup.join(', ')}. Conta conversão duas vezes.</li>}
              {(tr.alerts || []).map((a: any, i: number) => (
                <li key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 flex gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0 text-gray-400" />{typeof a === 'string' ? a : fmtVal(a)}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-gray-400">Verde: um de cada. Amarelo: duplicado. Vermelho: não encontrado.</p>
        </Card>
      )}
    </>
  );
};

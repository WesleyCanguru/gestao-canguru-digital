import { clientAdPlatforms } from '../../lib/adPlatforms';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { getAppUrl } from '../../lib/appUrl';
import { Client } from '../../types';
import { Copy, Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import dayjs from 'dayjs';
import { OnboardingClientDrawer, AccessRow, StrategyFull, Briefing, Stage, ACCESS_LABEL } from './OnboardingClientDrawer';

const STAGES: { id: Stage; label: string; hint: string; who: 'cliente' | 'equipe' | null }[] = [
  { id: 'cadastro', label: 'Cadastro em andamento', hint: 'O cliente ainda não terminou o cadastro', who: 'cliente' },
  { id: 'estrategia', label: 'Montar estratégia', hint: 'Gerar com o Claude, revisar e enviar', who: 'equipe' },
  { id: 'aprovacao', label: 'Aguardando o cliente', hint: 'Estratégia enviada para aprovação', who: 'cliente' },
  { id: 'subir', label: 'Subir campanha', hint: 'Aprovada, falta colocar no ar', who: 'equipe' },
  { id: 'no_ar', label: 'No ar', hint: 'Últimos 30 dias', who: null },
];

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
      (c as any).traffic_strategy_data?.created_via !== 'demo' && // demonstração já ativa (portal completo) não é cliente novo
      ((c as any).traffic_strategy_data?.created_via === 'public_onboarding' || c.client_status === 'prospect' || (c as any).campaign_live_at));
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
    window.dispatchEvent(new Event('bolsa:onboarding-changed'));
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);

  const latestStrategy = (clientId: string) => strategies.find(s => s.client_id === clientId) || null;
  const accessOf = (clientId: string) => {
    const plats = clientAdPlatforms(clients.find(c => c.id === clientId));
    return access.filter(a => a.client_id === clientId && plats.includes(a.platform));
  };
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

  // O que a equipe precisa fazer agora com este cliente (null = a bola está com o cliente)
  const actionOf = (c: Client): string | null => {
    const acc = accessOf(c.id);
    const help = acc.filter(a => a.status === 'help').map(a => (a.platform === 'meta' ? 'Meta' : 'Google'));
    if (help.length) return `Ajudar com ${help.join(' e ')}`;
    const check = acc.filter(a => a.status === 'client_done').map(a => (a.platform === 'meta' ? 'Meta' : 'Google'));
    const st = stageOf(c);
    if (st === 'estrategia') {
      const s = latestStrategy(c.id);
      return s?.status === 'changes' ? 'Ajustar a estratégia' : s?.status === 'draft' ? 'Revisar e enviar a estratégia' : 'Gerar a estratégia';
    }
    if (st === 'subir') return 'Colocar a campanha no ar';
    if (check.length) return `Conferir acesso ${check.join(' e ')}`;
    return null;
  };
  const pendingCount = clients.filter(c => stageOf(c) && stageOf(c) !== 'no_ar' && actionOf(c)).length;
  const waitingClient = grouped.cadastro.length + grouped.aprovacao.length;
  const liveDays = grouped.no_ar.map(c => dayjs((c as any).campaign_live_at).diff(dayjs(c.created_at), 'day'));
  const avgDays = liveDays.length ? Math.round(liveDays.reduce((a, b) => a + b, 0) / liveDays.length) : null;

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

      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={`rounded-2xl border p-4 ${pendingCount ? 'bg-rose-50 border-rose-100' : 'bg-white border-gray-100'}`}>
            <p className="text-xs font-medium text-gray-500">Precisam da equipe</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${pendingCount ? 'text-rose-700' : 'text-gray-900'}`}>{pendingCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">ajuda, estratégia ou subir campanha</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Com o cliente</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{waitingClient}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">terminando o cadastro ou aprovando</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">No ar (30 dias)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{grouped.no_ar.length}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">campanhas que começaram</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Do cadastro ao ar</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{avgDays == null ? '–' : `${avgDays} ${avgDays === 1 ? 'dia' : 'dias'}`}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">média dos que foram ao ar</p>
          </div>
        </div>
      )}

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
                {st.who && <span className={`inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${st.who === 'equipe' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>{st.who === 'equipe' ? 'Com a equipe' : 'Com o cliente'}</span>}
              </div>
              <div className="space-y-2">
                {grouped[st.id].map(c => {
                  const acc = accessOf(c.id);
                  const step = Number((c as any).traffic_strategy_data?.registration_step) || 1;
                  const s = latestStrategy(c.id);
                  const action = st.id !== 'no_ar' ? actionOf(c) : null;
                  return (
                    <button key={c.id} onClick={() => setOpenId(c.id)}
                      className={`w-full text-left bg-white rounded-xl border hover:shadow-sm p-3 transition ${action ? 'border-rose-200 hover:border-rose-300' : 'border-gray-200 hover:border-gray-300'}`}>
                      {action && <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">● {action}</p>}
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
        <OnboardingClientDrawer
          client={open}
          stage={stageOf(open)}
          access={accessOf(open.id)}
          strategy={latestStrategy(open.id)}
          strategies={strategies.filter(s => s.client_id === open.id)}
          briefing={onboardingBriefingOf(open.id)}
          trafficBriefing={trafficBriefingOf(open.id)}
          broughtBy={(open as any).acquired_by_user_id ? members[(open as any).acquired_by_user_id] || null : null}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onOpenClient={() => onOpenClient(open)}
        />
      )}
    </div>
  );
};

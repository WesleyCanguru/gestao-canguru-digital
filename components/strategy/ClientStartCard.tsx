import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { StrategyRow, StrategyView } from './StrategyView';
import { AccessChoice, AccessGuideCard, emptyAccess } from './AccessGuideCard';
import { Lang, Platform, pickLang, tr } from '../../lib/accessGuides';
import { Sparkles, Check, X, Loader2, MessageSquare, Rocket, Clock, MessageCircle, ClipboardList, ChevronRight } from 'lucide-react';

type AccessRow = { platform: Platform; situation: 'has_account' | 'needs_account' | 'unknown'; status: AccessChoice['status']; account_ref: string | null; contact_email?: string | null };

export const clientLang = (client: any): Lang =>
  pickLang(client?.traffic_strategy_data?.language ?? (client?.agency_id === 7 ? 'en' : 'pt'));

/** Cliente que veio pelo cadastro público e ainda não tem campanha no ar: usa o portal de começo. */
export const isStarterClient = (client: any) =>
  !!client && client.traffic_strategy_data?.created_via === 'public_onboarding' && !client.campaign_live_at;

/**
 * Começo do trabalho no portal do cliente: progresso, acessos (com o passo a passo),
 * estratégia para aprovar e briefings complementares. Em `full` vira a tela inicial inteira.
 */
export const ClientStartCard: React.FC<{
  client: any; readOnly?: boolean; full?: boolean; onOpenBriefings?: (type?: string) => void;
}> = ({ client, readOnly, full, onOpenBriefings }) => {
  const [strategy, setStrategy] = useState<StrategyRow | null>(null);
  const [access, setAccess] = useState<Record<Platform, AccessChoice>>({ meta: emptyAccess(), google: emptyAccess() });
  const [agency, setAgency] = useState<{ name: string; access_email: string | null; contact_whatsapp: string | null; primary_color: string | null } | null>(null);
  const [briefingsPending, setBriefingsPending] = useState(0);
  const [trafficDone, setTrafficDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'changes'>('view');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const refTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lang = clientLang(client);
  const t = tr(lang);

  const needsTraffic = ((client?.services as string[]) || []).includes('Tráfego Pago');

  const load = useCallback(async () => {
    if (!client?.id) return;
    const [s, a, ag, br] = await Promise.all([
      supabase.from('client_strategies').select('*').eq('client_id', client.id).in('status', ['sent', 'approved', 'changes']).order('version', { ascending: false }).limit(1),
      supabase.from('client_platform_access').select('platform, situation, status, account_ref, contact_email').eq('client_id', client.id),
      supabase.from('agencies').select('name, access_email, contact_whatsapp, primary_color').eq('id', client.agency_id).maybeSingle(),
      supabase.from('client_briefings').select('briefing_type, is_completed').eq('client_id', client.id),
    ]);
    setStrategy(((s.data as StrategyRow[]) || [])[0] || null);
    const next = { meta: emptyAccess(), google: emptyAccess() };
    ((a.data as AccessRow[]) || []).forEach(r => {
      next[r.platform] = {
        situation: r.situation === 'unknown' ? null : r.situation,
        status: r.status,
        account_ref: r.account_ref || '',
        contact_email: r.contact_email || '',
        later_clicked: r.status === 'pending' ? false : undefined,
      };
    });
    setAccess(next);
    setAgency((ag.data as any) || null);
    const trafficRow = ((br.data as any[]) || []).find(b => b.briefing_type === 'trafego_pago');
    setTrafficDone(!needsTraffic || !!trafficRow?.is_completed);
    const wanted: string[] = client.features_settings?.active_briefing_types || [];
    const done = new Set(((br.data as any[]) || []).filter(b => b.is_completed).map(b => b.briefing_type));
    setBriefingsPending(wanted.filter(w => w !== 'trafego_pago' && !done.has(w)).length);
    setLoaded(true);
  }, [client?.id, client?.agency_id, client?.features_settings, needsTraffic]);

  useEffect(() => { load(); }, [load]);

  if (!loaded || !client || client.campaign_live_at) return null;
  if (!full && !isStarterClient(client) && !strategy) return null;

  const brand = agency?.primary_color || '#456da1';

  const saveAccess = async (p: Platform, v: AccessChoice) => {
    if (readOnly) return;
    const { error } = await supabase.rpc('client_mark_access', {
      p_client: client.id, p_platform: p, p_status: v.status, p_account_ref: v.account_ref || null, p_situation: v.situation,
    });
    if (error) setErr(error.message);
    if (p === 'google' && v.contact_email !== undefined) {
      await supabase.from('client_platform_access').update({ contact_email: v.contact_email || null }).eq('client_id', client.id).eq('platform', 'google');
    }
  };
  const changeAccess = (p: Platform, patch: Partial<AccessChoice>) => {
    const v = { ...access[p], ...patch };
    setAccess(a => ({ ...a, [p]: v }));
    if (!v.situation) return;
    if (('account_ref' in patch || 'contact_email' in patch) && Object.keys(patch).length === 1) {
      clearTimeout(refTimer.current[p]);
      refTimer.current[p] = setTimeout(() => saveAccess(p, v), 900);
    } else {
      saveAccess(p, v);
    }
  };

  const respond = async (decision: 'approved' | 'changes') => {
    if (!strategy) return;
    if (decision === 'changes' && !feedback.trim()) { setErr(t('Conte o que você quer mudar.', 'Tell us what you would like to change.', 'Cuéntanos qué quieres cambiar.')); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('respond_strategy', { p_id: strategy.id, p_decision: decision, p_feedback: feedback });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false); setMode('view'); setFeedback('');
    load();
  };

  const accessOk = (p: Platform) => ['verified', 'agency_creating', 'client_done'].includes(access[p].status);
  const steps = needsTraffic ? [
    { label: t('Cadastro', 'Sign-up', 'Registro'), done: client.onboarding_status === 'concluido' },
    { label: t('Briefing', 'Briefing', 'Briefing'), done: trafficDone },
    { label: t('Acessos', 'Access', 'Accesos'), done: accessOk('meta') && accessOk('google') },
    { label: t('Estratégia', 'Strategy', 'Estrategia'), done: !!strategy },
    { label: t('Aprovação', 'Approval', 'Aprobación'), done: strategy?.status === 'approved' },
    { label: t('No ar', 'Live', 'Al aire'), done: false },
  ] : [
    { label: t('Cadastro', 'Sign-up', 'Registro'), done: client.onboarding_status === 'concluido' },
    { label: t('Acessos', 'Access', 'Accesos'), done: accessOk('meta') && accessOk('google') },
    { label: t('Estratégia', 'Strategy', 'Estrategia'), done: !!strategy },
    { label: t('Sua aprovação', 'Your approval', 'Tu aprobación'), done: strategy?.status === 'approved' },
    { label: t('Campanha no ar', 'Campaign live', 'Campaña al aire'), done: false },
  ];
  const pendingPlatforms = (['meta', 'google'] as Platform[]).filter(p => access[p].status !== 'verified');
  const firstName = (client.responsible || '').split(' ')[0];
  const wa = agency?.contact_whatsapp ? `https://wa.me/${agency.contact_whatsapp}?text=${encodeURIComponent(t(`Olá! Aqui é da ${client.name}.`, `Hi! This is ${client.name}.`, `¡Hola! Te escribe ${client.name}.`))}` : null;

  const title = strategy?.status === 'sent' ? t('Sua estratégia está pronta para você aprovar', 'Your strategy is ready for your approval', 'Tu estrategia está lista para que la apruebes')
    : strategy?.status === 'approved' ? t('Estratégia aprovada. Estamos preparando as campanhas.', "Strategy approved. We're setting up your campaigns.", 'Estrategia aprobada. Estamos preparando las campañas.')
    : strategy?.status === 'changes' ? t('Recebemos seus ajustes. Já estamos revisando.', "We got your notes. We're revising it.", 'Recibimos tus ajustes. Ya los estamos revisando.')
    : (!trafficDone ? t('Falta só você responder algumas perguntas', 'We just need a few answers from you', 'Solo faltan algunas respuestas tuyas') : t('Estamos montando a sua estratégia', "We're building your strategy", 'Estamos armando tu estrategia'));

  return (
    <div className={full ? 'max-w-3xl mx-auto space-y-6' : 'mb-6'}>
      {full && (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {firstName ? t(`Olá, ${firstName}!`, `Hi, ${firstName}!`, `¡Hola, ${firstName}!`) : t('Olá!', 'Hi!', '¡Hola!')}
          </h1>
          <p className="text-gray-500 mt-1">{t('Aqui você acompanha o começo do trabalho.', 'Here you can follow how we are getting started.', 'Aquí acompañas el inicio del trabajo.')}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500">{t('Começo do trabalho', 'Getting started', 'Comienzo del trabajo')}</p>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          </div>
          {strategy && (
            <button onClick={() => { const tk = (strategy as any).public_token; if (tk) window.location.href = `/e/${tk}${readOnly ? '?preview' : ''}`; else { setOpen(true); setMode('view'); } }}
              className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold ${strategy.status === 'sent' ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-800'}`}>
              <Sparkles size={16} /> {strategy.status === 'sent' ? t('Ver e aprovar', 'Review and approve', 'Ver y aprobar') : t('Ver estratégia', 'View strategy', 'Ver estrategia')}
            </button>
          )}
        </div>
        <ol className={`mt-5 grid ${needsTraffic ? 'grid-cols-6' : 'grid-cols-5'} gap-1.5`}>
          {steps.map((s, i) => (
            <li key={i} className="flex flex-col gap-1.5">
              <span className={`h-1.5 rounded-full ${s.done ? 'bg-emerald-500' : 'bg-gray-200'}`} />
              <span className={`text-[11px] font-semibold truncate ${s.done ? 'text-gray-800' : 'text-gray-400'}`}>{s.label}</span>
            </li>
          ))}
        </ol>
        {!strategy && (
          <p className="mt-4 text-sm text-gray-500">
            {!trafficDone
              ? t('Assim que você responder as perguntas, começamos a sua estratégia.', 'As soon as you answer the questions, we start on your strategy.', 'Apenas respondas las preguntas, empezamos tu estrategia.')
              : t('Avisamos no WhatsApp assim que a estratégia estiver pronta para você ver.', "We'll let you know on WhatsApp as soon as your strategy is ready.", 'Te avisamos por WhatsApp apenas tu estrategia esté lista.')}
          </p>
        )}
      </div>

      {full && needsTraffic && !trafficDone && (
        <div className="bg-gray-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/10 text-white/90">
              {t('Próximo passo', 'Next step', 'Próximo paso')}
            </span>
            <h4 className="text-base font-bold text-white">
              {t('Conte mais sobre os seus clientes', 'Tell us more about your customers', 'Cuéntanos más sobre tus clientes')}
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed max-w-xl">
              {t('São perguntas rápidas, cerca de 3 minutos. É com elas que montamos a sua estratégia.', 'Quick questions, about 3 minutes. This is what we use to build your strategy.', 'Son preguntas rápidas, unos 3 minutos. Con ellas armamos tu estrategia.')}
            </p>
          </div>
          <button
            onClick={() => !readOnly && onOpenBriefings?.('trafego_pago')}
            disabled={readOnly}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-gray-900 text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition shrink-0 disabled:opacity-50"
          >
            <span>{t('Responder agora', 'Answer now', 'Responder ahora')}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {full && pendingPlatforms.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">{t('Acesso às contas de anúncio', 'Access to your ad accounts', 'Acceso a tus cuentas publicitarias')}</h3>
            <p className="text-sm text-gray-500">{t('Se ainda não fez, dá para fazer agora. Se travar, marque "Preciso de ajuda" que a gente faz junto.', 'If you have not done it yet, you can do it now. If you get stuck, choose "I need help" and we will do it together.', 'Si aún no lo hiciste, puedes hacerlo ahora. Si te trabas, marca "Necesito ayuda" y lo hacemos juntos.')}</p>
          </div>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          {pendingPlatforms.map(p => (
            <AccessGuideCard key={p} platform={p} lang={lang} brand={brand} disabled={readOnly}
              accessEmail={agency?.access_email || 'contato@cangurudigital.com.br'}
              signupEmail={client.email}
              value={access[p]} onChange={patch => changeAccess(p, patch)} />
          ))}
        </section>
      )}

      {full && briefingsPending > 0 && onOpenBriefings && (
        <button onClick={() => onOpenBriefings?.()} className="w-full text-left bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:border-gray-300">
          <span className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center"><ClipboardList size={18} /></span>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{t('Para adiantar: perguntas sobre a sua marca', 'To get ahead: questions about your brand', 'Para adelantar: preguntas sobre tu marca')}</p>
            <p className="text-sm text-gray-500">{t(`${briefingsPending} questionário(s) curto(s) para os outros serviços que você contratou.`, `${briefingsPending} short questionnaire(s) for the other services you hired.`, `${briefingsPending} cuestionario(s) corto(s) para los otros servicios que contrataste.`)}</p>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
      )}

      {full && wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline">
          <MessageCircle size={16} /> {t('Falar com a equipe no WhatsApp', 'Talk to the team on WhatsApp', 'Hablar con el equipo por WhatsApp')}
        </a>
      )}

      {open && strategy && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-5 sm:px-7 py-4 flex items-center gap-3">
              <div>
                <p className="text-xs text-gray-500">{t('Estratégia de anúncios', 'Ad strategy', 'Estrategia de anuncios')} · v{strategy.version}</p>
                <p className="font-bold text-gray-900">{client.name}</p>
              </div>
              <button onClick={() => setOpen(false)} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-5 sm:px-7 py-6">
              <StrategyView content={strategy.content} lang={lang} />
            </div>
            {strategy.status === 'sent' && !readOnly && (
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 sm:px-7 py-4 space-y-3">
                {err && <p className="text-sm text-rose-600">{err}</p>}
                {mode === 'changes' ? (
                  <>
                    <textarea rows={3} autoFocus value={feedback} onChange={e => setFeedback(e.target.value)}
                      placeholder={t('O que você quer mudar?', 'What would you like to change?', '¿Qué quieres cambiar?')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button onClick={() => setMode('view')} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">{t('Voltar', 'Back', 'Volver')}</button>
                      <button disabled={busy} onClick={() => respond('changes')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
                        {busy ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />} {t('Enviar ajustes', 'Send notes', 'Enviar ajustes')}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <button onClick={() => setMode('changes')} className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">{t('Quero ajustar algo', 'I want to change something', 'Quiero ajustar algo')}</button>
                    <button disabled={busy} onClick={() => respond('approved')} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
                      {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {t('Aprovar estratégia', 'Approve strategy', 'Aprobar estrategia')}
                    </button>
                  </div>
                )}
              </div>
            )}
            {strategy.status === 'approved' && (
              <div className="border-t border-gray-100 px-5 sm:px-7 py-4 text-sm text-emerald-700 flex items-center gap-2"><Rocket size={16} /> {t('Você aprovou esta estratégia.', 'You approved this strategy.', 'Aprobaste esta estrategia.')}</div>
            )}
            {strategy.status === 'changes' && (
              <div className="border-t border-gray-100 px-5 sm:px-7 py-4 text-sm text-amber-700 flex items-center gap-2"><Clock size={16} /> {t('Seus ajustes foram enviados para a equipe.', 'Your notes were sent to the team.', 'Tus ajustes fueron enviados al equipo.')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

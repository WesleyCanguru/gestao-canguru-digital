import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { StrategyRow, StrategyView } from './StrategyView';
import { Sparkles, Check, X, Loader2, Megaphone, Search, MessageSquare, Rocket, Clock } from 'lucide-react';

type AccessRow = { platform: 'meta' | 'google'; situation: string; status: string };

/**
 * Card do início do cliente: mostra em que ponto está o começo do trabalho
 * (acessos e estratégia) e permite aprovar a estratégia ou pedir ajustes.
 * Some sozinho quando a campanha já está no ar.
 */
export const ClientStartCard: React.FC<{ client: any; readOnly?: boolean }> = ({ client, readOnly }) => {
  const [strategy, setStrategy] = useState<StrategyRow | null>(null);
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'changes'>('view');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const en = client?.agency_id === 7;
  const t = (pt: string, eng: string) => (en ? eng : pt);

  const load = useCallback(async () => {
    if (!client?.id) return;
    const [s, a] = await Promise.all([
      supabase.from('client_strategies').select('*').eq('client_id', client.id).in('status', ['sent', 'approved', 'changes']).order('version', { ascending: false }).limit(1),
      supabase.from('client_platform_access').select('platform, situation, status').eq('client_id', client.id),
    ]);
    setStrategy(((s.data as StrategyRow[]) || [])[0] || null);
    setAccess((a.data as AccessRow[]) || []);
    setLoaded(true);
  }, [client?.id]);

  useEffect(() => { load(); }, [load]);

  if (!loaded || !client || client.campaign_live_at) return null;
  const isNew = client.traffic_strategy_data?.created_via === 'public_onboarding' || client.client_status === 'prospect';
  if (!isNew && !strategy) return null;

  const respond = async (decision: 'approved' | 'changes') => {
    if (!strategy) return;
    if (decision === 'changes' && !feedback.trim()) { setErr(t('Conte o que você quer mudar.', 'Tell us what you would like to change.')); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('respond_strategy', { p_id: strategy.id, p_decision: decision, p_feedback: feedback });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false); setMode('view'); setFeedback('');
    load();
  };

  const accessDone = (p: 'meta' | 'google') => {
    const a = access.find(x => x.platform === p);
    return a && ['verified', 'agency_creating'].includes(a.status);
  };
  const accessText = (p: 'meta' | 'google') => {
    const a = access.find(x => x.platform === p);
    if (!a) return t('Aguardando', 'Waiting');
    return ({
      verified: t('Conferido', 'Confirmed'), agency_creating: t('Estamos criando', "We're creating it"),
      client_done: t('Conferindo', 'Checking'), help: t('Vamos te ajudar', "We'll help you"), pending: t('Falta enviar o convite', 'Invite pending'),
    } as Record<string, string>)[a.status] || a.status;
  };

  const steps = [
    { label: t('Cadastro', 'Sign-up'), done: client.onboarding_status === 'concluido' },
    { label: t('Acessos', 'Access'), done: accessDone('meta') && accessDone('google') },
    { label: t('Estratégia', 'Strategy'), done: !!strategy },
    { label: t('Sua aprovação', 'Your approval'), done: strategy?.status === 'approved' },
    { label: t('Campanha no ar', 'Campaign live'), done: false },
  ];

  return (
    <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500">{t('Começo do trabalho', 'Getting started')}</p>
          <h3 className="text-lg font-bold text-gray-900">
            {strategy?.status === 'sent' ? t('Sua estratégia está pronta para você aprovar', 'Your strategy is ready for your approval')
              : strategy?.status === 'approved' ? t('Estratégia aprovada. Estamos preparando as campanhas.', "Strategy approved. We're setting up your campaigns.")
              : strategy?.status === 'changes' ? t('Recebemos seus ajustes. Já estamos revisando.', "We got your notes. We're revising it.")
              : t('Estamos montando a sua estratégia', "We're building your strategy")}
          </h3>
        </div>
        {strategy && (
          <button onClick={() => { setOpen(true); setMode('view'); }}
            className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold ${strategy.status === 'sent' ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-800'}`}>
            <Sparkles size={16} /> {strategy.status === 'sent' ? t('Ver e aprovar', 'Review and approve') : t('Ver estratégia', 'View strategy')}
          </button>
        )}
      </div>

      <ol className="mt-5 grid grid-cols-5 gap-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex flex-col gap-1.5">
            <span className={`h-1.5 rounded-full ${s.done ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            <span className={`text-[11px] font-semibold ${s.done ? 'text-gray-800' : 'text-gray-400'}`}>{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-700"><Megaphone size={13} /> Meta: {accessText('meta')}</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-700"><Search size={13} /> Google: {accessText('google')}</span>
      </div>

      {open && strategy && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-5 sm:px-7 py-4 flex items-center gap-3">
              <div>
                <p className="text-xs text-gray-500">{t('Estratégia de anúncios', 'Ad strategy')} · v{strategy.version}</p>
                <p className="font-bold text-gray-900">{client.name}</p>
              </div>
              <button onClick={() => setOpen(false)} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-5 sm:px-7 py-6">
              <StrategyView content={strategy.content} english={en} />
            </div>
            {strategy.status === 'sent' && !readOnly && (
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 sm:px-7 py-4 space-y-3">
                {err && <p className="text-sm text-rose-600">{err}</p>}
                {mode === 'changes' ? (
                  <>
                    <textarea rows={3} autoFocus value={feedback} onChange={e => setFeedback(e.target.value)}
                      placeholder={t('O que você quer mudar?', 'What would you like to change?')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button onClick={() => setMode('view')} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">{t('Voltar', 'Back')}</button>
                      <button disabled={busy} onClick={() => respond('changes')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
                        {busy ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />} {t('Enviar ajustes', 'Send notes')}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <button onClick={() => setMode('changes')} className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">{t('Quero ajustar algo', 'I want to change something')}</button>
                    <button disabled={busy} onClick={() => respond('approved')} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
                      {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {t('Aprovar estratégia', 'Approve strategy')}
                    </button>
                  </div>
                )}
              </div>
            )}
            {strategy.status === 'approved' && (
              <div className="border-t border-gray-100 px-5 sm:px-7 py-4 text-sm text-emerald-700 flex items-center gap-2"><Rocket size={16} /> {t('Você aprovou esta estratégia.', 'You approved this strategy.')}</div>
            )}
            {strategy.status === 'changes' && (
              <div className="border-t border-gray-100 px-5 sm:px-7 py-4 text-sm text-amber-700 flex items-center gap-2"><Clock size={16} /> {t('Seus ajustes foram enviados para a equipe.', 'Your notes were sent to the team.')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

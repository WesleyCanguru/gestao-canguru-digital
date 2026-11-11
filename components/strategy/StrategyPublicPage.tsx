import React, { useCallback, useEffect, useRef, useState } from 'react';
import { callFunction, supabase } from '../../lib/supabase';
import type { StrategyContent } from './StrategyView';
import { PreviewCloseButton } from '../../lib/previewClose';

/**
 * Página pública da estratégia (/e/<token>), no visual da proposta.
 * O cliente abre sem login (link enviado no grupo do WhatsApp), lê e aprova ou pede ajuste.
 * Registro de abertura igual ao das propostas: não conta dentro de iframe nem em aparelho marcado com ?preview.
 * Em ?preview, quem está logado como equipe vê também rascunhos (leitura direta da tabela).
 */

type Lang = 'pt' | 'en' | 'es';
type Status = 'draft' | 'sent' | 'approved' | 'changes';
interface PageData {
  strategy: {
    version: number; status: Status; content: StrategyContent; sent_at: string | null; responded_at: string | null;
    client_feedback: string | null; responded_name: string | null; token: string; newer_than_link: boolean;
  };
  client: { name: string; responsible: string; lang: Lang; currency: string | null };
  agency: { name: string; logo_url: string | null; primary_color: string | null; contact_whatsapp: string | null } | null;
}

const FN = 'strategy-page';

const isPreviewDevice = () => {
  const params = new URLSearchParams(window.location.search);
  try {
    if (params.get('preview') === 'off') localStorage.removeItem('bolsa_preview');
    else if (params.has('preview')) localStorage.setItem('bolsa_preview', '1');
    return localStorage.getItem('bolsa_preview') === '1';
  } catch {
    return params.has('preview') && params.get('preview') !== 'off';
  }
};
const inFrame = () => { try { return window.self !== window.top; } catch { return true; } };

const sessionId = () => {
  try {
    let s = sessionStorage.getItem('st_sid');
    if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('st_sid', s); }
    return s;
  } catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
};

/** Leitura direta (equipe logada): permite ver rascunho na prévia. */
const loadAsStaff = async (token: string): Promise<PageData | null> => {
  const { data: s } = await supabase.from('client_strategies')
    .select('version, status, content, sent_at, responded_at, client_feedback, responded_name, public_token, client_id, agency_id')
    .eq('public_token', token).maybeSingle();
  if (!s) return null;
  const [{ data: c }, { data: a }] = await Promise.all([
    supabase.from('clients').select('name, responsible, currency, traffic_strategy_data').eq('id', (s as any).client_id).maybeSingle(),
    supabase.from('agencies').select('name, logo_url, primary_color, contact_whatsapp').eq('id', (s as any).agency_id).maybeSingle(),
  ]);
  const l = (c as any)?.traffic_strategy_data?.language;
  const lang: Lang = l === 'en' || l === 'es' || l === 'pt' ? l : ((s as any).agency_id === 7 ? 'en' : 'pt');
  const { pontos_em_aberto: _h, ...content } = ((s as any).content || {}) as StrategyContent;
  return {
    strategy: {
      version: (s as any).version, status: (s as any).status, content, sent_at: (s as any).sent_at, responded_at: (s as any).responded_at,
      client_feedback: (s as any).client_feedback, responded_name: (s as any).responded_name, token: (s as any).public_token, newer_than_link: false,
    },
    client: { name: (c as any)?.name || '', responsible: (c as any)?.responsible || '', lang, currency: (c as any)?.currency || null },
    agency: (a as any) || null,
  };
};

export const StrategyPublicPage: React.FC<{ token: string }> = ({ token }) => {
  const [data, setData] = useState<PageData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [preview] = useState(() => isPreviewDevice());
  const [framed] = useState(() => inFrame());
  const noTrack = preview || framed;
  const [mode, setMode] = useState<'idle' | 'changes'>('idle');
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const tracked = useRef(false);

  const load = useCallback(async () => {
    if (preview) {
      const staff = await loadAsStaff(token).catch(() => null);
      if (staff) { setData(staff); setState('ok'); return; }
    }
    const { data: d, error } = await callFunction<PageData>(FN, { action: 'get', token });
    if (error || !d) { setState('notfound'); return; }
    setData(d); setState('ok');
  }, [token, preview]);

  useEffect(() => { load(); }, [load]);

  // Registro de abertura e tempo de leitura
  useEffect(() => {
    if (state !== 'ok' || noTrack || tracked.current) return;
    tracked.current = true;
    const sid = sessionId();
    const send = (event: string, extra: Record<string, unknown> = {}) => {
      callFunction(FN, { action: 'track', token, event, session: sid, ...extra }).catch(() => {});
    };
    send('open');
    let visible = 0; let last = Date.now(); let active = !document.hidden;
    const tick = () => { if (active) visible += (Date.now() - last) / 1000; last = Date.now(); };
    const onVis = () => { tick(); active = !document.hidden; if (document.hidden) send('read_time', { seconds: Math.round(visible) }); };
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(() => { tick(); send('read_time', { seconds: Math.round(visible) }); }, 30000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(iv); };
  }, [state, noTrack, token]);

  // Fontes, título da aba e noindex
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { link.remove(); meta.remove(); };
  }, []);

  const lang: Lang = data?.client.lang || 'pt';
  const t = (pt: string, en: string, es: string) => (lang === 'en' ? en : lang === 'es' ? es : pt);

  useEffect(() => {
    if (data) document.title = `${t('Estratégia', 'Strategy', 'Estrategia')} · ${data.client.name}`;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const respond = async (decision: 'approved' | 'changes') => {
    if (!data || preview) return;
    if (decision === 'changes' && !feedback.trim()) { setErr(t('Conte o que você quer mudar.', 'Tell us what you would like to change.', 'Cuéntanos qué quieres cambiar.')); return; }
    setBusy(true); setErr('');
    const { error } = await callFunction(FN, { action: 'respond', token, decision, feedback: feedback.trim(), name: name.trim() });
    setBusy(false);
    if (error) { setErr(error); await load(); return; }
    setData(d => d ? { ...d, strategy: { ...d.strategy, status: decision, client_feedback: feedback.trim() || null, responded_name: name.trim() || null, responded_at: new Date().toISOString() } } : d);
    setMode('idle');
  };

  const brand = data?.agency?.primary_color || '#456DA1';
  const css = {
    '--bg': '#F5F7FB', '--paper': '#FFFFFF', '--ink': '#13284D', '--muted': '#56647C', '--line': '#DCE3EE', '--brand': brand,
    fontFamily: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
  } as React.CSSProperties;
  const display: React.CSSProperties = { fontFamily: 'Fraunces, Georgia, "Times New Roman", serif', letterSpacing: '-0.01em' };

  if (state === 'loading') {
    return (
      <div style={css} className="min-h-screen bg-[var(--bg)]">
        <div className="max-w-[760px] mx-auto px-4 py-12 space-y-6 animate-pulse">
          <div className="h-4 w-40 rounded bg-gray-200" />
          <div className="h-12 w-3/4 rounded bg-gray-200" />
          <div className="h-24 rounded-2xl bg-gray-200" />
          <div className="grid sm:grid-cols-2 gap-3"><div className="h-24 rounded-2xl bg-gray-200" /><div className="h-24 rounded-2xl bg-gray-200" /></div>
        </div>
      </div>
    );
  }

  if (state === 'notfound' || !data) {
    return (
      <div style={css} className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-6 text-center">
        <div>
          <p style={display} className="text-2xl font-semibold text-[var(--ink)]">Este link não está disponível.</p>
          <p className="mt-2 text-[var(--muted)]">Fale com a equipe que te enviou. / This link is not available. Please contact the team.</p>
        </div>
      </div>
    );
  }

  const { strategy: s, client, agency } = data;
  const c = s.content || {};
  const sentDate = s.sent_at ? new Date(s.sent_at).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es' : 'pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const waDigits = (agency?.contact_whatsapp || '').replace(/\D/g, '');
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(t(`Olá! Aqui é da ${client.name}, sobre a estratégia.`, `Hi! This is ${client.name}, about the strategy.`, `¡Hola! Te escribe ${client.name}, sobre la estrategia.`))}` : null;

  const H2: React.FC<{ eyebrow: string; children: React.ReactNode }> = ({ eyebrow, children }) => (
    <div>
      <p className="text-[12px] font-bold uppercase tracking-[.14em] mb-2" style={{ color: brand }}>{eyebrow}</p>
      <h2 style={display} className="text-[clamp(24px,4.5vw,30px)] leading-tight font-semibold text-[var(--ink)]">{children}</h2>
    </div>
  );
  const card = 'bg-[var(--paper)] border border-[var(--line)] rounded-2xl';

  return (
    <div style={css} className="min-h-screen bg-[var(--bg)] text-[var(--ink)] text-[16px] leading-relaxed">
      {s.newer_than_link && (
        <div className="text-center text-sm font-semibold text-white px-4 py-2.5" style={{ backgroundColor: brand }}>
          {t(`Você está vendo a versão mais recente (v${s.version}).`, `You are viewing the latest version (v${s.version}).`, `Estás viendo la versión más reciente (v${s.version}).`)}
        </div>
      )}

      <main className="max-w-[760px] mx-auto px-4 sm:px-5 pt-10 pb-24 flex flex-col gap-11">
        {/* Topo */}
        <div className="flex items-center justify-between gap-3 text-[13px] text-[var(--muted)]">
          {agency?.logo_url
            ? <img src={agency.logo_url} alt={agency.name} className="h-8 w-auto max-w-[160px] object-contain" />
            : <b className="text-[12px] uppercase tracking-[.14em] text-[var(--ink)]">{agency?.name}</b>}
          <span>{t('Estratégia de anúncios', 'Ad strategy', 'Estrategia de anuncios')} · v{s.version}</span>
        </div>

        {/* Abertura */}
        <section className="flex flex-col gap-4">
          <span className="self-start text-[11px] font-bold uppercase tracking-[.1em] px-2.5 py-1 rounded-full" style={{ color: brand, backgroundColor: `${brand}1A` }}>
            {t(`Preparado para ${client.name}`, `Prepared for ${client.name}`, `Preparado para ${client.name}`)}
          </span>
          <h1 style={display} className="text-[clamp(34px,7vw,52px)] leading-[1.05] font-semibold text-balance">
            {t(`O plano para trazer mais clientes para a ${client.name}`, `The plan to bring more customers to ${client.name}`, `El plan para traer más clientes a ${client.name}`)}
          </h1>
          {c.resumo && <p className="text-[18px] text-[var(--muted)] max-w-[62ch]">{c.resumo}</p>}
        </section>

        {(c.objetivo_principal || c.investimento?.mensal_sugerido) && (
          <div className="grid sm:grid-cols-2 gap-3">
            {c.objetivo_principal && (
              <div className={`${card} p-5`}>
                <span className="block text-[12px] font-semibold uppercase tracking-[.08em] text-[var(--muted)]">{t('Objetivo principal', 'Main goal', 'Objetivo principal')}</span>
                <p className="mt-1.5 font-semibold">{c.objetivo_principal}</p>
              </div>
            )}
            {c.investimento?.mensal_sugerido && (
              <div className={`${card} p-5`} style={{ borderColor: brand }}>
                <span className="block text-[12px] font-semibold uppercase tracking-[.08em] text-[var(--muted)]">{t('Investimento em anúncios', 'Ad spend', 'Inversión en anuncios')}</span>
                <p style={display} className="mt-1.5 text-[30px] leading-tight font-semibold tabular-nums">{c.investimento.mensal_sugerido}</p>
              </div>
            )}
          </div>
        )}

        {c.oferta && (
          <section className="flex flex-col gap-4">
            <H2 eyebrow={t('A oferta', 'The offer', 'La oferta')}>{t('O que os anúncios vão mostrar', 'What the ads will show', 'Lo que van a mostrar los anuncios')}</H2>
            <p className="max-w-[65ch]">{c.oferta}</p>
          </section>
        )}

        {!!c.publicos?.length && (
          <section className="flex flex-col gap-4">
            <H2 eyebrow={t('Públicos', 'Audiences', 'Públicos')}>{t('Para quem vamos anunciar', 'Who we will reach', 'A quién vamos a llegar')}</H2>
            <div className="grid sm:grid-cols-2 gap-3">
              {c.publicos.map((p, i) => (
                <div key={i} className={`${card} p-5 flex flex-col gap-2`}>
                  <p className="font-bold">{p.nome}</p>
                  <p className="text-[15px]">{p.descricao}</p>
                  <p className="text-[13px] text-[var(--muted)]">{p.segmentacao}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {!!c.campanhas?.length && (
          <section className="flex flex-col gap-4">
            <H2 eyebrow={t('Campanhas', 'Campaigns', 'Campañas')}>{t('Como a verba vai trabalhar', 'How the budget will work', 'Cómo va a trabajar el presupuesto')}</H2>
            <div className="flex flex-col gap-3">
              {c.campanhas.map((k, i) => {
                const pct = Math.max(0, Math.min(100, Math.round(Number(k.percentual_verba) || 0)));
                const google = k.plataforma === 'Google';
                return (
                  <div key={i} className={`${card} p-5 flex flex-col gap-3`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${google ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{k.plataforma}</span>
                      <p className="font-bold">{k.nome}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-[var(--bg)] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: brand }} /></div>
                      <span className="text-[13px] font-semibold text-[var(--muted)] whitespace-nowrap">{pct}% {t('da verba', 'of budget', 'del presupuesto')}</span>
                    </div>
                    <dl className="grid gap-1.5 text-[15px]">
                      <div><dt className="inline font-semibold">{t('Objetivo: ', 'Goal: ', 'Objetivo: ')}</dt><dd className="inline">{k.objetivo}</dd></div>
                      <div><dt className="inline font-semibold">{t('Público: ', 'Audience: ', 'Público: ')}</dt><dd className="inline">{k.publico}</dd></div>
                      <div><dt className="inline font-semibold">{t('Anúncios: ', 'Ads: ', 'Anuncios: ')}</dt><dd className="inline">{k.criativos}</dd></div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {c.investimento?.justificativa && (
          <section className="flex flex-col gap-4">
            <H2 eyebrow={t('Investimento', 'Budget', 'Inversión')}>{t('Por que esse investimento', 'Why this budget', 'Por qué esta inversión')}</H2>
            <p className="max-w-[65ch]">{c.investimento.justificativa}</p>
          </section>
        )}

        {!!c.metricas?.length && (
          <section className="flex flex-col gap-4">
            <H2 eyebrow={t('Resultados', 'Results', 'Resultados')}>{t('Como vamos medir', 'How we will measure', 'Cómo vamos a medir')}</H2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {c.metricas.map((m, i) => (
                <li key={i} className={`${card} p-4 flex flex-col gap-1`}>
                  <span className="text-[13px] text-[var(--muted)] font-semibold">{m.nome}</span>
                  <span className="font-semibold">{m.meta}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!!c.cronograma?.length && (
          <section className="flex flex-col gap-4">
            <H2 eyebrow={t('Próximos passos', 'Next steps', 'Próximos pasos')}>{t('O caminho até as campanhas no ar', 'The path to going live', 'El camino hasta las campañas al aire')}</H2>
            <ol className="flex flex-col">
              {c.cronograma.map((f, i) => (
                <li key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="w-8 h-8 shrink-0 rounded-full text-white text-sm font-bold flex items-center justify-center" style={{ backgroundColor: brand }}>{i + 1}</span>
                    {i < c.cronograma!.length - 1 && <span className="w-px flex-1 bg-[var(--line)] my-1" />}
                  </div>
                  <div className="pb-6">
                    <p className="font-bold">{f.fase} <span className="font-normal text-[var(--muted)]">· {f.prazo}</span></p>
                    <p className="text-[15px] mt-0.5">{f.entregas}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {!!c.precisamos_do_cliente?.length && (
          <section className="flex flex-col gap-4">
            <H2 eyebrow={t('Da sua parte', 'From you', 'De tu parte')}>{t('O que precisamos de você', 'What we need from you', 'Lo que necesitamos de ti')}</H2>
            <ul className="flex flex-col gap-2.5">
              {c.precisamos_do_cliente.map((x, i) => (
                <li key={i} className="relative pl-6 max-w-[65ch]">
                  <span className="absolute left-1 top-[.7em] w-[7px] h-[7px] rounded-[2px]" style={{ backgroundColor: brand }} />{x}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Resposta */}
        <section className={`${card} p-6 sm:p-7 flex flex-col gap-4`} style={{ borderColor: brand, borderWidth: 2 }}>
          {s.status === 'approved' ? (
            <>
              <h2 style={display} className="text-2xl font-semibold">{t('Estratégia aprovada', 'Strategy approved', 'Estrategia aprobada')}{s.responded_name ? ` ${t('por', 'by', 'por')} ${s.responded_name}` : ''}.</h2>
              <p className="text-[var(--muted)]">{t('Já estamos preparando as campanhas.', 'We are already setting up the campaigns.', 'Ya estamos preparando las campañas.')}</p>
            </>
          ) : s.status === 'changes' ? (
            <>
              <h2 style={display} className="text-2xl font-semibold">{t('Recebemos seus ajustes.', 'We got your notes.', 'Recibimos tus ajustes.')}</h2>
              <p className="text-[var(--muted)]">{t('Vamos mandar a nova versão em breve.', 'We will send the new version soon.', 'Te enviaremos la nueva versión pronto.')}</p>
              {s.client_feedback && <p className="whitespace-pre-wrap p-4 rounded-xl bg-[var(--bg)] text-[15px]">{s.client_feedback}</p>}
            </>
          ) : (
            <>
              <h2 style={display} className="text-2xl font-semibold">{t('Tudo certo para começar?', 'Ready to get started?', '¿Todo listo para empezar?')}</h2>
              {preview && <p className="text-sm font-semibold text-amber-700">{t('Prévia da equipe: os botões ficam desativados.', 'Team preview: buttons are disabled.', 'Vista previa del equipo: los botones están desactivados.')}</p>}
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[var(--muted)]">{t('Seu nome (opcional)', 'Your name (optional)', 'Tu nombre (opcional)')}</span>
                <input value={name} onChange={e => setName(e.target.value)} maxLength={120}
                  placeholder={t('Para sabermos quem aprovou', 'So we know who approved', 'Para saber quién aprobó')}
                  className="px-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] focus:outline-none focus:ring-2" />
              </label>
              {mode === 'changes' && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-[var(--muted)]">{t('O que você quer mudar?', 'What would you like to change?', '¿Qué quieres cambiar?')}</span>
                  <textarea rows={4} autoFocus value={feedback} onChange={e => setFeedback(e.target.value)} maxLength={4000}
                    className="px-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] focus:outline-none focus:ring-2" />
                </label>
              )}
              {err && <p className="text-sm text-rose-600">{err}</p>}
              {s.status === 'draft' ? (
                <p className="text-sm text-[var(--muted)]">{t('Rascunho: o cliente ainda não recebeu.', 'Draft: not sent to the client yet.', 'Borrador: el cliente aún no la recibió.')}</p>
              ) : mode === 'changes' ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <button onClick={() => { setMode('idle'); setErr(''); }} className="px-5 py-3 rounded-xl border border-[var(--line)] font-semibold">{t('Voltar', 'Back', 'Volver')}</button>
                  <button disabled={busy || preview} onClick={() => respond('changes')} className="px-5 py-3 rounded-xl text-white font-semibold disabled:opacity-50" style={{ backgroundColor: 'var(--ink)' }}>
                    {busy ? t('Enviando...', 'Sending...', 'Enviando...') : t('Enviar ajustes', 'Send notes', 'Enviar ajustes')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <button disabled={preview} onClick={() => { setMode('changes'); setErr(''); }} className="px-5 py-3 rounded-xl border border-[var(--line)] font-semibold disabled:opacity-50">{t('Quero ajustar algo', 'I want to change something', 'Quiero ajustar algo')}</button>
                  <button disabled={busy || preview} onClick={() => respond('approved')} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50">
                    {busy ? t('Enviando...', 'Sending...', 'Enviando...') : t('Aprovar estratégia', 'Approve strategy', 'Aprobar estrategia')}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" data-track="whatsapp"
            onClick={() => { if (!noTrack) callFunction(FN, { action: 'track', token, event: 'whatsapp_click', session: sessionId() }).catch(() => {}); }}
            className="self-center text-sm font-semibold text-emerald-700 hover:underline">
            {t('Falar com a equipe no WhatsApp', 'Talk to the team on WhatsApp', 'Hablar con el equipo por WhatsApp')}
          </a>
        )}

        <footer className="text-center text-[13px] text-[var(--muted)]">{agency?.name}{sentDate ? ` · ${sentDate}` : ''}</footer>
      </main>

      {preview && !framed && <PreviewCloseButton fallbackTab="onboarding" />}
      {preview && !framed && (
        <div className="fixed left-1/2 bottom-4 -translate-x-1/2 z-50 bg-[#13284D] text-white text-[13px] font-semibold px-4 py-2.5 rounded-full shadow-lg max-w-[calc(100%-32px)] text-center">
          Visualização da equipe: esta abertura não é registrada.
        </div>
      )}
    </div>
  );
};

export default StrategyPublicPage;

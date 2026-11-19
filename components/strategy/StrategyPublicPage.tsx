import React, { useCallback, useEffect, useRef, useState } from 'react';
import { callFunction, supabase } from '../../lib/supabase';
import { normalizeStrategy, type StrategyContent } from './StrategyView';
import { PreviewCloseButton } from '../../lib/previewClose';
import { buildVisual, summarizeXray, type XraySummary } from './strategyVisual';

/**
 * Página pública da estratégia (/e/<token>), no visual da proposta.
 * O cliente abre sem login (link enviado no grupo do WhatsApp), lê e aprova ou pede ajuste.
 * Registro de abertura igual ao das propostas: não conta dentro de iframe nem em aparelho marcado com ?preview.
 * Em ?preview, quem está logado como equipe vê também rascunhos (leitura direta da tabela).
 */

type Lang = 'pt' | 'en' | 'es';
type Status = 'draft' | 'sent' | 'approved' | 'changes';
export interface PageData {
  strategy: {
    version: number; status: Status; content: StrategyContent; sent_at: string | null; responded_at: string | null;
    client_feedback: string | null; responded_name: string | null; token: string; newer_than_link: boolean;
  };
  client: { name: string; responsible: string; lang: Lang; currency: string | null; agency_id?: number };
  agency: { name: string; logo_url: string | null; primary_color: string | null; contact_whatsapp: string | null } | null;
  xray?: XraySummary | null;
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
  const [{ data: c }, { data: a }, { data: xr }] = await Promise.all([
    supabase.from('clients').select('name, responsible, currency, traffic_strategy_data').eq('id', (s as any).client_id).maybeSingle(),
    supabase.from('agencies').select('name, logo_url, primary_color, contact_whatsapp').eq('id', (s as any).agency_id).maybeSingle(),
    supabase.from('client_audits').select('data').eq('client_id', (s as any).client_id).eq('kind', 'xray').order('created_at', { ascending: false }).limit(1),
  ]);
  const l = (c as any)?.traffic_strategy_data?.language;
  const lang: Lang = l === 'en' || l === 'es' || l === 'pt' ? l : ((s as any).agency_id === 7 ? 'en' : 'pt');
  const { pontos_em_aberto: _h, ...content } = ((s as any).content || {}) as StrategyContent;
  return {
    strategy: {
      version: (s as any).version, status: (s as any).status, content, sent_at: (s as any).sent_at, responded_at: (s as any).responded_at,
      client_feedback: (s as any).client_feedback, responded_name: (s as any).responded_name, token: (s as any).public_token, newer_than_link: false,
    },
    client: { name: (c as any)?.name || '', responsible: (c as any)?.responsible || '', lang, currency: (c as any)?.currency || null, agency_id: (s as any).agency_id },
    agency: (a as any) || null,
    xray: summarizeXray((xr as any)?.[0]?.data),
  };
};

export const StrategyPublicPage: React.FC<{ token: string; initial?: PageData }> = ({ token, initial }) => {
  const [data, setData] = useState<PageData | null>(initial ?? null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>(initial ? 'ok' : 'loading');
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

  useEffect(() => { if (!initial) load(); }, [load, initial]);

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
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Sans:wght@400;600&family=JetBrains+Mono:wght@500;700&display=swap';
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

  // Tema por agência: Joey Growth (agência 7) no visual escuro da marca; as outras no claro, com a cor da agência.
  const joey = (data?.client.agency_id ?? 0) === 7;
  const brand = joey ? '#F0A63A' : (data?.agency?.primary_color || '#456DA1');
  const theme: Record<string, string> = joey
    ? { '--bg': '#0B0D0F', '--paper': '#121619', '--paper2': '#171C20', '--ink': '#F4F6F5', '--muted': '#A3AEAF', '--sub': '#D4DCDA', '--line': '#293136', '--brand': brand, '--on-brand': '#1E1404', '--ok': '#57E39A', '--bad': '#FF7A6B', '--warn': brand, '--radius': '0px',
        '--fd': '"Bricolage Grotesque", "Arial Black", system-ui, sans-serif', '--ft': '"Instrument Sans", system-ui, sans-serif', '--fm': '"JetBrains Mono", ui-monospace, monospace', '--dw': '800', '--ls': '-0.025em' }
    : { '--bg': '#F5F7FB', '--paper': '#FFFFFF', '--paper2': '#F0F3F8', '--ink': '#13284D', '--muted': '#56647C', '--sub': '#33415C', '--line': '#DCE3EE', '--brand': brand, '--on-brand': '#FFFFFF', '--ok': '#0F9D6B', '--bad': '#D63A3A', '--warn': '#C77700', '--radius': '16px',
        '--fd': 'Fraunces, Georgia, "Times New Roman", serif', '--ft': '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif', '--fm': '"Plus Jakarta Sans", system-ui, sans-serif', '--dw': '600', '--ls': '-0.01em' };
  const css = { ...theme, fontFamily: 'var(--ft)' } as React.CSSProperties;

  if (state === 'loading') {
    return (
      <div style={css} className="min-h-screen bg-[var(--bg)]">
        <div className="max-w-[1040px] mx-auto px-4 py-12 space-y-6 animate-pulse opacity-40">
          <div className="h-4 w-40 bg-[var(--line)]" />
          <div className="h-12 w-3/4 bg-[var(--line)]" />
          <div className="grid sm:grid-cols-3 gap-3"><div className="h-28 bg-[var(--line)]" /><div className="h-28 bg-[var(--line)]" /><div className="h-28 bg-[var(--line)]" /></div>
        </div>
      </div>
    );
  }

  if (state === 'notfound' || !data) {
    return (
      <div style={css} className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-6 text-center">
        <div>
          <p style={{ fontFamily: 'var(--fd)' }} className="text-2xl font-semibold text-[var(--ink)]">Este link não está disponível.</p>
          <p className="mt-2 text-[var(--muted)]">Fale com a equipe que te enviou. / This link is not available. Please contact the team.</p>
        </div>
      </div>
    );
  }

  const { strategy: s, client, agency } = data;
  const c = normalizeStrategy(s.content);
  const v = buildVisual(c, data.xray ?? null, t, client.name);
  const x = data.xray ?? null;
  const sentDate = s.sent_at ? new Date(s.sent_at).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es' : 'pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const waDigits = (agency?.contact_whatsapp || '').replace(/\D/g, '');
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(t(`Olá! Aqui é da ${client.name}, sobre a estratégia.`, `Hi! This is ${client.name}, about the strategy.`, `¡Hola! Te escribe ${client.name}, sobre la estrategia.`))}` : null;
  const canRespond = s.status === 'sent' && !preview;
  const STATUS_LABEL = {
    critico: t('Arrumar primeiro', 'Fix first', 'Arreglar primero'),
    melhorar: t('Melhorar', 'Improve', 'Mejorar'),
    forte: t('Ponto forte', 'Strength', 'Punto fuerte'),
  } as const;
  const statusColor = (st: string) => (st === 'critico' ? 'var(--bad)' : st === 'forte' ? 'var(--ok)' : 'var(--warn)');
  const DONUT = joey ? [brand, '#D4DCDA', '#57E39A', '#7FB2FF', '#FF7A6B'] : [brand, '#13284D', '#0F9D6B', '#C77700', '#8A6FD1'];
  const fmtPct = (n: number) => String(Math.round(n * 10) / 10).replace('.', lang === 'en' ? '.' : ',');

  const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="stp-eyebrow">{children}</div>;
  const Details: React.FC<{ children: React.ReactNode; label?: string }> = ({ children, label }) => (
    <details className="stp-details"><summary>{label || t('Ver detalhes', 'See details', 'Ver detalles')}</summary><div>{children}</div></details>
  );

  // Rosca da verba
  const donut = (() => {
    let acc = 0;
    const total = v.verba.reduce((a, b) => a + b.percentual, 0) || 100;
    return v.verba.map((b, i) => {
      const len = (b.percentual / total) * 100;
      const seg = { color: DONUT[i % DONUT.length], dash: `${Math.max(0, len - 0.8)} ${100 - Math.max(0, len - 0.8)}`, offset: -acc };
      acc += len;
      return seg;
    });
  })();
  const budgetLabel = v.numeros.find(n => /verba|spend|invers/i.test(n.rotulo))?.valor || c.investimento?.mensal_sugerido?.split(':')[0] || '';

  return (
    <div style={css} className="stp min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <style>{STP_CSS}</style>
      {s.newer_than_link && (
        <div className="text-center text-sm font-semibold px-4 py-2.5" style={{ backgroundColor: brand, color: 'var(--on-brand)' }}>
          {t(`Você está vendo a versão mais recente (v${s.version}).`, `You are viewing the latest version (v${s.version}).`, `Estás viendo la versión más reciente (v${s.version}).`)}
        </div>
      )}

      <main className="stp-wrap">
        <div className="stp-top">
          {agency?.logo_url
            ? <img src={agency.logo_url} alt={agency.name} className="h-8 w-auto max-w-[160px] object-contain" />
            : <b className="stp-brand">{agency?.name}</b>}
          <span>{t('Estratégia de anúncios', 'Ad strategy', 'Estrategia de anuncios')} · v{s.version}</span>
        </div>

        {/* Abertura */}
        <span className="stp-pill">{t(`Para ${client.name}`, `For ${client.name}`, `Para ${client.name}`)}</span>
        <h1 className="stp-h1">{v.titulo}{v.titulo_destaque ? <> <em>{v.titulo_destaque}</em></> : null}</h1>
        {v.subtitulo && <p className="stp-lead">{v.subtitulo}</p>}

        {!!v.numeros.length && (
          <div className={`stp-grid stp-g${Math.min(v.numeros.length, 3)}`} style={{ marginTop: 36 }}>
            {v.numeros.map((n, i) => (
              <div key={i} className="stp-cell">
                <div className="stp-k">{n.rotulo}</div>
                <div className="stp-big">{n.valor}</div>
                {n.nota && <div className="stp-s">{n.nota}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Raio-X */}
        {!!v.raio_x.length && (
          <section>
            <Eyebrow>{t('Onde você está hoje', 'Where you are today', 'Dónde estás hoy')}</Eyebrow>
            <h2 className="stp-h2">{t('O Raio-X', 'The X-Ray', 'La radiografía')}</h2>
            <p className="stp-intro">{x?.collected_at
              ? t(`O que medimos de fora, no site e no Instagram, em ${new Date(x.collected_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}. É o ponto de partida.`, `What we measured from the outside, on the website and Instagram, on ${new Date(x.collected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. This is the starting point.`, `Lo que medimos desde afuera, en el sitio y en Instagram, el ${new Date(x.collected_at).toLocaleDateString('es', { day: '2-digit', month: '2-digit' })}. Es el punto de partida.`)
              : t('O ponto de partida.', 'The starting point.', 'El punto de partida.')}</p>
            <div className={`stp-grid stp-g${Math.min(v.raio_x.length, 4)}`}>
              {v.raio_x.map((r, i) => {
                const speed = r.tema === 'velocidade' && x?.speed?.performance_mobile != null ? x.speed.performance_mobile : null;
                const er = r.tema === 'instagram' && x?.instagram?.engagement_rate_pct != null ? x.instagram.engagement_rate_pct : null;
                return (
                  <div key={i} className="stp-cell">
                    <span className="stp-status" style={{ color: statusColor(r.status) }}><span className="stp-dot" />{STATUS_LABEL[r.status]}</span>
                    <h3 className="stp-h3">{r.titulo}</h3>
                    {speed != null ? (
                      <div className="stp-gauge">
                        <svg width="76" height="76" viewBox="0 0 36 36" role="img" aria-label={`${speed}/100`}>
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--line)" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke={statusColor(r.status)} strokeWidth="3" pathLength={100} strokeDasharray={`${speed} 100`} transform="rotate(-90 18 18)" />
                          <text x="18" y="21.5" textAnchor="middle" fontFamily="var(--fd)" fontWeight="800" fontSize="10" fill="var(--ink)">{speed}</text>
                        </svg>
                        <p>{t('de 100. ', 'out of 100. ', 'de 100. ')}{r.frase}</p>
                      </div>
                    ) : er != null ? (
                      <>
                        <p><b className="stp-num" style={{ color: statusColor(r.status) }}>{fmtPct(er)}%</b> {r.frase.replace(/^[\d.,]+%\s*/, '')}</p>
                        <div className="stp-bar"><i style={{ width: `${Math.min(100, (er / 5) * 100)}%`, background: statusColor(r.status) }} /><span className="stp-band" /></div>
                        <div className="stp-legend"><span>0%</span><span style={{ color: 'var(--ok)' }}>{t('média 1–3%', 'typical 1–3%', 'promedio 1–3%')}</span><span>5%</span></div>
                      </>
                    ) : (
                      <p>{r.frase}</p>
                    )}
                    {r.detalhe && <Details><p>{r.detalhe}</p></Details>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Funil */}
        {!!v.funil.length && (
          <section>
            <Eyebrow>{t('O plano', 'The plan', 'El plan')}</Eyebrow>
            <h2 className="stp-h2">{t('Como o comprador chega até você', 'How buyers find you', 'Cómo llega el comprador hasta ti')}</h2>
            <p className="stp-intro">{t('As campanhas trabalham juntas. Cada etapa alimenta a próxima.', 'The campaigns work together. Each step feeds the next.', 'Las campañas trabajan juntas. Cada etapa alimenta la siguiente.')}</p>
            <div className="stp-funnel">
              {v.funil.map((f, i) => (
                <div key={i} className="stp-step" style={{ marginInline: `${Math.min(i, 4) * 4}%` }}>
                  <div className="stp-n">{String(i + 1).padStart(2, '0')}</div>
                  <div><h3>{f.titulo}</h3><p>{f.frase}</p></div>
                  {f.selo && <span className={`stp-w ${f.destaque ? '' : 'dim'}`}>{f.selo}</span>}
                </div>
              ))}
            </div>
            {(c.oferta || !!c.campanhas?.length) && (
              <Details label={t('Ver campanhas e oferta completas', 'See full campaigns and offer', 'Ver campañas y oferta completas')}>
                {c.oferta && <><p className="stp-dt">{t('A oferta', 'The offer', 'La oferta')}</p><p style={{ whiteSpace: 'pre-line' }}>{c.oferta}</p></>}
                {c.campanhas?.map((k, i) => (
                  <div key={i} style={{ marginTop: 14 }}>
                    <p className="stp-dt">{k.plataforma} · {k.nome}</p>
                    <p><b>{t('Objetivo: ', 'Goal: ', 'Objetivo: ')}</b>{k.objetivo}</p>
                    <p><b>{t('Público: ', 'Audience: ', 'Público: ')}</b>{k.publico}</p>
                    <p><b>{t('Anúncios: ', 'Ads: ', 'Anuncios: ')}</b>{k.criativos}</p>
                  </div>
                ))}
              </Details>
            )}
          </section>
        )}

        {/* Públicos */}
        {!!v.publicos.length && (
          <section>
            <Eyebrow>{t('Para quem', 'Who', 'Para quién')}</Eyebrow>
            <h2 className="stp-h2">{t('Os públicos', 'The audiences', 'Los públicos')}</h2>
            <div className="stp-grid stp-g2">
              {v.publicos.map((p, i) => {
                const full = c.publicos?.[i];
                return (
                  <div key={i} className="stp-cell">
                    <div className="stp-ico">{p.icone || '●'}</div>
                    <h3 className="stp-h3">{p.titulo}</h3>
                    <p>{p.frase}</p>
                    {p.selo && <div className="stp-tag">{p.selo}</div>}
                    {full && (full.segmentacao || full.descricao) && <Details>{full.descricao && <p>{full.descricao}</p>}{full.segmentacao && <p>{full.segmentacao}</p>}</Details>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Verba */}
        {!!v.verba.length && (
          <section>
            <Eyebrow>{t('Investimento', 'Budget', 'Inversión')}</Eyebrow>
            <h2 className="stp-h2">{t('Para onde vai a verba', 'Where the budget goes', 'A dónde va el presupuesto')}</h2>
            <div className="stp-budget">
              <svg viewBox="0 0 42 42" className="stp-donut" role="img" aria-label={v.verba.map(b => `${b.nome} ${b.percentual}%`).join(', ')}>
                {donut.map((d, i) => (
                  <circle key={i} cx="21" cy="21" r="15.9" fill="none" stroke={d.color} strokeWidth="6" pathLength={100} strokeDasharray={d.dash} strokeDashoffset={d.offset} transform="rotate(-90 21 21)" />
                ))}
                {budgetLabel && <text x="21" y="21.5" textAnchor="middle" fontFamily="var(--fd)" fontWeight="800" fontSize={budgetLabel.length > 10 ? 4 : 5.5} fill="var(--ink)">{budgetLabel.replace(/\/\s*(mês|mes|month|mo)$/i, '')}</text>}
                <text x="21" y="26.5" textAnchor="middle" fontFamily="var(--fm)" fontSize="2.6" fill="var(--muted)">{t('POR MÊS', 'PER MONTH', 'POR MES')}</text>
              </svg>
              <div>
                <div className="stp-lgd">
                  {v.verba.map((b, i) => (
                    <div key={i}>
                      <span className="stp-c" style={{ background: DONUT[i % DONUT.length] }} />
                      <span>{b.nome}{b.frase && <small>{b.frase}</small>}</span>
                      <b>{b.valor || `${b.percentual}%`}</b>
                    </div>
                  ))}
                </div>
                {!!v.verba_alternativas?.length && (
                  <div className="stp-alt">{v.verba_alternativas.map((a, i) => <div key={i}><b>{a.se}</b>{a.entao}</div>)}</div>
                )}
                {c.investimento?.justificativa && <Details label={t('Por que esse valor', 'Why this amount', 'Por qué este valor')}><p>{c.investimento.justificativa}</p></Details>}
              </div>
            </div>
          </section>
        )}

        {/* Metas */}
        {!!c.metricas?.length && (
          <section>
            <Eyebrow>{t('Resultados', 'Results', 'Resultados')}</Eyebrow>
            <h2 className="stp-h2">{t('Como vamos medir', 'How we will measure', 'Cómo vamos a medir')}</h2>
            <div className="stp-chips">{c.metricas.map((m, i) => <span key={i}>{m.nome}</span>)}</div>
            <Details label={t('Ver as metas', 'See the targets', 'Ver las metas')}>
              {c.metricas.map((m, i) => <p key={i}><b>{m.nome}: </b>{m.meta}</p>)}
            </Details>
          </section>
        )}

        {/* Linha do tempo */}
        {!!v.cronograma.length && (
          <section>
            <Eyebrow>{t('Quando', 'When', 'Cuándo')}</Eyebrow>
            <h2 className="stp-h2">{t('Os próximos meses', 'The coming months', 'Los próximos meses')}</h2>
            <div className="stp-tl" style={{ gridTemplateColumns: `repeat(${v.cronograma.length}, 1fr)` }}>
              {v.cronograma.map((f, i) => (
                <div key={i} className={i === 0 ? 'now' : ''}>
                  <div className="stp-when">{f.quando}</div>
                  <h3>{f.titulo}</h3>
                  <p>{f.frase}</p>
                </div>
              ))}
            </div>
            {!!c.cronograma?.length && (
              <Details label={t('Ver o que entra em cada fase', 'See what each phase includes', 'Ver qué incluye cada fase')}>
                {c.cronograma.map((f, i) => <div key={i} style={{ marginTop: 10 }}><p className="stp-dt">{f.fase} · {f.prazo}</p><p>{f.entregas}</p></div>)}
              </Details>
            )}
          </section>
        )}

        {/* Precisamos */}
        {!!v.precisamos.length && (
          <section>
            <Eyebrow>{t('Para começar', 'To get started', 'Para empezar')}</Eyebrow>
            <h2 className="stp-h2">{t('O que precisamos de você', 'What we need from you', 'Lo que necesitamos de ti')}</h2>
            {v.precisamos.some(p => p.trava) && <p className="stp-intro">{t('Os itens marcados travam o lançamento.', 'The marked items block the launch.', 'Los ítems marcados frenan el lanzamiento.')}</p>}
            <div className="stp-check">
              {[...v.precisamos].sort((a, b) => Number(!!b.trava) - Number(!!a.trava)).map((p, i) => (
                <label key={i}><input type="checkbox" /><span>{p.item}{p.trava && <span className="stp-pri">{t('Trava o lançamento', 'Blocks the launch', 'Frena el lanzamiento')}</span>}</span></label>
              ))}
            </div>
          </section>
        )}

        {/* Perguntas */}
        {!!v.perguntas?.length && (
          <section>
            <Eyebrow>{t('Antes de ligar a verba', 'Before we turn on the budget', 'Antes de activar el presupuesto')}</Eyebrow>
            <h2 className="stp-h2">{t('Perguntas para você', 'Questions for you', 'Preguntas para ti')}</h2>
            <div className="stp-q">{v.perguntas.map((q, i) => <div key={i}><b>{q.titulo}</b><p>{q.frase}</p></div>)}</div>
          </section>
        )}

        {/* Resposta */}
        <section className="stp-answer" id="responder">
          {s.status === 'approved' ? (
            <>
              <h2 className="stp-h2">{t('Estratégia aprovada', 'Strategy approved', 'Estrategia aprobada')}{s.responded_name ? ` ${t('por', 'by', 'por')} ${s.responded_name}` : ''}.</h2>
              <p className="stp-intro">{t('Já estamos preparando as campanhas.', 'We are already setting up the campaigns.', 'Ya estamos preparando las campañas.')}</p>
            </>
          ) : s.status === 'changes' ? (
            <>
              <h2 className="stp-h2">{t('Recebemos seus ajustes.', 'We got your notes.', 'Recibimos tus ajustes.')}</h2>
              <p className="stp-intro">{t('Vamos mandar a nova versão em breve.', 'We will send the new version soon.', 'Te enviaremos la nueva versión pronto.')}</p>
              {s.client_feedback && <p className="stp-feedback">{s.client_feedback}</p>}
            </>
          ) : (
            <>
              <h2 className="stp-h2">{t('Tudo certo para começar?', 'Ready to get started?', '¿Todo listo para empezar?')}</h2>
              {preview && <p className="stp-intro" style={{ color: 'var(--warn)' }}>{t('Prévia da equipe: os botões ficam desativados.', 'Team preview: buttons are disabled.', 'Vista previa del equipo: los botones están desactivados.')}</p>}
              {s.status === 'draft' && <p className="stp-intro">{t('Rascunho: o cliente ainda não recebeu.', 'Draft: not sent to the client yet.', 'Borrador: el cliente aún no la recibió.')}</p>}
              <label className="stp-field">
                <span>{t('Seu nome (opcional)', 'Your name (optional)', 'Tu nombre (opcional)')}</span>
                <input value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder={t('Para sabermos quem aprovou', 'So we know who approved', 'Para saber quién aprobó')} />
              </label>
              {mode === 'changes' && (
                <label className="stp-field">
                  <span>{t('O que você quer mudar?', 'What would you like to change?', '¿Qué quieres cambiar?')}</span>
                  <textarea rows={4} autoFocus value={feedback} onChange={e => setFeedback(e.target.value)} maxLength={4000} />
                </label>
              )}
              {err && <p style={{ color: 'var(--bad)', fontSize: 14 }}>{err}</p>}
              {mode === 'changes' && (
                <div className="stp-btns">
                  <button onClick={() => { setMode('idle'); setErr(''); }} className="stp-btn ghost">{t('Voltar', 'Back', 'Volver')}</button>
                  <button disabled={busy || !canRespond} onClick={() => respond('changes')} className="stp-btn">{busy ? t('Enviando...', 'Sending...', 'Enviando...') : t('Enviar ajustes', 'Send notes', 'Enviar ajustes')}</button>
                </div>
              )}
            </>
          )}
        </section>

        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" data-track="whatsapp" className="stp-wa"
            onClick={() => { if (!noTrack) callFunction(FN, { action: 'track', token, event: 'whatsapp_click', session: sessionId() }).catch(() => {}); }}>
            {t('Falar com a equipe no WhatsApp', 'Talk to the team on WhatsApp', 'Hablar con el equipo por WhatsApp')}
          </a>
        )}

        <footer className="stp-foot">{agency?.name}{sentDate ? ` · ${sentDate}` : ''}</footer>
      </main>

      {/* Barra fixa de resposta */}
      {(s.status === 'sent' || s.status === 'draft') && mode === 'idle' && (
        <div className="stp-cta">
          <div className="stp-cta-in">
            <span>{t('Gostou do caminho? Aprove ou peça ajuste em qualquer parte.', 'Like the plan? Approve it or ask for changes.', '¿Te gusta el camino? Apruébalo o pide ajustes.')}</span>
            <div className="stp-btns">
              <button disabled={!canRespond} onClick={() => { setMode('changes'); setErr(''); setTimeout(() => document.getElementById('responder')?.scrollIntoView({ behavior: 'smooth' }), 30); }} className="stp-btn ghost">{t('Pedir ajuste', 'Ask for changes', 'Pedir ajuste')}</button>
              <button disabled={busy || !canRespond} onClick={() => respond('approved')} className="stp-btn">{busy ? t('Enviando...', 'Sending...', 'Enviando...') : t('Aprovar estratégia', 'Approve strategy', 'Aprobar estrategia')}</button>
            </div>
          </div>
        </div>
      )}

      {preview && !framed && <PreviewCloseButton fallbackTab="onboarding" />}
      {preview && !framed && (
        <div className="fixed left-1/2 bottom-24 -translate-x-1/2 z-50 bg-[#13284D] text-white text-[13px] font-semibold px-4 py-2.5 rounded-full shadow-lg max-w-[calc(100%-32px)] text-center">
          Visualização da equipe: esta abertura não é registrada.
        </div>
      )}
    </div>
  );
};

/** Estilos da página (usam as variáveis do tema). */
const STP_CSS = `
.stp{font-size:16px;line-height:1.55}
.stp *{box-sizing:border-box}
.stp-wrap{max-width:1040px;margin:0 auto;padding:28px 16px 140px}
.stp-top{display:flex;justify-content:space-between;align-items:center;gap:12px;font:500 12px var(--fm);color:var(--muted)}
.stp-brand{font:var(--dw) 18px var(--fd);color:var(--ink);letter-spacing:var(--ls)}
.stp-pill{display:inline-block;font:700 11px/1 var(--fm);letter-spacing:.14em;text-transform:uppercase;color:var(--brand);border:1px solid var(--brand);padding:7px 10px;margin-top:44px;border-radius:var(--radius)}
.stp-h1{font:var(--dw) clamp(34px,6.5vw,62px)/1.04 var(--fd);letter-spacing:var(--ls);margin:18px 0 16px;max-width:880px;text-wrap:balance}
.stp-h1 em{font-style:normal;color:var(--brand)}
.stp-lead{font-size:19px;color:var(--sub);max-width:720px}
.stp section{margin-top:84px}
.stp-eyebrow{font:700 11px/1 var(--fm);letter-spacing:.16em;text-transform:uppercase;color:var(--brand);margin-bottom:10px;display:flex;align-items:center;gap:10px}
.stp-eyebrow:before{content:"";width:22px;height:1px;background:var(--brand)}
.stp-h2{font:var(--dw) clamp(26px,4vw,40px)/1.08 var(--fd);letter-spacing:var(--ls);margin:0 0 10px}
.stp-intro{color:var(--muted);max-width:640px;margin:0 0 24px}
.stp-grid{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.stp-g1{grid-template-columns:1fr}.stp-g2{grid-template-columns:repeat(2,1fr)}.stp-g3{grid-template-columns:repeat(3,1fr)}.stp-g4{grid-template-columns:repeat(4,1fr)}
.stp-cell{background:var(--paper);padding:24px;min-width:0}
.stp-cell p{color:var(--sub);font-size:15px;margin:0}
.stp-k{font:500 11px var(--fm);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:12px}
.stp-big{font:var(--dw) clamp(28px,4.2vw,44px)/1.05 var(--fd);letter-spacing:var(--ls);overflow-wrap:anywhere}
.stp-s{color:var(--muted);font-size:14px;margin-top:8px}
.stp-status{display:inline-flex;align-items:center;gap:8px;font:700 11px var(--fm);letter-spacing:.1em;text-transform:uppercase}
.stp-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
.stp-h3{font:600 20px/1.25 var(--fd);margin:12px 0 6px}
.stp-num{font:var(--dw) 22px var(--fd)}
.stp-gauge{display:flex;align-items:center;gap:16px;margin-top:4px}
.stp-gauge svg{flex:none}
.stp-bar{height:8px;background:var(--paper2);border:1px solid var(--line);position:relative;margin-top:14px}
.stp-bar i{position:absolute;top:0;bottom:0;left:0}
.stp-band{position:absolute;top:-4px;bottom:-4px;left:20%;width:40%;border:1px dashed var(--ok)}
.stp-legend{display:flex;justify-content:space-between;font:500 11px var(--fm);color:var(--muted);margin-top:8px}
.stp-details{margin-top:14px;border-top:1px solid var(--line);padding-top:12px}
.stp-details summary{cursor:pointer;font:700 11px var(--fm);letter-spacing:.12em;text-transform:uppercase;color:var(--brand);list-style:none}
.stp-details summary::-webkit-details-marker{display:none}
.stp-details summary:after{content:" +"}.stp-details[open] summary:after{content:" −"}
.stp-details p{color:var(--muted)!important;font-size:14px;margin:8px 0 0}
.stp-dt{font-weight:700;color:var(--ink)!important}
.stp-funnel{display:grid;gap:10px}
.stp-step{display:grid;grid-template-columns:56px 1fr auto;align-items:center;gap:18px;background:var(--paper);border:1px solid var(--line);padding:18px 22px;border-radius:var(--radius)}
.stp-n{font:var(--dw) 28px var(--fd);color:var(--brand)}
.stp-step h3{font:600 19px var(--fd);margin:0}
.stp-step p{color:var(--muted);font-size:14px;margin:2px 0 0}
.stp-w{font:700 12px var(--fm);color:var(--on-brand);background:var(--brand);padding:6px 9px;white-space:nowrap;border-radius:var(--radius)}
.stp-w.dim{background:transparent;color:var(--muted);border:1px solid var(--line)}
.stp-ico{width:40px;height:40px;border:1px solid var(--line);display:grid;place-items:center;font-size:20px;background:var(--paper2);border-radius:var(--radius)}
.stp-tag{font:500 11px var(--fm);color:var(--brand);letter-spacing:.08em;text-transform:uppercase;margin-top:10px}
.stp-budget{display:grid;grid-template-columns:280px 1fr;gap:40px;align-items:center;background:var(--paper);border:1px solid var(--line);padding:32px;border-radius:var(--radius)}
.stp-donut{width:100%;max-width:260px;margin:0 auto;display:block}
.stp-lgd>div{display:grid;grid-template-columns:14px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
.stp-c{width:14px;height:14px;border-radius:calc(var(--radius) / 4)}
.stp-lgd b{font:var(--dw) 20px var(--fd)}
.stp-lgd small{display:block;color:var(--muted);font-size:13px}
.stp-alt{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.stp-alt div{border:1px solid var(--line);padding:10px 14px;font-size:14px;color:var(--sub);border-radius:var(--radius)}
.stp-alt b{font:700 12px var(--fm);color:var(--ink);display:block}
.stp-chips{display:flex;flex-wrap:wrap;gap:8px}
.stp-chips span{border:1px solid var(--line);background:var(--paper);padding:8px 12px;font-size:14px;color:var(--sub);border-radius:var(--radius)}
.stp-tl{display:grid;border-top:2px solid var(--line);margin-top:30px}
.stp-tl>div{padding:22px 16px 0 0;position:relative}
.stp-tl>div:before{content:"";position:absolute;top:-7px;left:0;width:12px;height:12px;background:var(--bg);border:2px solid var(--brand);border-radius:calc(var(--radius) / 2)}
.stp-tl>div.now:before{background:var(--brand)}
.stp-when{font:700 11px var(--fm);letter-spacing:.1em;text-transform:uppercase;color:var(--brand)}
.stp-tl h3{font:600 18px/1.25 var(--fd);margin:8px 0 6px}
.stp-tl p{color:var(--muted);font-size:14px;margin:0}
.stp-check{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.stp-check label{background:var(--paper);padding:16px 18px;display:flex;gap:12px;align-items:flex-start;cursor:pointer;font-size:15px;color:var(--sub)}
.stp-check input{appearance:none;-webkit-appearance:none;width:18px;height:18px;border:1px solid var(--muted);flex:none;margin-top:2px;border-radius:calc(var(--radius) / 4)}
.stp-check input:checked{background:var(--brand);border-color:var(--brand)}
.stp-pri{font:700 10px var(--fm);letter-spacing:.1em;text-transform:uppercase;color:var(--bad);display:block;margin-top:4px}
.stp-q{display:grid;gap:10px}
.stp-q div{border-left:2px solid var(--brand);background:var(--paper);padding:14px 18px}
.stp-q b{font:600 16px var(--fd)}
.stp-q p{color:var(--muted);font-size:14px;margin:2px 0 0}
.stp-answer{border:2px solid var(--brand);background:var(--paper);padding:28px;border-radius:var(--radius);display:flex;flex-direction:column;gap:14px}
.stp-answer .stp-intro{margin:0}
.stp-field{display:flex;flex-direction:column;gap:6px}
.stp-field span{font-size:13px;font-weight:600;color:var(--muted)}
.stp-field input,.stp-field textarea{padding:12px 14px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:inherit;border-radius:calc(var(--radius) / 1.5)}
.stp-feedback{white-space:pre-wrap;padding:16px;background:var(--bg);font-size:15px;border-radius:var(--radius)}
.stp-btns{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.stp-btn{font:700 15px var(--ft);padding:13px 20px;border:1px solid var(--brand);background:var(--brand);color:var(--on-brand);cursor:pointer;border-radius:calc(var(--radius) / 1.5)}
.stp-btn.ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.stp-btn:disabled{opacity:.5;cursor:not-allowed}
.stp-wa{display:block;text-align:center;margin-top:28px;font-size:14px;font-weight:600;color:var(--ok)}
.stp-foot{text-align:center;font:500 12px var(--fm);color:var(--muted);margin-top:28px}
.stp-cta{position:fixed;left:0;right:0;bottom:0;z-index:40;background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(8px);border-top:1px solid var(--line);padding:14px 16px}
.stp-cta-in{max-width:1040px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:14px}
.stp-cta-in>span{color:var(--muted);font-size:14px;min-width:0}
.stp-cta-in .stp-btns{flex-wrap:nowrap;flex:none}
@media (max-width:820px){.stp-cta-in>span{display:none}.stp-cta-in{justify-content:flex-end}.stp-g3,.stp-g4{grid-template-columns:1fr 1fr}.stp-budget{grid-template-columns:1fr}.stp-tl{grid-template-columns:1fr!important;border-top:0;border-left:2px solid var(--line);margin-left:6px}.stp-tl>div{padding:0 0 24px 22px}.stp-tl>div:before{top:4px;left:-7px}.stp-step{margin-inline:0!important}}
@media (max-width:560px){.stp-g2,.stp-g3,.stp-g4,.stp-check{grid-template-columns:1fr}.stp-step{grid-template-columns:40px 1fr;padding:16px}.stp-w{grid-column:2;justify-self:start}.stp-cta-in>span{display:none}.stp-cta-in .stp-btns{flex:1}.stp-cta-in .stp-btn{flex:1}.stp-budget{padding:22px}}
`;

export default StrategyPublicPage;

import React, { useEffect, useRef, useState } from 'react';
import { callFunction, supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/money';
import { PreviewCloseButton } from '../../lib/previewClose';

/**
 * Página pública da proposta gerada na Bolsa (/p/<slug>), no visual da proposta do Álvaro.
 * Registro de abertura igual ao das propostas (função proposal-track): não conta em iframe nem em aparelho marcado com ?preview.
 * Em ?preview, a equipe logada vê também rascunhos (leitura direta da tabela).
 */

type Lang = 'pt' | 'en' | 'es';
export interface ProposalContent {
  titulo?: string; abertura?: string; o_que_entendemos?: string[]; objetivos?: string[];
  servicos?: { nome: string; descricao: string; entregas: string[] }[];
  etapas?: { fase: string; prazo: string; descricao: string }[];
  planos?: { nome: string; mensal: number; implantacao?: number; inclui: string[]; destaque?: boolean }[];
  condicoes?: string[]; proximos_passos?: string[]; pontos_em_aberto?: string[];
}
interface Data {
  proposal: { slug: string; prospect_name: string; title: string | null; whatsapp: string | null; currency: string | null; status: string; content: ProposalContent; language: Lang | null; version: number; sent_at: string | null; created_at: string };
  agency: { name: string; logo_url: string | null; primary_color: string | null; contact_whatsapp: string | null } | null;
}

const isPreviewDevice = () => {
  const params = new URLSearchParams(window.location.search);
  try {
    if (params.get('preview') === 'off') localStorage.removeItem('bolsa_preview');
    else if (params.has('preview')) localStorage.setItem('bolsa_preview', '1');
    return localStorage.getItem('bolsa_preview') === '1';
  } catch { return params.has('preview') && params.get('preview') !== 'off'; }
};
const inFrame = () => { try { return window.self !== window.top; } catch { return true; } };
const sid = () => {
  try { let s = sessionStorage.getItem('pt_sid'); if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('pt_sid', s); } return s; }
  catch { return Math.random().toString(36).slice(2); }
};
const track = (slug: string, event: string, extra: Record<string, unknown> = {}) =>
  callFunction('proposal-track', { slug, event, session: sid(), ...extra }).catch(() => {});

export const ProposalPublicPage: React.FC<{ slug: string }> = ({ slug }) => {
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [preview] = useState(() => isPreviewDevice());
  const [showingDraft, setShowingDraft] = useState(false);
  const [framed] = useState(() => inFrame());
  const noTrack = preview || framed;
  const tracked = useRef(false);

  useEffect(() => {
    (async () => {
      if (preview) {
        const { data: p } = await supabase.from('proposals').select('*').eq('slug', slug).maybeSingle();
        if (p && (p as any).content) {
          if (new URLSearchParams(window.location.search).get('draft') === '1' && (p as any).draft_content) {
            (p as any).content = (p as any).draft_content; setShowingDraft(true);
          }
          const { data: a } = await supabase.from('agencies').select('name, logo_url, primary_color, contact_whatsapp').eq('id', (p as any).agency_id).maybeSingle();
          setData({ proposal: p as any, agency: (a as any) || null }); setState('ok'); return;
        }
      }
      const { data: d, error } = await callFunction<Data>('proposal-page', { slug });
      if (error || !d) { setState('notfound'); return; }
      setData(d); setState('ok');
    })();
  }, [slug, preview]);

  useEffect(() => {
    if (state !== 'ok' || noTrack || tracked.current) return;
    tracked.current = true;
    track(slug, 'open');
    let visible = 0; let last = Date.now(); let active = !document.hidden;
    const tick = () => { if (active) visible += (Date.now() - last) / 1000; last = Date.now(); };
    const onVis = () => { tick(); active = !document.hidden; if (document.hidden) track(slug, 'read_time', { seconds: Math.round(visible) }); };
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(() => { tick(); track(slug, 'read_time', { seconds: Math.round(visible) }); }, 30000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(iv); };
  }, [state, noTrack, slug]);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex, nofollow'; document.head.appendChild(meta);
    return () => { link.remove(); meta.remove(); };
  }, []);

  const lang: Lang = (data?.proposal.language as Lang) || 'pt';
  const t = (pt: string, en: string, es: string) => (lang === 'en' ? en : lang === 'es' ? es : pt);
  useEffect(() => { if (data) document.title = `${t('Proposta', 'Proposal', 'Propuesta')} · ${data.proposal.prospect_name}`; }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const brand = data?.agency?.primary_color || '#456DA1';
  const css = { '--bg': '#F5F7FB', '--paper': '#FFFFFF', '--ink': '#13284D', '--muted': '#56647C', '--line': '#DCE3EE', fontFamily: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif' } as React.CSSProperties;
  const display: React.CSSProperties = { fontFamily: 'Fraunces, Georgia, "Times New Roman", serif', letterSpacing: '-0.01em' };

  if (state === 'loading') return <div style={css} className="min-h-screen bg-[var(--bg)]"><div className="max-w-[760px] mx-auto px-4 py-12 space-y-6 animate-pulse"><div className="h-4 w-40 rounded bg-gray-200" /><div className="h-12 w-3/4 rounded bg-gray-200" /><div className="h-24 rounded-2xl bg-gray-200" /></div></div>;
  if (state === 'notfound' || !data) return <div style={css} className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-6 text-center"><div><p style={display} className="text-2xl font-semibold text-[var(--ink)]">Esta proposta não está disponível.</p><p className="mt-2 text-[var(--muted)]">Fale com quem te enviou. / This proposal is not available.</p></div></div>;

  const { proposal: p, agency } = data;
  const c = p.content || {};
  const cur = p.currency || 'BRL';
  const waDigits = (agency?.contact_whatsapp || '').replace(/\D/g, '');
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(t(`Olá! Vi a proposta para ${p.prospect_name} e quero conversar.`, `Hi! I saw the proposal for ${p.prospect_name} and would like to talk.`, `¡Hola! Vi la propuesta para ${p.prospect_name} y quiero conversar.`))}` : null;
  const onWa = () => { if (!noTrack) track(slug, 'whatsapp_click'); };
  const card = 'bg-[var(--paper)] border border-[var(--line)] rounded-2xl';
  const H2 = ({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) => (
    <div><p className="text-[12px] font-bold uppercase tracking-[.14em] mb-2" style={{ color: brand }}>{eyebrow}</p>
      <h2 style={display} className="text-[clamp(24px,4.5vw,30px)] leading-tight font-semibold">{children}</h2></div>
  );
  const Bullets = ({ items }: { items?: string[] }) => !items?.length ? null : (
    <ul className="flex flex-col gap-2.5">{items.map((x, i) => <li key={i} className="relative pl-6 max-w-[65ch]"><span className="absolute left-1 top-[.7em] w-[7px] h-[7px] rounded-[2px]" style={{ backgroundColor: brand }} />{x}</li>)}</ul>
  );

  return (
    <div style={css} className="min-h-screen bg-[var(--bg)] text-[var(--ink)] text-[16px] leading-relaxed">
      <main className="max-w-[760px] mx-auto px-4 sm:px-5 pt-10 pb-24 flex flex-col gap-11">
        <div className="flex items-center justify-between gap-3 text-[13px] text-[var(--muted)]">
          {agency?.logo_url ? <img src={agency.logo_url} alt={agency.name} className="h-8 w-auto max-w-[160px] object-contain" /> : <b className="text-[12px] uppercase tracking-[.14em] text-[var(--ink)]">{agency?.name}</b>}
          <span>{t('Proposta comercial', 'Proposal', 'Propuesta comercial')}{p.status === 'draft' ? ' · rascunho' : ''}</span>
        </div>

        <section className="flex flex-col gap-4">
          <span className="self-start text-[11px] font-bold uppercase tracking-[.1em] px-2.5 py-1 rounded-full" style={{ color: brand, backgroundColor: `${brand}1A` }}>
            {t(`Para ${p.prospect_name}`, `For ${p.prospect_name}`, `Para ${p.prospect_name}`)}
          </span>
          <h1 style={display} className="text-[clamp(34px,7vw,52px)] leading-[1.05] font-semibold">{c.titulo || p.title}</h1>
          {c.abertura && <p className="text-[18px] text-[var(--muted)] max-w-[62ch]">{c.abertura}</p>}
        </section>

        {!!c.o_que_entendemos?.length && <section className="flex flex-col gap-4"><H2 eyebrow={t('Seu momento', 'Where you are', 'Tu momento')}>{t('O que entendemos', 'What we understood', 'Lo que entendimos')}</H2><Bullets items={c.o_que_entendemos} /></section>}
        {!!c.objetivos?.length && <section className="flex flex-col gap-4"><H2 eyebrow={t('Objetivos', 'Goals', 'Objetivos')}>{t('Onde queremos chegar', 'Where we want to go', 'A dónde queremos llegar')}</H2><Bullets items={c.objetivos} /></section>}

        {!!c.servicos?.length && (
          <section className="flex flex-col gap-4">
            <H2 eyebrow={t('O que fazemos', 'What we do', 'Lo que hacemos')}>{t('O trabalho', 'The work', 'El trabajo')}</H2>
            <div className="grid sm:grid-cols-2 gap-3">
              {c.servicos.map((s, i) => (
                <div key={i} className={`${card} p-5 flex flex-col gap-2`}>
                  <p className="font-bold">{s.nome}</p><p className="text-[15px] text-[var(--muted)]">{s.descricao}</p>
                  {!!s.entregas?.length && <ul className="text-[14px] flex flex-col gap-1 mt-1">{s.entregas.map((e, j) => <li key={j}>· {e}</li>)}</ul>}
                </div>
              ))}
            </div>
          </section>
        )}

        {!!c.etapas?.length && (
          <section className="flex flex-col gap-4">
            <H2 eyebrow={t('Como funciona', 'How it works', 'Cómo funciona')}>{t('Os primeiros passos', 'The first steps', 'Los primeros pasos')}</H2>
            <ol className="flex flex-col">
              {c.etapas.map((f, i) => (
                <li key={i} className="flex gap-4">
                  <div className="flex flex-col items-center"><span className="w-8 h-8 shrink-0 rounded-full text-white text-sm font-bold flex items-center justify-center" style={{ backgroundColor: brand }}>{i + 1}</span>{i < c.etapas!.length - 1 && <span className="w-px flex-1 bg-[var(--line)] my-1" />}</div>
                  <div className="pb-6"><p className="font-bold">{f.fase} <span className="font-normal text-[var(--muted)]">· {f.prazo}</span></p><p className="text-[15px] mt-0.5">{f.descricao}</p></div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {!!c.planos?.length && (
          <section className="flex flex-col gap-4">
            <H2 eyebrow={t('Investimento', 'Investment', 'Inversión')}>{t('Como podemos trabalhar juntos', 'How we can work together', 'Cómo podemos trabajar juntos')}</H2>
            <div className={`grid gap-3 ${c.planos.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {c.planos.map((pl, i) => (
                <div key={i} className={`${card} p-6 flex flex-col gap-3`} style={pl.destaque || c.planos!.length === 1 ? { borderColor: brand, boxShadow: '0 10px 30px rgba(19,40,77,.08)' } : undefined}>
                  {pl.destaque && c.planos!.length > 1 && <span className="self-start text-[11px] font-bold uppercase tracking-[.1em] px-2 py-1 rounded-full" style={{ color: brand, backgroundColor: `${brand}1A` }}>{t('Recomendado', 'Recommended', 'Recomendado')}</span>}
                  <p className="font-bold">{pl.nome}</p>
                  <p style={display} className="text-[36px] leading-none font-semibold tabular-nums">{formatMoney(pl.mensal, cur, { compact: true })}<span className="text-[14px] font-medium text-[var(--muted)]" style={{ fontFamily: 'inherit' }}>{t('/mês', '/month', '/mes')}</span></p>
                  {!!pl.implantacao && <p className="text-[14px] text-[var(--muted)]">+ {formatMoney(pl.implantacao, cur, { compact: true })} {t('de implantação', 'setup fee', 'de implementación')}</p>}
                  <ul className="text-[15px] flex flex-col gap-1.5">{pl.inclui?.map((x, j) => <li key={j}>· {x}</li>)}</ul>
                </div>
              ))}
            </div>
            <Bullets items={c.condicoes} />
          </section>
        )}

        {!!c.proximos_passos?.length && <section className="flex flex-col gap-4"><H2 eyebrow={t('Próximos passos', 'Next steps', 'Próximos pasos')}>{t('Para começar', 'To get started', 'Para empezar')}</H2><Bullets items={c.proximos_passos} /></section>}

        {waHref && (
          <section className={`${card} p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4`} style={{ borderColor: brand, borderWidth: 2 }}>
            <div className="flex-1"><h2 style={display} className="text-2xl font-semibold">{t('Vamos começar?', 'Shall we start?', '¿Empezamos?')}</h2><p className="text-[var(--muted)] mt-1">{t('Fale com a gente no WhatsApp para fechar ou tirar dúvidas.', 'Message us on WhatsApp to close or ask anything.', 'Escríbenos por WhatsApp para cerrar o resolver dudas.')}</p></div>
            <a id="cta-whatsapp" data-track="whatsapp" href={waHref} onClick={onWa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-emerald-600 text-white font-semibold">{t('Falar no WhatsApp', 'Message on WhatsApp', 'Hablar por WhatsApp')}</a>
          </section>
        )}

        <footer className="text-center text-[13px] text-[var(--muted)]">{agency?.name}</footer>
      </main>
      {preview && !framed && <PreviewCloseButton fallbackTab="propostas" />}
      {preview && !framed && <div className="fixed left-1/2 bottom-4 -translate-x-1/2 z-50 bg-[#13284D] text-white text-[13px] font-semibold px-4 py-2.5 rounded-full shadow-lg max-w-[calc(100%-32px)] text-center">{showingDraft ? 'Ajuste ainda não publicado. O cliente ainda vê a versão anterior.' : 'Visualização da equipe: esta abertura não é registrada.'}</div>}
    </div>
  );
};

export default ProposalPublicPage;

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PreviewCloseButton } from '../../lib/previewClose';

/**
 * Guia da Bolsa como página pública (/g/<slug>). Sem login: qualquer pessoa com o link vê um guia publicado.
 * O conteúdo é JSON (hero, steps, sections) e é editado pela equipe em Operação › Guias, pedindo ao Claude.
 * Com ?preview a equipe logada vê também guias não publicados.
 */

type Tone = 'cliente' | 'equipe' | 'socio';
export interface GuideImage { src: string; alt: string; frame: 'phone' | 'browser' }
export interface GuideSection {
  kind?: 'section' | 'note'; who?: string; tone?: Tone; layout?: 'image-right' | 'image-left' | 'stack'; dark?: boolean;
  title: string; text?: string; bullets?: string[]; cards?: { title: string; text: string }[]; images?: GuideImage[];
}
export interface GuideContent {
  hero: { eyebrow: string; title: string; text: string };
  steps?: { title: string; who: string; tone: Tone }[];
  sections: GuideSection[];
}
interface Guide { slug: string; title: string; language: 'pt' | 'en' | 'es'; content: GuideContent; agency_id: number; is_published: boolean }

const display: React.CSSProperties = { fontFamily: 'Fraunces, Georgia, "Times New Roman", serif', letterSpacing: '-0.01em' };

const Who: React.FC<{ tone?: Tone; children: React.ReactNode; onDark?: boolean }> = ({ tone, children, onDark }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
    onDark ? 'bg-white text-[#13284D]' : tone === 'cliente' ? 'bg-[#E6F2EC] text-[#22603F]' : 'bg-[#13284D] text-white'}`}>{children}</span>
);

const Shot: React.FC<{ im: GuideImage }> = ({ im }) => im.frame === 'phone' ? (
  <div className="w-[230px] sm:w-[240px] shrink-0 rounded-[34px] border-[9px] border-[#13284D] bg-[#13284D] overflow-hidden shadow-[0_18px_40px_rgba(19,40,77,.18)]">
    <img src={im.src} alt={im.alt} loading="lazy" className="block w-full h-auto rounded-[25px]" />
  </div>
) : (
  <div className="w-full max-w-[880px] rounded-[14px] border border-[#DCE3EE] bg-white overflow-hidden shadow-[0_18px_40px_rgba(19,40,77,.12)]">
    <div className="flex gap-1.5 px-3.5 py-2.5 border-b border-[#DCE3EE] bg-[#F5F7FB]">{[0, 1, 2].map(i => <span key={i} className="w-2.5 h-2.5 rounded-full bg-[#C9D3E3]" />)}</div>
    <img src={im.src} alt={im.alt} loading="lazy" className="block w-full h-auto" />
  </div>
);

export const GuideBody: React.FC<{ content: GuideContent; logo?: string | null; agencyName?: string }> = ({ content: c, logo, agencyName }) => {
  const sections = c.sections || [];
  let n = 0;
  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#13284D] leading-relaxed" style={{ fontFamily: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif' }}>
      <header className="max-w-[1180px] mx-auto px-5 sm:px-6 pt-12 sm:pt-16 pb-10">
        {logo ? <img src={logo} alt={agencyName || ''} className="h-9 w-auto mb-8 object-contain" /> : null}
        <p className="m-0 mb-4 text-[13px] font-bold tracking-[.12em] uppercase text-[#456DA1]">{c.hero?.eyebrow}</p>
        <h1 style={display} className="m-0 max-w-[900px] font-semibold text-[clamp(34px,5.4vw,64px)] leading-[1.05]">{c.hero?.title}</h1>
        <p className="mt-6 max-w-[720px] text-[18px] sm:text-[19px] leading-[1.6] text-[#56647C]">{c.hero?.text}</p>
        {!!c.steps?.length && (
          <div className="mt-10 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            {c.steps.map((s, i) => (
              <a key={i} href={`#s${i + 1}`} className="no-underline text-inherit bg-white border border-[#DCE3EE] rounded-[14px] p-3.5 flex flex-col gap-2 hover:border-[#456DA1]">
                <span className="text-[12px] font-bold text-[#456DA1]">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-bold text-[15px]">{s.title}</span>
                <span className="self-start"><Who tone={s.tone}>{s.who}</Who></span>
              </a>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-[1180px] mx-auto px-5 sm:px-6 pb-24 flex flex-col gap-7">
        {sections.map((s, i) => {
          if (s.kind === 'note') return (
            <section key={i} className="border border-dashed border-[#B9C6DA] rounded-3xl px-6 sm:px-11 py-9">
              <h2 style={display} className="m-0 mb-3.5 font-semibold text-[28px]">{s.title}</h2>
              {s.text && <p className="m-0 mb-3 text-[16px] text-[#3B4A63]">{s.text}</p>}
              {!!s.bullets?.length && <ul className="m-0 pl-5 text-[16px] leading-[1.55] text-[#3B4A63] sm:columns-2 gap-10">{s.bullets.map((b, j) => <li key={j} className="mb-2 break-inside-avoid">{b}</li>)}</ul>}
            </section>
          );
          n += 1;
          const num = String(n).padStart(2, '0');
          const dark = !!s.dark;
          const imgs = s.images || [];
          const stack = s.layout === 'stack' || imgs.length > 1 || imgs.some(im => im.frame === 'browser' && s.layout !== 'image-left' && s.layout !== 'image-right');
          const textBlock = (
            <div className="min-w-0 flex-1 basis-[380px]">
              <p className="m-0 flex gap-2.5 items-center"><span style={display} className={`text-[44px] font-semibold ${dark ? 'text-[#9DB7DE]' : 'text-[#456DA1]'}`}>{num}</span>{s.who && <Who tone={s.tone} onDark={dark}>{s.who}</Who>}</p>
              <h2 style={display} className="mt-2.5 mb-3.5 font-semibold text-[clamp(26px,3.4vw,34px)] leading-[1.12]">{s.title}</h2>
              {s.text && <p className={`m-0 text-[17px] leading-[1.55] ${dark ? 'text-[#D4DEEE]' : 'text-[#3B4A63]'}`}>{s.text}</p>}
              {!!s.bullets?.length && !stack && <ul className={`mt-3 mb-0 pl-5 text-[17px] leading-[1.55] ${dark ? 'text-[#D4DEEE]' : 'text-[#3B4A63]'}`}>{s.bullets.map((b, j) => <li key={j} className="mb-2">{b}</li>)}</ul>}
            </div>
          );
          const cards = !!s.cards?.length && (
            <div className="min-w-0 flex-1 basis-[380px] grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
              {s.cards.map((cd, j) => (
                <div key={j} className={`rounded-[14px] px-4 py-3.5 ${dark ? 'bg-white/10' : 'bg-[#F5F7FB]'}`}>
                  <p className="m-0 font-bold">{cd.title}</p>
                  <p className={`mt-1 mb-0 text-[14px] leading-[1.45] ${dark ? 'text-[#D4DEEE]' : 'text-[#56647C]'}`}>{cd.text}</p>
                </div>
              ))}
            </div>
          );
          const box = `rounded-3xl p-6 sm:p-11 ${dark ? 'bg-[#13284D] text-white' : 'bg-white border border-[#DCE3EE]'}`;
          if (stack) return (
            <section key={i} id={`s${n}`} className={`${box} flex flex-col gap-8 scroll-mt-6`}>
              <div className="flex flex-wrap gap-10">
                {textBlock}
                {cards || (!!s.bullets?.length && <ul className={`min-w-0 flex-1 basis-[380px] m-0 pl-5 text-[16px] leading-[1.55] ${dark ? 'text-[#D4DEEE]' : 'text-[#3B4A63]'}`}>{s.bullets.map((b, j) => <li key={j} className="mb-2">{b}</li>)}</ul>)}
              </div>
              {cards && !!s.bullets?.length && <ul className={`m-0 pl-5 text-[16px] leading-[1.55] sm:columns-2 gap-10 ${dark ? 'text-[#D4DEEE]' : 'text-[#3B4A63]'}`}>{s.bullets.map((b, j) => <li key={j} className="mb-2 break-inside-avoid">{b}</li>)}</ul>}
              {!!imgs.length && (
                imgs.length === 1 && imgs[0].frame === 'browser'
                  ? <div className="flex justify-center"><Shot im={imgs[0]} /></div>
                  : <div className="flex gap-5 overflow-x-auto pb-4 pt-2 px-1 sm:flex-wrap sm:justify-center">{imgs.map((im, j) => <Shot key={j} im={im} />)}</div>
              )}
            </section>
          );
          const media = imgs.length ? <div className={`flex justify-center ${imgs[0].frame === 'browser' ? 'flex-1 basis-[420px] min-w-0' : 'basis-[260px] grow-0'}`}><Shot im={imgs[0]} /></div> : cards || null;
          return (
            <section key={i} id={`s${n}`} className={`${box} flex flex-wrap gap-10 items-center scroll-mt-6`}>
              {s.layout === 'image-left' ? <>{media}{textBlock}</> : <>{textBlock}{media}</>}
            </section>
          );
        })}
      </main>
    </div>
  );
};

export const GuidePage: React.FC<{ slug: string }> = ({ slug }) => {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [agency, setAgency] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('preview');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('guides').select('slug, title, language, content, agency_id, is_published').eq('slug', slug).maybeSingle();
      if (!data) { setState('notfound'); return; }
      setGuide(data as Guide);
      const { data: a } = await supabase.from('agencies').select('name, logo_url').eq('id', (data as any).agency_id).maybeSingle();
      setAgency((a as any) || null);
      setState('ok');
    })();
  }, [slug]);

  useEffect(() => { if (guide) document.title = guide.title; }, [guide]);

  if (state === 'loading') return <div className="min-h-screen bg-[#F5F7FB]"><div className="max-w-[1180px] mx-auto px-6 py-16 space-y-6 animate-pulse"><div className="h-4 w-48 rounded bg-gray-200" /><div className="h-14 w-3/4 rounded bg-gray-200" /><div className="h-28 rounded-2xl bg-gray-200" /></div></div>;
  if (state === 'notfound' || !guide) return (
    <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center px-6 text-center text-[#13284D]">
      <div><p style={display} className="text-2xl font-semibold">Este guia não está disponível.</p><p className="mt-2 text-[#56647C]">Fale com quem te enviou. / This guide is not available.</p></div>
    </div>
  );
  return (
    <>
      {preview && <PreviewCloseButton fallbackTab="guias" />}
      <GuideBody content={guide.content} logo={agency?.logo_url} agencyName={agency?.name} />
    </>
  );
};

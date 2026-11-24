import React, { useEffect, useState } from 'react';
import { callFunction } from '../../lib/supabase';
import { STP_CSS } from './StrategyPublicPage';

/**
 * Página pública do Raio-X (/x/<token>), no mesmo visual da estratégia.
 * É o material da reunião de fechamento: o que medimos de fora no site, nas tags e no Instagram.
 * Um link por cliente, que sempre mostra o Raio-X mais recente.
 */

type Lang = 'pt' | 'en' | 'es';
type St = 'critico' | 'melhorar' | 'forte';
interface XData {
  collected_at: string | null;
  website: string | null;
  speed: { performance_mobile: number | null; lcp_s: number | null; total_kb: number | null } | null;
  instagram: {
    username: string | null; followers: number | null; posts_total: number | null; engagement_rate_pct: number | null;
    avg_interactions: number | null; repeated: number | null; last_posts: { date: string | null; type: string | null; interactions: number }[];
  } | null;
  tracking: { gtm: number; meta: number; ga4: number; ads: number; tiktok: number; linkedin: number; clarity: number; server_side: boolean } | null;
  site: {
    pages: number; kinds: Record<string, number>;
    contact: { forms: number; phone: number; whatsapp: number; email: number; scheduling: number } | null;
    has_meta_description: boolean; images_without_alt: number;
  } | null;
}
interface PageData {
  client: { name: string; lang: Lang; agency_id: number };
  agency: { name: string; logo_url: string | null; primary_color: string | null; contact_whatsapp: string | null } | null;
  xray: XData;
}
type T = (pt: string, en: string, es: string) => string;
interface Finding { status: St; titulo: string; frase: string }

/** Transforma os números do Raio-X em pontos claros, em ordem de prioridade. */
export function xrayFindings(x: XData, t: T, lang: Lang): Finding[] {
  const out: Finding[] = [];
  const num = (v: number) => v.toLocaleString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es' : 'pt-BR');
  const pct = (v: number) => String(v).replace('.', lang === 'en' ? '.' : ',');

  const sp = x.speed;
  if (sp?.performance_mobile != null) {
    const p = sp.performance_mobile;
    const lcp = sp.lcp_s != null ? t(` A página principal leva ${pct(sp.lcp_s)} s para aparecer.`, ` The home page takes ${pct(sp.lcp_s)} s to show up.`, ` La página principal tarda ${pct(sp.lcp_s)} s en aparecer.`) : '';
    const mb = sp.total_kb != null && sp.total_kb > 3000 ? t(` Ela pesa ${pct(Math.round(sp.total_kb / 102.4) / 10)} MB.`, ` It weighs ${pct(Math.round(sp.total_kb / 102.4) / 10)} MB.`, ` Pesa ${pct(Math.round(sp.total_kb / 102.4) / 10)} MB.`) : '';
    if (p < 50) out.push({ status: 'critico', titulo: t('Site lento no celular', 'Slow website on mobile', 'Sitio lento en el celular'),
      frase: t(`Nota ${p} de 100 no teste do Google.`, `Scored ${p} out of 100 on Google's test.`, `Nota ${p} de 100 en la prueba de Google.`) + lcp + mb + t(' Quem chega pelo anúncio pode desistir antes de ver a oferta.', ' People coming from an ad may leave before they see the offer.', ' Quien llega por el anuncio puede irse antes de ver la oferta.') });
    else if (p < 90) out.push({ status: 'melhorar', titulo: t('Velocidade razoável no celular', 'Mobile speed is fair', 'Velocidad aceptable en el celular'),
      frase: t(`Nota ${p} de 100 no teste do Google.`, `Scored ${p} out of 100 on Google's test.`, `Nota ${p} de 100 en la prueba de Google.`) + lcp + mb + t(' Dá para ganhar alguns segundos.', ' A few seconds can still be gained.', ' Se pueden ganar algunos segundos.') });
    else out.push({ status: 'forte', titulo: t('Site rápido no celular', 'Fast website on mobile', 'Sitio rápido en el celular'),
      frase: t(`Nota ${p} de 100 no teste do Google.`, `Scored ${p} out of 100 on Google's test.`, `Nota ${p} de 100 en la prueba de Google.`) + lcp });
  }

  const tr = x.tracking;
  if (tr) {
    const dup = [
      tr.gtm > 1 && t(`${tr.gtm} Google Tag Manager`, `${tr.gtm} Google Tag Manager containers`, `${tr.gtm} Google Tag Manager`),
      tr.meta > 1 && t(`${tr.meta} pixels do Meta`, `${tr.meta} Meta pixels`, `${tr.meta} píxeles de Meta`),
      tr.ga4 > 1 && t(`${tr.ga4} Google Analytics 4`, `${tr.ga4} Google Analytics 4 properties`, `${tr.ga4} Google Analytics 4`),
    ].filter(Boolean) as string[];
    if (dup.length) out.push({ status: 'critico', titulo: t('Rastreamento instalado em dobro', 'Tracking installed twice', 'Seguimiento instalado dos veces'),
      frase: t(`Encontramos ${dup.join(', ')} no mesmo site. Uma venda pode ser contada duas vezes, e os anúncios aprendem com números errados.`, `We found ${dup.join(', ')} on the same site. One sale can be counted twice, and the ads learn from the wrong numbers.`, `Encontramos ${dup.join(', ')} en el mismo sitio. Una venta puede contarse dos veces y los anuncios aprenden con números equivocados.`) });
    if (tr.meta === 0) out.push({ status: 'critico', titulo: t('Sem pixel do Meta', 'No Meta pixel', 'Sin píxel de Meta'),
      frase: t('O Instagram e o Facebook não sabem quem visitou o site. Não dá para anunciar de novo para esses visitantes nem medir quem virou cliente.', "Instagram and Facebook can't see who visited the site. You can't retarget those visitors or measure who became a customer.", 'Instagram y Facebook no saben quién visitó el sitio. No se puede volver a anunciar a esos visitantes ni medir quién se volvió cliente.') });
    if (tr.ads === 0) out.push({ status: 'melhorar', titulo: t('Sem tag do Google Ads', 'No Google Ads tag', 'Sin etiqueta de Google Ads'),
      frase: t('O Google não registra quem pediu orçamento depois de clicar no anúncio. Sem isso, ele não aprende quem compra.', "Google doesn't record who asked for a quote after clicking an ad, so it can't learn who buys.", 'Google no registra quién pidió presupuesto después de hacer clic en el anuncio, así que no aprende quién compra.') });
    if (tr.ga4 === 0) out.push({ status: 'melhorar', titulo: t('Sem Google Analytics 4', 'No Google Analytics 4', 'Sin Google Analytics 4'),
      frase: t('Não há um lugar neutro para comparar de onde vêm os visitantes e o que fazem no site.', "There's no neutral place to compare where visitors come from and what they do on the site.", 'No hay un lugar neutral para comparar de dónde vienen los visitantes y qué hacen en el sitio.') });
    if (tr.server_side) out.push({ status: 'forte', titulo: t('Rastreamento pelo servidor', 'Server-side tracking', 'Seguimiento desde el servidor'),
      frase: t('Mede com mais precisão que o padrão, mesmo com bloqueadores de anúncio.', 'More accurate than the standard setup, even with ad blockers.', 'Mide con más precisión que lo estándar, incluso con bloqueadores.') });
    if (!dup.length && tr.meta >= 1 && tr.ads >= 1 && tr.ga4 >= 1) out.push({ status: 'forte', titulo: t('Rastreamento completo', 'Tracking in place', 'Seguimiento completo'),
      frase: t('Pixel do Meta, Google Ads e Google Analytics instalados, uma vez cada.', 'Meta pixel, Google Ads and Google Analytics installed, once each.', 'Píxel de Meta, Google Ads y Google Analytics instalados, una vez cada uno.') });
  }

  const ig = x.instagram;
  if (ig) {
    const er = ig.engagement_rate_pct;
    const fol = ig.followers != null ? num(ig.followers) : '';
    if (er != null) {
      if (er < 1) out.push({ status: 'melhorar', titulo: t('Engajamento baixo no Instagram', 'Low Instagram engagement', 'Interacción baja en Instagram'),
        frase: t(`${pct(er)}% de engajamento nos últimos posts, com ${fol} seguidores. A média do mercado fica entre 1% e 3%.`, `${pct(er)}% engagement on recent posts, with ${fol} followers. The typical range is 1% to 3%.`, `${pct(er)}% de interacción en las últimas publicaciones, con ${fol} seguidores. El promedio está entre 1% y 3%.`) });
      else out.push({ status: 'forte', titulo: er >= 3 ? t('Engajamento acima da média', 'Above-average engagement', 'Interacción por encima del promedio') : t('Engajamento na média', 'Healthy engagement', 'Interacción en el promedio'),
        frase: t(`${pct(er)}% de engajamento nos últimos posts, com ${fol} seguidores. A média do mercado fica entre 1% e 3%.`, `${pct(er)}% engagement on recent posts, with ${fol} followers. The typical range is 1% to 3%.`, `${pct(er)}% de interacción en las últimas publicaciones, con ${fol} seguidores. El promedio está entre 1% y 3%.`) });
    }
    if ((ig.repeated ?? 0) >= 3) out.push({ status: 'melhorar', titulo: t('Legendas repetidas', 'Repeated captions', 'Textos repetidos'),
      frase: t(`${ig.repeated} dos últimos posts repetem a mesma legenda. O algoritmo entrega menos conteúdo repetido.`, `${ig.repeated} of the latest posts repeat the same caption. The algorithm shows repeated content less.`, `${ig.repeated} de las últimas publicaciones repiten el mismo texto. El algoritmo muestra menos el contenido repetido.`) });
    const last = ig.last_posts.map(p => (p.date ? new Date(p.date).getTime() : 0)).filter(Boolean).sort((a, b) => b - a)[0];
    if (last) {
      const days = Math.floor((Date.now() - last) / 86400000);
      if (days > 30) out.push({ status: 'melhorar', titulo: t('Instagram parado', 'Instagram has gone quiet', 'Instagram detenido'),
        frase: t(`O último post foi há ${days} dias. Quem vê o anúncio e abre o perfil encontra uma conta parada.`, `The last post was ${days} days ago. People who see an ad and open the profile find an inactive account.`, `La última publicación fue hace ${days} días. Quien ve el anuncio y abre el perfil encuentra una cuenta detenida.`) });
    }
  }

  const site = x.site;
  if (site) {
    const ct = site.contact;
    if (ct && ct.phone === 0 && ct.whatsapp === 0) out.push({ status: 'melhorar', titulo: t('Sem botão de ligar ou de WhatsApp', 'No tap-to-call or WhatsApp button', 'Sin botón para llamar o de WhatsApp'),
      frase: t('No celular, o visitante precisa copiar o número para falar com vocês. Cada passo a mais perde contato.', 'On a phone, visitors have to copy the number to reach you. Every extra step loses leads.', 'En el celular, el visitante tiene que copiar el número para hablar con ustedes. Cada paso extra pierde contactos.') });
    const comp = site.kinds.comparacao ?? 0; const price = site.kinds.preco ?? 0;
    if (comp + price > 0) out.push({ status: 'forte', titulo: t('Conteúdo que ajuda a vender', 'Content that helps sell', 'Contenido que ayuda a vender'),
      frase: t(`${comp} páginas de comparação e ${price} de preço. É o destino certo para anúncios de quem já está decidindo.`, `${comp} comparison pages and ${price} pricing pages. The right destination for ads aimed at people who are deciding.`, `${comp} páginas de comparación y ${price} de precios. El destino correcto para anuncios de quien ya está decidiendo.`) });
    if (!site.has_meta_description) out.push({ status: 'melhorar', titulo: t('Sem descrição para o Google', 'No description for Google', 'Sin descripción para Google'),
      frase: t('A página principal não tem a descrição que aparece no resultado da busca. O Google escolhe um trecho qualquer.', "The home page has no description for search results, so Google picks a random snippet.", 'La página principal no tiene la descripción que aparece en la búsqueda. Google elige un fragmento cualquiera.') });
  }

  const order: Record<St, number> = { critico: 0, melhorar: 1, forte: 2 };
  return out.sort((a, b) => order[a.status] - order[b.status]);
}

export const XrayPublicPage: React.FC<{ token: string }> = ({ token }) => {
  const [data, setData] = useState<PageData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');

  useEffect(() => {
    callFunction<PageData>('xray-page', { token }).then(({ data: d, error }) => {
      if (error || !d) setState('notfound'); else { setData(d); setState('ok'); }
    });
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Sans:wght@400;600&family=JetBrains+Mono:wght@500;700&display=swap';
    document.head.appendChild(link);
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { link.remove(); meta.remove(); };
  }, [token]);

  const lang: Lang = data?.client.lang || 'pt';
  const t: T = (pt, en, es) => (lang === 'en' ? en : lang === 'es' ? es : pt);
  const joey = (data?.client.agency_id ?? 0) === 7;
  const productName = joey ? 'Growth X-Ray' : t('Raio-X', 'X-Ray', 'Radiografía');

  useEffect(() => { if (data) document.title = `${productName} · ${data.client.name}`; }, [data, productName]);

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
          <div className="h-4 w-40 bg-[var(--line)]" /><div className="h-12 w-3/4 bg-[var(--line)]" />
          <div className="grid sm:grid-cols-4 gap-3"><div className="h-28 bg-[var(--line)]" /><div className="h-28 bg-[var(--line)]" /><div className="h-28 bg-[var(--line)]" /><div className="h-28 bg-[var(--line)]" /></div>
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

  const { client, agency, xray: x } = data;
  const findings = xrayFindings(x, t, lang);
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es' : 'pt-BR';
  const when = x.collected_at ? new Date(x.collected_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const num = (v: number) => v.toLocaleString(locale);
  const pct = (v: number) => String(v).replace('.', lang === 'en' ? '.' : ',');
  const statusColor = (s: St) => (s === 'critico' ? 'var(--bad)' : s === 'forte' ? 'var(--ok)' : 'var(--warn)');
  const LABEL: Record<St, string> = { critico: t('Arrumar primeiro', 'Fix first', 'Arreglar primero'), melhorar: t('Melhorar', 'Improve', 'Mejorar'), forte: t('Ponto forte', 'Strength', 'Punto fuerte') };
  const counts = { critico: findings.filter(f => f.status === 'critico').length, melhorar: findings.filter(f => f.status === 'melhorar').length, forte: findings.filter(f => f.status === 'forte').length };
  const sp = x.speed; const ig = x.instagram; const tr = x.tracking; const site = x.site;
  const spStatus: St | null = sp?.performance_mobile == null ? null : sp.performance_mobile < 50 ? 'critico' : sp.performance_mobile < 90 ? 'melhorar' : 'forte';
  const igStatus: St | null = ig?.engagement_rate_pct == null ? null : ig.engagement_rate_pct < 1 ? 'melhorar' : 'forte';
  const trIssues = tr ? [tr.gtm > 1, tr.meta > 1, tr.ga4 > 1, tr.meta === 0, tr.ads === 0, tr.ga4 === 0].filter(Boolean).length : 0;
  const waDigits = (agency?.contact_whatsapp || '').replace(/\D/g, '');
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(t(`Olá! Aqui é da ${client.name}, sobre o Raio-X.`, `Hi! This is ${client.name}, about the X-Ray.`, `¡Hola! Te escribe ${client.name}, sobre la radiografía.`))}` : null;
  const host = (() => { try { return x.website ? new URL(x.website).host.replace(/^www\./, '') : ''; } catch { return ''; } })();

  const tagRow = (label: string, count: number, needed: boolean) => {
    const st: St = count > 1 ? 'critico' : count === 1 ? 'forte' : needed ? 'critico' : 'melhorar';
    const txt = count > 1 ? t(`${count} instalados (em dobro)`, `${count} installed (duplicate)`, `${count} instalados (duplicado)`)
      : count === 1 ? t('Instalado', 'Installed', 'Instalado') : t('Não encontrado', 'Not found', 'No encontrado');
    return (
      <div key={label} className="xr-row">
        <span>{label}</span>
        <span className="stp-status" style={{ color: statusColor(st) }}><span className="stp-dot" />{txt}</span>
      </div>
    );
  };

  const KIND: Record<string, string> = {
    produto_ou_servico: t('Produtos e serviços', 'Products and services', 'Productos y servicios'),
    comparacao: t('Comparações', 'Comparisons', 'Comparaciones'), preco: t('Preços', 'Pricing', 'Precios'),
    blog: 'Blog', landing: t('Páginas de campanha', 'Landing pages', 'Páginas de campaña'),
    agendamento: t('Agendamento', 'Booking', 'Agenda'), contato: t('Contato', 'Contact', 'Contacto'),
  };
  const posts = (ig?.last_posts || []).filter(p => p.date).slice().reverse();
  const maxI = Math.max(1, ...posts.map(p => p.interactions));

  return (
    <div style={css} className="stp min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <style>{STP_CSS + XR_CSS}</style>
      <main className="stp-wrap" style={{ paddingBottom: 72 }}>
        <div className="stp-top">
          {joey
            ? <img src="/marca/joey/joey-growth-horizontal-laranja-claro.svg" alt="Joey Growth" className="h-7 w-auto max-w-[180px] object-contain" />
            : agency?.logo_url ? <img src={agency.logo_url} alt={agency.name} className="h-8 w-auto max-w-[160px] object-contain" /> : <b className="stp-brand">{agency?.name}</b>}
          <span>{productName}{when ? ` · ${when}` : ''}</span>
        </div>

        <span className="stp-pill">{t(`Para ${client.name}`, `For ${client.name}`, `Para ${client.name}`)}</span>
        <h1 className="stp-h1">{t('Onde a ', 'Where ', 'Dónde está ')}<em>{client.name}</em>{t(' está hoje', ' stands today', ' hoy')}</h1>
        <p className="stp-lead">{t(
          `Medimos de fora, sem acesso às contas: a velocidade do site${host ? ` (${host})` : ''}, o que está instalado para medir os anúncios e a saúde do Instagram. É o ponto de partida de qualquer campanha.`,
          `We measured from the outside, without access to any account: website speed${host ? ` (${host})` : ''}, what is installed to measure ads, and Instagram health. It's the starting point for any campaign.`,
          `Medimos desde afuera, sin acceso a las cuentas: la velocidad del sitio${host ? ` (${host})` : ''}, lo que está instalado para medir los anuncios y la salud de Instagram. Es el punto de partida de cualquier campaña.`)}</p>

        <div className="stp-grid stp-g4" style={{ marginTop: 36 }}>
          <div className="stp-cell">
            <div className="stp-k">{t('Velocidade no celular', 'Mobile speed', 'Velocidad en celular')}</div>
            {sp?.performance_mobile != null ? (
              <div className="stp-gauge">
                <svg width="76" height="76" viewBox="0 0 36 36" role="img" aria-label={`${sp.performance_mobile}/100`}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--line)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={statusColor(spStatus!)} strokeWidth="3" pathLength={100} strokeDasharray={`${sp.performance_mobile} 100`} transform="rotate(-90 18 18)" />
                  <text x="18" y="21.5" textAnchor="middle" fontFamily="var(--fd)" fontWeight="800" fontSize="10" fill="var(--ink)">{sp.performance_mobile}</text>
                </svg>
                <p>{t('de 100', 'out of 100', 'de 100')}{sp.lcp_s != null ? <><br />{t(`aparece em ${pct(sp.lcp_s)} s`, `loads in ${pct(sp.lcp_s)} s`, `aparece en ${pct(sp.lcp_s)} s`)}</> : null}</p>
              </div>
            ) : <p>{t('Não medido', 'Not measured', 'No medido')}</p>}
          </div>
          <div className="stp-cell">
            <div className="stp-k">{t('Rastreamento', 'Tracking', 'Seguimiento')}</div>
            {tr ? <>
              <div className="stp-big" style={{ color: trIssues ? 'var(--bad)' : 'var(--ok)' }}>{trIssues || '✓'}</div>
              <div className="stp-s">{trIssues ? t(trIssues === 1 ? 'ponto para corrigir' : 'pontos para corrigir', trIssues === 1 ? 'issue to fix' : 'issues to fix', trIssues === 1 ? 'punto para corregir' : 'puntos para corregir') : t('tudo instalado', 'all set', 'todo instalado')}</div>
            </> : <p>{t('Não lido', 'Not read', 'No leído')}</p>}
          </div>
          <div className="stp-cell">
            <div className="stp-k">Instagram</div>
            {ig ? <>
              <div className="stp-big" style={{ color: igStatus ? statusColor(igStatus) : undefined }}>{ig.engagement_rate_pct != null ? `${pct(ig.engagement_rate_pct)}%` : '–'}</div>
              <div className="stp-s">{t('de engajamento', 'engagement', 'de interacción')}{ig.followers != null ? ` · ${num(ig.followers)} ${t('seguidores', 'followers', 'seguidores')}` : ''}</div>
            </> : <p>{t('Não lido', 'Not read', 'No leído')}</p>}
          </div>
          <div className="stp-cell">
            <div className="stp-k">{t('Site', 'Website', 'Sitio')}</div>
            {site ? <>
              <div className="stp-big">{site.pages ? num(site.pages) : '–'}</div>
              <div className="stp-s">{t('páginas publicadas', 'published pages', 'páginas publicadas')}</div>
            </> : <p>{t('Não lido', 'Not read', 'No leído')}</p>}
          </div>
        </div>

        {!!findings.length && (
          <section>
            <div className="stp-eyebrow">{t('O diagnóstico', 'The diagnosis', 'El diagnóstico')}</div>
            <h2 className="stp-h2">{t('O que encontramos', 'What we found', 'Lo que encontramos')}</h2>
            <p className="stp-intro">
              {[counts.critico && `${counts.critico} ${t('para arrumar primeiro', 'to fix first', 'para arreglar primero')}`, counts.melhorar && `${counts.melhorar} ${t('para melhorar', 'to improve', 'para mejorar')}`, counts.forte && `${counts.forte} ${t(counts.forte === 1 ? 'ponto forte' : 'pontos fortes', counts.forte === 1 ? 'strength' : 'strengths', counts.forte === 1 ? 'punto fuerte' : 'puntos fuertes')}`].filter(Boolean).join(' · ')}.
            </p>
            <div className="stp-grid stp-g2">
              {findings.map((f, i) => (
                <div key={i} className="stp-cell">
                  <span className="stp-status" style={{ color: statusColor(f.status) }}><span className="stp-dot" />{LABEL[f.status]}</span>
                  <h3 className="stp-h3">{f.titulo}</h3>
                  <p>{f.frase}</p>
                </div>
              ))}
              {findings.length % 2 === 1 && <div className="stp-cell xr-empty" aria-hidden="true" />}
            </div>
          </section>
        )}

        {tr && (
          <section>
            <div className="stp-eyebrow">{t('Medição', 'Measurement', 'Medición')}</div>
            <h2 className="stp-h2">{t('O que está instalado no site', 'What is installed on the site', 'Lo que está instalado en el sitio')}</h2>
            <p className="stp-intro">{t('São essas ferramentas que contam quem chegou pelo anúncio e quem virou contato. Sem elas, ou em dobro, o investimento fica no escuro.', "These tools count who came from an ad and who became a lead. Missing or duplicated, the ad budget runs blind.", 'Estas herramientas cuentan quién llegó por el anuncio y quién se volvió contacto. Sin ellas, o duplicadas, la inversión va a ciegas.')}</p>
            <div className="xr-table">
              {tagRow(t('Pixel do Meta (Instagram e Facebook)', 'Meta pixel (Instagram and Facebook)', 'Píxel de Meta (Instagram y Facebook)'), tr.meta, true)}
              {tagRow(t('Tag do Google Ads', 'Google Ads tag', 'Etiqueta de Google Ads'), tr.ads, true)}
              {tagRow('Google Analytics 4', tr.ga4, true)}
              {tagRow('Google Tag Manager', tr.gtm, false)}
              {tr.tiktok > 0 && tagRow(t('Pixel do TikTok', 'TikTok pixel', 'Píxel de TikTok'), tr.tiktok, false)}
              {tr.linkedin > 0 && tagRow('LinkedIn Insight', tr.linkedin, false)}
              <div className="xr-row">
                <span>{t('Rastreamento pelo servidor', 'Server-side tracking', 'Seguimiento desde el servidor')}</span>
                <span className="stp-status" style={{ color: tr.server_side ? 'var(--ok)' : 'var(--muted)' }}><span className="stp-dot" />{tr.server_side ? t('Ativo', 'Active', 'Activo') : t('Não usa', 'Not used', 'No usa')}</span>
              </div>
            </div>
          </section>
        )}

        {ig && (
          <section>
            <div className="stp-eyebrow">Instagram</div>
            <h2 className="stp-h2">{ig.username ? `@${ig.username}` : 'Instagram'}</h2>
            <div className="stp-grid stp-g3" style={{ marginTop: 18 }}>
              <div className="stp-cell"><div className="stp-k">{t('Seguidores', 'Followers', 'Seguidores')}</div><div className="stp-big">{ig.followers != null ? num(ig.followers) : '–'}</div></div>
              <div className="stp-cell"><div className="stp-k">{t('Posts publicados', 'Posts published', 'Publicaciones')}</div><div className="stp-big">{ig.posts_total != null ? num(ig.posts_total) : '–'}</div></div>
              <div className="stp-cell"><div className="stp-k">{t('Interações por post', 'Interactions per post', 'Interacciones por publicación')}</div><div className="stp-big">{ig.avg_interactions != null ? num(ig.avg_interactions) : '–'}</div><div className="stp-s">{t('média dos últimos posts', 'average of recent posts', 'promedio de las últimas')}</div></div>
            </div>
            {posts.length > 2 && (
              <div className="xr-posts" role="img" aria-label={t('Interações dos últimos posts', 'Interactions on recent posts', 'Interacciones de las últimas publicaciones')}>
                {posts.map((p, i) => (
                  <div key={i} className="xr-post">
                    <i style={{ height: `${Math.max(3, (p.interactions / maxI) * 100)}%` }} title={`${num(p.interactions)}`} />
                    <small>{new Date(p.date!).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}</small>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {site && (site.pages > 0 || site.contact) && (
          <section>
            <div className="stp-eyebrow">{t('Site', 'Website', 'Sitio')}</div>
            <h2 className="stp-h2">{t('O que o site oferece hoje', 'What the website offers today', 'Lo que el sitio ofrece hoy')}</h2>
            {site.pages > 0 && (
              <div className="stp-chips" style={{ marginTop: 18 }}>
                {Object.entries(site.kinds).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <span key={k}><b style={{ color: 'var(--ink)' }}>{num(v)}</b> · {KIND[k] || k}</span>
                ))}
              </div>
            )}
            {site.contact && (
              <div className="xr-table" style={{ marginTop: 18 }}>
                {[
                  [t('Formulário de contato', 'Contact form', 'Formulario de contacto'), site.contact.forms],
                  [t('Botão de ligar', 'Tap-to-call button', 'Botón para llamar'), site.contact.phone],
                  ['WhatsApp', site.contact.whatsapp],
                  [t('Agendamento online', 'Online booking', 'Agenda en línea'), site.contact.scheduling],
                ].map(([l, v]) => (
                  <div key={l as string} className="xr-row">
                    <span>{l}</span>
                    <span className="stp-status" style={{ color: (v as number) > 0 ? 'var(--ok)' : 'var(--muted)' }}><span className="stp-dot" />{(v as number) > 0 ? t('Na página principal', 'On the home page', 'En la página principal') : t('Não encontrado', 'Not found', 'No encontrado')}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <div className="stp-answer">
            <div className="stp-eyebrow">{t('Próximo passo', 'Next step', 'Próximo paso')}</div>
            <h2 className="stp-h2" style={{ margin: 0 }}>{t('Daqui sai a estratégia de anúncios', 'This is where the ad strategy starts', 'De aquí sale la estrategia de anuncios')}</h2>
            <p className="stp-intro">{t(
              'Primeiro arrumamos o que afeta a medição, porque sem ela o anúncio não aprende. Depois vêm as campanhas, com o orçamento e os públicos certos para o seu negócio.',
              "First we fix what affects measurement, because without it the ads can't learn. Then come the campaigns, with the right budget and audiences for your business.",
              'Primero arreglamos lo que afecta la medición, porque sin ella el anuncio no aprende. Después vienen las campañas, con el presupuesto y los públicos correctos para su negocio.')}</p>
            {waHref && <div className="stp-btns" style={{ justifyContent: 'flex-start' }}><a className="stp-btn" href={waHref} target="_blank" rel="noreferrer">{t('Falar com a equipe', 'Talk to the team', 'Hablar con el equipo')}</a></div>}
          </div>
        </section>

        <p className="stp-foot">{t(
          'Medido de fora, sem acesso às contas. Ferramentas que só carregam depois do aceite de cookies podem não aparecer.',
          'Measured from the outside, without account access. Tools that only load after cookie consent may not show up.',
          'Medido desde afuera, sin acceso a las cuentas. Herramientas que solo cargan después de aceptar cookies pueden no aparecer.')}<br />{agency?.name}</p>
      </main>
    </div>
  );
};

const XR_CSS = `
.xr-table{border:1px solid var(--line);background:var(--paper);border-radius:var(--radius);overflow:hidden}
.xr-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 22px;border-bottom:1px solid var(--line);font-size:15px;color:var(--sub)}
.xr-row:last-child{border-bottom:0}
.xr-row .stp-status{white-space:nowrap}
.xr-empty{background:var(--paper)}
.xr-posts{display:flex;align-items:flex-end;gap:6px;height:160px;margin-top:1px;padding:18px 22px 12px;background:var(--paper);border:1px solid var(--line);border-top:0;border-radius:0 0 var(--radius) var(--radius)}
.xr-post{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:6px;min-width:0}
.xr-post i{display:block;width:100%;max-width:34px;background:var(--brand);opacity:.85}
.xr-post small{font:500 10px var(--fm);color:var(--muted);white-space:nowrap}
@media (max-width:560px){.xr-row{flex-direction:column;align-items:flex-start;gap:6px;padding:14px 16px}.xr-post small{display:none}.xr-empty{display:none}}
`;

export default XrayPublicPage;

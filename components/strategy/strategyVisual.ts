import type { StrategyContent } from './StrategyView';

/**
 * Camada visual da estratégia (página do cliente): textos curtos, números e status.
 * O robô escreve `content.visual`. Estratégias antigas não têm: aqui montamos o mesmo formato
 * a partir dos campos completos e do Raio-X, para toda estratégia abrir no visual novo.
 * O texto completo continua nos "Ver detalhes".
 */

export type XStatus = 'critico' | 'melhorar' | 'forte';
export type XTema = 'rastreamento' | 'velocidade' | 'instagram' | 'site' | 'anuncios' | 'outro';

export interface StrategyVisual {
  titulo?: string;
  titulo_destaque?: string;
  subtitulo?: string;
  numeros?: { rotulo: string; valor: string; nota?: string }[];
  raio_x?: { tema: XTema; status: XStatus; titulo: string; frase: string; detalhe?: string }[];
  funil?: { titulo: string; frase: string; selo?: string; destaque?: boolean }[];
  publicos?: { icone?: string; titulo: string; frase: string; selo?: string }[];
  verba?: { nome: string; valor: string; frase?: string; percentual: number }[];
  verba_alternativas?: { se: string; entao: string }[];
  cronograma?: { quando: string; titulo: string; frase: string }[];
  precisamos?: { item: string; trava?: boolean }[];
  perguntas?: { titulo: string; frase: string }[];
}

/** Resumo do Raio-X que a página pública recebe (sem dados brutos). */
export interface XraySummary {
  collected_at: string | null;
  speed: { performance_mobile: number | null; lcp_s: number | null; total_kb: number | null } | null;
  instagram: { username: string | null; followers: number | null; engagement_rate_pct: number | null; repeated: number | null } | null;
  tracking: { gtm: number; meta: number; ga4: number; ads: number; server_side: boolean; alerts: string[] } | null;
  site: { comparacoes: number; precos: number; paginas: number } | null;
}

type T = (pt: string, en: string, es: string) => string;

const s = (v: unknown, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = <X,>(v: unknown): X[] => (Array.isArray(v) ? (v.filter(Boolean) as X[]) : []);
const firstSentence = (txt: string, max = 170) => {
  const t = (txt || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = t.match(/^(.{20,}?[.!?])(\s|$)/);
  const out = m ? m[1] : t;
  return out.length > max ? out.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : out;
};
const STATUS: XStatus[] = ['critico', 'melhorar', 'forte'];
const TEMAS: XTema[] = ['rastreamento', 'velocidade', 'instagram', 'site', 'anuncios', 'outro'];

/** Limpa o que veio do robô (nunca confia no formato). */
function clean(v: any): StrategyVisual {
  if (!v || typeof v !== 'object') return {};
  return {
    titulo: s(v.titulo, 120) || undefined,
    titulo_destaque: s(v.titulo_destaque, 120) || undefined,
    subtitulo: s(v.subtitulo, 400) || undefined,
    numeros: list<any>(v.numeros).slice(0, 4).map(n => ({ rotulo: s(n.rotulo, 40), valor: s(n.valor, 30), nota: s(n.nota, 90) })).filter(n => n.rotulo && n.valor),
    raio_x: list<any>(v.raio_x).slice(0, 6).map(x => ({
      tema: (TEMAS.includes(x.tema) ? x.tema : 'outro') as XTema,
      status: (STATUS.includes(x.status) ? x.status : 'melhorar') as XStatus,
      titulo: s(x.titulo, 60), frase: s(x.frase, 220), detalhe: s(x.detalhe, 900) || undefined,
    })).filter(x => x.titulo),
    funil: list<any>(v.funil).slice(0, 6).map(f => ({ titulo: s(f.titulo, 60), frase: s(f.frase, 220), selo: s(f.selo, 24) || undefined, destaque: !!f.destaque })).filter(f => f.titulo),
    publicos: list<any>(v.publicos).slice(0, 6).map(p => ({ icone: s(p.icone, 4) || undefined, titulo: s(p.titulo, 60), frase: s(p.frase, 220), selo: s(p.selo, 60) || undefined })).filter(p => p.titulo),
    verba: list<any>(v.verba).slice(0, 5).map(b => ({ nome: s(b.nome, 40), valor: s(b.valor, 24), frase: s(b.frase, 90) || undefined, percentual: Math.max(0, Math.min(100, Number(b.percentual) || 0)) })).filter(b => b.nome),
    verba_alternativas: list<any>(v.verba_alternativas).slice(0, 3).map(a => ({ se: s(a.se, 40), entao: s(a.entao, 90) })).filter(a => a.se && a.entao),
    cronograma: list<any>(v.cronograma).slice(0, 6).map(c => ({ quando: s(c.quando, 30), titulo: s(c.titulo, 40), frase: s(c.frase, 140) })).filter(c => c.titulo),
    precisamos: list<any>(v.precisamos).slice(0, 10).map(p => (typeof p === 'string' ? { item: s(p, 160) } : { item: s(p.item, 160), trava: !!p.trava })).filter(p => p.item),
    perguntas: list<any>(v.perguntas).slice(0, 4).map(q => ({ titulo: s(q.titulo, 80), frase: s(q.frase, 200) })).filter(q => q.titulo),
  };
}

/** Raio-X montado só com o que foi medido (quando o robô não escreveu o dele). */
function xrayCards(x: XraySummary | null, t: T): NonNullable<StrategyVisual['raio_x']> {
  if (!x) return [];
  const out: NonNullable<StrategyVisual['raio_x']> = [];
  if (x.tracking) {
    const dup = [x.tracking.gtm > 1, x.tracking.meta > 1, x.tracking.ga4 > 1].filter(Boolean).length;
    const missing = !x.tracking.meta || !x.tracking.ga4;
    out.push({
      tema: 'rastreamento',
      status: dup || missing ? 'critico' : 'forte',
      titulo: dup ? t('Rastreamento em dobro', 'Tracking installed twice', 'Medición duplicada') : missing ? t('Rastreamento incompleto', 'Tracking is incomplete', 'Medición incompleta') : t('Rastreamento instalado', 'Tracking in place', 'Medición instalada'),
      frase: t(
        `${x.tracking.gtm} Tag Manager${x.tracking.gtm === 1 ? '' : 's'}, ${x.tracking.meta} ${x.tracking.meta === 1 ? 'pixel' : 'pixels'} do Meta e ${x.tracking.ga4} Google Analytics.`,
        `${x.tracking.gtm} Tag Manager${x.tracking.gtm === 1 ? '' : 's'}, ${x.tracking.meta} Meta pixel${x.tracking.meta === 1 ? '' : 's'} and ${x.tracking.ga4} Google Analytics.`,
        `${x.tracking.gtm} Tag Manager, ${x.tracking.meta} ${x.tracking.meta === 1 ? 'píxel' : 'píxeles'} de Meta y ${x.tracking.ga4} Google Analytics.`),
      detalhe: x.tracking.alerts.join(' ') || undefined,
    });
  }
  if (x.speed?.performance_mobile != null) {
    const n = x.speed.performance_mobile;
    out.push({
      tema: 'velocidade', status: n >= 90 ? 'forte' : n >= 50 ? 'melhorar' : 'critico',
      titulo: t('Velocidade no celular', 'Mobile speed', 'Velocidad en el celular'),
      frase: t(`A página demora ${String(x.speed.lcp_s ?? '?').replace('.', ',')} s para aparecer.`, `The page takes ${x.speed.lcp_s ?? '?'} s to show up.`, `La página tarda ${String(x.speed.lcp_s ?? '?').replace('.', ',')} s en aparecer.`),
    });
  }
  if (x.instagram?.engagement_rate_pct != null) {
    const er = x.instagram.engagement_rate_pct;
    out.push({
      tema: 'instagram', status: er >= 1 ? 'forte' : 'melhorar',
      titulo: `Instagram${x.instagram.username ? ' @' + x.instagram.username : ''}`,
      frase: t(`${String(er).replace('.', ',')}% de engajamento com ${(x.instagram.followers ?? 0).toLocaleString('pt-BR')} seguidores.`, `${er}% engagement with ${(x.instagram.followers ?? 0).toLocaleString('en-US')} followers.`, `${String(er).replace('.', ',')}% de interacción con ${(x.instagram.followers ?? 0).toLocaleString('es')} seguidores.`),
    });
  }
  if (x.site && x.site.paginas) {
    const rich = x.site.comparacoes + x.site.precos;
    out.push({
      tema: 'site', status: rich ? 'forte' : 'melhorar',
      titulo: t('Site e SEO', 'Website and SEO', 'Sitio y SEO'),
      frase: rich
        ? t(`${x.site.paginas} páginas no Google, com ${x.site.precos} de preço e ${x.site.comparacoes} de comparação.`, `${x.site.paginas} pages on Google, ${x.site.precos} with prices and ${x.site.comparacoes} comparisons.`, `${x.site.paginas} páginas en Google, ${x.site.precos} de precios y ${x.site.comparacoes} comparaciones.`)
        : t(`${x.site.paginas} páginas no Google.`, `${x.site.paginas} pages on Google.`, `${x.site.paginas} páginas en Google.`),
    });
  }
  return out;
}

/** Junta o que o robô escreveu com o que dá para montar dos campos completos. */
export function buildVisual(c: StrategyContent & { visual?: unknown }, x: XraySummary | null, t: T, clientName: string): Required<Pick<StrategyVisual, 'numeros' | 'raio_x' | 'funil' | 'publicos' | 'verba' | 'cronograma' | 'precisamos'>> & StrategyVisual {
  const v = clean((c as any).visual);
  const campanhas = c.campanhas ?? [];
  const totalPct = campanhas.reduce((a, k) => a + (Number(k.percentual_verba) || 0), 0) || 100;

  const numeros = v.numeros?.length ? v.numeros : [
    c.investimento?.mensal_sugerido ? { rotulo: t('Verba de mídia', 'Ad spend', 'Inversión en anuncios'), valor: c.investimento.mensal_sugerido.split(':')[0].trim(), nota: campanhas.length ? t(`Em ${campanhas.length} campanhas`, `Across ${campanhas.length} campaigns`, `En ${campanhas.length} campañas`) : undefined } : null,
    campanhas.length ? { rotulo: t('Campanhas', 'Campaigns', 'Campañas'), valor: String(campanhas.length), nota: [...new Set(campanhas.map(k => k.plataforma))].join(' + ') } : null,
    c.cronograma?.[0] ? { rotulo: t('Começa', 'Starts', 'Empieza'), valor: c.cronograma[0].prazo.replace(/\s*\(.*\)\s*$/, ''), nota: c.cronograma[0].fase.split(':')[0] } : null,
  ].filter(Boolean) as StrategyVisual['numeros'] & object;

  const raio_x = v.raio_x?.length ? v.raio_x : xrayCards(x, t);

  const funil = v.funil?.length ? v.funil : campanhas.map(k => ({
    titulo: k.nome.replace(/^(Google|Meta)\s*[|·-]\s*/i, '').replace(/\s*\|\s*/g, ' · '), frase: firstSentence(k.objetivo),
    selo: `${Math.round(((Number(k.percentual_verba) || 0) / totalPct) * 100)}% ${t('da verba', 'of budget', 'del presupuesto')}`, destaque: true,
  }));

  const publicos = v.publicos?.length ? v.publicos : (c.publicos ?? []).map(p => ({ titulo: p.nome.replace(/^\d+\.\s*/, ''), frase: firstSentence(p.descricao) }));

  const verba = v.verba?.length ? v.verba : campanhas.map(k => ({
    nome: k.nome.replace(/\s*[|·]\s*/g, ' · '), valor: '', percentual: Math.round(((Number(k.percentual_verba) || 0) / totalPct) * 100),
  }));

  const cronograma = v.cronograma?.length ? v.cronograma : (c.cronograma ?? []).map(f => ({ quando: f.prazo.replace(/\s*\(.*\)$/, ''), titulo: f.fase.split(':')[0], frase: firstSentence(f.entregas, 120) }));

  const precisamos = v.precisamos?.length ? v.precisamos : (c.precisamos_do_cliente ?? []).map(item => ({ item: firstSentence(item, 160) }));

  return {
    ...v,
    titulo: v.titulo || t(`O plano para trazer mais clientes para a ${clientName}`, `The plan to bring more customers to ${clientName}`, `El plan para traer más clientes a ${clientName}`),
    subtitulo: v.subtitulo || c.resumo,
    numeros, raio_x, funil, publicos, verba, cronograma, precisamos,
  };
}

/** Resumo do Raio-X a partir de client_audits.data (usado na prévia da equipe; a função pública faz o mesmo). */
export function summarizeXray(d: any): XraySummary | null {
  if (!d || typeof d !== 'object') return null;
  const tr = d.site?.tracking;
  const kinds = d.site?.pages?.by_kind_counts ?? {};
  return {
    collected_at: d.collected_at ?? null,
    speed: d.speed?.ok ? { performance_mobile: d.speed.performance_mobile ?? null, lcp_s: d.speed.lcp_s ?? null, total_kb: d.speed.total_kb ?? null } : null,
    instagram: d.instagram?.ok ? { username: d.instagram.username ?? null, followers: d.instagram.followers ?? null, engagement_rate_pct: d.instagram.engagement_rate_pct ?? null, repeated: d.instagram.repeated_captions_last_12 ?? null } : null,
    tracking: tr ? { gtm: (tr.gtm_containers ?? []).length, meta: (tr.meta_pixels ?? []).length, ga4: (tr.ga4_properties ?? []).length, ads: (tr.google_ads_tags ?? []).length, server_side: !!(tr.server_side_gtm ?? []).length, alerts: tr.alerts ?? [] } : null,
    site: d.site ? { comparacoes: kinds.comparacao ?? 0, precos: kinds.preco ?? 0, paginas: d.site.pages?.total_in_sitemap ?? 0 } : null,
  };
}

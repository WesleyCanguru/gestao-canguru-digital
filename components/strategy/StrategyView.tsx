import React from 'react';
import { Target, Users, Megaphone, Wallet, LineChart, CalendarClock, ClipboardList, HelpCircle } from 'lucide-react';

export interface StrategyContent {
  resumo?: string;
  objetivo_principal?: string;
  oferta?: string;
  publicos?: { nome: string; descricao: string; segmentacao: string }[];
  campanhas?: { plataforma: string; nome: string; objetivo: string; publico: string; criativos: string; percentual_verba: number }[];
  investimento?: { mensal_sugerido: string; justificativa: string };
  metricas?: { nome: string; meta: string }[];
  cronograma?: { fase: string; prazo: string; entregas: string }[];
  precisamos_do_cliente?: string[];
  pontos_em_aberto?: string[];
}

/** Garante que as listas da estratégia sejam listas (o modelo às vezes devolve texto quebrado). */
export function normalizeStrategy(raw: unknown): StrategyContent {
  const c: any = raw && typeof raw === 'object' ? { ...(raw as any) } : {};
  const asList = (v: unknown) => {
    if (Array.isArray(v)) return v.filter(x => x != null);
    if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
    return [];
  };
  for (const k of ['publicos', 'campanhas', 'metricas', 'cronograma', 'precisamos_do_cliente', 'pontos_em_aberto']) c[k] = asList(c[k]);
  if (c.investimento && typeof c.investimento !== 'object') c.investimento = undefined;
  for (const k of ['resumo', 'objetivo_principal', 'oferta']) if (typeof c[k] !== 'string') c[k] = undefined;
  return c as StrategyContent;
}

export interface StrategyRow {
  id: string;
  client_id: string;
  agency_id: number;
  version: number;
  status: 'draft' | 'sent' | 'approved' | 'changes';
  content: StrategyContent;
  created_at: string;
  sent_at: string | null;
  responded_at: string | null;
  client_feedback: string | null;
}

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section className="space-y-3">
    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
      <span className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">{icon}</span>
      {title}
    </h3>
    {children}
  </section>
);

/** Mostra a estratégia de forma legível. `internal` exibe os pontos em aberto (só equipe). */
const ES: Record<string, string> = {
  'Objetivo principal': 'Objetivo principal', 'Investimento em anúncios': 'Inversión en anuncios', 'Oferta': 'Oferta',
  'Públicos': 'Públicos', 'Campanhas': 'Campañas', 'da verba': 'del presupuesto', 'Objetivo: ': 'Objetivo: ',
  'Público: ': 'Público: ', 'Anúncios: ': 'Anuncios: ', 'Por que esse investimento': 'Por qué esta inversión',
  'Como vamos medir': 'Cómo vamos a medir', 'Cronograma': 'Cronograma', 'O que precisamos de você': 'Lo que necesitamos de ti',
};

export const StrategyView: React.FC<{ content: StrategyContent; internal?: boolean; english?: boolean; lang?: 'pt' | 'en' | 'es' }> = ({ content, internal, english, lang }) => {
  const c = normalizeStrategy(content);
  const l = lang ?? (english ? 'en' : 'pt');
  const t = (pt: string, en: string) => (l === 'en' ? en : l === 'es' ? (ES[pt] ?? pt) : pt);
  return (
    <div className="space-y-7 text-sm text-gray-700 leading-relaxed">
      {c.resumo && <p className="text-base text-gray-900">{c.resumo}</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        {c.objetivo_principal && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-1">{t('Objetivo principal', 'Main goal')}</p>
            <p className="font-semibold text-gray-900">{c.objetivo_principal}</p>
          </div>
        )}
        {c.investimento?.mensal_sugerido && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-1">{t('Investimento em anúncios', 'Ad spend')}</p>
            <p className="font-semibold text-gray-900">{c.investimento.mensal_sugerido}</p>
          </div>
        )}
      </div>

      {c.oferta && <Section icon={<Target size={15} />} title={t('Oferta', 'Offer')}><p>{c.oferta}</p></Section>}

      {!!c.publicos?.length && (
        <Section icon={<Users size={15} />} title={t('Públicos', 'Audiences')}>
          <div className="grid sm:grid-cols-2 gap-3">
            {c.publicos.map((p, i) => (
              <div key={i} className="p-4 rounded-2xl border border-gray-200">
                <p className="font-semibold text-gray-900">{p.nome}</p>
                <p className="mt-1">{p.descricao}</p>
                <p className="mt-2 text-xs text-gray-500">{p.segmentacao}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!!c.campanhas?.length && (
        <Section icon={<Megaphone size={15} />} title={t('Campanhas', 'Campaigns')}>
          <div className="space-y-3">
            {c.campanhas.map((k, i) => (
              <div key={i} className="p-4 rounded-2xl border border-gray-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${k.plataforma === 'Google' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{k.plataforma}</span>
                  <p className="font-semibold text-gray-900">{k.nome}</p>
                  {typeof k.percentual_verba === 'number' && <span className="ml-auto text-xs font-semibold text-gray-500">{Math.round(k.percentual_verba)}% {t('da verba', 'of budget')}</span>}
                </div>
                <dl className="mt-2 grid gap-1.5">
                  <div><dt className="inline font-semibold text-gray-800">{t('Objetivo: ', 'Goal: ')}</dt><dd className="inline">{k.objetivo}</dd></div>
                  <div><dt className="inline font-semibold text-gray-800">{t('Público: ', 'Audience: ')}</dt><dd className="inline">{k.publico}</dd></div>
                  <div><dt className="inline font-semibold text-gray-800">{t('Anúncios: ', 'Ads: ')}</dt><dd className="inline">{k.criativos}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </Section>
      )}

      {c.investimento?.justificativa && (
        <Section icon={<Wallet size={15} />} title={t('Por que esse investimento', 'Why this budget')}><p>{c.investimento.justificativa}</p></Section>
      )}

      {!!c.metricas?.length && (
        <Section icon={<LineChart size={15} />} title={t('Como vamos medir', 'How we measure')}>
          <ul className="grid sm:grid-cols-2 gap-2">
            {c.metricas.map((m, i) => (
              <li key={i} className="flex justify-between gap-3 p-3 rounded-xl bg-gray-50"><span>{m.nome}</span><span className="font-semibold text-gray-900 text-right">{m.meta}</span></li>
            ))}
          </ul>
        </Section>
      )}

      {!!c.cronograma?.length && (
        <Section icon={<CalendarClock size={15} />} title={t('Cronograma', 'Timeline')}>
          <ol className="space-y-2">
            {c.cronograma.map((f, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <div><p className="font-semibold text-gray-900">{f.fase} <span className="font-normal text-gray-500">· {f.prazo}</span></p><p>{f.entregas}</p></div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {!!c.precisamos_do_cliente?.length && (
        <Section icon={<ClipboardList size={15} />} title={t('O que precisamos de você', 'What we need from you')}>
          <ul className="list-disc pl-5 space-y-1">{c.precisamos_do_cliente.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Section>
      )}

      {internal && !!c.pontos_em_aberto?.length && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900 mb-2"><HelpCircle size={15} /> Pontos para confirmar (só a equipe vê)</p>
          <ul className="list-disc pl-5 space-y-1 text-amber-900">{c.pontos_em_aberto.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}
    </div>
  );
};

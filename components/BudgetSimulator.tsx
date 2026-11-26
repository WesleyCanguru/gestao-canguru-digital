import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Lang, tr } from '../lib/accessGuides';

/**
 * Simulação de investimento no cadastro (ideia do Sérgio, reunião de 25/11/2026).
 * O cliente vê, antes de escolher a verba, o que cada valor costuma comprar em média
 * e quantas vendas pagam o investimento. Médias de mercado, sem promessa de resultado.
 */

type Market = {
  symbol: string; locale: string; amounts: number[];
  cpc: [number, number];      // custo por clique no Google (pesquisa, serviços locais)
  cpm: [number, number];      // custo por mil impressões no Meta
  conv: [number, number];     // % de cliques no Google que viram contato
};

const MARKETS: Record<'USD' | 'BRL', Market> = {
  USD: { symbol: '$', locale: 'en-US', amounts: [500, 1500, 3000, 5000], cpc: [3, 8], cpm: [10, 20], conv: [0.05, 0.1] },
  BRL: { symbol: 'R$', locale: 'pt-BR', amounts: [1000, 3000, 6000, 10000], cpc: [1.5, 5], cpm: [15, 35], conv: [0.05, 0.1] },
};

const parseMoney = (s: string): number => {
  const digits = (s || '').replace(/[^\d.,]/g, '');
  if (!digits) return 0;
  // "1.500,00" (BR) ou "1,500.00" (US): o último separador com 2 dígitos depois é decimal
  const norm = /[.,]\d{2}$/.test(digits) ? digits.slice(0, -3).replace(/[.,]/g, '') + '.' + digits.slice(-2) : digits.replace(/[.,]/g, '');
  return Number(norm) || 0;
};

export const BudgetSimulator: React.FC<{ currency: 'USD' | 'BRL'; lang: Lang; ticket: string; brand: string }> = ({ currency, lang, ticket, brand }) => {
  const t = tr(lang);
  const m = MARKETS[currency];
  const [amount, setAmount] = useState(m.amounts[1]);
  const fmt = (n: number) => `${m.symbol}${Math.round(n).toLocaleString(m.locale)}`;
  const num = (n: number) => Math.round(n).toLocaleString(m.locale);

  const clicks: [number, number] = [amount / m.cpc[1], amount / m.cpc[0]];
  const leads: [number, number] = [clicks[0] * m.conv[0], clicks[1] * m.conv[1]];
  const people: [number, number] = [(amount / m.cpm[1]) * 1000 / 2, (amount / m.cpm[0]) * 1000 / 2];
  const ticketValue = parseMoney(ticket);
  const salesToPay = ticketValue > 0 ? Math.max(1, Math.ceil(amount / ticketValue)) : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Calculator size={15} className="text-gray-500" />
        <p className="text-sm font-bold text-gray-900">{t('Antes de escolher: o que cada valor costuma trazer', 'Before you choose: what each budget usually gets you', 'Antes de elegir: lo que suele traer cada valor')}</p>
      </div>
      <p className="text-xs text-gray-500 mb-3">{t('Toque num valor por mês para ver a simulação.', 'Tap a monthly amount to see the estimate.', 'Toca un valor mensual para ver la simulación.')}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {m.amounts.map(a => (
          <button key={a} type="button" onClick={() => setAmount(a)}
            className={`px-3.5 py-2 rounded-full border text-sm transition ${amount === a ? 'text-white border-transparent' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
            style={amount === a ? { backgroundColor: brand } : undefined}>
            {fmt(a)}{t('/mês', '/mo', '/mes')}
          </button>
        ))}
      </div>

      <dl className="grid sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <dt className="text-[11px] font-semibold text-gray-500">{t('Google: pessoas que clicam', 'Google: people who click', 'Google: personas que hacen clic')}</dt>
          <dd className="text-base font-bold text-gray-900">{num(clicks[0])} – {num(clicks[1])}</dd>
          <dd className="text-[11px] text-gray-500">{t(`Contatos: ${num(leads[0])} a ${num(leads[1])}`, `Leads: ${num(leads[0])} to ${num(leads[1])}`, `Contactos: ${num(leads[0])} a ${num(leads[1])}`)}</dd>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <dt className="text-[11px] font-semibold text-gray-500">{t('Meta: pessoas alcançadas', 'Meta: people reached', 'Meta: personas alcanzadas')}</dt>
          <dd className="text-base font-bold text-gray-900">{num(people[0])} – {num(people[1])}</dd>
          <dd className="text-[11px] text-gray-500">{t('Facebook e Instagram', 'Facebook and Instagram', 'Facebook e Instagram')}</dd>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <dt className="text-[11px] font-semibold text-gray-500">{t('Vendas que pagam o anúncio', 'Sales that pay for the ads', 'Ventas que pagan el anuncio')}</dt>
          <dd className="text-base font-bold text-gray-900">{salesToPay ? salesToPay : '—'}</dd>
          <dd className="text-[11px] text-gray-500">
            {salesToPay
              ? t(`Com ticket de ${fmt(ticketValue)}`, `With a ${fmt(ticketValue)} average sale`, `Con ticket de ${fmt(ticketValue)}`)
              : t('Preencha o ticket médio acima', 'Fill in the average sale value above', 'Completa el ticket promedio arriba')}
          </dd>
        </div>
      </dl>

      <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
        {t('Médias de mercado para negócios locais, só para referência. Não são promessa de resultado: o número real depende do seu nicho, da sua região, da concorrência e da sua oferta.',
          'Market averages for local businesses, for reference only. Not a promise of results: real numbers depend on your niche, area, competition and offer.',
          'Promedios de mercado para negocios locales, solo como referencia. No son una promesa de resultados: el número real depende de tu nicho, tu región, la competencia y tu oferta.')}
      </p>
    </div>
  );
};

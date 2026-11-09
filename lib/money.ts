// Moedas da Bolsa: real, dólar e euro. Cada valor fica na moeda em que foi cobrado;
// a conversão para a moeda base da agência só aparece nos totais.
export type CurrencyCode = 'BRL' | 'USD' | 'EUR';

export const CURRENCIES: { code: CurrencyCode; label: string; symbol: string; locale: string }[] = [
  { code: 'BRL', label: 'Real (R$)', symbol: 'R$', locale: 'pt-BR' },
  { code: 'USD', label: 'Dólar (US$)', symbol: 'US$', locale: 'en-US' },
  { code: 'EUR', label: 'Euro (€)', symbol: '€', locale: 'de-DE' },
];

export const asCurrency = (c?: string | null, fallback: CurrencyCode = 'BRL'): CurrencyCode =>
  c === 'USD' || c === 'EUR' || c === 'BRL' ? c : fallback;

export const formatMoney = (value: number | null | undefined, currency?: string | null, opts: { compact?: boolean } = {}) => {
  const cur = asCurrency(currency);
  const meta = CURRENCIES.find(c => c.code === cur)!;
  return new Intl.NumberFormat(meta.locale === 'de-DE' ? 'pt-BR' : meta.locale, {
    style: 'currency', currency: cur, maximumFractionDigits: opts.compact ? 0 : 2, minimumFractionDigits: opts.compact ? 0 : 2,
  }).format(Number(value) || 0);
};

/** Quanto vale 1 unidade de cada moeda na moeda base. Ex.: base BRL → { BRL: 1, USD: 5.4, EUR: 6.2 }. */
export type FxRates = Record<CurrencyCode, number>;

const cache: Record<string, { at: number; rates: FxRates }> = {};

export const fetchFxRates = async (base: CurrencyCode): Promise<FxRates | null> => {
  const hit = cache[base];
  if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.rates;
  const others = (['BRL', 'USD', 'EUR'] as CurrencyCode[]).filter(c => c !== base);
  const build = (perBase: Record<string, number>): FxRates | null => {
    // perBase[X] = quantas unidades de X valem 1 da base → 1 X = 1 / perBase[X] na base
    const rates = { [base]: 1 } as FxRates;
    for (const c of others) {
      const v = Number(perBase[c]);
      if (!v) return null;
      rates[c] = 1 / v;
    }
    return rates;
  };
  const sources = [
    async () => { const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${others.join(',')}`); const j = await r.json(); return build(j?.rates || {}); },
    async () => { const r = await fetch(`https://open.er-api.com/v6/latest/${base}`); const j = await r.json(); return build(j?.rates || {}); },
  ];
  for (const s of sources) {
    try { const rates = await s(); if (rates) { cache[base] = { at: Date.now(), rates }; return rates; } } catch { /* tenta a próxima */ }
  }
  return null;
};

/** Converte um valor para a moeda base. Sem cotação disponível, devolve null (o total mostra só as moedas separadas). */
export const toBase = (value: number, from: CurrencyCode, base: CurrencyCode, rates: FxRates | null): number | null => {
  if (from === base) return value;
  if (!rates || !rates[from]) return null;
  return value * rates[from];
};

export const RECEIVED_REASONS: { id: 'extra' | 'desconto' | 'juros' | 'parcial'; label: string; hint: string }[] = [
  { id: 'extra', label: 'Valor extra', hint: 'Serviço a mais, ajuste ou outra entrada' },
  { id: 'desconto', label: 'Desconto concedido', hint: 'O cliente pagou menos e está quitado' },
  { id: 'juros', label: 'Juros ou multa', hint: 'Pagou com atraso e veio a mais' },
  { id: 'parcial', label: 'Pagamento parcial', hint: 'O restante continua em aberto' },
];

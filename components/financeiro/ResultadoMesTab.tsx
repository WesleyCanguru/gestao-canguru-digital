import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../../lib/supabase';
import { CurrencyCode, FxRates, formatMoney } from '../../lib/money';
import { loadFinanceRange, computeMonths, MonthNumbers, monthLabel } from '../../lib/financeRange';

/** Resultado do mês (DRE gerencial): receita pelo mês a que pertence, menos as despesas do mês. */
export const ResultadoMesTab: React.FC<{ baseCurrency: CurrencyCode; fxRates: FxRates | null; hideValues?: boolean }> = ({ baseCurrency, fxRates, hideValues }) => {
  const { agencyId } = useAuth();
  const [year, setYear] = useState(dayjs().year());
  const [rows, setRows] = useState<MonthNumbers[]>([]);
  const [prevDec, setPrevDec] = useState<MonthNumbers | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(dayjs().format('YYYY-MM'));
  const money = (v: number) => (hideValues ? '••••••' : formatMoney(v, baseCurrency, { compact: true }));

  useEffect(() => {
    if (!agencyId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const data = await loadFinanceRange(agencyId, `${year - 1}-12`, `${year}-12`);
      if (!alive) return;
      const all = computeMonths(data, baseCurrency, fxRates);
      setPrevDec(all[0]); setRows(all.slice(1));
      if (dayjs(selected + '-01').year() !== year) setSelected(year === dayjs().year() ? dayjs().format('YYYY-MM') : `${year}-12`);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [agencyId, year, baseCurrency, fxRates]); // eslint-disable-line react-hooks/exhaustive-deps

  const thisMonth = dayjs().format('YYYY-MM');
  const visible = useMemo(() => rows.filter(r => r.month <= (year === dayjs().year() ? thisMonth : `${year}-12`)), [rows, year, thisMonth]);
  const idx = rows.findIndex(r => r.month === selected);
  const cur = rows[idx];
  const prev = idx > 0 ? rows[idx - 1] : prevDec;
  const types = useMemo(() => Array.from(new Set(visible.flatMap(r => Object.keys(r.expByType)))).sort(), [visible]);

  const Delta: React.FC<{ now: number; before?: number; invert?: boolean }> = ({ now, before, invert }) => {
    if (before === undefined || before === 0) return null;
    const pct = ((now - before) / Math.abs(before)) * 100;
    const good = invert ? pct <= 0 : pct >= 0;
    return <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${good ? 'text-emerald-700' : 'text-rose-700'}`}>{pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(pct).toFixed(0)}%</span>;
  };

  const chart = visible.map(r => ({ name: monthLabel(r.month), Lucro: Math.round(r.profit), Receita: Math.round(r.revTotal) }));
  const cell = (v: number, bold = false, tone?: 'pos' | 'neg') => (
    <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${bold ? 'font-bold' : ''} ${tone === 'neg' || (tone === 'pos' && v < 0) ? 'text-rose-700' : tone === 'pos' ? 'text-emerald-700' : 'text-gray-800'}`}>{money(v)}</td>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Resultado do mês</h3>
          <p className="text-sm text-gray-500">Se a agência deu lucro: a receita conta no mês a que pertence, mesmo se foi paga depois.</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <select value={selected} onChange={e => setSelected(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white">
            {visible.map(r => <option key={r.month} value={r.month}>{monthLabel(r.month, true)}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white">
            {[0, 1, 2].map(i => dayjs().year() - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading || !cur ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-gray-300" /></div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { l: 'Receita', v: cur.revTotal, p: prev?.revTotal, note: cur.revHasForecast ? 'inclui o que falta receber' : 'tudo recebido' },
              { l: 'Despesas', v: cur.expTotal, p: prev?.expTotal, invert: true, note: `${money(cur.expFixed)} fixas` },
              { l: 'Lucro', v: cur.profit, p: prev?.profit, note: 'receita − despesas' },
            ].map(k => (
              <div key={k.l} className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-xs font-medium text-gray-500 flex items-center justify-between gap-2">{k.l} <Delta now={k.v} before={k.p} invert={k.invert} /></p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${k.l === 'Lucro' && k.v < 0 ? 'text-rose-700' : 'text-gray-900'}`}>{money(k.v)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{k.note}</p>
              </div>
            ))}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-medium text-gray-500">Margem</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${cur.margin < 0 ? 'text-rose-700' : 'text-gray-900'}`}>{hideValues ? '••' : `${cur.margin.toFixed(0)}%`}</p>
              <p className="text-xs text-gray-400 mt-0.5">{prev ? `mês anterior: ${prev.margin.toFixed(0)}%` : 'do lucro sobre a receita'}</p>
            </div>
          </div>

          {!hideValues && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={64} tickFormatter={v => formatMoney(v, baseCurrency, { compact: true }).replace(/\s/g, '')} />
                    <Tooltip formatter={(v: any) => formatMoney(Number(v), baseCurrency, { compact: true })} />
                    <Bar dataKey="Lucro" radius={[4, 4, 0, 0]} maxBarSize={26}>
                      {chart.map((d, i) => <Cell key={i} fill={d.Lucro >= 0 ? '#10b981' : '#f43f5e'} />)}
                    </Bar>
                    <Line type="monotone" dataKey="Receita" stroke="#456da1" strokeWidth={2} dot={{ r: 2.5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Barras: lucro de cada mês. Linha: receita.</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-white min-w-[170px]">{year}</th>
                  {visible.map(r => <th key={r.month} className={`px-4 py-3 text-right font-semibold ${r.month === selected ? 'text-gray-900' : ''}`}>{monthLabel(r.month).split('/')[0]}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr><td className="px-4 py-2.5 sticky left-0 bg-white text-gray-600">Receita recorrente</td>{visible.map(r => <React.Fragment key={r.month}>{cell(r.revRecurring)}</React.Fragment>)}</tr>
                <tr><td className="px-4 py-2.5 sticky left-0 bg-white text-gray-600">Receita avulsa</td>{visible.map(r => <React.Fragment key={r.month}>{cell(r.revSporadic)}</React.Fragment>)}</tr>
                <tr className="bg-gray-50/60"><td className="px-4 py-2.5 sticky left-0 bg-gray-50 font-bold text-gray-900">(=) Receita total</td>{visible.map(r => <React.Fragment key={r.month}>{cell(r.revTotal, true)}</React.Fragment>)}</tr>
                {types.map(tp => (
                  <tr key={tp}><td className="px-4 py-2.5 sticky left-0 bg-white text-gray-600">(−) {tp}</td>{visible.map(r => <React.Fragment key={r.month}>{cell(r.expByType[tp] || 0, false, 'neg')}</React.Fragment>)}</tr>
                ))}
                <tr className="bg-gray-50/60"><td className="px-4 py-2.5 sticky left-0 bg-gray-50 font-bold text-gray-900">(=) Despesas</td>{visible.map(r => <React.Fragment key={r.month}>{cell(r.expTotal, true, 'neg')}</React.Fragment>)}</tr>
                <tr className="bg-gray-50"><td className="px-4 py-2.5 sticky left-0 bg-gray-50 font-bold text-gray-900">(=) Lucro</td>{visible.map(r => <React.Fragment key={r.month}>{cell(r.profit, true, 'pos')}</React.Fragment>)}</tr>
                <tr><td className="px-4 py-2.5 sticky left-0 bg-white text-gray-600">Margem</td>{visible.map(r => <td key={r.month} className="px-4 py-2.5 text-right tabular-nums text-gray-600">{hideValues ? '••' : `${r.margin.toFixed(0)}%`}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">Receita pela competência: a mensalidade de outubro conta em outubro, mesmo se foi paga em novembro. Para ver quando o dinheiro entrou, use Fluxo de caixa. Meses com cobranças em aberto contam o valor previsto.</p>
        </>
      )}
    </div>
  );
};

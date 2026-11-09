import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Wallet, Loader2, Pencil, Check } from 'lucide-react';
import { useAuth } from '../../lib/supabase';
import { CurrencyCode, FxRates, formatMoney } from '../../lib/money';
import { loadFinanceRange, computeMonths, MonthNumbers, monthLabel, getAgencySetting, setAgencySetting, billOpenBase } from '../../lib/financeRange';
import { parseCurrencyInput } from '../../lib/currencyUtils';

type Period = 'janela' | 'ano';
type Opening = { valor: number; data: string };

/** Fluxo de caixa: quando o dinheiro entra e sai (realizado nos meses passados, previsto nos futuros). */
export const FluxoCaixaTab: React.FC<{ baseCurrency: CurrencyCode; fxRates: FxRates | null; hideValues?: boolean; onGoFaturamento?: () => void }> = ({ baseCurrency, fxRates, hideValues, onGoFaturamento }) => {
  const { agencyId } = useAuth();
  const [period, setPeriod] = useState<Period>('janela');
  const [rows, setRows] = useState<MonthNumbers[]>([]);
  const [overdue, setOverdue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const [draftDate, setDraftDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [openMonth, setOpenMonth] = useState<string | null>(dayjs().format('YYYY-MM'));
  const thisMonth = dayjs().format('YYYY-MM');
  const money = (v: number) => (hideValues ? '••••••' : formatMoney(v, baseCurrency, { compact: true }));

  useEffect(() => {
    if (!agencyId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const from = period === 'ano' ? dayjs().startOf('year').format('YYYY-MM') : dayjs().subtract(5, 'month').format('YYYY-MM');
      const to = period === 'ano' ? dayjs().endOf('year').format('YYYY-MM') : dayjs().add(3, 'month').format('YYYY-MM');
      const [data, op] = await Promise.all([loadFinanceRange(agencyId, from, to), getAgencySetting<Opening>(agencyId, 'saldo_inicial')]);
      if (!alive) return;
      setRows(computeMonths(data, baseCurrency, fxRates));
      setOverdue(data.billings.filter(b => b.status !== 'paid' && (b.due_date || '') < dayjs().format('YYYY-MM-DD')).reduce((a, b) => a + billOpenBase(b, baseCurrency, fxRates), 0));
      setOpening(op);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [agencyId, period, baseCurrency, fxRates]);

  // Saldo acumulado: começa no saldo informado, no mês da data informada (antes disso não acumula)
  const withBalance = useMemo(() => {
    let bal = 0; let started = !opening;
    return rows.map(r => {
      if (opening && !started && r.month >= opening.data.slice(0, 7)) { started = true; bal = opening.valor; }
      if (started) bal += r.month < thisMonth ? r.inDone - r.outDone : r.cashNet;
      return { ...r, balance: started ? bal : null as number | null, future: r.month > thisMonth };
    });
  }, [rows, opening, thisMonth]);

  const cur = withBalance.find(r => r.month === thisMonth);
  const saveOpening = async () => {
    if (!agencyId) return;
    const v = { valor: parseCurrencyInput(draftValue) || 0, data: draftDate };
    const err = await setAgencySetting(agencyId, 'saldo_inicial', v);
    if (!err) { setOpening(v); setEditing(false); }
  };

  const chart = withBalance.map(r => ({ name: monthLabel(r.month), Entradas: Math.round(r.month < thisMonth ? r.inDone : r.cashIn), Saídas: Math.round(r.month < thisMonth ? r.outDone : r.cashOut), Saldo: r.balance != null ? Math.round(r.balance) : null, future: r.future }));
  const selected = withBalance.find(r => r.month === openMonth);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Fluxo de caixa</h3>
          <p className="text-sm text-gray-500">Quando o dinheiro entra e sai. Meses passados: realizado. Meses futuros: previsto.</p>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-gray-100 self-start">
          {([['janela', '6 meses + 3 próximos'], ['ano', 'Este ano']] as [Period, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${period === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Saldo em conta */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <Wallet size={18} className="text-gray-400" />
        {editing ? (
          <>
            <span className="text-sm text-gray-600">Saldo em conta em</span>
            <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm" />
            <input inputMode="decimal" autoFocus value={draftValue} onChange={e => setDraftValue(e.target.value)} placeholder="0,00" className="w-36 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm" />
            <button onClick={saveOpening} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold"><Check size={14} /> Salvar</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500">Cancelar</button>
          </>
        ) : (
          <>
            <span className="text-sm text-gray-600">
              {opening ? <>Saldo em conta em {dayjs(opening.data).format('DD/MM/YYYY')}: <b className="text-gray-900">{money(opening.valor)}</b></> : 'Informe o saldo em conta para ver o saldo acumulado de verdade.'}
            </span>
            <button onClick={() => { setDraftValue(opening ? String(opening.valor).replace('.', ',') : ''); setDraftDate(opening?.data || dayjs().format('YYYY-MM-DD')); setEditing(true); }}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"><Pencil size={13} /> {opening ? 'Atualizar' : 'Informar saldo'}</button>
          </>
        )}
      </div>

      {overdue > 0 && (
        <button onClick={onGoFaturamento} className="w-full text-left p-3.5 rounded-2xl bg-amber-50 border border-amber-100 text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle size={16} /> <b>{money(overdue)}</b> vencidos e não recebidos. Ver no Faturamento.
        </button>
      )}

      {loading ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-gray-300" /></div> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-medium text-gray-500 flex items-center gap-1"><ArrowUpRight size={14} className="text-emerald-600" /> Entrou em {monthLabel(thisMonth, true).toLowerCase()}</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">{money(cur?.inDone || 0)}</p>
              <p className="text-xs text-gray-400 mt-0.5">+ {money(cur?.inPlanned || 0)} ainda a receber</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-medium text-gray-500 flex items-center gap-1"><ArrowDownRight size={14} className="text-rose-600" /> Saiu em {monthLabel(thisMonth, true).toLowerCase()}</p>
              <p className="mt-1 text-2xl font-bold text-rose-700 tabular-nums">{money(cur?.outDone || 0)}</p>
              <p className="text-xs text-gray-400 mt-0.5">+ {money(cur?.outPlanned || 0)} ainda a pagar</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-medium text-gray-500">{cur?.balance != null ? 'Saldo previsto no fim do mês' : 'Resultado previsto do mês'}</p>
              {(() => { const v = cur?.balance ?? cur?.cashNet ?? 0; return <p className={`mt-1 text-2xl font-bold tabular-nums ${v >= 0 ? 'text-gray-900' : 'text-rose-700'}`}>{money(v)}</p>; })()}
              <p className="text-xs text-gray-400 mt-0.5">entradas − saídas, contando o que falta</p>
            </div>
          </div>

          {!hideValues && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={64} tickFormatter={v => formatMoney(v, baseCurrency, { compact: true }).replace(/\s/g, '')} />
                    <Tooltip formatter={(v: any) => formatMoney(Number(v), baseCurrency, { compact: true })} />
                    <Bar dataKey="Entradas" radius={[4, 4, 0, 0]} maxBarSize={22}>
                      {chart.map((d, i) => <Cell key={i} fill="#10b981" fillOpacity={d.future ? 0.35 : 1} />)}
                    </Bar>
                    <Bar dataKey="Saídas" radius={[4, 4, 0, 0]} maxBarSize={22}>
                      {chart.map((d, i) => <Cell key={i} fill="#f43f5e" fillOpacity={d.future ? 0.35 : 1} />)}
                    </Bar>
                    {opening && <Line type="monotone" dataKey="Saldo" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Barras claras = previsto. {opening ? 'A linha é o saldo acumulado.' : 'Informe o saldo em conta para ver a linha do saldo.'}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-[11px] uppercase tracking-wider text-gray-400 text-left border-b border-gray-100">
                <th className="px-5 py-3 font-semibold">Mês</th><th className="px-5 py-3 font-semibold text-right">Entradas</th><th className="px-5 py-3 font-semibold text-right">Saídas</th><th className="px-5 py-3 font-semibold text-right">Resultado</th><th className="px-5 py-3 font-semibold text-right">Saldo</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {withBalance.map(r => {
                  const past = r.month < thisMonth;
                  const inn = past ? r.inDone : r.cashIn, out = past ? r.outDone : r.cashOut, net = inn - out;
                  return (
                    <tr key={r.month} onClick={() => setOpenMonth(openMonth === r.month ? null : r.month)} className={`cursor-pointer hover:bg-gray-50 ${openMonth === r.month ? 'bg-gray-50' : ''}`}>
                      <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{monthLabel(r.month)} {r.future && <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">previsto</span>}{r.month === thisMonth && <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">atual</span>}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{money(inn)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-rose-700">{money(out)}</td>
                      <td className={`px-5 py-3 text-right tabular-nums font-semibold ${net >= 0 ? 'text-gray-900' : 'text-rose-700'}`}>{money(net)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-600">{r.balance != null ? money(r.balance) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="bg-white rounded-2xl border border-gray-100">
              <p className="px-5 pt-4 pb-2 text-sm font-bold text-gray-900">{monthLabel(selected.month, true)}: o que entrou e saiu</p>
              {selected.items.length === 0 ? <p className="px-5 pb-5 text-sm text-gray-400">Nada neste mês.</p> : (
                <ul className="divide-y divide-gray-50">
                  {selected.items.map((it, i) => (
                    <li key={i} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                      <span className={`w-1.5 h-1.5 rounded-full ${it.kind === 'in' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="flex-1 min-w-0 truncate text-gray-800">{it.name}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{dayjs(it.date).format('DD/MM')} · {it.assumed ? 'venceu, não marcado como pago' : it.done ? (it.kind === 'in' ? 'recebido' : 'pago') : (it.kind === 'in' ? 'a receber' : 'a pagar')}</span>
                      <span className={`w-28 text-right tabular-nums font-semibold ${it.kind === 'in' ? 'text-emerald-700' : 'text-rose-700'} ${it.done ? '' : 'opacity-60'}`}>{it.kind === 'in' ? '+' : '−'} {money(it.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

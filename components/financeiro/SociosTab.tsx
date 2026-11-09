import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Loader2, Plus, X, Pencil, Check, Trash2, Info } from 'lucide-react';
import { supabase, useAuth } from '../../lib/supabase';
import { CurrencyCode, FxRates, formatMoney } from '../../lib/money';
import { loadFinanceRange, computeMonths, getAgencySetting, setAgencySetting, monthLabel } from '../../lib/financeRange';
import { parseCurrencyInput } from '../../lib/currencyUtils';

type Partner = { user_id: string | null; name: string; percent: number };
type Move = { id: string; partner_user_id: string | null; partner_name: string; kind: 'aporte' | 'retirada'; amount: number; move_date: string; note: string | null };
type Opening = { valor: number; data: string };

/**
 * Sócios (Joey): conta de capital de cada sócio = aportes + parte do lucro − retiradas.
 * Retirada não é despesa: não mexe no lucro. O lucro do ano vem do Resultado do mês (competência), até o mês atual.
 */
export const SociosTab: React.FC<{ baseCurrency: CurrencyCode; fxRates: FxRates | null; hideValues?: boolean }> = ({ baseCurrency, fxRates, hideValues }) => {
  const { agencyId, can } = useAuth();
  const canEdit = can('edit_finance');
  const [year, setYear] = useState(dayjs().year());
  const [partners, setPartners] = useState<Partner[]>([]);
  const [reserve, setReserve] = useState<number | null>(null);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [profitYear, setProfitYear] = useState(0);
  const [cashNow, setCashNow] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editShares, setEditShares] = useState<Partner[] | null>(null);
  const [editReserve, setEditReserve] = useState<string | null>(null);
  const [newMove, setNewMove] = useState<{ who: number; kind: 'aporte' | 'retirada'; amount: string; date: string; note: string } | null>(null);
  const [err, setErr] = useState('');
  const [reload, setReload] = useState(0);
  const money = (v: number) => (hideValues ? '••••••' : formatMoney(v, baseCurrency, { compact: true }));

  useEffect(() => {
    if (!agencyId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const thisMonth = dayjs().format('YYYY-MM');
      const lastMonth = year === dayjs().year() ? thisMonth : `${year}-12`;
      const [cfg, res, op, mv, members] = await Promise.all([
        getAgencySetting<Partner[]>(agencyId, 'socios'),
        getAgencySetting<{ valor: number | null }>(agencyId, 'reserva_minima'),
        getAgencySetting<Opening>(agencyId, 'saldo_inicial'),
        supabase.from('agency_partner_moves').select('*').eq('agency_id', agencyId).order('move_date', { ascending: false }),
        supabase.from('agency_members').select('user_id, display_name, role, is_active').eq('agency_id', agencyId),
      ]);
      let list = cfg && cfg.length ? cfg : null;
      if (!list) {
        const owners = ((members.data as any[]) || []).filter(m => m.is_active && (m.role === 'master' || m.role === 'partner'));
        list = owners.map(m => ({ user_id: m.user_id, name: m.display_name || 'Sócio', percent: Math.round((100 / Math.max(1, owners.length)) * 100) / 100 }));
      }
      // Lucro do ano (competência) até o mês atual; caixa de hoje a partir do saldo informado no Fluxo de caixa
      const start = [`${year}-01`, op?.data.slice(0, 7) || `${year}-01`].sort()[0];
      const data = await loadFinanceRange(agencyId, start, lastMonth);
      const nums = computeMonths(data, baseCurrency, fxRates);
      const profit = nums.filter(n => n.month >= `${year}-01` && n.month <= lastMonth).reduce((a, n) => a + n.profit, 0);
      let cash: number | null = null;
      if (op) {
        cash = op.valor;
        for (const n of nums) if (n.month >= op.data.slice(0, 7)) cash += n.inDone - n.outDone;
        // (retiradas e aportes já entram no caixa pelo loadFinanceRange)
      }
      if (!alive) return;
      setPartners(list); setReserve(res?.valor ?? null); setOpening(op); setMoves((mv.data as Move[]) || []);
      setProfitYear(profit); setCashNow(cash); setLoading(false);
    })();
    return () => { alive = false; };
  }, [agencyId, year, baseCurrency, fxRates, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const yearMoves = moves.filter(m => dayjs(m.move_date).year() === year);
  const rows = useMemo(() => partners.map(p => {
    const mine = yearMoves.filter(m => (p.user_id && m.partner_user_id === p.user_id) || (!p.user_id && m.partner_name === p.name));
    const aportes = mine.filter(m => m.kind === 'aporte').reduce((a, m) => a + Number(m.amount), 0);
    const retiradas = mine.filter(m => m.kind === 'retirada').reduce((a, m) => a + Number(m.amount), 0);
    const lucro = profitYear * (p.percent / 100);
    return { ...p, aportes, retiradas, lucro, saldo: aportes + lucro - retiradas };
  }), [partners, yearMoves, profitYear]);
  const totalPercent = (editShares || partners).reduce((a, p) => a + Number(p.percent || 0), 0);
  const available = cashNow == null ? null : Math.max(0, cashNow - (reserve || 0));

  const saveShares = async () => {
    if (!agencyId || !editShares) return;
    if (Math.abs(editShares.reduce((a, p) => a + Number(p.percent || 0), 0) - 100) > 0.01) { setErr('As partes precisam somar 100%.'); return; }
    const e = await setAgencySetting(agencyId, 'socios', editShares);
    if (e) { setErr(e); return; }
    setEditShares(null); setErr(''); setReload(r => r + 1);
  };
  const saveReserve = async () => {
    if (!agencyId || editReserve === null) return;
    const v = editReserve.trim() ? parseCurrencyInput(editReserve) : null;
    const e = await setAgencySetting(agencyId, 'reserva_minima', { valor: v });
    if (e) { setErr(e); return; }
    setEditReserve(null); setReload(r => r + 1);
  };
  const saveMove = async () => {
    if (!agencyId || !newMove) return;
    const p = partners[newMove.who];
    const amount = parseCurrencyInput(newMove.amount) || 0;
    if (!p || amount <= 0) { setErr('Escolha o sócio e informe o valor.'); return; }
    const { error } = await supabase.from('agency_partner_moves').insert({
      agency_id: agencyId, partner_user_id: p.user_id, partner_name: p.name, kind: newMove.kind, amount, move_date: newMove.date, note: newMove.note.trim() || null,
    });
    if (error) { setErr(error.message); return; }
    setNewMove(null); setErr(''); setReload(r => r + 1);
  };
  const removeMove = async (m: Move) => {
    if (!window.confirm(`Excluir ${m.kind} de ${money(Number(m.amount))} (${m.partner_name})?`)) return;
    const { error } = await supabase.from('agency_partner_moves').delete().eq('id', m.id);
    if (error) setErr(error.message); else setReload(r => r + 1);
  };

  const field = 'px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Sócios</h3>
          <p className="text-sm text-gray-500">Quanto da empresa é de cada sócio: aportes + parte do lucro − retiradas. Retirada não é despesa.</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={`${field} bg-white`}>{[0, 1, 2].map(i => dayjs().year() - i).map(y => <option key={y} value={y}>{y}</option>)}</select>
          {canEdit && <button onClick={() => setNewMove({ who: 0, kind: 'retirada', amount: '', date: dayjs().format('YYYY-MM-DD'), note: '' })} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold"><Plus size={15} /> Registrar retirada ou aporte</button>}
        </div>
      </div>

      {err && <p className="text-sm text-rose-600">{err}</p>}

      {loading ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-gray-300" /></div> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-medium text-gray-500">Lucro de {year}{year === dayjs().year() ? ` até ${monthLabel(dayjs().format('YYYY-MM'), true).split(' de ')[0].toLowerCase()}` : ''}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${profitYear < 0 ? 'text-rose-700' : 'text-gray-900'}`}>{money(profitYear)}</p>
              <p className="text-xs text-gray-400 mt-0.5">do Resultado do mês</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-medium text-gray-500">Reserva mínima em caixa</p>
              {editReserve !== null ? (
                <div className="mt-1 flex items-center gap-2"><input autoFocus inputMode="decimal" value={editReserve} onChange={e => setEditReserve(e.target.value)} placeholder="Deixe vazio se ainda não definiu" className={`${field} w-full`} /><button onClick={saveReserve} className="p-2 rounded-lg bg-gray-900 text-white"><Check size={14} /></button></div>
              ) : (
                <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 flex items-center gap-2">{reserve != null ? money(reserve) : <span className="text-base font-semibold text-gray-400">Não definida</span>}
                  {canEdit && <button onClick={() => setEditReserve(reserve != null ? String(reserve).replace('.', ',') : '')} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><Pencil size={13} /></button>}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">o que fica na empresa antes de distribuir</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-medium text-gray-500">Disponível para distribuir hoje</p>
              {available == null
                ? <p className="mt-2 text-sm text-gray-500 flex gap-1.5"><Info size={15} className="shrink-0 mt-0.5" /> Informe o saldo em conta na aba Fluxo de caixa para calcular.</p>
                : <><p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{money(available)}</p><p className="text-xs text-gray-400 mt-0.5">caixa de hoje {money(cashNow || 0)} − reserva</p></>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            <div className="px-5 pt-4 pb-2 flex items-center">
              <p className="text-sm font-bold text-gray-900">Conta de cada sócio em {year}</p>
              {canEdit && !editShares && <button onClick={() => setEditShares(partners.map(p => ({ ...p })))} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"><Pencil size={13} /> Editar partes</button>}
            </div>
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-[11px] uppercase tracking-wider text-gray-400 text-left border-b border-gray-100">
                <th className="px-5 py-2.5 font-semibold">Sócio</th><th className="px-5 py-2.5 font-semibold text-right">Parte</th><th className="px-5 py-2.5 font-semibold text-right">Parte do lucro</th><th className="px-5 py-2.5 font-semibold text-right">Aportes</th><th className="px-5 py-2.5 font-semibold text-right">Retiradas</th><th className="px-5 py-2.5 font-semibold text-right">Saldo</th><th className="px-5 py-2.5 font-semibold text-right">Pode retirar hoje</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r, i) => (
                  <tr key={(r.user_id || r.name) + i}>
                    <td className="px-5 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-5 py-3 text-right">{editShares ? (
                      <input inputMode="decimal" value={String(editShares[i]?.percent ?? '')} onChange={e => setEditShares(s => s!.map((x, j) => j === i ? { ...x, percent: Number(e.target.value.replace(',', '.')) || 0 } : x))} className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-right text-sm" />
                    ) : `${r.percent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{money(r.lucro)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{money(r.aportes)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-rose-700">{money(r.retiradas)}</td>
                    <td className={`px-5 py-3 text-right tabular-nums font-bold ${r.saldo < 0 ? 'text-rose-700' : 'text-gray-900'}`}>{money(r.saldo)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{available == null ? '—' : money(Math.max(0, Math.min(r.saldo, available * (r.percent / 100))))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {editShares && (
              <div className="px-5 py-3 flex items-center gap-2 border-t border-gray-100">
                <span className={`text-xs font-semibold ${Math.abs(totalPercent - 100) > 0.01 ? 'text-rose-600' : 'text-gray-500'}`}>Total: {totalPercent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</span>
                <button onClick={() => setEditShares(null)} className="ml-auto px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600">Cancelar</button>
                <button onClick={saveShares} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold">Salvar partes</button>
              </div>
            )}
            <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-50">"Pode retirar hoje" = a parte de cada um no disponível, limitada ao saldo dele. Se alguém retirar mais que o saldo, o saldo fica negativo e aparece em vermelho.</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100">
            <p className="px-5 pt-4 pb-2 text-sm font-bold text-gray-900">Retiradas e aportes de {year}</p>
            {yearMoves.length === 0 ? <p className="px-5 pb-5 text-sm text-gray-400">Nenhum registro neste ano.</p> : (
              <ul className="divide-y divide-gray-50">
                {yearMoves.map(m => (
                  <li key={m.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                    <span className="text-xs text-gray-400 w-12">{dayjs(m.move_date).format('DD/MM')}</span>
                    <span className="flex-1 min-w-0 truncate"><b className="text-gray-900">{m.partner_name}</b> <span className="text-gray-500">· {m.kind === 'retirada' ? 'retirada' : 'aporte'}{m.note ? ` · ${m.note}` : ''}</span></span>
                    <span className={`tabular-nums font-semibold ${m.kind === 'retirada' ? 'text-rose-700' : 'text-emerald-700'}`}>{m.kind === 'retirada' ? '−' : '+'} {money(Number(m.amount))}</span>
                    {canEdit && <button onClick={() => removeMove(m)} className="p-1.5 rounded-lg text-gray-300 hover:text-rose-600"><Trash2 size={14} /></button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {newMove && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setNewMove(null)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center"><p className="font-bold text-gray-900">Registrar retirada ou aporte</p><button onClick={() => setNewMove(null)} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button></div>
            <div className="inline-flex p-1 rounded-xl bg-gray-100">
              {(['retirada', 'aporte'] as const).map(k => <button key={k} onClick={() => setNewMove({ ...newMove, kind: k })} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${newMove.kind === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>{k === 'retirada' ? 'Retirada' : 'Aporte'}</button>)}
            </div>
            <select value={newMove.who} onChange={e => setNewMove({ ...newMove, who: Number(e.target.value) })} className={`${field} w-full bg-white`}>{partners.map((p, i) => <option key={i} value={i}>{p.name}</option>)}</select>
            <div className="grid grid-cols-2 gap-2">
              <input inputMode="decimal" autoFocus value={newMove.amount} onChange={e => setNewMove({ ...newMove, amount: e.target.value })} placeholder={`Valor (${baseCurrency})`} className={field} />
              <input type="date" value={newMove.date} onChange={e => setNewMove({ ...newMove, date: e.target.value })} className={field} />
            </div>
            <input value={newMove.note} onChange={e => setNewMove({ ...newMove, note: e.target.value })} placeholder="Nota (opcional)" className={`${field} w-full`} />
            <p className="text-[11px] text-gray-400">{newMove.kind === 'retirada' ? 'Dinheiro que o sócio tira para si. Diminui o saldo dele e o caixa, não o lucro.' : 'Dinheiro que o sócio coloca na empresa. Aumenta o saldo dele e o caixa.'}</p>
            <button onClick={saveMove} className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">Salvar</button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import dayjs from 'dayjs';
import { AgencyBilling } from '../../types';
import { CurrencyCode, FxRates, RECEIVED_REASONS, asCurrency, formatMoney } from '../../lib/money';
import { parseCurrencyInput } from '../../lib/currencyUtils';

export interface ReceiveResult {
  status: 'paid' | 'partial';
  paid_at: string;
  received_amount: number;
  received_reason: 'extra' | 'desconto' | 'juros' | 'parcial' | null;
  received_note: string | null;
  fx_rate: number | null;
  received_amount_base: number;
  currency: CurrencyCode;
}

const toInput = (v: number) => v.toFixed(2).replace('.', ',');

/**
 * Botão Recebido: confirma o valor (já preenchido com o previsto). Se for diferente, pede o motivo.
 * Para cobrança em outra moeda, mostra quanto entrou na moeda base com a cotação do dia (editável).
 * Num pagamento parcial já registrado, o "previsto" passa a ser o restante.
 */
export const ReceivePaymentModal: React.FC<{
  billing: AgencyBilling;
  baseCurrency: CurrencyCode;
  fxRates: FxRates | null;
  onClose: () => void;
  onConfirm: (r: ReceiveResult) => Promise<void>;
}> = ({ billing, baseCurrency, fxRates, onClose, onConfirm }) => {
  const currency = asCurrency(billing.currency || (billing.client as any)?.currency, baseCurrency);
  const total = Number(billing.base_value || 0) + Number(billing.extra_value || 0);
  const alreadyReceived = billing.status === 'partial' ? Number(billing.received_amount || 0) : 0;
  const expected = Math.max(0, total - alreadyReceived);
  const name = billing.is_sporadic ? billing.sporadic_name : billing.client?.name;

  const [amount, setAmount] = useState(toInput(expected));
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [reason, setReason] = useState<ReceiveResult['received_reason']>(null);
  const [note, setNote] = useState('');
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const foreign = currency !== baseCurrency;
  useEffect(() => {
    if (foreign && fxRates?.[currency]) setRate(String(fxRates[currency].toFixed(4)).replace('.', ','));
  }, [foreign, fxRates, currency]);

  const value = parseCurrencyInput(amount) || 0;
  const diff = Math.round((value - expected) * 100) / 100;
  const needsReason = diff !== 0;
  const allowed = RECEIVED_REASONS.filter(r => (diff > 0 ? r.id === 'extra' || r.id === 'juros' : r.id === 'desconto' || r.id === 'parcial'));
  const rateNum = foreign ? (parseCurrencyInput(rate) || 0) : 1;
  const inBase = value * rateNum;

  useEffect(() => { if (!needsReason) setReason(null); else if (reason && !allowed.some(a => a.id === reason)) setReason(null); }, [needsReason, diff > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setErr('');
    if (value <= 0) { setErr('Informe o valor recebido.'); return; }
    if (needsReason && !reason) { setErr('Escolha o motivo da diferença.'); return; }
    if (needsReason && reason === 'extra' && !note.trim()) { setErr('Escreva de onde veio o valor extra.'); return; }
    if (foreign && !rateNum) { setErr('Informe a cotação do dia.'); return; }
    setBusy(true);
    try {
      const totalReceived = alreadyReceived + value;
      const prevBase = billing.status === 'partial' ? Number(billing.received_amount_base || 0) : 0;
      await onConfirm({
        status: reason === 'parcial' ? 'partial' : 'paid',
        paid_at: dayjs(date).hour(12).toISOString(),
        received_amount: Math.round(totalReceived * 100) / 100,
        received_reason: reason ?? (billing.status === 'partial' ? 'parcial' : null),
        received_note: [billing.status === 'partial' ? billing.received_note : null, note.trim() || null].filter(Boolean).join(' | ') || null,
        fx_rate: foreign ? rateNum : null,
        received_amount_base: Math.round((prevBase + inBase) * 100) / 100,
        currency,
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível salvar.');
    }
    setBusy(false);
  };

  const field = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5';

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500">{billing.status === 'partial' ? 'Receber o restante' : 'Registrar recebimento'}</p>
            <p className="font-bold text-gray-900 truncate">{name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Previsto: {formatMoney(total, currency)}
              {alreadyReceived > 0 && <> · já recebido {formatMoney(alreadyReceived, currency)}</>}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1.5">Valor recebido ({currency})</span>
            <input autoFocus inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className={`${field} font-semibold`} />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1.5">Data</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={field} />
          </label>
        </div>

        {needsReason && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">
              {diff > 0 ? `Veio ${formatMoney(diff, currency)} a mais. Por quê?` : `Veio ${formatMoney(-diff, currency)} a menos. Por quê?`}
            </p>
            <div className="grid gap-2">
              {allowed.map(r => (
                <button key={r.id} type="button" onClick={() => setReason(r.id)}
                  className={`text-left px-3.5 py-2.5 rounded-xl border text-sm transition-colors ${reason === r.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="font-semibold text-gray-900">{r.label}</span>
                  <span className="block text-xs text-gray-500">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(needsReason || billing.status === 'partial') && (
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1.5">Nota {reason === 'extra' ? '' : '(opcional)'}</span>
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={300}
              placeholder={reason === 'extra' ? 'Ex.: entrada de campanha extra' : 'Ex.: combinado por WhatsApp'} className={field} />
          </label>
        )}

        {foreign && (
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              Cotação: 1 {currency} =
              <input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
              {baseCurrency}
            </label>
            <p className="text-sm text-gray-700">Entrou na conta: <span className="font-bold">{formatMoney(inBase, baseCurrency)}</span></p>
            {!fxRates && <p className="text-[11px] text-amber-700">Não consegui buscar a cotação de hoje. Digite a do seu banco.</p>}
          </div>
        )}

        {err && <p className="text-sm text-rose-600">{err}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Cancelar</button>
          <button disabled={busy} onClick={submit} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {reason === 'parcial' ? 'Registrar parcial' : 'Confirmar recebimento'}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, DollarSign, Check, X, ArrowRight } from 'lucide-react';
import { RevenueEventType } from '../../types';
import dayjs from 'dayjs';

export interface RevenueChangeModalData {
  clientId: string;
  clientName: string;
  previousValue: number;
  newValue: number;
  eventType: RevenueEventType;
  occurredAt?: string;
  note?: string;
}

interface RevenueChangeConfirmModalProps {
  isOpen: boolean;
  data: RevenueChangeModalData | null;
  onConfirm: (note: string, occurredAt: string) => Promise<void> | void;
  onCancel: () => void;
  loading?: boolean;
}

export const RevenueChangeConfirmModal: React.FC<RevenueChangeConfirmModalProps> = ({
  isOpen,
  data,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const [note, setNote] = useState('');
  const [occurredAt, setOccurredAt] = useState(dayjs().format('YYYY-MM-DD'));

  if (!isOpen || !data) return null;

  const isUpsell = data.newValue > data.previousValue;
  const delta = data.newValue - data.previousValue;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(note, occurredAt);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-left"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
            isUpsell ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
          }`}>
            {isUpsell ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md ${
              isUpsell ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {isUpsell ? 'Expansão de Receita (Upsell)' : 'Redução de Receita (Downsell)'}
            </span>
            <h3 className="text-lg font-bold text-brand-dark mt-1">Alteração de Valor Mensal</h3>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          O valor mensal do cliente <strong>{data.clientName}</strong> foi alterado. Deseja registrar uma justificativa para esta mudança no histórico financeiro?
        </p>

        {/* Comparativo de valores */}
        <div className="p-4 bg-gray-50/80 rounded-2xl border border-black/[0.04] mb-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 font-medium">Valor Anterior:</span>
            <span className="text-gray-600 font-semibold">{formatCurrency(data.previousValue)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 font-medium">Novo Valor Base:</span>
            <span className="text-brand-dark font-bold text-sm">{formatCurrency(data.newValue)}</span>
          </div>
          <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs font-bold">
            <span className="text-gray-600">Variação (Delta):</span>
            <span className={isUpsell ? 'text-emerald-600' : 'text-rose-600'}>
              {isUpsell ? `+${formatCurrency(delta)}` : formatCurrency(delta)}
            </span>
          </div>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Data de Início da Alteração
            </label>
            <input
              type="date"
              value={occurredAt}
              onChange={e => setOccurredAt(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Por que o valor mudou? (opcional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ex: Adição de serviço de tráfego, upgrade de entregáveis, renegociação..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-3 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-brand-dark hover:bg-opacity-90 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Confirmar e Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

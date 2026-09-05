import React from 'react';
import { formatCurrency } from '../../lib/currencyUtils';
import { AlertTriangle, CheckCircle, Flame } from 'lucide-react';

interface MediaBudgetProgressBarProps {
  platformLabel: string;
  investedAmount: number;
  budgetAmount: number;
  percentage: number;
  remainingAmount: number;
  exceededAmount: number;
  isOverBudget: boolean;
  statusColor: 'green' | 'yellow' | 'red';
  compact?: boolean;
}

export const MediaBudgetProgressBar: React.FC<MediaBudgetProgressBarProps> = ({
  platformLabel,
  investedAmount,
  budgetAmount,
  percentage,
  remainingAmount,
  exceededAmount,
  isOverBudget,
  statusColor,
  compact = false,
}) => {
  if (budgetAmount <= 0) {
    return (
      <div className="bg-stone-50 border border-stone-200/60 rounded-2xl p-3.5 text-xs text-stone-500 flex items-center justify-between">
        <span className="font-semibold text-stone-600">{platformLabel} — Verba não configurada</span>
        <span className="text-[11px] font-mono font-semibold">Investido no mês: {formatCurrency(investedAmount)}</span>
      </div>
    );
  }

  // Bar fill color logic
  // Verde: até 70% | Amarelo: 70-90% | Vermelho: acima de 90% (ou estouro)
  const barColor =
    statusColor === 'red' || isOverBudget
      ? 'bg-rose-600'
      : statusColor === 'yellow'
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  const badgeBg =
    isOverBudget
      ? 'bg-rose-100 text-rose-800 border-rose-200'
      : statusColor === 'yellow'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200';

  const clampedWidth = Math.min(100, Math.max(0, percentage));

  return (
    <div className="bg-stone-50/90 border border-stone-200/70 rounded-2xl p-4 space-y-2.5">
      {/* Structural Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#13284D]">
            {platformLabel}
          </span>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badgeBg}`}>
            {isOverBudget ? 'VERBA ESTOURADA' : `${percentage}% Consumido`}
          </span>
        </div>

        <div className="text-xs font-bold text-stone-700 font-mono">
          Investido: <span className="text-[#13284D]">{formatCurrency(investedAmount)}</span> de{' '}
          <span className="text-stone-500">{formatCurrency(budgetAmount)}</span>
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="w-full bg-stone-200/80 rounded-full h-3 overflow-hidden p-0.5 border border-stone-300/40 relative shadow-inner">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clampedWidth}%` }}
        />
      </div>

      {/* Status Footer */}
      <div className="flex items-center justify-between text-xs font-semibold">
        {isOverBudget ? (
          <div className="flex items-center gap-1.5 text-rose-600 font-bold">
            <Flame size={14} className="shrink-0" />
            <span>Verba estourada em {formatCurrency(exceededAmount)} ({percentage}%)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-stone-600">
            {statusColor === 'yellow' ? (
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            ) : (
              <CheckCircle size={14} className="text-emerald-500 shrink-0" />
            )}
            <span>
              {percentage}% — Restam <strong className="text-stone-800 font-mono">{formatCurrency(remainingAmount)}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

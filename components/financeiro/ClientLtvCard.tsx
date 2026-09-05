import React from 'react';
import { ClientLtvDetails, formatCompactLtv } from '../../lib/clientLtv';
import { TrendingUp, FileText, ArrowRight } from 'lucide-react';

interface ClientLtvCardProps {
  ltvDetails?: ClientLtvDetails | null;
  onNavigateToContracts?: (clientId?: string) => void;
}

export const ClientLtvCard: React.FC<ClientLtvCardProps> = ({
  ltvDetails,
  onNavigateToContracts
}) => {
  if (!ltvDetails) return null;

  const formattedLtv = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(ltvDetails.ltvEstimated);

  return (
    <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-3xl p-5 text-white shadow-lg border border-indigo-800/40 space-y-3 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <TrendingUp size={16} />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-200/80">
            {ltvDetails.isCancelled ? 'LTV Real' : 'LTV Estimado'}
          </span>
        </div>

        {onNavigateToContracts && (
          <button
            onClick={() => onNavigateToContracts(ltvDetails.clientId)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-300 hover:text-white transition-colors cursor-pointer group"
          >
            <FileText size={13} />
            <span>Ver detalhes em Contratos</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <h4 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          {formattedLtv}
        </h4>
        <span className="text-xs text-indigo-200/70 font-semibold">
          ({ltvDetails.clientName})
        </span>
      </div>

      <p className="text-xs text-indigo-200/90 leading-relaxed font-medium">
        Baseado em: {ltvDetails.explanation}
      </p>
    </div>
  );
};

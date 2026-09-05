import React from 'react';
import { ClientLtvDetails, formatCompactLtv } from '../../lib/clientLtv';
import { Crown, Trophy, ArrowUpRight, TrendingUp, ChevronRight } from 'lucide-react';

interface TopClientsLtvRankingProps {
  ltvList: ClientLtvDetails[];
  onSelectClientFilter?: (clientName: string) => void;
  onNavigateToContracts?: (clientId?: string) => void;
  limit?: number;
}

export const TopClientsLtvRanking: React.FC<TopClientsLtvRankingProps> = ({
  ltvList,
  onSelectClientFilter,
  onNavigateToContracts,
  limit = 5
}) => {
  const topList = ltvList.slice(0, limit);

  if (topList.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-3xl border border-black/[0.04] shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
            <Trophy size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-dark">Top clientes por LTV estimado</h3>
            <p className="text-[11px] text-gray-400">Ranking dos clientes mais valiosos historicamente para a agência</p>
          </div>
        </div>

        {onNavigateToContracts && (
          <button
            onClick={() => onNavigateToContracts()}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Ver Contratos</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {topList.map((item, index) => {
          const rank = index + 1;
          const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(item.ltvEstimated);

          return (
            <div
              key={item.clientId}
              onClick={() => {
                if (onSelectClientFilter) onSelectClientFilter(item.clientName);
              }}
              className="group flex items-center justify-between p-3 hover:bg-gray-50/80 rounded-2xl transition-all border border-transparent hover:border-gray-100 cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                  rank === 1 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                  rank === 2 ? 'bg-slate-100 text-slate-700 border border-slate-300' :
                  rank === 3 ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                  'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                  {rank}
                </span>

                <div className="min-w-0">
                  <p className="font-bold text-xs text-brand-dark truncate group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                    {item.clientName}
                    {item.isCancelled && (
                      <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.2 bg-gray-100 text-gray-500 rounded border border-gray-200">
                        Inativo
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    Ticket: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(item.monthlyTicket)} • {item.projectedMonths} meses
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-black text-xs text-brand-dark group-hover:text-emerald-600 transition-colors block">
                  {formattedValue}
                </span>
                <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-wider">
                  {formatCompactLtv(item.ltvEstimated)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

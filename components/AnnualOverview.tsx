
import React, { useState, useEffect } from 'react';
import { MonthCard } from './MonthCard';
import { DistributionAnalysis } from './DistributionAnalysis';
import { Compass, CheckCircle2 } from 'lucide-react';
import { useAuth, supabase } from '../lib/supabase';
import { useEditorialData, MONTH_NAMES } from '../hooks/useEditorialData';

interface AnnualOverviewProps {
  onSelectMonth: (month: string) => void;
}

export const AnnualOverview: React.FC<AnnualOverviewProps> = ({ onSelectMonth }) => {
  const { activeClient } = useAuth();
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const { monthlyPlans, loading } = useEditorialData();

  useEffect(() => {
    const fetchPostCounts = async () => {
      if (!activeClient) return;

      const { data, error } = await supabase
        .from('posts')
        .select('date_key')
        .eq('client_id', activeClient.id)
        .neq('status', 'deleted');

      if (error) {
        console.error('Error fetching post counts:', error);
        return;
      }

      const counts: Record<string, number> = {};
      data.forEach((post) => {
        // date_key format: DD-MM-YYYY-platform
        const parts = post.date_key.split('-');
        if (parts.length >= 3) {
          const monthStr = parts[1]; // MM
          // Map MM to month name used in ANNUAL_PLAN
          const monthMap: Record<string, string> = {
            '01': 'JANEIRO', '02': 'FEVEREIRO', '03': 'MARÇO', '04': 'ABRIL',
            '05': 'MAIO', '06': 'JUNHO', '07': 'JULHO', '08': 'AGOSTO',
            '09': 'SETEMBRO', '10': 'OUTUBRO', '11': 'NOVEMBRO', '12': 'DEZEMBRO'
          };
          const monthName = monthMap[monthStr];
          if (monthName) {
            counts[monthName] = (counts[monthName] || 0) + 1;
          }
        }
      });
      setPostCounts(counts);
    };

    fetchPostCounts();
  }, [activeClient]);

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* North Star Section - Compact Version */}
      <div className="bg-gradient-to-r from-gray-900 to-brand-dark rounded-xl p-5 mb-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-4 -bottom-10 opacity-5 transform rotate-12 pointer-events-none">
          <Compass size={140} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
          {/* Left: Title */}
          <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 md:pr-6">
            <div className="flex items-center gap-2 mb-2">
              <Compass className="text-brand-green" size={18} />
              <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-brand-green">Estratégia Macro</h2>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight leading-tight">
              Planejamento Anual 2026
            </h1>
          </div>

          {/* Right: Content */}
          <div className="md:w-2/3">
            <p className="text-sm md:text-base text-gray-300 font-light leading-relaxed mb-4">
              Visão geral da estratégia de conteúdo para o ano, focada em construir autoridade e engajamento.
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-medium text-gray-400 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                <CheckCircle2 size={12} className="text-brand-green" />
                Foco em Resultados
              </div>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-medium text-gray-400 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                <CheckCircle2 size={12} className="text-brand-green" />
                Consistência
              </div>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-medium text-gray-400 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                <CheckCircle2 size={12} className="text-brand-green" />
                Multi-plataforma
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Distribution Analysis (Moved from separate tab) */}
      <DistributionAnalysis />

      {/* Quarters / Grid Grid */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-dark"></span>
          Calendário 2026
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {monthlyPlans.length === 0 && !loading ? (
            <div className="col-span-full py-12 text-center text-gray-500">
              Nenhum plano editorial encontrado para este cliente.
            </div>
          ) : (
            monthlyPlans.map((plan) => {
              const monthName = MONTH_NAMES[plan.month - 1];
              const postCount = postCounts[monthName.toUpperCase()] || 0;
              return (
                <MonthCard 
                  key={plan.id} 
                  data={{
                    month: monthName,
                    title: plan.theme || 'Sem tema definido',
                    color: 'blue', // Default color, you could map this based on month or add to DB
                    function: plan.objectives?.[0] || 'Objetivo não definido',
                    events: plan.key_dates?.map(d => ({ name: d, date: '' })) || [],
                    deliverables: plan.campaigns || [],
                    takeaways: plan.objectives?.slice(1) || []
                  }} 
                  onClick={() => onSelectMonth(monthName)}
                  postCount={postCount}
                />
              );
            })
          )}
        </div>
      </div>
      
      <div className="mt-12 text-center">
        <p className="text-gray-400 text-sm">
          Planejamento estratégico sujeito a adaptações táticas conforme feedback de mercado.
        </p>
      </div>
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { MonthCard } from './MonthCard';
import { DistributionAnalysis } from './DistributionAnalysis';
import { Compass, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth, supabase } from '../lib/supabase';
import { useEditorialData, MONTH_NAMES } from '../hooks/useEditorialData';
import { motion } from 'motion/react';

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-16"
    >
      
      {/* North Star Section - Compact Version */}
      <motion.div 
        variants={itemVariants}
        className="bg-brand-dark rounded-[3rem] p-10 md:p-16 text-white shadow-[0_30px_60px_rgba(0,0,0,0.12)] relative overflow-hidden"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 50%)' }}></div>
        <div className="absolute -right-20 -bottom-20 opacity-5 transform rotate-12 pointer-events-none">
          <Compass size={400} />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-16">
          {/* Left: Title */}
          <div className="lg:w-1/2 border-b lg:border-b-0 lg:border-r border-white/10 pb-12 lg:pb-0 lg:pr-16">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <Compass className="text-gray-400" size={18} />
              </div>
              <h2 className="text-[10px] font-bold tracking-[0.4em] uppercase text-gray-400">Estratégia Macro</h2>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[0.9] mb-8">
              Planejamento <br />
              <span className="serif italic font-normal text-gray-400">Anual 2026</span>
            </h1>
            
            <p className="text-gray-400 text-lg font-medium leading-relaxed max-w-md">
              Visão geral da estratégia de conteúdo para o ano, focada em construir autoridade e engajamento para a sua marca.
            </p>
          </div>

          {/* Right: Content */}
          <div className="lg:w-1/2 flex flex-col justify-center">
            <div className="grid grid-cols-1 gap-8">
              {[
                { label: 'Pilar 01', title: 'Foco em Resultados Reais', desc: 'Estratégias orientadas por dados e conversão.' },
                { label: 'Pilar 02', title: 'Consistência Estratégica', desc: 'Presença constante e alinhada com a marca.' },
                { label: 'Pilar 03', title: 'Presença Multi-plataforma', desc: 'Conteúdo adaptado para cada canal de impacto.' }
              ].map((pilar, idx) => (
                <div key={idx} className="flex items-start gap-6 group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all duration-500 border border-white/5">
                    <CheckCircle2 size={20} className="text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">{pilar.label}</p>
                    <p className="text-lg font-bold text-white">{pilar.title}</p>
                    <p className="text-sm text-gray-400 font-medium">{pilar.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Distribution Analysis */}
      <motion.div variants={itemVariants}>
        <DistributionAnalysis />
      </motion.div>

      {/* Quarters / Grid Grid */}
      <motion.div variants={itemVariants} className="space-y-10">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-brand-dark tracking-tight flex items-center gap-4">
              <span className="w-3 h-3 rounded-full bg-brand-dark shadow-[0_0_15px_rgba(0,0,0,0.1)]"></span>
              Calendário Editorial
            </h2>
            <p className="text-sm text-gray-400 font-medium ml-7">Explore o planejamento mensal detalhado da sua marca.</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-full bg-gray-50 border border-black/[0.02] text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
            <Sparkles size={12} /> Ciclo 2026
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {monthlyPlans.length === 0 && !loading ? (
            <div className="col-span-full py-20 text-center bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
              <p className="text-gray-400 font-medium">Nenhum plano editorial encontrado para este cliente.</p>
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
                    color: 'blue', 
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
      </motion.div>
      
      <motion.div variants={itemVariants} className="pt-10 pb-20 text-center border-t border-gray-50">
        <p className="text-gray-300 text-[11px] uppercase tracking-[0.3em] font-bold">
          Bolsa • Planejamento estratégico sujeito a adaptações táticas conforme feedback de mercado.
        </p>
      </motion.div>
    </motion.div>
  );
};

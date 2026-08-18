
import React, { useState, useEffect } from 'react';
import { MonthCard } from './MonthCard';
import { Compass, CheckCircle2, Sparkles, ArrowRight, FileText } from 'lucide-react';
import { useAuth, supabase } from '../lib/supabase';
import { useEditorialData, MONTH_NAMES } from '../hooks/useEditorialData';
import { getAnnualOverviewTemplate } from '../constants';
import { RejectedPostsModal } from './RejectedPostsModal';
import { motion } from 'motion/react';

interface AnnualOverviewProps {
  onSelectMonth: (month: string) => void;
}

const EditableText: React.FC<{
  value: string;
  onSave: (val: string) => void;
  isAdmin: boolean;
  className?: string;
  multiline?: boolean;
}> = ({ value, onSave, isAdmin, className = '', multiline = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  if (!isAdmin) return <span className={className}>{value}</span>;

  if (isEditing) {
    const InputComponent = multiline ? 'textarea' : 'input';
    return (
      <InputComponent
        autoFocus
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={() => {
          setIsEditing(false);
          if (tempValue !== value) onSave(tempValue);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !multiline) {
            setIsEditing(false);
            if (tempValue !== value) onSave(tempValue);
          }
          if (e.key === 'Escape') {
            setIsEditing(false);
            setTempValue(value);
          }
        }}
        className={`bg-white/10 text-white border border-white/20 rounded px-2 py-1 outline-none w-full ${className}`}
      />
    );
  }

  return (
    <span 
      onClick={() => setIsEditing(true)} 
      className={`cursor-pointer hover:bg-white/5 rounded px-1 -mx-1 transition-colors ${className}`}
    >
      {value || <span className="italic opacity-50">Clique para editar...</span>}
    </span>
  );
};

export const AnnualOverview: React.FC<AnnualOverviewProps> = ({ onSelectMonth }) => {
  const { activeClient, userRole, agencyId } = useAuth();
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const { monthlyPlans, loading } = useEditorialData();
  const [overview, setOverview] = useState<any>(null);
  const [showRejectedModal, setShowRejectedModal] = useState(false);
  const [rejectedPostsCount, setRejectedPostsCount] = useState(0);
  const isAdmin = userRole === 'admin';

  const fetchRejectedCount = async () => {
    if (!activeClient?.id) return;
    try {
      let query = supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', activeClient.id)
        .or('status.eq.rejected,status.eq.theme_rejected')
        .eq('is_deleted', true);

      if (agencyId) {
        query = query.eq('agency_id', agencyId);
      }

      const { count, error } = await query;
      if (!error && count !== null) {
        setRejectedPostsCount(count);
      }
    } catch (e) {
      console.error('Erro ao buscar contagem de reprovadas:', e);
    }
  };

  const fetchOverview = async () => {
    if (!activeClient) return;
    const { data, error } = await supabase
      .from('client_annual_overview')
      .select('*')
      .eq('client_id', activeClient.id)
      .eq('year', 2026)
      .single();

    if (error && error.code === 'PGRST116') {
      const template = getAnnualOverviewTemplate(activeClient.segment || '');
      const { data: newData } = await supabase
        .from('client_annual_overview')
        .upsert([{ client_id: activeClient.id, year: 2026, ...template }], { onConflict: 'client_id,year' })
        .select()
        .single();
      if (newData) setOverview(newData);
    } else if (data) {
      setOverview(data);
    }
  };

  const handleUpdateField = async (field: string, value: string) => {
    if (!overview || !isAdmin) return;
    const { error } = await supabase
      .from('client_annual_overview')
      .update({ [field]: value })
      .eq('id', overview.id);
    
    if (!error) {
      setOverview({ ...overview, [field]: value });
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchRejectedCount();
  }, [activeClient]);

  useEffect(() => {
    const fetchPostCounts = async () => {
      if (!activeClient) return;

      const { data, error } = await supabase
        .from('posts')
        .select('date_key, is_deleted, status')
        .eq('client_id', activeClient.id)
        .neq('status', 'deleted')
        .limit(10000);

      if (error) {
        console.error('Error fetching post counts:', error);
        return;
      }

      const counts: Record<string, number> = {};
      data.forEach((post: any) => {
        if (post.is_deleted) return;
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
        ease: [0.16, 1, 0.3, 1] as any
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
              <EditableText 
                value={overview?.title || 'Planejamento Anual 2026'} 
                onSave={(val) => handleUpdateField('title', val)} 
                isAdmin={isAdmin}
              />
            </h1>
            
            <p className="text-gray-400 text-lg font-medium leading-relaxed max-w-md">
              <EditableText 
                value={overview?.description || 'Visão geral da estratégia de conteúdo para o ano, focada em construir autoridade e engajamento para a sua marca.'} 
                onSave={(val) => handleUpdateField('description', val)} 
                isAdmin={isAdmin}
                multiline
              />
            </p>
          </div>

          {/* Right: Content */}
          <div className="lg:w-1/2 flex flex-col justify-center">
            <div className="grid grid-cols-1 gap-8">
              {[
                { label: 'Pilar 01', title: overview?.pillar1_title || 'Foco em Resultados Reais', desc: overview?.pillar1_description || 'Estratégias orientadas por dados e conversão.', fieldTitle: 'pillar1_title', fieldDesc: 'pillar1_description' },
                { label: 'Pilar 02', title: overview?.pillar2_title || 'Consistência Estratégica', desc: overview?.pillar2_description || 'Presença constante e alinhada com a marca.', fieldTitle: 'pillar2_title', fieldDesc: 'pillar2_description' },
                { label: 'Pilar 03', title: overview?.pillar3_title || 'Presença Multi-plataforma', desc: overview?.pillar3_description || 'Conteúdo adaptado para cada canal de impacto.', fieldTitle: 'pillar3_title', fieldDesc: 'pillar3_description' }
              ].map((pilar, idx) => (
                <div key={idx} className="flex items-start gap-6 group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all duration-500 border border-white/5">
                    <CheckCircle2 size={20} className="text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">{pilar.label}</p>
                    <p className="text-lg font-bold text-white">
                      <EditableText 
                        value={pilar.title} 
                        onSave={(val) => handleUpdateField(pilar.fieldTitle, val)} 
                        isAdmin={isAdmin}
                      />
                    </p>
                    <p className="text-sm text-gray-400 font-medium">
                      <EditableText 
                        value={pilar.desc} 
                        onSave={(val) => handleUpdateField(pilar.fieldDesc, val)} 
                        isAdmin={isAdmin}
                        multiline
                      />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quarters / Grid Grid */}
      <motion.div variants={itemVariants} className="space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-brand-dark tracking-tight flex items-center gap-4">
              <span className="w-3 h-3 rounded-full bg-brand-dark shadow-[0_0_15px_rgba(0,0,0,0.1)]"></span>
              Calendário Editorial
            </h2>
            <p className="text-sm text-gray-400 font-medium ml-7">Explore o planejamento mensal detalhado da sua marca.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRejectedModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200/80 text-xs font-bold text-stone-700 shadow-2xs transition-all hover:border-stone-300 active:scale-95"
              title="Ver histórico de publicações reprovadas pelo cliente"
            >
              <span>📋</span> Ver publicações reprovadas ({rejectedPostsCount})
            </button>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-50 border border-black/[0.02] text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
              <Sparkles size={12} /> Ciclo 2026
            </div>
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
              
              const hasTheme = !!plan.theme && plan.theme.trim() !== '';
              const isConfigured = hasTheme;
              
              const isLocked = !isAdmin && !isConfigured;

              return (
                <div key={plan.id} className="relative h-full">
                  {isAdmin && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const nextState = !plan.is_released;
                        await supabase
                          .from('client_monthly_plans')
                          .update({ is_released: nextState })
                          .eq('id', plan.id);
                        window.location.reload(); // Refresh to update view
                      }}
                      className={`absolute -top-3 -right-3 z-30 p-2 rounded-full shadow-lg transition-all border flex items-center gap-2 group ${
                        plan.is_released 
                          ? 'bg-green-600 border-green-500 text-white hover:bg-green-700' 
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      {plan.is_released ? (
                        <>
                          <CheckCircle2 size={12} />
                          <span className="text-[9px] font-bold uppercase tracking-widest overflow-hidden max-w-0 group-hover:max-w-[100px] transition-all">Liberado</span>
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          <span className="text-[9px] font-bold uppercase tracking-widest overflow-hidden max-w-0 group-hover:max-w-[100px] transition-all">Oculto</span>
                        </>
                      )}
                    </button>
                  )}
                  <MonthCard 
                    data={{
                      month: monthName,
                      title: plan.theme || 'Sem tema definido',
                      color: 'blue', 
                      function: ''
                    }} 
                    onClick={() => (!isLocked || isAdmin) && onSelectMonth(monthName)}
                    postCount={postCount}
                    isLocked={!isAdmin && !plan.is_released}
                  />
                </div>
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

      {showRejectedModal && activeClient && (
        <RejectedPostsModal
          clientId={activeClient.id}
          agencyId={agencyId}
          isOpen={showRejectedModal}
          onClose={() => {
            setShowRejectedModal(false);
            fetchRejectedCount();
          }}
        />
      )}
    </motion.div>
  );
};

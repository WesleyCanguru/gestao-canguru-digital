import React from 'react';
import { Target, ArrowRight, Sparkles, DollarSign, PhoneCall, Users, PenLine } from 'lucide-react';
import { useAgencyGoals } from '../../hooks/useAgencyGoals';

interface GoalsWidgetProps {
  onNavigateToMetas: () => void;
}

export const GoalsWidget: React.FC<GoalsWidgetProps> = ({ onNavigateToMetas }) => {
  const {
    monthLabel,
    hasGoalConfigured,
    goal,
    faturamentoRecebido,
    newClientsCount,
    meetingsCount,
    blogPostsCount,
    blogPostsGoal,
    pctFaturamento,
    pctNovosClientes,
    pctReunioes,
    pctBlogPosts,
    coachingMessage,
    loading
  } = useAgencyGoals();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (loading && !goal) {
    return (
      <div className="bg-white p-6 sm:p-7 rounded-[2.5rem] border border-black/[0.03] shadow-2xs animate-pulse">
        <div className="h-6 bg-stone-200 rounded w-1/4 mb-4" />
        <div className="h-16 bg-stone-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 sm:p-7 rounded-[2.5rem] border border-black/[0.03] shadow-2xs space-y-5">
      {/* Header do Widget */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-dark/5 flex items-center justify-center text-brand-dark">
            <Target size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-brand-dark flex items-center gap-2">
              <span>Metas do Mês</span>
              <span className="text-xs font-semibold text-stone-400 capitalize">
                • {monthLabel}
              </span>
            </h3>
          </div>
        </div>

        <button
          onClick={onNavigateToMetas}
          className="inline-flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-brand-dark transition-colors group cursor-pointer"
        >
          <span>Ver Metas</span>
          <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {!hasGoalConfigured ? (
        <div className="bg-stone-50/70 border border-stone-200/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-800">
                Metas de {monthLabel} ainda não foram configuradas
              </p>
              <p className="text-[11px] text-stone-500 font-medium">
                Defina faturamento, clientes, reuniões e publicações para acompanhar o ritmo da agência.
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToMetas}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-dark text-white rounded-xl text-xs font-bold hover:bg-brand-dark/90 transition-all self-start sm:self-auto shrink-0 cursor-pointer shadow-2xs"
          >
            <span>Configurar metas →</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Métricas Principais em Linha */}
          <div className={`grid grid-cols-1 ${blogPostsGoal > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3.5`}>
            {/* Faturamento */}
            <div className="bg-stone-50/60 border border-stone-200/60 p-3.5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-600 flex items-center gap-1.5">
                  <DollarSign size={13} className="text-emerald-600" />
                  <span>Faturamento</span>
                </span>
                <span className="font-bold text-stone-800">{pctFaturamento}%</span>
              </div>
              <div className="w-full h-2 bg-stone-200/70 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${pctFaturamento >= 100 ? 'bg-emerald-500' : 'bg-brand-dark'}`}
                  style={{ width: `${Math.min(100, pctFaturamento)}%` }}
                />
              </div>
              <p className="text-[11px] font-semibold text-stone-500 truncate">
                {formatCurrency(faturamentoRecebido)} / {formatCurrency(goal?.revenue_goal || 0)}
              </p>
            </div>

            {/* Reuniões */}
            <div className="bg-stone-50/60 border border-stone-200/60 p-3.5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-600 flex items-center gap-1.5">
                  <PhoneCall size={13} className="text-blue-600" />
                  <span>Reuniões</span>
                </span>
                <span className="font-bold text-stone-800">{pctReunioes}%</span>
              </div>
              <div className="w-full h-2 bg-stone-200/70 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, pctReunioes)}%` }}
                />
              </div>
              <p className="text-[11px] font-semibold text-stone-500 truncate">
                {meetingsCount} / {goal?.meetings_goal || 0} reuniões
              </p>
            </div>

            {/* Posts no Blog (Condicional: se blogPostsGoal > 0) */}
            {blogPostsGoal > 0 && (
              <div className="bg-stone-50/60 border border-stone-200/60 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-600 flex items-center gap-1.5">
                    <PenLine size={13} className="text-amber-600" />
                    <span>Posts no Blog</span>
                  </span>
                  <span className="font-bold text-stone-800">{pctBlogPosts}%</span>
                </div>
                <div className="w-full h-2 bg-stone-200/70 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, pctBlogPosts)}%` }}
                  />
                </div>
                <p className="text-[11px] font-semibold text-stone-500 truncate">
                  {blogPostsCount} / {blogPostsGoal} posts
                </p>
              </div>
            )}
          </div>

          {/* Mensagem de Coaching Compacta */}
          <div className="bg-stone-900 text-white px-4 py-2.5 rounded-2xl flex items-center gap-2.5">
            <Sparkles size={15} className="text-amber-300 shrink-0" />
            <p className="text-xs font-medium text-stone-200 italic truncate">
              "{coachingMessage}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, Clock, Check, Sparkles } from 'lucide-react';
import { useClientOnboarding, OnboardingPhase } from '../hooks/useClientOnboarding';
import { useAuth } from '../lib/supabase';

const PHASE_LABELS: Record<OnboardingPhase, string> = {
  universal: 'Etapas Universais',
  social_media: 'Social Media',
  traffic: 'Tráfego Pago',
  site: 'Site',
  identity: 'Identidade Visual',
  stationery: 'Papelaria',
  email_marketing: 'Email Marketing',
  final: 'Etapas Finais'
};

export const ClientOnboarding: React.FC = () => {
  const { userRole } = useAuth();
  const { onboarding, loading, toggleStep, progress, isCompleted } = useClientOnboarding();

  if (userRole !== 'admin') return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-dark"></div>
      </div>
    );
  }

  if (!onboarding) return null;

  const completedCount = onboarding.steps.filter(s => s.completed).length;
  const totalCount = onboarding.steps.length;

  // Group steps by phase
  const groupedSteps = onboarding.steps.reduce((acc, step) => {
    if (!acc[step.phase]) acc[step.phase] = [];
    acc[step.phase].push(step);
    return acc;
  }, {} as Record<OnboardingPhase, typeof onboarding.steps>);

  // Ensure 'universal' is first, 'final' is last, others in between
  const phaseOrder: OnboardingPhase[] = [
    'universal',
    'social_media',
    'traffic',
    'site',
    'identity',
    'stationery',
    'email_marketing',
    'final'
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h2 className="text-3xl font-serif font-medium text-brand-dark mb-2">Checklist de Onboarding</h2>
        <p className="text-gray-500 text-sm">Acompanhe o progresso de entrada do cliente na agência. Visível apenas para administradores.</p>
      </div>

      {isCompleted && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-8 flex items-center gap-4 shadow-sm"
        >
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
            <Sparkles className="text-green-600" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-green-900">🎉 Onboarding Concluído!</h3>
            <p className="text-green-700 text-sm mt-1">
              Todas as etapas foram finalizadas em {new Date(onboarding.completed_at!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
            </p>
          </div>
        </motion.div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-black/[0.03] overflow-hidden mb-8">
        <div className="p-6 sm:p-8 border-b border-black/[0.03] bg-gray-50/50">
          <div className="flex justify-between items-end mb-4">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Progresso Geral</span>
              <div className="text-2xl font-bold text-brand-dark">
                {completedCount} <span className="text-gray-400 text-lg font-normal">de {totalCount} etapas concluídas</span>
              </div>
            </div>
            <div className="text-3xl font-serif italic text-brand-dark">{progress}%</div>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-brand-dark rounded-full"
            />
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-10">
          {phaseOrder.map(phase => {
            const stepsInPhase = groupedSteps[phase];
            if (!stepsInPhase || stepsInPhase.length === 0) return null;

            const phaseCompletedCount = stepsInPhase.filter(s => s.completed).length;
            const phaseTotalCount = stepsInPhase.length;
            const isPhaseCompleted = phaseCompletedCount === phaseTotalCount;

            return (
              <div key={phase} className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    {PHASE_LABELS[phase]}
                    {isPhaseCompleted && <CheckCircle2 size={16} className="text-green-500" />}
                  </h3>
                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
                    {phaseCompletedCount}/{phaseTotalCount}
                  </span>
                </div>

                <div className="space-y-3">
                  {stepsInPhase.map((step) => (
                    <motion.div
                      key={step.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => toggleStep(step.id)}
                      className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                        step.completed 
                          ? 'bg-gray-50 border-gray-200 opacity-60' 
                          : 'bg-white border-gray-200 hover:border-brand-dark hover:shadow-md'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {step.completed ? (
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-transparent hover:border-brand-dark transition-colors">
                            <Circle size={14} />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-grow">
                        <p className={`text-sm font-medium transition-all ${step.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {step.title}
                        </p>
                        {step.completed && step.completed_at && (
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400 font-medium">
                            <Clock size={10} />
                            Concluído em {new Date(step.completed_at).toLocaleString('pt-BR', { 
                              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { CheckCircle, Circle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { BriefingOnboarding } from './BriefingOnboarding';

interface OnboardingPhase {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  order_index: number;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
}

interface OnboardingStep {
  id: string;
  phase_id: string;
  client_id: string;
  name: string;
  description: string | null;
  order_index: number;
  status: 'pending' | 'in_progress' | 'completed';
  is_required: boolean;
  notes: string | null;
  tutorial_url: string | null;
  completed_at: string | null;
  created_at: string;
}

interface OnboardingViewProps {
  onComplete?: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const { activeClient, userRole } = useAuth();
  const [phases, setPhases] = useState<OnboardingPhase[]>([]);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchData = async () => {
    if (!activeClient) return;
    setLoading(true);
    const { data: phasesData } = await supabase
      .from('onboarding_phases')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('order_index');
    const { data: stepsData } = await supabase
      .from('onboarding_steps')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('order_index');
    if (phasesData) {
      setPhases(phasesData);
      setExpandedPhases(new Set(phasesData.map((p: OnboardingPhase) => p.id)));
    }
    if (stepsData) setSteps(stepsData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [activeClient]);

  const toggleStep = async (step: OnboardingStep) => {
    if (userRole !== 'admin') return;
    setUpdating(step.id);
    const newStatus = step.status === 'completed' ? 'pending' : 'completed';
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;
    await supabase
      .from('onboarding_steps')
      .update({ status: newStatus, completed_at: completedAt })
      .eq('id', step.id);
    const phaseSteps = steps.filter(s => s.phase_id === step.phase_id);
    const updatedSteps = phaseSteps.map(s => s.id === step.id ? { ...s, status: newStatus } : s);
    const allCompleted = updatedSteps.every(s => s.status === 'completed');
    const anyProgress = updatedSteps.some(s => s.status !== 'pending');
    const phaseStatus = allCompleted ? 'completed' : anyProgress ? 'in_progress' : 'pending';
    await supabase
      .from('onboarding_phases')
      .update({ status: phaseStatus })
      .eq('id', step.phase_id);
    await fetchData();
    setUpdating(null);
  };

  const totalRequired = steps.filter(s => s.is_required).length;
  const completedRequired = steps.filter(s => s.is_required && s.status === 'completed').length;
  const progressPercent = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;

  if (userRole === 'approver' && activeClient && !activeClient.onboarding_completed) {
    return <BriefingOnboarding onComplete={onComplete || (() => {})} />;
  }

  if (loading) return <div className="text-center text-gray-400 py-12">Carregando...</div>;

  if (phases.length === 0) return (
    <div className="text-center text-gray-400 py-12">Nenhuma estrutura de onboarding encontrada para este cliente.</div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Onboarding</h1>
        <p className="text-sm text-gray-500 mb-4">{activeClient?.name}</p>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Progresso Geral</span>
            <span className="text-sm font-bold text-blue-600">{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">{completedRequired} de {totalRequired} etapas obrigatórias concluídas</p>
        </div>
      </div>

      <div className="space-y-4">
        {phases.map((phase) => {
          const phaseSteps = steps.filter(s => s.phase_id === phase.id);
          const phaseCompleted = phaseSteps.filter(s => s.status === 'completed').length;
          const isExpanded = expandedPhases.has(phase.id);
          const statusColor = { completed: 'bg-green-100 text-green-700', in_progress: 'bg-blue-100 text-blue-700', pending: 'bg-gray-100 text-gray-500' }[phase.status];
          const statusLabel = { completed: 'Concluído', in_progress: 'Em andamento', pending: 'Pendente' }[phase.status];

          return (
            <div key={phase.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                onClick={() => {
                  const next = new Set(expandedPhases);
                  if (next.has(phase.id)) next.delete(phase.id); else next.add(phase.id);
                  setExpandedPhases(next);
                }}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${phase.status === 'completed' ? 'bg-green-500' : phase.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{phase.name}</p>
                  {phase.description && <p className="text-xs text-gray-400 mt-0.5">{phase.description}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor}`}>
                  {phaseCompleted}/{phaseSteps.length} · {statusLabel}
                </span>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
              </button>

              {isExpanded && phaseSteps.length > 0 && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {phaseSteps.map((step) => (
                    <div key={step.id} className="flex items-start gap-3 px-4 py-3">
                      <button
                        onClick={() => toggleStep(step)}
                        disabled={userRole !== 'admin' || updating === step.id}
                        className="mt-0.5 flex-shrink-0 disabled:cursor-default"
                      >
                        {step.status === 'completed' ? (
                          <CheckCircle size={20} className="text-green-500" />
                        ) : step.status === 'in_progress' ? (
                          <Clock size={20} className="text-blue-400" />
                        ) : (
                          <Circle size={20} className="text-gray-300" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${step.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {step.name}
                          {step.is_required && <span className="ml-1 text-red-400 text-xs">*</span>}
                        </p>
                        {step.description && <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>}
                        {step.tutorial_url && (
                          <a href={step.tutorial_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                            Ver tutorial →
                          </a>
                        )}
                        {step.completed_at && (
                          <p className="text-xs text-green-500 mt-0.5">
                            Concluído em {new Date(step.completed_at).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {userRole === 'admin' && (
        <p className="text-xs text-gray-400 text-center mt-6">Clique nos ícones para marcar/desmarcar etapas como concluídas.</p>
      )}
    </div>
  );
};

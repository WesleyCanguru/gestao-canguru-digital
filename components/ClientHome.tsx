import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import {
  CheckCircle,
  Circle,
  ClipboardList,
  Map,
  ArrowRight,
  Zap,
  TrendingUp,
  Calendar,
  Target,
  AlertCircle,
  FolderOpen,
  Globe
} from 'lucide-react';

interface OnboardingPhase {
  id: string;
  name: string;
  order_number: number;
  status: 'completed' | 'in_progress' | 'pending';
}

interface OnboardingStep {
  id: string;
  phase_id: string;
  is_required: boolean;
  status: 'completed' | 'pending' | 'in_progress';
  title: string;
}

interface ClientHomeProps {
  onNavigateToOnboarding: () => void;
  onNavigateToMapa: () => void;
  onNavigateToBriefings: () => void;
  onNavigateToDocuments: () => void;
  onNavigateToPaidTraffic: () => void;
  onNavigateToWebsite: () => void;
}

export const ClientHome: React.FC<ClientHomeProps> = ({
  onNavigateToOnboarding,
  onNavigateToMapa,
  onNavigateToBriefings,
  onNavigateToDocuments,
  onNavigateToPaidTraffic,
  onNavigateToWebsite,
}) => {
  const { activeClient } = useAuth();
  const [phases, setPhases] = useState<OnboardingPhase[]>([]);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeClient?.id) {
      fetchData();
    }
  }, [activeClient]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: phasesData }, { data: stepsData }] = await Promise.all([
        supabase
          .from('onboarding_phases')
          .select('*')
          .eq('client_id', activeClient!.id)
          .order('order_number'),
        supabase
          .from('onboarding_steps')
          .select('*')
          .eq('client_id', activeClient!.id),
      ]);
      setPhases(phasesData || []);
      setSteps(stepsData || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const requiredSteps = steps.filter((s) => s.is_required);
  const completedRequired = requiredSteps.filter((s) => s.status === 'completed');
  const progressPct =
    requiredSteps.length > 0
      ? Math.round((completedRequired.length / requiredSteps.length) * 100)
      : 0;

  const currentPhase =
    phases.find((p) => p.status === 'in_progress') ||
    phases.find((p) => p.status === 'pending');

  const nextStep = steps.find(
    (s) => s.phase_id === currentPhase?.id && s.status !== 'completed'
  );

  const isOnboardingComplete = progressPct === 100 && phases.length > 0;

  const today = new Date();
  const dateStr = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const capitalizedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-brand-dark to-blue-700 rounded-xl p-6 text-white shadow-lg">
        <p className="text-blue-200 text-sm font-medium uppercase tracking-wider mb-1">
          {capitalizedDate}
        </p>
        <h1 className="text-2xl font-bold mb-1">
          Olá, {activeClient?.name?.split(' ')[0] || 'Cliente'}! 👋
        </h1>
        <p className="text-blue-100 text-sm">
          {isOnboardingComplete
            ? 'Seu onboarding está completo. Explore o calendário editorial!'
            : 'Veja o progresso do seu onboarding e próximas etapas abaixo.'}
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Onboarding Progress Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-600" />
              <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wider">
                Onboarding
              </h2>
            </div>
            {isOnboardingComplete && (
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Completo ✓
              </span>
            )}
          </div>

          {loading ? (
            <div className="animate-pulse space-y-3 flex-grow">
              <div className="h-3 bg-gray-100 rounded w-3/4"></div>
              <div className="h-2 bg-gray-100 rounded"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500">
                    {completedRequired.length} de {requiredSteps.length} etapas obrigatórias
                  </span>
                  <span className="text-lg font-bold text-blue-600">{progressPct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Phases list */}
              <div className="space-y-2 mb-4 flex-grow">
                {phases.slice(0, 5).map((phase) => (
                  <div key={phase.id} className="flex items-center gap-2 text-xs">
                    {phase.status === 'completed' ? (
                      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                    ) : phase.status === 'in_progress' ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0" />
                    ) : (
                      <Circle size={14} className="text-gray-300 flex-shrink-0" />
                    )}
                    <span
                      className={
                        phase.status === 'completed'
                          ? 'text-gray-400 line-through'
                          : phase.status === 'in_progress'
                          ? 'text-blue-700 font-semibold'
                          : 'text-gray-400'
                      }
                    >
                      {phase.name}
                    </span>
                  </div>
                ))}
                {phases.length > 5 && (
                  <p className="text-xs text-gray-400 pl-5">+{phases.length - 5} fases</p>
                )}
              </div>

              {/* Next step highlight */}
              {nextStep && !isOnboardingComplete && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-0.5">
                    Próxima etapa
                  </p>
                  <p className="text-sm font-medium text-blue-800">{nextStep.title}</p>
                </div>
              )}

              <button
                onClick={onNavigateToOnboarding}
                className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
              >
                <span>Ver Onboarding Completo</span>
                <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>

        {/* Mapa Editorial Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Map size={18} className="text-purple-600" />
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wider">
              Mapa Editorial
            </h2>
          </div>

          <div className="space-y-3 mb-6 flex-grow">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar size={16} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Calendário 2026</p>
                <p className="text-xs text-gray-500">Visão anual de todos os conteúdos</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp size={16} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Status dos Posts</p>
                <p className="text-xs text-gray-500">Acompanhe produção e aprovações</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Target size={16} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Planejamento Mensal</p>
                <p className="text-xs text-gray-500">Detalhes e metas de cada mês</p>
              </div>
            </div>
          </div>

          <button
            onClick={onNavigateToMapa}
            className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
          >
            <span>Ver Mapa Completo</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-amber-500" />
          <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wider">
            Ações Rápidas
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <button
            onClick={onNavigateToOnboarding}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors text-center"
          >
            <ClipboardList size={22} />
            <span className="text-xs font-semibold leading-tight">Onboarding</span>
          </button>
          <button
            onClick={onNavigateToMapa}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors text-center"
          >
            <Map size={22} />
            <span className="text-xs font-semibold leading-tight">Mapa Editorial</span>
          </button>
          <button
            onClick={onNavigateToBriefings}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 transition-colors text-center"
          >
            <AlertCircle size={22} />
            <span className="text-xs font-semibold leading-tight">Briefings</span>
          </button>
          <button
            onClick={onNavigateToDocuments}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors text-center"
          >
            <FolderOpen size={22} />
            <span className="text-xs font-semibold leading-tight">Documentos</span>
          </button>
          <button
            onClick={onNavigateToPaidTraffic}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors text-center"
          >
            <TrendingUp size={22} />
            <span className="text-xs font-semibold leading-tight">Tráfego Pago</span>
          </button>
          <button
            onClick={onNavigateToWebsite}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors text-center"
          >
            <Globe size={22} />
            <span className="text-xs font-semibold leading-tight">Website</span>
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-3">Mais funcionalidades em breve</p>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';

export type OnboardingPhase = 
  | 'universal' 
  | 'social_media' 
  | 'traffic' 
  | 'site' 
  | 'identity' 
  | 'stationery' 
  | 'email_marketing' 
  | 'final';

export interface OnboardingStep {
  id: string;
  phase: OnboardingPhase;
  title: string;
  order: number;
  completed: boolean;
  completed_at: string | null;
}

export interface ClientOnboarding {
  client_id: string;
  steps: OnboardingStep[];
  is_completed: boolean;
  completed_at: string | null;
}

export const generateOnboardingSteps = (services: string[]): OnboardingStep[] => {
  let order = 1;
  const steps: OnboardingStep[] = [];
  const addStep = (phase: OnboardingPhase, title: string) => {
    steps.push({
      id: `${phase}-${order}`,
      phase,
      title,
      order: order++,
      completed: false,
      completed_at: null
    });
  };

  // Universal
  addStep('universal', 'Validar handover do time comercial');
  addStep('universal', 'Definir responsáveis e datas no sistema');
  addStep('universal', 'Criar grupo WhatsApp e adicionar equipe');
  addStep('universal', 'Enviar mensagem de boas-vindas + apresentação de onboarding');
  addStep('universal', 'Enviar e validar preenchimento do briefing');
  addStep('universal', 'Realizar call de kick-off');

  // Social Media
  if (services.includes('Social Media')) {
    addStep('social_media', 'Solicitar acessos às redes sociais');
    addStep('social_media', 'Criar calendário editorial do primeiro mês');
    addStep('social_media', 'Enviar calendário para aprovação do cliente');
    addStep('social_media', 'Realizar primeiras publicações');
  }

  // Tráfego Pago
  if (services.includes('Tráfego Pago') || services.includes('Tráfego')) {
    addStep('traffic', 'Realizar call de acessos (BM, Google Ads, etc.)');
    addStep('traffic', 'Criar plano de campanhas');
    addStep('traffic', 'Setup técnico: GTM, GA4, Meta Ads, Google Ads, Clarity');
    addStep('traffic', 'Subir campanhas (go live)');
    addStep('traffic', 'Configurar controles internos e planilhas');
  }

  // Site
  if (services.includes('Site') || services.includes('Website')) {
    addStep('site', 'Coletar briefing de site (referências, páginas, domínio)');
    addStep('site', 'Obter acesso ao domínio e hospedagem');
    addStep('site', 'Enviar proposta de layout/wireframe para aprovação');
    addStep('site', 'Publicar site');
  }

  // Identidade Visual
  if (services.includes('Identidade Visual')) {
    addStep('identity', 'Coletar briefing de marca (referências, cores, valores)');
    addStep('identity', 'Enviar proposta de identidade visual para aprovação');
    addStep('identity', 'Entregar arquivos finais da identidade');
  }

  // Papelaria
  if (services.includes('Papelaria')) {
    addStep('stationery', 'Definir peças necessárias (cartão, papel timbrado, etc.)');
    addStep('stationery', 'Enviar layouts para aprovação');
    addStep('stationery', 'Entregar arquivos para impressão');
  }

  // Email Marketing
  if (services.includes('Email Marketing')) {
    addStep('email_marketing', 'Obter acesso à plataforma (RD Station, Mailchimp, etc.)');
    addStep('email_marketing', 'Configurar conta e domínio de envio');
    addStep('email_marketing', 'Criar lista de contatos e realizar primeiro disparo');
  }

  // Final
  addStep('final', 'Realizar pesquisa de NPS');
  addStep('final', 'Encerrar onboarding');

  return steps;
};

export const useClientOnboarding = () => {
  const { activeClient, userRole } = useAuth();
  const [onboarding, setOnboarding] = useState<ClientOnboarding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOnboarding = async () => {
      if (!activeClient || userRole !== 'admin') {
        setOnboarding(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('client_onboarding')
          .select('*')
          .eq('client_id', activeClient.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setOnboarding(data as ClientOnboarding);
        } else {
          // Create automatically if it doesn't exist
          const steps = generateOnboardingSteps(activeClient.services || []);
          const newOnboarding = {
            client_id: activeClient.id,
            steps,
            is_completed: false,
            completed_at: null
          };

          const { data: insertedData, error: insertError } = await supabase
            .from('client_onboarding')
            .insert(newOnboarding)
            .select()
            .single();

          if (insertError) throw insertError;
          setOnboarding(insertedData as ClientOnboarding);
        }
      } catch (error) {
        console.error('Error fetching/creating onboarding:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOnboarding();
  }, [activeClient, userRole]);

  const toggleStep = async (stepId: string) => {
    if (!onboarding || userRole !== 'admin') return;

    const newSteps = onboarding.steps.map(step => {
      if (step.id === stepId) {
        const isNowCompleted = !step.completed;
        return {
          ...step,
          completed: isNowCompleted,
          completed_at: isNowCompleted ? new Date().toISOString() : null
        };
      }
      return step;
    });

    const allCompleted = newSteps.every(step => step.completed);
    const completedAt = allCompleted ? new Date().toISOString() : null;

    const updatedOnboarding = {
      ...onboarding,
      steps: newSteps,
      is_completed: allCompleted,
      completed_at: completedAt
    };

    // Optimistic update
    setOnboarding(updatedOnboarding);

    try {
      const { error } = await supabase
        .from('client_onboarding')
        .update({
          steps: newSteps,
          is_completed: allCompleted,
          completed_at: completedAt
        })
        .eq('client_id', onboarding.client_id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating onboarding step:', error);
      // Revert on error (optional, but good practice)
      // In a real app we might want to refetch or show an error toast
    }
  };

  const progress = onboarding 
    ? Math.round((onboarding.steps.filter(s => s.completed).length / onboarding.steps.length) * 100)
    : 0;

  return {
    onboarding,
    loading,
    toggleStep,
    progress,
    isCompleted: onboarding?.is_completed || false
  };
};

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface OnboardingStats {
  total: number;
  completed: number;
  currentPhaseName: string | null;
}

export const useClientOnboarding = (clientId?: string) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [stats, setStats] = useState<OnboardingStats>({ total: 0, completed: 0, currentPhaseName: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    const checkCompletion = async () => {
      if (!clientId || clientId === 'undefined' || clientId === 'null') {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('onboarding_checklist')
          .select('is_completed, phase_name, phase')
          .is('parent_id', null)
          .eq('client_id', clientId)
          .order('phase', { ascending: true });

        if (error) {
          console.warn('Onboarding check query error:', error.message);
          setIsCompleted(false);
          setStats({ total: 0, completed: 0, currentPhaseName: null });
          return;
        }

        if (data && data.length > 0) {
          const total = data.length;
          const completed = data.filter(item => item.is_completed).length;
          const allCompleted = total === completed && total > 0;
          setIsCompleted(allCompleted);

          let currentPhaseName = null;
          if (!allCompleted) {
            const firstIncomplete = data.find(item => !item.is_completed);
            if (firstIncomplete) currentPhaseName = firstIncomplete.phase_name;
          }

          setStats({ total, completed, currentPhaseName });
        } else {
          setIsCompleted(false);
          setStats({ total: 0, completed: 0, currentPhaseName: null });
        }
      } catch (err) {
        console.error('Error checking onboarding completion:', err);
        setIsCompleted(false);
        setStats({ total: 0, completed: 0, currentPhaseName: null });
      } finally {
        setLoading(false);
      }
    };

    checkCompletion();

    // Subscribe to changes
    const channel = supabase
      .channel(`onboarding_check_${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_checklist',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          checkCompletion();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  return { isCompleted, loading, stats };
};

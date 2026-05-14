import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useClientOnboarding = (clientId?: string) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    const checkCompletion = async () => {
      try {
        const { data, error } = await supabase
          .from('onboarding_checklist')
          .select('is_completed')
          .eq('client_id', clientId);

        if (error) throw error;

        if (data && data.length > 0) {
          const allCompleted = data.every(item => item.is_completed);
          setIsCompleted(allCompleted);
        } else {
          setIsCompleted(false);
        }
      } catch (err) {
        console.error('Error checking onboarding completion:', err);
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

  return { isCompleted, loading };
};

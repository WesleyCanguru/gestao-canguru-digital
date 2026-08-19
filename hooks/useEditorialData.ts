import { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';

export interface MonthlyPlan {
  id: string;
  client_id: string;
  month: number;
  year: number;
  theme: string | null;
  objectives: string[];
  key_dates: string[];
  campaigns: string[];
  is_released?: boolean;
}

export interface WeeklyScheduleItem {
  id: string;
  client_id: string;
  day_of_week: number;
  platform: string;
  content_type: string | null;
  theme: string | null;
  description: string | null;
}

// Nomes dos meses em português para exibição
export const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

export const DAY_NAMES = ['','Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];

export function useEditorialData(overrideClientId?: string) {
  const { activeClient } = useAuth();
  const targetClientId = overrideClientId || activeClient?.id;
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!targetClientId) {
      setMonthlyPlans([]);
      setWeeklySchedule([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const startMonth = 1;

    const [plansRes, schedRes] = await Promise.all([
      supabase
        .from('client_monthly_plans')
        .select('*')
        .eq('client_id', targetClientId)
        .eq('year', 2026)
        .gte('month', startMonth)
        .order('month'),
      supabase
        .from('client_weekly_schedules')
        .select('*')
        .eq('client_id', targetClientId)
        .order('day_of_week')
    ]);
    if (plansRes.data) setMonthlyPlans(plansRes.data as MonthlyPlan[]);
    if (schedRes.data) setWeeklySchedule(schedRes.data as WeeklyScheduleItem[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [targetClientId]);

  const updateMonthlyPlan = async (planId: string, updates: Partial<MonthlyPlan>) => {
    const { error } = await supabase
      .from('client_monthly_plans')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', planId);
    if (!error) fetchData();
    return !error;
  };

  return { monthlyPlans, weeklySchedule, loading, refetch: fetchData, updateMonthlyPlan };
}

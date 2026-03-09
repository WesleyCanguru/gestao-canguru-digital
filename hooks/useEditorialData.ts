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

export function useEditorialData() {
  const { activeClient } = useAuth();
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!activeClient?.id) {
      setMonthlyPlans([]);
      setWeeklySchedule([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [plansRes, schedRes] = await Promise.all([
      supabase
        .from('client_monthly_plans')
        .select('*')
        .eq('client_id', activeClient.id)
        .eq('year', 2026)
        .order('month'),
      supabase
        .from('client_weekly_schedules')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('day_of_week')
    ]);
    if (plansRes.data) setMonthlyPlans(plansRes.data as MonthlyPlan[]);
    if (schedRes.data) setWeeklySchedule(schedRes.data as WeeklyScheduleItem[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [activeClient?.id]);

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

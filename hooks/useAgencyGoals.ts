import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { AgencyGoal, AgencyCommercialAction, CommercialActionType } from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

export const MONTH_NAMES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export interface UseAgencyGoalsReturn {
  monthYear: string;
  monthLabel: string;
  isCurrentMonth: boolean;
  isPastMonth: boolean;
  isFutureMonth: boolean;
  loading: boolean;
  goal: AgencyGoal | null;
  hasGoalConfigured: boolean;
  
  // Real values
  faturamentoRecebido: number;
  faturamentoEstaSemana: number;
  newClientsCount: number;
  meetingsCount: number;
  postsCount: number;

  // Commercial Actions list
  commercialActions: AgencyCommercialAction[];

  // Progress calculations
  pctFaturamento: number;
  pctNovosClientes: number;
  pctReunioes: number;
  pctPublicacoes: number;

  // Pace metrics
  weeklyGoal: number;
  semanaAtual: number;
  receitaEsperadaAteAgora: number;
  isPaceOnTrack: boolean;
  faltamFaturamento: number;
  superouFaturamento: number;

  // Coaching
  coachingMessage: string;

  // Actions
  setMonthYear: (my: string) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  goToCurrentMonth: () => void;
  saveGoal: (goalData: {
    revenue_goal: number;
    new_clients_goal: number;
    meetings_goal: number;
    posts_goal: number;
    notes?: string | null;
  }) => Promise<void>;
  addCommercialAction: (actionData: {
    action_date: string;
    action_type: CommercialActionType;
    contact_name: string;
    result: string;
    notes?: string | null;
  }) => Promise<void>;
  deleteCommercialAction: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAgencyGoals(initialMonthYear?: string): UseAgencyGoalsReturn {
  const { agencyId } = useAuth();
  const [monthYear, setMonthYear] = useState<string>(
    initialMonthYear || dayjs().format('YYYY-MM')
  );

  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<AgencyGoal | null>(null);
  const [faturamentoRecebido, setFaturamentoRecebido] = useState(0);
  const [faturamentoEstaSemana, setFaturamentoEstaSemana] = useState(0);
  const [newClientsCount, setNewClientsCount] = useState(0);
  const [meetingsCount, setMeetingsCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [commercialActions, setCommercialActions] = useState<AgencyCommercialAction[]>([]);

  const currentMonthYear = dayjs().format('YYYY-MM');
  const isCurrentMonth = monthYear === currentMonthYear;
  const isPastMonth = monthYear < currentMonthYear;
  const isFutureMonth = monthYear > currentMonthYear;

  const monthDate = useMemo(() => dayjs(monthYear, 'YYYY-MM'), [monthYear]);
  const monthLabel = useMemo(() => {
    const m = monthDate.month();
    const y = monthDate.year();
    return `${MONTH_NAMES_FULL[m]} ${y}`;
  }, [monthDate]);

  const fetchData = useCallback(async () => {
    if (!agencyId) return;
    try {
      setLoading(true);

      const startOfMonthStr = monthDate.startOf('month').format('YYYY-MM-DD');
      const endOfMonthStr = monthDate.endOf('month').format('YYYY-MM-DD');

      // 1. Fetch Goal for this month
      const { data: goalData, error: goalErr } = await supabase
        .from('agency_goals')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('month_year', monthYear)
        .maybeSingle();

      if (goalErr && goalErr.code !== 'PGRST116') {
        console.error('Erro ao buscar metas:', goalErr);
      }
      setGoal(goalData || null);

      // 2. Fetch Billings (Faturamento recebido no mês)
      const { data: billingsData } = await supabase
        .from('agency_billing')
        .select('base_value, extra_value, total_value, status, paid_at')
        .eq('agency_id', agencyId)
        .eq('month_year', monthYear)
        .eq('status', 'paid');

      let totalRecebido = 0;
      let recebidoEstaSemana = 0;

      // Calcular semana atual do mês para faturamento da semana
      const now = dayjs();
      const currentDay = isCurrentMonth ? now.date() : (isPastMonth ? monthDate.daysInMonth() : 1);
      const currentWeekNum = Math.min(4, Math.max(1, Math.ceil(currentDay / 7)));
      const weekStartDay = (currentWeekNum - 1) * 7 + 1;
      const weekEndDay = Math.min(monthDate.daysInMonth(), currentWeekNum * 7);

      (billingsData || []).forEach((b: any) => {
        const val = Number(b.total_value) || (Number(b.base_value || 0) + Number(b.extra_value || 0));
        totalRecebido += val;

        if (b.paid_at) {
          const paidD = dayjs(b.paid_at);
          if (paidD.format('YYYY-MM') === monthYear) {
            const pDay = paidD.date();
            if (pDay >= weekStartDay && pDay <= weekEndDay) {
              recebidoEstaSemana += val;
            }
          }
        }
      });

      // Se nenhum billing tem paid_at gravado com precisão mas temos recebido no mês atual,
      // estimar de forma segura ou refletir os que bateram
      if (recebidoEstaSemana === 0 && totalRecebido > 0 && currentWeekNum === 1) {
        recebidoEstaSemana = totalRecebido;
      }

      setFaturamentoRecebido(totalRecebido);
      setFaturamentoEstaSemana(recebidoEstaSemana);

      // 3. Fetch New Clients (count created in month)
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, created_at')
        .eq('agency_id', agencyId)
        .gte('created_at', `${startOfMonthStr}T00:00:00`)
        .lte('created_at', `${endOfMonthStr}T23:59:59`);

      setNewClientsCount((clientsData || []).length);

      // 4. Fetch Commercial Actions
      const { data: actionsData } = await supabase
        .from('agency_commercial_actions')
        .select('*')
        .eq('agency_id', agencyId)
        .gte('action_date', startOfMonthStr)
        .lte('action_date', endOfMonthStr)
        .order('action_date', { ascending: false });

      const actions = (actionsData || []) as AgencyCommercialAction[];
      setCommercialActions(actions);

      // Reuniões: action_type IN ('meeting', 'call')
      const countMeetings = actions.filter(
        a => a.action_type === 'meeting' || a.action_type === 'call'
      ).length;
      setMeetingsCount(countMeetings);

      // 5. Fetch Published Posts for this month
      const { data: postsData } = await supabase
        .from('posts')
        .select('id, date_key, status, is_deleted')
        .eq('agency_id', agencyId)
        .eq('status', 'published')
        .not('is_deleted', 'is', true)
        .limit(10000);

      let pubCount = 0;
      (postsData || []).forEach((p: any) => {
        if (!p.date_key) return;
        const parts = p.date_key.split('-');
        if (parts.length >= 3) {
          let postMonthYear = '';
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            postMonthYear = `${parts[0]}-${parts[1].padStart(2, '0')}`;
          } else {
            // DD-MM-YYYY
            postMonthYear = `${parts[2]}-${parts[1].padStart(2, '0')}`;
          }
          if (postMonthYear === monthYear) {
            pubCount++;
          }
        }
      });
      setPostsCount(pubCount);

    } catch (err) {
      console.error('Erro ao carregar dados de metas:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, monthYear, monthDate, isCurrentMonth, isPastMonth]);

  useEffect(() => {
    fetchData();

    if (!agencyId) return;

    const channel = supabase
      .channel(`agency_goals_${agencyId}_${monthYear}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_goals', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_commercial_actions', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_billing', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId, monthYear, fetchData]);

  // Navigation handlers
  const nextMonth = useCallback(() => {
    setMonthYear(prev => dayjs(prev, 'YYYY-MM').add(1, 'month').format('YYYY-MM'));
  }, []);

  const prevMonth = useCallback(() => {
    setMonthYear(prev => dayjs(prev, 'YYYY-MM').subtract(1, 'month').format('YYYY-MM'));
  }, []);

  const goToCurrentMonth = useCallback(() => {
    setMonthYear(dayjs().format('YYYY-MM'));
  }, []);

  // Calculations
  const hasGoalConfigured = useMemo(() => {
    return Boolean(goal && (goal.revenue_goal > 0 || goal.new_clients_goal > 0 || goal.meetings_goal > 0 || goal.posts_goal > 0));
  }, [goal]);

  const revenueGoal = goal?.revenue_goal || 0;
  const newClientsGoal = goal?.new_clients_goal || 0;
  const meetingsGoal = goal?.meetings_goal || 0;
  const postsGoal = goal?.posts_goal || 0;

  const pctFaturamento = revenueGoal > 0 ? Math.round((faturamentoRecebido / revenueGoal) * 100) : 0;
  const pctNovosClientes = newClientsGoal > 0 ? Math.round((newClientsCount / newClientsGoal) * 100) : 0;
  const pctReunioes = meetingsGoal > 0 ? Math.round((meetingsCount / meetingsGoal) * 100) : 0;
  const pctPublicacoes = postsGoal > 0 ? Math.round((postsCount / postsGoal) * 100) : 0;

  // Pace calculations
  const weeklyGoal = useMemo(() => (revenueGoal > 0 ? revenueGoal / 4 : 0), [revenueGoal]);
  
  const currentDay = useMemo(() => {
    if (isCurrentMonth) return dayjs().date();
    if (isPastMonth) return monthDate.daysInMonth();
    return 1;
  }, [isCurrentMonth, isPastMonth, monthDate]);

  const semanaAtual = useMemo(() => {
    return Math.min(4, Math.max(1, Math.ceil(currentDay / 7)));
  }, [currentDay]);

  const receitaEsperadaAteAgora = useMemo(() => {
    return weeklyGoal * semanaAtual;
  }, [weeklyGoal, semanaAtual]);

  const isPaceOnTrack = useMemo(() => {
    if (!hasGoalConfigured || revenueGoal === 0) return true;
    return faturamentoRecebido >= receitaEsperadaAteAgora;
  }, [hasGoalConfigured, revenueGoal, faturamentoRecebido, receitaEsperadaAteAgora]);

  const faltamFaturamento = useMemo(() => {
    return Math.max(0, revenueGoal - faturamentoRecebido);
  }, [revenueGoal, faturamentoRecebido]);

  const superouFaturamento = useMemo(() => {
    return Math.max(0, faturamentoRecebido - revenueGoal);
  }, [revenueGoal, faturamentoRecebido]);

  // Coaching message calculation
  const coachingMessage = useMemo(() => {
    if (!hasGoalConfigured) {
      return 'Configure suas metas para acompanhar o progresso do mês.';
    }

    const formatCurrency = (val: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    if (pctFaturamento >= 100) {
      return `🎯 Meta batida! Você faturou ${formatCurrency(faturamentoRecebido)} este mês. Já definiu a meta do próximo?`;
    }

    if (pctFaturamento === 0) {
      return 'Mês novo, meta nova. Primeira venda define o ritmo — qual é o próximo passo hoje?';
    }

    if (pctFaturamento <= 30) {
      if (isPaceOnTrack) {
        return 'Início de mês, estamos bem. Continue prospectando e o mês fecha forte.';
      }
      return 'Atenção: o mês está avançando mais rápido que o faturamento. Hora de ligar para alguém.';
    }

    if (pctFaturamento <= 70) {
      if (isPaceOnTrack) {
        return 'No caminho certo. Mantenha o ritmo de reuniões e o mês fecha.';
      }
      return 'Você está abaixo do esperado para esta altura do mês. Que ação comercial você pode fazer hoje?';
    }

    // 71% a 99%
    if (isPaceOnTrack) {
      return `Reta final. Faltam ${formatCurrency(faltamFaturamento)} — uma reunião pode fechar isso.`;
    }
    return 'Você está abaixo do esperado para esta altura do mês. Que ação comercial você pode fazer hoje?';
  }, [hasGoalConfigured, pctFaturamento, isPaceOnTrack, faturamentoRecebido, faltamFaturamento]);

  // Mutations
  const saveGoal = useCallback(async (goalData: {
    revenue_goal: number;
    new_clients_goal: number;
    meetings_goal: number;
    posts_goal: number;
    notes?: string | null;
  }) => {
    if (!agencyId) return;
    try {
      const payload = {
        agency_id: agencyId,
        month_year: monthYear,
        revenue_goal: Number(goalData.revenue_goal) || 0,
        new_clients_goal: Number(goalData.new_clients_goal) || 0,
        meetings_goal: Number(goalData.meetings_goal) || 0,
        posts_goal: Number(goalData.posts_goal) || 0,
        notes: goalData.notes || null,
        created_at: goal?.created_at || new Date().toISOString()
      };

      const { error } = await supabase
        .from('agency_goals')
        .upsert(payload, { onConflict: 'agency_id,month_year' });

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Erro ao salvar metas:', err);
      throw err;
    }
  }, [agencyId, monthYear, goal, fetchData]);

  const addCommercialAction = useCallback(async (actionData: {
    action_date: string;
    action_type: CommercialActionType;
    contact_name: string;
    result: string;
    notes?: string | null;
  }) => {
    if (!agencyId) return;
    try {
      const payload = {
        agency_id: agencyId,
        action_date: actionData.action_date,
        action_type: actionData.action_type,
        contact_name: actionData.contact_name,
        result: actionData.result,
        notes: actionData.notes || null
      };

      const { error } = await supabase
        .from('agency_commercial_actions')
        .insert([payload]);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Erro ao adicionar ação comercial:', err);
      throw err;
    }
  }, [agencyId, fetchData]);

  const deleteCommercialAction = useCallback(async (id: string) => {
    if (!agencyId) return;
    try {
      const { error } = await supabase
        .from('agency_commercial_actions')
        .delete()
        .eq('agency_id', agencyId)
        .eq('id', id);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Erro ao excluir ação comercial:', err);
      throw err;
    }
  }, [agencyId, fetchData]);

  return {
    monthYear,
    monthLabel,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth,
    loading,
    goal,
    hasGoalConfigured,

    faturamentoRecebido,
    faturamentoEstaSemana,
    newClientsCount,
    meetingsCount,
    postsCount,

    commercialActions,

    pctFaturamento,
    pctNovosClientes,
    pctReunioes,
    pctPublicacoes,

    weeklyGoal,
    semanaAtual,
    receitaEsperadaAteAgora,
    isPaceOnTrack,
    faltamFaturamento,
    superouFaturamento,

    coachingMessage,

    setMonthYear,
    nextMonth,
    prevMonth,
    goToCurrentMonth,
    saveGoal,
    addCommercialAction,
    deleteCommercialAction,
    refresh: fetchData
  };
}

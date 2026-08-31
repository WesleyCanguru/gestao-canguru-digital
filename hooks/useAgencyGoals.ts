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

export const BLOG_CLIENT_ID = 'b0febf12-6d64-4754-ac4e-e2e1405e616c';

export interface UseAgencyGoalsReturn {
  monthYear: string;
  monthLabel: string;
  isCurrentMonth: boolean;
  isPastMonth: boolean;
  isFutureMonth: boolean;
  isMonthLocked: boolean;
  loading: boolean;
  goal: AgencyGoal | null;
  hasGoalConfigured: boolean;
  
  // Real values
  faturamentoRecebido: number;
  faturamentoEstaSemana: number;
  churnRealizado: number;
  saldoLiquido: number;
  clientPostsCount: number;
  ownPostsCount: number;
  postsCount: number;
  blogPostsCount: number;
  meetingsCount: number;
  proposalsCount: number;
  newClientsCount: number;

  // Commercial Actions list
  commercialActions: AgencyCommercialAction[];

  // Goals
  revenueGoal: number;
  churnGoal: number;
  clientPostsGoal: number;
  ownPostsGoal: number;
  blogPostsGoal: number;
  meetingsGoal: number;
  proposalsGoal: number;
  newClientsGoal: number;
  postsGoal: number;

  // Progress calculations
  pctFaturamento: number;
  pctChurn: number;
  pctClientPosts: number;
  pctOwnPosts: number;
  pctBlogPosts: number;
  pctReunioes: number;
  pctPropostas: number;
  pctNovosClientes: number;
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
  lockCurrentMonth: () => Promise<void>;
  copyPreviousMonthGoals: () => Promise<{ success: boolean; message?: string }>;
  saveGoal: (goalData: {
    revenue_goal: number;
    churn_goal?: number | null;
    client_posts_goal?: number | null;
    own_posts_goal?: number | null;
    proposals_goal?: number | null;
    new_clients_goal?: number | null;
    meetings_goal?: number | null;
    posts_goal?: number | null;
    blog_posts_goal?: number | null;
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
  const [churnRealizado, setChurnRealizado] = useState(0);
  const [newClientsCount, setNewClientsCount] = useState(0);
  const [meetingsCount, setMeetingsCount] = useState(0);
  const [proposalsCount, setProposalsCount] = useState(0);
  const [clientPostsCount, setClientPostsCount] = useState(0);
  const [ownPostsCount, setOwnPostsCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [blogPostsCount, setBlogPostsCount] = useState(0);
  const [commercialActions, setCommercialActions] = useState<AgencyCommercialAction[]>([]);

  const currentMonthYear = dayjs().format('YYYY-MM');
  const isCurrentMonth = monthYear === currentMonthYear;
  const isPastMonth = monthYear < currentMonthYear;
  const isFutureMonth = monthYear > currentMonthYear;
  const isMonthLocked = isPastMonth || Boolean(goal?.is_locked);

  const monthDate = useMemo(() => dayjs(monthYear, 'YYYY-MM'), [monthYear]);
  const monthLabel = useMemo(() => {
    const m = monthDate.month();
    const y = monthDate.year();
    return `${MONTH_NAMES_FULL[m]} ${y}`;
  }, [monthDate]);

  const fetchData = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const startOfMonthStr = monthDate.startOf('month').format('YYYY-MM-DD');
      const endOfMonthStr = monthDate.endOf('month').format('YYYY-MM-DD');

      // Executar buscas em paralelo para máxima performance e resiliência
      const [
        goalResult,
        billingsResult,
        clientsResult,
        actionsResult,
        postsResult,
        blogPostsResult
      ] = await Promise.allSettled([
        // 1. Fetch Goal for this month
        supabase
          .from('agency_goals')
          .select('*')
          .eq('agency_id', agencyId)
          .eq('month_year', monthYear)
          .maybeSingle(),

        // 2. Fetch Billings
        supabase
          .from('agency_billing')
          .select('base_value, extra_value, total_value, status, paid_at, due_day, client:clients(is_internal)')
          .eq('agency_id', agencyId)
          .eq('month_year', monthYear),

        // 3. Fetch All Clients to separate internal/own from client posts and calculate new clients
        supabase
          .from('clients')
          .select('id, name, is_internal, created_at, client_status, cancelled_at')
          .eq('agency_id', agencyId),

        // 4. Fetch Commercial Actions
        supabase
          .from('agency_commercial_actions')
          .select('*')
          .eq('agency_id', agencyId)
          .gte('action_date', startOfMonthStr)
          .lte('action_date', endOfMonthStr)
          .order('action_date', { ascending: false }),

        // 5. Fetch Published Posts
        supabase
          .from('posts')
          .select('id, client_id, date_key, status')
          .eq('agency_id', agencyId)
          .eq('status', 'published')
          .limit(10000),

        // 6. Fetch Blog Posts
        supabase
          .from('posts')
          .select('id, date_key, status')
          .eq('agency_id', agencyId)
          .eq('client_id', BLOG_CLIENT_ID)
          .eq('status', 'published')
          .limit(1000)
      ]);

      // 1. Process Goal
      if (goalResult.status === 'fulfilled') {
        const { data: goalData, error: goalErr } = goalResult.value;
        if (!goalErr) {
          setGoal(goalData || null);
        } else if (goalErr.code !== 'PGRST116') {
          console.warn('Aviso ao buscar metas (usando padrão):', goalErr.message || goalErr);
        }
      }

      // 2. Process Billings
      if (billingsResult.status === 'fulfilled') {
        const { data: billingsData } = billingsResult.value;
        let totalContratado = 0;
        let contratadoEstaSemana = 0;

        const now = dayjs();
        const currentDay = isCurrentMonth ? now.date() : (isPastMonth ? monthDate.daysInMonth() : 1);
        const currentWeekNum = Math.min(4, Math.max(1, Math.ceil(currentDay / 7)));
        const weekStartDay = (currentWeekNum - 1) * 7 + 1;
        const weekEndDay = Math.min(monthDate.daysInMonth(), currentWeekNum * 7);

        (billingsData || []).forEach((b: any) => {
          if (b.client && b.client.is_internal) return;

          const val = Number(b.total_value) || (Number(b.base_value || 0) + Number(b.extra_value || 0));
          totalContratado += val;

          if (b.paid_at) {
            const paidD = dayjs(b.paid_at);
            if (paidD.format('YYYY-MM') === monthYear) {
              const pDay = paidD.date();
              if (pDay >= weekStartDay && pDay <= weekEndDay) {
                contratadoEstaSemana += val;
              }
            }
          } else if (b.due_day) {
            if (b.due_day >= weekStartDay && b.due_day <= weekEndDay) {
              contratadoEstaSemana += val;
            }
          }
        });

        if (contratadoEstaSemana === 0 && totalContratado > 0 && currentWeekNum === 1) {
          contratadoEstaSemana = totalContratado;
        }

        setFaturamentoRecebido(totalContratado);
        setFaturamentoEstaSemana(contratadoEstaSemana);
      }

      // 3. Process Clients & Churn
      const internalClientIds = new Set<string>([BLOG_CLIENT_ID, 'b0febf12-6d64-4754-ac4e-e2e1405e616c']);
      if (clientsResult.status === 'fulfilled') {
        const { data: clientsData } = clientsResult.value;
        const allClients = (clientsData || []) as any[];

        // Build internal clients set
        allClients.forEach(c => {
          if (c.is_internal) {
            internalClientIds.add(c.id);
          }
        });

        // Novos clientes no mês (não internos)
        const newClients = allClients.filter(c => {
          if (c.is_internal) return false;
          if (!c.created_at) return false;
          return c.created_at >= `${startOfMonthStr}T00:00:00` && c.created_at <= `${endOfMonthStr}T23:59:59`;
        });
        setNewClientsCount(newClients.length);

        // Churn realizado (clientes cancelados no mês com valor ou 0)
        setChurnRealizado(0);
      }

      // 4. Process Commercial Actions
      if (actionsResult.status === 'fulfilled') {
        const { data: actionsData } = actionsResult.value;
        const actions = (actionsData || []) as AgencyCommercialAction[];
        setCommercialActions(actions);

        const countMeetings = actions.filter(
          a => a.action_type === 'meeting' || a.action_type === 'call'
        ).length;
        setMeetingsCount(countMeetings);

        const countProposals = actions.filter(
          a => a.action_type === 'proposal'
        ).length;
        setProposalsCount(countProposals);
      }

      // 5. Process Published Posts (Dividindo entre clientes e próprio)
      if (postsResult.status === 'fulfilled') {
        const { data: postsData } = postsResult.value;
        let cPostsCount = 0;
        let oPostsCount = 0;

        (postsData || []).forEach((p: any) => {
          if (!p.date_key) return;
          const parts = p.date_key.split('-');
          if (parts.length >= 3) {
            let postMonthYear = '';
            if (parts[0].length === 4) {
              postMonthYear = `${parts[0]}-${parts[1].padStart(2, '0')}`;
            } else {
              postMonthYear = `${parts[2]}-${parts[1].padStart(2, '0')}`;
            }
            if (postMonthYear === monthYear) {
              if (internalClientIds.has(p.client_id)) {
                oPostsCount++;
              } else {
                cPostsCount++;
              }
            }
          }
        });

        setClientPostsCount(cPostsCount);
        setOwnPostsCount(oPostsCount);
        setPostsCount(cPostsCount + oPostsCount);
      }

      // 6. Process Blog Posts
      if (blogPostsResult.status === 'fulfilled') {
        const { data: blogPostsData } = blogPostsResult.value;
        let blogPubCount = 0;
        (blogPostsData || []).forEach((p: any) => {
          if (!p.date_key) return;
          const parts = p.date_key.split('-');
          if (parts.length >= 3) {
            let postMonthYear = '';
            if (parts[0].length === 4) {
              postMonthYear = `${parts[0]}-${parts[1].padStart(2, '0')}`;
            } else {
              postMonthYear = `${parts[2]}-${parts[1].padStart(2, '0')}`;
            }
            if (postMonthYear === monthYear) {
              blogPubCount++;
            }
          }
        });
        setBlogPostsCount(blogPubCount);
      }

    } catch (err: any) {
      console.warn('Aviso ao carregar dados de metas:', err?.message || err);
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
    return Boolean(
      goal && (
        (goal.revenue_goal || 0) > 0 ||
        (goal.churn_goal || 0) > 0 ||
        (goal.client_posts_goal || 0) > 0 ||
        (goal.own_posts_goal || 0) > 0 ||
        (goal.proposals_goal || 0) > 0 ||
        (goal.new_clients_goal || 0) > 0 ||
        (goal.meetings_goal || 0) > 0 ||
        (goal.posts_goal || 0) > 0 ||
        (goal.blog_posts_goal || 0) > 0
      )
    );
  }, [goal]);

  const revenueGoal = goal?.revenue_goal || 0;
  const churnGoal = goal?.churn_goal ?? 0;
  const clientPostsGoal = goal?.client_posts_goal ?? goal?.posts_goal ?? 0;
  const ownPostsGoal = goal?.own_posts_goal ?? 0;
  const blogPostsGoal = goal?.blog_posts_goal ?? 0;
  const meetingsGoal = goal?.meetings_goal ?? 0;
  const proposalsGoal = goal?.proposals_goal ?? 0;
  const newClientsGoal = goal?.new_clients_goal ?? 0;
  const postsGoal = goal?.posts_goal ?? (clientPostsGoal + ownPostsGoal);

  const saldoLiquido = Math.max(0, faturamentoRecebido - churnRealizado);

  const pctFaturamento = revenueGoal > 0 ? Math.round((faturamentoRecebido / revenueGoal) * 100) : 0;
  const pctChurn = churnGoal > 0 ? Math.round((churnRealizado / churnGoal) * 100) : 0;
  const pctClientPosts = clientPostsGoal > 0 ? Math.round((clientPostsCount / clientPostsGoal) * 100) : 0;
  const pctOwnPosts = ownPostsGoal > 0 ? Math.round((ownPostsCount / ownPostsGoal) * 100) : 0;
  const pctBlogPosts = blogPostsGoal > 0 ? Math.round((blogPostsCount / blogPostsGoal) * 100) : 0;
  const pctReunioes = meetingsGoal > 0 ? Math.round((meetingsCount / meetingsGoal) * 100) : 0;
  const pctPropostas = proposalsGoal > 0 ? Math.round((proposalsCount / proposalsGoal) * 100) : 0;
  const pctNovosClientes = newClientsGoal > 0 ? Math.round((newClientsCount / newClientsGoal) * 100) : 0;
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
  const lockCurrentMonth = useCallback(async () => {
    if (!agencyId) return;
    try {
      const nowIso = new Date().toISOString();
      const payload = {
        agency_id: agencyId,
        month_year: monthYear,
        revenue_goal: Number(goal?.revenue_goal || 0),
        churn_goal: goal?.churn_goal !== undefined && goal?.churn_goal !== null ? Number(goal.churn_goal) : null,
        client_posts_goal: goal?.client_posts_goal !== undefined && goal?.client_posts_goal !== null ? Number(goal.client_posts_goal) : null,
        own_posts_goal: goal?.own_posts_goal !== undefined && goal?.own_posts_goal !== null ? Number(goal.own_posts_goal) : null,
        proposals_goal: goal?.proposals_goal !== undefined && goal?.proposals_goal !== null ? Number(goal.proposals_goal) : null,
        new_clients_goal: goal?.new_clients_goal !== undefined && goal?.new_clients_goal !== null ? Number(goal.new_clients_goal) : null,
        meetings_goal: goal?.meetings_goal !== undefined && goal?.meetings_goal !== null ? Number(goal.meetings_goal) : null,
        posts_goal: goal?.posts_goal !== undefined && goal?.posts_goal !== null ? Number(goal.posts_goal) : null,
        blog_posts_goal: goal?.blog_posts_goal !== undefined && goal?.blog_posts_goal !== null ? Number(goal.blog_posts_goal) : null,
        notes: goal?.notes || null,
        is_locked: true,
        locked_at: nowIso,
        created_at: goal?.created_at || nowIso
      };

      const { error } = await supabase
        .from('agency_goals')
        .upsert(payload, { onConflict: 'agency_id,month_year' });

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Erro ao fechar mês:', err);
      throw err;
    }
  }, [agencyId, monthYear, goal, fetchData]);

  const copyPreviousMonthGoals = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (!agencyId) return { success: false, message: 'Agência não identificada.' };

    const prevMonthStr = dayjs(monthYear, 'YYYY-MM').subtract(1, 'month').format('YYYY-MM');

    const { data: prevGoal, error } = await supabase
      .from('agency_goals')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('month_year', prevMonthStr)
      .maybeSingle();

    if (error || !prevGoal) {
      return { success: false, message: 'Nenhuma meta encontrada no mês anterior.' };
    }

    const hasPrevValues = Boolean(
      (prevGoal.revenue_goal || 0) > 0 ||
      (prevGoal.churn_goal || 0) > 0 ||
      (prevGoal.client_posts_goal || 0) > 0 ||
      (prevGoal.own_posts_goal || 0) > 0 ||
      (prevGoal.proposals_goal || 0) > 0 ||
      (prevGoal.new_clients_goal || 0) > 0 ||
      (prevGoal.meetings_goal || 0) > 0 ||
      (prevGoal.posts_goal || 0) > 0 ||
      (prevGoal.blog_posts_goal || 0) > 0
    );

    if (!hasPrevValues) {
      return { success: false, message: 'Nenhuma meta encontrada no mês anterior.' };
    }

    const nowIso = new Date().toISOString();
    const payload = {
      agency_id: agencyId,
      month_year: monthYear,
      revenue_goal: prevGoal.revenue_goal || 0,
      churn_goal: prevGoal.churn_goal ?? null,
      client_posts_goal: prevGoal.client_posts_goal ?? null,
      own_posts_goal: prevGoal.own_posts_goal ?? null,
      proposals_goal: prevGoal.proposals_goal ?? null,
      new_clients_goal: prevGoal.new_clients_goal ?? null,
      meetings_goal: prevGoal.meetings_goal ?? null,
      posts_goal: prevGoal.posts_goal ?? null,
      blog_posts_goal: prevGoal.blog_posts_goal ?? null,
      notes: null, // notes NÃO copiar
      is_locked: false,
      locked_at: null,
      created_at: nowIso
    };

    const { error: upsertErr } = await supabase
      .from('agency_goals')
      .upsert(payload, { onConflict: 'agency_id,month_year' });

    if (upsertErr) {
      console.error('Erro ao copiar metas do mês passado:', upsertErr);
      throw upsertErr;
    }

    await fetchData();
    return { success: true };
  }, [agencyId, monthYear, fetchData]);

  const saveGoal = useCallback(async (goalData: {
    revenue_goal: number;
    churn_goal?: number | null;
    client_posts_goal?: number | null;
    own_posts_goal?: number | null;
    proposals_goal?: number | null;
    new_clients_goal?: number | null;
    meetings_goal?: number | null;
    posts_goal?: number | null;
    blog_posts_goal?: number | null;
    notes?: string | null;
  }) => {
    if (!agencyId) return;
    if (isMonthLocked) {
      throw new Error('Este mês está bloqueado para edições.');
    }
    try {
      const cPosts = goalData.client_posts_goal !== undefined && goalData.client_posts_goal !== null ? Number(goalData.client_posts_goal) : null;
      const oPosts = goalData.own_posts_goal !== undefined && goalData.own_posts_goal !== null ? Number(goalData.own_posts_goal) : null;
      const legacyPosts = goalData.posts_goal !== undefined && goalData.posts_goal !== null 
        ? Number(goalData.posts_goal) 
        : ((cPosts || 0) + (oPosts || 0) || null);

      const payload = {
        agency_id: agencyId,
        month_year: monthYear,
        revenue_goal: Number(goalData.revenue_goal) || 0,
        churn_goal: goalData.churn_goal !== undefined && goalData.churn_goal !== null ? Number(goalData.churn_goal) : null,
        client_posts_goal: cPosts,
        own_posts_goal: oPosts,
        proposals_goal: goalData.proposals_goal !== undefined && goalData.proposals_goal !== null ? Number(goalData.proposals_goal) : null,
        new_clients_goal: goalData.new_clients_goal !== undefined && goalData.new_clients_goal !== null ? Number(goalData.new_clients_goal) : null,
        meetings_goal: goalData.meetings_goal !== undefined && goalData.meetings_goal !== null ? Number(goalData.meetings_goal) : null,
        posts_goal: legacyPosts,
        blog_posts_goal: goalData.blog_posts_goal !== undefined && goalData.blog_posts_goal !== null ? Number(goalData.blog_posts_goal) : null,
        notes: goalData.notes || null,
        is_locked: false,
        locked_at: null,
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
  }, [agencyId, monthYear, goal, isMonthLocked, fetchData]);

  const addCommercialAction = useCallback(async (actionData: {
    action_date: string;
    action_type: CommercialActionType;
    contact_name: string;
    result: string;
    notes?: string | null;
  }) => {
    if (!agencyId) return;
    if (isMonthLocked) {
      throw new Error('Este mês está bloqueado para edições.');
    }
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
  }, [agencyId, isMonthLocked, fetchData]);

  const deleteCommercialAction = useCallback(async (id: string) => {
    if (!agencyId) return;
    if (isMonthLocked) {
      throw new Error('Este mês está bloqueado para edições.');
    }
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
  }, [agencyId, isMonthLocked, fetchData]);

  return {
    monthYear,
    monthLabel,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth,
    isMonthLocked,
    loading,
    goal,
    hasGoalConfigured,

    faturamentoRecebido,
    faturamentoEstaSemana,
    churnRealizado,
    saldoLiquido,
    clientPostsCount,
    ownPostsCount,
    postsCount,
    blogPostsCount,
    meetingsCount,
    proposalsCount,
    newClientsCount,

    commercialActions,

    revenueGoal,
    churnGoal,
    clientPostsGoal,
    ownPostsGoal,
    blogPostsGoal,
    meetingsGoal,
    proposalsGoal,
    newClientsGoal,
    postsGoal,

    pctFaturamento,
    pctChurn,
    pctClientPosts,
    pctOwnPosts,
    pctBlogPosts,
    pctReunioes,
    pctPropostas,
    pctNovosClientes,
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
    lockCurrentMonth,
    copyPreviousMonthGoals,
    saveGoal,
    addCommercialAction,
    deleteCommercialAction,
    refresh: fetchData
  };
}

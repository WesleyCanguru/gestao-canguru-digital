import React, { useState, useEffect, useCallback } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { 
  Calendar, 
  Target, 
  BarChart2, 
  Clock, 
  AlertTriangle, 
  Sparkles,
  DollarSign,
  Flame,
  Activity,
  LucideIcon
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { Client } from '../../types';
import { calculateDueDate } from '../../hooks/useAgencyFinanceiro';
import { normalizePlatformKey, getPlatformLabel } from '../../hooks/useMediaBudgets';

import { parseTaskProcessMeta, getOverdueDays } from '../../lib/processSla';

dayjs.locale('pt-br');

const TEST_CLIENT_IDS = ['3491826b-8f32-4a8b-a081-8a1ed7c305c2'];

export interface PendingItem {
  id: string;
  type: 'no_posts_week' | 'goals_not_defined' | 'metrics_outdated' | 'stalled_posts' | 'overdue_billing' | 'high_consumption' | 'over_budget' | 'low_health_score' | 'overdue_process_steps';
  level: 'atencao' | 'urgente';
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

interface PendenciasPanelProps {
  onNavigateToClients: (client: Client) => void;
  onNavigateToPainelConteudo?: (filter?: { aba?: 'dashboard' | 'publicacoes'; status?: string; periodo?: string; date?: string }) => void;
  onNavigateToMasterMap?: (filter?: { aba?: 'dashboard' | 'publicacoes'; status?: string; periodo?: string; date?: string }) => void;
  onNavigateToMetas?: () => void;
  onNavigateToTasks?: () => void;
  onNavigateToFinanceiro?: (filter?: { clientId?: string; clientName?: string; monthYear?: string; subTab?: 'overview' | 'faturamento' | 'despesas' | 'indicacao' }) => void;
}

export const PendenciasPanel: React.FC<PendenciasPanelProps> = ({
  onNavigateToClients,
  onNavigateToPainelConteudo,
  onNavigateToMasterMap,
  onNavigateToMetas,
  onNavigateToTasks,
  onNavigateToFinanceiro
}) => {
  const { userRole, agencyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingItem[]>([]);

  const fetchPendencias = useCallback(async () => {
    if (!agencyId || userRole !== 'admin') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const today = dayjs().startOf('day');
      const in7DaysEnd = dayjs().add(6, 'day').endOf('day');
      const currentMonthYear = dayjs().format('YYYY-MM');
      const currentMonthName = dayjs().format('MMMM');
      const hours48Ago = dayjs().subtract(48, 'hour');
      const days3Ago = dayjs().subtract(3, 'day');

      // 1. Clientes Ativos
      const { data: clientsData, error: clientsErr } = await supabase
        .from('clients')
        .select('id, name, logo_url, color, initials, is_internal, client_status')
        .eq('agency_id', agencyId);

      if (clientsErr) {
        console.warn('Erro ao carregar clientes para pendências:', clientsErr.message);
      }

      const rawClients = ((clientsData as any[]) || []);
      const clientsMap = new Map<string, any>();
      rawClients.forEach((c) => clientsMap.set(c.id, c));

      const activeClients = rawClients.filter(
        (c) => !c.is_internal && c.client_status !== 'cancelled' && c.client_status !== 'inactive' && !TEST_CLIENT_IDS.includes(c.id)
      );

      // 2. Posts da agência
      const { data: postsData, error: postsErr } = await supabase
        .from('posts')
        .select('id, client_id, status, date_key, created_at, updated_at, is_deleted')
        .eq('agency_id', agencyId)
        .eq('is_deleted', false);

      if (postsErr) {
        console.warn('Erro ao carregar posts para pendências:', postsErr.message);
      }

      const validPosts = (postsData as any[]) || [];

      // 3. Metas do mês atual
      const { data: goalData, error: goalErr } = await supabase
        .from('agency_goals')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('month_year', currentMonthYear)
        .maybeSingle();

      if (goalErr && goalErr.code !== 'PGRST116') {
        console.warn('Erro ao carregar metas para pendências:', goalErr.message);
      }

      // 4. Métricas Sociais (auto_collect)
      const { data: metricsData, error: metricsErr } = await supabase
        .from('social_metrics')
        .select('client_id, collected_at, source, date')
        .eq('agency_id', agencyId)
        .eq('source', 'auto_collect');

      if (metricsErr) {
        console.warn('Aviso ao carregar social_metrics para pendências:', metricsErr.message);
      }

      const rawMetrics = (metricsData as any[]) || [];

      const pendingList: PendingItem[] = [];

      // --- VERIFICAÇÃO 1: Clientes sem posts agendados/aprovados para os próximos 7 dias ---
      activeClients.forEach((client) => {
        const clientPosts = validPosts.filter((p) => p.client_id === client.id);

        const hasPostInWeek = clientPosts.some((p) => {
          // Status agendado ou aprovado
          const isScheduledOrApproved = 
            p.status === 'scheduled' || 
            p.status === 'approved' || 
            p.status === 'theme_approved' ||
            p.status === 'published';

          if (!isScheduledOrApproved) return false;

          // Extração da data do date_key (DD-MM-YYYY-...)
          if (!p.date_key) return false;
          const parts = p.date_key.split('-');
          if (parts.length < 3) return false;

          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // 0-indexed
          const year = parseInt(parts[2], 10);

          if (isNaN(day) || isNaN(month) || isNaN(year)) return false;

          const postDate = dayjs(new Date(year, month, day));

          return (
            (postDate.isAfter(today) || postDate.isSame(today, 'day')) &&
            (postDate.isBefore(in7DaysEnd) || postDate.isSame(in7DaysEnd, 'day'))
          );
        });

        if (!hasPostInWeek) {
          pendingList.push({
            id: `no-posts-${client.id}`,
            type: 'no_posts_week',
            level: 'atencao',
            icon: Calendar,
            label: `${client.name}: sem posts para esta semana`,
            onClick: () => onNavigateToClients(client)
          });
        }
      });

      // --- VERIFICAÇÃO 2: Meta do mês não preenchida ---
      const hasDefinedGoals = Boolean(
        goalData && (
          (goalData.revenue_goal || 0) > 0 ||
          (goalData.posts_goal || 0) > 0 ||
          (goalData.meetings_goal || 0) > 0 ||
          (goalData.proposals_goal || 0) > 0 ||
          (goalData.client_posts_goal || 0) > 0 ||
          (goalData.own_posts_goal || 0) > 0 ||
          (goalData.new_clients_goal || 0) > 0
        )
      );

      if (!hasDefinedGoals) {
        pendingList.push({
          id: 'goals-not-defined',
          type: 'goals_not_defined',
          level: 'atencao',
          icon: Target,
          label: `Metas de ${currentMonthName} não definidas`,
          onClick: () => onNavigateToMetas?.()
        });
      }

      // --- VERIFICAÇÃO 3: Coleta de métricas desatualizada (> 48h) ---
      activeClients.forEach((client) => {
        const clientMetrics = rawMetrics.filter((m) => m.client_id === client.id);

        let latestTimestamp: dayjs.Dayjs | null = null;

        clientMetrics.forEach((m) => {
          const dtStr = m.collected_at || m.date;
          if (dtStr) {
            const dt = dayjs(dtStr);
            if (!latestTimestamp || dt.isAfter(latestTimestamp)) {
              latestTimestamp = dt;
            }
          }
        });

        const isOutdated = !latestTimestamp || latestTimestamp.isBefore(hours48Ago);

        if (isOutdated) {
          let daysCount = 3;
          if (latestTimestamp) {
            const diffDays = dayjs().diff(latestTimestamp, 'day');
            daysCount = Math.max(2, diffDays);
          }

          pendingList.push({
            id: `metrics-outdated-${client.id}`,
            type: 'metrics_outdated',
            level: 'urgente',
            icon: BarChart2,
            label: `${client.name}: métricas sem atualizar há ${daysCount} dias`,
            onClick: () => onNavigateToClients(client)
          });
        }
      });

      // --- VERIFICAÇÃO 4: Posts aguardando aprovação há mais de 3 dias ---
      const stalledPostsByClient: Record<string, number> = {};

      validPosts.forEach((post) => {
        if (TEST_CLIENT_IDS.includes(post.client_id)) return;

        const isPending =
          post.status === 'pending_approval' ||
          post.status === 'theme_pending' ||
          post.status === 'aguardando_aprovacao';

        if (!isPending) return;

        const dateToCheck = post.updated_at || post.created_at;
        if (!dateToCheck) return;

        const postTimestamp = dayjs(dateToCheck);
        if (postTimestamp.isBefore(days3Ago)) {
          stalledPostsByClient[post.client_id] = (stalledPostsByClient[post.client_id] || 0) + 1;
        }
      });

      Object.entries(stalledPostsByClient).forEach(([clientId, count]) => {
        const client = activeClients.find((c) => c.id === clientId);
        const clientName = client ? client.name : 'Cliente';

        pendingList.push({
          id: `stalled-posts-${clientId}`,
          type: 'stalled_posts',
          level: 'urgente',
          icon: Clock,
          label: `${clientName}: ${count} ${count === 1 ? 'post parado' : 'posts parados'} há mais de 3 dias`,
          onClick: () =>
            (onNavigateToPainelConteudo || onNavigateToMasterMap)?.({
              aba: 'publicacoes',
              status: 'pending_approval'
            })
        });
      });

      // --- VERIFICAÇÃO 5: Faturas vencidas não pagas (Aging de Inadimplência) ---
      const { data: billingsData, error: billingsErr } = await supabase
        .from('agency_billing')
        .select('id, client_id, month_year, due_day, due_date, status, is_sporadic, sporadic_name')
        .eq('agency_id', agencyId)
        .neq('status', 'paid');

      if (billingsErr) {
        console.warn('Aviso ao carregar faturas para pendências:', billingsErr.message);
      }

      if (billingsData) {
        billingsData.forEach((b: any) => {
          let clientName = '';
          let isTest = false;

          if (b.is_sporadic) {
            clientName = b.sporadic_name || 'Esporádico';
          } else {
            const client = activeClients.find((c) => c.id === b.client_id);
            if (!client) return; // Se o cliente não estiver ativo/recorrente na agência, ignora
            clientName = client.name;
            if (TEST_CLIENT_IDS.includes(client.id) || TEST_CLIENT_IDS.includes(b.client_id)) {
              isTest = true;
            }
          }

          if (isTest) return;

          const dueDay = b.due_day || 10;
          const dueStr = b.due_date || calculateDueDate(b.month_year, dueDay);
          const dueDate = dayjs(dueStr);

          if (!dueDate.isValid()) return;

          // Se a data de vencimento for anterior ao início de hoje
          if (dueDate.isBefore(today, 'day')) {
            const daysOverdue = today.diff(dueDate.startOf('day'), 'day');
            const monthName = dayjs(b.month_year).format('MMMM');

            pendingList.push({
              id: `overdue-billing-${b.id}`,
              type: 'overdue_billing',
              level: 'urgente',
              icon: DollarSign,
              label: `${clientName}: fatura de ${monthName} venceu há ${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'}`,
              onClick: () => {
                onNavigateToFinanceiro?.({
                  clientId: b.client_id,
                  clientName: clientName,
                  monthYear: b.month_year,
                  subTab: 'faturamento'
                });
              }
            });
          }
        });
      }

      // 6. Verba de Mídia por cliente e plataforma (Alertas de consumo e estouro)
      const startOfMonthStr = `${currentMonthYear}-01`;
      const endOfMonthStr = dayjs(startOfMonthStr).endOf('month').format('YYYY-MM-DD');
      const totalDaysInMonth = dayjs(startOfMonthStr).daysInMonth();
      const currentDay = dayjs().date();
      const remainingDaysInMonth = Math.max(0, totalDaysInMonth - currentDay);

      const { data: mediaBudgetsData } = await supabase
        .from('client_media_budgets')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('month_year', currentMonthYear);

      if (mediaBudgetsData && mediaBudgetsData.length > 0) {
        const { data: trafficData } = await supabase
          .from('paid_traffic_daily')
          .select('client_id, platform, investment')
          .eq('agency_id', agencyId)
          .gte('report_date', startOfMonthStr)
          .lte('report_date', endOfMonthStr);

        const investmentMap: Record<string, Record<string, number>> = {};
        (trafficData || []).forEach(row => {
          const cId = row.client_id;
          const pKey = normalizePlatformKey(row.platform);
          if (!investmentMap[cId]) investmentMap[cId] = {};
          investmentMap[cId][pKey] = (investmentMap[cId][pKey] || 0) + (Number(row.investment) || 0);
        });

        mediaBudgetsData.forEach(b => {
          const cId = b.client_id;
          if (TEST_CLIENT_IDS.includes(cId)) return;
          const client = clientsMap.get(cId);
          if (!client || client.is_internal || client.client_status === 'cancelled') return;
          if (client.name && client.name.toLowerCase().includes('a-teste')) return;

          const pKey = normalizePlatformKey(b.platform);
          const pLabel = getPlatformLabel(pKey);
          const budget = Number(b.budget_amount) || 0;
          if (budget <= 0) return;

          const invested = investmentMap[cId]?.[pKey] || 0;
          const percentage = Math.round((invested / budget) * 100);

          if (invested > budget) {
            const exceeded = Math.round(invested - budget);
            pendingList.push({
              id: `over-budget-${b.id}`,
              type: 'over_budget',
              level: 'urgente',
              icon: Flame,
              label: `${client.name} (${pLabel}): verba estourada em R$${exceeded.toLocaleString('pt-BR')}`,
              onClick: () => {
                onNavigateToClients?.(client);
              }
            });
          } else if (percentage >= 85 && remainingDaysInMonth > 5) {
            pendingList.push({
              id: `high-consumption-${b.id}`,
              type: 'high_consumption',
              level: 'atencao',
              icon: AlertTriangle,
              label: `${client.name} (${pLabel}): ${percentage}% da verba consumida — faltam ${remainingDaysInMonth} dias`,
              onClick: () => {
                onNavigateToClients?.(client);
              }
            });
          }
        });
      }

      // 7. Health Score (Alerta para clientes com score < 60 - Risco de Churn)
      const { data: healthScoresData } = await supabase
        .from('client_health_scores')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('month_year', currentMonthYear);

      if (healthScoresData && healthScoresData.length > 0) {
        healthScoresData.forEach(h => {
          const cId = h.client_id;
          if (TEST_CLIENT_IDS.includes(cId)) return;
          const client = clientsMap.get(cId);
          if (!client || client.is_internal || client.client_status === 'cancelled' || client.client_status === 'inactive') return;
          if (client.name && client.name.toLowerCase().includes('a-teste')) return;

          if (h.score < 60) {
            pendingList.push({
              id: `low-health-${h.id}`,
              type: 'low_health_score',
              level: 'urgente',
              icon: Activity,
              label: `${client.name}: Health Score baixo (${h.score}/100) — Risco de Churn`,
              onClick: () => {
                onNavigateToClients?.(client);
              }
            });
          }
        });
      }

      // 8. Etapas de Processo com SLA Atrasado
      try {
        const { data: tasksData } = await supabase
          .from('agency_tasks')
          .select('id, title, status, due_date, parent_task_id, description')
          .eq('agency_id', agencyId)
          .eq('status', 'pending');

        if (tasksData && tasksData.length > 0) {
          let overdueProcessSteps = 0;
          tasksData.forEach((task: any) => {
            const meta = parseTaskProcessMeta(task);
            const isStep = Boolean(task.parent_task_id || meta.parent_task_id);
            if (isStep && task.due_date) {
              const days = getOverdueDays(task.due_date);
              if (days > 0) {
                overdueProcessSteps++;
              }
            }
          });

          if (overdueProcessSteps > 0) {
            pendingList.push({
              id: 'overdue-process-steps',
              type: 'overdue_process_steps',
              level: 'urgente',
              icon: Clock,
              label: `${overdueProcessSteps} ${overdueProcessSteps === 1 ? 'etapa de processo atrasada' : 'etapas de processos atrasadas'}`,
              onClick: () => {
                onNavigateToTasks?.();
              }
            });
          }
        }
      } catch (tErr) {
        console.warn('Aviso ao carregar etapas de processo para pendências:', tErr);
      }

      setItems(pendingList);
    } catch (err) {
      console.error('Erro ao calcular pendências operacionais:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, userRole, onNavigateToClients, onNavigateToPainelConteudo, onNavigateToMasterMap, onNavigateToMetas, onNavigateToTasks, onNavigateToFinanceiro]);

  useEffect(() => {
    fetchPendencias();

    if (!agencyId) return;

    const channel = supabase
      .channel(`pendencias_panel_${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchPendencias();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchPendencias();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_goals', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchPendencias();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_metrics', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchPendencias();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_billing', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchPendencias();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_media_budgets', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchPendencias();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_traffic_daily', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchPendencias();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_tasks', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchPendencias();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId, fetchPendencias]);

  // Se não for admin, não renderiza nada
  if (userRole !== 'admin') {
    return null;
  }

  // Se estiver carregando e sem itens ainda, não trava a tela
  if (loading && items.length === 0) {
    return null;
  }

  // Se não houver NENHUMA pendência, a seção inteira não renderiza
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="px-8 pt-2 pb-1">
      <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-4 border border-stone-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider uppercase text-[#8A8F98] flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-amber-500" />
            Pendências
          </span>
          <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
            {items.length} {items.length === 1 ? 'item requer atenção' : 'itens requerem atenção'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.map((item) => {
            const IconComponent = item.icon;

            const isUrgente = item.level === 'urgente';

            const chipStyles = isUrgente
              ? 'bg-rose-50/90 text-rose-900 border-rose-200/80 hover:bg-rose-100/90 hover:border-rose-300'
              : 'bg-amber-50/90 text-amber-900 border-amber-200/80 hover:bg-amber-100/90 hover:border-amber-300';

            const iconColor = isUrgente ? 'text-rose-600' : 'text-amber-600';

            return (
              <button
                key={item.id}
                onClick={item.onClick}
                type="button"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer ${chipStyles}`}
              >
                <IconComponent size={14} className={`shrink-0 ${iconColor}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

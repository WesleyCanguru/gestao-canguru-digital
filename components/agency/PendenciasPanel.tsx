import React, { useState, useEffect, useCallback } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { 
  Calendar, 
  Target, 
  BarChart2, 
  Clock, 
  AlertTriangle, 
  Sparkles,
  LucideIcon
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { Client } from '../../types';

dayjs.locale('pt-br');

const TEST_CLIENT_IDS = ['3491826b-8f32-4a8b-a081-8a1ed7c305c2'];

export interface PendingItem {
  id: string;
  type: 'no_posts_week' | 'goals_not_defined' | 'metrics_outdated' | 'stalled_posts';
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
}

export const PendenciasPanel: React.FC<PendenciasPanelProps> = ({
  onNavigateToClients,
  onNavigateToPainelConteudo,
  onNavigateToMasterMap,
  onNavigateToMetas
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

      const activeClients = ((clientsData as any[]) || []).filter(
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

      setItems(pendingList);
    } catch (err) {
      console.error('Erro ao calcular pendências operacionais:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, userRole, onNavigateToClients, onNavigateToPainelConteudo, onNavigateToMasterMap, onNavigateToMetas]);

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

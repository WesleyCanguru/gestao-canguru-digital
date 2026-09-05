import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  BarChart3, 
  Clock, 
  Eye, 
  EyeOff, 
  Users, 
  FileText, 
  Image as ImageIcon,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { ResponsiveContainer, BarChart, Bar, Cell, Tooltip } from 'recharts';
import { Client, AgencyTask, AgencyCRM, AgencyLead, PostStatus, DailyContent } from '../../types';
import { parseExpenseRow, filterExpensesForMonth } from '../../lib/expenses';
import { PostModal } from '../PostModal';
import { CircuitLines } from './CircuitLines';
import { PendenciasPanel } from './PendenciasPanel';
import { useAgencyGoals } from '../../hooks/useAgencyGoals';

dayjs.locale('pt-br');

const BRAND = {
  azulCanguru:    '#13284D',   // RGB 19·40·77 — cor principal da marca
  azulTecnologia: '#20364D',   // RGB 32·54·77 — segundo tom escuro
  pretoEstrutura: '#0F1115',   // RGB 15·17·21 — fundo impacto
  cinzaSistema:   '#8A8F98',   // RGB 138·143·152 — textos secundários
  brancoQuente:   '#F4F3EF',   // RGB 244·243·239 — fundo das seções de conteúdo
  brancoPuro:     '#FFFFFF',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft:             { bg: '#F4F3EF',              text: '#8A8F98',  label: 'Rascunho' },
  production:        { bg: 'rgba(251,191,36,0.15)', text: '#d97706', label: 'Em produção' },
  review:            { bg: 'rgba(99,102,241,0.12)', text: '#4f46e5', label: 'Revisão' },
  pending_approval:  { bg: 'rgba(251,191,36,0.15)', text: '#d97706', label: 'Aprovação' },
  theme_pending:     { bg: 'rgba(251,191,36,0.15)', text: '#d97706', label: 'Aprovação' },
  approved:          { bg: 'rgba(34,197,94,0.12)',  text: '#16a34a', label: 'Aprovado' },
  theme_approved:    { bg: 'rgba(34,197,94,0.12)',  text: '#16a34a', label: 'Aprovado' },
  published:         { bg: 'rgba(19,40,77,0.12)',   text: '#13284D', label: 'Publicado' },
  scheduled:         { bg: 'rgba(99,102,241,0.12)', text: '#4f46e5', label: 'Programado' },
  changes:           { bg: 'rgba(239,68,68,0.12)',  text: '#dc2626', label: 'Alteração' },
  changes_requested: { bg: 'rgba(239,68,68,0.12)',  text: '#dc2626', label: 'Alteração' },
  rejected:          { bg: 'rgba(239,68,68,0.12)',  text: '#dc2626', label: 'Reprovado' },
  theme_rejected:    { bg: 'rgba(239,68,68,0.12)',  text: '#dc2626', label: 'Reprovado' },
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        fontSize: 10,
        fontWeight: 700,
        borderRadius: 4,
        padding: '2px 7px',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
};

const PriorityDot = ({ priority }: { priority?: string }) => {
  const p = (priority || '').toLowerCase();
  if (p === 'urgente' || p === 'urgent') {
    return (
      <span style={{ background: 'rgba(239,68,68,0.15)', color: '#dc2626', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 6px', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        Urgente
      </span>
    );
  }
  if (p === 'alta' || p === 'high') {
    return (
      <span style={{ background: 'rgba(249,115,22,0.15)', color: '#ea580c', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 6px', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        Alta
      </span>
    );
  }
  return null;
};

// Funções de verificação de pendência e recorrência de tarefas
function getLastWeeklyOccurrence(recurrenceDays: number[], from: Date): Date | null {
  if (!recurrenceDays || recurrenceDays.length === 0) return null;
  
  let mostRecent: Date | null = null;
  for (const dayOfWeek of recurrenceDays) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    const currentDay = d.getDay(); // 0-6
    const diff = (currentDay - dayOfWeek + 7) % 7;
    d.setDate(d.getDate() - diff);
    
    if (!mostRecent || d > mostRecent) {
      mostRecent = d;
    }
  }
  return mostRecent;
}

function getMonthlyTaskState(task: any, now = new Date()): 'pending' | 'completed' | 'not_started' {
  const diaConfigurado = task.recurrence_days?.[0] ? parseInt(task.recurrence_days[0], 10) : null;
  if (!diaConfigurado) return 'pending';

  const inicioCicloAtual = new Date(now.getFullYear(), now.getMonth(), diaConfigurado);

  if (task.completed_at) {
    const lastDone = new Date(task.completed_at);
    if (lastDone >= inicioCicloAtual && now >= inicioCicloAtual) {
      return 'completed';
    }
    if (now < inicioCicloAtual) {
      const inicioCicloMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, diaConfigurado);
      if (lastDone >= inicioCicloMesAnterior) {
        return 'completed';
      }
    }
  }

  if (now < inicioCicloAtual) {
    return 'not_started';
  }

  return 'pending';
}

function isTaskPendingInCurrentCycle(task: any): boolean {
  if (task.is_deleted || task.status === 'deleted') return false;
  if (task.client && task.client.client_status === 'cancelled') return false;

  // Se tarefa não-recorrente já foi concluída, nunca é pendente
  if (!task.recurrence_type || task.recurrence_type === 'none') {
    return task.status !== 'completed' && task.status !== 'done' && !task.is_completed;
  }

  if (task.status === 'completed' || task.status === 'done' || task.is_completed) {
    if (!task.completed_at) return false;
  }

  if (!task.completed_at) {
    return task.status !== 'completed' && task.status !== 'done' && !task.is_completed;
  }

  const lastDone = new Date(task.completed_at);
  const now = new Date();

  if (task.recurrence_type === 'daily') {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return lastDone < todayStart;
  }

  if (task.recurrence_type === 'weekly') {
    const days = (task.recurrence_days || []).map((d: any) => parseInt(d, 10)).filter((d: any) => !isNaN(d));
    let cycleStart = getLastWeeklyOccurrence(days, now);
    if (!cycleStart) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      cycleStart = new Date(d.setDate(diff));
    }
    return lastDone < cycleStart;
  }

  if (task.recurrence_type === 'monthly') {
    return getMonthlyTaskState(task, now) === 'pending';
  }

  return task.status !== 'completed' && task.status !== 'done';
}

interface MonthBarData {
  label: string;
  month_year: string;
  total: number;
}

interface WeekPostItem {
  id: string;
  dateKey: string;
  groupKeys?: string[];
  day: number;
  month: number;
  year: number;
  dateStr: string;
  client: {
    id: string;
    name: string;
    logo_url?: string | null;
    color?: string | null;
    initials?: string | null;
  };
  type: string;
  theme: string;
  description?: string;
  format?: string;
  platform?: string;
  status: PostStatus;
  platforms: ('meta' | 'linkedin' | 'tiktok')[];
  rawPost?: any;
}

interface WeekDayGroup {
  date: dayjs.Dayjs;
  dateKey: string;
  isToday: boolean;
  label: string;
  posts: WeekPostItem[];
}

interface HomeTabProps {
  onNavigateToClients: (client: Client) => void;
  onNavigateToMasterMap?: (filter?: { aba?: 'dashboard' | 'publicacoes'; status?: string; periodo?: string; date?: string }) => void;
  onNavigateToPainelConteudo?: (filter?: { aba?: 'dashboard' | 'publicacoes'; status?: string; periodo?: string; date?: string }) => void;
  onNavigateToMetas?: () => void;
  onNavigateToTasks?: () => void;
  onNavigateToCRM?: () => void;
  onNavigateToFinanceiro?: (filter?: { clientId?: string; clientName?: string; monthYear?: string; subTab?: 'overview' | 'faturamento' | 'despesas' | 'indicacao' }) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  onNavigateToClients,
  onNavigateToMasterMap,
  onNavigateToPainelConteudo,
  onNavigateToMetas,
  onNavigateToTasks,
  onNavigateToCRM,
  onNavigateToFinanceiro
}) => {
  const { agencyId, agencyName, userName, currentUser } = useAuth();
  const [personName, setPersonName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideFinanceiro, setHideFinanceiro] = useState(false);

  // Modal de edição / visualização de post
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{
    dayContent: DailyContent;
    dateKey: string;
    groupKeys?: string[];
    isNew?: boolean;
    clientOverride?: any;
  } | null>(null);

  // Dados financeiros locais
  const [totalContratado, setTotalContratado] = useState(0);
  const [totalRecebido, setTotalRecebido] = useState(0);
  const [totalDespesas, setTotalDespesas] = useState(0);
  const [ultimos4Meses, setUltimos4Meses] = useState<MonthBarData[]>([]);

  // Pendências e contagens
  const [aprovacoesPendentes, setAprovacoesPendentes] = useState(0);
  const [alteracoesSolicitadas, setAlteracoesSolicitadas] = useState(0);

  // Publicações da semana
  const [publicacoesPorDia, setPublicacoesPorDia] = useState<WeekDayGroup[]>([]);
  const [totalPublicacoesSemana, setTotalPublicacoesSemana] = useState(0);

  // Tarefas urgentes
  const [tarefasUrgentes, setTarefasUrgentes] = useState<AgencyTask[]>([]);

  // CRM
  const [etapasCRM, setEtapasCRM] = useState<{ nome: string; total: number; cor: string }[]>([]);

  // Metas do Mês vindas do hook
  const {
    goal,
    newClientsCount,
    meetingsCount,
    postsCount,
    blogPostsCount,
    pctFaturamento: pctFaturamentoHook,
    recurringFaturamentoRecebido,
    faturamentoRecebido,
    mrrGoal,
    recurringRevenueGoal,
    revenueGoal
  } = useAgencyGoals();

  const metaFaturamento = revenueGoal || goal?.revenue_goal || 0;
  const metaMRR = mrrGoal || (goal?.recurring_revenue_goal !== null && goal?.recurring_revenue_goal !== undefined ? Number(goal.recurring_revenue_goal) : goal?.revenue_goal || 0);
  const metaClientes = goal?.new_clients_goal || 0;
  const metaReunioes = goal?.meetings_goal || 0;
  const metaPublicacoes = goal?.posts_goal || 0;
  const metaBlogPosts = goal?.blog_posts_goal || 0;

  const realFaturamentoTotal = faturamentoRecebido > 0 ? faturamentoRecebido : totalContratado;
  const pctFaturamento = metaFaturamento > 0 ? Math.round((realFaturamentoTotal / metaFaturamento) * 100) : (pctFaturamentoHook || 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const normalizeFormat = (format?: string) => {
    if (!format) return 'Post';
    const f = format.toLowerCase();
    if (f.includes('carrossel')) return 'Carrossel';
    if (f.includes('reels') || f.includes('video') || f.includes('vídeo')) return 'Reels';
    if (f.includes('story') || f.includes('stories')) return 'Stories';
    if (f.includes('artigo')) return 'Artigo';
    return format;
  };

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const d = dayjs(dateStr);
    const today = dayjs();
    if (d.isSame(today, 'day')) return 'Hoje';
    if (d.isSame(today.add(1, 'day'), 'day')) return 'Amanhã';
    if (d.isSame(today.subtract(1, 'day'), 'day')) return 'Ontem';
    return d.format('DD/MM');
  };

  const fetchData = async () => {
    if (!agencyId) return;
    try {
      setLoading(true);
      const currentMonthYear = dayjs().format('YYYY-MM');

      // Gerar os últimos 4 meses para consulta e gráfico
      const mesesObj = Array.from({ length: 4 }, (_, i) => {
        const d = dayjs().subtract(3 - i, 'month');
        return {
          label: d.format('MMM').replace('.', ''),
          month_year: d.format('YYYY-MM'),
        };
      });

      const [
        { data: allMonthBillings },
        { data: fourMonthsBillings },
        { data: tempExpenses },
        { data: tempTasks },
        { data: tempCrms },
        { data: tempLeads },
        { data: tempPosts },
        agencyUserResult
      ] = await Promise.all([
        supabase.from('agency_billing')
          .select('total_value, base_value, extra_value, status, client:clients(is_internal)')
          .eq('agency_id', agencyId)
          .eq('month_year', currentMonthYear),
        supabase.from('agency_billing')
          .select('month_year, total_value, base_value, extra_value, client:clients(is_internal)')
          .eq('agency_id', agencyId)
          .in('month_year', mesesObj.map(m => m.month_year)),
        supabase.from('agency_expenses')
          .select('*')
          .eq('agency_id', agencyId)
          .not('is_deleted', 'is', true),
        supabase.from('agency_tasks')
          .select('*, client:clients(id, name, color, initials, client_status)')
          .eq('agency_id', agencyId)
          .neq('status', 'deleted')
          .order('due_date', { ascending: true }),
        supabase.from('agency_crms')
          .select('*')
          .eq('agency_id', agencyId)
          .order('position', { ascending: true }),
        supabase.from('agency_leads')
          .select('*')
          .eq('agency_id', agencyId)
          .neq('stage', 'Perdido'),
        supabase.from('posts')
          .select(`
            *,
            clients:client_id (
              id,
              name,
              logo_url,
              color,
              initials,
              client_status,
              cancelled_at
            )
          `)
          .eq('agency_id', agencyId)
          .neq('status', 'deleted')
          .limit(10000),
        supabase.from('agency_users')
          .select('name')
          .eq('agency_id', agencyId)
          .limit(1)
          .maybeSingle()
      ]);

      if (agencyUserResult?.data?.name) {
        setPersonName(agencyUserResult.data.name);
      }

      // 1. Financeiro do mês atual
      let contratado = 0;
      let recebido = 0;

      (allMonthBillings || []).forEach((b: any) => {
        if (b.client && b.client.is_internal) return;
        const val = Number(b.total_value) || (Number(b.base_value || 0) + Number(b.extra_value || 0));
        contratado += val;
        if (b.status === 'paid') {
          recebido += val;
        }
      });

      let despesas = 0;
      if (tempExpenses) {
        const parsedExpenses = tempExpenses.map(parseExpenseRow);
        const activeMonthExpenses = filterExpensesForMonth(parsedExpenses, currentMonthYear);
        despesas = activeMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      }

      setTotalContratado(contratado);
      setTotalRecebido(recebido);
      setTotalDespesas(despesas);

      // 2. Gráfico dos últimos 4 meses
      const chartData: MonthBarData[] = mesesObj.map(m => {
        const monthBills = (fourMonthsBillings || []).filter((b: any) => {
          if (b.client && b.client.is_internal) return false;
          return b.month_year === m.month_year;
        });
        const total = monthBills.reduce((sum: number, b: any) => {
          const val = Number(b.total_value) || (Number(b.base_value || 0) + Number(b.extra_value || 0));
          return sum + val;
        }, 0);
        return {
          label: m.label.toUpperCase(),
          month_year: m.month_year,
          total
        };
      });
      setUltimos4Meses(chartData);

      // 3. Posts válidos e pendências
      const validPosts = (tempPosts || []).filter((post: any) => {
        if (post.is_deleted) return false;
        if (post.status === 'deleted') return false;

        if (post.clients?.client_status === 'cancelled' && post.clients?.cancelled_at) {
          const parts = (post.date_key || '').split('-');
          if (parts.length >= 3) {
            const postDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            if (postDateStr > post.clients.cancelled_at) {
              return false;
            }
          }
        }
        return true;
      });

      let pendentesCount = 0;
      let alteracaoCount = 0;

      validPosts.forEach((post: any) => {
        if (post.status === 'pending_approval' || post.status === 'theme_pending') {
          pendentesCount++;
        } else if (post.status === 'changes_requested') {
          alteracaoCount++;
        }
      });

      setAprovacoesPendentes(pendentesCount);
      setAlteracoesSolicitadas(alteracaoCount);

      // 4. Publicações desta semana (próximos 7 dias)
      const today = dayjs();
      const weekGroupsList: WeekDayGroup[] = [];
      let totalSemana = 0;

      for (let i = 0; i < 7; i++) {
        const dObj = today.add(i, 'day');
        const dDay = dObj.date();
        const dMonth = dObj.month() + 1;
        const dYear = dObj.year();
        const isToday = i === 0;

        const dayPosts = validPosts.filter((post: any) => {
          const parts = (post.date_key || '').split('-');
          if (parts.length < 3) return false;
          return parseInt(parts[0], 10) === dDay && 
                 parseInt(parts[1], 10) === dMonth && 
                 parseInt(parts[2], 10) === dYear;
        });

        // Agrupar posts com mesmo cliente e tema
        const groupedMap: Record<string, WeekPostItem> = {};

        dayPosts.forEach((post: any) => {
          const parts = post.date_key.split('-');
          const platform = (parts[3] || 'meta') as 'meta' | 'linkedin' | 'tiktok';
          const cleanTheme = (post.theme || post.theme_title || 'Sem tema definido').trim().toLowerCase();
          const clientId = post.client_id || post.clients?.id || 'unknown';
          const gKey = `${clientId}-${cleanTheme}`;

          const clientData = post.clients || {
            id: clientId,
            name: 'Cliente',
            logo_url: null,
            color: '#13284D',
            initials: 'CL'
          };

          if (!groupedMap[gKey]) {
            groupedMap[gKey] = {
              id: post.id || post.date_key,
              dateKey: post.date_key,
              groupKeys: [post.date_key],
              day: dDay,
              month: dMonth,
              year: dYear,
              dateStr: dObj.format('YYYY-MM-DD'),
              client: {
                id: clientData.id,
                name: clientData.name || 'Canguru Digital',
                logo_url: clientData.logo_url,
                color: clientData.color || '#13284D',
                initials: clientData.initials
              },
              type: post.type || 'Post',
              format: post.type || post.format || 'Post',
              platform: platform,
              theme: post.theme || post.theme_title || 'Sem tema definido',
              description: post.theme || post.caption || post.title || '',
              status: post.status as PostStatus,
              platforms: [platform],
              rawPost: post
            };
          } else {
            if (groupedMap[gKey].groupKeys && !groupedMap[gKey].groupKeys.includes(post.date_key)) {
              groupedMap[gKey].groupKeys.push(post.date_key);
            }
            if (!groupedMap[gKey].platforms.includes(platform)) {
              groupedMap[gKey].platforms.push(platform);
            }
          }
        });

        const dayItems = Object.values(groupedMap);
        totalSemana += dayItems.length;

        if (dayItems.length > 0) {
          weekGroupsList.push({
            date: dObj,
            dateKey: dObj.format('YYYY-MM-DD'),
            isToday,
            label: isToday ? 'Hoje' : dObj.format("ddd, D [de] MMM"),
            posts: dayItems
          });
        }
      }

      setPublicacoesPorDia(weekGroupsList);
      setTotalPublicacoesSemana(totalSemana);

      // 5. Tarefas Urgentes
      const pTasks = (tempTasks || []) as any[];
      const pendingTasks = pTasks.filter(t => isTaskPendingInCurrentCycle(t));

      const filteredTasks = pendingTasks.filter(t => {
        const p = (t.priority || '').toLowerCase();
        const isHighOrUrgent = p === 'alta' || p === 'urgente' || p === 'high' || p === 'urgent';
        if (isHighOrUrgent) return true;
        if (!t.due_date) return false;
        return dayjs(t.due_date).isBefore(dayjs().add(3, 'day'), 'day') || dayjs(t.due_date).isSame(dayjs().add(3, 'day'), 'day');
      });

      filteredTasks.sort((a, b) => {
        // Tarefas com due_date vêm primeiro ordenadas pela data (mais atrasadas ou mais próximas primeiro)
        if (a.due_date && b.due_date) {
          return dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf();
        }
        if (a.due_date) return -1;
        if (b.due_date) return 1;

        // Se nenhuma tiver due_date, prioridade urgente vem antes de alta
        const pOrder: Record<string, number> = { 'urgente': 1, 'urgent': 1, 'alta': 2, 'high': 2, 'normal': 3, 'media': 3, 'baixa': 4, 'low': 4 };
        const orderA = pOrder[(a.priority || '').toLowerCase()] || 99;
        const orderB = pOrder[(b.priority || '').toLowerCase()] || 99;
        return orderA - orderB;
      });

      setTarefasUrgentes(filteredTasks.slice(0, 5));

      // 6. Funil CRM
      const leads = tempLeads || [];
      const crms = (tempCrms || []) as AgencyCRM[];

      if (crms.length > 0) {
        // Coletar estágios principais dos boards
        const stagesList: { nome: string; total: number; cor: string }[] = [];
        const colors = ['#13284D', '#20364D', '#8A8F98', '#d97706', '#16a34a'];

        crms.forEach((board, idx) => {
          const boardLeads = leads.filter(l => l.crm_id === board.id);
          stagesList.push({
            nome: board.name,
            total: boardLeads.length,
            cor: colors[idx % colors.length]
          });
        });
        setEtapasCRM(stagesList);
      } else {
        // Fallback genérico para etapas de leads
        const stageCounts: Record<string, number> = {};
        leads.forEach(l => {
          stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1;
        });
        const stagesList = Object.keys(stageCounts).map((st, i) => ({
          nome: st,
          total: stageCounts[st],
          cor: ['#13284D', '#20364D', '#8A8F98', '#16a34a', '#d97706'][i % 5]
        }));
        setEtapasCRM(stagesList);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('home_tab_brand_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_tasks', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_crms', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_leads', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_billing', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_expenses', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId]);

  const handleOpenPost = (item: WeekPostItem) => {
    const dayStr = item.day < 10 ? `0${item.day}` : `${item.day}`;
    const monthStr = item.month < 10 ? `0${item.month}` : `${item.month}`;

    const dayContent: DailyContent = {
      day: `${dayStr}/${monthStr}`,
      platform: item.platforms[0] || 'meta',
      type: item.type,
      theme: item.theme,
      bullets: item.rawPost?.bullets || [],
      initialImageUrl: item.rawPost?.image_url || undefined
    };

    setSelectedPost({
      dayContent,
      dateKey: item.dateKey,
      groupKeys: item.groupKeys || [item.dateKey],
      clientOverride: item.client,
      isNew: false
    });
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" style={{ background: BRAND.brancoQuente, padding: '32px', borderRadius: 24 }}>
        <div className="h-32 rounded-2xl" style={{ background: 'linear-gradient(135deg, #0F1115 0%, #13284D 60%, #20364D 100%)' }} />
        <div className="h-64 rounded-2xl bg-white" />
        <div className="h-48 rounded-2xl bg-white" />
      </div>
    );
  }

  // Dados para Saudação e Cabeçalho
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const rawName = personName || userName || currentUser?.name || (agencyName && !agencyName.toLowerCase().includes('canguru') ? agencyName : null) || 'Wesley';
  const nomeUsuario = rawName.trim().split(' ')[0] || 'Wesley';
  const diaSemana = dayjs().format('dddd');
  const dataFormatada = dayjs().format('D [de] MMMM');
  const nomeMes = dayjs().format('MMMM');
  const anoAtual = dayjs().year();
  const mesAno = dayjs().format('MM/YYYY');

  return (
    <div style={{ background: BRAND.brancoQuente, minHeight: '100%', borderRadius: 24, overflow: 'hidden' }} className="space-y-8 pb-12">
      
      {/* SEÇÃO 1 — HERO HEADER */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0F1115 0%, #13284D 60%, #20364D 100%)',
          padding: '28px 32px',
        }}
      >
        {/* Linhas de circuito no canto superior direito */}
        <div className="absolute top-0 right-0">
          <CircuitLines />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          {/* Saudação */}
          <div>
            <p style={{ color: '#8A8F98', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              {diaSemana}, {dataFormatada}
            </p>
            <h1 style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
              {saudacao}, {nomeUsuario}
            </h1>
            <p style={{ color: '#8A8F98', fontSize: 13, marginTop: 4 }}>
              Canguru Digital · Painel de controle
            </p>
          </div>

          {/* Pills de status — só aparecem se houver pendências */}
          <div className="flex flex-wrap items-center gap-3">
            {aprovacoesPendentes > 0 && (
              <button
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 20,
                  padding: '8px 16px',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                className="hover:bg-white/20 active:scale-95"
                onClick={() => (onNavigateToPainelConteudo || onNavigateToMasterMap)?.({ aba: 'publicacoes', status: 'pending_approval' })}
              >
                {aprovacoesPendentes} {aprovacoesPendentes === 1 ? 'aguardando aprovação' : 'aguardando aprovação'}
              </button>
            )}
            {alteracoesSolicitadas > 0 && (
              <button
                style={{
                  background: 'rgba(239,68,68,0.2)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: 20,
                  padding: '8px 16px',
                  color: '#fca5a5',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                className="hover:bg-rose-900/40 active:scale-95"
                onClick={() => (onNavigateToPainelConteudo || onNavigateToMasterMap)?.({ aba: 'publicacoes', status: 'changes_requested' })}
              >
                {alteracoesSolicitadas} {alteracoesSolicitadas === 1 ? 'alteração solicitada' : 'alterações solicitadas'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PAINEL DE PENDÊNCIAS OPERACIONAIS */}
      <PendenciasPanel
        onNavigateToClients={onNavigateToClients}
        onNavigateToPainelConteudo={onNavigateToPainelConteudo}
        onNavigateToMasterMap={onNavigateToMasterMap}
        onNavigateToMetas={onNavigateToMetas}
        onNavigateToTasks={onNavigateToTasks}
        onNavigateToFinanceiro={onNavigateToFinanceiro}
      />

      {/* SEÇÃO 2 — PAINEL FINANCEIRO */}
      <div style={{ padding: '0 32px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #0F1115 0%, #13284D 60%, #20364D 100%)',
            borderRadius: 16,
            padding: '28px 32px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Linhas decorativas no canto inferior direito */}
          <div className="absolute bottom-0 right-0 rotate-180">
            <CircuitLines />
          </div>

          {/* Header da seção */}
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span style={{ color: '#8A8F98', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Financeiro · {mesAno}
            </span>
            <button
              onClick={() => setHideFinanceiro(!hideFinanceiro)}
              style={{
                color: '#8A8F98',
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              className="hover:bg-white/15 transition-all"
            >
              {hideFinanceiro ? <Eye size={14} /> : <EyeOff size={14} />}
              {hideFinanceiro ? 'Mostrar' : 'Ocultar'}
            </button>
          </div>

          {/* Grid principal: MRR grande à esquerda + métricas à direita */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">

            {/* MRR CONTRATADO — coluna larga */}
            <div className="lg:col-span-2 flex flex-col justify-between">
              <div>
                <p style={{ color: '#8A8F98', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                  MRR Contratado
                </p>
                <p style={{
                  color: '#FFFFFF',
                  fontSize: hideFinanceiro ? 32 : 42,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  filter: hideFinanceiro ? 'blur(12px)' : 'none',
                  userSelect: hideFinanceiro ? 'none' : 'auto',
                  transition: 'filter 0.3s'
                }}>
                  {formatCurrency(recurringFaturamentoRecebido)}
                </p>
                <p style={{ color: '#8A8F98', fontSize: 12, marginTop: 8 }}>
                  META:{' '}
                  <span style={{
                    filter: hideFinanceiro ? 'blur(8px)' : 'none',
                    userSelect: hideFinanceiro ? 'none' : 'auto',
                    transition: 'filter 0.3s'
                  }}>
                    {formatCurrency(metaMRR)}
                  </span>
                  {metaMRR > 0 && (
                    recurringFaturamentoRecebido >= metaMRR
                      ? ' · ✓ Meta atingida'
                      : (
                        <>
                          {' · faltam '}
                          <span style={{
                            filter: hideFinanceiro ? 'blur(8px)' : 'none',
                            userSelect: hideFinanceiro ? 'none' : 'auto',
                            transition: 'filter 0.3s'
                          }}>
                            {formatCurrency(Math.max(0, metaMRR - recurringFaturamentoRecebido))}
                          </span>
                        </>
                      )
                  )}
                </p>
              </div>

              {/* Mini gráfico de barras dos últimos 4 meses */}
              <div style={{ marginTop: 20 }}>
                <div style={{ height: 60 }}>
                  <ResponsiveContainer width="100%" height={60}>
                    <BarChart data={ultimos4Meses} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                        {ultimos4Meses.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === ultimos4Meses.length - 1 ? '#FFFFFF' : '#20364D'}
                            fillOpacity={index === ultimos4Meses.length - 1 ? 0.95 : 0.6}
                          />
                        ))}
                      </Bar>
                      <Tooltip
                        formatter={(value) => [hideFinanceiro ? 'R$ ••••••••' : formatCurrency(Number(value)), 'Faturamento']}
                        contentStyle={{ background: '#0F1115', border: '1px solid #20364D', borderRadius: 8, fontSize: 12, color: '#fff' }}
                        labelStyle={{ color: '#8A8F98', fontSize: 11 }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between" style={{ marginTop: 6 }}>
                  {ultimos4Meses.map((m, i) => (
                    <span key={i} style={{ color: '#8A8F98', fontSize: 10, fontWeight: 600 }}>{m.label}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Métricas secundárias — coluna direita */}
            <div className="flex flex-col justify-center gap-3">
              {[
                { label: 'Recebido', value: totalRecebido, icon: '↑', iconColor: '#4ade80' },
                { label: 'Despesas', value: totalDespesas, icon: '↓', iconColor: '#f87171' },
                { label: 'Saldo', value: totalRecebido - totalDespesas, icon: (totalRecebido - totalDespesas) >= 0 ? '+' : '-', iconColor: (totalRecebido - totalDespesas) >= 0 ? '#4ade80' : '#f87171' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex items-center justify-between">
                    <p style={{ color: '#8A8F98', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {item.label}
                    </p>
                    <span style={{ color: item.iconColor, fontSize: 14, fontWeight: 700 }}>{item.icon}</span>
                  </div>
                  <p style={{
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: 700,
                    marginTop: 4,
                    filter: hideFinanceiro ? 'blur(8px)' : 'none',
                    userSelect: hideFinanceiro ? 'none' : 'auto',
                    transition: 'filter 0.3s'
                  }}>
                    {formatCurrency(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3 — METAS DO MÊS */}
      <div style={{ padding: '0 32px' }}>
        {/* Header da seção */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p style={{ color: '#8A8F98', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
              Metas
            </p>
            <h2 style={{ color: '#13284D', fontSize: 20, fontWeight: 700, textTransform: 'capitalize' }}>
              {nomeMes} {anoAtual}
            </h2>
          </div>
          <button
            onClick={() => onNavigateToMetas?.()}
            style={{
              color: '#13284D',
              fontSize: 13,
              fontWeight: 600,
              background: 'none',
              border: '1px solid #13284D',
              borderRadius: 8,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
            className="hover:bg-[#13284D]/5 active:scale-95 transition-all"
          >
            Ver detalhes
          </button>
        </div>

        {/* Faturamento — barra principal destacada */}
        <div
          style={{ background: '#FFFFFF', borderRadius: 12, padding: '20px 24px', marginBottom: 16, border: '1px solid rgba(19,40,77,0.08)' }}
          className="shadow-2xs"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p style={{ color: '#8A8F98', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Faturamento
              </p>
              <div className="flex items-baseline gap-3" style={{ marginTop: 4 }}>
                <span style={{
                  color: '#13284D',
                  fontSize: 24,
                  fontWeight: 700,
                  filter: hideFinanceiro ? 'blur(8px)' : 'none',
                  userSelect: hideFinanceiro ? 'none' : 'auto',
                  transition: 'filter 0.3s ease',
                }}>
                  {formatCurrency(realFaturamentoTotal)}
                </span>
                <span style={{
                  color: '#8A8F98',
                  fontSize: 14,
                  filter: hideFinanceiro ? 'blur(8px)' : 'none',
                  userSelect: hideFinanceiro ? 'none' : 'auto',
                  transition: 'filter 0.3s ease',
                }}>
                  de {formatCurrency(metaFaturamento)}
                </span>
              </div>
            </div>
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: `conic-gradient(#13284D ${Math.min(pctFaturamento, 100) * 3.6}deg, #F4F3EF 0deg)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#13284D', fontSize: 12, fontWeight: 700 }}>{pctFaturamento}%</span>
              </div>
            </div>
          </div>

          {/* Barra de progresso */}
          <div style={{ height: 6, background: '#F4F3EF', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(pctFaturamento, 100)}%`,
                background: 'linear-gradient(90deg, #13284D, #20364D)',
                borderRadius: 3,
                transition: 'width 0.8s ease',
              }}
            />
          </div>
          <p style={{ color: pctFaturamento >= 80 ? '#16a34a' : '#8A8F98', fontSize: 12, marginTop: 8, fontWeight: 600 }}>
            {pctFaturamento >= 100 ? '✓ Meta atingida!' : pctFaturamento >= 80 ? 'No ritmo certo' : 'Precisa acelerar'}
          </p>
        </div>

        {/* Grid das metas secundárias */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Reuniões', atual: meetingsCount, meta: metaReunioes, icon: <Calendar size={16} /> },
            { label: 'Publicações', atual: postsCount, meta: metaPublicacoes, icon: <ImageIcon size={16} /> },
            { label: 'Posts no Blog', atual: blogPostsCount, meta: metaBlogPosts, icon: <FileText size={16} /> },
          ].map((item) => {
            const pct = item.meta > 0 ? Math.min(Math.round((item.atual / item.meta) * 100), 100) : 0;
            return (
              <div
                key={item.label}
                style={{ background: '#FFFFFF', borderRadius: 12, padding: '16px 18px', border: '1px solid rgba(19,40,77,0.08)' }}
                className="shadow-2xs"
              >
                <div className="flex items-center gap-2 mb-3" style={{ color: '#13284D' }}>
                  {item.icon}
                  <p style={{ color: '#8A8F98', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {item.label}
                  </p>
                </div>
                <p style={{ color: '#13284D', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                  {item.atual}
                  <span style={{ color: '#8A8F98', fontSize: 14, fontWeight: 400 }}> / {item.meta}</span>
                </p>
                <div style={{ height: 4, background: '#F4F3EF', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: '#13284D',
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO 4 — PUBLICAÇÕES DESTA SEMANA */}
      <div style={{ padding: '0 32px' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p style={{ color: '#8A8F98', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
              Esta semana
            </p>
            <h2 style={{ color: '#13284D', fontSize: 20, fontWeight: 700 }}>Publicações</h2>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ color: '#8A8F98', fontSize: 13 }}>
              {totalPublicacoesSemana} {totalPublicacoesSemana === 1 ? 'publicação' : 'publicações'}
            </span>
            {(onNavigateToPainelConteudo || onNavigateToMasterMap) && (
              <button
                onClick={() => (onNavigateToPainelConteudo || onNavigateToMasterMap)?.({ aba: 'publicacoes', periodo: 'esta_semana' })}
                style={{ color: '#13284D', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                className="hover:underline"
              >
                <span>Ver todas</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Grupos por dia */}
        {publicacoesPorDia.map((grupo) => (
          <div key={grupo.dateKey} style={{ marginBottom: 20 }}>
            {/* Label do dia */}
            <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
              <div
                style={{
                  background: grupo.isToday ? '#13284D' : 'transparent',
                  border: `1px solid ${grupo.isToday ? '#13284D' : 'rgba(19,40,77,0.2)'}`,
                  borderRadius: 20,
                  padding: '3px 12px',
                  color: grupo.isToday ? '#FFFFFF' : '#13284D',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'capitalize'
                }}
              >
                {grupo.label}
              </div>
              <div style={{ flex: 1, height: 1, background: 'rgba(19,40,77,0.08)' }} />
            </div>

            {/* Cards dos posts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {grupo.posts.map((post) => (
                <div
                  key={post.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 10,
                    padding: '14px 16px',
                    border: '1px solid rgba(19,40,77,0.07)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  className="hover:border-[#13284D]/30 hover:shadow-2xs"
                  onClick={() => handleOpenPost(post)}
                >
                  {/* Header do card */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      {/* Badge do cliente — bolinha colorida + nome */}
                      <div
                        style={{ width: 8, height: 8, borderRadius: '50%', background: post.client?.color ?? '#8A8F98', flexShrink: 0 }}
                      />
                      <span style={{ color: '#13284D', fontSize: 12, fontWeight: 700 }} className="truncate">
                        {post.client?.name ?? 'Canguru Digital'}
                      </span>
                    </div>
                    {/* Status badge */}
                    <StatusBadge status={post.status} />
                  </div>

                  {/* Formato e plataforma */}
                  <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                    <span
                      style={{
                        background: '#F4F3EF',
                        color: '#8A8F98',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        borderRadius: 4,
                        padding: '2px 7px',
                      }}
                    >
                      {post.platform ?? 'Instagram'}
                    </span>
                    <span
                      style={{
                        background: '#F4F3EF',
                        color: '#8A8F98',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        borderRadius: 4,
                        padding: '2px 7px',
                      }}
                    >
                      {normalizeFormat(post.format)}
                    </span>
                  </div>

                  {/* Descrição */}
                  {post.description && (
                    <p style={{
                      color: '#8A8F98',
                      fontSize: 12,
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {post.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {publicacoesPorDia.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#8A8F98' }}>
            <p style={{ fontSize: 14 }}>Nenhuma publicação programada para esta semana.</p>
          </div>
        )}
      </div>

      {/* SEÇÃO 5 — TAREFAS URGENTES + FUNIL CRM (2 COLUNAS) */}
      <div style={{ padding: '0 32px 16px' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* TAREFAS URGENTES */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '20px 24px', border: '1px solid rgba(19,40,77,0.08)' }} className="shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} color="#13284D" />
                  <p style={{ color: '#8A8F98', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Tarefas Urgentes
                  </p>
                </div>
                {onNavigateToTasks && (
                  <button
                    onClick={onNavigateToTasks}
                    style={{ color: '#13284D', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    className="hover:underline"
                  >
                    <span>Ver todas</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {tarefasUrgentes.length === 0 ? (
                <div className="py-8 text-center" style={{ color: '#8A8F98' }}>
                  <p style={{ fontSize: 13 }}>Nenhuma tarefa urgente.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {tarefasUrgentes.map((tarefa) => (
                    <div
                      key={tarefa.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 0',
                        borderBottom: '1px solid #F4F3EF',
                        cursor: 'pointer'
                      }}
                      className="hover:bg-[#F4F3EF]/30 px-2 rounded-lg transition-colors"
                      onClick={() => onNavigateToTasks?.()}
                    >
                      <div style={{ width: 3, height: 36, background: tarefa.client?.color ?? '#8A8F98', borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: '#13284D', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tarefa.title}
                        </p>
                        <p style={{ color: '#8A8F98', fontSize: 11 }}>
                          {tarefa.client?.name ?? 'Sem cliente'}
                          {tarefa.due_date && ` · ${formatDueDate(tarefa.due_date)}`}
                        </p>
                      </div>
                      <PriorityDot priority={tarefa.priority} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* FUNIL CRM */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '20px 24px', border: '1px solid rgba(19,40,77,0.08)' }} className="shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} color="#13284D" />
                  <p style={{ color: '#8A8F98', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Funil CRM
                  </p>
                </div>
                {onNavigateToCRM && (
                  <button
                    onClick={onNavigateToCRM}
                    style={{ color: '#13284D', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    className="hover:underline"
                  >
                    <span>Abrir CRM</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {/* Estágios do funil */}
              {etapasCRM.length === 0 ? (
                <div className="py-8 text-center" style={{ color: '#8A8F98' }}>
                  <p style={{ fontSize: 13 }}>Nenhum lead no funil.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {etapasCRM.map((etapa) => (
                    <div
                      key={etapa.nome}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, cursor: onNavigateToCRM ? 'pointer' : 'default' }}
                      onClick={() => onNavigateToCRM?.()}
                      className="hover:bg-[#F4F3EF]/30 px-2 py-1 rounded-lg transition-colors"
                    >
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: etapa.cor, flexShrink: 0 }} />
                      <p style={{ color: '#13284D', fontSize: 13, flex: 1, fontWeight: 500 }} className="truncate">
                        {etapa.nome}
                      </p>
                      <span
                        style={{
                          background: '#F4F3EF',
                          color: '#13284D',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 20,
                          padding: '2px 10px',
                          minWidth: 28,
                          textAlign: 'center'
                        }}
                      >
                        {etapa.total}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* POST MODAL PARA VISUALIZAÇÃO / EDIÇÃO DIRETA */}
      {modalOpen && selectedPost && (
        <PostModal
          dayContent={selectedPost.dayContent}
          dateKey={selectedPost.dateKey}
          groupKeys={selectedPost.groupKeys}
          isNew={selectedPost.isNew}
          clientOverride={selectedPost.clientOverride}
          isMasterMap={true}
          onClose={() => {
            setModalOpen(false);
            setSelectedPost(null);
          }}
          onUpdate={() => {
            fetchData();
            setModalOpen(false);
            setSelectedPost(null);
          }}
        />
      )}

    </div>
  );
};

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, useAuth } from '../../lib/supabase';
import { autoPublishPastScheduledPosts } from '../../lib/scheduledPostsUtils';
import { STATUS_CONFIG } from '../../constants';
import { PostStatus, DailyContent, Client } from '../../types';
import { PostModal } from '../PostModal';
import { MonthDetail } from '../MonthDetail';
import { NameGateScreen } from '../NameGateScreen';
import { useEditorialData, MONTH_NAMES } from '../../hooks/useEditorialData';
import { 
  LayoutDashboard, 
  ListFilter, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  Search, 
  Sparkles, 
  TrendingUp, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Instagram, 
  Linkedin, 
  Video, 
  ArrowUpRight, 
  ChevronRight, 
  RefreshCw,
  Filter,
  Layers,
  FileText,
  Calendar,
  Lock,
  ArrowRight,
  Plus
} from 'lucide-react';
import { CustomDropdown, CustomDropdownOption } from '../CustomDropdown';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line 
} from 'recharts';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

interface ClientPainelConteudoProps {
  onBackToHome?: () => void;
  initialTab?: 'dashboard' | 'publicacoes' | 'mapa';
  initialFilterStatus?: string;
  initialFilterPeriod?: string;
  overrideClient?: Client | null;
  titleOverride?: string;
  subtitleOverride?: string;
  isNossoConteudo?: boolean;
}

interface GroupedPostItem {
  id: string;
  primaryKey: string;
  keys: string[];
  day: number;
  month: number;
  year: number;
  dateStr: string;
  formattedDate: string;
  platforms: ('meta' | 'linkedin' | 'tiktok')[];
  type: string;
  theme: string;
  status: PostStatus;
  scheduled_time?: string | null;
  rawPosts: any[];
}

const MONTH_SHORT_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const FORMAT_COLORS: Record<string, string> = {
  'Reels': '#7C3AED',
  'Carrossel': '#2563EB',
  'Estático': '#059669',
  'Story': '#DB2777',
  'Vídeo': '#4F46E5',
  'Texto': '#D97706',
  'Repost': '#0D9488',
  'Outro': '#6B7280'
};

const PALETTE_FALLBACK = [
  '#7C3AED',
  '#2563EB',
  '#059669',
  '#DB2777',
  '#4F46E5',
  '#D97706',
  '#0D9488',
  '#EA580C',
  '#0284C7',
  '#6B7280'
];

type PeriodFilterType = 'este_mes' | 'ultimos_2_meses' | 'ultimos_3_meses' | 'este_ano' | 'todo_periodo';

export const ClientPainelConteudo: React.FC<ClientPainelConteudoProps> = ({
  onBackToHome,
  initialTab,
  initialFilterStatus,
  initialFilterPeriod,
  overrideClient,
  titleOverride,
  subtitleOverride,
  isNossoConteudo
}) => {
  const { activeClient: authActiveClient, userRole } = useAuth();
  const activeClient = overrideClient !== undefined ? overrideClient : authActiveClient;
  const { monthlyPlans } = useEditorialData(activeClient?.id);
  const currentYear = dayjs().year();
  const currentMonthNum = dayjs().month() + 1; // 1-12

  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const abaParam = searchParams.get('aba');
  const mesParam = searchParams.get('mes');
  const anoParam = searchParams.get('ano');
  const gateParam = searchParams.get('gate');

  // Portão de Nome
  const [showGate, setShowGate] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const hasGate = gateParam === 'nome';
    const hasVisitor = !!sessionStorage.getItem('visitor_name');
    return hasGate && !hasVisitor;
  });

  // Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'publicacoes' | 'mapa'>(() => {
    if (abaParam === 'mapa') return 'mapa';
    if (abaParam === 'publicacoes') return 'publicacoes';
    if (abaParam === 'dashboard') return 'dashboard';
    return initialTab || 'dashboard';
  });

  // Month for Mapa Editorial
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (mesParam) {
      const parsed = parseInt(mesParam, 10);
      if (parsed >= 1 && parsed <= 12) {
        return MONTH_NAMES[parsed - 1];
      }
    }
    return MONTH_NAMES[dayjs().month()];
  });

  // Filtro de período do Dashboard
  const [dashboardPeriod, setDashboardPeriod] = useState<PeriodFilterType>('este_mes');

  // Filtros da aba Publicações
  const [filterStatus, setFilterStatus] = useState<string>(initialFilterStatus || 'all');
  const [filterPeriod, setFilterPeriod] = useState<string>(initialFilterPeriod || 'este_mes');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialFilterStatus) {
      setFilterStatus(initialFilterStatus);
    }
  }, [initialFilterStatus]);

  // Dados
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de edição / visualização de Post
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{
    dayContent: DailyContent;
    dateKey: string;
    groupKeys?: string[];
  } | null>(null);

  // Buscar todas as publicações do cliente
  const fetchPosts = useCallback(async () => {
    if (!activeClient?.id) {
      setLoading(false);
      setPosts([]);
      return;
    }
    try {
      setLoading(true);

      // Buscar posts do cliente
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('client_id', activeClient.id)
        .neq('status', 'deleted')
        .limit(10000);

      if (error) throw error;

      if (data) {
        const valid = data.filter((post: any) => !post.is_deleted && post.status !== 'deleted');
        
        // Auto publicar posts agendados que já passaram da hora
        const updated = await autoPublishPastScheduledPosts(valid);
        setPosts(updated);
      }
    } catch (e) {
      console.error('Erro ao buscar publicações do cliente:', e);
    } finally {
      setLoading(false);
    }
  }, [activeClient?.id]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Realtime subscription para atualizar quando houver mudanças de posts
  useEffect(() => {
    if (!activeClient?.id) return;

    const channel = supabase
      .channel(`client_posts_${activeClient.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `client_id=eq.${activeClient.id}` }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeClient?.id, fetchPosts]);

  // Handler para criar nova publicação (Admin / Nosso Conteúdo)
  const handleCreateNewPost = () => {
    if (!activeClient?.id) return;
    const todayFormatted = dayjs().format('DD-MM-YYYY');
    const newKey = `${todayFormatted}-meta-${activeClient.id}-${Date.now()}`;
    setSelectedPost({
      dayContent: {
        day: dayjs().format('DD/MM'),
        platform: 'meta',
        type: 'Estático',
        theme: 'Nova Publicação',
        bullets: []
      },
      dateKey: newKey,
      groupKeys: [newKey]
    });
    setModalOpen(true);
  };
  const normalizePostType = (rawType?: string | null): string => {
    if (!rawType) return 'Estático';
    const lower = rawType.toLowerCase();
    if (lower.includes('artigo')) return 'Artigo';
    if (lower.includes('reel')) return 'Reels';
    if (lower.includes('carrossel')) return 'Carrossel';
    if (lower.includes('story') || lower.includes('stories')) return 'Story';
    if (lower.includes('vídeo') || lower.includes('video')) return 'Vídeo';
    if (lower.includes('estático') || lower.includes('estatico')) return 'Estático';
    if (lower.includes('texto')) return 'Post Texto';
    if (lower.includes('repost')) return 'Repost';
    return rawType;
  };

  // Processamento de métricas e gráficos para o Dashboard
  const { 
    dashboardSummary, 
    monthlyBarData, 
    typePieData, 
    monthlyTrendData,
    filteredPeriodLabel
  } = useMemo(() => {
    let totalNoPeriodo = 0;
    let publicadosNoPeriodo = 0;
    let totalAguardandoAprovacao = 0; // sempre atual
    let totalAlteracaoSolicitada = 0; // sempre atual

    const now = dayjs();

    // Encontrar datas extremas (mínima e máxima) entre todas as postagens do cliente
    let earliestPostDate: dayjs.Dayjs | null = null;
    let latestPostDate: dayjs.Dayjs | null = null;

    posts.forEach((p) => {
      const parts = (p.date_key || '').split('-');
      if (parts.length >= 3) {
        const pDay = parseInt(parts[0], 10);
        const pMonth = parseInt(parts[1], 10);
        const pYear = parseInt(parts[2], 10);
        if (!isNaN(pDay) && !isNaN(pMonth) && !isNaN(pYear)) {
          const d = dayjs(`${pYear}-${String(pMonth).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`);
          if (d.isValid()) {
            if (!earliestPostDate || d.isBefore(earliestPostDate)) {
              earliestPostDate = d;
            }
            if (!latestPostDate || d.isAfter(latestPostDate)) {
              latestPostDate = d;
            }
          }
        }
      }
    });

    // Determinar intervalo de datas do Dashboard
    let startDate: dayjs.Dayjs;
    let endDate: dayjs.Dayjs = now.endOf('month');
    let periodLabel = 'Este mês';
    let monthsToInclude: { year: number; month: number; label: string }[] = [];

    if (dashboardPeriod === 'este_mes') {
      startDate = now.startOf('month');
      endDate = now.endOf('month');
      periodLabel = `${MONTH_NAMES[now.month()]} de ${now.year()}`;
      monthsToInclude.push({
        year: now.year(),
        month: now.month() + 1,
        label: `${MONTH_SHORT_NAMES[now.month()]}/${String(now.year()).slice(2)}`
      });
    } else if (dashboardPeriod === 'ultimos_2_meses') {
      startDate = now.subtract(1, 'month').startOf('month');
      endDate = now.endOf('month');
      periodLabel = 'Últimos 2 meses';
      const m1 = now.subtract(1, 'month');
      monthsToInclude.push({
        year: m1.year(),
        month: m1.month() + 1,
        label: `${MONTH_SHORT_NAMES[m1.month()]}/${String(m1.year()).slice(2)}`
      });
      monthsToInclude.push({
        year: now.year(),
        month: now.month() + 1,
        label: `${MONTH_SHORT_NAMES[now.month()]}/${String(now.year()).slice(2)}`
      });
    } else if (dashboardPeriod === 'ultimos_3_meses') {
      startDate = now.subtract(2, 'month').startOf('month');
      endDate = now.endOf('month');
      periodLabel = 'Últimos 3 meses';
      for (let i = 2; i >= 0; i--) {
        const m = now.subtract(i, 'month');
        monthsToInclude.push({
          year: m.year(),
          month: m.month() + 1,
          label: `${MONTH_SHORT_NAMES[m.month()]}/${String(m.year()).slice(2)}`
        });
      }
    } else if (dashboardPeriod === 'este_ano') {
      startDate = now.startOf('year');
      endDate = now.endOf('year');
      periodLabel = `Ano de ${now.year()}`;
      for (let m = 1; m <= 12; m++) {
        monthsToInclude.push({
          year: now.year(),
          month: m,
          label: MONTH_SHORT_NAMES[m - 1]
        });
      }
    } else {
      // todo_periodo: abrange da postagem mais antiga até o fim do período atual/futuro
      startDate = earliestPostDate ? earliestPostDate.startOf('month') : now.startOf('year');
      
      const endLimit = (latestPostDate && latestPostDate.isAfter(now))
        ? latestPostDate.endOf('month')
        : now.endOf('month');

      endDate = (latestPostDate && latestPostDate.isAfter(endLimit))
        ? latestPostDate.endOf('month')
        : endLimit;

      if (endDate.isBefore(startDate)) {
        endDate = startDate.endOf('month');
      }

      periodLabel = 'Todo o período';

      // Gerar todos os meses entre startDate e endDate
      let curr = startDate.clone();
      while (curr.isBefore(endDate) || curr.isSame(endDate, 'month')) {
        monthsToInclude.push({
          year: curr.year(),
          month: curr.month() + 1,
          label: `${MONTH_SHORT_NAMES[curr.month()]}/${String(curr.year()).slice(2)}`
        });
        curr = curr.add(1, 'month');
      }
    }

    // Inicializar mapa de meses para o gráfico de barras e linha
    const monthlyStatsMap: Record<string, {
      name: string;
      year: number;
      mes: number;
      publicado: number;
      aprovado: number;
      pendente: number;
      rascunho: number;
      total: number;
    }> = {};

    monthsToInclude.forEach(m => {
      const key = `${m.year}-${m.month}`;
      monthlyStatsMap[key] = {
        name: m.label,
        year: m.year,
        mes: m.month,
        publicado: 0,
        aprovado: 0,
        pendente: 0,
        rascunho: 0,
        total: 0
      };
    });

    // Contagem de formatos de post no período
    const typeCountMap: Record<string, number> = {};

    posts.forEach((post) => {
      const parts = (post.date_key || '').split('-');
      if (parts.length < 3) return;

      const pDay = parseInt(parts[0], 10);
      const pMonth = parseInt(parts[1], 10);
      const pYear = parseInt(parts[2], 10);

      if (isNaN(pDay) || isNaN(pMonth) || isNaN(pYear)) return;

      const postDate = dayjs(`${pYear}-${String(pMonth).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`);
      const status = post.status as PostStatus;

      // Métricas globais sem filtro de data
      if (status === 'pending_approval' || status === 'theme_pending') {
        totalAguardandoAprovacao++;
      }
      if (status === 'changes_requested') {
        totalAlteracaoSolicitada++;
      }

      // Verificar se post está no período selecionado
      const isInPeriod = !postDate.isBefore(startDate, 'day') && !postDate.isAfter(endDate, 'day');

      if (isInPeriod) {
        const isPublished = status === 'published';
        const isApproved = status === 'approved' || status === 'theme_approved' || status === 'scheduled';
        const isPending = status === 'pending_approval' || status === 'theme_pending';
        const isDraft = status === 'draft';

        // 1. Cards de Resumo no Período
        if (status !== 'deleted' && status !== 'draft') {
          totalNoPeriodo++;
        }
        if (isPublished) {
          publicadosNoPeriodo++;
        }

        // 2. Gráfico por Formato / Tipo
        const normType = normalizePostType(post.type);
        typeCountMap[normType] = (typeCountMap[normType] || 0) + 1;

        // 3. Gráfico por Mês
        const monthKey = `${pYear}-${pMonth}`;
        if (monthlyStatsMap[monthKey]) {
          if (isPublished) monthlyStatsMap[monthKey].publicado++;
          else if (isApproved) monthlyStatsMap[monthKey].aprovado++;
          else if (isPending) monthlyStatsMap[monthKey].pendente++;
          else if (isDraft) monthlyStatsMap[monthKey].rascunho++;

          monthlyStatsMap[monthKey].total++;
        }
      }
    });

    // Converter dados para Recharts
    const monthlyBarData = monthsToInclude.map(m => {
      const key = `${m.year}-${m.month}`;
      return monthlyStatsMap[key] || {
        name: m.label,
        year: m.year,
        mes: m.month,
        publicado: 0,
        aprovado: 0,
        pendente: 0,
        rascunho: 0,
        total: 0
      };
    });

    const monthlyTrendData = monthsToInclude.map(m => {
      const key = `${m.year}-${m.month}`;
      const stat = monthlyStatsMap[key];
      return {
        name: m.label,
        publicacoes: stat ? stat.total : 0
      };
    });

    // Formatar dados do gráfico de pizza por tipo
    const typeEntries = Object.entries(typeCountMap)
      .map(([name, count], index) => ({
        name,
        count,
        color: FORMAT_COLORS[name] || PALETTE_FALLBACK[index % PALETTE_FALLBACK.length]
      }))
      .sort((a, b) => b.count - a.count);

    return {
      dashboardSummary: {
        totalNoPeriodo,
        publicadosNoPeriodo,
        totalAguardandoAprovacao,
        totalAlteracaoSolicitada
      },
      monthlyBarData,
      typePieData: typeEntries,
      monthlyTrendData,
      filteredPeriodLabel: periodLabel
    };
  }, [posts, dashboardPeriod]);

  // Agrupamento e filtragem de publicações para a Aba 2 (Publicações)
  const groupedFilteredPosts = useMemo(() => {
    const STATUS_PRIORITY: Record<string, number> = {
      'theme_rejected': 1,
      'rejected': 1,
      'changes_requested': 2,
      'pending_approval': 3,
      'theme_pending': 4,
      'draft': 5,
      'approved': 6,
      'theme_approved': 7,
      'scheduled': 8,
      'published': 9
    };

    const allGroupedMap: Record<string, GroupedPostItem> = {};

    posts.forEach((post) => {
      const parts = (post.date_key || '').split('-');
      if (parts.length < 3) return;

      const pDay = parseInt(parts[0], 10);
      const pMonth = parseInt(parts[1], 10);
      const pYear = parseInt(parts[2], 10);
      const platform = (parts[3] || 'meta') as 'meta' | 'linkedin' | 'tiktok';

      if (isNaN(pDay) || isNaN(pMonth) || isNaN(pYear)) return;

      const dateStr = `${pYear}-${String(pMonth).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
      const datePart = `${String(pDay).padStart(2, '0')}-${String(pMonth).padStart(2, '0')}-${pYear}`;
      const suffix = parts.length > 4 ? parts.slice(4).join('-') : '';
      const cleanTheme = (post.theme || '').trim().toLowerCase();
      
      const groupKey = suffix
        ? `${datePart}_${suffix}`
        : cleanTheme
          ? `${datePart}_${cleanTheme}`
          : datePart;

      const postDateObj = dayjs(dateStr);
      const formattedDate = postDateObj.format('D [de] MMMM [de] YYYY');

      if (!allGroupedMap[groupKey]) {
        allGroupedMap[groupKey] = {
          id: post.id || post.date_key,
          primaryKey: post.date_key,
          keys: [post.date_key],
          day: pDay,
          month: pMonth,
          year: pYear,
          dateStr,
          formattedDate,
          platforms: [platform],
          type: post.type || 'Post',
          theme: post.theme || 'Sem tema definido',
          status: post.status as PostStatus,
          scheduled_time: post.scheduled_time || null,
          rawPosts: [post]
        };
      } else {
        const grp = allGroupedMap[groupKey];
        if (!grp.platforms.includes(platform)) {
          grp.platforms.push(platform);
        }
        if (!grp.keys.includes(post.date_key)) {
          grp.keys.push(post.date_key);
        }
        grp.rawPosts.push(post);

        // Unificar status pela prioridade (mais urgente ganha)
        const currentPrio = STATUS_PRIORITY[grp.status] || 99;
        const newPrio = STATUS_PRIORITY[post.status as PostStatus] || 99;
        if (newPrio < currentPrio) {
          grp.status = post.status as PostStatus;
          grp.primaryKey = post.date_key;
        }

        if (!grp.theme || grp.theme === 'Sem tema definido') {
          if (post.theme) grp.theme = post.theme;
        }
        if (!grp.type || grp.type === 'Post') {
          if (post.type) grp.type = post.type;
        }
        if (!grp.scheduled_time && post.scheduled_time) {
          grp.scheduled_time = post.scheduled_time;
        }
      }
    });

    const now = dayjs();
    const todayStr = now.format('YYYY-MM-DD');

    return Object.values(allGroupedMap).filter((item) => {
      // 1. Filtro de Status
      if (filterStatus !== 'all') {
        if (filterStatus === 'pending_approval' && !(item.status === 'pending_approval' || item.status === 'theme_pending')) return false;
        if (filterStatus === 'changes_requested' && item.status !== 'changes_requested') return false;
        if (filterStatus === 'approved' && !(item.status === 'approved' || item.status === 'theme_approved' || item.status === 'scheduled')) return false;
        if (filterStatus === 'published' && item.status !== 'published') return false;
        if (filterStatus === 'draft' && item.status !== 'draft') return false;
        if (filterStatus === 'rejected' && !(item.status === 'rejected' || item.status === 'theme_rejected')) return false;
      }

      // 2. Filtro de Período
      if (filterPeriod === 'esta_semana') {
        const itemDate = dayjs(item.dateStr);
        const startOfWeek = now.startOf('week');
        const endOfWeek = now.endOf('week');
        if (itemDate.isBefore(startOfWeek) || itemDate.isAfter(endOfWeek)) return false;
      } else if (filterPeriod === 'este_mes') {
        const itemDate = dayjs(item.dateStr);
        if (itemDate.month() !== now.month() || itemDate.year() !== now.year()) return false;
      } else if (filterPeriod === 'ultimos_30') {
        const itemDate = dayjs(item.dateStr);
        const thirtyDaysAgo = now.subtract(30, 'day');
        if (itemDate.isBefore(thirtyDaysAgo) || itemDate.isAfter(now.add(1, 'day'))) return false;
      } else if (filterPeriod === 'este_ano') {
        const itemDate = dayjs(item.dateStr);
        if (itemDate.year() !== now.year()) return false;
      }

      // 3. Busca por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTheme = (item.theme || '').toLowerCase().includes(q);
        const matchType = (item.type || '').toLowerCase().includes(q);
        if (!matchTheme && !matchType) return false;
      }

      return true;
    }).sort((a, b) => {
      // Ordenação decrescente de data
      return b.dateStr.localeCompare(a.dateStr);
    });
  }, [posts, filterStatus, filterPeriod, searchQuery]);

  // Agrupamento por dia para a lista de publicações
  const postsGroupedByDate = useMemo(() => {
    const map: Record<string, { dateStr: string; formattedDate: string; isToday: boolean; items: GroupedPostItem[] }> = {};
    const todayStr = dayjs().format('YYYY-MM-DD');

    groupedFilteredPosts.forEach((post) => {
      if (!map[post.dateStr]) {
        map[post.dateStr] = {
          dateStr: post.dateStr,
          formattedDate: post.formattedDate,
          isToday: post.dateStr === todayStr,
          items: []
        };
      }
      map[post.dateStr].items.push(post);
    });

    return Object.values(map);
  }, [groupedFilteredPosts]);

  // Helpers de Badge de Status
  const getStatusBadge = (status: PostStatus) => {
    const conf = STATUS_CONFIG[status] || { label: status, color: '#9CA3AF' };
    switch (status) {
      case 'published':
        return {
          label: 'Publicado',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
          dotClass: 'bg-emerald-500'
        };
      case 'approved':
      case 'theme_approved':
      case 'scheduled':
        return {
          label: status === 'scheduled' ? 'Agendado' : 'Aprovado',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/60',
          dotClass: 'bg-blue-500'
        };
      case 'pending_approval':
      case 'theme_pending':
        return {
          label: 'Aguardando Aprovação',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/60',
          dotClass: 'bg-amber-500 animate-pulse'
        };
      case 'changes_requested':
        return {
          label: 'Alteração Solicitada',
          badgeClass: 'bg-orange-50 text-orange-800 border-orange-200/60',
          dotClass: 'bg-orange-500'
        };
      case 'rejected':
      case 'theme_rejected':
        return {
          label: 'Reprovado',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/60',
          dotClass: 'bg-rose-500'
        };
      default:
        return {
          label: 'Rascunho',
          badgeClass: 'bg-stone-50 text-stone-600 border-stone-200/60',
          dotClass: 'bg-stone-400'
        };
    }
  };

  // Abrir PostModal
  const handleOpenPost = (item: GroupedPostItem) => {
    const raw = item.rawPosts[0] || {};
    const dayStr = item.day < 10 ? `0${item.day}` : `${item.day}`;
    const monthStr = item.month < 10 ? `0${item.month}` : `${item.month}`;

    const dayContent: DailyContent = {
      day: `${dayStr}/${monthStr}`,
      platform: item.platforms[0] || 'meta',
      type: item.type,
      theme: item.theme,
      bullets: raw.bullets || [],
      initialImageUrl: raw.image_url || undefined
    };

    setSelectedPost({
      dayContent,
      dateKey: item.primaryKey,
      groupKeys: item.keys
    });
    setModalOpen(true);
  };

  // Custom Tooltips
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-stone-900 text-white p-3.5 rounded-2xl shadow-xl border border-stone-800 text-xs min-w-[170px] space-y-1.5">
          <div className="font-bold text-stone-300 border-b border-stone-800 pb-1">
            {label}
          </div>
          {payload.map((entry: any, i: number) => {
            if (!entry.value) return null;
            return (
              <div key={i} className="flex items-center justify-between gap-3 font-mono">
                <span className="flex items-center gap-1.5 text-stone-400 font-sans">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                  {entry.name}:
                </span>
                <span className="font-bold text-white">{entry.value}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const totalPosts = typePieData.reduce((acc, curr) => acc + curr.count, 0);
      const pct = totalPosts > 0 ? Math.round((Number(data.value) / totalPosts) * 100) : 0;
      return (
        <div className="bg-stone-900 text-white p-3.5 rounded-2xl shadow-xl border border-stone-800 text-xs min-w-[160px] space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-xs text-stone-100 border-b border-stone-800 pb-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.payload?.color || '#7C3AED' }}></span>
            <span className="truncate">{data.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3 font-mono pt-0.5">
            <span className="text-stone-400 text-xs font-sans">Volume:</span>
            <span className="text-emerald-400 font-bold">{data.value} {data.value === 1 ? 'post' : 'posts'} <span className="text-stone-400 font-normal">({pct}%)</span></span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const count = Number(payload[0]?.value) || 0;
      return (
        <div className="bg-stone-900 text-white p-3.5 rounded-2xl shadow-xl border border-stone-800 text-xs min-w-[160px] space-y-1.5">
          <div className="font-bold text-stone-300 text-xs border-b border-stone-800 pb-1 flex items-center justify-between">
            <span>{label}</span>
            <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono font-bold">Volume</span>
          </div>
          <div className="flex items-center justify-between gap-4 font-mono pt-0.5">
            <span className="text-stone-400 text-xs font-sans">Total planejado:</span>
            <span className="text-emerald-400 font-bold text-sm">{count} {count === 1 ? 'publicação' : 'publicações'}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const clientStatusDropdownOptions: CustomDropdownOption[] = useMemo(() => [
    { value: 'all', label: 'Todos os status', icon: <Filter size={14} className="text-stone-400" /> },
    { value: 'pending_approval', label: 'Aguardando Aprovação', badgeColor: '#F59E0B' },
    { value: 'changes_requested', label: 'Alteração Solicitada', badgeColor: '#EA580C' },
    { value: 'approved', label: 'Aprovado / Agendado', badgeColor: '#3B82F6' },
    { value: 'published', label: 'Publicado', badgeColor: '#10B981' },
    { value: 'draft', label: 'Rascunho', badgeColor: '#9CA3AF' },
    { value: 'rejected', label: 'Reprovado', badgeColor: '#EF4444' },
  ], []);

  const clientPeriodDropdownOptions: CustomDropdownOption[] = useMemo(() => [
    { value: 'esta_semana', label: 'Esta semana', icon: <CalendarIcon size={14} className="text-stone-400" /> },
    { value: 'este_mes', label: 'Este mês', icon: <CalendarIcon size={14} className="text-stone-400" /> },
    { value: 'ultimos_30', label: 'Últimos 30 dias', icon: <CalendarIcon size={14} className="text-stone-400" /> },
    { value: 'este_ano', label: 'Este ano', icon: <CalendarIcon size={14} className="text-stone-400" /> },
    { value: 'todos', label: 'Todo o período', icon: <CalendarIcon size={14} className="text-stone-400" /> },
  ], []);

  if (showGate) {
    const monthNum = mesParam ? parseInt(mesParam, 10) : currentMonthNum;
    const yearNum = anoParam ? parseInt(anoParam, 10) : currentYear;
    return (
      <NameGateScreen
        monthNumber={monthNum}
        year={yearNum}
        clientName={activeClient?.name}
        onEnter={(_name) => {
          setShowGate(false);
          setActiveTab('mapa');
        }}
      />
    );
  }

  if (!activeClient || !activeClient.id) {
    return (
      <div className="py-20 text-center text-stone-400 flex flex-col items-center justify-center">
        <RefreshCw size={28} className="animate-spin text-brand-dark mb-3" />
        <p className="text-sm font-medium">Carregando painel de conteúdo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      
      {/* CABEÇALHO DO MÓDULO & NAVEGAÇÃO ENTRE ABAS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-stone-200/60">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center shadow-md">
              <LayoutDashboard size={22} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-brand-dark tracking-tight">
                {titleOverride || 'Painel de Conteúdo'}
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 font-medium">
                {subtitleOverride || `Métricas de performance, publicações e calendário editorial de ${activeClient?.name || 'sua marca'}`}
              </p>
            </div>
          </div>
        </div>

        {/* 3 ABAS ESTRUTURAIS */}
        <div className="flex items-center p-1.5 bg-stone-100/90 rounded-2xl border border-stone-200/60 self-start md:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-white text-brand-dark shadow-sm'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <BarChart3 size={15} className={activeTab === 'dashboard' ? 'text-emerald-600' : 'text-stone-400'} />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('publicacoes')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'publicacoes'
                ? 'bg-white text-brand-dark shadow-sm'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <ListFilter size={15} className={activeTab === 'publicacoes' ? 'text-emerald-600' : 'text-stone-400'} />
            <span>Publicações</span>
            {posts.length > 0 && (
              <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-md font-mono">
                {posts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('mapa')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'mapa'
                ? 'bg-brand-dark text-white shadow-md shadow-brand-dark/20'
                : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <CalendarIcon size={15} className={activeTab === 'mapa' ? 'text-emerald-400' : 'text-emerald-600'} />
            <span className="font-extrabold tracking-wide">Mapa Editorial</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: DASHBOARD DE MÉTRICAS */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <motion.div
          key="aba-dashboard"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="space-y-8"
        >
          {/* SELETOR DE PERÍODO (TOPO, BEM VISÍVEL) */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-stone-200/70 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-700">
              <Filter size={14} className="text-emerald-600" />
              <span>Filtrar período do Dashboard:</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: 'este_mes', label: 'Este mês' },
                { id: 'ultimos_2_meses', label: 'Últimos 2 meses' },
                { id: 'ultimos_3_meses', label: 'Últimos 3 meses' },
                { id: 'este_ano', label: 'Este ano' },
                { id: 'todo_periodo', label: 'Todo o período' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDashboardPeriod(p.id as PeriodFilterType)}
                  className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    dashboardPeriod === p.id
                      ? 'bg-brand-dark text-white shadow-xs'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200/60'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4 CARDS DE RESUMO EM LINHA ÚNICA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Total no período */}
            <div 
              onClick={() => {
                setFilterPeriod(dashboardPeriod === 'este_mes' ? 'este_mes' : dashboardPeriod === 'este_ano' ? 'este_ano' : 'todos');
                setFilterStatus('all');
                setActiveTab('publicacoes');
              }}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-emerald-100 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Total no período
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Layers size={18} />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-brand-dark font-mono tracking-tight">
                {loading ? '...' : dashboardSummary.totalNoPeriodo}
              </div>
              <p className="text-[11px] text-stone-400 font-medium mt-1">
                {filteredPeriodLabel} (planejadas)
              </p>
            </div>

            {/* Card 2: Publicados */}
            <div 
              onClick={() => {
                setFilterStatus('published');
                setActiveTab('publicacoes');
              }}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-blue-100 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                  Publicados
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-brand-dark font-mono tracking-tight">
                {loading ? '...' : dashboardSummary.publicadosNoPeriodo}
              </div>
              <p className="text-[11px] text-stone-400 font-medium mt-1">
                Postados no período selecionado
              </p>
            </div>

            {/* Card 3: Aguardando aprovação */}
            <div 
              onClick={() => {
                setFilterStatus('pending_approval');
                setActiveTab('publicacoes');
              }}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-amber-100 shadow-xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  Aguardando aprovação
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock size={18} />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-brand-dark font-mono tracking-tight">
                {loading ? '...' : dashboardSummary.totalAguardandoAprovacao}
              </div>
              <p className="text-[11px] text-stone-400 font-medium mt-1 flex items-center gap-1">
                <span>Pendentes de sua avaliação</span>
                {dashboardSummary.totalAguardandoAprovacao > 0 && (
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                )}
              </p>
            </div>

            {/* Card 4: Alteração solicitada */}
            <div 
              onClick={() => {
                setFilterStatus('changes_requested');
                setActiveTab('publicacoes');
              }}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-orange-100 shadow-xs hover:shadow-md hover:border-orange-300 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">
                  Alteração solicitada
                </span>
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Edit3 size={18} />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-brand-dark font-mono tracking-tight">
                {loading ? '...' : dashboardSummary.totalAlteracaoSolicitada}
              </div>
              <p className="text-[11px] text-stone-400 font-medium mt-1">
                Em ajuste pela agência
              </p>
            </div>

          </div>

          {/* GRÁFICOS (LINHA 1: BARRAS POR MÊS E PIZZA POR FORMATO) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Gráfico 1: Publicações por Mês (Barras Empilhadas) */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/70 shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-brand-dark tracking-tight">
                    Publicações por Mês
                  </h3>
                  <p className="text-xs text-stone-400 font-medium">
                    Distribuição mensal por status ({filteredPeriodLabel})
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-[11px] font-medium text-stone-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Publicado</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>Aprovado</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>Aguardando</span>
                </div>
              </div>

              <div className="h-[280px] sm:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="publicado" name="Publicado" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="aprovado" name="Aprovado" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pendente" name="Aguardando" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="rascunho" name="Rascunho" stackId="a" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Publicações por Formato/Tipo (Donut / Pizza) */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/70 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-brand-dark tracking-tight">
                      Mix de Formatos
                    </h3>
                    <p className="text-xs text-stone-400 font-medium">
                      Tipos de conteúdo mais produzidos no período
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <PieChartIcon size={16} />
                  </div>
                </div>

                {typePieData.length === 0 ? (
                  <div className="h-[220px] flex flex-col items-center justify-center text-center text-stone-400 text-xs">
                    <p>Nenhuma publicação encontrada no período.</p>
                  </div>
                ) : (
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={typePieData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                        >
                          {typePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Legenda de Tipos */}
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-stone-100 max-h-[110px] overflow-y-auto">
                {typePieData.map((item) => {
                  const total = typePieData.reduce((acc, curr) => acc + curr.count, 0);
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-stone-50/70">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                        <span className="text-stone-700 font-medium truncate">{item.name}</span>
                      </div>
                      <span className="font-mono text-stone-500 font-bold text-[11px] shrink-0 ml-1">
                        {item.count} <span className="text-[10px] text-stone-400">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* GRÁFICO 3: EVOLUÇÃO MENSAL (LINHA CONTÍNUA) */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/70 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-brand-dark tracking-tight">
                  Evolução do Volume de Conteúdo
                </h3>
                <p className="text-xs text-stone-400 font-medium">
                  Tendência de postagens planejadas ao longo do período selecionado
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl">
                <TrendingUp size={14} />
                <span>Volume Total</span>
              </div>
            </div>

            <div className="h-[240px] sm:h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CustomLineTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="publicacoes" 
                    name="Volume de Publicações"
                    stroke="#059669" 
                    strokeWidth={3} 
                    dot={{ fill: '#059669', strokeWidth: 2, r: 4, stroke: '#FFFFFF' }}
                    activeDot={{ r: 7, fill: '#059669', stroke: '#FFFFFF', strokeWidth: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: LISTA DE PUBLICAÇÕES DO CLIENTE */}
      {/* ========================================================================= */}
      {activeTab === 'publicacoes' && (
        <motion.div
          key="aba-publicacoes"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* BARRA DE FILTROS & BUSCA */}
          <div className="bg-white rounded-3xl p-5 border border-stone-200/70 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* Filtros em Linha Customizados */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro Status */}
              <CustomDropdown
                value={filterStatus}
                onChange={setFilterStatus}
                options={clientStatusDropdownOptions}
                triggerIcon={<Filter size={14} />}
              />

              {/* Filtro Período */}
              <CustomDropdown
                value={filterPeriod}
                onChange={setFilterPeriod}
                options={clientPeriodDropdownOptions}
                triggerIcon={<CalendarIcon size={14} />}
              />

              {/* Limpar Filtros */}
              {(filterStatus !== 'all' || filterPeriod !== 'este_mes' || searchQuery) && (
                <button
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterPeriod('este_mes');
                    setSearchQuery('');
                  }}
                  className="text-xs font-bold text-stone-400 hover:text-stone-700 px-2 py-1.5 transition-colors cursor-pointer"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {/* Campo de Busca Textual e Botão Nova Publicação */}
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar por tema ou formato..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
                />
              </div>

              {(userRole === 'admin' || isNossoConteudo) && (
                <button
                  onClick={handleCreateNewPost}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-dark text-white rounded-xl text-xs font-bold shadow-md hover:bg-stone-800 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus size={15} />
                  <span>Nova Publicação</span>
                </button>
              )}
            </div>
          </div>

          {/* LISTA AGRUPADA POR DATA */}
          {loading ? (
            <div className="py-20 text-center text-stone-400">
              <RefreshCw size={28} className="animate-spin mx-auto mb-2 text-stone-300" />
              <p className="text-sm font-medium">Carregando publicações...</p>
            </div>
          ) : postsGroupedByDate.length === 0 ? (
            <div className="py-16 px-6 rounded-3xl bg-stone-50/70 border border-dashed border-stone-200 text-center flex flex-col items-center justify-center">
              <CheckCircle2 size={36} className="text-stone-300 mb-3" />
              <p className="text-base font-bold text-stone-700">Nenhuma publicação encontrada para os filtros selecionados.</p>
              <p className="text-xs text-stone-400 mt-1 max-w-md">
                Tente ajustar o filtro de status ou período para visualizar outras postagens.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {postsGroupedByDate.map((group) => (
                <div key={group.dateStr} className="space-y-3">
                  
                  {/* Cabeçalho da Data */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                      group.isToday 
                        ? 'bg-indigo-100 text-indigo-800' 
                        : 'bg-stone-100 text-stone-600'
                    }`}>
                      {group.formattedDate}
                    </span>
                    <div className="h-px bg-stone-100 flex-grow"></div>
                    <span className="text-[11px] font-mono text-stone-400 font-bold">
                      {group.items.length} {group.items.length === 1 ? 'post' : 'posts'}
                    </span>
                  </div>

                  {/* Cards de Publicação do Dia */}
                  <div className="grid grid-cols-1 gap-2.5">
                    {group.items.map((item) => {
                      const statusBadge = getStatusBadge(item.status);

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleOpenPost(item)}
                          className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-stone-50/80 border border-stone-200/70 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group active:scale-[0.99] shadow-2xs hover:shadow-xs"
                        >
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                            
                            {/* Ícone de Formato / Plataforma */}
                            <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 shrink-0 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                              {item.platforms.includes('meta') ? (
                                <Instagram size={18} />
                              ) : item.platforms.includes('linkedin') ? (
                                <Linkedin size={18} />
                              ) : (
                                <Video size={18} />
                              )}
                            </div>

                            {/* Informações Principais */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-stone-900 bg-stone-100/90 px-2.5 py-0.5 rounded-md border border-stone-200/60">
                                  {item.type || 'Post'}
                                </span>
                                
                                {item.platforms && item.platforms.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-stone-400">
                                    {item.platforms.includes('meta') && <Instagram size={13} className="text-pink-600" />}
                                    {item.platforms.includes('linkedin') && <Linkedin size={13} className="text-blue-600" />}
                                    {item.platforms.includes('tiktok') && <Video size={13} className="text-stone-700" />}
                                  </div>
                                )}

                                {item.scheduled_time && (
                                  <span className="text-[11px] font-mono text-stone-500 flex items-center gap-1 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/50">
                                    <Clock size={11} />
                                    {item.scheduled_time}
                                  </span>
                                )}
                              </div>

                              <p className="text-sm font-bold text-stone-800 mt-1 truncate group-hover:text-emerald-700 transition-colors">
                                Tema: "{item.theme}"
                              </p>
                            </div>
                          </div>

                          {/* Status Badge e Ação */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 self-end sm:self-center">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${statusBadge.badgeClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`}></span>
                              {statusBadge.label}
                            </span>
                            <ChevronRight size={18} className="text-stone-300 group-hover:text-stone-600 transition-colors hidden sm:block" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: MAPA EDITORIAL DO CLIENTE (CALENDÁRIO COMPLETO) */}
      {/* ========================================================================= */}
      {activeTab === 'mapa' && (
        <motion.div
          key="aba-mapa"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* COMPONENTE ORIGINAL DO MAPA EDITORIAL (MONTHDETAIL) */}
          <div className="bg-white rounded-3xl border border-stone-200/70 shadow-xs p-3 sm:p-6">
            <MonthDetail 
              monthName={selectedMonth} 
              onBack={() => setActiveTab('dashboard')} 
              onSelectMonth={(m) => setSelectedMonth(m)}
              overrideClient={activeClient}
            />
          </div>
        </motion.div>
      )}

      {/* POST MODAL PARA VISUALIZAÇÃO / APROVAÇÃO / REVISÃO */}
      {modalOpen && selectedPost && (
        <PostModal
          dayContent={selectedPost.dayContent}
          dateKey={selectedPost.dateKey}
          groupKeys={selectedPost.groupKeys}
          onClose={() => {
            setModalOpen(false);
            setSelectedPost(null);
          }}
          onUpdate={() => {
            fetchPosts();
            setModalOpen(false);
            setSelectedPost(null);
          }}
        />
      )}

    </div>
  );
};

export default ClientPainelConteudo;

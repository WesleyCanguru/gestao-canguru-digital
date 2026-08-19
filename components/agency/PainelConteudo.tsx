import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, useAuth } from '../../lib/supabase';
import { autoPublishPastScheduledPosts } from '../../lib/scheduledPostsUtils';
import { STATUS_CONFIG } from '../../constants';
import { PostStatus, DailyContent, Client } from '../../types';
import { PostModal } from '../PostModal';
import { 
  LayoutDashboard, 
  ListFilter, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  Plus, 
  Search, 
  Sparkles, 
  Building2, 
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
  RotateCcw
} from 'lucide-react';
import { CustomDropdown, CustomDropdownOption } from '../CustomDropdown';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
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

interface PainelConteudoProps {
  onBackToHome?: () => void;
  initialTab?: 'dashboard' | 'publicacoes';
  initialFilterStatus?: string;
  initialFilterPeriod?: string;
  initialFilterClient?: string;
  initialFilterDate?: string;
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
  client: {
    id: string;
    name: string;
    logo_url?: string | null;
    color?: string | null;
    initials?: string | null;
  };
  type: string;
  theme: string;
  status: PostStatus;
  scheduled_time?: string | null;
  rawPosts: any[];
}

const MONTH_SHORT_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type DashboardPeriodType = 'este_mes' | 'ultimos_2_meses' | 'ultimos_3_meses' | 'este_ano' | 'todo_periodo';

const PALETTE_COLORS = [
  '#059669', // Emerald
  '#2563EB', // Blue
  '#7C3AED', // Purple
  '#D97706', // Amber
  '#DC2626', // Red
  '#0D9488', // Teal
  '#DB2777', // Pink
  '#4F46E5', // Indigo
  '#EA580C', // Orange
  '#0284C7', // Sky
];

export const PainelConteudo: React.FC<PainelConteudoProps> = ({
  onBackToHome,
  initialTab,
  initialFilterStatus,
  initialFilterPeriod,
  initialFilterClient,
  initialFilterDate
}) => {
  const { agencyId } = useAuth();
  const currentYear = dayjs().year();
  const currentMonthNum = dayjs().month() + 1; // 1-12

  // Filtro de período do Dashboard
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriodType>('este_mes');

  // Ler parâmetros da URL se existirem
  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'publicacoes'>(() => {
    const urlAba = urlParams.get('aba');
    if (urlAba === 'publicacoes' || urlAba === 'posts') return 'publicacoes';
    if (initialTab) return initialTab;
    if (initialFilterStatus || initialFilterPeriod || initialFilterDate) return 'publicacoes';
    return 'dashboard';
  });

  // Filtros
  const [filterClient, setFilterClient] = useState<string>(() => {
    return urlParams.get('cliente') || initialFilterClient || 'all';
  });

  const [filterStatus, setFilterStatus] = useState<string>(() => {
    return urlParams.get('status') || initialFilterStatus || 'all';
  });

  const [filterPeriod, setFilterPeriod] = useState<string>(() => {
    const p = urlParams.get('periodo');
    if (p === 'hoje' || p === 'esta_semana' || p === 'este_mes' || p === 'proximos_30' || p === 'todos') {
      return p;
    }
    if (initialFilterPeriod) return initialFilterPeriod;
    if (initialFilterDate) return 'hoje';
    return 'este_mes';
  });

  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sincronizar se props mudarem
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialFilterStatus) {
      setFilterStatus(initialFilterStatus);
      setActiveTab('publicacoes');
    }
  }, [initialFilterStatus]);

  useEffect(() => {
    if (initialFilterPeriod) {
      setFilterPeriod(initialFilterPeriod);
      setActiveTab('publicacoes');
    }
  }, [initialFilterPeriod]);

  useEffect(() => {
    if (initialFilterClient) {
      setFilterClient(initialFilterClient);
    }
  }, [initialFilterClient]);

  // Dados do banco
  const [posts, setPosts] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de edição / criação
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{
    dayContent: DailyContent;
    dateKey: string;
    groupKeys?: string[];
    isNew?: boolean;
    defaultDate?: string;
    clientOverride?: any;
  } | null>(null);

  // Buscar clientes
  const fetchClients = useCallback(async () => {
    if (!agencyId) return;
    try {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('agency_id', agencyId)
        .neq('is_internal', true)
        .order('name');

      if (data) {
        setClients(data as Client[]);
      }
    } catch (e) {
      console.error('Erro ao buscar clientes:', e);
    }
  }, [agencyId]);

  // Buscar todas as publicações do ano e ativas
  const fetchPosts = useCallback(async () => {
    if (!agencyId) return;
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('posts')
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
        .limit(15000);

      if (error) throw error;

      if (data) {
        // Ocultar posts futuros de clientes cancelados
        const valid = data.filter((post: any) => {
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

        // Auto publicar posts agendados que já passaram da hora
        const updated = await autoPublishPastScheduledPosts(valid);
        setPosts(updated);
      }
    } catch (e) {
      console.error('Erro ao buscar publicações:', e);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    fetchClients();
    fetchPosts();

    const channel = supabase
      .channel('painel_conteudo_posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId, fetchClients, fetchPosts]);

  // Processar métricas e agrupamentos
  const { summary, monthlyBarData, clientPieData, formatPieData, monthlyTrendData, filteredPeriodLabel, groupedFilteredPosts, selectedClientObj } = useMemo(() => {
    let totalPublicadosPeriodo = 0;
    let totalPublicadosMesAtual = 0;
    let totalAguardandoAprovacao = 0; // Sempre o estado atual
    let totalAlteracaoSolicitada = 0; // Sempre o estado atual

    const now = dayjs();

    // Objeto do cliente selecionado se filterClient !== 'all'
    const selectedClient = filterClient !== 'all' ? clients.find(c => c.id === filterClient) : null;

    // Filtrar posts por cliente se filterClient !== 'all'
    const targetClientPosts = filterClient === 'all'
      ? posts
      : posts.filter(p => (p.client_id || p.clients?.id) === filterClient);

    // Encontrar datas extremas entre todas as postagens filtradas
    let earliestPostDate: dayjs.Dayjs | null = null;
    let latestPostDate: dayjs.Dayjs | null = null;

    targetClientPosts.forEach((p) => {
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
      // todo_periodo: abrange do post mais antigo até o final do período
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

    // Inicializar mapa de meses para os gráficos
    const monthlyStatsMap: Record<string, {
      name: string;
      year: number;
      mes: number;
      publicado: number;
      aprovado: number;
      pendente: number;
      rascunho: number;
      total: number;
      trendTotal: number;
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
        total: 0,
        trendTotal: 0
      };
    });

    // Contagem de publicados por cliente no período selecionado
    const clientPublishedMap: Record<string, { name: string; color: string; count: number }> = {};
    clients.forEach(c => {
      clientPublishedMap[c.id] = {
        name: c.name,
        color: c.color || PALETTE_COLORS[Math.abs(c.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PALETTE_COLORS.length],
        count: 0
      };
    });

    // Contagem de publicados por formato (quando cliente individual selecionado)
    const formatPublishedMap: Record<string, { name: string; color: string; count: number }> = {};
    const FORMAT_COLORS: Record<string, string> = {
      'reels': '#E1306C',
      'carrossel': '#2563EB',
      'story': '#F59E0B',
      'stories': '#F59E0B',
      'imagem': '#10B981',
      'estático': '#10B981',
      'estatico': '#10B981',
      'vídeo': '#7C3AED',
      'video': '#7C3AED',
      'post': '#0D9488'
    };

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

    // Agrupamento de posts por dia / cliente / tema
    const allGroupedMap: Record<string, GroupedPostItem> = {};

    targetClientPosts.forEach((post) => {
      const parts = (post.date_key || '').split('-');
      if (parts.length < 3) return;

      const pDay = parseInt(parts[0], 10);
      const pMonth = parseInt(parts[1], 10);
      const pYear = parseInt(parts[2], 10);
      const platform = (parts[3] || 'meta') as 'meta' | 'linkedin' | 'tiktok';

      if (isNaN(pDay) || isNaN(pMonth) || isNaN(pYear)) return;

      const postDate = dayjs(`${pYear}-${String(pMonth).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`);
      const isCurrentMonthNow = pYear === now.year() && pMonth === (now.month() + 1);

      // Status checks
      const status = post.status as PostStatus;
      const isPublished = status === 'published';
      const isApproved = status === 'approved' || status === 'theme_approved' || status === 'scheduled';
      const isPending = status === 'pending_approval' || status === 'theme_pending';
      const isChanges = status === 'changes_requested';
      const isDraft = status === 'draft';

      // 1. Resumo Cards: estado atual da agência/cliente
      if (isPending) {
        totalAguardandoAprovacao++;
      }
      if (isChanges) {
        totalAlteracaoSolicitada++;
      }
      if (isCurrentMonthNow && isPublished) {
        totalPublicadosMesAtual++;
      }

      // Verificar se post está no período selecionado
      const isInPeriod = !postDate.isBefore(startDate, 'day') && !postDate.isAfter(endDate, 'day');

      if (isInPeriod) {
        if (isPublished) {
          totalPublicadosPeriodo++;
        }

        // 2. Gráficos Mensais
        const monthKey = `${pYear}-${pMonth}`;
        if (monthlyStatsMap[monthKey]) {
          const mObj = monthlyStatsMap[monthKey];
          mObj.total++;

          if (isPublished) mObj.publicado++;
          else if (isApproved) mObj.aprovado++;
          else if (isPending || isChanges) mObj.pendente++;
          else if (isDraft) mObj.rascunho++;

          // Tendência: todos os posts exceto rascunho
          if (status !== 'draft' && status !== 'deleted') {
            mObj.trendTotal++;
          }
        }

        // 3. Gráfico por cliente e por formato (apenas publicados no período)
        if (isPublished) {
          const cid = post.client_id || post.clients?.id;
          if (cid && clientPublishedMap[cid]) {
            clientPublishedMap[cid].count++;
          }

          // Por formato
          const rawType = (post.type || 'Estático').trim();
          const formatName = rawType.charAt(0).toUpperCase() + rawType.slice(1);
          const typeKey = formatName.toLowerCase();

          if (!formatPublishedMap[typeKey]) {
            const color = FORMAT_COLORS[typeKey] || PALETTE_COLORS[Object.keys(formatPublishedMap).length % PALETTE_COLORS.length];
            formatPublishedMap[typeKey] = {
              name: formatName,
              color,
              count: 0
            };
          }
          formatPublishedMap[typeKey].count++;
        }
      }

      // 4. Agrupamento para lista de publicações
      const cleanTheme = (post.theme || post.theme_title || 'Sem tema definido').trim().toLowerCase();
      const cid = post.client_id || post.clients?.id || 'unknown';
      const groupKey = `${pYear}-${String(pMonth).padStart(2, '0')}-${String(pDay).padStart(2, '0')}-${cid}-${cleanTheme}`;

      const clientInfo = post.clients || clients.find(c => c.id === cid) || {
        id: cid,
        name: 'Cliente',
        logo_url: null,
        color: '#1A1A1A',
        initials: 'CL'
      };

      if (!allGroupedMap[groupKey]) {
        allGroupedMap[groupKey] = {
          id: post.id || post.date_key,
          primaryKey: post.date_key,
          keys: [post.date_key],
          day: pDay,
          month: pMonth,
          year: pYear,
          dateStr: postDate.format('YYYY-MM-DD'),
          formattedDate: postDate.format('DD/MM/YYYY'),
          platforms: [platform],
          client: {
            id: clientInfo.id,
            name: clientInfo.name || 'Cliente',
            logo_url: clientInfo.logo_url,
            color: clientInfo.color,
            initials: clientInfo.initials
          },
          type: post.type || 'Post',
          theme: post.theme || post.theme_title || 'Sem tema definido',
          status: status,
          scheduled_time: post.scheduled_time || null,
          rawPosts: [post]
        };
      } else {
        allGroupedMap[groupKey].keys.push(post.date_key);
        allGroupedMap[groupKey].rawPosts.push(post);
        if (!allGroupedMap[groupKey].platforms.includes(platform)) {
          allGroupedMap[groupKey].platforms.push(platform);
        }
        // Atualizar status prioritário
        const currentP = STATUS_PRIORITY[allGroupedMap[groupKey].status] || 99;
        const newP = STATUS_PRIORITY[status] || 99;
        if (newP < currentP) {
          allGroupedMap[groupKey].status = status;
        }
      }
    });

    // Converter dados mensais para array dos gráficos
    const barData = monthsToInclude.map(m => {
      const key = `${m.year}-${m.month}`;
      return monthlyStatsMap[key] || {
        name: m.label,
        year: m.year,
        mes: m.month,
        publicado: 0,
        aprovado: 0,
        pendente: 0,
        rascunho: 0,
        total: 0,
        trendTotal: 0
      };
    });

    // Converter dados de clientes para o gráfico de pizza
    const pieData = Object.values(clientPublishedMap)
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);

    // Converter dados de formatos para o gráfico de pizza
    const formatPieDataArray = Object.values(formatPublishedMap)
      .filter(f => f.count > 0)
      .sort((a, b) => b.count - a.count);

    const trendData = barData.map(d => ({
      name: d.name,
      mes: d.mes,
      publicacoes: d.trendTotal
    }));

    // Filtrar posts da Aba 2 (Publicações)
    const today = dayjs().startOf('day');
    const startOfWeek = today.startOf('week');
    const endOfWeek = today.endOf('week');
    const startOfMonth = today.startOf('month');
    const endOfMonth = today.endOf('month');
    const next30Days = today.add(30, 'day').endOf('day');

    const filtered = Object.values(allGroupedMap).filter((item) => {
      // Filtro Cliente
      if (filterClient !== 'all' && item.client.id !== filterClient) {
        return false;
      }

      // Filtro Status
      if (filterStatus !== 'all') {
        if (filterStatus === 'pending_approval') {
          if (item.status !== 'pending_approval' && item.status !== 'theme_pending') return false;
        } else if (filterStatus === 'approved') {
          if (item.status !== 'approved' && item.status !== 'theme_approved' && item.status !== 'scheduled') return false;
        } else if (filterStatus === 'rejected') {
          if (item.status !== 'rejected' && item.status !== 'theme_rejected') return false;
        } else if (item.status !== filterStatus) {
          return false;
        }
      }

      // Filtro Período
      const itemDate = dayjs(item.dateStr);
      if (filterPeriod === 'hoje') {
        if (!itemDate.isSame(today, 'day')) return false;
      } else if (filterPeriod === 'esta_semana') {
        if (itemDate.isBefore(startOfWeek) || itemDate.isAfter(endOfWeek)) return false;
      } else if (filterPeriod === 'este_mes') {
        if (itemDate.isBefore(startOfMonth) || itemDate.isAfter(endOfMonth)) return false;
      } else if (filterPeriod === 'proximos_30') {
        if (itemDate.isBefore(today) || itemDate.isAfter(next30Days)) return false;
      }

      // Busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTheme = item.theme.toLowerCase().includes(q);
        const matchesClient = item.client.name.toLowerCase().includes(q);
        const matchesType = item.type.toLowerCase().includes(q);
        if (!matchesTheme && !matchesClient && !matchesType) return false;
      }

      return true;
    });

    // Ordenar posts filtrados por data
    filtered.sort((a, b) => dayjs(b.dateStr).valueOf() - dayjs(a.dateStr).valueOf());

    // Agrupar por data para exibição elegante
    const groupedByDate: { [dateStr: string]: { dateObj: dayjs.Dayjs; label: string; items: GroupedPostItem[] } } = {};

    filtered.forEach(item => {
      if (!groupedByDate[item.dateStr]) {
        const dObj = dayjs(item.dateStr);
        let label = '';
        if (dObj.isSame(today, 'day')) {
          label = `Hoje, ${dObj.format('DD/MM')}`;
        } else if (dObj.isSame(today.add(1, 'day'), 'day')) {
          label = `Amanhã, ${dObj.format('DD/MM')}`;
        } else if (dObj.isSame(today.subtract(1, 'day'), 'day')) {
          label = `Ontem, ${dObj.format('DD/MM')}`;
        } else {
          const dayName = dObj.format('dddd');
          const cap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
          label = `${cap}, ${dObj.format('DD/MM/YYYY')}`;
        }

        groupedByDate[item.dateStr] = {
          dateObj: dObj,
          label,
          items: []
        };
      }
      groupedByDate[item.dateStr].items.push(item);
    });

    const dateGroupsArray = Object.values(groupedByDate).sort((a, b) => b.dateObj.valueOf() - a.dateObj.valueOf());

    return {
      summary: {
        totalPeriodo: totalPublicadosPeriodo,
        esteMes: totalPublicadosMesAtual,
        aguardandoAprovacao: totalAguardandoAprovacao,
        alteracaoSolicitada: totalAlteracaoSolicitada
      },
      monthlyBarData: barData,
      clientPieData: pieData,
      formatPieData: formatPieDataArray,
      monthlyTrendData: trendData,
      filteredPeriodLabel: periodLabel,
      groupedFilteredPosts: dateGroupsArray,
      selectedClientObj: selectedClient
    };
  }, [posts, clients, currentYear, currentMonthNum, dashboardPeriod, filterClient, filterStatus, filterPeriod, searchQuery]);

  // Abertura do Modal de Publicação
  const handleOpenPostModal = (item: GroupedPostItem) => {
    const mainPost = item.rawPosts[0] || {};
    const dayStr = item.day < 10 ? `0${item.day}` : `${item.day}`;
    const monthStr = item.month < 10 ? `0${item.month}` : `${item.month}`;

    const dayContent: DailyContent = {
      day: `${dayStr}/${monthStr}`,
      platform: item.platforms[0] || 'meta',
      type: item.type,
      theme: item.theme,
      bullets: mainPost.bullets || [],
      initialImageUrl: mainPost.image_url || undefined
    };

    setSelectedPost({
      dayContent,
      dateKey: item.primaryKey,
      groupKeys: item.keys,
      clientOverride: item.client,
      isNew: false
    });
    setModalOpen(true);
  };

  const handleCreateNewPost = () => {
    const today = dayjs();
    const dayStr = today.format('DD');
    const monthStr = today.format('MM');
    const defaultDateStr = today.format('YYYY-MM-DD');

    const dayContent: DailyContent = {
      day: `${dayStr}/${monthStr}`,
      platform: 'meta',
      type: '',
      theme: '',
      bullets: []
    };

    setSelectedPost({
      dayContent,
      dateKey: 'new',
      groupKeys: [],
      isNew: true,
      defaultDate: defaultDateStr,
      clientOverride: filterClient !== 'all' ? clients.find(c => c.id === filterClient) : null
    });
    setModalOpen(true);
  };

  const getStatusBadge = (status: PostStatus) => {
    switch (status) {
      case 'pending_approval':
      case 'theme_pending':
        return {
          label: 'Aprovação',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
          dotClass: 'bg-amber-500'
        };
      case 'changes_requested':
        return {
          label: 'Alteração',
          badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
          dotClass: 'bg-orange-500'
        };
      case 'approved':
      case 'theme_approved':
        return {
          label: 'Aprovado',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dotClass: 'bg-emerald-500'
        };
      case 'published':
        return {
          label: 'Publicado',
          badgeClass: 'bg-green-50 text-green-700 border-green-200',
          dotClass: 'bg-green-500'
        };
      case 'scheduled':
        return {
          label: 'Programado',
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dotClass: 'bg-indigo-500'
        };
      case 'rejected':
      case 'theme_rejected':
        return {
          label: 'Reprovado',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
          dotClass: 'bg-rose-500'
        };
      case 'draft':
      default:
        return {
          label: 'Rascunho',
          badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
          dotClass: 'bg-stone-400'
        };
    }
  };

  // Custom Tooltip para o Gráfico de Barras
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
      return (
        <div className="bg-stone-900 text-white p-3.5 rounded-2xl shadow-2xl border border-stone-700/80 text-xs space-y-2 min-w-[180px] z-50">
          <div className="flex items-center justify-between border-b border-stone-800 pb-1.5 font-bold">
            <span className="text-white font-bold">{label}</span>
            <span className="text-emerald-400 font-mono font-bold">{total} {total === 1 ? 'post' : 'posts'}</span>
          </div>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between text-[11px] gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                  <span className="text-stone-300 font-medium">{entry.name}</span>
                </div>
                <span className="font-bold font-mono text-white">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip para o Gráfico de Linha (Evolução Mensal)
  const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const count = Number(payload[0]?.value) || 0;
      return (
        <div className="bg-stone-900 text-white p-3.5 rounded-2xl shadow-2xl border border-stone-700/80 text-xs min-w-[170px] space-y-2 z-50">
          <div className="font-bold text-white text-xs border-b border-stone-800 pb-1.5 flex items-center justify-between">
            <span className="text-white font-bold">{label}</span>
            <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono font-bold">Volume</span>
          </div>
          <div className="flex items-center justify-between gap-4 font-mono pt-0.5">
            <span className="text-stone-300 text-xs font-sans">Publicações:</span>
            <span className="text-emerald-400 font-bold text-sm">{count} {count === 1 ? 'post' : 'posts'}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip para o Gráfico de Pizza (Por Cliente)
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const totalPubs = clientPieData.reduce((acc, c) => acc + c.count, 0);
      const pct = totalPubs > 0 ? Math.round((Number(data.value) / totalPubs) * 100) : 0;
      return (
        <div className="bg-stone-900 text-white p-3.5 rounded-2xl shadow-2xl border border-stone-700/80 text-xs min-w-[170px] space-y-2 z-50">
          <div className="flex items-center gap-2 font-bold text-xs text-white border-b border-stone-800 pb-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.payload?.color || '#059669' }}></span>
            <span className="truncate text-white font-bold">{data.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3 font-mono pt-0.5">
            <span className="text-stone-300 text-xs font-sans">Total publicado:</span>
            <span className="text-emerald-400 font-bold">{data.value} posts <span className="text-stone-400 font-normal">({pct}%)</span></span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip para o Gráfico de Pizza (Por Formato/Tipo)
  const CustomFormatPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const totalPubs = formatPieData.reduce((acc, f) => acc + f.count, 0);
      const pct = totalPubs > 0 ? Math.round((Number(data.value) / totalPubs) * 100) : 0;
      return (
        <div className="bg-stone-900 text-white p-3.5 rounded-2xl shadow-2xl border border-stone-700/80 text-xs min-w-[170px] space-y-2 z-50">
          <div className="flex items-center gap-2 font-bold text-xs text-white border-b border-stone-800 pb-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.payload?.color || '#059669' }}></span>
            <span className="truncate text-white font-bold">{data.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3 font-mono pt-0.5">
            <span className="text-stone-300 text-xs font-sans">Total no formato:</span>
            <span className="text-emerald-400 font-bold">{data.value} {data.value === 1 ? 'post' : 'posts'} <span className="text-stone-400 font-normal">({pct}%)</span></span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Opções estruturadas para os seletores CustomDropdown (sem emojis)
  const clientDropdownOptions: CustomDropdownOption[] = useMemo(() => {
    return [
      {
        value: 'all',
        label: 'Todos os clientes',
        icon: <Building2 size={14} className="text-stone-400" />
      },
      ...clients.map(c => ({
        value: c.id,
        label: c.name,
        badgeLogoUrl: c.logo_url,
        badgeColor: c.color || '#1A1A1A',
        badgeInitials: c.initials || c.name.substring(0, 2).toUpperCase()
      }))
    ];
  }, [clients]);

  const statusDropdownOptions: CustomDropdownOption[] = useMemo(() => [
    { value: 'all', label: 'Todos os status', icon: <Filter size={14} className="text-stone-400" /> },
    { value: 'draft', label: 'Rascunho', badgeColor: '#9CA3AF' },
    { value: 'pending_approval', label: 'Aguardando Aprovação', badgeColor: '#F59E0B' },
    { value: 'approved', label: 'Aprovado', badgeColor: '#3B82F6' },
    { value: 'changes_requested', label: 'Alteração Solicitada', badgeColor: '#EA580C' },
    { value: 'rejected', label: 'Reprovado', badgeColor: '#EF4444' },
    { value: 'published', label: 'Publicado', badgeColor: '#10B981' },
  ], []);

  const periodDropdownOptions: CustomDropdownOption[] = useMemo(() => [
    { value: 'hoje', label: 'Hoje', icon: <Calendar size={14} className="text-stone-400" /> },
    { value: 'esta_semana', label: 'Esta semana', icon: <Calendar size={14} className="text-stone-400" /> },
    { value: 'este_mes', label: 'Este mês', icon: <Calendar size={14} className="text-stone-400" /> },
    { value: 'proximos_30', label: 'Próximos 30 dias', icon: <Calendar size={14} className="text-stone-400" /> },
    { value: 'todos', label: `Todo o ano (${currentYear})`, icon: <Calendar size={14} className="text-stone-400" /> },
  ], [currentYear]);

  return (
    <div className="space-y-8 pb-20">
      
      {/* CABEÇALHO UNIFICADO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6 px-2">
        <div className="space-y-1">
          {filterClient !== 'all' && selectedClientObj ? (
            <div className="flex items-center gap-3">
              {selectedClientObj.logo_url ? (
                <img
                  src={selectedClientObj.logo_url}
                  alt={selectedClientObj.name}
                  className="w-10 h-10 rounded-xl object-cover border border-stone-200/80 shadow-2xs shrink-0"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-2xs shrink-0"
                  style={{ backgroundColor: selectedClientObj.color || '#1A1A1A' }}
                >
                  {selectedClientObj.initials || selectedClientObj.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold italic tracking-tight text-brand-dark">
                    Dashboard · {selectedClientObj.name}
                  </h1>
                  <button
                    onClick={() => setFilterClient('all')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200/80 text-stone-700 hover:text-stone-900 rounded-xl text-xs font-bold transition-all cursor-pointer border border-stone-200/60 active:scale-95"
                    title="Voltar para a visão geral"
                  >
                    <span>Ver tudo</span>
                    <RotateCcw size={12} className="text-stone-500" />
                  </button>
                </div>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Métricas e visão de publicações individuais do cliente
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-stone-400">
                <Sparkles size={14} className="text-brand-dark" /> Visão Agência Unificada
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold italic tracking-tight text-brand-dark">
                Painel de Conteúdo
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 max-w-xl font-medium">
                Visão da agência unificada — métricas, publicações e calendário de todos os clientes
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Botão Nova Publicação */}
          <button 
            onClick={handleCreateNewPost}
            className="flex items-center gap-2 bg-brand-dark hover:bg-black text-white px-5 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-brand-dark/10 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={15} /> Nova Publicação
          </button>
        </div>
      </div>

      {/* SELETOR DE ABAS */}
      <div className="flex items-center gap-2 p-1.5 bg-stone-100/80 rounded-2xl w-fit border border-stone-200/60 shadow-2xs">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'dashboard'
              ? 'bg-white text-brand-dark shadow-sm'
              : 'text-stone-500 hover:text-brand-dark'
          }`}
        >
          <BarChart3 size={15} />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('publicacoes')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'publicacoes'
              ? 'bg-white text-brand-dark shadow-sm'
              : 'text-stone-500 hover:text-brand-dark'
          }`}
        >
          <ListFilter size={15} />
          <span>Publicações</span>
        </button>
      </div>

      {/* ABA 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="space-y-8"
        >
          {/* SELETOR DE CLIENTE + FILTRO DE PERÍODO (DASHBOARD) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-200/40">
            
            {/* Seletor de Cliente Customizado */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <CustomDropdown
                value={filterClient}
                onChange={setFilterClient}
                options={clientDropdownOptions}
                triggerIcon={<Building2 size={14} />}
              />

              {filterClient !== 'all' && (
                <button
                  onClick={() => setFilterClient('all')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200/80 text-stone-700 hover:text-stone-900 rounded-2xl text-xs font-bold transition-all cursor-pointer border border-stone-200/60 active:scale-95"
                  title="Voltar para a visão geral"
                >
                  <span>Ver tudo</span>
                  <RotateCcw size={12} className="text-stone-500" />
                </button>
              )}
            </div>

            {/* Filtros de Período */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 p-1 bg-stone-100/90 rounded-2xl border border-stone-200/60 shadow-2xs overflow-x-auto scrollbar-none">
                {[
                  { id: 'este_mes', label: 'Este mês' },
                  { id: 'ultimos_2_meses', label: 'Últimos 2 meses' },
                  { id: 'ultimos_3_meses', label: 'Últimos 3 meses' },
                  { id: 'este_ano', label: 'Este ano' },
                  { id: 'todo_periodo', label: 'Todo o período' },
                ].map((period) => (
                  <button
                    key={period.id}
                    onClick={() => setDashboardPeriod(period.id as DashboardPeriodType)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      dashboardPeriod === period.id
                        ? 'bg-white text-brand-dark shadow-xs border border-black/[0.04]'
                        : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/50'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>

              <div className="text-xs font-semibold text-stone-500 bg-stone-100/80 px-3.5 py-2 rounded-xl border border-stone-200/40 hidden sm:block">
                Período: <span className="font-bold text-brand-dark">{filteredPeriodLabel}</span>
              </div>
            </div>

          </div>

          {/* CARDS DE RESUMO (4 CARDS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Total Publicações no Período */}
            <div 
              onClick={() => {
                setFilterPeriod('todos');
                setFilterStatus('published');
                setActiveTab('publicacoes');
              }}
              className="p-5 rounded-3xl bg-white border border-emerald-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Total no Período
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-emerald-950 font-mono tracking-tight">
                  {summary.totalPeriodo}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md max-w-[120px] truncate">
                  {filteredPeriodLabel}
                </span>
              </div>
            </div>

            {/* 2. Este Mês */}
            <div 
              onClick={() => {
                setFilterPeriod('este_mes');
                setFilterStatus('published');
                setActiveTab('publicacoes');
              }}
              className="p-5 rounded-3xl bg-white border border-blue-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                  Publicados Este Mês
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Calendar size={16} />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-blue-950 font-mono tracking-tight">
                  {summary.esteMes}
                </span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                  {MONTH_SHORT_NAMES[currentMonthNum - 1]}
                </span>
              </div>
            </div>

            {/* 3. Aguardando Aprovação */}
            <div 
              onClick={() => {
                setFilterPeriod('todos');
                setFilterStatus('pending_approval');
                setActiveTab('publicacoes');
              }}
              className="p-5 rounded-3xl bg-white border border-amber-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Aguardando Aprovação
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock size={16} />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-amber-950 font-mono tracking-tight">
                  {summary.aguardandoAprovacao}
                </span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  Pendentes
                </span>
              </div>
            </div>

            {/* 4. Alteração Solicitada */}
            <div 
              onClick={() => {
                setFilterPeriod('todos');
                setFilterStatus('changes_requested');
                setActiveTab('publicacoes');
              }}
              className="p-5 rounded-3xl bg-white border border-orange-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-800">
                  Alteração Solicitada
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Edit3 size={16} />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-3xl font-bold text-orange-950 font-mono tracking-tight">
                  {summary.alteracaoSolicitada}
                </span>
                <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md">
                  Ajustes
                </span>
              </div>
            </div>

          </div>

          {/* GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* GRÁFICO 1 — Publicações por Mês (Barras Empilhadas) */}
            <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-[2.5rem] border border-black/[0.03] shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                <div>
                  <h3 className="text-base font-bold text-brand-dark tracking-tight flex items-center gap-2">
                    <BarChart3 size={18} className="text-stone-400" /> Publicações por Mês ({filteredPeriodLabel})
                  </h3>
                  <p className="text-xs text-stone-400 font-medium">
                    Distribuição mensal por status de produção e aprovação
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-semibold text-stone-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Publicado</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Aprovado</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Pendente</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-stone-300"></span> Rascunho</span>
                </div>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="publicado" name="Publicado" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="aprovado" name="Aprovado" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pendente" name="Pendente/Ajuste" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="rascunho" name="Rascunho" stackId="a" fill="#D1D5DB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRÁFICO 2 — Publicações por Cliente ou por Formato (Pizza) */}
            <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-black/[0.03] shadow-2xs space-y-6">
              <div className="pb-3 border-b border-stone-100">
                <h3 className="text-base font-bold text-brand-dark tracking-tight flex items-center gap-2">
                  <PieChartIcon size={18} className="text-stone-400" /> {filterClient === 'all' ? 'Publicações por Cliente' : 'Publicações por Formato'}
                </h3>
                <p className="text-xs text-stone-400 font-medium">
                  {filterClient === 'all' 
                    ? `Posts publicados em ${filteredPeriodLabel}` 
                    : `Distribuição por formato em ${filteredPeriodLabel}`}
                </p>
              </div>

              {(filterClient === 'all' ? clientPieData : formatPieData).length === 0 ? (
                <div className="h-[250px] flex flex-col items-center justify-center text-center p-4 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                  <p className="text-xs font-bold text-stone-600">Nenhum post publicado em {filteredPeriodLabel} ainda</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">O gráfico será atualizado conforme os posts forem publicados.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={filterClient === 'all' ? clientPieData : formatPieData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={3}
                        >
                          {(filterClient === 'all' ? clientPieData : formatPieData).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={filterClient === 'all' ? <CustomPieTooltip /> : <CustomFormatPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legenda com percentuais */}
                  <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                    {(filterClient === 'all' ? clientPieData : formatPieData).map((entry, index) => {
                      const currentList = filterClient === 'all' ? clientPieData : formatPieData;
                      const totalPubs = currentList.reduce((acc, c) => acc + c.count, 0);
                      const pct = totalPubs > 0 ? Math.round((entry.count / totalPubs) * 100) : 0;
                      return (
                        <div key={index} className="flex items-center justify-between text-xs text-stone-600 py-0.5">
                          <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                            <span className="font-semibold text-stone-800 truncate">{entry.name}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                            <span className="text-stone-400 font-normal">{pct}%</span>
                            <span className="font-bold text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded">{entry.count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* GRÁFICO 3 — Evolução Mensal (Linha) */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-black/[0.03] shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-brand-dark tracking-tight flex items-center gap-2">
                  <TrendingUp size={18} className="text-stone-400" /> Evolução Mensal de Conteúdo
                </h3>
                <p className="text-xs text-stone-400 font-medium">
                  Tendência de volume de publicações programadas e aprovadas ({filteredPeriodLabel})
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 w-fit">
                Volume Total
              </span>
            </div>

            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CustomLineTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="publicacoes" 
                    name="Publicações" 
                    stroke="#1A1A1A" 
                    strokeWidth={3} 
                    dot={{ fill: '#1A1A1A', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#059669' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </motion.div>
      )}

      {/* ABA 2: PUBLICAÇÕES (LISTA FILTRADA) */}
      {activeTab === 'publicacoes' && (
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* BARRA DE FILTROS */}
          <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-black/[0.03] shadow-2xs space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              
              {/* Filtros Dropdowns Customizados */}
              <div className="flex flex-wrap items-center gap-3">
                
                {/* 1. Cliente */}
                <CustomDropdown
                  value={filterClient}
                  onChange={setFilterClient}
                  options={clientDropdownOptions}
                  triggerIcon={<Building2 size={14} />}
                />

                {/* 2. Status */}
                <CustomDropdown
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={statusDropdownOptions}
                  triggerIcon={<Filter size={14} />}
                />

                {/* 3. Período */}
                <CustomDropdown
                  value={filterPeriod}
                  onChange={setFilterPeriod}
                  options={periodDropdownOptions}
                  triggerIcon={<Calendar size={14} />}
                />

              </div>

              {/* Busca Textual */}
              <div className="relative min-w-[240px]">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input 
                  type="text"
                  placeholder="Buscar por tema ou cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brand-dark transition-colors font-medium"
                />
              </div>

            </div>
          </div>

          {/* LISTA DE PUBLICAÇÕES AGRUPADAS POR DATA */}
          {groupedFilteredPosts.length === 0 ? (
            <div className="py-16 px-6 rounded-[2rem] bg-white border border-dashed border-stone-200 text-center flex flex-col items-center justify-center space-y-2 shadow-2xs">
              <span className="text-3xl mb-1">📋</span>
              <h4 className="text-sm font-bold text-stone-700">Nenhuma publicação encontrada para os filtros selecionados.</h4>
              <p className="text-xs text-stone-400 max-w-sm">Tente ajustar o cliente, o período ou limpar a busca textual.</p>
              {(filterClient !== 'all' || filterStatus !== 'all' || filterPeriod !== 'todos' || searchQuery) && (
                <button
                  onClick={() => {
                    setFilterClient('all');
                    setFilterStatus('all');
                    setFilterPeriod('todos');
                    setSearchQuery('');
                  }}
                  className="mt-3 text-xs font-bold text-brand-dark underline cursor-pointer hover:opacity-75"
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedFilteredPosts.map((group) => (
                <div key={group.label} className="bg-white p-6 sm:p-7 rounded-[2rem] border border-black/[0.03] shadow-2xs space-y-4">
                  
                  {/* Cabeçalho da Data */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-dark px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200/60">
                      {group.label}
                    </span>
                    <span className="text-xs text-stone-400 font-medium">
                      {group.items.length} {group.items.length === 1 ? 'publicação' : 'publicações'}
                    </span>
                    <div className="h-px bg-stone-100 flex-grow"></div>
                  </div>

                  {/* Itens do Dia */}
                  <div className="grid grid-cols-1 gap-3">
                    {group.items.map((item) => {
                      const statusBadge = getStatusBadge(item.status);

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleOpenPostModal(item)}
                          className="p-4 rounded-2xl bg-stone-50/60 hover:bg-stone-100/80 border border-stone-200/70 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 group active:scale-[0.99]"
                        >
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                            {/* Logo ou Avatar */}
                            {item.client.logo_url ? (
                              <img 
                                src={item.client.logo_url} 
                                alt={item.client.name} 
                                className="w-7 h-7 rounded-full object-cover border border-stone-200 shrink-0 mt-0.5 sm:mt-0" 
                              />
                            ) : (
                              <div 
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 sm:mt-0 shadow-2xs"
                                style={{ backgroundColor: item.client.color || '#1A1A1A' }}
                              >
                                {item.client.initials || item.client.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}

                            {/* Informações da Publicação */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                                  {item.client.name}
                                </span>
                                <span className="text-stone-300 text-xs hidden sm:inline">•</span>
                                <span className="text-[11px] font-semibold text-stone-600 bg-white px-2 py-0.5 rounded-md border border-stone-200/60 shrink-0">
                                  {item.type || 'Post'}
                                </span>
                                {item.platforms && item.platforms.length > 0 && (
                                  <div className="flex items-center gap-1 text-stone-400">
                                    {item.platforms.includes('meta') && <Instagram size={13} className="text-pink-600" />}
                                    {item.platforms.includes('linkedin') && <Linkedin size={13} className="text-blue-600" />}
                                    {item.platforms.includes('tiktok') && <Video size={13} className="text-stone-700" />}
                                  </div>
                                )}
                                {item.scheduled_time && (
                                  <span className="text-[10px] font-mono text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                                    {item.scheduled_time}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs sm:text-sm text-stone-600 font-medium truncate mt-1">
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

      {/* POST MODAL PARA EDIÇÃO / CRIAÇÃO */}
      {modalOpen && selectedPost && (
        <PostModal
          dayContent={selectedPost.dayContent}
          dateKey={selectedPost.dateKey}
          groupKeys={selectedPost.groupKeys}
          isNew={selectedPost.isNew}
          defaultDate={selectedPost.defaultDate}
          clientOverride={selectedPost.clientOverride}
          isMasterMap={true}
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

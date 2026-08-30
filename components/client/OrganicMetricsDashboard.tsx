import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, useAuth } from '../../lib/supabase';
import { SocialMetric } from '../../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Users, 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  MousePointer, 
  Video, 
  Filter, 
  Calendar, 
  Sparkles, 
  Instagram, 
  Facebook, 
  Linkedin, 
  BarChart3, 
  Activity, 
  RefreshCw,
  HelpCircle,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Link2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

interface OrganicMetricsDashboardProps {
  clientId: string;
  agencyId?: number;
  clientName?: string;
}

type PeriodType = '7d' | '30d' | '90d' | 'este_mes' | 'mes_anterior' | 'este_ano';

const PLATFORMS_WITHOUT_REACH = ['tiktok'];
const PLATFORMS_WITHOUT_ENGAGEMENT: string[] = [];

const PLATFORM_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  instagram: { label: 'Instagram', icon: Instagram, color: '#E1306C', bgColor: '#FDF2F8' },
  facebook: { label: 'Facebook', icon: Facebook, color: '#1877F2', bgColor: '#EFF6FF' },
  tiktok: { label: 'TikTok', icon: Video, color: '#000000', bgColor: '#F4F4F5' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, color: '#0A66C2', bgColor: '#F0F9FF' },
};

export const OrganicMetricsDashboard: React.FC<OrganicMetricsDashboardProps> = ({
  clientId,
  agencyId,
  clientName
}) => {
  const { userRole } = useAuth();
  const [metrics, setMetrics] = useState<SocialMetric[]>([]);
  const [loading, setLoading] = useState(true);

  // Inicializar estado de plataforma e período a partir de parâmetros da URL
  const [selectedPlatform, setSelectedPlatform] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    const params = new URLSearchParams(window.location.search);
    return params.get('platform') || 'all';
  });

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(() => {
    if (typeof window === 'undefined') return '30d';
    const params = new URLSearchParams(window.location.search);
    const p = params.get('period');
    const validPeriods: PeriodType[] = ['7d', '30d', '90d', 'este_mes', 'mes_anterior', 'este_ano'];
    return (validPeriods.includes(p as PeriodType) ? p : '30d') as PeriodType;
  });

  const [activeChartMetric, setActiveChartMetric] = useState<'reach' | 'impressions' | 'engagement' | 'followers'>('reach');
  const [linkCopied, setLinkCopied] = useState(false);

  const showReachCard = !PLATFORMS_WITHOUT_REACH.includes(selectedPlatform);
  const showEngagementCard = !PLATFORMS_WITHOUT_ENGAGEMENT.includes(selectedPlatform);

  // Auto-trocar métrica do gráfico ao selecionar LinkedIn ou TikTok
  useEffect(() => {
    if (PLATFORMS_WITHOUT_REACH.includes(selectedPlatform) && activeChartMetric === 'reach') {
      setActiveChartMetric('impressions');
    }
    if (PLATFORMS_WITHOUT_ENGAGEMENT.includes(selectedPlatform) && activeChartMetric === 'engagement') {
      setActiveChartMetric('impressions');
    }
  }, [selectedPlatform, activeChartMetric]);

  // Handler para copiar link com filtros aplicados (Admin only)
  const handleCopyLink = () => {
    const params = new URLSearchParams();
    params.set('view', 'organico');
    if (selectedPlatform !== 'all') {
      params.set('platform', selectedPlatform);
    }
    params.set('period', selectedPeriod);
    const url = `${window.location.origin}/?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  // Buscar dados da tabela social_metrics
  const fetchMetrics = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('social_metrics')
        .select('*')
        .eq('client_id', clientId)
        .order('date', { ascending: true });

      if (error) {
        // Se tabela ainda não existir ou falha de rede temporária
        console.warn('Aviso ao carregar social_metrics:', error.message);
        setMetrics([]);
      } else if (data) {
        setMetrics(data as SocialMetric[]);
      }
    } catch (err) {
      console.error('Erro ao buscar métricas orgânicas:', err);
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Identificar plataformas que possuem dados gravados
  const availablePlatforms = useMemo(() => {
    const set = new Set<string>();
    metrics.forEach(m => {
      if (m.platform) set.add(m.platform.toLowerCase());
    });
    return Array.from(set);
  }, [metrics]);

  // Se a plataforma selecionada não estiver disponível, redefinir para 'all'
  useEffect(() => {
    if (selectedPlatform !== 'all' && !availablePlatforms.includes(selectedPlatform)) {
      setSelectedPlatform('all');
    }
  }, [availablePlatforms, selectedPlatform]);

  // Calcular intervalos de data (Período Atual vs Período Anterior)
  const { currentStartDate, currentEndDate, prevStartDate, prevEndDate, periodLabel } = useMemo(() => {
    const today = dayjs().endOf('day');
    let curStart: dayjs.Dayjs;
    let curEnd: dayjs.Dayjs = today;
    let prevStart: dayjs.Dayjs;
    let prevEnd: dayjs.Dayjs;
    let label = 'Últimos 30 dias';

    if (selectedPeriod === '7d') {
      curStart = today.subtract(6, 'day').startOf('day');
      const diffDays = curEnd.diff(curStart, 'day') + 1;
      prevEnd = curStart.subtract(1, 'day').endOf('day');
      prevStart = prevEnd.subtract(diffDays - 1, 'day').startOf('day');
      label = 'Últimos 7 dias';
    } else if (selectedPeriod === '30d') {
      curStart = today.subtract(29, 'day').startOf('day');
      const diffDays = curEnd.diff(curStart, 'day') + 1;
      prevEnd = curStart.subtract(1, 'day').endOf('day');
      prevStart = prevEnd.subtract(diffDays - 1, 'day').startOf('day');
      label = 'Últimos 30 dias';
    } else if (selectedPeriod === '90d') {
      curStart = today.subtract(89, 'day').startOf('day');
      const diffDays = curEnd.diff(curStart, 'day') + 1;
      prevEnd = curStart.subtract(1, 'day').endOf('day');
      prevStart = prevEnd.subtract(diffDays - 1, 'day').startOf('day');
      label = 'Últimos 90 dias';
    } else if (selectedPeriod === 'este_mes') {
      curStart = today.startOf('month');
      curEnd = today;
      const dayOfMonth = today.date();
      const prevMonth = today.subtract(1, 'month');
      prevStart = prevMonth.startOf('month');
      prevEnd = prevMonth.date(Math.min(dayOfMonth, prevMonth.daysInMonth())).endOf('day');
      label = `Este mês (${today.format('MMMM')})`;
    } else if (selectedPeriod === 'mes_anterior') {
      const lastMonth = today.subtract(1, 'month');
      curStart = lastMonth.startOf('month');
      curEnd = lastMonth.endOf('month');
      const twoMonthsAgo = today.subtract(2, 'month');
      prevStart = twoMonthsAgo.startOf('month');
      prevEnd = twoMonthsAgo.endOf('month');
      label = `Mês anterior (${lastMonth.format('MMMM')})`;
    } else {
      // este_ano
      curStart = today.startOf('year');
      curEnd = today;
      const prevYear = today.subtract(1, 'year');
      prevStart = prevYear.startOf('year');
      prevEnd = prevYear.date(Math.min(today.date(), prevYear.daysInMonth())).month(today.month()).endOf('day');
      label = `Este ano (${today.year()})`;
    }

    return {
      currentStartDate: curStart.format('YYYY-MM-DD'),
      currentEndDate: curEnd.format('YYYY-MM-DD'),
      prevStartDate: prevStart.format('YYYY-MM-DD'),
      prevEndDate: prevEnd.format('YYYY-MM-DD'),
      periodLabel: label
    };
  }, [selectedPeriod]);

  // Filtrar métricas por plataforma e período
  const { currentMetrics, previousMetrics, latestFollowersCount } = useMemo(() => {
    let list = metrics;
    if (selectedPlatform !== 'all') {
      list = list.filter(m => m.platform?.toLowerCase() === selectedPlatform);
    }

    const cur = list.filter(m => m.date >= currentStartDate && m.date <= currentEndDate);
    const prev = list.filter(m => m.date >= prevStartDate && m.date <= prevEndDate);

    // Obter o followers_count mais recente
    let latestFollowers = 0;
    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
    if (sorted.length > 0) {
      for (const item of sorted) {
        if (typeof item.followers_count === 'number' && item.followers_count > 0) {
          latestFollowers = item.followers_count;
          break;
        }
      }
    }

    return {
      currentMetrics: cur,
      previousMetrics: prev,
      latestFollowersCount: latestFollowers
    };
  }, [metrics, selectedPlatform, currentStartDate, currentEndDate, prevStartDate, prevEndDate]);

  // Somatórias e indicadores
  const processedData = useMemo(() => {
    const sumField = (items: SocialMetric[], field: keyof SocialMetric) => {
      return items.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);
    };

    // Período Atual
    const reach = sumField(currentMetrics, 'reach');
    const impressions = sumField(currentMetrics, 'impressions');
    const likes = sumField(currentMetrics, 'likes');
    const comments = sumField(currentMetrics, 'comments');
    const shares = sumField(currentMetrics, 'shares');
    const saves = sumField(currentMetrics, 'saves');
    const followersGained = sumField(currentMetrics, 'followers_gained');
    const profileVisits = sumField(currentMetrics, 'profile_visits');
    const websiteClicks = sumField(currentMetrics, 'website_clicks');
    const videoViews = sumField(currentMetrics, 'video_views');

    const totalEngagement = likes + comments + shares + saves;
    const engagementRate = reach > 0 ? (totalEngagement / reach) * 100 : 0;

    // Período Anterior
    const prevReach = sumField(previousMetrics, 'reach');
    const prevImpressions = sumField(previousMetrics, 'impressions');
    const prevLikes = sumField(previousMetrics, 'likes');
    const prevComments = sumField(previousMetrics, 'comments');
    const prevShares = sumField(previousMetrics, 'shares');
    const prevSaves = sumField(previousMetrics, 'saves');
    const prevFollowersGained = sumField(previousMetrics, 'followers_gained');
    const prevTotalEngagement = prevLikes + prevComments + prevShares + prevSaves;

    const calcVariation = (curr: number, prev: number) => {
      if (prev === 0) {
        return curr > 0 ? 100 : 0;
      }
      return ((curr - prev) / prev) * 100;
    };

    const reachVariation = calcVariation(reach, prevReach);
    const impressionsVariation = calcVariation(impressions, prevImpressions);
    const engagementVariation = calcVariation(totalEngagement, prevTotalEngagement);
    const followersVariation = calcVariation(followersGained, prevFollowersGained);

    return {
      reach,
      impressions,
      totalEngagement,
      engagementRate,
      followersGained,
      likes,
      comments,
      shares,
      saves,
      profileVisits,
      websiteClicks,
      videoViews,
      reachVariation,
      impressionsVariation,
      engagementVariation,
      followersVariation,
      hasPreviousData: previousMetrics.length > 0
    };
  }, [currentMetrics, previousMetrics]);

  // Gráfico de Linha do Tempo / Tendência (Diário)
  const chartData = useMemo(() => {
    // Agrupar métricas atuais por data
    const map: Record<string, {
      date: string;
      formattedDate: string;
      reach: number;
      impressions: number;
      engagement: number;
      followers: number;
    }> = {};

    // Gerar todos os dias do intervalo para não deixar buracos
    let curr = dayjs(currentStartDate);
    const end = dayjs(currentEndDate);

    while (curr.isBefore(end) || curr.isSame(end, 'day')) {
      const dateStr = curr.format('YYYY-MM-DD');
      map[dateStr] = {
        date: dateStr,
        formattedDate: curr.format('DD/MM'),
        reach: 0,
        impressions: 0,
        engagement: 0,
        followers: 0,
      };
      curr = curr.add(1, 'day');
    }

    currentMetrics.forEach(m => {
      if (map[m.date]) {
        map[m.date].reach += Number(m.reach) || 0;
        map[m.date].impressions += Number(m.impressions) || 0;
        const eng = (Number(m.likes) || 0) + (Number(m.comments) || 0) + (Number(m.shares) || 0) + (Number(m.saves) || 0);
        map[m.date].engagement += eng;
        map[m.date].followers += Number(m.followers_gained) || 0;
      }
    });

    return Object.values(map);
  }, [currentMetrics, currentStartDate, currentEndDate]);

  // Tabs do gráfico temporal filtrando métricas não suportadas
  const chartMetricTabs = useMemo(() => {
    return [
      { id: 'reach', label: 'Alcance' },
      { id: 'impressions', label: 'Impressões' },
      { id: 'engagement', label: 'Engajamento' },
      { id: 'followers', label: 'Seguidores' },
    ].filter(tab => {
      if (tab.id === 'reach' && PLATFORMS_WITHOUT_REACH.includes(selectedPlatform)) return false;
      if (tab.id === 'engagement' && PLATFORMS_WITHOUT_ENGAGEMENT.includes(selectedPlatform)) return false;
      return true;
    });
  }, [selectedPlatform]);

  // Helper para renderizar indicador de variação
  const renderVariation = (variation: number, hasPrev: boolean) => {
    if (!hasPrev) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-400">
          <Minus size={12} />
          <span>Sem histórico ant.</span>
        </span>
      );
    }

    const isPositive = variation > 0;
    const isNeutral = variation === 0;

    if (isNeutral) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-500">
          <Minus size={12} />
          <span>0.0% vs período anterior</span>
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${
        isPositive ? 'text-emerald-700' : 'text-rose-700'
      }`}>
        {isPositive ? <TrendingUp size={13} className="text-emerald-600" /> : <TrendingDown size={13} className="text-rose-600" />}
        <span>{isPositive ? '+' : ''}{variation.toFixed(1)}%</span>
        <span className="text-stone-400 font-normal text-[10px]">vs ant.</span>
      </span>
    );
  };

  // Formatação de números grandes
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const chartColorMap = {
    reach: { stroke: '#13284D', fill: '#13284D', label: 'Alcance Diário' },
    impressions: { stroke: '#2563EB', fill: '#2563EB', label: 'Impressões Diárias' },
    engagement: { stroke: '#059669', fill: '#059669', label: 'Engajamento Diário' },
    followers: { stroke: '#7C3AED', fill: '#7C3AED', label: 'Seguidores Ganhos' },
  };

  const currentChartConfig = chartColorMap[activeChartMetric] || chartColorMap.impressions;

  // Custom Tooltip do gráfico de tendência
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0];
      const dateItem = chartData.find(d => d.formattedDate === label);
      return (
        <div className="bg-[#13284D] text-white p-3.5 rounded-2xl shadow-2xl border border-white/10 text-xs min-w-[190px] space-y-2 z-50">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 font-bold">
            <span className="text-stone-200">{dateItem ? dayjs(dateItem.date).format('DD [de] MMMM [de] YYYY') : label}</span>
          </div>
          <div className="space-y-1 font-mono">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-stone-300 font-sans">{currentChartConfig.label}:</span>
              <span className="font-bold text-emerald-400 text-sm">{formatNumber(dataPoint.value)}</span>
            </div>
            {dateItem && activeChartMetric !== 'reach' && showReachCard && (
              <div className="flex items-center justify-between gap-3 text-[11px] text-stone-300 font-sans">
                <span>Alcance:</span>
                <span className="font-mono text-white">{formatNumber(dateItem.reach)}</span>
              </div>
            )}
            {dateItem && activeChartMetric !== 'engagement' && showEngagementCard && (
              <div className="flex items-center justify-between gap-3 text-[11px] text-stone-300 font-sans">
                <span>Engajamento:</span>
                <span className="font-mono text-white">{formatNumber(dateItem.engagement)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-stone-400 flex flex-col items-center justify-center">
        <RefreshCw size={32} className="animate-spin text-[#13284D] mb-4" />
        <p className="text-sm font-semibold text-stone-600">Carregando métricas de redes sociais...</p>
        <p className="text-xs text-stone-400 mt-1">Buscando dados sincronizados das redes sociais</p>
      </div>
    );
  }

  // Se não houver dados nenhum para o cliente na tabela social_metrics
  if (metrics.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-14 border border-stone-200/70 text-center shadow-xs max-w-3xl mx-auto my-8">
        <div className="w-16 h-16 rounded-3xl bg-[#13284D]/5 text-[#13284D] flex items-center justify-center mx-auto mb-6">
          <Activity size={30} />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-[#13284D] mb-3 tracking-tight">
          Nenhuma métrica de redes sociais sincronizada ainda
        </h3>
        <p className="text-sm text-stone-500 max-w-lg mx-auto leading-relaxed mb-6 font-medium">
          Os dados de alcance, impressões e engajamento das redes sociais serão coletados automaticamente todos os dias por nossa rotina de sincronização e exibidos neste painel.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-xl text-xs font-semibold text-stone-500 border border-stone-200/60">
          <Sparkles size={14} className="text-amber-500" />
          <span>Sincronização diária contínua ativa</span>
        </div>
      </div>
    );
  }

  // Calcular proporções de engajamento para a barra de distribuição
  const totalEng = processedData.totalEngagement || 1;
  const likesPct = Math.round((processedData.likes / totalEng) * 100);
  const commentsPct = Math.round((processedData.comments / totalEng) * 100);
  const sharesPct = Math.round((processedData.shares / totalEng) * 100);
  const savesPct = Math.round((processedData.saves / totalEng) * 100);

  const periods: { id: PeriodType; label: string }[] = [
    { id: '7d', label: 'Últimos 7 dias' },
    { id: '30d', label: 'Últimos 30 dias' },
    { id: '90d', label: 'Últimos 90 dias' },
    { id: 'este_mes', label: 'Este mês' },
    { id: 'mes_anterior', label: 'Mês anterior' },
    { id: 'este_ano', label: 'Este ano' },
  ];

  return (
    <div className="space-y-6">
      
      {/* ========================================================================= */}
      {/* CONTROLES SUPERIORES: PLATAFORMAS, PERÍODOS E COPIAR LINK */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-stone-200/70 shadow-xs flex flex-col gap-3 w-full">
        
        {/* Linha Superior: Pílulas de Plataforma + Botão Copiar Link (Admin) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Pílulas de Plataforma (Apenas plataformas que possuem dados gravados) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-nowrap">
            <button
              onClick={() => setSelectedPlatform('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                selectedPlatform === 'all'
                  ? 'bg-[#13284D] text-white shadow-xs'
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200/60'
              }`}
            >
              <Layers size={14} />
              <span>Todas as Redes</span>
            </button>

            {availablePlatforms.map((plat) => {
              const config = PLATFORM_CONFIG[plat] || { label: plat, icon: Activity, color: '#13284D', bgColor: '#F4F4F5' };
              const Icon = config.icon;
              const isSelected = selectedPlatform === plat;
              return (
                <button
                  key={plat}
                  onClick={() => setSelectedPlatform(plat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                    isSelected
                      ? 'bg-[#13284D] text-white shadow-xs'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200/60'
                  }`}
                >
                  <Icon size={14} style={{ color: isSelected ? '#ffffff' : config.color }} />
                  <span>{config.label}</span>
                </button>
              );
            })}
          </div>

          {/* Botão Copiar Link (Visível apenas para Admin) */}
          {userRole === 'admin' && (
            <button
              onClick={handleCopyLink}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto ${
                linkCopied
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 border border-gray-200/60'
              }`}
              title="Copiar link direto para esta visualização"
            >
              <Link2 size={13} />
              <span>{linkCopied ? 'Link copiado!' : 'Copiar link'}</span>
            </button>
          )}
        </div>

        {/* Linha Inferior: Seletores de Período com scroll horizontal */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-nowrap pb-1 pt-1 border-t border-stone-100">
          <div className="flex items-center gap-1 p-1 bg-stone-100/90 rounded-xl border border-stone-200/60 overflow-x-auto scrollbar-none flex-nowrap">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedPeriod === p.id
                    ? 'bg-white text-[#13284D] shadow-xs'
                    : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* CARDS PRINCIPAIS DE MÉTRICAS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* 1. ALCANCE (REACH) — Oculto para TikTok */}
        {showReachCard && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/70 shadow-xs hover:border-[#13284D]/30 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">
                  Alcance Único
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Users size={15} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[#13284D] font-mono tracking-tight">
                {formatNumber(processedData.reach)}
              </div>
              {selectedPlatform === 'linkedin' && processedData.reach === 0 && (
                <p className="text-[10px] text-amber-500 mt-1">Coleta expandida a partir de ago/2026</p>
              )}
              <p className="text-[10px] sm:text-[11px] text-stone-400 font-medium mt-0.5">
                {selectedPlatform === 'linkedin' ? 'Membros únicos alcançados' : 'Contas alcançadas'}
              </p>
            </div>
            <div className="mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-stone-100 flex items-center justify-between">
              {renderVariation(processedData.reachVariation, processedData.hasPreviousData)}
            </div>
          </div>
        )}

        {/* 2. IMPRESSÕES (IMPRESSIONS) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/70 shadow-xs hover:border-[#13284D]/30 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">
                Impressões
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Eye size={15} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#13284D] font-mono tracking-tight">
              {formatNumber(processedData.impressions)}
            </div>
            <p className="text-[10px] sm:text-[11px] text-stone-400 font-medium mt-0.5">
              Visualizações totais
            </p>
          </div>
          <div className="mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-stone-100 flex items-center justify-between">
            {renderVariation(processedData.impressionsVariation, processedData.hasPreviousData)}
          </div>
        </div>

        {/* 3. ENGAJAMENTO TOTAL & TAXA DE ENGAJAMENTO */}
        {showEngagementCard && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/70 shadow-xs hover:border-[#13284D]/30 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">
                  Engajamento Total
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Heart size={15} />
                </div>
              </div>
              <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                <span className="text-2xl sm:text-3xl font-black text-[#13284D] font-mono tracking-tight">
                  {formatNumber(processedData.totalEngagement)}
                </span>
                {processedData.engagementRate > 0 && (
                  <span className="text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-mono">
                    {processedData.engagementRate.toFixed(2)}%
                  </span>
                )}
              </div>
              {selectedPlatform === 'linkedin' && processedData.totalEngagement === 0 && (
                <p className="text-[10px] text-amber-500 mt-1">Coleta expandida a partir de ago/2026</p>
              )}
              <p className="text-[10px] sm:text-[11px] text-stone-400 font-medium mt-0.5">
                {selectedPlatform === 'linkedin' ? 'Reações, comentários e republicações' : 'Curtidas, comentários e salvos'}
              </p>
            </div>
            <div className="mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-stone-100 flex items-center justify-between">
              {renderVariation(processedData.engagementVariation, processedData.hasPreviousData)}
            </div>
          </div>
        )}

        {/* 4. SEGUIDORES GANHOS & TOTAL */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/70 shadow-xs hover:border-[#13284D]/30 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">
                Novos Seguidores
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <TrendingUp size={15} />
              </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-black text-[#13284D] font-mono tracking-tight">
                {processedData.followersGained >= 0 ? `+${formatNumber(processedData.followersGained)}` : formatNumber(processedData.followersGained)}
              </span>
              {latestFollowersCount > 0 && (
                <span className="text-[10px] sm:text-xs text-stone-500 font-semibold">
                  ({formatNumber(latestFollowersCount)})
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-stone-400 font-medium mt-0.5">
              Saldo de crescimento
            </p>
          </div>
          <div className="mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-stone-100 flex items-center justify-between">
            {renderVariation(processedData.followersVariation, processedData.hasPreviousData)}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* GRÁFICO DE TENDÊNCIA TEMPORAL (AREA CHART) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-4 sm:p-7 border border-stone-200/70 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#13284D] tracking-tight">
              Evolução Temporal ({periodLabel})
            </h3>
            <p className="text-xs text-stone-400 font-medium">
              Acompanhamento diário de performance orgânica
            </p>
          </div>

          {/* Switch de Métricas no Gráfico */}
          <div className="flex items-center gap-1 p-1 bg-stone-100/90 rounded-xl border border-stone-200/60 self-start sm:self-auto overflow-x-auto scrollbar-none flex-nowrap">
            {chartMetricTabs.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveChartMetric(m.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeChartMetric === m.id
                    ? 'bg-[#13284D] text-white shadow-xs'
                    : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[260px] sm:h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={currentChartConfig.stroke} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={currentChartConfig.stroke} stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis 
                dataKey="formattedDate" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} 
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: '#9CA3AF', fontSize: 11 }} 
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                allowDecimals={false} 
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Area 
                type="monotone" 
                dataKey={activeChartMetric} 
                stroke={currentChartConfig.stroke} 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#colorMetric)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CARDS DE MÉTRICAS SECUNDÁRIAS (SOMENTE EXIBE O QUE TEM VALOR > 0) */}
      {/* ========================================================================= */}
      <div>
        <h3 className="text-sm font-bold text-[#13284D] uppercase tracking-wider mb-3">
          Detalhamento de Interações & Atividades
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          
          {/* Curtidas / Reações */}
          {processedData.likes > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs">
              <div className="flex items-center gap-2 text-rose-600 mb-2">
                <Heart size={15} />
                <span className="text-xs font-bold text-stone-600">
                  {selectedPlatform === 'linkedin' ? 'Reações' : 'Curtidas'}
                </span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-[#13284D] font-mono">
                {formatNumber(processedData.likes)}
              </div>
            </div>
          )}

          {/* Comentários */}
          {processedData.comments > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <MessageCircle size={15} />
                <span className="text-xs font-bold text-stone-600">Comentários</span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-[#13284D] font-mono">
                {formatNumber(processedData.comments)}
              </div>
            </div>
          )}

          {/* Compartilhamentos / Republicações */}
          {processedData.shares > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <Share2 size={15} />
                <span className="text-xs font-bold text-stone-600">
                  {selectedPlatform === 'linkedin' ? 'Republicações' : 'Compartilhados'}
                </span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-[#13284D] font-mono">
                {formatNumber(processedData.shares)}
              </div>
            </div>
          )}

          {/* Salvamentos */}
          {processedData.saves > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <Bookmark size={15} />
                <span className="text-xs font-bold text-stone-600">Salvamentos</span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-[#13284D] font-mono">
                {formatNumber(processedData.saves)}
              </div>
            </div>
          )}

          {/* Visitas ao Perfil / Página */}
          {processedData.profileVisits > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Users size={15} />
                <span className="text-xs font-bold text-stone-600">
                  {selectedPlatform === 'linkedin' ? 'Visitas à Página' : 'Visitas ao Perfil'}
                </span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-[#13284D] font-mono">
                {formatNumber(processedData.profileVisits)}
              </div>
            </div>
          )}

          {/* Cliques no Link do Site */}
          {processedData.websiteClicks > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs">
              <div className="flex items-center gap-2 text-teal-600 mb-2">
                <MousePointer size={15} />
                <span className="text-xs font-bold text-stone-600">Cliques no Link</span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-[#13284D] font-mono">
                {formatNumber(processedData.websiteClicks)}
              </div>
            </div>
          )}

          {/* Visualizações de Vídeo */}
          {processedData.videoViews > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <Video size={15} />
                <span className="text-xs font-bold text-stone-600">Views de Vídeo</span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-[#13284D] font-mono">
                {formatNumber(processedData.videoViews)}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* DISTRIBUIÇÃO DO ENGAJAMENTO & PROPORÇÃO */}
      {/* ========================================================================= */}
      {processedData.totalEngagement > 0 && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-stone-200/70 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h4 className="text-sm font-bold text-[#13284D]">
                Distribuição das Interações
              </h4>
              <p className="text-xs text-stone-400 font-medium">
                Composição do engajamento total no período selecionado
              </p>
            </div>
            <div className="text-xs font-semibold text-stone-500">
              Total: <span className="font-bold text-[#13284D] font-mono">{formatNumber(processedData.totalEngagement)}</span> interações
            </div>
          </div>

          {/* Barra de Proporção Colorida */}
          <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden flex mb-4">
            {likesPct > 0 && <div style={{ width: `${likesPct}%` }} className="bg-rose-500 h-full" title={`${selectedPlatform === 'linkedin' ? 'Reações' : 'Curtidas'}: ${likesPct}%`} />}
            {commentsPct > 0 && <div style={{ width: `${commentsPct}%` }} className="bg-blue-500 h-full" title={`Comentários: ${commentsPct}%`} />}
            {sharesPct > 0 && <div style={{ width: `${sharesPct}%` }} className="bg-indigo-500 h-full" title={`${selectedPlatform === 'linkedin' ? 'Republicações' : 'Compartilhamentos'}: ${sharesPct}%`} />}
            {savesPct > 0 && <div style={{ width: `${savesPct}%` }} className="bg-amber-500 h-full" title={`Salvamentos: ${savesPct}%`} />}
          </div>

          {/* Legenda com percentuais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-stone-600 font-medium">{selectedPlatform === 'linkedin' ? 'Reações:' : 'Curtidas:'}</span>
              <span className="font-bold text-[#13284D] font-mono">{likesPct}% ({formatNumber(processedData.likes)})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-stone-600 font-medium">Comentários:</span>
              <span className="font-bold text-[#13284D] font-mono">{commentsPct}% ({formatNumber(processedData.comments)})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-stone-600 font-medium">{selectedPlatform === 'linkedin' ? 'Republicações:' : 'Shares:'}</span>
              <span className="font-bold text-[#13284D] font-mono">{sharesPct}% ({formatNumber(processedData.shares)})</span>
            </div>
            {savesPct > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-stone-600 font-medium">Salvos:</span>
                <span className="font-bold text-[#13284D] font-mono">{savesPct}% ({formatNumber(processedData.saves)})</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};


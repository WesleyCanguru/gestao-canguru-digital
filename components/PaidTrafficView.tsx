import React, { useState, useEffect, useMemo } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { processTrafficStrategyPdf } from '../src/services/geminiService';
import { TrafficStrategyData } from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  ChevronLeft,
  ChevronRight,
  Target,
  DollarSign,
  Users,
  Search,
  MessageCircle,
  AlertTriangle,
  Zap,
  Globe,
  Upload,
  Loader2,
  FileText,
  MousePointer,
  Eye,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Sparkles,
  Link2,
  Layers,
  Activity,
  ArrowUpRight,
  HelpCircle,
  Calendar,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

dayjs.locale('pt-br');

// Tipos de período suportados
type PeriodType = '7d' | '30d' | '90d' | 'este_mes' | 'mes_anterior' | 'este_ano';

interface PaidTrafficViewProps {
  onBack?: () => void;
}

interface PaidTrafficMetricRow {
  id: string;
  client_id: string;
  agency_id: number;
  report_date: string;
  platform: 'meta' | 'google' | string;
  investment: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  roas: number | null;
  created_at: string;
}

// Configuração visual de plataformas
const PLATFORM_CONFIG: Record<string, { label: string; iconLabel: string; color: string; bgColor: string; conversionLabel: string; conversionSublabel: string }> = {
  meta: {
    label: 'Meta Ads',
    iconLabel: 'Meta (Insta & Face)',
    color: '#0081FB',
    bgColor: '#EFF6FF',
    conversionLabel: 'Conversas no WhatsApp',
    conversionSublabel: 'Contatos diretos iniciados',
  },
  google: {
    label: 'Google Ads',
    iconLabel: 'Google (Pesquisa)',
    color: '#EA4335',
    bgColor: '#FEF2F2',
    conversionLabel: 'Formulários Preenchidos',
    conversionSublabel: 'Leads e cadastros gerados',
  },
};

const CALABRES_STRATEGY: TrafficStrategyData = {
  kpis: {
    monthlyBudget: "R$ 600",
    budgetDetails: "R$ 25/dia (segunda a sábado a princípio para quesito de teste) (Mês 1 = aprendizado)",
    priorityGoal: "5 clientes",
    goalDetails: "Objetivo para o Mês",
    averageTicket: "R$ 2.000",
    ticketDetails: "Por cliente fechado"
  },
  strategicDecision: {
    title: "Decisão Estratégica",
    items: [
      {
        title: "100% Google Ads (Rede de Pesquisa)",
        description: "O público já está com o problema e buscando solução agora. O Google captura essa intenção ativa. O Meta Ads fará sentido quando o tráfego orgânico já existir e houver público para remarketing (previsto para os meses 3 ou 4).",
        color: "brand-dark"
      },
      {
        title: "Destino: Landing Pages Exclusivas por Conjunto",
        description: "Cada conjunto de anúncios direciona para uma landing page própria, com copy alinhada à intenção de busca de cada público. As páginas já estão publicadas e os links estão configurados nos grupos de anúncios.",
        color: "green-500"
      }
    ]
  },
  campaignStructure: {
    title: "Estrutura das Campanhas",
    sets: [
      {
        id: "Conjunto 1",
        name: "Direito do Consumidor e Bancário",
        destination: "https://consumidor.calabreselimaadvocacia.com.br/",
        destinationUrl: "https://consumidor.calabreselimaadvocacia.com.br/",
        audience: "Público: Pessoas que tiveram conta bloqueada, plano de saúde negado, seguro não pago, produto com defeito ou serviço não prestado. Já têm o problema e estão buscando solução com urgência.",
        keywords: ["[conta bloqueada o que fazer]", "[banco bloqueou minha conta]", "[plano de saúde negou tratamento]", "[seguro não quer pagar sinistro]", "\"advogado direito de consumidor\"", "\"advogado conta bloqueada\""],
        preFilledMessage: "Olá! Vi o anúncio e preciso de ajuda com uma situação urgente. Podem me dizer como funciona o atendimento?"
      },
      {
        id: "Conjunto 2",
        name: "Direito de Família",
        destination: "https://familia.calabreselimaadvocacia.com.br/",
        destinationUrl: "https://familia.calabreselimaadvocacia.com.br/",
        audience: "Público: Pessoas passando por divórcio, disputas de guarda, pensão alimentícia ou inventário. Momento emocional delicado — a copy precisa ser acolhedora e transmitir segurança.",
        keywords: ["[advogado divórcio]", "[pensão alimentícia advogado]", "[guarda compartilhada advogado]", "[inventário advogado]", "\"advogado direito de família\"", "como pedir pensão alimentícia"],
        preFilledMessage: "Olá! Vi o anúncio e estou passando por uma situação familiar. Gostaria de entender como vocês podem me ajudar."
      },
      {
        id: "Conjunto 3",
        name: "Cível e Indenizações",
        destination: "http://indenizacao.calabreselimaadvocacia.com.br/",
        destinationUrl: "http://indenizacao.calabreselimaadvocacia.com.br/",
        audience: "Público: Pessoas que sofreram dano moral, prejuízo por falha de serviço, acidente ou descumprimento de contrato. Sentem-se lesadas e querem justiça.",
        keywords: ["[dano moral advogado]", "[indenização por dano material]", "[cobrar empresa na justiça]", "\"advogado direito civil\"", "\"cobrar indenização de empresa\"", "como processar empresa por dano"],
        preFilledMessage: "Olá! Vi o anúncio e acredito que tive um direito violado. Gostaria de saber se tenho base para buscar indenização."
      }
    ]
  },
  phase2: {
    title: "Fase 2 — Escala",
    description: "Quando a meta de 5 clientes for batida e a verba subir para R$ 1.500/mês, ativaremos a Campanha 2 focada nas áreas de crescimento.",
    campaigns: [
      { title: "Campanha 1 (Mantida)", areas: "Família, Cível, Consumidor", budget: "R$ 900/mês" },
      { title: "Campanha 2 (Nova)", areas: "Bancário e Imobiliário", budget: "R$ 600/mês" }
    ]
  },
  alert: {
    title: "Importante",
    message: "O primeiro mês é de aprendizado e validação. As métricas serão acompanhadas semanalmente para ajustes de palavras-chave, lances e conversão das landing pages."
  }
};

export const PaidTrafficView: React.FC<PaidTrafficViewProps> = ({ onBack }) => {
  const { userRole, activeClient } = useAuth();
  
  // Estado de controle de Período e Plataforma
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('period') as PeriodType;
      if (['7d', '30d', '90d', 'este_mes', 'mes_anterior', 'este_ano'].includes(p)) {
        return p;
      }
    }
    return '30d';
  });

  const [selectedPlatform, setSelectedPlatform] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const plat = params.get('platform');
      if (plat === 'meta' || plat === 'google') {
        return plat;
      }
    }
    return 'all';
  });

  // Métrica ativa no gráfico temporal
  const [activeChartMetric, setActiveChartMetric] = useState<'investment' | 'conversions' | 'clicks' | 'impressions'>('investment');

  // Estado de feedback de cópia de link
  const [linkCopied, setLinkCopied] = useState(false);

  // Dados brutos da tabela paid_traffic_daily
  const [allMetrics, setAllMetrics] = useState<PaidTrafficMetricRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Estratégia (PDF ou salva no banco de dados)
  const [strategyData, setStrategyData] = useState<TrafficStrategyData | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showStrategyModal, setShowStrategyModal] = useState(false);

  // Atualizar URL params se o usuário navegar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('period', selectedPeriod);
      if (selectedPlatform !== 'all') {
        url.searchParams.set('platform', selectedPlatform);
      } else {
        url.searchParams.delete('platform');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedPeriod, selectedPlatform]);

  // Função para copiar link direto com parâmetros
  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'paid-traffic');
      url.searchParams.set('period', selectedPeriod);
      if (selectedPlatform !== 'all') {
        url.searchParams.set('platform', selectedPlatform);
      } else {
        url.searchParams.delete('platform');
      }
      navigator.clipboard.writeText(url.toString());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // Cálculo das datas do Período Atual e Período Anterior
  const { currentStartDate, currentEndDate, previousStartDate, previousEndDate, periodLabel } = useMemo(() => {
    const today = dayjs();
    let cStart: dayjs.Dayjs;
    let cEnd: dayjs.Dayjs = today;
    let pStart: dayjs.Dayjs;
    let pEnd: dayjs.Dayjs;
    let label = '';

    switch (selectedPeriod) {
      case '7d':
        cStart = today.subtract(6, 'day');
        pEnd = cStart.subtract(1, 'day');
        pStart = pEnd.subtract(6, 'day');
        label = 'Últimos 7 dias';
        break;
      case '30d':
        cStart = today.subtract(29, 'day');
        pEnd = cStart.subtract(1, 'day');
        pStart = pEnd.subtract(29, 'day');
        label = 'Últimos 30 dias';
        break;
      case '90d':
        cStart = today.subtract(89, 'day');
        pEnd = cStart.subtract(1, 'day');
        pStart = pEnd.subtract(89, 'day');
        label = 'Últimos 90 dias';
        break;
      case 'este_mes':
        cStart = today.startOf('month');
        cEnd = today;
        pStart = today.subtract(1, 'month').startOf('month');
        pEnd = today.subtract(1, 'month').endOf('month');
        label = 'Este mês';
        break;
      case 'mes_anterior':
        cStart = today.subtract(1, 'month').startOf('month');
        cEnd = today.subtract(1, 'month').endOf('month');
        pStart = today.subtract(2, 'month').startOf('month');
        pEnd = today.subtract(2, 'month').endOf('month');
        label = 'Mês anterior';
        break;
      case 'este_ano':
        cStart = today.startOf('year');
        cEnd = today;
        pStart = today.subtract(1, 'year').startOf('year');
        pEnd = today.subtract(1, 'year').endOf('year');
        label = 'Este ano';
        break;
      default:
        cStart = today.subtract(29, 'day');
        pEnd = cStart.subtract(1, 'day');
        pStart = pEnd.subtract(29, 'day');
        label = 'Últimos 30 dias';
    }

    return {
      currentStartDate: cStart.format('YYYY-MM-DD'),
      currentEndDate: cEnd.format('YYYY-MM-DD'),
      previousStartDate: pStart.format('YYYY-MM-DD'),
      previousEndDate: pEnd.format('YYYY-MM-DD'),
      periodLabel: label,
    };
  }, [selectedPeriod]);

  // Carregar métricas do Supabase
  useEffect(() => {
    if (!activeClient?.id) return;

    const fetchPaidTrafficData = async () => {
      setLoading(true);
      try {
        // Buscar dados da tabela paid_traffic_daily abrangendo o período atual e o anterior
        const { data, error } = await supabase
          .from('paid_traffic_daily')
          .select('*')
          .eq('client_id', activeClient.id)
          .gte('report_date', previousStartDate)
          .lte('report_date', currentEndDate)
          .order('report_date', { ascending: true });

        if (error) {
          console.error('Erro ao buscar métricas de tráfego pago:', error);
          setAllMetrics([]);
        } else {
          setAllMetrics((data as PaidTrafficMetricRow[]) || []);
        }

        // Buscar estratégia salva do cliente
        if (activeClient.traffic_strategy_data) {
          setStrategyData(activeClient.traffic_strategy_data);
        } else if (activeClient.id === 'e817fbf9-0985-4453-b710-34623af870d6' || activeClient.name?.toLowerCase().includes('calabres')) {
          setStrategyData(CALABRES_STRATEGY);
        } else {
          setStrategyData(null);
        }
      } catch (err) {
        console.error('Erro inesperado ao carregar tráfego pago:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPaidTrafficData();
  }, [activeClient?.id, previousStartDate, currentEndDate]);

  // Plataformas disponíveis com dados para este cliente
  const availablePlatforms = useMemo(() => {
    const plats = new Set<string>();
    allMetrics.forEach(m => {
      if (m.platform) plats.add(m.platform.toLowerCase());
    });
    return Array.from(plats);
  }, [allMetrics]);

  // Separar métricas do Período Atual vs Período Anterior
  const { currentMetrics, previousMetrics } = useMemo(() => {
    let curr = allMetrics.filter(m => m.report_date >= currentStartDate && m.report_date <= currentEndDate);
    let prev = allMetrics.filter(m => m.report_date >= previousStartDate && m.report_date <= previousEndDate);

    if (selectedPlatform !== 'all') {
      curr = curr.filter(m => m.platform?.toLowerCase() === selectedPlatform.toLowerCase());
      prev = prev.filter(m => m.platform?.toLowerCase() === selectedPlatform.toLowerCase());
    }

    return { currentMetrics: curr, previousMetrics: prev };
  }, [allMetrics, currentStartDate, currentEndDate, previousStartDate, previousEndDate, selectedPlatform]);

  // Processar Agregações e Variações
  const processedData = useMemo(() => {
    // Totais Período Atual
    let totalInvestment = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    // Totais Meta Atual
    let metaInvestment = 0;
    let metaImpressions = 0;
    let metaClicks = 0;
    let metaConversions = 0;

    // Totais Google Atual
    let googleInvestment = 0;
    let googleImpressions = 0;
    let googleClicks = 0;
    let googleConversions = 0;

    currentMetrics.forEach(m => {
      const inv = Number(m.investment) || 0;
      const imp = Number(m.impressions) || 0;
      const clk = Number(m.clicks) || 0;
      const conv = Number(m.conversions) || 0;

      totalInvestment += inv;
      totalImpressions += imp;
      totalClicks += clk;
      totalConversions += conv;

      const plat = m.platform?.toLowerCase();
      if (plat === 'meta') {
        metaInvestment += inv;
        metaImpressions += imp;
        metaClicks += clk;
        metaConversions += conv;
      } else if (plat === 'google') {
        googleInvestment += inv;
        googleImpressions += imp;
        googleClicks += clk;
        googleConversions += conv;
      }
    });

    // Médias Período Atual
    const avgCpc = totalClicks > 0 ? totalInvestment / totalClicks : 0;
    const avgCpm = totalImpressions > 0 ? (totalInvestment / totalImpressions) * 1000 : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const costPerConversion = totalConversions > 0 ? totalInvestment / totalConversions : 0;

    // Médias Meta
    const metaCpc = metaClicks > 0 ? metaInvestment / metaClicks : 0;
    const metaCpm = metaImpressions > 0 ? (metaInvestment / metaImpressions) * 1000 : 0;
    const metaCtr = metaImpressions > 0 ? (metaClicks / metaImpressions) * 100 : 0;
    const metaCostPerConv = metaConversions > 0 ? metaInvestment / metaConversions : 0;

    // Médias Google
    const googleCpc = googleClicks > 0 ? googleInvestment / googleClicks : 0;
    const googleCpm = googleImpressions > 0 ? (googleInvestment / googleImpressions) * 1000 : 0;
    const googleCtr = googleImpressions > 0 ? (googleClicks / googleImpressions) * 100 : 0;
    const googleCostPerConv = googleConversions > 0 ? googleInvestment / googleConversions : 0;

    // Totais Período Anterior
    let prevInvestment = 0;
    let prevImpressions = 0;
    let prevClicks = 0;
    let prevConversions = 0;

    previousMetrics.forEach(m => {
      prevInvestment += Number(m.investment) || 0;
      prevImpressions += Number(m.impressions) || 0;
      prevClicks += Number(m.clicks) || 0;
      prevConversions += Number(m.conversions) || 0;
    });

    const calcVar = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    return {
      totalInvestment,
      totalImpressions,
      totalClicks,
      totalConversions,
      avgCpc,
      avgCpm,
      avgCtr,
      costPerConversion,

      metaInvestment,
      metaImpressions,
      metaClicks,
      metaConversions,
      metaCpc,
      metaCpm,
      metaCtr,
      metaCostPerConv,

      googleInvestment,
      googleImpressions,
      googleClicks,
      googleConversions,
      googleCpc,
      googleCpm,
      googleCtr,
      googleCostPerConv,

      investmentVariation: calcVar(totalInvestment, prevInvestment),
      impressionsVariation: calcVar(totalImpressions, prevImpressions),
      clicksVariation: calcVar(totalClicks, prevClicks),
      conversionsVariation: calcVar(totalConversions, prevConversions),
      hasPreviousData: previousMetrics.length > 0
    };
  }, [currentMetrics, previousMetrics]);

  // Gráfico de Linha do Tempo / Tendência (Diário)
  const chartData = useMemo(() => {
    const map: Record<string, {
      date: string;
      formattedDate: string;
      investment: number;
      clicks: number;
      conversions: number;
      impressions: number;
      metaInvestment: number;
      googleInvestment: number;
    }> = {};

    let curr = dayjs(currentStartDate);
    const end = dayjs(currentEndDate);

    while (curr.isBefore(end) || curr.isSame(end, 'day')) {
      const dateStr = curr.format('YYYY-MM-DD');
      map[dateStr] = {
        date: dateStr,
        formattedDate: curr.format('DD/MM'),
        investment: 0,
        clicks: 0,
        conversions: 0,
        impressions: 0,
        metaInvestment: 0,
        googleInvestment: 0,
      };
      curr = curr.add(1, 'day');
    }

    currentMetrics.forEach(m => {
      if (map[m.report_date]) {
        const inv = Number(m.investment) || 0;
        const clk = Number(m.clicks) || 0;
        const conv = Number(m.conversions) || 0;
        const imp = Number(m.impressions) || 0;

        map[m.report_date].investment += inv;
        map[m.report_date].clicks += clk;
        map[m.report_date].conversions += conv;
        map[m.report_date].impressions += imp;

        if (m.platform?.toLowerCase() === 'meta') {
          map[m.report_date].metaInvestment += inv;
        } else if (m.platform?.toLowerCase() === 'google') {
          map[m.report_date].googleInvestment += inv;
        }
      }
    });

    return Object.values(map);
  }, [currentMetrics, currentStartDate, currentEndDate]);

  // Configuração das métricas do gráfico
  const chartMetricTabs = useMemo(() => {
    let convLabel = 'Conversões';
    if (selectedPlatform === 'meta') convLabel = 'Conversas no WhatsApp';
    if (selectedPlatform === 'google') convLabel = 'Formulários';

    return [
      { id: 'investment', label: 'Investimento (R$)' },
      { id: 'conversions', label: convLabel },
      { id: 'clicks', label: 'Cliques' },
      { id: 'impressions', label: 'Impressões' },
    ];
  }, [selectedPlatform]);

  const chartColorMap = {
    investment: { stroke: '#13284D', fill: '#13284D', label: 'Investimento Diário' },
    conversions: { stroke: '#059669', fill: '#059669', label: selectedPlatform === 'meta' ? 'Conversas no WhatsApp' : selectedPlatform === 'google' ? 'Formulários Preenchidos' : 'Conversões Diárias' },
    clicks: { stroke: '#2563EB', fill: '#2563EB', label: 'Cliques Diários' },
    impressions: { stroke: '#7C3AED', fill: '#7C3AED', label: 'Impressões Diárias' },
  };

  const currentChartConfig = chartColorMap[activeChartMetric] || chartColorMap.investment;

  // Formatação de valores
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  // Helper para renderizar indicador de variação
  const renderVariation = (variation: number, hasPrev: boolean, invertedIsGood = false) => {
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

    // Para custos (CPC/CAC), aumento pode ser desfavorável se invertedIsGood for true
    const isGood = invertedIsGood ? !isPositive : isPositive;

    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${
        isGood ? 'text-emerald-700' : 'text-rose-700'
      }`}>
        {isPositive ? <TrendingUp size={13} className={isGood ? 'text-emerald-600' : 'text-rose-600'} /> : <TrendingDown size={13} className={isGood ? 'text-emerald-600' : 'text-rose-600'} />}
        <span>{isPositive ? '+' : ''}{variation.toFixed(1)}%</span>
        <span className="text-stone-400 font-normal text-[10px]">vs ant.</span>
      </span>
    );
  };

  // Custom Tooltip do gráfico de tendência
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0];
      const dateItem = chartData.find(d => d.formattedDate === label);
      return (
        <div className="bg-[#13284D] text-white p-3.5 rounded-2xl shadow-2xl border border-white/10 text-xs min-w-[200px] space-y-2 z-50">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 font-bold">
            <span className="text-stone-200">{dateItem ? dayjs(dateItem.date).format('DD [de] MMMM [de] YYYY') : label}</span>
          </div>
          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-stone-300 font-sans">{currentChartConfig.label}:</span>
              <span className="font-bold text-emerald-400 text-sm">
                {activeChartMetric === 'investment' ? formatCurrency(dataPoint.value) : formatNumber(dataPoint.value)}
              </span>
            </div>
            {dateItem && activeChartMetric !== 'investment' && (
              <div className="flex items-center justify-between gap-3 text-[11px] text-stone-300 font-sans">
                <span>Investimento:</span>
                <span className="font-mono text-white">{formatCurrency(dateItem.investment)}</span>
              </div>
            )}
            {dateItem && activeChartMetric !== 'conversions' && (
              <div className="flex items-center justify-between gap-3 text-[11px] text-stone-300 font-sans">
                <span>{selectedPlatform === 'meta' ? 'Conversas WhatsApp:' : selectedPlatform === 'google' ? 'Formulários:' : 'Conversões:'}</span>
                <span className="font-mono text-white">{formatNumber(dateItem.conversions)}</span>
              </div>
            )}
            {dateItem && activeChartMetric !== 'clicks' && (
              <div className="flex items-center justify-between gap-3 text-[11px] text-stone-300 font-sans">
                <span>Cliques:</span>
                <span className="font-mono text-white">{formatNumber(dateItem.clicks)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Upload de PDF de Estratégia (Admin)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Por favor, selecione um arquivo PDF válido.');
      return;
    }

    setIsProcessingPdf(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const extractedStrategy = await processTrafficStrategyPdf(base64);

          if (!extractedStrategy) {
            throw new Error('Não foi possível extrair a estratégia do PDF.');
          }

          if (activeClient) {
            const { error: updateError } = await supabase
              .from('clients')
              .update({ traffic_strategy_data: extractedStrategy })
              .eq('id', activeClient.id);

            if (updateError) throw updateError;
          }

          setStrategyData(extractedStrategy);
        } catch (err: any) {
          console.error('Error processing PDF strategy:', err);
          setUploadError(err.message || 'Erro ao processar PDF.');
        } finally {
          setIsProcessingPdf(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Error reading file:', err);
      setUploadError('Erro ao ler o arquivo.');
      setIsProcessingPdf(false);
    }
  };

  const periods: { id: PeriodType; label: string }[] = [
    { id: '7d', label: 'Últimos 7 dias' },
    { id: '30d', label: 'Últimos 30 dias' },
    { id: '90d', label: 'Últimos 90 dias' },
    { id: 'este_mes', label: 'Este mês' },
    { id: 'mes_anterior', label: 'Mês anterior' },
    { id: 'este_ano', label: 'Este ano' },
  ];

  if (loading) {
    return (
      <div className="py-24 text-center text-stone-400 flex flex-col items-center justify-center">
        <RefreshCw size={32} className="animate-spin text-[#13284D] mb-4" />
        <p className="text-sm font-semibold text-stone-600">Carregando métricas de tráfego pago...</p>
        <p className="text-xs text-stone-400 mt-1">Buscando dados de investimento, cliques e conversões</p>
      </div>
    );
  }

  // Estado vazio quando não houver dados
  if (allMetrics.length === 0) {
    return (
      <div className="space-y-6">
        {onBack && (
          <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs flex items-center justify-between mb-4">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-bold text-[#13284D] hover:opacity-80 transition-opacity cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              <span>Voltar ao Início</span>
            </button>
          </div>
        )}

        <div className="bg-white rounded-3xl p-8 sm:p-14 border border-stone-200/70 text-center shadow-xs max-w-3xl mx-auto my-8">
          <div className="w-16 h-16 rounded-3xl bg-[#13284D]/5 text-[#13284D] flex items-center justify-center mx-auto mb-6">
            <DollarSign size={30} />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#13284D] mb-3 tracking-tight">
            Nenhuma métrica de tráfego pago sincronizada ainda
          </h3>
          <p className="text-sm text-stone-500 max-w-lg mx-auto leading-relaxed mb-6 font-medium">
            Os dados de investimento, cliques, conversões e custos de Meta Ads e Google Ads serão coletados automaticamente e exibidos neste painel.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-xl text-xs font-semibold text-stone-500 border border-stone-200/60">
            <Sparkles size={14} className="text-amber-500" />
            <span>Sincronização diária contínua ativa</span>
          </div>

          {userRole === 'admin' && (
            <div className="mt-8 pt-8 border-t border-stone-100 flex flex-col items-center">
              <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-[#13284D] hover:bg-[#13284D]/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs">
                <Upload size={14} />
                <span>Upload Estratégia em PDF</span>
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Botão de Retorno (quando chamado como visualização secundária) */}
      {onBack && (
        <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-bold text-[#13284D] hover:opacity-80 transition-opacity cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span>Voltar ao Início</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONTROLES SUPERIORES: PLATAFORMAS, PERÍODOS E COPIAR LINK */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-stone-200/70 shadow-xs flex flex-col gap-3 w-full">
        
        {/* Linha Superior: Pílulas de Plataforma + Botão Copiar Link + Estratégia */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Pílulas de Plataforma */}
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
              <span>Todas as Plataformas</span>
            </button>

            {availablePlatforms.includes('meta') && (
              <button
                onClick={() => setSelectedPlatform('meta')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  selectedPlatform === 'meta'
                    ? 'bg-[#13284D] text-white shadow-xs'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200/60'
                }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-[#0081FB] flex items-center justify-center text-white text-[9px] font-black">
                  M
                </div>
                <span>Meta Ads</span>
              </button>
            )}

            {availablePlatforms.includes('google') && (
              <button
                onClick={() => setSelectedPlatform('google')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  selectedPlatform === 'google'
                    ? 'bg-[#13284D] text-white shadow-xs'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200/60'
                }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-[#EA4335] flex items-center justify-center text-white text-[9px] font-black">
                  G
                </div>
                <span>Google Ads</span>
              </button>
            )}
          </div>

          {/* Ações à Direita: Botão Estratégia + Botão Copiar Link */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Modal de Estratégia (se disponível ou Admin) */}
            {(strategyData || userRole === 'admin') && (
              <button
                onClick={() => setShowStrategyModal(!showStrategyModal)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  showStrategyModal
                    ? 'bg-[#13284D] text-white'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/60'
                }`}
              >
                <FileText size={13} />
                <span>{showStrategyModal ? 'Ocultar Estratégia' : 'Ver Estratégia'}</span>
              </button>
            )}

            {/* Botão Copiar Link (Admin) */}
            {userRole === 'admin' && (
              <button
                onClick={handleCopyLink}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  linkCopied
                    ? 'bg-green-50 text-green-600 border border-green-200'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 border border-gray-200/60'
                }`}
                title="Copiar link direto para esta visualização de tráfego pago"
              >
                <Link2 size={13} />
                <span>{linkCopied ? 'Link copiado!' : 'Copiar link'}</span>
              </button>
            )}
          </div>
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
      {/* PAINEL DE ESTRATÉGIA (OPCIONAL/COLAPSÁVEL) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showStrategyModal && strategyData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/70 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div>
                  <h3 className="text-lg font-bold text-[#13284D] flex items-center gap-2">
                    <Target className="text-orange-500" size={20} />
                    <span>Planejamento & Estratégia de Tráfego</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">Diretrizes estratégicas definidas para as campanhas</p>
                </div>
                {userRole === 'admin' && (
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all">
                    <Upload size={13} />
                    <span>Atualizar PDF</span>
                    <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                  </label>
                )}
              </div>

              {/* KPIs Estratégicos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200/60">
                  <div className="flex items-center gap-2 text-stone-500 mb-2">
                    <DollarSign size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Verba Mensal</span>
                  </div>
                  <div className="text-2xl font-bold text-[#13284D]">{strategyData.kpis.monthlyBudget}</div>
                  <p className="text-xs text-stone-500 mt-1">{strategyData.kpis.budgetDetails}</p>
                </div>

                <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200/60">
                  <div className="flex items-center gap-2 text-orange-600 mb-2">
                    <Target size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Meta Prioritária</span>
                  </div>
                  <div className="text-2xl font-bold text-[#13284D]">{strategyData.kpis.priorityGoal}</div>
                  <p className="text-xs text-stone-500 mt-1">{strategyData.kpis.goalDetails}</p>
                </div>

                <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200/60">
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <Users size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Ticket Médio</span>
                  </div>
                  <div className="text-2xl font-bold text-[#13284D]">{strategyData.kpis.averageTicket}</div>
                  <p className="text-xs text-stone-500 mt-1">{strategyData.kpis.ticketDetails}</p>
                </div>
              </div>

              {/* Decisão Estratégica */}
              {strategyData.strategicDecision && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-sm font-bold text-[#13284D] uppercase tracking-wider">
                    {strategyData.strategicDecision.title}
                  </h4>
                  <div className="space-y-3">
                    {strategyData.strategicDecision.items.map((item, idx) => (
                      <div key={idx} className="bg-stone-50/70 rounded-2xl p-4 border border-stone-200/50 flex gap-3">
                        <div className="w-1.5 rounded-full bg-[#13284D] shrink-0" />
                        <div>
                          <h5 className="font-bold text-stone-900 text-sm">{item.title}</h5>
                          <p className="text-stone-600 text-xs mt-1 leading-relaxed">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* CARDS PRINCIPAIS DE MÉTRICAS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* 1. INVESTIMENTO TOTAL */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/70 shadow-xs hover:border-[#13284D]/30 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">
                {selectedPlatform === 'meta' ? 'Investimento Meta' : selectedPlatform === 'google' ? 'Investimento Google' : 'Investimento Total'}
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <DollarSign size={15} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#13284D] font-mono tracking-tight">
              {formatCurrency(processedData.totalInvestment)}
            </div>
            <p className="text-[10px] sm:text-[11px] text-stone-400 font-medium mt-0.5">
              Soma aplicada no período
            </p>
          </div>
          <div className="mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-stone-100 flex items-center justify-between">
            {renderVariation(processedData.investmentVariation, processedData.hasPreviousData)}
          </div>
        </div>

        {/* 2. CONVERSÕES / RESULTADOS (WhatsApp ou Formulários) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/70 shadow-xs hover:border-[#13284D]/30 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">
                {selectedPlatform === 'meta' ? 'Conversas WhatsApp' : selectedPlatform === 'google' ? 'Formulários Preenchidos' : 'Resultados / Conversões'}
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Target size={15} />
              </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-black text-[#13284D] font-mono tracking-tight">
                {formatNumber(processedData.totalConversions)}
              </span>
              {processedData.costPerConversion > 0 && (
                <span className="text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-mono" title="Custo por resultado">
                  {formatCurrency(processedData.costPerConversion)}/res
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-stone-400 font-medium mt-0.5">
              {selectedPlatform === 'meta' ? 'Conversas diretas iniciadas' : selectedPlatform === 'google' ? 'Formulários e leads gerados' : 'Leads e contatos diretos'}
            </p>
          </div>
          <div className="mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-stone-100 flex items-center justify-between">
            {renderVariation(processedData.conversionsVariation, processedData.hasPreviousData)}
          </div>
        </div>

        {/* 3. CLIQUES NO ANÚNCIO */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/70 shadow-xs hover:border-[#13284D]/30 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">
                Cliques Totais
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <MousePointer size={15} />
              </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-black text-[#13284D] font-mono tracking-tight">
                {formatNumber(processedData.totalClicks)}
              </span>
              {processedData.avgCpc > 0 && (
                <span className="text-[10px] sm:text-xs font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-md font-mono" title="CPC Médio">
                  CPC {formatCurrency(processedData.avgCpc)}
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-stone-400 font-medium mt-0.5">
              Acessos e cliques no anúncio
            </p>
          </div>
          <div className="mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-stone-100 flex items-center justify-between">
            {renderVariation(processedData.clicksVariation, processedData.hasPreviousData)}
          </div>
        </div>

        {/* 4. IMPRESSÕES / VISUALIZAÇÕES */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/70 shadow-xs hover:border-[#13284D]/30 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">
                Impressões
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <Eye size={15} />
              </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-black text-[#13284D] font-mono tracking-tight">
                {formatNumber(processedData.totalImpressions)}
              </span>
              {processedData.avgCtr > 0 && (
                <span className="text-[10px] sm:text-xs font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-md font-mono" title="CTR Médio">
                  CTR {processedData.avgCtr.toFixed(2)}%
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-stone-400 font-medium mt-0.5">
              Exibições dos anúncios
            </p>
          </div>
          <div className="mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-stone-100 flex items-center justify-between">
            {renderVariation(processedData.impressionsVariation, processedData.hasPreviousData)}
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
              Evolução Temporal de Tráfego Pago ({periodLabel})
            </h3>
            <p className="text-xs text-stone-400 font-medium">
              Acompanhamento diário de investimento, cliques e conversões
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
                <linearGradient id="colorPaidMetric" x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={(v) => {
                  if (activeChartMetric === 'investment') {
                    return `R$${v}`;
                  }
                  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v;
                }}
                allowDecimals={false} 
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Area 
                type="monotone" 
                dataKey={activeChartMetric} 
                stroke={currentChartConfig.stroke} 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#colorPaidMetric)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DETALHAMENTO POR PLATAFORMA (META ADS vs GOOGLE ADS) */}
      {/* ========================================================================= */}
      {selectedPlatform === 'all' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[#13284D] uppercase tracking-wider">
            Desempenho por Plataforma de Anúncios
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Bloco Meta Ads */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/70 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-[#0081FB]/10 text-[#0081FB] flex items-center justify-center font-black text-sm">
                      M
                    </div>
                    <div>
                      <h4 className="font-bold text-[#13284D] text-base">Meta Ads</h4>
                      <p className="text-xs text-stone-400">Instagram & Facebook Ads</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-blue-50 text-[#0081FB] text-[11px] font-bold">
                    WhatsApp Direct
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-stone-50/80 rounded-2xl p-3.5 border border-stone-200/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Investimento
                    </span>
                    <span className="text-xl font-bold text-[#13284D] font-mono">
                      {formatCurrency(processedData.metaInvestment)}
                    </span>
                  </div>

                  <div className="bg-stone-50/80 rounded-2xl p-3.5 border border-stone-200/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Conversas WhatsApp
                    </span>
                    <span className="text-xl font-bold text-emerald-700 font-mono">
                      {formatNumber(processedData.metaConversions)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-stone-50">
                    <span className="text-stone-500">Custo por Conversa (CAC):</span>
                    <span className="font-bold text-[#13284D] font-mono">
                      {processedData.metaConversions > 0 ? formatCurrency(processedData.metaCostPerConv) : 'R$ 0,00'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-stone-50">
                    <span className="text-stone-500">Cliques no Link / Anúncio:</span>
                    <span className="font-bold text-[#13284D] font-mono">{formatNumber(processedData.metaClicks)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-stone-50">
                    <span className="text-stone-500">Custo por Clique (CPC Médio):</span>
                    <span className="font-bold text-[#13284D] font-mono">{formatCurrency(processedData.metaCpc)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-stone-50">
                    <span className="text-stone-500">Taxa de Cliques (CTR):</span>
                    <span className="font-bold text-[#13284D] font-mono">{processedData.metaCtr.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-stone-500">Custo por Mil Impressões (CPM):</span>
                    <span className="font-bold text-[#13284D] font-mono">{formatCurrency(processedData.metaCpm)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco Google Ads */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/70 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-[#EA4335]/10 text-[#EA4335] flex items-center justify-center font-black text-sm">
                      G
                    </div>
                    <div>
                      <h4 className="font-bold text-[#13284D] text-base">Google Ads</h4>
                      <p className="text-xs text-stone-400">Rede de Pesquisa & Busca</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-red-50 text-[#EA4335] text-[11px] font-bold">
                    Formulários & Leads
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-stone-50/80 rounded-2xl p-3.5 border border-stone-200/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Investimento
                    </span>
                    <span className="text-xl font-bold text-[#13284D] font-mono">
                      {formatCurrency(processedData.googleInvestment)}
                    </span>
                  </div>

                  <div className="bg-stone-50/80 rounded-2xl p-3.5 border border-stone-200/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Formulários Preenchidos
                    </span>
                    <span className="text-xl font-bold text-emerald-700 font-mono">
                      {formatNumber(processedData.googleConversions)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-stone-50">
                    <span className="text-stone-500">Custo por Lead / Formulário:</span>
                    <span className="font-bold text-[#13284D] font-mono">
                      {processedData.googleConversions > 0 ? formatCurrency(processedData.googleCostPerConv) : 'R$ 0,00'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-stone-50">
                    <span className="text-stone-500">Cliques na Pesquisa:</span>
                    <span className="font-bold text-[#13284D] font-mono">{formatNumber(processedData.googleClicks)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-stone-50">
                    <span className="text-stone-500">Custo por Clique (CPC Médio):</span>
                    <span className="font-bold text-[#13284D] font-mono">{formatCurrency(processedData.googleCpc)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-stone-50">
                    <span className="text-stone-500">Taxa de Cliques (CTR):</span>
                    <span className="font-bold text-[#13284D] font-mono">{processedData.googleCtr.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-stone-500">Custo por Mil Impressões (CPM):</span>
                    <span className="font-bold text-[#13284D] font-mono">{formatCurrency(processedData.googleCpm)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MÉTRICAS SECUNDÁRIAS DE EFICIÊNCIA */}
      {/* ========================================================================= */}
      <div>
        <h3 className="text-sm font-bold text-[#13284D] uppercase tracking-wider mb-3">
          Métricas de Eficiência e Custo
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          
          {/* Custo por Conversão */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <Target size={15} />
              <span className="text-xs font-bold text-stone-600">
                {selectedPlatform === 'meta' ? 'Custo p/ Conversa' : selectedPlatform === 'google' ? 'Custo p/ Lead' : 'Custo Médio p/ Lead'}
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-[#13284D] font-mono">
              {formatCurrency(processedData.costPerConversion)}
            </div>
          </div>

          {/* CPC Médio */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <MousePointer size={15} />
              <span className="text-xs font-bold text-stone-600">CPC Médio</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-[#13284D] font-mono">
              {formatCurrency(processedData.avgCpc)}
            </div>
          </div>

          {/* CTR Médio */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <BarChart3 size={15} />
              <span className="text-xs font-bold text-stone-600">Taxa de Cliques (CTR)</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-[#13284D] font-mono">
              {processedData.avgCtr.toFixed(2)}%
            </div>
          </div>

          {/* CPM Médio */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200/70 shadow-xs">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <Eye size={15} />
              <span className="text-xs font-bold text-stone-600">CPM Médio</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-[#13284D] font-mono">
              {formatCurrency(processedData.avgCpm)}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

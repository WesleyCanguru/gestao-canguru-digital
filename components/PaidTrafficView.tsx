import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { processTrafficStrategyPdf } from '../src/services/geminiService';
import { TrafficStrategyData } from '../types';
import dayjs from 'dayjs';
import {
  ResponsiveContainer,
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
  TrendingUp
} from 'lucide-react';
import { motion } from 'motion/react';

const CALABRES_STRATEGY: TrafficStrategyData = {
  kpis: {
    monthlyBudget: "R$ 600",
    budgetDetails: "R$ 25/dia (segunda a sábado a principio para quesito de teste) (Mês 1 = aprendizado)",
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
    title: "Atenção ao Atendimento",
    message: "Lembre-se de orientar sua equipe a responder os leads do WhatsApp em até 1 hora durante o horário comercial. A velocidade de resposta de vocês é o principal fator de conversão nesse modelo de campanha!"
  }
};

const formatCurrency = (val: number) => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatNumber = (val: number) => {
  return val.toLocaleString('pt-BR');
};

const formatRoas = (val: number) => {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'x';
};

const getPeriodDates = (period: 'yesterday' | '7d' | '14d' | 'month') => {
  const today = dayjs();
  if (period === 'yesterday') {
    const y = today.subtract(1, 'day').format('YYYY-MM-DD');
    return { startDate: y, endDate: y };
  }
  if (period === '7d') {
    return {
      startDate: today.subtract(6, 'day').format('YYYY-MM-DD'),
      endDate: today.format('YYYY-MM-DD')
    };
  }
  if (period === '14d') {
    return {
      startDate: today.subtract(13, 'day').format('YYYY-MM-DD'),
      endDate: today.format('YYYY-MM-DD')
    };
  }
  return {
    startDate: today.startOf('month').format('YYYY-MM-DD'),
    endDate: today.format('YYYY-MM-DD')
  };
};

const buildChartData = (rawData: any[], startDateStr: string, endDateStr: string) => {
  const map = new Map<string, any>();
  rawData.forEach(item => {
    map.set(item.report_date, item);
  });

  const chartData = [];
  let current = dayjs(startDateStr);
  const end = dayjs(endDateStr);

  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const dateKey = current.format('YYYY-MM-DD');
    const displayDate = current.format('DD/MM');
    const fullDate = current.format('DD/MM/YYYY');
    const item = map.get(dateKey);

    chartData.push({
      dateStr: dateKey,
      displayDate,
      fullDate,
      clicks: item ? Number(item.clicks || 0) : 0,
      investment: item ? Number(item.investment || 0) : 0,
      impressions: item ? Number(item.impressions || 0) : 0,
      conversions: item ? Number(item.conversions || 0) : 0,
    });

    current = current.add(1, 'day');
  }

  return chartData;
};

const CustomClicksTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-gray-800">
        <p className="font-bold border-b border-gray-700 pb-1 text-gray-200">{data.fullDate}</p>
        <p className="flex justify-between gap-4 pt-1">
          <span className="text-gray-400">Cliques:</span>
          <span className="font-semibold text-white">{formatNumber(data.clicks)}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-gray-400">Investimento:</span>
          <span className="font-semibold text-white">{formatCurrency(data.investment)}</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomInvestmentTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-gray-800">
        <p className="font-bold border-b border-gray-700 pb-1 text-gray-200">{data.fullDate}</p>
        <p className="flex justify-between gap-4 pt-1">
          <span className="text-gray-400">Investimento:</span>
          <span className="font-semibold text-white">{formatCurrency(data.investment)}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-gray-400">Cliques:</span>
          <span className="font-semibold text-white">{formatNumber(data.clicks)}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const PaidTrafficView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { activeClient, userRole, refreshActiveClient } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Dashboard Filters & State
  const [selectedPeriod, setSelectedPeriod] = useState<'yesterday' | '7d' | '14d' | 'month'>('14d');
  const [selectedPlatform, setSelectedPlatform] = useState<'google' | 'meta'>('google');
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  const isCalabres = activeClient?.id === 'e817fbf9-0985-4453-b710-34623af870d6' || activeClient?.name?.includes('Calabres');

  const strategyData = activeClient?.traffic_strategy_data || (isCalabres ? CALABRES_STRATEGY : null);

  useEffect(() => {
    if (!activeClient?.id) return;

    const fetchDailyData = async () => {
      setIsLoadingData(true);
      const { startDate, endDate } = getPeriodDates(selectedPeriod);

      const { data, error } = await supabase
        .from('paid_traffic_daily')
        .select('*')
        .eq('client_id', activeClient.id)
        .eq('platform', selectedPlatform)
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .order('report_date', { ascending: true });

      if (error) {
        console.error('Erro ao buscar dados diários de tráfego pago:', error);
        setDailyData([]);
      } else {
        setDailyData(data || []);
      }
      setIsLoadingData(false);
    };

    fetchDailyData();
  }, [activeClient?.id, selectedPeriod, selectedPlatform]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeClient) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Por favor, envie apenas arquivos PDF.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const processedData = await processTrafficStrategyPdf(base64);
          
          const { error } = await supabase
            .from('clients')
            .update({ traffic_strategy_data: processedData })
            .eq('id', activeClient.id);

          if (error) throw error;
          
          await refreshActiveClient();
          setIsUploading(false);
        } catch (err) {
          console.error('Error processing PDF:', err);
          setUploadError('Erro ao processar a estratégia com IA. Tente novamente.');
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error reading file:', err);
      setUploadError('Erro ao ler o arquivo.');
      setIsUploading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Metrics Calculations
  const totalInvestment = dailyData.reduce((acc, row) => acc + (Number(row.investment) || 0), 0);
  const totalClicks = dailyData.reduce((acc, row) => acc + (Number(row.clicks) || 0), 0);
  const totalImpressions = dailyData.reduce((acc, row) => acc + (Number(row.impressions) || 0), 0);
  const totalConversions = dailyData.reduce((acc, row) => acc + (Number(row.conversions) || 0), 0);

  // CPC Médio = totalInvestment / totalClicks
  const avgCpc = totalClicks > 0 ? totalInvestment / totalClicks : 0;

  // ROAS Médio = Média do período
  const roasRows = dailyData.filter(row => row.roas !== null && row.roas !== undefined);
  const avgRoas = roasRows.length > 0
    ? roasRows.reduce((acc, row) => acc + Number(row.roas), 0) / roasRows.length
    : 0;

  const { startDate, endDate } = getPeriodDates(selectedPeriod);
  const chartData = buildChartData(dailyData, startDate, endDate);
  const themeColor = selectedPlatform === 'google' ? '#1A73E8' : '#7C3AED';

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-brand-dark"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tráfego Pago</h1>
              <p className="text-sm text-gray-500 mt-1">Dashboard & Estratégia • {activeClient?.name || 'Cliente'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {userRole === 'admin' && (
              <div className="relative">
                <input
                  type="file"
                  id="pdf-upload"
                  className="hidden"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
                <label
                  htmlFor="pdf-upload"
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-medium text-sm shadow-sm cursor-pointer ${
                    isUploading 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Subir Estratégia (PDF)
                    </>
                  )}
                </label>
              </div>
            )}
          </div>
        </div>
        {uploadError && (
          <div className="max-w-5xl mx-auto mt-4 px-2">
            <div className="bg-red-50 text-red-600 text-xs py-2 px-4 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              {uploadError}
            </div>
          </div>
        )}
      </div>

      <motion.div 
        className="max-w-5xl mx-auto px-6 py-8 space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Performance Dashboard Section */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          {/* Dashboard Header: Title + Platform Tabs + Period Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-6">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Dashboard de Desempenho</span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">Métricas de Campanhas</h2>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Platform Tabs */}
              <div className="bg-gray-100 p-1 rounded-2xl flex items-center gap-1">
                <button
                  onClick={() => setSelectedPlatform('google')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedPlatform === 'google'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-300"></span>
                  Google Ads
                </button>
                <button
                  onClick={() => setSelectedPlatform('meta')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedPlatform === 'meta'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-300"></span>
                  Meta Ads
                </button>
              </div>

              {/* Period Filters */}
              <div className="bg-gray-100 p-1 rounded-2xl flex items-center gap-1 overflow-x-auto">
                {[
                  { id: 'yesterday', label: 'Ontem' },
                  { id: '7d', label: '7 dias' },
                  { id: '14d', label: '14 dias' },
                  { id: 'month', label: 'Mês atual' },
                ].map((period) => (
                  <button
                    key={period.id}
                    onClick={() => setSelectedPeriod(period.id as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedPeriod === period.id
                        ? 'bg-gray-900 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dashboard Body */}
          {isLoadingData ? (
            /* Loading Skeleton */
            <div className="space-y-6 animate-pulse py-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-2xl"></div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="h-64 bg-gray-100 rounded-2xl"></div>
                <div className="h-64 bg-gray-100 rounded-2xl"></div>
              </div>
            </div>
          ) : dailyData.length === 0 ? (
            /* Empty State */
            <div className="bg-gray-50/80 rounded-2xl p-10 border border-gray-100 text-center flex flex-col items-center justify-center my-4">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm mb-3">
                📊
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">
                Nenhum dado encontrado para este período.
              </h3>
              <p className="text-xs text-gray-500 max-w-sm">
                Os dados de campanha são atualizados diariamente.
              </p>
            </div>
          ) : (
            /* Cards & Charts */
            <div className="space-y-8">
              {/* 6 Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Investimento</span>
                    <div className={`p-1.5 rounded-lg ${selectedPlatform === 'google' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      <DollarSign className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(totalInvestment)}</p>
                  <span className="text-[10px] text-gray-400 font-medium">Soma do período</span>
                </div>

                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cliques</span>
                    <div className={`p-1.5 rounded-lg ${selectedPlatform === 'google' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      <MousePointer className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(totalClicks)}</p>
                  <span className="text-[10px] text-gray-400 font-medium">Tráfego total</span>
                </div>

                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Impressões</span>
                    <div className={`p-1.5 rounded-lg ${selectedPlatform === 'google' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      <Eye className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(totalImpressions)}</p>
                  <span className="text-[10px] text-gray-400 font-medium">Alcance total</span>
                </div>

                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conversões</span>
                    <div className={`p-1.5 rounded-lg ${selectedPlatform === 'google' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      <Target className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(totalConversions)}</p>
                  <span className="text-[10px] text-gray-400 font-medium">Leads e contatos</span>
                </div>

                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">CPC Médio</span>
                    <div className={`p-1.5 rounded-lg ${selectedPlatform === 'google' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      <BarChart3 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(avgCpc)}</p>
                  <span className="text-[10px] text-gray-400 font-medium">Custo p/ clique</span>
                </div>

                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ROAS Médio</span>
                    <div className={`p-1.5 rounded-lg ${selectedPlatform === 'google' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatRoas(avgRoas)}</p>
                  <span className="text-[10px] text-gray-400 font-medium">Média do período</span>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Cliques por Dia */}
                <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-900">Cliques por Dia</h3>
                    <p className="text-xs text-gray-400">Evolução do tráfego diário</p>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomClicksTooltip />} />
                        <Line type="monotone" dataKey="clicks" stroke={themeColor} strokeWidth={3} dot={{ r: 3, fill: themeColor }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Investimento por Dia */}
                <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-900">Investimento por Dia</h3>
                    <p className="text-xs text-gray-400">Valor aplicado diariamente</p>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                        <Tooltip content={<CustomInvestmentTooltip />} />
                        <Bar dataKey="investment" fill={themeColor} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {!strategyData ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <FileText className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Sem Estratégia Definida</h3>
            <p className="text-gray-500 max-w-md">
              Ainda não há uma estratégia de tráfego configurada para este cliente. 
              {userRole === 'admin' && ' Faça o upload de um PDF para gerar a estratégia automaticamente.'}
            </p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div variants={itemVariants} className="bg-brand-dark rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-medium text-white/80">Verba Mensal</h3>
                </div>
                <p className="text-3xl font-bold">{strategyData.kpis.monthlyBudget}</p>
                <p className="text-sm text-white/60 mt-2">{strategyData.kpis.budgetDetails}</p>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="font-medium text-gray-500">Meta Prioritária</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{strategyData.kpis.priorityGoal}</p>
                <p className="text-sm text-gray-500 mt-2">{strategyData.kpis.goalDetails}</p>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-medium text-gray-500">Ticket Médio</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{strategyData.kpis.averageTicket}</p>
                <p className="text-sm text-gray-500 mt-2">{strategyData.kpis.ticketDetails}</p>
              </motion.div>
            </div>

            {/* Decisão Estratégica */}
            <motion.div variants={itemVariants} className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Search className="w-6 h-6 text-brand-dark" />
                {strategyData.strategicDecision.title}
              </h2>
              <div className="space-y-6">
                {strategyData.strategicDecision.items.map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className={`w-1.5 rounded-full shrink-0 ${item.color === 'brand-dark' ? 'bg-brand-dark' : 'bg-green-500'}`}></div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{item.title}</h3>
                      <p className="text-gray-600 mt-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Estrutura das Campanhas */}
            <motion.div variants={itemVariants}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{strategyData.campaignStructure.title}</h2>
              
              <div className="space-y-6">
                {strategyData.campaignStructure.sets.map((set, idx) => (
                  <div key={idx} className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-8 py-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-1 block">{set.id}</span>
                        <h3 className="text-lg font-bold text-gray-900">{set.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 shadow-sm">
                        <Globe className="w-4 h-4 text-blue-500" />
                        Destino: <a href={set.destinationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{set.destination}</a>
                      </div>
                    </div>
                    
                    <div className="p-8">
                      <p className="text-gray-600 mb-6">
                        {set.audience}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Search className="w-4 h-4 text-gray-400" />
                            Palavras-chave Principais
                          </h4>
                          <ul className="space-y-2 font-mono text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {set.keywords.map((kw, kidx) => (
                              <li key={kidx}>{kw}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-gray-400" />
                            Mensagem Pré-preenchida
                          </h4>
                          <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-green-900 text-sm italic">
                            "{set.preFilledMessage}"
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Fase 2 */}
            <motion.div variants={itemVariants} className="bg-gradient-to-br from-brand-dark to-gray-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="w-6 h-6 text-orange-400" />
                  <h2 className="text-2xl font-bold">{strategyData.phase2.title}</h2>
                </div>
                
                <p className="text-gray-300 mb-8 max-w-2xl">
                  {strategyData.phase2.description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {strategyData.phase2.campaigns.map((camp, idx) => (
                    <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                      <h3 className="font-bold text-lg mb-2">{camp.title}</h3>
                      <p className="text-gray-300 text-sm mb-4">{camp.areas}</p>
                      <div className="text-2xl font-bold text-orange-400">{camp.budget}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Alerta */}
            <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
              <div>
                <h4 className="font-bold text-amber-900">{strategyData.alert.title}</h4>
                <p className="text-amber-800 text-sm mt-1">
                  {strategyData.alert.message}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
};


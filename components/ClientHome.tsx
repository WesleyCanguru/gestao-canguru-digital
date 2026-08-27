import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, supabase } from '../lib/supabase';
import {
  Calendar,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Target,
  Zap,
  ClipboardList,
  FolderOpen,
  Globe,
  Sparkles,
  BookOpen,
  Camera,
  ArrowLeft,
  Link,
  Kanban,
  Clock,
  CheckCircle2,
  Instagram,
  Linkedin,
  Video,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { useClientOnboarding } from '../hooks/useClientOnboarding';
import { LeadTrackerView } from './LeadTrackerView';
import { PostModal } from './PostModal';
import { ClientLeadConfig, Client, DailyContent, PostStatus } from '../types';

dayjs.locale('pt-br');

interface ClientHomeProps {
  initialActiveView?: 'dashboard' | 'leads';
  onNavigateToOnboarding: () => void;
  onNavigateToMapa: (tab?: 'dashboard' | 'publicacoes' | 'mapa', filterStatus?: string) => void;
  onNavigateToPublicacoes?: (filterStatus?: string) => void;
  onNavigateToBriefings: () => void;
  onNavigateToStrategicBriefings: () => void;
  onNavigateToDocuments: () => void;
  onNavigateToPaidTraffic: () => void;
  onNavigateToWebsite: () => void;
  onNavigateToPasswordVault: () => void;
  onNavigateToTutorials: () => void;
  onNavigateToAiPhotos: () => void;
  onNavigateToRoteiros: () => void;
  onNavigateToOrganico?: () => void;
  onRefreshClient?: () => void;
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const ClientHome: React.FC<ClientHomeProps> = ({
  initialActiveView,
  onNavigateToOnboarding,
  onNavigateToMapa,
  onNavigateToPublicacoes,
  onNavigateToBriefings,
  onNavigateToStrategicBriefings,
  onNavigateToDocuments,
  onNavigateToPaidTraffic,
  onNavigateToWebsite,
  onNavigateToPasswordVault,
  onNavigateToTutorials,
  onNavigateToAiPhotos,
  onNavigateToRoteiros,
  onNavigateToOrganico,
  onRefreshClient,
}) => {
  const { activeClient, userRole } = useAuth();
  const [smartLoading, setSmartLoading] = useState(true);
  const [leadConfig, setLeadConfig] = useState<ClientLeadConfig | null>(null);
  const [monthLeadsCount, setMonthLeadsCount] = useState<number>(0);
  const [activeView, setActiveView] = useState<'dashboard' | 'leads'>(initialActiveView || 'dashboard');

  // Organic metrics preview state
  const [organicPreview, setOrganicPreview] = useState<{
    alcance7d: number;
    taxaEngajamento: string;
    seguidoresGanhos7d: number;
  } | null>(null);

  // Posts states
  const [postsParaAprovar, setPostsParaAprovar] = useState<any[]>([]);
  const [postsEmProducao, setPostsEmProducao] = useState<any[]>([]);
  const [postsPublicadosMes, setPostsPublicadosMes] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // Modal de edição / visualização de Post
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{
    dayContent: DailyContent;
    dateKey: string;
    groupKeys?: string[];
  } | null>(null);

  useEffect(() => {
    if (initialActiveView) {
      setActiveView(initialActiveView);
    }
  }, [initialActiveView]);

  const { isCompleted: isOnboardingCompleted, loading: loadingOnboarding, stats: onboardingStats } = useClientOnboarding(activeClient?.id);
  const isAdmin = userRole === 'admin';

  // Handle deep link to CRM
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const destino = params.get('destino') || params.get('active_view');
    if (destino === 'crm' && ((activeClient as any)?.is_lead_tracking_enabled || isAdmin)) {
      setActiveView('leads');
    }
  }, [activeClient, isAdmin]);

  // Saudação dinâmica baseada no horário
  const getGreeting = () => {
    const hour = dayjs().hour();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Primeiro nome do responsável ou cliente
  const getFirstName = () => {
    const name = activeClient?.responsible || activeClient?.name || 'Cliente';
    return name.trim().split(' ')[0];
  };

  // Nome do mês e ano formatados
  const getMonthYearString = () => {
    const now = dayjs();
    const monthName = MONTHS_PT[now.month()];
    return `${monthName} de ${now.year()}`;
  };

  // Formatar data para exibição nos cards
  const formatDateDisplay = (dateKey?: string) => {
    if (!dateKey) return '';
    const parts = dateKey.split('-');
    if (parts.length >= 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(d) && !isNaN(m) && m >= 1 && m <= 12) {
        return `${String(d).padStart(2, '0')} de ${MONTHS_PT[m - 1].toLowerCase()}`;
      }
    }
    return dateKey;
  };

  // Buscar posts e métricas do cliente
  const fetchClientPosts = useCallback(async () => {
    if (!activeClient?.id) {
      setPostsLoading(false);
      return;
    }

    try {
      setPostsLoading(true);
      const now = dayjs();
      const currentMonth = now.month() + 1;
      const currentYear = now.year();

      const { data, error } = await supabase
        .from('posts')
        .select('id, date_key, client_id, status, type, theme, theme_title, bullets, image_url, last_updated, is_deleted, platform')
        .eq('client_id', activeClient.id)
        .neq('status', 'deleted')
        .limit(10000);

      if (error) {
        // Se for erro transitório de rede/fetch, registrar aviso suave sem quebrar a tela
        const errMsg = error.message || '';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || error.code === 'PGRST301') {
          console.warn('Conexão temporariamente indisponível ao buscar publicações:', errMsg);
          return;
        }
        throw error;
      }

      if (data) {
        const activePosts = data.filter((post: any) => !post.is_deleted && post.status !== 'deleted');

        // 1. Posts para aprovação
        const paraAprovar = activePosts.filter((post: any) => {
          const s = post.status;
          return [
            'waiting_approval',
            'approval',
            'pending_approval',
            'changes_requested',
            'alteracao_solicitada',
            'theme_pending'
          ].includes(s);
        });

        // 2. Posts em produção
        const emProducao = activePosts.filter((post: any) => {
          const s = post.status;
          return ['draft', 'in_production', 'approved', 'scheduled', 'theme_approved'].includes(s);
        });

        // 3. Posts publicados este mês
        const publicadosMes = activePosts.filter((post: any) => {
          if (post.status !== 'published') return false;
          const dateKey = post.date_key || '';
          const parts = dateKey.split('-');
          if (parts.length >= 3) {
            const pMonth = parseInt(parts[1], 10);
            const pYear = parseInt(parts[2], 10);
            return pMonth === currentMonth && pYear === currentYear;
          }
          const dObj = dayjs(post.last_updated);
          return dObj.isValid() && dObj.month() + 1 === currentMonth && dObj.year() === currentYear;
        });

        setPostsParaAprovar(paraAprovar);
        setPostsEmProducao(emProducao);
        setPostsPublicadosMes(publicadosMes);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err || '');
      if (!errMsg.includes('Failed to fetch') && !errMsg.includes('NetworkError')) {
        console.error('Erro ao carregar publicações no ClientHome:', err);
      } else {
        console.warn('Falha transitória de rede ao carregar publicações no ClientHome.');
      }
    } finally {
      setPostsLoading(false);
    }
  }, [activeClient?.id]);

  // Buscar status de CRM e briefings
  const checkStatus = useCallback(async () => {
    if (!activeClient?.id) {
      setSmartLoading(false);
      return;
    }

    try {
      // Buscar lead config
      const { data: configData } = await supabase
        .from('client_lead_configs')
        .select('*')
        .eq('client_id', activeClient.id)
        .maybeSingle();

      if (configData) {
        setLeadConfig(configData);

        const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
        const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');
        const { count } = await supabase
          .from('client_leads')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', activeClient.id)
          .gte('lead_date', startOfMonth)
          .lte('lead_date', endOfMonth);

        setMonthLeadsCount(count || 0);
      }
    } catch (error: any) {
      const errMsg = error?.message || String(error || '');
      if (!errMsg.includes('Failed to fetch') && !errMsg.includes('NetworkError')) {
        console.error('Error checking client status:', error);
      }
    } finally {
      setSmartLoading(false);
    }
  }, [activeClient?.id]);

  // Buscar métricas orgânicas dos últimos 7 dias para o card de preview
  const fetchOrganicMetrics = useCallback(async () => {
    if (!activeClient?.id) {
      setOrganicPreview(null);
      return;
    }

    try {
      const today = dayjs().endOf('day');
      const start7d = today.subtract(6, 'day').startOf('day').format('YYYY-MM-DD');
      const end7d = today.format('YYYY-MM-DD');

      const { data, error } = await supabase
        .from('social_metrics')
        .select('*')
        .eq('client_id', activeClient.id)
        .gte('date', start7d)
        .lte('date', end7d);

      if (error) {
        setOrganicPreview(null);
        return;
      }

      if (data && data.length > 0) {
        let reach = 0;
        let likes = 0;
        let comments = 0;
        let shares = 0;
        let saves = 0;
        let followersGained = 0;

        data.forEach((m: any) => {
          reach += Number(m.reach) || 0;
          likes += Number(m.likes) || 0;
          comments += Number(m.comments) || 0;
          shares += Number(m.shares) || 0;
          saves += Number(m.saves) || 0;
          followersGained += Number(m.followers_gained) || 0;
        });

        const totalEng = likes + comments + shares + saves;
        const taxa = reach > 0 ? ((totalEng / reach) * 100).toFixed(1) : '0';

        setOrganicPreview({
          alcance7d: reach,
          taxaEngajamento: taxa,
          seguidoresGanhos7d: followersGained
        });
      } else {
        setOrganicPreview(null);
      }
    } catch {
      setOrganicPreview(null);
    }
  }, [activeClient?.id]);

  useEffect(() => {
    fetchClientPosts();
    checkStatus();
    fetchOrganicMetrics();
  }, [fetchClientPosts, checkStatus, fetchOrganicMetrics]);

  // Realtime subscription para atualizar em tempo real quando houver novos posts ou aprovações
  useEffect(() => {
    if (!activeClient?.id) return;

    const channel = supabase
      .channel(`client_home_${activeClient.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `client_id=eq.${activeClient.id}` }, () => {
        fetchClientPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeClient?.id, fetchClientPosts]);

  // Abrir modal de um post específico
  const handleOpenPost = (post: any) => {
    let dayFormatted = dayjs().format('DD/MM');
    const parts = (post.date_key || '').split('-');
    if (parts.length >= 2) {
      dayFormatted = `${parts[0]}/${parts[1]}`;
    }

    const dayContent: DailyContent = {
      day: dayFormatted,
      platform: post.platform || 'meta',
      type: post.type || 'Estático',
      theme: post.theme_title || post.theme || post.description || 'Publicação',
      bullets: Array.isArray(post.bullets) ? post.bullets : [],
      initialImageUrl: post.image_url
    };

    setSelectedPost({
      dayContent,
      dateKey: post.date_key || `${dayjs().format('DD-MM-YYYY')}-${post.platform || 'meta'}-${activeClient?.id}`,
      groupKeys: [post.date_key || post.id]
    });
    setModalOpen(true);
  };

  const handleSetUrl = async (type: 'organic' | 'paid' | 'drive') => {
    if (!isAdmin || !activeClient) return;

    let currentUrl = '';
    let label = '';
    let field = '';

    if (type === 'organic') {
      currentUrl = activeClient.organic_reportei_url || '';
      label = 'URL do Reportei para Tráfego Orgânico';
      field = 'organic_reportei_url';
    } else if (type === 'paid') {
      currentUrl = activeClient.paid_reportei_url || '';
      label = 'URL do Reportei para Tráfego Pago';
      field = 'paid_reportei_url';
    } else {
      currentUrl = (activeClient as any).drive_link || '';
      label = 'URL do Google Drive (Documentos)';
      field = 'drive_link';
    }

    const newUrl = window.prompt(`Digite a ${label}:`, currentUrl);

    if (newUrl !== null) {
      try {
        const { error } = await supabase
          .from('clients')
          .update({ [field]: newUrl.trim() || null })
          .eq('id', activeClient.id);

        if (error) throw error;
        if (onRefreshClient) onRefreshClient();
      } catch (err) {
        console.error('Erro ao salvar URL:', err);
      }
    }
  };

  // Permissões e features ativas
  const services = activeClient?.services || [];
  const hasService = (s: string) => services.includes(s);
  const getFeature = (feature: string, defaultVal: boolean) => activeClient?.features_settings?.[feature] ?? defaultVal;

  const showMapa = getFeature('mapa', hasService('Social Media'));
  const showPaidTrafficCard = (activeClient?.services?.includes('Tráfego Pago') ?? false) && activeClient?.id !== '75b00b27-61ee-4b23-8721-70748ccb0789';
  const showCrm = activeClient?.features_settings?.crm ?? activeClient?.features_settings?.is_lead_tracking_enabled ?? (activeClient as any)?.is_lead_tracking_enabled ?? true;
  const showAiPhotos = getFeature('ai_photos', hasService('Fotos com IA'));
  const showBriefings = getFeature('briefings', hasService('Social Media') || hasService('Tráfego Pago'));
  const showWebsite = getFeature('website', hasService('Website'));
  const showDocuments = getFeature('drive', true);
  const showTutorials = getFeature('tutorials', true);
  const showRoteiros = getFeature('roteiros', true);
  const showPasswordVault = getFeature('password_vault', true);

  const isActuallyOnboardingCompleted = activeClient?.onboarding_completed || isOnboardingCompleted;

  // Lista dos módulos compactos para a grade de acesso rápido
  const modulesList = [
    {
      id: 'mapa_editorial',
      label: 'Painel de Conteúdo',
      subtitle: 'Dashboard e mapa editorial',
      icon: Calendar,
      visible: showMapa,
      action: () => onNavigateToMapa('mapa')
    },
    {
      id: 'organico',
      label: 'Redes Sociais',
      subtitle: 'Métricas de desempenho',
      icon: TrendingUp,
      visible: getFeature('organico', hasService('Social Media')),
      action: () => {
        if (onNavigateToOrganico) {
          onNavigateToOrganico();
        } else {
          onNavigateToMapa('mapa');
        }
      }
    },
    {
      id: 'roteiros',
      label: 'Roteiros',
      subtitle: 'Criação e edição colaborativa',
      icon: BookOpen,
      visible: showRoteiros,
      action: onNavigateToRoteiros
    },
    {
      id: 'crm',
      label: 'CRM',
      subtitle: monthLeadsCount > 0 ? `${monthLeadsCount} leads este mês` : 'Gestão de oportunidades',
      icon: Kanban,
      visible: showCrm,
      action: () => setActiveView('leads')
    },
    {
      id: 'trafego_pago',
      label: 'Tráfego Pago',
      subtitle: 'Campanhas e anúncios',
      icon: Zap,
      visible: showPaidTrafficCard,
      action: onNavigateToPaidTraffic
    },
    {
      id: 'ai_photos',
      label: 'Fotos com IA',
      subtitle: 'Ensaios fotográficos',
      icon: Camera,
      visible: showAiPhotos,
      action: onNavigateToAiPhotos
    },
    {
      id: 'website',
      label: 'Website',
      subtitle: 'Acompanhamento do site',
      icon: Globe,
      visible: showWebsite,
      action: onNavigateToWebsite
    },
    {
      id: 'lockbox',
      label: 'Cofre de Senhas',
      subtitle: 'Credenciais seguras',
      icon: ShieldCheck,
      visible: showPasswordVault,
      action: onNavigateToPasswordVault
    },
    {
      id: 'arquivos',
      label: 'Documentos',
      subtitle: 'Arquivos e relatórios',
      icon: FolderOpen,
      visible: showDocuments,
      action: () => {
        if (activeClient?.drive_link) {
          window.open(activeClient.drive_link, '_blank');
        } else if (isAdmin) {
          handleSetUrl('drive');
        }
      }
    },
    {
      id: 'tutoriais',
      label: 'Tutoriais',
      subtitle: 'Guias e materiais',
      icon: ClipboardList,
      visible: showTutorials,
      action: onNavigateToTutorials
    },
    {
      id: 'strategic-briefings',
      label: 'Briefings',
      subtitle: 'Alinhamento estratégico',
      icon: Target,
      visible: showBriefings,
      action: onNavigateToStrategicBriefings
    }
  ];

  const menuOrder = activeClient?.features_settings?.menu_order;
  const visibleModules = modulesList
    .filter(m => m.visible)
    .sort((a, b) => {
      if (!menuOrder) return 0;
      let idxA = menuOrder.indexOf(a.id);
      let idxB = menuOrder.indexOf(b.id);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      return idxA - idxB;
    });

  // Estatísticas para os 3 cards de ação rápida
  const quickActionStats = [
    {
      id: 'para_aprovar',
      label: 'Para aprovar',
      value: postsParaAprovar.length,
      icon: CheckCircle2,
      color: '#f59e0b', // âmbar
      hasBadgePulse: postsParaAprovar.length > 0,
      action: () => {
        if (onNavigateToPublicacoes) {
          onNavigateToPublicacoes('pending_approval');
        } else {
          onNavigateToMapa('publicacoes', 'pending_approval');
        }
      }
    },
    {
      id: 'em_producao',
      label: 'Em produção',
      value: postsEmProducao.length,
      icon: Clock,
      color: '#3b82f6', // azul
      hasBadgePulse: false,
      action: () => {
        if (onNavigateToPublicacoes) {
          onNavigateToPublicacoes('draft');
        } else {
          onNavigateToMapa('publicacoes');
        }
      }
    },
    {
      id: 'publicados_mes',
      label: 'Publicados este mês',
      value: postsPublicadosMes.length,
      icon: TrendingUp,
      color: '#10b981', // verde
      hasBadgePulse: false,
      action: () => {
        onNavigateToMapa('mapa');
      }
    }
  ];

  // Se a visualização for o CRM Lead Tracker
  if (activeView === 'leads' && activeClient) {
    const isLawyer = !!activeClient.features_settings?.crm_specialty;
    const defaultConfig: ClientLeadConfig = {
      id: 'default',
      client_id: activeClient.id,
      is_enabled: true,
      location_options: ['Google Ads', 'Instagram', 'Indicação', 'Site orgânico', 'Outro'],
      kanban_stages: isLawyer
        ? ['Novo Contato', 'Em Atendimento', 'Proposta Enviada', 'Em Negociação', 'Cliente Fechado', 'Perdido']
        : ['Novo Lead', 'Em Contato', 'Reunião Agendada', 'Proposta Enviada', 'Fechado'],
      specialty_options: isLawyer
        ? [activeClient.features_settings?.crm_specialty]
        : ['Trabalhista', 'Família', 'Criminal', 'Cível', 'Empresarial', 'Previdenciário', 'Outro'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const effectiveConfig = leadConfig || defaultConfig;

    return (
      <div className="min-h-screen bg-[#FDFDFD]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button 
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-2 text-gray-500 hover:text-brand-dark mb-6 transition-colors font-medium cursor-pointer"
          >
            <ArrowLeft size={20} />
            Voltar ao Dashboard
          </button>
          <LeadTrackerView 
            clientId={activeClient.id} 
            config={effectiveConfig} 
            onBack={() => {
              setActiveView('dashboard');
              checkStatus();
            }}
          />
        </div>
      </div>
    );
  }

  const saudacao = getGreeting();
  const primeiroNome = getFirstName();
  const nomeMesAno = getMonthYearString();
  const nomeEmpresa = activeClient?.name || 'Sua Empresa';

  return (
    <div className="max-w-6xl mx-auto w-full pb-16">
      {/* SEÇÃO 1 — Header de boas-vindas */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: 'linear-gradient(135deg, #0F1115 0%, #13284D 60%, #20364D 100%)',
          padding: '32px 40px',
          borderRadius: 16,
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
        className="shadow-lg"
      >
        {/* Glow decorativo sutil */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 right-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="relative z-10">
          <p
            style={{
              color: '#8A8F98',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 8
            }}
          >
            {saudacao} — {nomeMesAno}
          </p>
          <h1
            style={{
              color: '#ffffff',
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1.2,
              margin: 0
            }}
          >
            {saudacao}, {primeiroNome}
          </h1>
          <p
            style={{
              color: '#8A8F98',
              fontSize: 14,
              marginTop: 8,
              marginBottom: 0
            }}
          >
            {nomeEmpresa} · Painel do cliente
          </p>
        </div>
      </motion.div>

      {/* SEÇÃO 2 — Cards de ação rápida */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6"
      >
        {quickActionStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.id}
              onClick={stat.action}
              style={{
                background: '#ffffff',
                borderRadius: 12,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                cursor: 'pointer',
                border: '1.5px solid #f0f0f0',
                transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)';
                e.currentTarget.style.borderColor = stat.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#f0f0f0';
              }}
              className="relative group select-none active:scale-[0.98]"
            >
              {/* Badge pulsante se for o card Para Aprovar e houver posts */}
              {stat.hasBadgePulse && (
                <span className="absolute top-4 right-4 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
              )}

              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${stat.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Icon size={20} color={stat.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 28, fontWeight: 700, color: '#13284D', margin: 0, lineHeight: 1.1 }}>
                  {postsLoading ? '...' : stat.value}
                </p>
                <p style={{ fontSize: 12, color: '#8A8F98', margin: '4px 0 0 0', fontWeight: 500 }}>
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Card de preview orgânico — mostrar apenas se houver dados em social_metrics */}
      {organicPreview && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '20px 24px',
            border: '1.5px solid #f0f0f0',
            marginTop: 16,
            marginBottom: 24
          }}
          className="shadow-xs hover:border-[#13284D]/30 transition-all"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <p style={{ color: '#8A8F98', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                Redes Sociais · Últimos 7 dias
              </p>
              <h3 style={{ color: '#13284D', fontSize: 15, fontWeight: 700, margin: 0 }}>
                Métricas das redes sociais
              </h3>
            </div>
            <button 
              type="button"
              onClick={() => {
                if (onNavigateToOrganico) {
                  onNavigateToOrganico();
                } else {
                  onNavigateToMapa('mapa');
                }
              }}
              style={{ color: '#13284D', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
              className="hover:underline transition-all"
            >
              Ver tudo →
            </button>
          </div>

          {/* 3 mini-cards: Alcance | Engajamento | Seguidores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#13284D', fontSize: 22, fontWeight: 700, margin: 0 }}>
                {organicPreview.alcance7d.toLocaleString('pt-BR')}
              </p>
              <p style={{ color: '#8A8F98', fontSize: 11, margin: '4px 0 0' }}>Alcance</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#13284D', fontSize: 22, fontWeight: 700, margin: 0 }}>
                {organicPreview.taxaEngajamento}%
              </p>
              <p style={{ color: '#8A8F98', fontSize: 11, margin: '4px 0 0' }}>Engajamento</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#10b981', fontSize: 22, fontWeight: 700, margin: 0 }}>
                {organicPreview.seguidoresGanhos7d >= 0 ? `+${organicPreview.seguidoresGanhos7d}` : organicPreview.seguidoresGanhos7d}
              </p>
              <p style={{ color: '#8A8F98', fontSize: 11, margin: '4px 0 0' }}>Seguidores</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* SEÇÃO 3 — Publicações pendentes de aprovação (condicional) */}
      {!postsLoading && postsParaAprovar.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: 24 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16
            }}
          >
            <div className="flex items-center gap-2">
              <h2 style={{ color: '#13284D', fontSize: 16, fontWeight: 700, margin: 0 }}>
                Aguardando sua aprovação
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                {postsParaAprovar.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onNavigateToPublicacoes) {
                  onNavigateToPublicacoes('pending_approval');
                } else {
                  onNavigateToMapa('publicacoes', 'pending_approval');
                }
              }}
              style={{
                color: '#13284D',
                fontSize: 13,
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
              className="hover:underline transition-all"
            >
              Ver todas →
            </button>
          </div>

          {/* Listar até 3 cards simples */}
          <div className="flex flex-col gap-2.5">
            {postsParaAprovar.slice(0, 3).map((post) => {
              const platform = (post.platform || 'meta').toUpperCase();
              const displayPlatform = platform === 'META' ? 'INSTAGRAM' : platform;
              const type = post.type || 'Estático';
              const title = post.theme_title ?? post.theme ?? post.description ?? 'Publicação sem tema';
              const formattedDate = formatDateDisplay(post.date_key);

              return (
                <div
                  key={post.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: 10,
                    padding: '16px 20px',
                    border: '1.5px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    transition: 'box-shadow 0.2s, border-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                    e.currentTarget.style.borderColor = '#13284D';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = '#f0f0f0';
                  }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: '#f3f4f6',
                          color: '#374151'
                        }}
                      >
                        {displayPlatform}
                      </span>
                      {type && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#eff6ff',
                            color: '#1d4ed8'
                          }}
                        >
                          {type}
                        </span>
                      )}
                      {(post.status === 'changes_requested' || post.status === 'alteracao_solicitada') && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#fefce8',
                            color: '#854f0b'
                          }}
                        >
                          Ajustes solicitados
                        </span>
                      )}
                    </div>
                    <p style={{ color: '#13284D', fontSize: 14, fontWeight: 600, margin: 0 }} className="truncate">
                      {title}
                    </p>
                    <p style={{ color: '#8A8F98', fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                      {formattedDate ? `Data prevista: ${formattedDate}` : 'Sem data definida'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenPost(post)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1.5px solid #13284D',
                      background: 'none',
                      color: '#13284D',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#13284D';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = '#13284D';
                    }}
                    className="self-start sm:self-center active:scale-95"
                  >
                    Ver
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Jornada de Onboarding (caso não esteja concluído) */}
      {!isActuallyOnboardingCompleted && !loadingOnboarding && onboardingStats && onboardingStats.total > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8"
        >
          <div
            onClick={() => isAdmin && onNavigateToOnboarding?.()}
            className={`bg-brand-dark/5 border border-brand-dark/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden group transition-colors ${isAdmin ? 'cursor-pointer hover:bg-brand-dark/10' : ''}`}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-dark/5 rounded-full blur-[80px] -mr-32 -mt-32 opacity-50"></div>

            <div className="flex items-center gap-5 relative z-10 w-full md:w-auto">
              <div className="flex-shrink-0 w-14 h-14 bg-white rounded-xl flex items-center justify-center text-brand-dark shadow-sm">
                <Target size={28} />
              </div>
              <div className="text-left flex-1">
                <h3 className="text-lg font-bold text-brand-dark tracking-tight">Sua jornada de onboarding</h3>
                {onboardingStats.currentPhaseName ? (
                  <p className="text-sm font-semibold text-gray-500 mt-1">
                    📍 Agora estamos em: <span className="text-brand-dark">{onboardingStats.currentPhaseName}</span>
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-gray-500 mt-1">Quase lá!</p>
                )}
              </div>
            </div>

            <div className="md:w-64 flex-shrink-0 relative z-10 text-left">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-brand-dark/60">Progresso</span>
                <span className="text-sm font-black text-brand-dark">
                  {onboardingStats.completed} / {onboardingStats.total}
                </span>
              </div>
              <div className="h-2.5 w-full bg-white rounded-full overflow-hidden border border-brand-dark/10 relative">
                <div
                  className="h-full bg-brand-dark rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${(onboardingStats.completed / (onboardingStats.total || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* SEÇÃO 4 — Seus módulos (grade menor / Acesso rápido) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mt-6"
      >
        <h2
          style={{
            color: '#13284D',
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 16
          }}
        >
          Acesso rápido
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12
          }}
        >
          {visibleModules.map((modulo) => {
            const ModIcon = modulo.icon;
            return (
              <div
                key={modulo.id}
                onClick={modulo.action}
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #f0f0f0',
                  borderRadius: 12,
                  padding: '18px 16px',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = '#13284D';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#f0f0f0';
                }}
                className="group active:scale-[0.98]"
              >
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <ModIcon size={20} color="#13284D" className="group-hover:scale-110 transition-transform origin-left" />
                  </div>
                  <p style={{ color: '#13284D', fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                    {modulo.label}
                  </p>
                </div>
                {modulo.subtitle && (
                  <p style={{ color: '#8A8F98', fontSize: 11, marginTop: 6, margin: '6px 0 0 0', lineHeight: 1.2 }}>
                    {modulo.subtitle}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Suporte e Rodapé sutil */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="mt-16 text-center text-xs text-gray-400 flex flex-col items-center gap-2"
      >
        <p className="font-medium">
          Precisa de suporte estratégico ou tem dúvidas? Entre em contato com a equipe da Canguru Digital.
        </p>
      </motion.div>

      {/* Modal de Publicação ao clicar em "Ver" */}
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
            fetchClientPosts();
          }}
        />
      )}
    </div>
  );
};

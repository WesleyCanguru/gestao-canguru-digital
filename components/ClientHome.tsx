import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  Sparkles,
  BookOpen,
  Camera,
  ArrowLeft,
  Link,
  BarChart3
} from 'lucide-react';
import { motion } from 'motion/react';
import dayjs from 'dayjs';
import { useClientOnboarding } from '../hooks/useClientOnboarding';
import { LeadTrackerView } from './LeadTrackerView';
import { ClientLeadConfig, Client } from '../types';
import { AgencyLogo } from './AgencyLogo';

interface ClientHomeProps {
  initialActiveView?: 'dashboard' | 'leads';
  onNavigateToOnboarding: () => void;
  onNavigateToMapa: () => void;
  onNavigateToBriefings: () => void;
  onNavigateToStrategicBriefings: () => void;
  onNavigateToDocuments: () => void;
  onNavigateToPaidTraffic: () => void;
  onNavigateToWebsite: () => void;
  onNavigateToPasswordVault: () => void;
  onNavigateToTutorials: () => void;
  onNavigateToAiPhotos: () => void;
  onRefreshClient?: () => void;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const ClientHome: React.FC<ClientHomeProps> = ({
  initialActiveView,
  onNavigateToOnboarding,
  onNavigateToMapa,
  onNavigateToBriefings,
  onNavigateToStrategicBriefings,
  onNavigateToDocuments,
  onNavigateToPaidTraffic,
  onNavigateToWebsite,
  onNavigateToPasswordVault,
  onNavigateToTutorials,
  onNavigateToAiPhotos,
  onRefreshClient,
}) => {
  const { activeClient, userRole } = useAuth();
  const [briefingMissing, setBriefingMissing] = useState(false);
  const [smartLoading, setSmartLoading] = useState(true);
  const [leadConfig, setLeadConfig] = useState<ClientLeadConfig | null>(null);
  const [monthLeadsCount, setMonthLeadsCount] = useState<number>(0);
  const [activeView, setActiveView] = useState<'dashboard' | 'leads'>(initialActiveView || 'dashboard');

  useEffect(() => {
    if (initialActiveView) {
      setActiveView(initialActiveView);
    }
  }, [initialActiveView]);

  const { isCompleted: isOnboardingCompleted, loading: loadingOnboarding, stats } = useClientOnboarding(activeClient?.id);
  const isAdmin = userRole === 'admin';

  // Handle deep link to CRM
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const destino = params.get('destino') || params.get('active_view');
    if (destino === 'crm' && (activeClient?.is_lead_tracking_enabled || isAdmin)) {
      setActiveView('leads');
    }
  }, [activeClient, isAdmin]);

  const clientName = activeClient?.name || 'Cliente';

  const checkStatus = async () => {
    if (!activeClient?.id) {
      setSmartLoading(false);
      return;
    }

    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // c. Buscar briefing do mês atual
      const { data: briefing } = await supabase
        .from('briefings')
        .select('id, status')
        .eq('client_id', activeClient.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle();

      if (!briefing && now.getDate() >= 10) {
        setBriefingMissing(true);
      } else {
        setBriefingMissing(false);
      }

      // Fetch lead config
      const { data: configData } = await supabase
        .from('client_lead_configs')
        .select('*')
        .eq('client_id', activeClient.id)
        .maybeSingle();
      
      if (configData) {
        setLeadConfig(configData);
        
        // Fetch month leads count
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
    } catch (error) {
      console.error('Error checking client status:', error);
    } finally {
      setSmartLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [activeClient?.id]);

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

  const services = activeClient?.services || [];
  const hasService = (s: string) => services.length === 0 || services.includes(s);
  const getFeature = (feature: string, defaultVal: boolean) => activeClient?.features_settings?.[feature] ?? defaultVal;

  const showMapa = getFeature('mapa', hasService('Social Media'));
  const showPaidTraffic = getFeature('reportei_paid', hasService('Tráfego Pago'));
  // Esconder o card de estratégia para Next Safety (ID: 75b00b27-61ee-4b23-8721-70748ccb0789)
  const showPaidTrafficCard = showPaidTraffic && activeClient?.id !== '75b00b27-61ee-4b23-8721-70748ccb0789';
  const showAiPhotos = getFeature('ai_photos', hasService('Fotos com IA'));
  const showOrganicTraffic = getFeature('reportei_organic', hasService('Social Media'));
  const showBriefings = getFeature('briefings', hasService('Social Media') || hasService('Tráfego Pago'));
  const showWebsite = getFeature('website', hasService('Website'));
  const showDocuments = getFeature('drive', true);
  const showLeadConfig = getFeature('tracking', true);
  const showTutorials = getFeature('tutorials', true);

  const isActuallyOnboardingCompleted = activeClient?.onboarding_completed || isOnboardingCompleted;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const allCards = [
    {
      id: 'mapa_editorial',
      visible: showMapa,
      render: () => (
        <motion.div 
          key="mapa_editorial"
          variants={itemVariants}
          onClick={onNavigateToMapa}
          className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col relative"
        >
          <div className="flex justify-between items-start mb-8">
            <div className="w-16 h-16 bg-gray-50 rounded-[20px] flex items-center justify-center text-brand-dark group-hover:bg-brand-dark group-hover:text-white transition-all duration-500 shadow-sm">
              <Calendar size={32} />
            </div>
            <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
          </div>
          <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Mapa Editorial</h3>
          <p className="text-gray-500 text-sm leading-relaxed font-medium">
            Acesse o calendário completo de publicações. Visualize, aprove e acompanhe o status de cada conteúdo planejado.
          </p>
        </motion.div>
      )
    },
    {
      id: 'trafego_pago',
      visible: showPaidTrafficCard,
      render: () => (
        <motion.div 
          key="trafego_pago"
          variants={itemVariants}
          onClick={onNavigateToPaidTraffic}
          className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col relative"
        >
          <div className="flex justify-between items-start mb-8">
            <div className="w-16 h-16 bg-blue-50/50 rounded-[20px] flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm">
              <Zap size={32} />
            </div>
            <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
          </div>
          <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Tráfego Pago</h3>
          <p className="text-gray-500 text-sm leading-relaxed font-medium">
            Estratégias, performance de anúncios e campanhas ativas.
          </p>
        </motion.div>
      )
    },
    {
      id: 'reportei_paid',
      visible: showPaidTraffic,
      render: () => (
        activeClient?.paid_reportei_url ? (
          <motion.a 
            key="reportei_paid"
            href={activeClient.paid_reportei_url}
            target="_blank"
            rel="noopener noreferrer"
            variants={itemVariants}
            className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-300 flex flex-col relative h-full"
          >
            {isAdmin && (
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSetUrl('paid'); }}
                className="absolute top-10 right-20 p-2 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
              >
                <Globe size={18} className="text-gray-400" />
              </button>
            )}
            <div className="flex justify-between items-start mb-8">
              <div className="w-16 h-16 bg-blue-50/50 rounded-[20px] flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
                <BarChart3 size={32} />
              </div>
              <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-300" />
            </div>
            <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Dashboard Pago</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">Acompanhe seus resultados via Reportei.</p>
          </motion.a>
        ) : (
          <motion.div 
            key="reportei_paid"
            variants={itemVariants}
            onClick={() => isAdmin && handleSetUrl('paid')}
            className={`group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] ${isAdmin ? 'cursor-pointer hover:border-brand-dark/10 hover:shadow-md' : 'opacity-60 cursor-default'} transition-all duration-300 flex flex-col relative h-full`}
          >
            <div className="flex justify-between items-start mb-8">
              <div className="w-16 h-16 bg-blue-50/50 rounded-[20px] flex items-center justify-center text-blue-600 shadow-sm">
                <BarChart3 size={32} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Em breve</span>
                {isAdmin && <span className="text-[8px] text-brand-dark font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Configurar Link</span>}
              </div>
            </div>
            <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Dashboard Pago</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">Acompanhe seus resultados via Reportei.</p>
          </motion.div>
        )
      )
    },
    {
      id: 'reportei_organic',
      visible: showOrganicTraffic,
      render: () => (
        activeClient?.organic_reportei_url ? (
          <motion.a 
            key="reportei_organic"
            href={activeClient.organic_reportei_url}
            target="_blank"
            rel="noopener noreferrer"
            variants={itemVariants}
            className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-300 flex flex-col relative h-full"
          >
            {isAdmin && (
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSetUrl('organic'); }}
                className="absolute top-10 right-20 p-2 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
              >
                <Globe size={18} className="text-gray-400" />
              </button>
            )}
            <div className="flex justify-between items-start mb-8">
              <div className="w-16 h-16 bg-purple-50/50 rounded-[20px] flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300 shadow-sm">
                <TrendingUp size={32} />
              </div>
              <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-300" />
            </div>
            <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Dashboard Orgânico</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">Acessar métricas do Reportei.</p>
          </motion.a>
        ) : (
          <motion.div 
            key="reportei_organic"
            variants={itemVariants}
            onClick={() => isAdmin && handleSetUrl('organic')}
            className={`group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] ${isAdmin ? 'cursor-pointer hover:border-brand-dark/10 hover:shadow-md' : 'opacity-60 cursor-default'} transition-all duration-300 flex flex-col relative h-full`}
          >
            <div className="flex justify-between items-start mb-8">
              <div className="w-16 h-16 bg-purple-50/50 rounded-[20px] flex items-center justify-center text-purple-600 shadow-sm">
                <TrendingUp size={32} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Em breve</span>
                {isAdmin && <span className="text-[8px] text-brand-dark font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Configurar Link</span>}
              </div>
            </div>
            <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Dashboard Orgânico</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">Acessar métricas do Reportei.</p>
          </motion.div>
        )
      )
    },
    {
      id: 'crm',
      visible: leadConfig?.is_enabled && showLeadConfig,
      render: () => (
        <motion.div
          key="crm"
          variants={itemVariants}
          whileHover={{ y: -4, shadow: '0 20px 40px rgba(0,0,0,0.08)' }}
          onClick={() => setActiveView('leads')}
          className="bg-white p-10 rounded-[2.5rem] border border-black/[0.03] shadow-[0_10px_30px_rgba(0,0,0,0.02)] cursor-pointer group transition-all h-full"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="w-16 h-16 rounded-[20px] bg-orange-50 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
              <Target size={32} />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tracking-tighter text-brand-dark">{monthLeadsCount}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Leads no Mês</div>
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">CRM / Leads</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">Gestão e conversão de leads e oportunidades.</p>
          </div>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const chave = window.prompt('Para gerar o link direto do CRM, preciso da senha (chave) deste cliente:');
                if (chave) {
                  const baseUrl = `${window.location.protocol}//${window.location.host}`;
                  const directLink = `${baseUrl}/?chave=${chave}&destino=crm`;
                  navigator.clipboard.writeText(directLink);
                  alert('Link direto do CRM copiado!');
                }
              }}
              className="mt-6 w-full py-3 bg-gray-50 text-gray-500 hover:text-brand-dark hover:bg-gray-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <Link size={14} />
              Copiar Link Direto
            </button>
          )}
        </motion.div>
      )
    },
    {
      id: 'ai_photos',
      visible: showAiPhotos,
      render: () => (
        <motion.div 
          key="ai_photos"
          variants={itemVariants}
          onClick={onNavigateToAiPhotos}
          className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col relative h-full"
        >
          <div className="flex justify-between items-start mb-8">
            <div className="w-16 h-16 bg-fuchsia-50/50 rounded-[20px] flex items-center justify-center text-fuchsia-600 group-hover:bg-fuchsia-600 group-hover:text-white transition-all duration-500 shadow-sm">
              <Camera size={32} />
            </div>
            <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
          </div>
          <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Fotos com IA</h3>
          <p className="text-gray-500 text-sm leading-relaxed font-medium">
            Aprove e comente os ensaios fotográficos gerados por Inteligência Artificial.
          </p>
        </motion.div>
      )
    },
    {
      id: 'website',
      visible: showWebsite,
      render: () => (
        <motion.div 
          key="website"
          variants={itemVariants}
          onClick={onNavigateToWebsite}
          className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col h-full"
        >
          <div className="flex justify-between items-start mb-8">
            <div className="w-16 h-16 bg-indigo-50/50 rounded-[20px] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm">
              <Globe size={32} />
            </div>
            <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
          </div>
          <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Website</h3>
          <p className="text-gray-500 text-sm leading-relaxed font-medium">
            Prévia e acompanhamento do desenvolvimento do seu site.
          </p>
        </motion.div>
      )
    },
    {
      id: 'lockbox',
      visible: true,
      render: () => (
        <motion.div 
          key="lockbox"
          variants={itemVariants}
          onClick={onNavigateToPasswordVault}
          className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col h-full"
        >
          <div className="flex justify-between items-start mb-8">
            <div className="w-16 h-16 bg-slate-50/50 rounded-[20px] flex items-center justify-center text-slate-600 group-hover:bg-slate-600 group-hover:text-white transition-all duration-500 shadow-sm">
              <ShieldCheck size={32} />
            </div>
            <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
          </div>
          <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Cofre de Senhas</h3>
          <p className="text-gray-500 text-sm leading-relaxed font-medium">
            Acesso seguro às credenciais e senhas da sua marca.
          </p>
        </motion.div>
      )
    },
    {
      id: 'arquivos',
      visible: showDocuments,
      render: () => (
        activeClient?.drive_link ? (
          <motion.a 
            key="arquivos"
            href={(activeClient as any).drive_link}
            target="_blank"
            rel="noopener noreferrer"
            variants={itemVariants}
            className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col relative h-full"
          >
            {isAdmin && (
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSetUrl('drive'); }}
                className="absolute top-10 right-20 p-2 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
              >
                <Globe size={18} className="text-gray-400" />
              </button>
            )}
            <div className="flex justify-between items-start mb-8">
              <div className="w-16 h-16 bg-teal-50/50 rounded-[20px] flex items-center justify-center text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-all duration-500 shadow-sm">
                <FolderOpen size={32} />
              </div>
              <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
            </div>
            <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Documentos</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">
              Repositório de arquivos, contratos e relatórios mensais.
            </p>
          </motion.a>
        ) : (
          <motion.div 
            key="arquivos"
            variants={itemVariants}
            onClick={() => isAdmin && handleSetUrl('drive')}
            className={`group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] ${isAdmin ? 'cursor-pointer hover:border-brand-dark/10' : 'opacity-60 cursor-default'} transition-all duration-500 flex flex-col relative h-full`}
          >
            <div className="flex justify-between items-start mb-8">
              <div className="w-16 h-16 bg-teal-50/50 rounded-[20px] flex items-center justify-center text-teal-600 shadow-sm">
                <FolderOpen size={32} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Em breve</span>
                {isAdmin && <span className="text-[8px] text-brand-dark font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Configurar Link</span>}
              </div>
            </div>
            <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Documentos</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">
              Repositório de arquivos, contratos e relatórios mensais.
            </p>
          </motion.div>
        )
      )
    },
    {
      id: 'tutoriais',
      visible: showTutorials,
      render: () => (
        <motion.div 
          key="tutoriais"
          variants={itemVariants}
          onClick={onNavigateToTutorials}
          className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col h-full"
        >
          <div className="flex justify-between items-start mb-8">
            <div className="w-16 h-16 bg-blue-50/50 rounded-[20px] flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm">
              <BookOpen size={32} />
            </div>
            <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
          </div>
          <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Tutoriais</h3>
          <p className="text-gray-500 text-sm leading-relaxed font-medium">
            Aprenda a gerenciar suas plataformas e aprovar conteúdos.
          </p>
        </motion.div>
      )
    },
    {
      id: 'strategic-briefings',
      visible: showBriefings,
      render: () => (
        <motion.div 
          key="strategic-briefings"
          variants={itemVariants}
          onClick={onNavigateToStrategicBriefings}
          className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col h-full"
        >
          <div className="flex justify-between items-start mb-8">
            <div className="w-16 h-16 bg-rose-50/50 rounded-[20px] flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all duration-500 shadow-sm">
              <Target size={32} />
            </div>
            <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
          </div>
          <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Briefings</h3>
          <p className="text-gray-500 text-sm leading-relaxed font-medium">
            Formulários estratégicos e alinhamento de marca.
          </p>
        </motion.div>
      )
    }
  ];

  const quickAccessItems = allCards.filter(c => ['reportei_paid', 'reportei_organic', 'crm'].includes(c.id) && c.visible).sort((a, b) => {
    // Optional: respect menu_order if desired, or keep fixed order: Paid, Organic, CRM
    const order = ['reportei_paid', 'reportei_organic', 'crm'];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });

  const menuOrder = activeClient?.features_settings?.menu_order;
  const sortedCards = allCards
    .filter(c => c.visible && !['reportei_paid', 'reportei_organic', 'crm'].includes(c.id))
    .sort((a, b) => {
      if (!menuOrder) return 0;
      let idxA = menuOrder.indexOf(a.id);
      let idxB = menuOrder.indexOf(b.id);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      return idxA - idxB;
    });

  if (activeView === 'leads' && activeClient) {
    if (!leadConfig && !isAdmin) {
      return (
        <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-8 text-center">
          <Target size={48} className="text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-brand-dark mb-2">CRM Indisponível</h2>
          <p className="text-gray-500 mb-6">Este módulo ainda não foi configurado para sua conta.</p>
          <button onClick={() => setActiveView('dashboard')} className="px-8 py-3 bg-brand-dark text-white rounded-2xl font-bold text-sm uppercase tracking-widest">
            Voltar ao Dashboard
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#FDFDFD]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button 
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-2 text-gray-500 hover:text-brand-dark mb-6 transition-colors font-medium"
          >
            <ArrowLeft size={20} />
            Voltar ao Dashboard
          </button>
          <LeadTrackerView 
            clientId={activeClient.id} 
            config={leadConfig || { is_enabled: true, client_id: activeClient.id }} 
            onBack={() => {
              setActiveView('dashboard');
              checkStatus();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center relative pb-10">
      
      {/* Background Elements */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-50/30 rounded-full blur-[120px] -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-50/30 rounded-full blur-[120px] -z-10 animate-pulse delay-1000"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl w-full text-center mb-8 space-y-6 flex flex-col items-center"
      >
        <div className="relative group mb-2">
          <div className="absolute -inset-4 bg-blue-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          <AgencyLogo className="h-20 relative mix-blend-multiply" />
        </div>

        <div className="space-y-4">
          <h1 className="text-brand-dark font-bold text-5xl md:text-7xl tracking-tighter serif italic leading-none">
            Bolsa
          </h1>
          <div className="w-12 h-0.5 bg-brand-dark mx-auto opacity-10"></div>
          <p className="text-[10px] md:text-[12px] uppercase tracking-[0.4em] font-bold text-gray-400">
            by Canguru Digital
          </p>
        </div>
        
        <p className="text-[15px] md:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed font-medium mt-4">
          Acompanhe sua linha editorial, monitore métricas e visualize o crescimento da sua marca em tempo real.
        </p>
      </motion.div>

      {/* Dashboard Grid */}
      <div className="max-w-6xl w-full">
        {/* Onboarding section (separate, always top) */}
        {!isActuallyOnboardingCompleted && !loadingOnboarding && stats && stats.total > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 px-4 sm:px-0"
          >
            <div 
              onClick={() => isAdmin && onNavigateToOnboarding?.()}
              className={`bg-brand-dark/5 border border-brand-dark/10 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden group transition-colors ${isAdmin ? 'cursor-pointer hover:bg-brand-dark/10' : ''}`}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-dark/5 rounded-full blur-[80px] -mr-32 -mt-32 opacity-50"></div>
              
              <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
                <div className="flex-shrink-0 w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-brand-dark shadow-sm">
                  <Target size={32} />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-xl font-black text-brand-dark tracking-tight">Sua jornada de onboarding</h3>
                  {stats.currentPhaseName ? (
                    <p className="text-sm font-bold text-gray-500 mt-1">
                      📍 Agora estamos em: <span className="text-brand-dark">{stats.currentPhaseName}</span>
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-gray-500 mt-1">Quase lá!</p>
                  )}
                </div>
              </div>

              <div className="md:w-64 flex-shrink-0 relative z-10 text-left">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-brand-dark/60">Progresso</span>
                  <span className="text-sm font-black text-brand-dark">
                    {stats.completed} / {stats.total}
                  </span>
                </div>
                <div className="h-3 w-full bg-white rounded-full overflow-hidden border border-brand-dark/10 relative">
                  <div 
                    className="h-full bg-brand-dark rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${(stats.completed / (stats.total || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Access Section */}
        {quickAccessItems.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-10 px-4 sm:px-0"
          >
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">Acesso Rápido</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickAccessItems.map(item => {
                if (item.id === 'reportei_paid') {
                  return activeClient?.paid_reportei_url ? (
                    <a key="quick_reportei_paid" href={activeClient.paid_reportei_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-black/[0.03] hover:shadow-md hover:border-blue-100 transition-all group">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <BarChart3 size={20} />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="font-bold text-brand-dark text-sm">Dashboard Pago</h4>
                        <p className="text-xs text-gray-500 line-clamp-1">Resultados de tráfego pago</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 group-hover:text-current transform group-hover:translate-x-1 transition-all" />
                    </a>
                  ) : (
                    <div key="quick_reportei_paid" onClick={() => isAdmin && handleSetUrl('paid')} className={`flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-black/[0.03] transition-all group ${isAdmin ? 'cursor-pointer hover:shadow-md' : 'opacity-60'}`}>
                      <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center shrink-0">
                        <BarChart3 size={20} />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="font-bold text-gray-700 text-sm">Dashboard Pago</h4>
                        <p className="text-xs text-gray-400 line-clamp-1">Em breve</p>
                      </div>
                    </div>
                  );
                }
                if (item.id === 'reportei_organic') {
                  return activeClient?.organic_reportei_url ? (
                    <a key="quick_reportei_organic" href={activeClient.organic_reportei_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-black/[0.03] hover:shadow-md hover:border-green-100 transition-all group">
                      <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-green-600 group-hover:text-white transition-colors">
                        <TrendingUp size={20} />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="font-bold text-brand-dark text-sm">Dashboard Orgânico</h4>
                        <p className="text-xs text-gray-500 line-clamp-1">Crescimento das redes sociais</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 group-hover:text-current transform group-hover:translate-x-1 transition-all" />
                    </a>
                  ) : (
                    <div key="quick_reportei_organic" onClick={() => isAdmin && handleSetUrl('organic')} className={`flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-black/[0.03] transition-all group ${isAdmin ? 'cursor-pointer hover:shadow-md' : 'opacity-60'}`}>
                      <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center shrink-0">
                        <TrendingUp size={20} />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="font-bold text-gray-700 text-sm">Dashboard Orgânico</h4>
                        <p className="text-xs text-gray-400 line-clamp-1">Em breve</p>
                      </div>
                    </div>
                  );
                }
                if (item.id === 'crm') {
                  return (
                    <button key="quick_crm" onClick={() => setActiveView('leads')} className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-black/[0.03] hover:shadow-md hover:border-orange-100 transition-all group w-full text-left">
                      <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                        <Target size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-brand-dark text-sm">CRM / Leads</h4>
                        <p className="text-xs text-orange-600 font-bold bg-orange-50 inline-block px-1.5 py-0.5 rounded mt-0.5">{monthLeadsCount} {monthLeadsCount === 1 ? 'lead' : 'leads'} no mês</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 group-hover:text-current transform group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                }
                return null;
              })}
            </div>
          </motion.div>
        )}

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 px-4 sm:px-0"
        >
          {sortedCards.map(card => card.render())}
        </motion.div>
      </div>

      {/* Premium Watermark & Support */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 2 }}
        className="mt-20 flex flex-col items-center gap-6"
      >
        <p className="text-[12px] text-gray-400 font-medium">
          Precisa de ajuda? Nos chame no grupo de WhatsApp.
        </p>
        <div className="flex items-center gap-4 select-none pointer-events-none opacity-5">
          <Sparkles size={16} />
          <span className="text-[10px] uppercase tracking-[0.5em] font-bold">Experiência Premium Bolsa</span>
          <Sparkles size={16} />
        </div>
      </motion.div>
    </div>
  );
};

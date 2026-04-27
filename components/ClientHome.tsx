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
  ArrowLeft
} from 'lucide-react';
import { motion } from 'motion/react';
import dayjs from 'dayjs';
import { LeadTrackerView } from './LeadTrackerView';
import { ClientLeadConfig } from '../types';

interface ClientHomeProps {
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
  const [activeView, setActiveView] = useState<'dashboard' | 'leads'>('dashboard');

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

  const isAdmin = userRole === 'admin';

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

  const showMapa = hasService('Social Media');
  const showPaidTraffic = hasService('Tráfego Pago');
  // Esconder o card de estratégia para Next Safety (ID: 75b00b27-61ee-4b23-8721-70748ccb0789)
  const showPaidTrafficCard = showPaidTraffic && activeClient?.id !== '75b00b27-61ee-4b23-8721-70748ccb0789';
  const showAiPhotos = hasService('Fotos com IA');
  const showOrganicTraffic = hasService('Social Media');
  const showBriefings = hasService('Social Media') || hasService('Tráfego Pago');
  const showWebsite = hasService('Website');
  const showDocuments = true; // Sempre mostrar

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

  if (activeView === 'leads' && leadConfig && activeClient) {
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
            config={leadConfig} 
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
        className="max-w-4xl w-full text-center mb-8 space-y-4"
      >
        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white border border-black/[0.02] shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-2">
          <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] animate-pulse"></span>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">Ambiente Seguro • {clientName}</span>
        </div>
        
        <div className="space-y-3">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-brand-dark leading-[1.2] md:leading-[0.9]">
            Bolsa <br />
            <span className="serif italic font-normal text-gray-300 inline-block mt-2 md:mt-0">Estratégia & Gestão</span>
          </h1>
          <div className="w-10 h-1 bg-brand-dark mx-auto opacity-5 rounded-full"></div>
        </div>
        
        <p className="text-base md:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed font-medium">
          O lugar onde a Canguru Digital guarda tudo da sua marca. 
          Acompanhe a linha editorial, monitore métricas e visualize o crescimento da {clientName}.
        </p>
      </motion.div>

      {/* Dashboard de Acompanhamento Section */}
      {(showPaidTraffic || showOrganicTraffic) && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-6xl w-full mb-12"
        >
          <h2 className="text-xl font-bold text-brand-dark mb-6 tracking-tight">Acompanhamento de Resultados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {showPaidTraffic && (
              activeClient?.paid_reportei_url ? (
                <a 
                  href={activeClient.paid_reportei_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white rounded-2xl p-6 shadow-sm border border-black/[0.02] hover:shadow-md hover:border-brand-dark/10 transition-all duration-300 flex items-center justify-between relative"
                >
                  {isAdmin && (
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSetUrl('paid'); }}
                      className="absolute top-1/2 -translate-y-1/2 right-16 p-2 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                    >
                      <Globe size={14} className="text-gray-400" />
                    </button>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50/50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                      <Zap size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-dark">Dashboard Pago</h4>
                      <p className="text-xs text-gray-500 font-medium">Acessar Reportei</p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-gray-300 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-300" />
                </a>
              ) : (
                <div 
                  onClick={() => isAdmin && handleSetUrl('paid')}
                  className={`group bg-white rounded-2xl p-6 shadow-sm border border-black/[0.02] ${isAdmin ? 'cursor-pointer hover:border-brand-dark/10 hover:shadow-md' : 'opacity-60 cursor-default'} transition-all duration-300 flex items-center justify-between`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50/50 rounded-xl flex items-center justify-center text-blue-600">
                      <Zap size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-dark">Dashboard Pago</h4>
                      <p className="text-xs text-gray-500 font-medium">Acessar Reportei</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Em breve</span>
                    {isAdmin && <span className="text-[8px] text-brand-dark font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Configurar Link</span>}
                  </div>
                </div>
              )
            )}

            {showOrganicTraffic && (
              activeClient?.organic_reportei_url ? (
                <a 
                  href={activeClient.organic_reportei_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white rounded-2xl p-6 shadow-sm border border-black/[0.02] hover:shadow-md hover:border-brand-dark/10 transition-all duration-300 flex items-center justify-between relative"
                >
                  {isAdmin && (
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSetUrl('organic'); }}
                      className="absolute top-1/2 -translate-y-1/2 right-16 p-2 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                    >
                      <Globe size={14} className="text-gray-400" />
                    </button>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50/50 rounded-xl flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-dark">Dashboard Orgânico</h4>
                      <p className="text-xs text-gray-500 font-medium">Acessar Reportei</p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-gray-300 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-300" />
                </a>
              ) : (
                <div 
                  onClick={() => isAdmin && handleSetUrl('organic')}
                  className={`group bg-white rounded-2xl p-6 shadow-sm border border-black/[0.02] ${isAdmin ? 'cursor-pointer hover:border-brand-dark/10 hover:shadow-md' : 'opacity-60 cursor-default'} transition-all duration-300 flex items-center justify-between`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50/50 rounded-xl flex items-center justify-center text-purple-600">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-dark">Dashboard Orgânico</h4>
                      <p className="text-xs text-gray-500 font-medium">Acessar Reportei</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Em breve</span>
                    {isAdmin && <span className="text-[8px] text-brand-dark font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Configurar Link</span>}
                  </div>
                </div>
              )
            )}
            {leadConfig?.is_enabled && (
              <motion.div
                whileHover={{ y: -4, shadow: '0 20px 40px rgba(0,0,0,0.08)' }}
                onClick={() => setActiveView('leads')}
                className="bg-white p-6 rounded-[2rem] border border-black/[0.03] shadow-[0_10px_30px_rgba(0,0,0,0.02)] cursor-pointer group transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                    <Target size={24} />
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tracking-tighter text-brand-dark">{monthLeadsCount}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Leads no Mês</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-brand-dark">Acompanhamento de Leads</h4>
                  <p className="text-xs text-gray-400 mt-1">Gestão e conversão de leads</p>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* Seção Admin: Onboarding Interno */}
      {userRole === 'admin' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-6xl w-full mb-8"
        >
          <motion.div 
            whileHover={{ y: -4, shadow: '0 20px 40px rgba(0,0,0,0.04)' }}
            onClick={onNavigateToOnboarding} 
            className="flex items-center gap-5 p-6 bg-white border border-brand-dark/10 rounded-[32px] cursor-pointer transition-all shadow-sm"
          >
            <div className="w-12 h-12 bg-brand-dark/5 rounded-2xl flex items-center justify-center text-brand-dark">
              <ClipboardList size={24} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-brand-dark uppercase tracking-widest mb-1">Área Interna da Agência</p>
              <p className="text-base font-bold text-gray-900">Checklist de Onboarding do Cliente</p>
            </div>
            <ArrowRight size={20} className="text-brand-dark/40" />
          </motion.div>
        </motion.div>
      )}

      {/* Cards Grid - Bento Style */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl w-full"
      >
        
        {/* Card 1: Linha Editorial */}
        {showMapa && (
          <motion.div 
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
        )}

        {/* Tráfego Pago */}
        {showPaidTrafficCard && (
          <motion.div 
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
        )}

        {/* Fotos com IA */}
        {showAiPhotos && (
          <motion.div 
            variants={itemVariants}
            onClick={onNavigateToAiPhotos}
            className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col relative"
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
        )}

        {/* Website */}
        {showWebsite && (
          <motion.div 
            variants={itemVariants}
            onClick={onNavigateToWebsite}
            className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col"
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
        )}

        {/* Cofre de Senhas */}
        <motion.div 
          variants={itemVariants}
          onClick={onNavigateToPasswordVault}
          className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col"
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

        {/* Documentos */}
        {showDocuments && (
          (activeClient as any)?.drive_link ? (
            <motion.a 
              href={(activeClient as any).drive_link}
              target="_blank"
              rel="noopener noreferrer"
              variants={itemVariants}
              className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col relative"
            >
              {isAdmin && (
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSetUrl('drive'); }}
                  className="absolute top-8 right-16 p-2 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                >
                  <Globe size={14} className="text-gray-400" />
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
              variants={itemVariants}
              onClick={() => isAdmin && handleSetUrl('drive')}
              className={`group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] ${isAdmin ? 'cursor-pointer hover:border-brand-dark/10' : 'opacity-60 cursor-default'} transition-all duration-500 flex flex-col relative`}
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
        )}

        {/* Central de Tutoriais */}
        <motion.div 
          variants={itemVariants}
          onClick={onNavigateToTutorials}
          className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col"
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

        {/* Briefings Estratégicos */}
        {showBriefings && (
          <motion.div 
            variants={itemVariants}
            onClick={onNavigateToStrategicBriefings}
            className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="w-16 h-16 bg-rose-50/50 rounded-[20px] flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all duration-500 shadow-sm">
                <Target size={32} />
              </div>
              <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
            </div>
            <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Briefings Estratégicos</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">
              Respostas dos formulários de onboarding e alinhamento da marca.
            </p>
          </motion.div>
        )}

      </motion.div>

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

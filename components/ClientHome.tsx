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
  BookOpen
} from 'lucide-react';
import { motion } from 'motion/react';

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
  onRefreshClient,
}) => {
  const { activeClient, userRole } = useAuth();
  const [briefingMissing, setBriefingMissing] = useState(false);
  const [smartLoading, setSmartLoading] = useState(true);

  const clientName = activeClient?.name || 'Cliente';

  useEffect(() => {
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
      } catch (error) {
        console.error('Error checking client status:', error);
      } finally {
        setSmartLoading(false);
      }
    };

    checkStatus();
  }, [activeClient?.id]);

  const isAdmin = userRole === 'admin';

  const handleSetUrl = async (type: 'organic' | 'paid') => {
    if (!isAdmin || !activeClient) return;
    
    const currentUrl = type === 'organic' ? activeClient.organic_reportei_url : activeClient.paid_reportei_url;
    const newUrl = window.prompt(`Digite a URL do Reportei para Tráfego ${type === 'organic' ? 'Orgânico' : 'Pago'}:`, currentUrl || '');
    
    if (newUrl !== null) {
      try {
        const field = type === 'organic' ? 'organic_reportei_url' : 'paid_reportei_url';
        const { error } = await supabase
          .from('clients')
          .update({ [field]: newUrl.trim() || null })
          .eq('id', activeClient.id);
        
        if (error) throw error;
        if (onRefreshClient) onRefreshClient();
      } catch (err) {
        console.error('Erro ao salvar URL:', err);
        alert('Erro ao salvar a URL. Tente novamente.');
      }
    }
  };

  const services = activeClient?.services || [];
  const hasService = (s: string) => services.length === 0 || services.includes(s);

  const showMapa = hasService('Social Media');
  const showPaidTraffic = hasService('Tráfego Pago');
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
        className={`grid grid-cols-1 ${showMapa ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-8 max-w-6xl w-full`}
      >
        
        {/* Card 1: Linha Editorial (Destaque) */}
        {showMapa && (
          <motion.div 
            variants={itemVariants}
            onClick={onNavigateToMapa}
            className="group relative bg-white rounded-[3rem] p-12 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer overflow-hidden md:col-span-1 md:row-span-2 flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-1000">
              <Calendar size={200} />
            </div>
            
            <div className="relative z-10">
              <div className="w-20 h-20 bg-gray-50 rounded-[24px] flex items-center justify-center text-brand-dark mb-10 group-hover:bg-brand-dark group-hover:text-white transition-all duration-700 shadow-sm">
                <Calendar size={36} />
              </div>
              
              <h3 className="text-4xl font-bold text-brand-dark mb-4 tracking-tight">Mapa Editorial</h3>
              <p className="text-gray-500 text-base leading-relaxed mb-10 font-medium">
                Acesse o calendário completo de publicações. Visualize, aprove e acompanhe o status de cada conteúdo planejado.
              </p>
              
              <div className="space-y-4 mb-12">
                <div className="flex items-center gap-4 text-[11px] text-gray-400 font-bold uppercase tracking-[0.25em] bg-gray-50/50 p-4 rounded-2xl border border-black/[0.01]">
                  <ShieldCheck size={16} className="text-green-500" /> Acesso Restrito
                </div>
                <div className="flex items-center gap-4 text-[11px] text-gray-400 font-bold uppercase tracking-[0.25em] bg-gray-50/50 p-4 rounded-2xl border border-black/[0.01]">
                  <Target size={16} className="text-brand-dark" /> Planejamento Estratégico
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-center text-brand-dark font-bold text-xs uppercase tracking-[0.3em] group-hover:translate-x-3 transition-transform duration-500">
              Acessar Sistema <ArrowRight size={18} className="ml-4 opacity-30 group-hover:opacity-100 transition-opacity" />
            </div>
          </motion.div>
        )}

        {/* Módulos Secundários Grid */}
        <div className={`${showMapa ? 'md:col-span-2' : 'md:col-span-2'} grid grid-cols-1 sm:grid-cols-2 gap-8`}>
          
          {/* Tráfego Pago */}
          {showPaidTraffic && (
            activeClient?.paid_reportei_url ? (
              <motion.a 
                variants={itemVariants}
                href={activeClient.paid_reportei_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col relative"
              >
                {isAdmin && (
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSetUrl('paid'); }}
                    className="absolute top-6 right-6 p-2 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                  >
                    <Globe size={14} className="text-gray-400" />
                  </button>
                )}
                <div className="flex justify-between items-start mb-8">
                  <div className="w-16 h-16 bg-blue-50/50 rounded-[20px] flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm">
                    <Zap size={32} />
                  </div>
                  <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
                </div>
                <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Tráfego Pago</h3>
                <p className="text-gray-500 text-sm leading-relaxed font-medium">
                  Performance de anúncios e campanhas ativas em tempo real.
                </p>
              </motion.a>
            ) : (
              <motion.div 
                variants={itemVariants}
                onClick={() => isAdmin && handleSetUrl('paid')}
                className={`group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] ${isAdmin ? 'cursor-pointer hover:border-brand-dark/10' : 'opacity-60 cursor-default'} flex flex-col`}
              >
                <div className="flex justify-between items-start mb-8">
                  <div className="w-16 h-16 bg-blue-50/50 rounded-[20px] flex items-center justify-center text-blue-600 shadow-sm">
                    <Zap size={32} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Em breve</span>
                    {isAdmin && <span className="text-[8px] text-brand-dark font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Configurar Link</span>}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Tráfego Pago</h3>
                <p className="text-gray-500 text-sm leading-relaxed font-medium">
                  Performance de anúncios e campanhas ativas em tempo real.
                </p>
              </motion.div>
            )
          )}

          {/* Tráfego Orgânico */}
          {showOrganicTraffic && (
            activeClient?.organic_reportei_url ? (
              <motion.a 
                variants={itemVariants}
                href={activeClient.organic_reportei_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col relative"
              >
                {isAdmin && (
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSetUrl('organic'); }}
                    className="absolute top-6 right-6 p-2 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                  >
                    <Globe size={14} className="text-gray-400" />
                  </button>
                )}
                <div className="flex justify-between items-start mb-8">
                  <div className="w-16 h-16 bg-purple-50/50 rounded-[20px] flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all duration-500 shadow-sm">
                    <TrendingUp size={32} />
                  </div>
                  <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
                </div>
                <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Tráfego Orgânico</h3>
                <p className="text-gray-500 text-sm leading-relaxed font-medium">
                  Crescimento orgânico, engajamento e relatórios de métricas.
                </p>
              </motion.a>
            ) : (
              <motion.div 
                variants={itemVariants}
                onClick={() => isAdmin && handleSetUrl('organic')}
                className={`group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] ${isAdmin ? 'cursor-pointer hover:border-brand-dark/10' : 'opacity-60 cursor-default'} flex flex-col`}
              >
                <div className="flex justify-between items-start mb-8">
                  <div className="w-16 h-16 bg-purple-50/50 rounded-[20px] flex items-center justify-center text-purple-600 shadow-sm">
                    <TrendingUp size={32} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Em breve</span>
                    {isAdmin && <span className="text-[8px] text-brand-dark font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Configurar Link</span>}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Tráfego Orgânico</h3>
                <p className="text-gray-500 text-sm leading-relaxed font-medium">
                  Crescimento orgânico, engajamento e relatórios de métricas.
                </p>
              </motion.div>
            )
          )}

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

          {/* Briefings Mensais (Desativado temporariamente) */}
          {/* showBriefings && (
            <motion.div 
              variants={itemVariants}
              onClick={onNavigateToBriefings}
              className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="w-16 h-16 bg-amber-50/50 rounded-[20px] flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all duration-500 shadow-sm">
                  <AlertCircle size={32} />
                </div>
                <ArrowRight size={22} className="text-gray-200 group-hover:text-brand-dark transform group-hover:-rotate-45 transition-all duration-500" />
              </div>
              <h3 className="text-2xl font-bold text-brand-dark mb-3 tracking-tight">Briefings Mensais</h3>
              <p className="text-gray-500 text-sm leading-relaxed font-medium">
                Solicitações de novas demandas e aprovações pendentes.
              </p>
            </motion.div>
          ) */}

          {/* Documentos */}
          {showDocuments && (
            <motion.div 
              variants={itemVariants}
              onClick={onNavigateToDocuments}
              className="group bg-white rounded-[2.5rem] p-10 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] hover:border-brand-dark/10 transition-all duration-500 cursor-pointer flex flex-col"
            >
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

        </div>

      </motion.div>

      {/* Premium Watermark & Support */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 2 }}
        className="mt-20 flex flex-col items-center gap-6"
      >
        <p className="text-[12px] text-gray-400 font-medium">
          Precisa de ajuda? Entre em contato: <a href="mailto:contato@cangurudigital.com.br" className="text-brand-dark font-bold hover:underline">contato@cangurudigital.com.br</a>
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

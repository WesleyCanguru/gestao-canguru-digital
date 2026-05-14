import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { Logo } from './components/Logo';
import { AnnualOverview } from './components/AnnualOverview';
import { MonthDetail } from './components/MonthDetail';
import { LoginScreen } from './components/LoginScreen';
import { PublicApprovalScreen } from './components/PublicApprovalScreen';
import { ThemeApprovalPublic } from './components/ThemeApprovalPublic';
import { ClientSelectorScreen } from './components/ClientSelectorScreen';
import { ClientManager } from './components/ClientManager';
import { ClientChecklistView } from './components/agency/ClientChecklistView';
import { BriefingOnboarding } from './components/BriefingOnboarding';
import { ClientHome } from './components/ClientHome';
import { BriefingsView } from './components/BriefingsView';
import { PaidTrafficView } from './components/PaidTrafficView';
import WebsiteView from './components/WebsiteView';
import { ContractFormScreen } from './components/ContractFormScreen';
// import AdminView from './components/AdminView'; // Removed redundant view
import { useEditorialData, MONTH_NAMES } from './hooks/useEditorialData';
import { Map, ChevronRight, LogOut, Home, Building2, ClipboardList, LayoutDashboard, FileText, FolderOpen, TrendingUp, Globe, Shield } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

import { PasswordVault } from './components/PasswordVault';
import { TutorialCenter } from './components/TutorialCenter';
import { AiPhotosView } from './components/AiPhotosView';

import { AgencyHome } from './components/agency/AgencyHome';
import { AgencyDashboard } from './components/agency/AgencyDashboard';

dayjs.locale('pt-br');

import { Navigation } from './components/Navigation';

type ViewState = 'home' | 'month-detail' | 'onboarding' | 'dashboard' | 'briefings' | 'strategic-briefings' | 'paid-traffic' | 'website' | 'password-vault' | 'tutorials' | 'ai-photos' | 'agencyDashboard' | 'crm';

interface MainAppProps {
  initialView?: ViewState;
  onExitAgencyDashboard?: () => void;
  onGoToAgencyHome?: () => void;
  onGoToClientSelector?: () => void;
}

const MainApp: React.FC<MainAppProps> = ({ initialView, onExitAgencyDashboard, onGoToAgencyHome, onGoToClientSelector }) => {
  const [view, setView] = useState<ViewState>(initialView || 'dashboard');
  const [agencyTab, setAgencyTab] = useState<string>('home');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const { userRole, logout, activeClient, setActiveClient, refreshActiveClient } = useAuth();
  const { monthlyPlans } = useEditorialData();

  // Deep linking: Handle direct links to briefings or other views
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') || params.get('destino') || params.get('active_view');
    const tutorialId = params.get('id');
    
    if (viewParam === 'briefing' || viewParam === 'strategic-briefings') {
      setView('strategic-briefings');
    } else if (viewParam === 'crm') {
      setView('dashboard'); // ClientHome handles crm state internally if needed, but we can set it via props if we add them. 
      // Actually, ClientHome has internally 'dashboard' or 'leads'.
    } else if (viewParam === 'tutorial') {
      setView('tutorials');
      if (tutorialId) {
        // We'll need to pass this to TutorialCenter
        localStorage.setItem('deep_link_tutorial_id', tutorialId);
      }
    } else if (viewParam === 'password-vault') {
      setView('password-vault');
    }
  }, []);

  // Redirecionar cliente para briefings estratégicos se onboarding não estiver completo
  useEffect(() => {
    if (userRole === 'approver' && activeClient) {
      if (!activeClient.onboarding_completed && !activeClient.briefings_waived && view !== 'strategic-briefings') {
        setView('strategic-briefings');
      }
    }
  }, [userRole, activeClient, view]);

  useEffect(() => {
    if (view === 'month-detail' && !selectedMonth) {
      const currentMonthName = MONTH_NAMES[dayjs().month()];
      setSelectedMonth(currentMonthName);
    }
  }, [view, selectedMonth]);

  const handleSelectMonth = (month: string) => {
    setSelectedMonth(month);
    setView('month-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHome = () => {
    setView('dashboard');
    setSelectedMonth(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getRoleLabel = () => {
    switch(userRole) {
      case 'admin': return 'Wesley (Diretor)';
      case 'approver': return activeClient?.responsible || 'Wesley (Diretor)';
      case 'team': return 'Equipe Canguru';
      default: return '';
    }
  };

  const isAgencyView = view === 'agencyDashboard';
  
  // Condição para mostrar a navegação persistente:
  // 1. Sempre para admins (seja no painel interno ou explorando cliente)
  // 2. Para clientes em módulos internos (fora do Dashboard/Onboarding inicial)
  const showClientNav = userRole === 'approver' && view !== 'dashboard' && view !== 'strategic-briefings';
  const showNav = userRole === 'admin' || showClientNav;

  return (
    <div className={`min-h-screen flex font-sans text-brand-dark bg-[#FDFDFD] relative overflow-x-hidden ${showNav ? (isNavCollapsed ? 'lg:pl-20' : 'lg:pl-72') : ''} transition-all duration-500 ease-[0.16,1,0.3,1]`}>
      {/* Background Decorations */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50/30 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-50/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[20%] right-[5%] w-[20%] h-[20%] bg-orange-50/20 rounded-full blur-[100px]"></div>
      </div>

      {showNav && (
        <Navigation 
          view={isAgencyView ? 'agency' : 'client'}
          activeClient={activeClient}
          activeTab={isAgencyView ? agencyTab : view}
          isCollapsed={isNavCollapsed}
          onCollapse={setIsNavCollapsed}
          onTabChange={(tab) => {
            if (isAgencyView) {
              setAgencyTab(tab);
            } else if (tab === 'agencyDashboard') {
              setActiveClient(null);
              setView('agencyDashboard');
              setAgencyTab('home');
            } else {
              setView(tab as ViewState);
            }
          }}
          onBackToSelector={() => {
            if (onGoToAgencyHome) {
              onGoToAgencyHome();
            }
          }}
          onSwitchClient={(client) => {
            setActiveClient(client);
            if (isAgencyView) {
              setView('dashboard');
            }
          }}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Fixo - Apenas para visões sem sidebar persistente ou para visualização do mapa editorial */}
        {((!showNav && view !== 'agencyDashboard' && view !== 'strategic-briefings') || view === 'month-detail') && (
          <header className={`bg-white/70 backdrop-blur-xl border-b border-black/[0.02] sticky top-0 ${showNav ? 'z-40' : 'z-50'} shadow-[0_1px_10px_rgba(0,0,0,0.02)]`}>
            {/* Linha Superior: Logo e Botões de Navegação - Ocultar se já houver sidebar lateral */}
            {!showNav && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20 sm:h-24">
                  {/* Área de Logos */}
                  <div className="flex items-center gap-4 sm:gap-10 overflow-hidden">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="cursor-pointer flex items-center gap-2 sm:gap-4 shrink-0"
                      onClick={() => setView('dashboard')}
                    >
                      {activeClient ? (
                        activeClient.logo_url ? (
                          <img src={activeClient.logo_url} alt={activeClient.name} className="h-10 sm:h-20 w-auto max-w-[100px] sm:max-w-[200px] object-contain mix-blend-multiply" />
                        ) : (
                          <span className="text-lg sm:text-3xl font-bold text-brand-dark tracking-tighter serif italic truncate max-w-[120px] sm:max-w-none">{activeClient.name}</span>
                        )
                      ) : (
                        <Logo size="medium" />
                      )}
                      {activeClient && (
                        <>
                          <div className="h-6 w-px bg-gray-100 hidden sm:block"></div>
                          <div className="flex items-center gap-1 sm:gap-2 opacity-40 hover:opacity-100 transition-opacity duration-500">
                            <span className="text-[5px] sm:text-[7px] uppercase tracking-[0.3em] text-gray-400 font-bold">Strategy by</span>
                            <div className="scale-75 sm:scale-100 origin-left">
                              <Logo size="small" />
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="hidden md:flex flex-col items-end mr-4">
                      <span className="text-[8px] uppercase tracking-[0.3em] text-gray-400 font-bold mb-0.5">Membro Premium</span>
                      <span className="text-[11px] font-bold text-brand-dark uppercase tracking-widest">{getRoleLabel()}</span>
                    </div>
                    {userRole === 'admin' && (
                      <button
                        onClick={onGoToAgencyHome}
                        className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] transition-all bg-gray-50/50 text-gray-500 hover:bg-gray-100 hover:text-brand-dark border border-black/[0.02]"
                        title="Menu Inicial"
                      >
                        <Home size={14} />
                        <span className="hidden sm:inline">Menu Inicial</span>
                      </button>
                    )}
                    {userRole === 'admin' && (
                      <button
                        onClick={() => setView('agencyDashboard')}
                        className={`flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                          view === 'agencyDashboard'
                            ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20'
                            : 'bg-gray-50/50 text-gray-500 hover:text-brand-dark hover:bg-gray-100 border border-black/[0.02]'
                        }`}
                        title="Painel Canguru"
                      >
                        <Shield size={14} />
                        <span className="hidden sm:inline">Painel Canguru</span>
                      </button>
                    )}
                    {userRole === 'admin' && (
                      <button
                        onClick={() => {
                          setActiveClient(null);
                          if (onGoToClientSelector) onGoToClientSelector();
                        }}
                        className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] transition-all bg-gray-50/50 text-gray-500 hover:bg-gray-100 hover:text-brand-dark border border-black/[0.02]"
                        title="Trocar Cliente"
                      >
                        <Building2 size={14} />
                        <span className="hidden sm:inline">Trocar Cliente</span>
                      </button>
                    )}
                    <button
                      onClick={logout}
                      className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-red-50/50 text-red-400 hover:bg-red-50 hover:text-red-600 transition-all active:scale-95 border border-red-100/20"
                      title="Sair"
                    >
                      <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Linha Inferior: Navegação dos Meses */}
            <AnimatePresence>
              {(view === 'month-detail') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-black/[0.02] bg-white/30 overflow-hidden"
                >
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                      {monthlyPlans.map((plan) => {
                        const monthName = MONTH_NAMES[plan.month - 1];
                        const isActive = selectedMonth === monthName;
                        const isLocked = userRole !== 'admin' && !plan.is_released;

                        return (
                          <button
                            key={plan.id}
                            onClick={() => !isLocked && handleSelectMonth(monthName)}
                            className={`
                              whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all border
                              ${isLocked 
                                ? 'bg-gray-50 border-transparent text-gray-300 cursor-not-allowed opacity-60' 
                                : isActive
                                  ? 'bg-brand-dark border-brand-dark text-white shadow-xl transform scale-105'
                                  : 'bg-white border-black/[0.03] text-gray-400 hover:border-brand-dark hover:text-brand-dark'
                              }
                            `}
                          >
                            {monthName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </header>
        )}

        {/* Main Content */}
        <main className={`flex-grow ${showNav ? 'pt-24 lg:pt-10 pb-10' : 'py-6 sm:py-10'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AnimatePresence mode="wait">
              {view === 'month-detail' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="mb-12 flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]"
                >
                  <span onClick={handleBackToHome} className="cursor-pointer hover:text-brand-dark transition-colors">Dashboard</span>
                  <ChevronRight size={12} className="opacity-30" />
                  <span className="text-brand-dark">{selectedMonth}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={view + (isAgencyView ? agencyTab : '')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {view === 'agencyDashboard' && userRole === 'admin' ? (
                  <AgencyDashboard 
                    activeTab={agencyTab as any}
                    onTabChange={(tab) => setAgencyTab(tab)}
                    onBack={() => {
                      if (onGoToAgencyHome) {
                        onGoToAgencyHome();
                      } else if (onExitAgencyDashboard) {
                        onExitAgencyDashboard();
                      } else {
                        setView('dashboard');
                      }
                    }}
                    onSelectClient={(client) => {
                      setActiveClient(client);
                      setView('dashboard');
                      if (onExitAgencyDashboard) {
                        onExitAgencyDashboard();
                      }
                    }} 
                  />
                ) : view === 'agencyDashboard' && userRole !== 'admin' ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <Shield size={48} className="text-red-400 mb-4" />
                    <h2 className="text-2xl font-bold text-brand-dark mb-2">Acesso Restrito</h2>
                    <p className="text-gray-500 mb-6">Você não tem permissão para acessar esta área.</p>
                    <button 
                      onClick={() => setView('dashboard')}
                      className="px-8 py-3 bg-brand-dark text-white rounded-2xl font-bold text-sm uppercase tracking-widest"
                    >
                      Voltar ao Dashboard
                    </button>
                  </div>
                ) : view === 'website' ? (
                  <WebsiteView onBack={() => setView('dashboard')} />
                ) : view === 'paid-traffic' ? (
                  <PaidTrafficView onBack={() => setView('dashboard')} />
                ) : view === 'crm' ? (
                  <ClientHome
                    initialActiveView="leads"
                    onNavigateToOnboarding={() => setView('onboarding')}
                    onNavigateToMapa={() => {
                      const currentMonthName = MONTH_NAMES[dayjs().month()];
                      setSelectedMonth(currentMonthName);
                      setView('month-detail');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onNavigateToBriefings={() => setView('briefings')}
                    onNavigateToStrategicBriefings={() => setView('strategic-briefings')}
                    onNavigateToDocuments={() => {}} // Redirection handled in ClientHome
                    onNavigateToPaidTraffic={() => setView('paid-traffic')}
                    onNavigateToWebsite={() => setView('website')}
                    onNavigateToPasswordVault={() => setView('password-vault')}
                    onNavigateToTutorials={() => setView('tutorials')}
                    onNavigateToAiPhotos={() => setView('ai-photos')}
                    onRefreshClient={refreshActiveClient}
                  />
                ) : view === 'briefings' ? (
                  <BriefingsView onBack={() => setView('dashboard')} />
                ) : view === 'tutorials' ? (
                  <div className="bg-white rounded-[2.5rem] border border-black/[0.03] shadow-sm min-h-[80vh] p-6 sm:p-10">
                    {!showNav && (
                      <div className="mb-8 border-b border-gray-100 pb-6 flex items-center gap-4">
                        <button 
                          onClick={() => setView('dashboard')}
                          className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-brand-dark"
                        >
                          <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>
                        <h2 className="text-xl font-bold text-brand-dark">Voltar ao Dashboard</h2>
                      </div>
                    )}
                    <TutorialCenter clientId={activeClient?.id || ''} userRole={userRole} />
                  </div>
                ) : view === 'password-vault' ? (
                  <div className="bg-white rounded-[2.5rem] border border-black/[0.03] shadow-sm min-h-[80vh] p-6 sm:p-10">
                    {!showNav && (
                      <div className="mb-8 border-b border-gray-100 pb-6 flex items-center gap-4">
                        <button 
                          onClick={() => setView('dashboard')}
                          className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-brand-dark"
                        >
                          <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>
                        <h2 className="text-xl font-bold text-brand-dark">Voltar ao Dashboard</h2>
                      </div>
                    )}
                    <PasswordVault clientId={activeClient?.id || ''} userRole={userRole} />
                  </div>
                ) : view === 'strategic-briefings' ? (
                  <div className="bg-white rounded-[2.5rem] border border-black/[0.03] shadow-sm min-h-[80vh]">
                    {!(userRole === 'approver' && !activeClient?.onboarding_completed) && (
                      <div className="p-6 border-b border-gray-100 flex items-center gap-4">
                        <button 
                          onClick={() => setView('dashboard')}
                          className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-brand-dark"
                        >
                          <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>
                        <h2 className="text-xl font-bold text-brand-dark">Voltar ao Dashboard</h2>
                      </div>
                    )}
                    <BriefingOnboarding />
                  </div>
                ) : view === 'ai-photos' ? (
                  <div className="bg-white rounded-[2.5rem] border border-black/[0.03] shadow-sm min-h-[80vh] p-6 sm:p-10">
                    {!showNav && (
                      <div className="mb-8 border-b border-gray-100 pb-6 flex items-center gap-4">
                        <button 
                          onClick={() => setView('dashboard')}
                          className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-brand-dark"
                        >
                          <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>
                        <h2 className="text-xl font-bold text-brand-dark">Voltar ao Dashboard</h2>
                      </div>
                    )}
                    <AiPhotosView />
                  </div>
                ) : view === 'dashboard' ? (
                  <ClientHome
                    onNavigateToOnboarding={() => setView('onboarding')}
                    onNavigateToMapa={() => {
                      const currentMonthName = MONTH_NAMES[dayjs().month()];
                      setSelectedMonth(currentMonthName);
                      setView('month-detail');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onNavigateToBriefings={() => setView('briefings')}
                    onNavigateToStrategicBriefings={() => setView('strategic-briefings')}
                    onNavigateToDocuments={() => {}} // Redirection handled in ClientHome
                    onNavigateToPaidTraffic={() => setView('paid-traffic')}
                    onNavigateToWebsite={() => setView('website')}
                    onNavigateToPasswordVault={() => setView('password-vault')}
                    onNavigateToTutorials={() => setView('tutorials')}
                    onNavigateToAiPhotos={() => setView('ai-photos')}
                    onRefreshClient={refreshActiveClient}
                  />
                ) : view === 'onboarding' ? (
                  <div className="bg-white rounded-[2.5rem] border border-black/[0.03] shadow-sm min-h-[80vh] p-6 sm:p-10">
                    {!showNav && (
                      <div className="mb-8 border-b border-gray-100 pb-6 flex items-center gap-4">
                        <button 
                          onClick={() => setView('dashboard')}
                          className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-brand-dark"
                        >
                          <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>
                        <h2 className="text-xl font-bold text-brand-dark">Voltar ao Dashboard</h2>
                      </div>
                    )}
                    {activeClient && <ClientChecklistView client={activeClient} onClose={() => setView('dashboard')} />}
                  </div>
                ) : view === 'home' ? (
                  <AnnualOverview onSelectMonth={handleSelectMonth} />
                ) : (
                  <MonthDetail monthName={selectedMonth || ''} onBack={handleBackToHome} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-100 mt-auto py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex flex-col sm:flex-row items-center gap-8 opacity-40 hover:opacity-100 transition-opacity duration-500">
              <Logo size="small" />
            </div>
            <div className="flex flex-col items-center md:items-end gap-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-[0.4em] font-bold text-center md:text-right">
                Painel do Cliente • Canguru Digital 2026
              </p>
              <p className="text-[9px] text-gray-300 uppercase tracking-widest font-medium text-center md:text-right">
                Planejamento Estratégico & Editorial • Confidencial
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, userRole, activeClient, logout, setActiveClient } = useAuth();
  const [showClientManager, setShowClientManager] = useState(false);
  const [showAgencyDashboard, setShowAgencyDashboard] = useState(false);
  // Default to agencyHome but we'll bypass it in the render if admin
  const [adminView, setAdminView] = useState<'agencyHome' | 'clientSelector'>('agencyHome');

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Se for admin e não tiver cliente selecionado, mostrar dashboard da agência por padrão
  if (userRole === 'admin' && !activeClient) {
    // Redireciona direto para o AgencyDashboard se não estiver em outras telas específicas
    if (showClientManager) {
      return (
        <ClientManager
          onBack={() => setShowClientManager(false)}
        />
      );
    }

    // Se adminView foi setado para clientSelector, mostramos o seletor
    if (adminView === 'clientSelector') {
      return (
        <ClientSelectorScreen
          onSelectClient={() => {}}
          onManageClients={() => setShowClientManager(true)}
          onLogout={() => {
            logout();
          }}
        />
      );
    }

    // Caso contrário, vai direto para o dashboard da agência
    return <MainApp 
      initialView="agencyDashboard"
      onExitAgencyDashboard={() => setShowAgencyDashboard(false)}
      onGoToAgencyHome={() => {
        setActiveClient(null);
        setAdminView('agencyHome');
        setShowAgencyDashboard(false);
      }}
      onGoToClientSelector={() => {
        setAdminView('clientSelector');
        setShowAgencyDashboard(false);
      }}
    />;
  }

  return <MainApp 
    initialView={showAgencyDashboard ? 'agencyDashboard' : undefined} 
    onExitAgencyDashboard={() => setShowAgencyDashboard(false)}
    onGoToAgencyHome={() => {
      setActiveClient(null);
      setAdminView('agencyHome');
      setShowAgencyDashboard(false);
    }}
    onGoToClientSelector={() => {
      setAdminView('clientSelector');
      setShowAgencyDashboard(false);
    }}
  />;
};

const App: React.FC = () => {
  const [isPublicMode, setIsPublicMode] = useState(false);
  const [contractToken, setContractToken] = useState<string | null>(null);
  const [themeToken, setThemeToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'public' && params.get('id')) {
      setIsPublicMode(true);
    }
    const pathname = window.location.pathname;
    const contractMatch = pathname.match(/^\/contrato\/([^/]+)\/?$/);
    if (contractMatch) {
      setContractToken(contractMatch[1]);
    }
  const themeMatch = pathname.match(/^\/temas\/([^/]+)\/?$/);
    if (themeMatch) {
      setThemeToken(themeMatch[1]);
    }
  }, []);

  if (contractToken) {
    return <ContractFormScreen formToken={contractToken} />;
  }

  if (themeToken) {
    return <ThemeApprovalPublic sessionToken={themeToken} />;
  }

  if (isPublicMode) {
    return <PublicApprovalScreen />;
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;

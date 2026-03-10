import React, { useState, useEffect } from 'react';
import { Logo } from './components/Logo';
import { AnnualOverview } from './components/AnnualOverview';
import { MonthDetail } from './components/MonthDetail';
import { LoginScreen } from './components/LoginScreen';
import { PublicApprovalScreen } from './components/PublicApprovalScreen';
import { ClientSelectorScreen } from './components/ClientSelectorScreen';
import { ClientManager } from './components/ClientManager';
import { OnboardingView } from './components/OnboardingView';
import { ClientHome } from './components/ClientHome';
import { BriefingsView } from './components/BriefingsView';
import { DocumentsView } from './components/DocumentsView';
import { PaidTrafficView } from './components/PaidTrafficView';
import WebsiteView from './components/WebsiteView';
import AdminView from './components/AdminView';
import { useEditorialData, MONTH_NAMES } from './hooks/useEditorialData';
import { Map, ChevronRight, LogOut, Home, Building2, ClipboardList, LayoutDashboard, FileText, FolderOpen, TrendingUp, Globe, Shield } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

type ViewState = 'home' | 'month-detail' | 'onboarding' | 'dashboard' | 'briefings' | 'documents' | 'paid-traffic' | 'website' | 'admin';

interface MainAppProps {}

const MainApp: React.FC<MainAppProps> = () => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const { userRole, logout, activeClient, setActiveClient, refreshActiveClient } = useAuth();
  const { monthlyPlans } = useEditorialData();

  // Redirecionar para onboarding se não estiver completo (apenas para clientes)
  useEffect(() => {
    if (userRole === 'approver' && activeClient && !activeClient.onboarding_completed && view !== 'onboarding') {
      setView('onboarding');
    }
  }, [userRole, activeClient, view]);

  const handleSelectMonth = (month: string) => {
    setSelectedMonth(month);
    setView('month-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHome = () => {
    setView('home');
    setSelectedMonth(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getRoleLabel = () => {
    switch(userRole) {
      case 'admin': return 'Canguru Digital';
      case 'approver': return activeClient?.responsible || 'Viviane (Diretora)';
      case 'team': return 'Equipe Canguru';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-brand-dark bg-[#FDFDFD] relative overflow-x-hidden">
      {/* Background Decorations */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50/30 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-50/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[20%] right-[5%] w-[20%] h-[20%] bg-orange-50/20 rounded-full blur-[100px]"></div>
      </div>

      {/* Header Fixo */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-black/[0.02] sticky top-0 z-50 shadow-[0_1px_10px_rgba(0,0,0,0.02)]">
        {/* Linha Superior: Logo e Botões de Navegação */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            {/* Área de Logos */}
            <div className="flex items-center gap-6 sm:gap-10">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer flex items-center gap-4"
                onClick={() => setView('dashboard')}
              >
                {activeClient?.logo_url ? (
                  <img src={activeClient.logo_url} alt={activeClient.name} className="h-20 w-auto object-contain mix-blend-multiply" />
                ) : (
                  <span className="text-3xl font-bold text-brand-dark tracking-tighter serif italic">{activeClient?.name}</span>
                )}
                <div className="h-6 w-px bg-gray-100 hidden sm:block"></div>
                <div className="flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity duration-500">
                  <span className="text-[7px] uppercase tracking-[0.3em] text-gray-400 font-bold hidden lg:block">Strategy by</span>
                  <Logo size="small" />
                </div>
              </motion.div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end mr-4">
                <span className="text-[8px] uppercase tracking-[0.3em] text-gray-400 font-bold mb-0.5">Membro Premium</span>
                <span className="text-[11px] font-bold text-brand-dark uppercase tracking-widest">{getRoleLabel()}</span>
              </div>
              {userRole === 'admin' && (
                <button
                  onClick={() => setActiveClient(null)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.15em] transition-all bg-gray-50/50 text-gray-500 hover:bg-gray-100 hover:text-brand-dark border border-black/[0.02]"
                  title="Trocar Cliente"
                >
                  <Building2 size={14} />
                  <span className="hidden sm:inline">Trocar Cliente</span>
                </button>
              )}
              {userRole === 'admin' && (
                <button
                  onClick={() => setView('admin')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                    view === 'admin'
                      ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20'
                      : 'bg-gray-50/50 text-gray-500 hover:text-brand-dark hover:bg-gray-100 border border-black/[0.02]'
                  }`}
                >
                  <Shield size={14} />
                  <span className="hidden sm:inline">Admin</span>
                </button>
              )}
              <button
                onClick={logout}
                className="p-3 rounded-2xl bg-red-50/50 text-red-400 hover:bg-red-50 hover:text-red-600 transition-all active:scale-95 border border-red-100/20"
                title="Sair"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Linha Inferior: Navegação dos Meses */}
        <AnimatePresence>
          {(view === 'home' || view === 'month-detail') && (
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
                    return (
                      <button
                        key={plan.id}
                        onClick={() => handleSelectMonth(monthName)}
                        className={`
                          whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all border
                          ${isActive
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

      {/* Main Content */}
      <main className="flex-grow py-6 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            {view === 'month-detail' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="mb-12 flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]"
              >
                <span onClick={handleBackToHome} className="cursor-pointer hover:text-brand-dark transition-colors">Mapa Anual</span>
                <ChevronRight size={12} className="opacity-30" />
                <span className="text-brand-dark">{selectedMonth}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {view === 'admin' ? (
                <AdminView />
              ) : view === 'website' ? (
                <WebsiteView />
              ) : view === 'paid-traffic' ? (
                <PaidTrafficView />
              ) : view === 'documents' ? (
                <DocumentsView />
              ) : view === 'briefings' ? (
                <BriefingsView />
              ) : view === 'dashboard' ? (
                <ClientHome
                  onNavigateToOnboarding={() => setView('onboarding')}
                  onNavigateToMapa={() => setView('home')}
                  onNavigateToBriefings={() => setView('briefings')}
                  onNavigateToDocuments={() => setView('documents')}
                  onNavigateToPaidTraffic={() => setView('paid-traffic')}
                  onNavigateToWebsite={() => setView('website')}
                  onRefreshClient={refreshActiveClient}
                />
              ) : view === 'onboarding' ? (
                <OnboardingView onComplete={() => {
                  refreshActiveClient();
                  setView('dashboard');
                }} />
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
              Bolsa • Canguru Digital 2026
            </p>
            <p className="text-[9px] text-gray-300 uppercase tracking-widest font-medium text-center md:text-right">
              Planejamento Estratégico & Editorial • Confidencial
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, userRole, activeClient, logout } = useAuth();
  const [showClientManager, setShowClientManager] = useState(false);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (userRole === 'admin' && !activeClient) {
    if (showClientManager) {
      return (
        <ClientManager
          onBack={() => setShowClientManager(false)}
        />
      );
    }
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

  return <MainApp />;
};

const App: React.FC = () => {
  const [isPublicMode, setIsPublicMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'public' && params.get('id')) {
      setIsPublicMode(true);
    }
  }, []);

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

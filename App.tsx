
import React, { useState, useEffect } from 'react';
import { Logo } from './components/Logo';
import { AgencyLogo } from './components/AgencyLogo';
import { AnnualOverview } from './components/AnnualOverview';
import { MonthDetail } from './components/MonthDetail';
import { LoginScreen } from './components/LoginScreen';
import { PublicApprovalScreen } from './components/PublicApprovalScreen';
import { LandingPage } from './components/LandingPage';
import { ClientSelectorScreen } from './components/ClientSelectorScreen';
import { OnboardingView } from './components/OnboardingView';
import { useEditorialData, MONTH_NAMES } from './hooks/useEditorialData';
import { Map, ChevronRight, LogOut, Home, Building2, ClipboardList } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/supabase';

type ViewState = 'home' | 'month-detail' | 'onboarding';

interface MainAppProps {
  onBack?: () => void;
}

const MainApp: React.FC<MainAppProps> = ({ onBack }) => {
  const [view, setView] = useState<ViewState>('home');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const { userRole, logout, activeClient, setActiveClient } = useAuth();
  const { monthlyPlans } = useEditorialData();

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
      case 'approver': return 'Viviane (Diretora)';
      case 'team': return 'Equipe Next';
      default: return '';
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-brand-dark bg-background-light">
      
      {/* Header Fixo */}
      <header className="bg-surface-light border-b border-gray-200 sticky top-0 z-50 shadow-sm bg-opacity-95 backdrop-blur-md">
        
        {/* Linha Superior: Logo e Botão Home */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Área de Logos */}
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="cursor-pointer" onClick={handleBackToHome}>
                <Logo size="small" />
              </div>
              
              {/* Separador vertical */}
              <div className="h-8 w-px bg-gray-200"></div>
              
              {/* Logo Canguru + Strategy by */}
              <div className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity" title="Agência Canguru Digital">
                <span className="hidden sm:block text-[10px] text-gray-400 font-medium uppercase tracking-wider">Strategy by</span>
                <AgencyLogo />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Logado como</span>
                <span className="text-xs font-bold text-blue-600">{getRoleLabel()}</span>
              </div>

              {userRole === 'admin' && (
                <button
                  onClick={() => setActiveClient(null)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                  title="Trocar Cliente"
                >
                  <Building2 size={14} />
                  <span className="hidden sm:inline">Trocar Cliente</span>
                </button>
              )}

              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200"
                  title="Voltar para Home"
                >
                  <Home size={14} />
                  <span className="hidden sm:inline">Início</span>
                </button>
              )}

              <button
                onClick={handleBackToHome}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                  view === 'home' 
                    ? 'bg-brand-dark text-white shadow-md' 
                    : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <Map size={14} />
                <span className="hidden sm:inline">Mapa</span>
              </button>

              <button
                onClick={() => setView('onboarding')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                  view === 'onboarding'
                    ? 'bg-brand-dark text-white shadow-md'
                    : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <ClipboardList size={14} />
                <span className="hidden sm:inline">Onboarding</span>
              </button>

              <button
                onClick={logout}
                className="p-2 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                title="Sair"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Linha Inferior: Navegação dos Meses (Scroll Horizontal) */}
        <div className="border-t border-gray-100 bg-white/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 sm:py-3 -mx-4 px-4 sm:mx-0 sm:px-0">
              {monthlyPlans.map((plan) => {
                const monthName = MONTH_NAMES[plan.month - 1];
                const isActive = selectedMonth === monthName;
                
                return (
                  <button
                    key={plan.id}
                    onClick={() => handleSelectMonth(monthName)}
                    className={`
                      whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border
                      ${isActive 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md transform scale-105' 
                        : 'bg-white border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'
                      }
                    `}
                  >
                    {monthName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Breadcrumb simples visual quando estiver no detalhe */}
          {view === 'month-detail' && (
             <div className="mb-6 flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-widest">
                <span onClick={handleBackToHome} className="cursor-pointer hover:text-brand-dark transition-colors">Mapa Anual</span>
                <ChevronRight size={12} />
                <span className="text-blue-600 font-bold">{selectedMonth}</span>
             </div>
          )}

          {view === 'onboarding' ? (
            <OnboardingView />
          ) : view === 'home' ? (
            <AnnualOverview onSelectMonth={handleSelectMonth} />
          ) : (
            <MonthDetail 
              monthName={selectedMonth || ''} 
              onBack={handleBackToHome} 
            />
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          
          {/* Logos Footer */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 opacity-70 hover:opacity-100 transition-opacity">
             <Logo size="small" />
             <span className="hidden sm:block text-gray-300 text-2xl font-light">|</span>
             <div className="flex items-center gap-3">
               <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Strategy by</span>
               <AgencyLogo />
             </div>
          </div>

          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium text-center md:text-right">
            Planejamento Editorial 2026 • Confidencial
          </p>
        </div>
      </footer>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, userRole, activeClient, logout } = useAuth();
  const [showLanding, setShowLanding] = useState(true);

  if (showLanding) {
    return <LandingPage onEnterEditorial={() => setShowLanding(false)} />;
  }

  if (!isAuthenticated) {
    return <LoginScreen onBack={() => setShowLanding(true)} />;
  }

  if (userRole === 'admin' && !activeClient) {
    return (
      <ClientSelectorScreen 
        onSelectClient={() => {}} 
        onManageClients={() => {}} 
        onLogout={() => {
          logout();
          setShowLanding(true);
        }} 
      />
    );
  }

  return <MainApp onBack={() => setShowLanding(true)} />;
}

const App: React.FC = () => {
  // Simple routing logic to check for Public Link
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

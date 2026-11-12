
import { GuiasTab } from './GuiasTab';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart2, 
  TrendingUp, 
  Users, 
  ChevronLeft, 
  LayoutDashboard,
  Shield,
  LogOut,
  Building2,
  DollarSign,
  Search,
  ClipboardList,
  Home,
  FileText,
  Target
} from 'lucide-react';
import { HomeTab } from './HomeTab';
import { FinanceiroTab } from './FinanceiroTab';
import { AgencyCRMTab } from './AgencyCRMTab';
import { AgencyTasksTab } from './AgencyTasksTab';
import { AgencyContractsTab } from './AgencyContractsTab';
import { PessoasTab } from './PessoasTab';
import { PropostasTab } from './PropostasTab';
import { OnboardingTab } from './OnboardingTab';
import { OnboardingPipeline } from './OnboardingPipeline';
import { ClientesTab } from './ClientesTab';
import { AnotacoesTab } from './AnotacoesTab';
import { PainelConteudo } from './PainelConteudo';
import { NossoConteudoTab } from './NossoConteudoTab';
import { MetasTab } from './MetasTab';
import { TeamTab } from './TeamTab';
import { Logo } from '../Logo';

import { useAuth } from '../../lib/supabase';

interface AgencyDashboardProps {
  onBack: () => void;
  onSelectClient: (client: any) => void;
  activeTab: Tab;
  onTabChange?: (tab: string) => void;
}

type Tab = 'guias' | 'pessoas' | 'propostas' | 'equipe' | 'home' | 'tasks' | 'financeiro' | 'metas' | 'prospeccao' | 'contratos' | 'onboarding' | 'clientes' | 'anotacoes' | 'masterMap' | 'painelConteudo' | 'nosso-conteudo' | 'nossoConteudo';

export const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ onBack, onSelectClient, activeTab, onTabChange }) => {
  const { userRole } = useAuth();
  const [contentPanelFilter, setContentPanelFilter] = useState<{
    aba?: 'dashboard' | 'publicacoes';
    status?: string;
    periodo?: string;
    date?: string;
  }>({});
  const [financeiroFilter, setFinanceiroFilter] = useState<{
    subTab?: 'overview' | 'faturamento' | 'despesas' | 'indicacao';
    monthYear?: string;
    clientId?: string;
    clientName?: string;
  }>({});

  if (userRole !== 'admin') {
    return null;
  }

  const handleNavigateToContentPanel = (filter?: { aba?: 'dashboard' | 'publicacoes'; status?: string; periodo?: string; date?: string }) => {
    if (filter) {
      setContentPanelFilter(filter);
    } else {
      setContentPanelFilter({});
    }
    onTabChange?.('masterMap');
  };

  const handleNavigateToFinanceiro = (filter?: {
    subTab?: 'overview' | 'faturamento' | 'despesas' | 'indicacao';
    monthYear?: string;
    clientId?: string;
    clientName?: string;
  }) => {
    if (filter) {
      setFinanceiroFilter(filter);
    } else {
      setFinanceiroFilter({ subTab: 'faturamento' });
    }
    onTabChange?.('financeiro');
  };

  return (
    <div className="bg-transparent flex flex-col font-sans text-brand-dark relative">
      {/* Main Content */}
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'home' && (
                <HomeTab 
                  onNavigateToClients={(client) => onSelectClient(client)} 
                  onNavigateToMasterMap={handleNavigateToContentPanel}
                  onNavigateToPainelConteudo={handleNavigateToContentPanel}
                  onNavigateToMetas={() => onTabChange?.('metas')}
                  onNavigateToTasks={() => onTabChange?.('tasks')}
                  onNavigateToCRM={() => onTabChange?.('prospeccao')}
                  onNavigateToFinanceiro={handleNavigateToFinanceiro}
                />
              )}
              {activeTab === 'metas' && <MetasTab />}
              {(activeTab === 'masterMap' || (activeTab as string) === 'painelConteudo') && (
                <PainelConteudo 
                  initialTab={contentPanelFilter.aba}
                  initialFilterStatus={contentPanelFilter.status}
                  initialFilterPeriod={contentPanelFilter.periodo}
                  initialFilterDate={contentPanelFilter.date}
                />
              )}
              {(activeTab === 'nosso-conteudo' || (activeTab as string) === 'nossoConteudo') && (
                <NossoConteudoTab />
              )}
              {activeTab === 'contratos' && <AgencyContractsTab />}
              {activeTab === 'propostas' && <PropostasTab />}
              {activeTab === 'equipe' && <TeamTab />}
              {activeTab === 'pessoas' && <PessoasTab />}
              {activeTab === 'onboarding' && <OnboardingArea onSelectClient={onSelectClient} />}
              {activeTab === 'tasks' && <AgencyTasksTab />}
              {activeTab === 'guias' && <GuiasTab />}
              {activeTab === 'financeiro' && (
                <FinanceiroTab 
                  initialSubTab={financeiroFilter.subTab}
                  initialMonthYear={financeiroFilter.monthYear}
                  initialClientFilter={financeiroFilter.clientName || financeiroFilter.clientId}
                  onNavigateToContracts={() => onTabChange?.('contratos')}
                  onNavigateToClient={(client) => onSelectClient(client)}
                />
              )}
              {activeTab === 'clientes' && <ClientesTab onBack={() => onTabChange?.('home')} />}
              {activeTab === 'anotacoes' && (
                <div className="h-[calc(100vh-8rem)] flex flex-col relative overflow-hidden">
                  <AnotacoesTab />
                </div>
              )}
              {activeTab === 'prospeccao' && (
                <div>
                  <AgencyCRMTab />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

const OnboardingArea: React.FC<{ onSelectClient: (c: any) => void }> = ({ onSelectClient }) => {
  const [sub, setSub] = React.useState<'novos' | 'jornada'>('novos');
  return (
    <div className="space-y-6">
      <div className="inline-flex p-1 rounded-xl bg-gray-100">
        {([['novos', 'Novos clientes'], ['jornada', 'Jornada completa']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${sub === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>{label}</button>
        ))}
      </div>
      {sub === 'novos' ? <OnboardingPipeline onOpenClient={onSelectClient} /> : <OnboardingTab onNavigateToClients={(client) => onSelectClient(client)} />}
    </div>
  );
};

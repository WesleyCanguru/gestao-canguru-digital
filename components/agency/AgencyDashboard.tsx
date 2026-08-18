
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
import { OnboardingTab } from './OnboardingTab';
import { ClientesTab } from './ClientesTab';
import { AnotacoesTab } from './AnotacoesTab';
import { PainelConteudo } from './PainelConteudo';
import { Logo } from '../Logo';

import { useAuth } from '../../lib/supabase';

interface AgencyDashboardProps {
  onBack: () => void;
  onSelectClient: (client: any) => void;
  activeTab: Tab;
  onTabChange?: (tab: string) => void;
}

type Tab = 'home' | 'tasks' | 'financeiro' | 'prospeccao' | 'contratos' | 'onboarding' | 'clientes' | 'anotacoes' | 'masterMap' | 'painelConteudo';

export const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ onBack, onSelectClient, activeTab, onTabChange }) => {
  const { userRole } = useAuth();
  const [contentPanelFilter, setContentPanelFilter] = useState<{
    aba?: 'dashboard' | 'publicacoes';
    status?: string;
    periodo?: string;
    date?: string;
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
                />
              )}
              {(activeTab === 'masterMap' || (activeTab as string) === 'painelConteudo') && (
                <PainelConteudo 
                  initialTab={contentPanelFilter.aba}
                  initialFilterStatus={contentPanelFilter.status}
                  initialFilterPeriod={contentPanelFilter.periodo}
                  initialFilterDate={contentPanelFilter.date}
                />
              )}
              {activeTab === 'contratos' && <AgencyContractsTab />}
              {activeTab === 'onboarding' && <OnboardingTab onNavigateToClients={(client) => onSelectClient(client)} />}
              {activeTab === 'tasks' && <AgencyTasksTab />}
              {activeTab === 'financeiro' && <FinanceiroTab />}
              {activeTab === 'clientes' && <ClientesTab onBack={() => onTabChange?.('home')} />}
              {activeTab === 'anotacoes' && (
                <div className="h-[calc(100vh-8rem)] flex flex-col relative overflow-hidden">
                  <AnotacoesTab />
                </div>
              )}
              {activeTab === 'prospeccao' && (
                <div className="h-[calc(100vh-8rem)] flex flex-col">
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

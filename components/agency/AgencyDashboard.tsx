
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
  ClipboardList
} from 'lucide-react';
import { FinanceiroTab } from './FinanceiroTab';
import { ProspeccaoTab } from './ProspeccaoTab';
import { ClientesTab } from './ClientesTab';
import { AgencyTasksTab } from './AgencyTasksTab';
import { Logo } from '../Logo';

import { useAuth } from '../../lib/supabase';

interface AgencyDashboardProps {
  onBack: () => void;
  onSelectClient: (client: any) => void;
}

type Tab = 'tasks' | 'financeiro' | 'prospeccao' | 'clientes';

export const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ onBack, onSelectClient }) => {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('tasks');

  if (userRole !== 'admin') {
    return null;
  }

  const tabs = [
    { id: 'tasks', label: 'Processos', icon: ClipboardList },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'prospeccao', label: 'Prospecção', icon: Search },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans text-brand-dark relative overflow-x-hidden">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-black/[0.02] sticky top-0 z-50 shadow-[0_1px_10px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20 sm:h-24">
            <div className="flex items-center gap-4">
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  onBack();
                }}
                className="p-3 rounded-2xl bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-brand-dark transition-all border border-black/[0.02]"
                title="Voltar"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold">Painel Interno</span>
                <span className="text-sm font-bold text-brand-dark uppercase tracking-widest">Canguru Digital</span>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`
                      flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] transition-all border
                      ${isActive
                        ? 'bg-brand-dark border-brand-dark text-white shadow-xl transform scale-105'
                        : 'bg-white border-black/[0.03] text-gray-400 hover:border-brand-dark hover:text-brand-dark'
                      }
                    `}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'tasks' && <AgencyTasksTab />}
              {activeTab === 'financeiro' && <FinanceiroTab />}
              {activeTab === 'prospeccao' && <ProspeccaoTab />}
              {activeTab === 'clientes' && <ClientesTab onSelectClient={onSelectClient} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

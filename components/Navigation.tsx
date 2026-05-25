
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  ClipboardList, 
  Search, 
  DollarSign, 
  Target, 
  FileText, 
  ChevronLeft, 
  Menu, 
  X, 
  Shield, 
  Users, 
  LayoutDashboard,
  Calendar,
  Globe,
  Kanban,
  Zap,
  TrendingUp,
  FolderOpen,
  ShieldCheck,
  BookOpen,
  Camera,
  ChevronDown,
  LogOut,
  Building2,
  CheckCircle2,
  Clock,
  Sparkles,
  PlayCircle,
  BarChart3
} from 'lucide-react';
import { useAuth, supabase } from '../lib/supabase';
import { Logo } from './Logo';
import { Client } from '../types';

interface SidebarProps {
  view: 'agency' | 'client';
  activeClient?: Client | null;
  activeTab?: string;
  isCollapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  onTabChange: (tab: string) => void;
  onBackToSelector: () => void;
  onSwitchClient?: (client: Client) => void;
}

export const Navigation: React.FC<SidebarProps> = ({ 
  view, 
  activeClient, 
  activeTab, 
  isCollapsed,
  onCollapse,
  onTabChange, 
  onBackToSelector,
  onSwitchClient 
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const { userRole, logout, agencyId, agencyName } = useAuth();

  useEffect(() => {
    if (userRole === 'admin' && agencyId) {
      fetchClients();
    }
  }, [userRole, agencyId]);

  const fetchClients = async () => {
    if (!agencyId) return;
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .order('name');
    if (data) setAvailableClients(data);
  };

  const agencyItems = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'tasks', label: 'Processos & Tarefas', icon: ClipboardList },
    { id: 'prospeccao', label: 'CRM / Prospecção', icon: Kanban },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'onboarding', label: 'Onboarding', icon: Target },
    { id: 'contratos', label: 'Contratos', icon: FileText },
    { id: 'clientes', label: 'Clientes', icon: Users },
  ];

  const getClientItems = () => {
    if (!activeClient) return [];
    
    const services = activeClient.services || [];
    const hasService = (s: string) => services.length === 0 || services.includes(s);
    const getFeature = (feature: string, defaultVal: boolean) => activeClient.features_settings?.[feature] ?? defaultVal;

    const allModules = [
      { id: 'dashboard', label: 'Início', icon: Home, featureKey: null, defaultVisible: true },
      { id: 'month-detail', label: 'Mapa Editorial', icon: Calendar, featureKey: 'mapa', defaultVisible: hasService('Social Media') },
      { id: 'themes', label: 'Banco de Temas', icon: Sparkles, featureKey: 'mapa', defaultVisible: hasService('Social Media') },
      { id: 'strategic-briefings', label: 'Briefings', icon: Target, featureKey: 'briefings', defaultVisible: hasService('Social Media') || hasService('Tráfego Pago') },
      { id: 'paid-traffic', label: 'Tráfego Pago', icon: Zap, featureKey: 'reportei_paid', defaultVisible: hasService('Tráfego Pago') },
      { id: 'reportei_paid', label: 'Dashboard Pago', icon: BarChart3, featureKey: 'reportei_paid', defaultVisible: hasService('Tráfego Pago') },
      { id: 'reportei_organic', label: 'Dashboard Orgânico', icon: TrendingUp, featureKey: 'reportei_organic', defaultVisible: hasService('Social Media') },
      { id: 'website', label: 'Website', icon: Globe, featureKey: 'website', defaultVisible: hasService('Tráfego Pago') },
      { id: 'ai-photos', label: 'Fotos IA', icon: Camera, featureKey: 'ai_photos', defaultVisible: hasService('Fotos com IA') },
      { id: 'password-vault', label: 'Senhas', icon: ShieldCheck, featureKey: null, defaultVisible: true },
      { id: 'drive', label: 'Documentos', icon: FolderOpen, featureKey: 'drive', defaultVisible: true },
      { id: 'tutorials', label: 'Tutoriais', icon: BookOpen, featureKey: 'tutorials', defaultVisible: true }
    ];

    if (activeClient?.is_lead_tracking_enabled || userRole === 'admin') {
      const isLeadEnabled = activeClient?.is_lead_tracking_enabled ?? false;
      allModules.push({ id: 'crm', label: 'CRM / Leads', icon: Users, featureKey: 'crm', defaultVisible: isLeadEnabled });
    }

    // Aplicar ordem personalizada se existir
    const menuOrder = activeClient.features_settings?.menu_order;
    if (menuOrder && Array.isArray(menuOrder)) {
      allModules.sort((a, b) => {
        let indexA = menuOrder.indexOf(a.id);
        let indexB = menuOrder.indexOf(b.id);
        // Novos módulos (não na lista salva) vão para o final
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        return indexA - indexB;
      });
    } else if (allModules.some(m => m.id === 'crm')) {
      // Ordem padrão: CRM em segundo se não houver ordem personalizada
      const crmIndex = allModules.findIndex(m => m.id === 'crm');
      const [crmModule] = allModules.splice(crmIndex, 1);
      allModules.splice(1, 0, crmModule);
    }

    const mapped = allModules.filter(item => {
      if (userRole === 'admin') return true;
      if (!item.featureKey) return item.defaultVisible;
      return getFeature(item.featureKey, item.defaultVisible);
    }).map(item => {
      const isHiddenForClient = item.featureKey && !getFeature(item.featureKey, item.defaultVisible);
      // CRM is special: if is_lead_tracking_enabled is true, it shouldn't show as Hidden for Admin even if feature is explicitly off
      const forceShowAsActive = item.id === 'crm' && activeClient?.is_lead_tracking_enabled;
      const shouldShowHiddenTag = userRole === 'admin' && isHiddenForClient && !forceShowAsActive;
      
      return {
        ...item,
        label: shouldShowHiddenTag ? `${item.label} (Oculto)` : item.label,
        isInactive: isHiddenForClient && !forceShowAsActive
      };
    });

    if (userRole === 'admin') {
      // Reordenar: ativos primeiro, inativos por último
      const active = mapped.filter(i => !i.isInactive);
      const inactive = mapped.filter(i => i.isInactive);
      return [...active, ...inactive];
    }

    return mapped;
  };

  const navItems = view === 'agency' ? agencyItems : getClientItems();

  const handleMobileTabChange = (id: string) => {
    onTabChange(id);
    setIsMobileOpen(false);
  };

  const SidebarContent = (
    <div className="flex flex-col h-full flex-1 overflow-hidden py-6">
      {/* Header */}
      <div className={`px-6 mb-8 flex items-center justify-between ${isCollapsed ? 'flex-col gap-4' : ''}`}>
        {!isCollapsed && (
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold whitespace-nowrap">
              {view === 'agency' ? 'Painel Interno' : userRole === 'admin' ? 'Explorando Cliente' : 'Painel do Cliente'}
            </span>
            <span className="text-sm font-bold text-brand-dark uppercase tracking-widest whitespace-nowrap">
              {agencyName || 'Canguru Digital'}
            </span>
          </div>
        )}
        {userRole === 'admin' && (
          <button 
            onClick={() => onCollapse(!isCollapsed)}
            className="p-2 rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-100 transition-all border border-black/[0.02]"
          >
            <ChevronLeft size={16} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Client Switcher (For Admins) */}
      {userRole === 'admin' && !isCollapsed && (
        <div className="px-4 mb-6">
          <div className="relative">
            <button 
              onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100 hover:border-brand-dark/20 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-dark/5 flex items-center justify-center text-brand-dark font-bold text-xs">
                {activeClient ? activeClient.initials : <Building2 size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
                  {view === 'agency' ? 'Ambiente Interno' : 'Cliente Ativo'}
                </p>
                <p className="text-xs font-bold text-brand-dark truncate">
                  {view === 'agency' ? 'Agência' : (activeClient ? activeClient.name : 'Selecionar Cliente')}
                </p>
              </div>
              <ChevronDown size={14} className={`text-gray-300 group-hover:text-brand-dark transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isClientDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 max-h-[300px] overflow-y-auto"
                >
                  {availableClients.map(client => (
                    <button
                      key={client.id}
                      onClick={() => {
                        onSwitchClient?.(client);
                        setIsClientDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 hover:bg-gray-50 flex items-center gap-3 transition-colors text-left"
                    >
                      <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-brand-dark font-bold text-[10px]" style={{ backgroundColor: `${client.color}20`, color: client.color }}>
                        {client.initials}
                      </div>
                      <span className="text-xs font-bold text-gray-700 truncate">{client.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleMobileTabChange(item.id)}
              className={`
                w-full flex items-center gap-3 p-3 rounded-2xl transition-all group relative
                ${isActive 
                  ? 'bg-brand-dark text-white shadow-lg shadow-brand-dark/20' 
                  : (item as any).isInactive
                    ? 'text-gray-300 hover:bg-gray-50/50 hover:text-gray-400 opacity-60 scale-95'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-brand-dark'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={isCollapsed ? 20 : 18} className={isActive ? '' : 'group-hover:scale-110 transition-transform'} />
              {!isCollapsed && (
                <span className="text-[11px] font-bold uppercase tracking-widest">
                  {item.label}
                </span>
              )}
              {isActive && !isCollapsed && (
                <motion.div 
                  layoutId="indicator"
                  className="absolute left-0 w-1 h-4 bg-white/40 rounded-full"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Items */}
      <div className="px-4 mt-auto pt-6 space-y-2">
        {userRole === 'admin' ? (
          <button
            onClick={() => {
              if (view === 'client') {
                onTabChange('agencyDashboard');
              } else {
                onBackToSelector();
              }
            }}
            className={`
              w-full flex items-center gap-3 p-3 rounded-2xl transition-all
              ${view === 'agency' 
                ? 'bg-gray-100 text-brand-dark' 
                : 'text-gray-400 hover:bg-gray-100 hover:text-brand-dark'}
              ${isCollapsed ? 'justify-center' : ''}
            `}
            title={agencyName ? `Painel ${agencyName.split(' ')[0]}` : "Painel Agência"}
          >
            <Shield size={18} />
            {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-widest">{agencyName ? `Painel ${agencyName.split(' ')[0]}` : "Painel Agência"}</span>}
          </button>
        ) : (
          <button
            onClick={onBackToSelector}
            className={`
              w-full flex items-center gap-3 p-3 rounded-2xl text-gray-400 hover:bg-gray-100 hover:text-brand-dark transition-all
              ${isCollapsed ? 'justify-center' : ''}
            `}
            title="Sair do Módulo"
          >
            <Building2 size={18} />
            {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-widest">Início</span>}
          </button>
        )}
        <button
          onClick={logout}
          className={`
            w-full flex items-center gap-3 p-3 rounded-2xl text-red-400 hover:bg-red-50 transition-all
            ${isCollapsed ? 'justify-center' : ''}
          `}
          title="Sair"
        >
          <LogOut size={18} />
          {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-widest">Sair</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/70 backdrop-blur-xl border-b border-black/[0.02] z-[60] flex items-center justify-between px-6">
        <Logo size="small" />
        <button 
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-xl bg-brand-dark text-white shadow-lg shadow-brand-dark/20"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] lg:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-[80] shadow-2xl lg:hidden"
            >
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between shrink-0">
                  <Logo size="small" />
                  <button onClick={() => setIsMobileOpen(false)} className="p-2 text-gray-400">
                    <X size={24} />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  {SidebarContent}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside 
        className={`
          hidden lg:block fixed left-0 top-0 bottom-0 bg-white border-r border-gray-100 z-[50] transition-all duration-500 ease-[0.16,1,0.3,1]
          ${isCollapsed ? 'w-20' : 'w-72'}
        `}
      >
        {SidebarContent}
      </aside>
    </>
  );
};

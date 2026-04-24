import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Settings, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  BarChart3,
  Clock,
  Building2,
  ListTodo,
  Plus,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'motion/react';
import { Client, AgencyTask, AgencyCRM, AgencyLead } from '../../types';
import { ClientesTab } from './ClientesTab';

interface FinancialData {
  receitas: number;
  despesas: number;
  saldo: number;
}

interface CRMOverview {
  board: AgencyCRM;
  totalActive: number;
  topStages: { name: string; count: number }[];
}

export const HomeTab: React.FC<{ onNavigateToClients: (client: Client) => void }> = ({ onNavigateToClients }) => {
  const [loading, setLoading] = useState(true);
  const [financial, setFinancial] = useState<FinancialData>({ receitas: 0, despesas: 0, saldo: 0 });
  const [urgentTasks, setUrgentTasks] = useState<AgencyTask[]>([]);
  const [crmOverviews, setCrmOverviews] = useState<CRMOverview[]>([]);
  const [reporteiDashboards, setReporteiDashboards] = useState<{ id: string; name: string; url: string }[]>([]);
  const [reporteiEnabled, setReporteiEnabled] = useState(false);
  const [showSettingsURL, setShowSettingsURL] = useState(false);
  const [tempReporteiEnabled, setTempReporteiEnabled] = useState(false);
  const [tempDashboards, setTempDashboards] = useState<{ id: string; name: string; url: string }[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showFinancials, setShowFinancials] = useState(() => {
    const stored = localStorage.getItem('canguru_show_financials');
    return stored ? JSON.parse(stored) : true;
  });

  const toggleFinancials = () => {
    setShowFinancials((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('canguru_show_financials', JSON.stringify(next));
      return next;
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const currentMonthYear = dayjs().format('YYYY-MM');

      const [
        { data: tempRevenue }, 
        { data: tempExpenses },
        { data: tempTasks },
        { data: tempCrms },
        { data: tempLeads },
        { data: tempSettings }
      ] = await Promise.all([
        supabase.from('agency_billing')
          .select('total_value')
          .eq('status', 'paid')
          .eq('month_year', currentMonthYear),
        supabase.from('agency_expenses')
          .select('amount')
          .eq('month_year', currentMonthYear),
        supabase.from('agency_tasks')
          .select('*, client:client_id(id, name, color, initials)')
          .neq('status', 'completed')
          .order('due_date', { ascending: false }),
        supabase.from('agency_crms')
          .select('*')
          .order('position', { ascending: true }),
        supabase.from('agency_leads')
          .select('*')
          .neq('stage', 'Perdido'),
        supabase.from('agency_settings')
          .select('*')
          .in('key', ['home_reportei_dashboards', 'home_reportei_enabled'])
      ]);

      // Calculate Finances
      let totalReceitas = 0;
      let totalDespesas = 0;
      
      if (tempRevenue) {
        totalReceitas = tempRevenue.reduce((sum, r) => sum + (Number(r.total_value) || 0), 0);
      }
      if (tempExpenses) {
        totalDespesas = tempExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      }
      
      setFinancial({
        receitas: totalReceitas,
        despesas: totalDespesas,
        saldo: totalReceitas - totalDespesas
      });

      // Urgent Tasks (Due <= 3 days OR priority = 'high')
      const pTasks = (tempTasks || []) as any[]; // casting since we have relational client
      const filteredTasks = pTasks.filter(t => {
        if (t.priority === 'high') return true;
        if (!t.due_date) return false;
        return dayjs(t.due_date).isBefore(dayjs().add(3, 'day'), 'day') || dayjs(t.due_date).isSame(dayjs().add(3, 'day'), 'day');
      });
      // Sort to have the closest due_dates first
      filteredTasks.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf();
      });
      
      setUrgentTasks(filteredTasks.slice(0, 5));

      // CRM Overview
      const leads = tempLeads || [];
      const crms = tempCrms as AgencyCRM[] || [];
      
      const crmOvs = crms.map(board => {
        const boardLeads = leads.filter(l => l.crm_id === board.id);
        
        // Count by stage
        const counts: Record<string, number> = {};
        boardLeads.forEach(l => {
          counts[l.stage] = (counts[l.stage] || 0) + 1;
        });
        
        const topStages = Object.keys(counts)
          .map(stageName => ({ name: stageName, count: counts[stageName] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
          
        return {
          board,
          totalActive: boardLeads.length,
          topStages
        };
      });
      
      setCrmOverviews(crmOvs);

      // Reportei Settings
      const settingsMap: Record<string, string> = {};
      if (tempSettings) {
        tempSettings.forEach(s => {
          settingsMap[s.key] = s.value;
        });
      }
      const isRepEnabled = settingsMap['home_reportei_enabled'] === 'true';
      
      let parsedDashboards: { id: string; name: string; url: string }[] = [];
      try {
        if (settingsMap['home_reportei_dashboards']) {
          parsedDashboards = JSON.parse(settingsMap['home_reportei_dashboards']);
        }
      } catch (e) {
        console.error('Error parsing reportei dashboards JSON', e);
      }
      
      setReporteiEnabled(isRepEnabled);
      setReporteiDashboards(parsedDashboards);
      setTempReporteiEnabled(isRepEnabled);
      setTempDashboards(parsedDashboards);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('home_tab_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_tasks' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_crms' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_leads' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_billing' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_expenses' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddDashboard = () => {
    setTempDashboards(prev => [...prev, { id: Date.now().toString() + Math.random().toString(36).slice(2), name: '', url: '' }]);
  };

  const handleUpdateDashboard = (id: string, field: 'name' | 'url', value: string) => {
    setTempDashboards(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const handleRemoveDashboard = (id: string) => {
    setTempDashboards(prev => prev.filter(d => d.id !== id));
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const updates = [
        { key: 'home_reportei_dashboards', value: JSON.stringify(tempDashboards) },
        { key: 'home_reportei_enabled', value: tempReporteiEnabled ? 'true' : 'false' }
      ];
      
      for (const update of updates) {
        const { error } = await supabase.from('agency_settings').upsert({
          key: update.key,
          value: update.value
        }, { onConflict: 'key' });
        
        if (error) {
          console.error('Supabase Upsert Error:', error);
          alert('Erro ao salvar configuração (' + update.key + '): ' + error.message);
          setIsSavingSettings(false);
          return;
        }
      }
      
      setReporteiDashboards(tempDashboards);
      setReporteiEnabled(tempReporteiEnabled);
      setShowSettingsURL(false);
    } catch(err: any) {
      console.error(err);
      alert('Houve um erro inesperado: ' + err?.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-3xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-white rounded-3xl animate-pulse" />
          <div className="h-64 bg-white rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            Dashboard <span className="px-3 py-1 bg-brand-dark text-white rounded-full text-xs font-bold uppercase tracking-widest leading-none align-middle">Beta</span>
          </h2>
          <p className="text-gray-500 text-sm mt-1">Resumo da operação da agência</p>
        </div>
        <button
          onClick={toggleFinancials}
          className="p-3 bg-white rounded-2xl border border-black/[0.03] shadow-sm text-gray-400 hover:text-brand-dark transition-colors"
          title={showFinancials ? 'Ocultar valores financeiros' : 'Mostrar valores financeiros'}
        >
          {showFinancials ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>

      {/* BLOCO 1 - FINANCEIRO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-black/[0.03] shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Receitas do Mês</p>
              <h3 className="text-xl font-bold text-brand-dark">
                {showFinancials ? formatCurrency(financial.receitas) : 'R$ ••••••••'}
              </h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-black/[0.03] shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <TrendingDown size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Despesas do Mês</p>
              <h3 className="text-xl font-bold text-brand-dark">
                {showFinancials ? formatCurrency(financial.despesas) : 'R$ ••••••••'}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-black/[0.03] shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${financial.saldo >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Saldo do Mês</p>
              <h3 className={`text-xl font-bold ${!showFinancials ? 'text-brand-dark' : financial.saldo >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {showFinancials ? formatCurrency(financial.saldo) : 'R$ ••••••••'}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* BLOCO 2 - CLIENTES ATIVOS (agora usa o componente completo) */}
      <ClientesTab onSelectClient={onNavigateToClients} />

      {/* BLOCO 3 e 4 - TAREFAS URGENTES e VISÃO DO CRM */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* BLOCO 3 - TAREFAS URGENTES */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-black/[0.03] shadow-sm flex flex-col gap-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ListTodo className="text-gray-400" size={20}/> Tarefas Urgentes
            </h3>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full">Prox 3 dias / Alta</span>
          </div>

          <div className="flex flex-col gap-3">
            {urgentTasks.map(task => {
              const isOverdue = task.due_date && dayjs(task.due_date).isBefore(dayjs(), 'day');
              return (
                <div key={task.id} className="p-4 rounded-2xl border border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                    <p className="text-sm font-bold truncate">{task.title}</p>
                    {task.client?.name && (
                      <p className="text-[10px] text-gray-500 truncate">{task.client.name}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {task.due_date && (
                      <div className={`flex items-center gap-1 text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                        <Calendar size={12} />
                        {dayjs(task.due_date).format('DD/MM/YY')}
                      </div>
                    )}
                    {task.priority === 'high' && (
                      <span className="text-[9px] uppercase tracking-widest bg-red-100 text-red-600 px-2 rounded font-bold">ALTA</span>
                    )}
                  </div>
                </div>
              );
            })}
            {urgentTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                <CheckCircle2 size={32} className="opacity-20 mb-2"/>
                <p className="text-sm font-medium">Tudo sob controle!</p>
              </div>
            )}
          </div>
        </div>

        {/* BLOCO 4 - VISÃO DO CRM */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-black/[0.03] shadow-sm flex flex-col gap-6 xl:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="text-gray-400" size={20}/> Funis do CRM
            </h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {crmOverviews.map(crm => (
            <div key={crm.board.id} className="p-5 rounded-2xl border border-gray-100 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <h4 className="font-bold">{crm.board.name}</h4>
                <span className="text-xs bg-brand-dark/5 text-brand-dark font-bold px-2 py-1 rounded-full">
                  {crm.totalActive} leads ativos
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {crm.topStages.length > 0 ? crm.topStages.map((stage, i) => (
                  <div key={i} className="flex justify-between items-center text-xs text-gray-600 border-b border-gray-50 pb-1 last:border-0 last:pb-0">
                    <span className="truncate pr-2">{stage.name}</span>
                    <span className="font-bold opacity-50">{stage.count}</span>
                  </div>
                )) : (
                  <p className="text-xs text-gray-400">Nenhum lead neste funil.</p>
                )}
              </div>
            </div>
          ))}
          {crmOverviews.length === 0 && (
            <p className="text-sm text-gray-400">Nenhum painel de CRM configurado.</p>
          )}
        </div>
      </div>
      </div>

      {/* BLOCO 5 - REPORTEI */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-black/[0.03] shadow-sm flex flex-col gap-6 relative overflow-hidden">
        <div className="flex items-center justify-between z-10">
          <h3 className="text-lg font-bold flex items-center gap-2">
            📊 Reportei Dashboard
          </h3>
          <button 
            onClick={() => setShowSettingsURL(!showSettingsURL)}
            className="p-2 rounded-xl bg-gray-50 text-gray-400 hover:text-brand-dark hover:bg-gray-100 transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>

        <AnimatePresence>
          {showSettingsURL && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-gray-50 p-5 rounded-2xl border border-gray-100 overflow-hidden"
            >
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Status do Reportei</label>
                    <p className="text-[10px] text-gray-400">Ativar exibição de dashboards na home</p>
                  </div>
                  <button 
                    onClick={() => setTempReporteiEnabled(!tempReporteiEnabled)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors ${tempReporteiEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${tempReporteiEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Dashboards Configurados</label>
                    <button 
                      onClick={handleAddDashboard}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-brand-dark hover:border-brand-dark transition-colors"
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                  
                  {tempDashboards.length === 0 && (
                    <div className="text-center py-4 bg-white border border-gray-100 rounded-xl text-xs text-gray-400">
                      Nenhum dashboard configurado. Clique em Adicionar.
                    </div>
                  )}

                  {tempDashboards.map((dash, index) => (
                    <div key={dash.id} className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border border-gray-200 relative group">
                      <div className="flex-1 w-full sm:w-1/3">
                         <input 
                          type="text"
                          value={dash.name}
                          onChange={e => handleUpdateDashboard(dash.id, 'name', e.target.value)}
                          placeholder="Nome do Cliente/Projeto"
                          className="w-full bg-gray-50 border-none px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-dark"
                        />
                      </div>
                      <div className="flex-[2] w-full sm:w-2/3 flex items-center gap-2">
                        <input 
                          type="url"
                          value={dash.url}
                          onChange={e => handleUpdateDashboard(dash.id, 'url', e.target.value)}
                          placeholder="https://app.reportei.com/dashboards/..."
                          className="w-full bg-gray-50 border-none px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-dark"
                        />
                        <button 
                          onClick={() => handleRemoveDashboard(dash.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                          title="Remover Dashboard"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-200">
                  <button 
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="px-6 py-2 bg-brand-dark text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:shadow-lg disabled:opacity-50 transition-all"
                  >
                    {isSavingSettings ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full relative">
          {!reporteiEnabled ? (
            <div className="w-full bg-gray-50 rounded-2xl min-h-[300px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <AlertCircle size={40} className="opacity-20" />
                <p className="font-medium text-sm">Dashboards do Reportei desativados.</p>
                <button 
                  onClick={() => setShowSettingsURL(true)}
                  className="text-xs font-bold uppercase tracking-widest text-brand-dark mt-2 hover:underline"
                >
                  Configurar
                </button>
              </div>
            </div>
          ) : reporteiDashboards.length === 0 ? (
            <div className="w-full bg-gray-50 rounded-2xl min-h-[300px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <AlertCircle size={40} className="opacity-20" />
                <p className="font-medium text-sm">Nenhum dashboard cadastrado.</p>
                <button 
                  onClick={() => setShowSettingsURL(true)}
                  className="text-xs font-bold uppercase tracking-widest text-brand-dark mt-2 hover:underline"
                >
                  Adicionar Dashboards
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {reporteiDashboards.map(dash => (
                <div key={dash.id} className="flex flex-col gap-2">
                  {dash.name && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-brand-dark opacity-50" />
                      <h4 className="text-sm font-bold text-gray-700">{dash.name}</h4>
                    </div>
                  )}
                  <div className="w-full h-[700px] overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
                    <iframe
                      src={dash.url}
                      frameBorder="0"
                      allowFullScreen
                      style={{
                        width: '111.11%',
                        height: '777.77px',
                        transform: 'scale(0.9)',
                        transformOrigin: '0 0'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

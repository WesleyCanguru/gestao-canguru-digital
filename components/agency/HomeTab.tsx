import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  CheckCircle2, 
  BarChart3,
  Clock,
  Building2,
  ListTodo,
  Eye,
  EyeOff,
  Briefcase
} from 'lucide-react';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'motion/react';
import { Client, AgencyTask, AgencyCRM, AgencyLead } from '../../types';
import { ActiveClientsSummary } from './ActiveClientsSummary';
import { Logo } from '../Logo';
import { AgencyLogo } from '../AgencyLogo';

interface FinancialData {
  receitas: number;
  despesas: number;
  saldo: number;
  ticketMedio: number;
  faturamentoAcumulado: number;
}

interface CRMOverview {
  board: AgencyCRM;
  totalActive: number;
  topStages: { name: string; count: number }[];
}

export const HomeTab: React.FC<{ onNavigateToClients: (client: Client) => void }> = ({ onNavigateToClients }) => {
  const { agencyId, agencyName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [financial, setFinancial] = useState<FinancialData>({ 
    receitas: 0, 
    despesas: 0, 
    saldo: 0,
    ticketMedio: 0,
    faturamentoAcumulado: 0
  });
  const [urgentTasks, setUrgentTasks] = useState<AgencyTask[]>([]);
  const [crmOverviews, setCrmOverviews] = useState<CRMOverview[]>([]);
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
    if (!agencyId) return;
    try {
      setLoading(true);
      const currentMonthYear = dayjs().format('YYYY-MM');

      const [
        { data: tempRevenue }, 
        { data: tempExpenses },
        { data: tempTasks },
        { data: tempCrms },
        { data: tempLeads },
        { data: tempClients }
      ] = await Promise.all([
        supabase.from('agency_billing')
          .select('total_value')
          .eq('agency_id', agencyId)
          .eq('status', 'paid')
          .eq('month_year', currentMonthYear),
        supabase.from('agency_expenses')
          .select('amount')
          .eq('agency_id', agencyId)
          .eq('month_year', currentMonthYear)
          .not('is_deleted', 'is', true),
        supabase.from('agency_tasks')
          .select('*, client:clients(id, name, color, initials)')
          .eq('agency_id', agencyId)
          .neq('status', 'done')
          .order('due_date', { ascending: false }),
        supabase.from('agency_crms')
          .select('*')
          .eq('agency_id', agencyId)
          .order('position', { ascending: true }),
        supabase.from('agency_leads')
          .select('*')
          .eq('agency_id', agencyId)
          .neq('stage', 'Perdido'),
        supabase.from('clients')
          .select('id, base_value, created_at, updated_at, client_status, service_end_date, client_type')
          .eq('agency_id', agencyId)
          .in('client_status', ['active', 'completed', 'cancelled'])
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

      // Calculate Ticket Médio (only active and recurring clients)
      const activeRecurringClients = (tempClients || []).filter((c: any) => c.client_status === 'active' && c.client_type === 'recurring');
      const totalActiveBaseValue = activeRecurringClients.reduce((sum: number, c: any) => sum + (Number(c.base_value) || 0), 0);
      const ticketMedio = activeRecurringClients.length > 0 ? totalActiveBaseValue / activeRecurringClients.length : 0;

      // Calculate Faturamento Acumulado no Ano
      const anoAtual = dayjs().year();
      const mesAtual = dayjs().month() + 1; // 1-12

      let faturamentoAcumulado = 0;

      for (const client of (tempClients || []) as any[]) {
        if (!client.base_value) continue;
        
        const criacao = dayjs(client.created_at);
        const anoCriacao = criacao.year();
        const mesCriacao = criacao.month() + 1;
        
        // Mês de início no ano atual
        const mesInicio = anoCriacao < anoAtual ? 1 : mesCriacao;
        
        // Mês de fim
        let mesFim = mesAtual;
        if (client.client_status === 'cancelled' || client.client_status === 'completed') {
          const endDateStr = client.service_end_date || client.updated_at;
          if (endDateStr) {
            const endDate = dayjs(endDateStr);
            const anoEnd = endDate.year();
            const mesEnd = endDate.month() + 1;
            if (anoEnd < anoAtual) {
              mesFim = 0;
            } else if (anoEnd === anoAtual) {
              mesFim = Math.min(mesAtual, mesEnd);
            }
          }
        }
        
        const mesesAtivos = Math.max(0, mesFim - mesInicio + 1);
        faturamentoAcumulado += (Number(client.base_value) || 0) * mesesAtivos;
      }
      
      setFinancial({
        receitas: totalReceitas,
        despesas: totalDespesas,
        saldo: totalReceitas - totalDespesas,
        ticketMedio,
        faturamentoAcumulado
      });

      // Urgent Tasks (Due <= 3 days OR priority IN ['alta', 'urgente'])
      const pTasks = (tempTasks || []) as any[]; // casting since we have relational client
      const filteredTasks = pTasks.filter(t => {
        if (t.priority === 'alta' || t.priority === 'urgente') return true;
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

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('home_tab_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_tasks', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_crms', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_leads', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_billing', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_expenses', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId, agencyName]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-3xl animate-pulse" />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {[1,2].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}
          </div>
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

  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const labelPeriodo = `Jan–${monthNames[dayjs().month()]} de ${dayjs().year()}`;

  return (
    <div className="space-y-8 pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20 pt-10 px-2">
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
            <AgencyLogo className="h-24 mix-blend-multiply" />
            <div className="text-center md:text-left space-y-1">
              <h1 className="text-brand-dark font-bold text-5xl tracking-tighter font-serif italic">
                Bolsa
              </h1>
              <div className="h-0.5 bg-brand-dark w-10 opacity-20 md:mr-auto mx-auto translate-y-1"></div>
              <p className="text-gray-400 text-[9px] uppercase tracking-[0.35em] font-bold !mt-4">
                {agencyName || 'Canguru Digital'} • Gestão & Estratégia
              </p>
            </div>
          </div>
          <div className="max-w-2xl">
            <p className="text-xl text-gray-500 font-medium leading-relaxed italic opacity-80 border-l-2 border-brand-dark/10 pl-6 py-1">
              "Cada cliente bem cuidado é mais um passo no que estamos construindo."
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={toggleFinancials}
            className="flex items-center gap-3 px-6 py-4 bg-white rounded-2xl border border-black/[0.03] shadow-sm text-gray-400 hover:text-brand-dark transition-all font-bold uppercase text-[10px] tracking-widest group"
          >
            {showFinancials ? (
              <>
                <EyeOff size={18} className="group-hover:scale-110 transition-transform" />
                <span>Ocultar Finanças</span>
              </>
            ) : (
              <>
                <Eye size={18} className="group-hover:scale-110 transition-transform" />
                <span>Mostrar Finanças</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* BLOCO 1 - FINANCEIRO */}
      <div className="space-y-4">
        {/* Linha 1 - Principais */}
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

        {/* Linha 2 - Indicadores de Apoio (Menores e mais discretos) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div className="bg-white/85 p-4 rounded-2xl border border-black/[0.02] shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                <Briefcase size={16} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Ticket Médio</p>
                <h4 className="text-base font-bold text-brand-dark">
                  {showFinancials ? formatCurrency(financial.ticketMedio) : 'R$ ••••••••'}
                </h4>
                <p className="text-[8px] text-gray-400 font-medium mt-0.5">por cliente recorrente</p>
              </div>
            </div>
          </div>

          <div className="bg-white/85 p-4 rounded-2xl border border-black/[0.02] shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
                <BarChart3 size={16} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Faturado no Ano</p>
                <h4 className="text-base font-bold text-brand-dark">
                  {showFinancials ? formatCurrency(financial.faturamentoAcumulado) : 'R$ ••••••••'}
                </h4>
                <p className="text-[8px] text-gray-400 font-medium mt-0.5">{labelPeriodo}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BLOCO 2 - CLIENTES ATIVOS (Resumo) */}
      <ActiveClientsSummary onSelectClient={onNavigateToClients} />

      {/* BLOCO 3 - Visão Geral das Tarefas e CRM */}
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
                    <p className="text-sm font-bold break-words leading-snug">{task.title}</p>
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
                    {task.priority === 'urgente' && (
                      <span className="text-[9px] uppercase tracking-widest bg-red-600 text-white px-2 rounded font-bold">URGENTE</span>
                    )}
                    {task.priority === 'alta' && (
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

    </div>
  );
};

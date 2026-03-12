import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import {
  Shield, Users, FileText, CheckSquare, TrendingUp, Globe,
  AlertCircle, Clock, CheckCircle, RotateCcw, XCircle,
  ChevronRight, BarChart2, Activity, RefreshCw
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  segment: string;
  responsible: string;
  color: string;
  initials: string;
  is_active: boolean;
  services: string[];
}

interface BriefingSummary {
  id: string;
  client_id: string;
  title: string;
  month: number;
  year: number;
  status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'revision_requested';
  created_at: string;
  client?: { name: string; initials: string; color: string };
}

interface TaskSummary {
  id: string;
  client_id: string;
  title: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  created_at: string;
  client?: { name: string; initials: string; color: string };
}

interface ClientStats {
  client: Client;
  pendingBriefings: number;
  openTasks: number;
  reportsThisMonth: number; // paid_traffic_reports para o mês atual
}

type AdminTab = 'overview' | 'briefings';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

const BRIEFING_STATUS_CONFIG: Record<string, { label: string, color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
  in_review: { label: 'Em Revisão', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  revision_requested: { label: 'Revisão Solicitada', color: 'bg-red-100 text-red-700' }
};

const PRIORITY_CONFIG: Record<string, { label: string, color: string }> = {
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
  high: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  low: { label: 'Baixa', color: 'bg-gray-100 text-gray-600' }
};

const TASK_STATUS_CONFIG: Record<string, { label: string, icon: React.ElementType }> = {
  pending: { label: 'Pendente', icon: AlertCircle },
  in_progress: { label: 'Em Andamento', icon: RotateCcw },
  done: { label: 'Concluída', icon: CheckCircle },
  cancelled: { label: 'Cancelada', icon: XCircle }
};

export default function AdminView() {
  const { activeClient, userRole, setActiveClient } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [clients, setClients] = useState<Client[]>([]);
  const [clientStats, setClientStats] = useState<ClientStats[]>([]);
  const [pendingBriefings, setPendingBriefings] = useState<BriefingSummary[]>([]);
  const [openTasks, setOpenTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function loadData() {
    setLoading(true);

    // 1. Busca todos os clientes ativos
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name, segment, responsible, color, initials, is_active, services')
      .eq('is_active', true)
      .order('name');

    const clientList: Client[] = clientsData || [];
    setClients(clientList);

    if (clientList.length === 0) {
      setLoading(false);
      return;
    }

    const clientIds = clientList.map(c => c.id);

    // 2. Busca em paralelo: briefings pendentes + tasks abertas + reports do mês atual
    const [briefingsRes, paidRes] = await Promise.all([
      supabase
        .from('briefings')
        .select('id, client_id, title, month, year, status, created_at')
        .in('client_id', clientIds)
        .in('status', ['submitted', 'in_review', 'revision_requested'])
        .order('created_at', { ascending: false }),

      supabase
        .from('paid_traffic_reports')
        .select('id, client_id')
        .in('client_id', clientIds)
        .eq('month', currentMonth)
        .eq('year', currentYear),
    ]);

    const briefings = briefingsRes.data || [];
    const tasks: any[] = []; // Removido website_tasks
    const paidReports = paidRes.data || [];
    const webReports: any[] = []; // Removido website_reports

    // 3. Cria mapa de nome/initials/color por client_id para enriquecer items
    const clientMap = new Map(clientList.map(c => [c.id, c]));

    const enrichedBriefings: BriefingSummary[] = briefings.map(b => ({
      ...b,
      client: clientMap.has(b.client_id)
        ? { name: clientMap.get(b.client_id)!.name, initials: clientMap.get(b.client_id)!.initials, color: clientMap.get(b.client_id)!.color }
        : undefined
    }));

    const enrichedTasks: TaskSummary[] = tasks.map(t => ({
      ...t,
      client: clientMap.has(t.client_id)
        ? { name: clientMap.get(t.client_id)!.name, initials: clientMap.get(t.client_id)!.initials, color: clientMap.get(t.client_id)!.color }
        : undefined
    }));

    setPendingBriefings(enrichedBriefings);
    setOpenTasks(enrichedTasks);

    // 4. Calcula stats por cliente
    const stats: ClientStats[] = clientList.map(client => {
      const reportsThisMonth = paidReports.filter(r => r.client_id === client.id).length;

      return {
        client,
        pendingBriefings: briefings.filter(b => b.client_id === client.id).length,
        openTasks: 0, // Removido website_tasks
        reportsThisMonth
      };
    });

    setClientStats(stats);
    setLastRefresh(new Date());
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const totalReportsThisMonth = clientStats.reduce((acc, curr) => acc + curr.reportsThisMonth, 0);
  const maxExpectedReports = clients.length; // Apenas 1 relatório esperado por cliente (tráfego pago)

  const briefingWeight: Record<string, number> = { revision_requested: 3, in_review: 2, submitted: 1 };
  const sortedBriefings = [...pendingBriefings].sort((a, b) => (briefingWeight[b.status] || 0) - (briefingWeight[a.status] || 0));

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-600" size={24} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Painel Administrativo</h1>
              <p className="text-sm text-gray-500">
                Última atualização: {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 bg-white"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* Resumo Global */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex items-center gap-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Clientes Ativos</p>
              <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${pendingBriefings.length > 0 ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600'}`}>
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Briefings Pendentes</p>
              <p className="text-2xl font-bold text-gray-900">{pendingBriefings.length}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex items-center gap-4">
            <div className="bg-green-100 text-green-600 p-3 rounded-lg">
              <BarChart2 size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Relatórios este Mês</p>
              <p className="text-2xl font-bold text-gray-900">{totalReportsThisMonth} <span className="text-sm text-gray-400 font-normal">/ {maxExpectedReports}</span></p>
            </div>
          </div>
        </div>

        {/* Tabs de Navegação */}
        <div className="mb-6 border-b border-gray-200 flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('briefings')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'briefings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Briefings ({pendingBriefings.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm divide-y divide-gray-100">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="py-3 px-4 font-medium">Cliente</th>
                        <th className="py-3 px-4 font-medium">Segmento</th>
                        <th className="py-3 px-4 font-medium">Responsável</th>
                        <th className="py-3 px-4 font-medium text-center">Briefings Pendentes</th>
                        <th className="py-3 px-4 font-medium text-center">Relatórios do Mês</th>
                        <th className="py-3 px-4 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {clientStats.map(({ client, pendingBriefings, reportsThisMonth }) => (
                        <tr key={client.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ backgroundColor: client.color || '#3B82F6' }}
                              >
                                {client.initials || client.name.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-900">{client.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{client.segment || '-'}</td>
                          <td className="py-3 px-4 text-gray-600">{client.responsible || '-'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${pendingBriefings > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                              {pendingBriefings}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${reportsThisMonth === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {reportsThisMonth}/1
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {(pendingBriefings === 0) ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">OK</span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Atenção</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'briefings' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Briefings que precisam de atenção</h2>
                {sortedBriefings.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
                    <FileText className="mx-auto text-gray-400 mb-3" size={40} />
                    <p className="text-gray-500">Nenhum briefing pendente de revisão.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedBriefings.map(b => {
                      const statusConfig = BRIEFING_STATUS_CONFIG[b.status] || { label: b.status, color: 'bg-gray-100 text-gray-600' };
                      return (
                        <div key={b.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 flex flex-col">
                          <div className="flex items-center gap-3 mb-3">
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: b.client?.color || '#3B82F6' }}
                            >
                              {b.client?.initials || b.client?.name?.substring(0, 2).toUpperCase() || 'CL'}
                            </div>
                            <span className="font-medium text-gray-900 truncate">{b.client?.name || 'Cliente Desconhecido'}</span>
                          </div>
                          <h3 className="font-bold text-gray-800 mb-1 line-clamp-2">{b.title}</h3>
                          <p className="text-sm text-gray-500 mb-4">{MONTHS[b.month - 1]} / {b.year}</p>
                          <div className="mt-auto flex items-center justify-between">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                            {b.created_at && (
                              <span className="text-xs text-gray-400">
                                {new Date(b.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        
        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Precisa de suporte técnico? Entre em contato: <a href="mailto:contato@cangurudigital.com.br" className="text-brand-dark font-bold hover:underline">contato@cangurudigital.com.br</a>
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Plus, Search, LayoutGrid, List, Download, TrendingUp, CheckSquare, DollarSign, AlertCircle, Calendar, Users, Percent, FileText, Filter, Clock, ArrowRight } from 'lucide-react';

const getLeadPhone = (lead: AgencyLead) => {
  if (!lead.form_data) return 'Não informado';
  const phoneKey = Object.keys(lead.form_data).find(k => 
    k.toLowerCase().includes('tel') || 
    k.toLowerCase().includes('phone') || 
    k.toLowerCase().includes('whats') || 
    k.toLowerCase().includes('contato') ||
    k.toLowerCase().includes('celular')
  );
  return phoneKey ? String(lead.form_data[phoneKey]) : 'Não informado';
};

const getLeadOrigin = (lead: AgencyLead) => {
  if (!lead.form_data) return 'Inbound/Indireto';
  const originKey = Object.keys(lead.form_data).find(k => 
    k.toLowerCase().includes('origem') || 
    k.toLowerCase().includes('canal') || 
    k.toLowerCase().includes('como') || 
    k.toLowerCase().includes('source')
  );
  return originKey ? String(lead.form_data[originKey]) : 'Inbound/Indireto';
};
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AgencyCRM, AgencyLead } from '../../types';
import { useAgencyCRM } from '../../hooks/useAgencyCRM';
import { CRMLeadCard } from './CRMLeadCard';
import { CRMLeadModal } from './CRMLeadModal';
import { SortableLeadCard } from './SortableLeadCard';

interface CRMBoardProps {
  crm: AgencyCRM;
}

export const CRMBoard: React.FC<CRMBoardProps> = ({ crm }) => {
  const { leads, fetchLeads, moveLeadToStage, autoAdvanceLeads, addLead, updateLead } = useAgencyCRM();
  const [activeLead, setActiveLead] = useState<AgencyLead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<AgencyLead | null>(null);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'metrics' | 'kanban' | 'fechados' | 'perdidos'>('kanban');
  
  const [lossReasonModal, setLossReasonModal] = useState<{ isOpen: boolean; lead: AgencyLead | null; newStage: string }>({ isOpen: false, lead: null, newStage: '' });
  const [selectedLossReason, setSelectedLossReason] = useState('');
  const [customLossReason, setCustomLossReason] = useState('');
  
  const [proposalValueModal, setProposalValueModal] = useState<{ isOpen: boolean; lead: AgencyLead | null; newStage: string }>({ isOpen: false, lead: null, newStage: '' });
  const [proposalValue, setProposalValue] = useState('');
  const [showLossBreakdown, setShowLossBreakdown] = useState(false);

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => {
    const saved = localStorage.getItem('agency_crm_view_mode_v2');
    if (saved === 'kanban' || saved === 'list') return saved;
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'kanban';
  });

  useEffect(() => {
    localStorage.setItem('agency_crm_view_mode_v2', viewMode);
  }, [viewMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const loadAndAdvance = async () => {
      const currentLeads = await fetchLeads(crm.id);
      if (currentLeads && currentLeads.length > 0) {
        await autoAdvanceLeads(currentLeads, crm.kanban_stages, crm);
      }
    };
    loadAndAdvance();
  }, [crm.id, fetchLeads, autoAdvanceLeads, crm.kanban_stages, crm.auto_advance_time]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = leads.find(l => l.id === active.id);
    if (lead) setActiveLead(lead);
  };

  const handleMoveStageRequest = (lead: AgencyLead, targetStageName: string) => {
    const isPerdido = targetStageName.toLowerCase() === 'perdido' || 
                      crm.kanban_stages.find(s => s.name === targetStageName)?.id === 'perdido';
    const isPropostaEnviada = targetStageName.toLowerCase() === 'proposta enviada' || 
                              crm.kanban_stages.find(s => s.name === targetStageName)?.id === 'proposta_enviada';

    if (isPerdido) {
      setLossReasonModal({ isOpen: true, lead, newStage: targetStageName });
      setSelectedLossReason('');
      setCustomLossReason('');
    } else if (isPropostaEnviada) {
      const currentVal = lead.form_data?.deal_value || lead.deal_value || '';
      setProposalValue(currentVal ? String(currentVal) : '');
      setProposalValueModal({ isOpen: true, lead, newStage: targetStageName });
    } else {
      moveLeadToStage(lead, targetStageName, crm.kanban_stages, crm.auto_advance_time);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeLead = leads.find(l => l.id === activeId);
    if (!activeLead) return;

    // Find which column the item was dropped in
    let newStageName = activeLead.stage;
    
    // Check if dropped directly on a column
    const stageColumn = crm.kanban_stages.find(s => s.name === overId);
    if (stageColumn) {
      newStageName = stageColumn.name;
    } else {
      // Check if dropped on another lead
      const overLead = leads.find(l => l.id === overId);
      if (overLead) {
        newStageName = overLead.stage;
      }
    }

    if (activeLead.stage !== newStageName) {
      handleMoveStageRequest(activeLead, newStageName);
    }
  };

  const handleConfirmLoss = async (skip: boolean) => {
    if (lossReasonModal.lead) {
      let finalReason = null;
      if (!skip) {
        finalReason = selectedLossReason === 'Outro' ? customLossReason : selectedLossReason;
        if (!finalReason && selectedLossReason) finalReason = selectedLossReason;
      }

      await moveLeadToStage(lossReasonModal.lead, lossReasonModal.newStage, crm.kanban_stages, crm.auto_advance_time);
      await updateLead(lossReasonModal.lead.id, { loss_reason: finalReason });
      setLossReasonModal({ isOpen: false, lead: null, newStage: '' });
      setSelectedLossReason('');
      setCustomLossReason('');
    }
  };

  const handleConfirmProposalValue = async (skip: boolean) => {
    if (proposalValueModal.lead) {
      const numericValue = skip ? null : parseFloat(proposalValue) || null;
      
      const updatedFormData = {
        ...(proposalValueModal.lead.form_data || {}),
        deal_value: numericValue
      };

      await moveLeadToStage(proposalValueModal.lead, proposalValueModal.newStage, crm.kanban_stages, crm.auto_advance_time);
      await updateLead(proposalValueModal.lead.id, { form_data: updatedFormData });

      setProposalValueModal({ isOpen: false, lead: null, newStage: '' });
      setProposalValue('');
    }
  };

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    Object.values(lead.form_data).some(val => String(val).toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleExportCSV = () => {
    if (!filteredLeads || filteredLeads.length === 0) return;

    // Cabeçalhos base do CSV
    const headers = ['Nome', 'Etapa', 'Data de Criação', 'Notas', 'Motivo da Perda'];
    
    // Obter campos de formulário customizados
    const dynamicFields = crm.form_fields || [];
    dynamicFields.forEach(field => {
      headers.push(field.label);
    });

    // Função de limpeza de aspas e ponto-e-vírgula para CSV
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      str = str.replace(/"/g, '""');
      if (str.includes(';') || str.includes('\n') || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    };

    // Montar as colunas separadas por ponto e vírgula (padrão de Excel no Brasil)
    const csvRows = [headers.join(';')];

    filteredLeads.forEach(lead => {
      const row = [
        escapeCSV(lead.name),
        escapeCSV(lead.stage),
        escapeCSV(lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR') : ''),
        escapeCSV(lead.notes),
        escapeCSV(lead.loss_reason)
      ];

      // Campos dinâmicos do formulário
      dynamicFields.forEach(field => {
        const val = lead.form_data ? lead.form_data[field.key] : '';
        row.push(escapeCSV(val));
      });

      csvRows.push(row.join(';'));
    });

    // Utiliza BOM (\uFEFF) para forçar o Excel a ler em UTF-8 corretamente
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    const safeCrmName = crm.name.replace(/[^a-z0-0_]/gi, '_').toLowerCase();
    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    link.setAttribute('download', `leads_${safeCrmName}_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLeadsByStage = (stageName: string) => {
    const firstStageName = crm.kanban_stages[0]?.name;
    return filteredLeads.filter(l => {
      if (l.stage === stageName) return true;
      if (l.stage === 'Novos Leads' && stageName === firstStageName) return true;
      return false;
    }).sort((a, b) => {
      if (a.kanban_position !== b.kanban_position) {
        return a.kanban_position - b.kanban_position;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  };

  const dashboardStats = React.useMemo(() => {
    const counts = crm.kanban_stages.reduce((acc, stage) => {
      const isFirst = stage.name === crm.kanban_stages[0]?.name;
      acc[stage.name] = filteredLeads.filter(l => {
        if (l.stage === stage.name) return true;
        if (l.stage === 'Novos Leads' && isFirst) return true;
        return false;
      }).length;
      return acc;
    }, {} as Record<string, number>);

    const propostaEnviadaStage = crm.kanban_stages.find(s => s.id === 'proposta_enviada' || s.name.toLowerCase() === 'proposta enviada');
    const propostaEnviadaLeads = filteredLeads.filter(l => l.stage === propostaEnviadaStage?.name);
    const emMesa = propostaEnviadaLeads.reduce((sum, l) => sum + (Number(l.form_data?.deal_value) || Number(l.deal_value) || 0), 0);

    const perdidoStage = crm.kanban_stages.find(s => s.id === 'perdido' || s.name.toLowerCase() === 'perdido');
    const perdidosLeads = filteredLeads.filter(l => l.stage === perdidoStage?.name);

    const fechadoStage = crm.kanban_stages.find(s => s.id === 'fechado' || s.name.toLowerCase() === 'fechado');
    const fechadosLeads = filteredLeads.filter(l => l.stage === fechadoStage?.name);

    const coldStages = crm.kanban_stages.filter(s => 
      s.id !== 'proposta_enviada' && s.id !== 'perdido' && s.id !== 'fechado' &&
      s.name.toLowerCase() !== 'proposta enviada' && s.name.toLowerCase() !== 'perdido' && s.name.toLowerCase() !== 'fechado'
    );

    const lossReasonsCounts = (() => {
      const countsMap: Record<string, number> = {};
      perdidosLeads.forEach(l => {
        const reason = l.loss_reason ? l.loss_reason.trim() : 'Sem motivo';
        countsMap[reason] = (countsMap[reason] || 0) + 1;
      });
      return Object.entries(countsMap)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);
    })();

    return {
      counts,
      emMesa,
      propostaEnviadaCount: propostaEnviadaLeads.length,
      perdidoCount: perdidosLeads.length,
      fechadoCount: fechadosLeads.length,
      coldStages,
      lossReasonsCounts
    };
  }, [filteredLeads, crm.kanban_stages]);

  return (
    <div className="h-full flex flex-col bg-gray-50/25">
      {/* Banner Principal - Estilo Premium CRM & Oportunidades */}
      <div className="bg-neutral-950 text-white px-6 py-8 rounded-3xl m-4 sm:m-6 shadow-xl relative overflow-hidden shrink-0">
        {/* Background Decorative Dots/Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              Acompanhamento de Leads da Agência
            </span>
            <h1 className="text-3xl md:text-4xl font-serif italic font-normal tracking-tight">
              CRM & Oportunidades
            </h1>
            <div className="inline-block bg-neutral-900 border border-neutral-800/80 px-4 py-1.5 rounded-xl text-xs font-medium text-neutral-300">
              ⚡ Gerencie seu funil de prospecção e vendas
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto w-full md:w-auto justify-end">
            <button
              onClick={handleExportCSV}
              disabled={filteredLeads.length === 0}
              className={`flex items-center justify-center gap-2 px-5 py-3 border rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${
                filteredLeads.length === 0
                  ? 'bg-neutral-900 text-neutral-500 border-neutral-800 cursor-not-allowed opacity-50'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-800 hover:border-neutral-700'
              }`}
              title="Exportar Leads Filtrados para CSV"
            >
              <Download size={16} />
              <span>Exportar</span>
            </button>
            
            <button
              onClick={() => {
                setSelectedLead(null);
                setIsNewLeadModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-black hover:bg-neutral-100 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg transition-all"
            >
              <Plus size={16} />
              <span>Novo Lead</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Estilo Minimalista e Elegante */}
      <div className="px-4 sm:px-6 bg-white border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0 gap-4">
        <div className="flex overflow-x-auto scrollbar-none gap-6 pt-1">
          {[
            { id: 'metrics', label: 'RELATÓRIO & MÉTRICAS', emoji: '📈' },
            { id: 'kanban', label: 'FUNIL / KANBAN', emoji: '📊' },
            { id: 'fechados', label: 'CONTRATOS FECHADOS', emoji: '🤝' },
            { id: 'perdidos', label: 'LEADS PERDIDOS', emoji: '💔' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 focus:outline-none ${
                activeTab === tab.id
                  ? 'border-neutral-950 text-neutral-950 font-extrabold'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
              }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search input (visible only when not on active metrics tab, or general search) */}
        {activeTab !== 'metrics' && (
          <div className="pb-3 sm:pb-0 relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-300 transition-all"
            />
          </div>
        )}
      </div>

      {/* --- ABA 1: RELATÓRIO & MÉTRICAS --- */}
      {activeTab === 'metrics' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full pb-20">
            {/* Indicadores Grid */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-gray-100 gap-6 lg:gap-0">
              
              {/* Bloco 1: Leads, Fechados, Conversão */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-6 lg:pr-6 pb-6 lg:pb-0">
                {/* Leads no Mês */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-400 font-bold text-[10px] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Leads no Mês
                  </div>
                  <div className="text-4xl font-black text-gray-900">
                    {leads.length}
                  </div>
                </div>
                {/* Fechados no Mês */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-400 font-bold text-[10px] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Fechados no Mês
                  </div>
                  <div className="text-4xl font-black text-emerald-600">
                    {dashboardStats.fechadoCount}
                  </div>
                </div>
                {/* Taxa de Conversão */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-400 font-bold text-[10px] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    Taxa de Conversão
                  </div>
                  <div className="text-4xl font-black text-purple-600">
                    {leads.length > 0 ? Math.round((dashboardStats.fechadoCount / leads.length) * 100) : 0}%
                  </div>
                </div>
              </div>

              {/* Bloco 2: Propostas Enviadas */}
              <div className="flex-1 lg:pl-8 lg:pr-8 py-6 lg:py-0 border-orange-500 border-l-0 lg:border-l-2 pl-0">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-850 font-bold text-[10px] uppercase tracking-wider">
                    <span>📄</span> Propostas Enviadas
                  </div>
                  <div className="text-3xl font-black text-amber-700">
                    {dashboardStats.emMesa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                    <span>💼</span> Dinheiro na Mesa
                  </div>
                  <div className="text-[11px] text-gray-400 font-medium">
                    {dashboardStats.propostaEnviadaCount} propostas enviadas este mês
                  </div>
                </div>
              </div>

              {/* Bloco 3: Faturamento CRM */}
              <div className="flex-1 lg:pl-8 py-6 lg:py-0">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[10px] uppercase tracking-wider">
                    <span>💵</span> Faturamento CRM
                  </div>
                  <div className="text-3xl font-black text-emerald-700">
                    {(() => {
                      const fechadoStageName = crm.kanban_stages.find(s => s.id === 'fechado' || s.name.toLowerCase() === 'fechado')?.name || 'Fechado';
                      const value = leads
                        .filter(l => l.stage === fechadoStageName)
                        .reduce((sum, l) => sum + (Number(l.form_data?.deal_value) || Number(l.deal_value) || 0), 0);
                      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    })()}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                    <span>💰</span> Faturamento Real
                  </div>
                  <div className="text-[11px] text-gray-400 font-medium">
                    Soma dos contratos fechados de fato
                  </div>
                </div>
              </div>

            </div>

            {/* Grid Inferior: Gráfico de Barras & Motivos de Perda */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Performance Comercial (Barras) */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                <div className="mb-6">
                  <h3 className="font-bold text-gray-900 text-lg">Performance Comercial</h3>
                  <p className="text-xs text-gray-400 font-medium">Gráfico comparativo de Novos Leads vs Contratos Fechados</p>
                </div>

                {/* Gráfico customizado elegante */}
                <div className="h-64 flex flex-col justify-between">
                  {/* Barras */}
                  <div className="flex-1 flex items-end justify-between px-4 pb-2 border-b border-gray-100 gap-4">
                    {(() => {
                      const last6Months = Array.from({ length: 6 }).map((_, i) => {
                        const d = new Date();
                        d.setMonth(d.getMonth() - i);
                        return {
                          monthStr: d.toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' }),
                          monthName: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
                          year: d.getFullYear(),
                          month: d.getMonth(),
                          novosLeads: 0,
                          fechados: 0
                        };
                      }).reverse();

                      leads.forEach(l => {
                        const date = new Date(l.created_at);
                        const monthIndex = last6Months.findIndex(m => m.month === date.getMonth() && m.year === date.getFullYear());
                        if (monthIndex !== -1) {
                          last6Months[monthIndex].novosLeads++;
                          const isFechado = l.stage.toLowerCase() === 'fechado' || crm.kanban_stages.find(s => s.name === l.stage)?.id === 'fechado';
                          if (isFechado) {
                            last6Months[monthIndex].fechados++;
                          }
                        }
                      });

                      const maxCount = Math.max(...last6Months.map(m => Math.max(m.novosLeads, m.fechados, 1)));

                      return last6Months.map(m => {
                        const leadHeight = (m.novosLeads / maxCount) * 100;
                        const fechadoHeight = (m.fechados / maxCount) * 100;

                        return (
                          <div key={m.monthStr} className="flex-1 flex flex-col items-center gap-2 group">
                            <div className="w-full flex items-end justify-center gap-1.5 h-44 relative">
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-2 bg-neutral-900 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-10">
                                Leads: {m.novosLeads} | Fechados: {m.fechados}
                              </div>
                              {/* Barra Leads */}
                              <div 
                                className="w-5 bg-neutral-500 hover:bg-neutral-600 rounded-t-md transition-all duration-500 shadow-sm"
                                style={{ height: `${Math.max(leadHeight, 4)}%` }}
                              />
                              {/* Barra Fechados */}
                              <div 
                                className="w-5 bg-emerald-400 hover:bg-emerald-500 rounded-t-md transition-all duration-500 shadow-sm"
                                style={{ height: `${Math.max(fechadoHeight, 4)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              {m.monthName}/{m.monthStr.split('/')[1] || m.monthStr}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Legenda */}
                  <div className="flex items-center justify-center gap-6 pt-4 text-xs font-semibold text-gray-500">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-neutral-500 rounded-md" />
                      <span>Novos Leads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-400 rounded-md" />
                      <span>Contratos Fechados</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Perdas do Mês */}
              <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg mb-1">Perdas do Mês</h3>
                  <p className="text-xs text-gray-400 font-medium mb-6">Motivos recorrentes na etapa de perda comercial</p>
                  
                  <div className="space-y-4">
                    {dashboardStats.lossReasonsCounts.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 font-medium text-sm">
                        Nenhuma perda registrada ainda.
                      </div>
                    ) : (
                      dashboardStats.lossReasonsCounts.slice(0, 5).map(({ reason, count }) => {
                        const percentage = dashboardStats.perdidoCount > 0 ? Math.round((count / dashboardStats.perdidoCount) * 100) : 0;
                        return (
                          <div key={reason} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-gray-700">
                              <span className="truncate max-w-[160px]">{reason}</span>
                              <span>{count} ({percentage}%)</span>
                            </div>
                            <div className="w-full bg-gray-50 h-2.5 rounded-full overflow-hidden border border-gray-100">
                              <div 
                                className="bg-red-400 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-50 flex items-center justify-between text-xs font-bold text-red-600/80">
                  <span>Total de perdas no mês:</span>
                  <span>{dashboardStats.perdidoCount} leads</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- ABA 2: FUNIL / KANBAN --- */}
      {activeTab === 'kanban' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Board Header de controles menores e mais discretos */}
          <div className="px-6 py-3.5 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
              <span>🎯</span>
              <span>{filteredLeads.length} de {leads.length} leads correspondentes</span>
            </div>
            
            <div className="flex bg-gray-100/80 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-neutral-900 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                title="Visualização Kanban"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-neutral-900 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                title="Visualização em Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className={`flex-1 ${viewMode === 'kanban' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-y-auto'} p-4 sm:p-6 bg-gray-50/30`}>
            {viewMode === 'kanban' ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex gap-6 h-full items-start">
                  {crm.kanban_stages.map(stage => {
                    const stageLeads = getLeadsByStage(stage.name);
                    return (
                      <div key={stage.id} className="flex-shrink-0 w-80 flex flex-col max-h-full bg-gray-100/40 rounded-2xl border border-gray-200/50">
                        {/* Column Header */}
                        <div className="p-4 flex items-center justify-between shrink-0 border-b border-gray-200/50 bg-white rounded-t-2xl">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                            <h3 className="font-bold text-gray-800 text-sm">{stage.name}</h3>
                          </div>
                          <span className="bg-gray-50 text-gray-500 text-xs font-bold px-2.5 py-0.5 rounded-md border border-gray-100">
                            {stageLeads.length}
                          </span>
                        </div>

                        {/* Column Content */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px]" id={stage.name}>
                          <SortableContext
                            id={stage.name}
                            items={stageLeads.map(l => l.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {stageLeads.map(lead => (
                              <SortableLeadCard
                                key={lead.id}
                                lead={lead}
                                crm={crm}
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setIsModalOpen(true);
                                }}
                                onMoveStage={handleMoveStageRequest}
                              />
                            ))}
                          </SortableContext>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <DragOverlay>
                  {activeLead ? (
                    <div className="opacity-80 rotate-2 scale-105 transition-transform cursor-grabbing">
                      <CRMLeadCard lead={activeLead} crm={crm} onClick={() => {}} />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <div className="max-w-4xl mx-auto space-y-4 pb-20">
                {filteredLeads.length === 0 ? (
                   <div className="p-8 text-center bg-white rounded-2xl border border-gray-200/60 shadow-sm">
                      <p className="text-gray-500 font-medium">Nenhum lead encontrado.</p>
                   </div>
                ) : null}
                {[...filteredLeads].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(lead => {
                  const primaryField = crm.form_fields.find(f => lead.form_data[f.key]);
                  const primaryValue = primaryField ? lead.form_data[primaryField.key] : null;
                  
                  const isOverdue = lead.next_stage_at && new Date(lead.next_stage_at).getTime() < new Date().getTime();

                  return (
                    <div 
                      key={lead.id}
                      onClick={() => {
                        setSelectedLead(lead);
                        setIsModalOpen(true);
                      }} 
                      className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-200 hover:border-neutral-900/30 hover:shadow-md transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-900 text-base">{lead.name}</h4>
                        </div>
                        {primaryValue && (
                          <div className="text-sm text-gray-500 line-clamp-1">
                            <span className="font-medium text-gray-600">{primaryField?.label}:</span> {String(primaryValue)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 sm:w-auto">
                        <div className="text-xs font-bold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md">
                          {lead.stage}
                        </div>
                        
                        {lead.next_stage_at && !lead.auto_advance_paused && (
                          <div className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${isOverdue ? 'text-red-700 bg-red-50 border-red-100' : 'text-blue-700 bg-blue-50 border-blue-100'}`}>
                            {isOverdue ? 'Atrasado' : 'No prazo'}
                          </div>
                        )}
                        
                        <div className="text-[11px] text-gray-400 font-medium">
                          {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- ABA 3: CONTRATOS FECHADOS --- */}
      {activeTab === 'fechados' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Histórico de Contratos Fechados</h2>
                <p className="text-xs text-gray-400 font-medium">Todos os fechamentos acumulados da agência</p>
              </div>
            </div>

            {/* Cards de Faturamento Acumulado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              {/* Total Geral */}
              <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
                <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block">Total Geral</span>
                <div className="space-y-1 mt-2">
                  <span className="text-lg font-black text-emerald-950">
                    {(() => {
                      const fechadoStageName = crm.kanban_stages.find(s => s.id === 'fechado' || s.name.toLowerCase() === 'fechado')?.name || 'Fechado';
                      const closedLeads = filteredLeads.filter(l => l.stage === fechadoStageName);
                      return closedLeads.reduce((sum, l) => sum + (Number(l.form_data?.deal_value) || Number(l.deal_value) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    })()}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold block">
                    {(() => {
                      const fechadoStageName = crm.kanban_stages.find(s => s.id === 'fechado' || s.name.toLowerCase() === 'fechado')?.name || 'Fechado';
                      return filteredLeads.filter(l => l.stage === fechadoStageName).length;
                    })()} contratos fechados
                  </span>
                </div>
              </div>

              {/* Meses Individuais Dinâmicos */}
              {(() => {
                const fechadoStageName = crm.kanban_stages.find(s => s.id === 'fechado' || s.name.toLowerCase() === 'fechado')?.name || 'Fechado';
                const closedLeads = filteredLeads.filter(l => l.stage === fechadoStageName);

                // Mostrar os últimos 4 meses de fechamento ou criar placeholders de R$ 0
                const mesesDinamicos = Array.from({ length: 4 }).map((_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - i);
                  return {
                    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    name: d.toLocaleDateString('pt-BR', { month: 'long' }),
                    valor: 0,
                    count: 0
                  };
                });

                closedLeads.forEach(l => {
                  const date = new Date(l.created_at);
                  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  const found = mesesDinamicos.find(m => m.key === key);
                  if (found) {
                    found.valor += (Number(l.form_data?.deal_value) || Number(l.deal_value) || 0);
                    found.count += 1;
                  }
                });

                return mesesDinamicos.map(m => (
                  <div key={m.key} className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block capitalize">{m.name}</span>
                    <div className="space-y-1 mt-2">
                      <span className="text-lg font-black text-gray-800">
                        {m.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium block">{m.count} contratos</span>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Tabela de Fechados */}
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fechamento</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contato/Telefone</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Origem/Canal</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(() => {
                      const fechadoStageName = crm.kanban_stages.find(s => s.id === 'fechado' || s.name.toLowerCase() === 'fechado')?.name || 'Fechado';
                      const closedLeads = filteredLeads.filter(l => l.stage === fechadoStageName);

                      if (closedLeads.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-gray-400 font-medium text-sm">
                              Nenhum contrato fechado no histórico correspondente.
                            </td>
                          </tr>
                        );
                      }

                      return closedLeads.map(lead => {
                        const valor = Number(lead.form_data?.deal_value) || Number(lead.deal_value) || 0;
                        return (
                          <tr 
                            key={lead.id} 
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsModalOpen(true);
                            }}
                            className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                          >
                            <td className="p-4 text-xs font-semibold text-gray-500">
                              {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-4 text-sm font-bold text-neutral-900 group-hover:text-neutral-950">
                              {lead.name}
                            </td>
                            <td className="p-4 text-xs font-semibold text-gray-500">
                              {getLeadPhone(lead)}
                            </td>
                            <td className="p-4">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-gray-100 border border-gray-200/50 px-2.5 py-1 rounded-md">
                                {getLeadOrigin(lead)}
                              </span>
                            </td>
                            <td className="p-4 text-sm font-black text-right text-emerald-600">
                              {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ABA 4: LEADS PERDIDOS --- */}
      {activeTab === 'perdidos' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Histórico de Leads Perdidos</h2>
                <p className="text-xs text-gray-400 font-medium">Leads que saíram do funil sem fechar negócio</p>
              </div>
            </div>

            {/* Cards de Perdas Acumuladas por Motivo */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {dashboardStats.lossReasonsCounts.slice(0, 5).map(({ reason, count }) => {
                const percentage = dashboardStats.perdidoCount > 0 ? Math.round((count / dashboardStats.perdidoCount) * 100) : 0;
                return (
                  <div key={reason} className="bg-red-50/20 border border-red-100/30 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-red-800 uppercase tracking-wider block truncate">{reason}</span>
                    <div className="space-y-1 mt-2">
                      <span className="text-lg font-black text-red-950">{count}</span>
                      <span className="text-[10px] text-red-700 font-semibold block">{percentage}% do total</span>
                    </div>
                  </div>
                );
              })}
              {dashboardStats.lossReasonsCounts.length === 0 && (
                <div className="col-span-full py-4 text-center text-sm text-gray-400 font-medium bg-gray-50 rounded-2xl">
                  Nenhum lead marcado como perdido ainda.
                </div>
              )}
            </div>

            {/* Tabela de Leads Perdidos */}
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Perda</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contato/Telefone</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Origem/Canal</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Motivo da Perda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(() => {
                      const perdidoStageName = crm.kanban_stages.find(s => s.id === 'perdido' || s.name.toLowerCase() === 'perdido')?.name || 'Perdido';
                      const perdidosLeads = filteredLeads.filter(l => l.stage === perdidoStageName);

                      if (perdidosLeads.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-gray-400 font-medium text-sm">
                              Nenhum lead perdido correspondente no histórico.
                            </td>
                          </tr>
                        );
                      }

                      return perdidosLeads.map(lead => (
                        <tr 
                          key={lead.id} 
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsModalOpen(true);
                          }}
                          className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="p-4 text-xs font-semibold text-gray-500">
                            {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-4 text-sm font-bold text-neutral-900 group-hover:text-neutral-950">
                            {lead.name}
                          </td>
                          <td className="p-4 text-xs font-semibold text-gray-500">
                            {getLeadPhone(lead)}
                          </td>
                          <td className="p-4">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-gray-100 border border-gray-200/50 px-2.5 py-1 rounded-md">
                              {getLeadOrigin(lead)}
                            </span>
                          </td>
                          <td className="p-4 text-xs font-bold text-red-600/90">
                            {lead.loss_reason || 'Sem motivo informado'}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {(isModalOpen || isNewLeadModalOpen) && (
        <CRMLeadModal
          crm={crm}
          lead={selectedLead}
          isOpen={isModalOpen || isNewLeadModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setIsNewLeadModalOpen(false);
            setSelectedLead(null);
          }}
        />
      )}

      {/* Loss Reason Modal */}
      {lossReasonModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden transform scale-95 transition-all duration-300">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
                <span>❌</span> Marcar como Perdido
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Por favor, selecione o motivo da perda do lead:
              </p>
              
              <div className="space-y-2">
                {["Não respondeu", "Achou caro", "Não era o momento", "Escolheu concorrente", "Outro"].map(option => (
                  <label key={option} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="loss_reason"
                      value={option}
                      checked={selectedLossReason === option}
                      onChange={(e) => setSelectedLossReason(e.target.value)}
                      className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">{option}</span>
                  </label>
                ))}
              </div>

              {selectedLossReason === 'Outro' && (
                <input
                  type="text"
                  value={customLossReason}
                  onChange={(e) => setCustomLossReason(e.target.value)}
                  placeholder="Especifique o motivo..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-red-500/20 outline-none"
                />
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setLossReasonModal({ isOpen: false, lead: null, newStage: '' });
                  setSelectedLossReason('');
                  setCustomLossReason('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmLoss(true)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors font-medium text-sm"
              >
                Pular
              </button>
              <button
                onClick={() => handleConfirmLoss(false)}
                disabled={!selectedLossReason || (selectedLossReason === 'Outro' && !customLossReason.trim())}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
              >
                Confirmar Perda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Value Modal */}
      {proposalValueModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-purple-50">
              <h2 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                <span>💜</span> Proposta Enviada
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Qual o valor estimado para esta proposta? (Opcional)
              </p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">R$</span>
                <input
                  type="number"
                  value={proposalValue}
                  onChange={(e) => setProposalValue(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setProposalValueModal({ isOpen: false, lead: null, newStage: '' });
                  setProposalValue('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmProposalValue(true)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors font-medium text-sm"
              >
                Pular
              </button>
              <button
                onClick={() => handleConfirmProposalValue(false)}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm shadow-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

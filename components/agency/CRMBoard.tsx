import React, { useEffect, useState } from 'react';
import { Plus, Search, LayoutGrid, List, Download } from 'lucide-react';
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
  const [lossReasonModal, setLossReasonModal] = useState<{ isOpen: boolean; lead: AgencyLead | null; newStage: string }>({ isOpen: false, lead: null, newStage: '' });
  const [lossReason, setLossReason] = useState('');

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
      if (newStageName.toLowerCase() === 'perdido') {
        setLossReasonModal({ isOpen: true, lead: activeLead, newStage: newStageName });
      } else {
        await moveLeadToStage(activeLead, newStageName, crm.kanban_stages, crm.auto_advance_time);
      }
    }
  };

  const handleConfirmLoss = async () => {
    if (lossReasonModal.lead) {
      await moveLeadToStage(lossReasonModal.lead, lossReasonModal.newStage, crm.kanban_stages, crm.auto_advance_time);
      await updateLead(lossReasonModal.lead.id, { loss_reason: lossReason });
      setLossReasonModal({ isOpen: false, lead: null, newStage: '' });
      setLossReason('');
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
    return filteredLeads.filter(l => l.stage === stageName).sort((a, b) => a.kanban_position - b.kanban_position);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Board Header */}
      <div className="px-4 sm:px-6 py-4 bg-white border-b border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between shrink-0 gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}
              title="Visualização Kanban"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={filteredLeads.length === 0}
            className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm w-full sm:w-auto ${
              filteredLeads.length === 0
                ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
            title="Exportar Leads Filtrados para CSV"
          >
            <Download size={18} />
            <span>Exportar</span>
          </button>
          
          <button
            onClick={() => {
              setSelectedLead(null);
              setIsNewLeadModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-dark text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:shadow-xl transition-all transform hover:-translate-y-1 w-full sm:w-auto"
          >
            <Plus size={18} />
            <span>Novo Lead</span>
          </button>
        </div>
      </div>

      {/* Board Content */}
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
                  <div key={stage.id} className="flex-shrink-0 w-80 flex flex-col max-h-full bg-gray-100/50 rounded-2xl border border-gray-200/60">
                    {/* Column Header */}
                    <div className="p-4 flex items-center justify-between shrink-0 border-b border-gray-200/60 bg-white/50 rounded-t-2xl">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                        <h3 className="font-bold text-gray-800">{stage.name}</h3>
                      </div>
                      <span className="bg-white text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
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
            {filteredLeads.map(lead => {
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
                  className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-200 hover:border-brand-dark/30 hover:shadow-md transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center gap-4"
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
                      {new Date(lead.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">Motivo da Perda</h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Por favor, informe o motivo pelo qual este lead foi perdido.
              </p>
              <textarea
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all resize-none"
                rows={4}
                placeholder="Ex: Achou caro, fechou com concorrente..."
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setLossReasonModal({ isOpen: false, lead: null, newStage: '' });
                  setLossReason('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmLoss}
                disabled={!lossReason.trim()}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
              >
                Confirmar Perda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

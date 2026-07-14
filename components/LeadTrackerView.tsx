
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Briefcase, 
  CheckCircle2, 
  FileText, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  CheckSquare,
  DollarSign,
  X,
  ThumbsUp,
  ThumbsDown,
  Phone,
  MoreVertical,
  Edit2,
  ChevronDown,
  ChevronUp,
  Instagram,
  Globe,
  MessageCircle,
  Search,
  AlertTriangle,
  FileEdit,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ClientLead, ClientLeadConfig } from '../types';
import { useLeadTracker } from '../hooks/useLeadTracker';
import { BRAZILIAN_STATES } from '../constants';

dayjs.locale('pt-br');

const CHART_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];

const DroppableColumn = ({ id, children }: { id: string, children: React.ReactNode }) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="flex-1 overflow-y-auto space-y-3 pr-2 pb-2 custom-scrollbar min-h-[150px]">
      {children}
    </div>
  );
};

interface LeadTrackerViewProps {
  clientId: string;
  config: ClientLeadConfig;
  onBack: () => void;
}

const LOSS_REASONS = [
  'Sem retorno',
  'Honorários acima do esperado',
  'Escolheu outro escritório',
  'Fora da área de atuação',
  'Lead inválido',
  'Desistiu de resolver',
  'Caso sem viabilidade',
  'Localização não atendida',
  'Outro'
];

const LEAD_SOURCES = [
  'Google Ads',
  'Instagram',
  'Indicação',
  'Site orgânico',
  'Outro'
];

export const isContractSentStage = (stageName?: string) => {
  if (!stageName) return false;
  const lower = stageName.toLowerCase();
  if (lower === 'fechado' || lower === 'perdido' || lower.includes('assinado') || lower.includes('concluido') || lower.includes('concluído')) {
    return false;
  }
  return (
    lower.includes('contrato enviado') || 
    lower.includes('proposta enviada') || 
    lower.includes('enviado') ||
    lower.includes('contrato') || 
    lower.includes('proposta')
  );
};

export const LeadTrackerView: React.FC<LeadTrackerViewProps> = ({ clientId, config, onBack }) => {
  const { fetchLeads, addLead, updateLead, deleteLead, updateLeadStage, updateLeadsPositions } = useLeadTracker();
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [loading, setLoading] = useState(true);
  
  // CRM Tabs & Views
  const [activeCRMTab, setActiveCRMTab] = useState<'relatorio' | 'funil' | 'fechados' | 'perdidos'>('relatorio');
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedLeadForView, setSelectedLeadForView] = useState<ClientLead | null>(null);
  const [closedAtDate, setClosedAtDate] = useState('');
  
  // Filtros opcionais para listagens
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isWonModalOpen, setIsWonModalOpen] = useState(false);
  const [winNotes, setWinNotes] = useState('');
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [leadToLose, setLeadToLose] = useState<string | null>(null);
  const [leadToWin, setLeadToWin] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [customLossReason, setCustomLossReason] = useState('');
  const [dealValue, setDealValue] = useState<number>(0);
  const [isContractValueModalOpen, setIsContractValueModalOpen] = useState(false);
  const [leadForContractValue, setLeadForContractValue] = useState<string | null>(null);
  const [contractValueStage, setContractValueStage] = useState<string>('');
  const [estimatedContractValue, setEstimatedContractValue] = useState<number>(0);
  const [editingLead, setEditingLead] = useState<ClientLead | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'));

  // Drag and Drop State
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Kanban State
  const [showLost, setShowLost] = useState(false);
  const stages = useMemo(() => {
    const s = config.kanban_stages || ['Novo Lead', 'Em Contato', 'Reunião Agendada', 'Proposta Enviada', 'Fechado'];
    return s.filter(stage => stage !== 'Perdido');
  }, [config.kanban_stages]);
  
  // Form state for new/edit lead
  const defaultLeadState: Partial<ClientLead> = {
    lead_name: '',
    phone: '',
    lead_date: dayjs().format('YYYY-MM-DD'),
    source: LEAD_SOURCES[0],
    origin: config.location_options?.[0] || '',
    specialty: config.specialty_options?.[0] || '',
    potential: null,
    notes: '',
    kanban_stage: stages[0],
    quality: 'bom', // default required by db
    quote_sent: false, // default required by db
    closed: false, // default required by db
    deal_value: 0 // default required by db
  };
  
  const [formData, setFormData] = useState<Partial<ClientLead>>(defaultLeadState);

  const loadData = async () => {
    setLoading(true);
    // Fetch ALL leads for the Kanban
    const allLeads = await fetchLeads(clientId);
    setLeads(allLeads);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [clientId]);

  const stats = useMemo(() => {
    const monthLeads = leads.filter(l => (l.lead_date || l.created_at).startsWith(selectedMonth));
    
    const total = monthLeads.length;
    // Usar closed_at para calculos de fechados, com fallback para lead_date se null
    const closedLeads = leads.filter(l => {
      if (l.kanban_stage !== 'Fechado') return false;
      const dateToUse = l.closed_at || l.lead_date || l.created_at;
      return dateToUse.startsWith(selectedMonth);
    });
    const closedMonth = closedLeads.length;
    
    const revenue = closedLeads.reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);
    const conversionRate = total > 0 ? Math.round((closedMonth / total) * 100) : 0;
    
    // Propostas enviadas (inclui leads que têm a flag quote_sent = true ou estão atualmente na etapa de proposta)
    const contractSentLeads = monthLeads.filter(l => l.quote_sent || (l.kanban_stage && isContractSentStage(l.kanban_stage)));
    const contractSentRevenue = contractSentLeads.reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);
    const contractSentCount = contractSentLeads.length;

    // Loss reasons breakdown
    const lostLeads = monthLeads.filter(l => l.kanban_stage === 'Perdido' && l.loss_reason);
    const reasonCounts = lostLeads.reduce((acc, l) => {
      acc[l.loss_reason!] = (acc[l.loss_reason!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const reasonData = Object.entries(reasonCounts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([name, value]) => ({ name, value }));
      
    return { 
      total, 
      closedMonth, 
      conversionRate, 
      revenue, 
      reasonData, 
      lostCount: lostLeads.length,
      contractSentRevenue,
      contractSentCount
    };
  }, [leads, selectedMonth]);

  const last6MonthsData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const m = dayjs().subtract(i, 'month');
      const prefix = m.format('YYYY-MM');
      const label = m.format('MM/YY'); // Formato pt-BR simples como "06/26"

      const leadsInMonth = leads.filter(l => (l.lead_date || l.created_at).startsWith(prefix));
      const closedInMonth = leads.filter(l => l.kanban_stage === 'Fechado' && (l.closed_at || l.lead_date || l.created_at).startsWith(prefix));

      data.push({
        name: label,
        'Novos Leads': leadsInMonth.length,
        'Contratos Fechados': closedInMonth.length
      });
    }
    return data;
  }, [leads]);

  const statsFechados = useMemo(() => {
    const closedLeads = leads.filter(l => l.kanban_stage === 'Fechado');
    const totalRevenue = closedLeads.reduce((acc, lead) => acc + (lead.deal_value || 0), 0);
    
    // Meses específicos para o dashboard
    const monthsData = [];
    const currentYear = dayjs().year();
    
    // Pegar os últimos 4 meses incluindo o atual
    for (let i = 3; i >= 0; i--) {
      const mDate = dayjs().subtract(i, 'month');
      const prefix = mDate.format('YYYY-MM');
      const mLeads = closedLeads.filter(l => (l.closed_at || l.lead_date || l.created_at).startsWith(prefix));
      const revenue = mLeads.reduce((acc, l) => acc + (l.deal_value || 0), 0);
      
      monthsData.push({
        label: mDate.format('MMMM'),
        value: revenue,
        count: mLeads.length
      });
    }

    return { totalRevenue, count: closedLeads.length, monthsData };
  }, [leads]);

  const statsPerdidos = useMemo(() => {
    const lostLeads = leads.filter(l => l.kanban_stage === 'Perdido');
    const reasonCounts: Record<string, number> = {};
    
    lostLeads.forEach(l => {
      const r = l.loss_reason || 'Outro';
      reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    });

    const reasonData = Object.entries(reasonCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { total: lostLeads.length, reasonData };
  }, [leads]);

  const handleOpenAddModal = () => {
    setEditingLead(null);
    setFormData({
      ...defaultLeadState,
      origin: '',
      specialty: config.specialty_options?.[0] || '',
      kanban_stage: stages[0]
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (lead: ClientLead) => {
    setEditingLead(lead);
    setFormData({
      ...lead
    });
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (lead: ClientLead) => {
    setSelectedLeadForView(lead);
    setIsViewModalOpen(true);
  };

  const handleExportCSV = () => {
    if (!leads || leads.length === 0) return;

    const headers = [
      'Nome do Lead',
      'Telefone',
      'Data do Lead',
      'Canal/Origem de Tráfego',
      'Unidade/Cidade',
      'Especialidade',
      'Potencial',
      'Qualidade',
      'Valor do Acordo',
      'Etapa do Funil',
      'Motivo da Perda',
      'Notas'
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      str = str.replace(/"/g, '""');
      if (str.includes(';') || str.includes('\n') || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    };

    const csvRows = [headers.join(';')];

    leads.forEach(lead => {
      const row = [
        escapeCSV(lead.lead_name || ''),
        escapeCSV(lead.phone || ''),
        escapeCSV(lead.lead_date ? new Date(lead.lead_date).toLocaleDateString('pt-BR') : ''),
        escapeCSV(lead.source || ''),
        escapeCSV(lead.origin || ''),
        escapeCSV(lead.specialty || ''),
        escapeCSV(lead.potential || ''),
        escapeCSV(lead.quality || ''),
        escapeCSV(lead.deal_value || 0),
        escapeCSV(lead.kanban_stage || ''),
        escapeCSV(lead.loss_reason || ''),
        escapeCSV(lead.notes || '')
      ];
      csvRows.push(row.join(';'));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    link.setAttribute('download', `leads_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveLead = async () => {
    if (!formData.lead_name?.trim()) {
      alert('Nome do Lead é obrigatório.');
      return;
    }
    if (!formData.potential) {
      alert('Selecione o potencial do lead.');
      return;
    }
    if (!formData.notes?.trim()) {
      alert('Observações é obrigatório. Registre o que o lead procura.');
      return;
    }

    try {
      if (editingLead) {
        await updateLead(editingLead.id, {
          lead_name: formData.lead_name,
          phone: formData.phone,
          lead_date: formData.lead_date,
          source: formData.source,
          origin: formData.origin,
          specialty: formData.specialty,
          potential: formData.potential,
          notes: formData.notes
        });
      } else {
        // Get max position for the stage
        const stageLeads = leads.filter(l => l.kanban_stage === (formData.kanban_stage || stages[0]));
        const maxPos = stageLeads.length > 0 ? Math.max(...stageLeads.map(l => l.position || 0)) : -1;

        await addLead({
          client_id: clientId,
          lead_date: formData.lead_date || dayjs().format('YYYY-MM-DD'),
          lead_name: formData.lead_name,
          phone: formData.phone,
          source: formData.source,
          origin: formData.origin || '',
          specialty: formData.specialty,
          potential: formData.potential,
          notes: formData.notes,
          kanban_stage: formData.kanban_stage || stages[0],
          position: maxPos + 1,
          quality: 'bom',
          quote_sent: false,
          closed: false,
          deal_value: 0
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteLead = (id: string) => {
    setLeadToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteLead = async () => {
    if (!leadToDelete) return;
    try {
      await deleteLead(leadToDelete);
      setIsDeleteModalOpen(false);
      setLeadToDelete(null);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeLead = leads.find(l => l.id === activeId);
    if (!activeLead) return;

    // Find the stage we are dragging over
    let overStage: string | undefined;
    if (stages.concat(['Perdido']).includes(overId)) {
      overStage = overId;
    } else {
      const overLead = leads.find(l => l.id === overId);
      overStage = overLead?.kanban_stage;
    }

    if (overStage && activeLead.kanban_stage !== overStage) {
      setLeads(prev => {
        const activeIndex = prev.findIndex(l => l.id === activeId);
        const newLeads = [...prev];
        newLeads[activeIndex] = { ...activeLead, kanban_stage: overStage };
        return newLeads;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeLead = leads.find(l => l.id === activeId);
    if (!activeLead) return;

    // Determine the target stage
    let targetStage = overId;
    if (!stages.concat(['Perdido']).includes(overId)) {
      const overLead = leads.find(l => l.id === overId);
      targetStage = overLead?.kanban_stage || activeLead.kanban_stage;
    }

    if (targetStage === 'Perdido' && activeLead.kanban_stage !== 'Perdido') {
      setLeadToLose(activeId);
      setLossReason(LOSS_REASONS[0]);
      setIsLossModalOpen(true);
      return;
    }

    if (targetStage === 'Fechado' && activeLead.kanban_stage !== 'Fechado') {
      setLeadToWin(activeId);
      setDealValue(0);
      setClosedAtDate('');
      setWinNotes('');
      setIsWonModalOpen(true);
      return;
    }

    if (isContractSentStage(targetStage) && activeLead.kanban_stage !== targetStage) {
      setLeadForContractValue(activeId);
      setContractValueStage(targetStage);
      setEstimatedContractValue(activeLead.deal_value || 0);
      setIsContractValueModalOpen(true);
      return;
    }

    // Reorder within the same stage or move to new stage
    const stageLeads = leads.filter(l => l.kanban_stage === targetStage);
    const oldIndex = stageLeads.findIndex(l => l.id === activeId);
    const newIndex = stageLeads.findIndex(l => l.id === overId);

    if (activeLead.kanban_stage !== targetStage) {
      await updateLeadStage(activeId, targetStage);
    }

    if (newIndex !== -1 && oldIndex !== newIndex) {
      const reorderedStageLeads = arrayMove(stageLeads, oldIndex, newIndex) as ClientLead[];
      const updatedPositions = reorderedStageLeads.map((l, i) => ({
        id: l.id,
        position: i,
        kanban_stage: targetStage
      }));
      
      await updateLeadsPositions(updatedPositions);
    }

    loadData();
  };

  const handleMoveStage = async (leadId: string, newStage: string) => {
    if (newStage === 'Perdido') {
      setLeadToLose(leadId);
      setLossReason(LOSS_REASONS[0]);
      setIsLossModalOpen(true);
      return;
    }

    if (newStage === 'Fechado') {
      setLeadToWin(leadId);
      setDealValue(0);
      setClosedAtDate('');
      setWinNotes('');
      setIsWonModalOpen(true);
      return;
    }

    if (isContractSentStage(newStage)) {
      setLeadForContractValue(leadId);
      setContractValueStage(newStage);
      const lead = leads.find(l => l.id === leadId);
      setEstimatedContractValue(lead?.deal_value || 0);
      setIsContractValueModalOpen(true);
      return;
    }

    try {
      await updateLeadStage(leadId, newStage);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmLoss = async () => {
    if (!leadToLose || !lossReason) return;
    try {
      // Confirma a perda do lead
      const finalReason = lossReason === 'Outro' ? (customLossReason || 'Outro') : lossReason;
      await updateLeadStage(leadToLose, 'Perdido', finalReason);
      setIsLossModalOpen(false);
      setLeadToLose(null);
      setCustomLossReason('');
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmWin = async () => {
    if (!leadToWin) return;
    if (!closedAtDate) {
      alert('A data de fechamento é obrigatória.');
      return;
    }
    try {
      // Confirma o ganho do lead
      await updateLead(leadToWin, { 
         kanban_stage: 'Fechado', 
         closed: true, 
         deal_value: dealValue,
         closed_at: closedAtDate,
         notes: winNotes || undefined
      });
      setIsWonModalOpen(false);
      setLeadToWin(null);
      setWinNotes('');
      setClosedAtDate('');
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmContractValue = async () => {
    if (!leadForContractValue || !contractValueStage) return;
    try {
      await updateLead(leadForContractValue, {
        kanban_stage: contractValueStage,
        deal_value: estimatedContractValue,
        quote_sent: true
      });
      setIsContractValueModalOpen(false);
      setLeadForContractValue(null);
      setContractValueStage('');
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateDealValue = async (id: string, value: number) => {
    try {
      await updateLead(id, { deal_value: value });
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'Google Ads': return <Search size={12} />;
      case 'Instagram': return <Instagram size={12} />;
      case 'Site orgânico': return <Globe size={12} />;
      case 'Indicação': return <Users size={12} />;
      default: return <MessageCircle size={12} />;
    }
  };

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped: Record<string, ClientLead[]> = {};
    stages.forEach(s => {
      if (s !== 'Perdido') grouped[s] = [];
    });
    grouped['Perdido'] = [];
    
    leads.forEach(lead => {
      if (lead.kanban_stage === 'Fechado') {
        const dateToUse = lead.closed_at || lead.lead_date || lead.created_at;
        if (!dateToUse.startsWith(selectedMonth)) {
          return; // Skip closed leads not from selected month
        }
      } else if (lead.kanban_stage === 'Perdido') {
        if (!(lead.lead_date || lead.created_at).startsWith(selectedMonth)) {
          return; // Skip lost leads not from selected month
        }
      }

      const stage = lead.kanban_stage || stages[0];
      if (grouped[stage]) {
        grouped[stage].push(lead);
      } else if (stage !== 'Perdido') {
        // Fallback if stage was removed from config
        grouped[stages[0]].push(lead);
      }
    });
    return grouped;
  }, [leads, stages, selectedMonth]);

  const filteredClosedLeads = useMemo(() => {
    return leads
      .filter(l => l.kanban_stage === 'Fechado')
      .filter(l => !filterSpecialty || l.specialty === filterSpecialty)
      .filter(l => !filterSource || l.source === filterSource)
      .filter(l => !filterOrigin || l.origin === filterOrigin)
      .sort((a, b) => {
        const dateA = a.closed_at || a.lead_date || a.created_at || '';
        const dateB = b.closed_at || b.lead_date || b.created_at || '';
        return dateB.localeCompare(dateA);
      });
  }, [leads, filterSpecialty, filterSource, filterOrigin]);

  const filteredLostLeads = useMemo(() => {
    return leads
      .filter(l => l.kanban_stage === 'Perdido')
      .filter(l => !filterSpecialty || l.specialty === filterSpecialty)
      .filter(l => !filterSource || l.source === filterSource)
      .filter(l => !filterOrigin || l.origin === filterOrigin)
      .sort((a, b) => {
        const dateA = a.lead_date || a.created_at || '';
        const dateB = b.lead_date || b.created_at || '';
        return dateB.localeCompare(dateA);
      });
  }, [leads, filterSpecialty, filterSource, filterOrigin]);

  const MONTHS_LIST = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ];

  const YEARS_LIST = useMemo(() => {
    const thisYear = dayjs().year();
    return [
      String(thisYear),
      String(thisYear - 1),
      String(thisYear - 2)
    ];
  }, []);

  const handleMonthChange = (monthVal: string) => {
    const yearVal = selectedMonth.split('-')[0];
    setSelectedMonth(`${yearVal}-${monthVal}`);
  };

  const handleYearChange = (yearVal: string) => {
    const monthVal = selectedMonth.split('-')[1];
    setSelectedMonth(`${yearVal}-${monthVal}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 min-h-[calc(100vh-120px)] flex flex-col">
      {/* Styled Title Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-[#111111] text-white p-8 sm:p-12 shrink-0">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
          <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 2px, transparent 2px)', backgroundSize: '24px 24px' }} />
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-white/50 text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
              <Users size={12} />
              <span>Acompanhamento de Leads</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-serif italic tracking-tight mb-6">
              CRM & Oportunidades
            </h1>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/70">
              <TrendingUp size={14} />
              <span>Gerencie seu funil de vendas</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleExportCSV}
              disabled={leads.length === 0}
              className={`flex items-center gap-2 px-5 py-2.5 border rounded-xl font-bold text-xs uppercase tracking-widest transition-colors ${
                leads.length === 0
                  ? 'bg-white/5 text-white/40 border-white/10 cursor-not-allowed opacity-60'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title="Exportar todos os leads para CSV"
            >
              <Download size={18} />
              <span>Exportar</span>
            </button>
            <button 
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-xl font-bold hover:bg-gray-100 transition-colors"
            >
              <Plus size={20} />
              <span>Novo Lead</span>
            </button>
          </div>
        </div>
      </div>

      {/* CRM Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black/[0.05] pb-2 gap-4 shrink-0">
        <div className="flex border-b-0 gap-6 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveCRMTab('relatorio')}
            className={`pb-3 font-bold text-xs uppercase tracking-widest transition-all relative whitespace-nowrap px-1 ${
              activeCRMTab === 'relatorio' ? 'text-brand-dark font-black' : 'text-gray-400 hover:text-brand-dark'
            }`}
          >
            📈 Relatório & Métricas
            {activeCRMTab === 'relatorio' && <motion.div layoutId="activeCRMTabLine" className="absolute bottom-0 inset-x-0 h-0.5 bg-brand-dark" />}
          </button>
          <button
            onClick={() => setActiveCRMTab('funil')}
            className={`pb-3 font-bold text-xs uppercase tracking-widest transition-all relative whitespace-nowrap px-1 ${
              activeCRMTab === 'funil' ? 'text-brand-dark font-black' : 'text-gray-400 hover:text-brand-dark'
            }`}
          >
            📊 Funil / Kanban
            {activeCRMTab === 'funil' && <motion.div layoutId="activeCRMTabLine" className="absolute bottom-0 inset-x-0 h-0.5 bg-brand-dark" />}
          </button>
          <button
            onClick={() => setActiveCRMTab('fechados')}
            className={`pb-3 font-bold text-xs uppercase tracking-widest transition-all relative whitespace-nowrap px-1 ${
              activeCRMTab === 'fechados' ? 'text-brand-dark font-black' : 'text-gray-400 hover:text-brand-dark'
            }`}
          >
            🤝 Contratos Fechados
            {activeCRMTab === 'fechados' && <motion.div layoutId="activeCRMTabLine" className="absolute bottom-0 inset-x-0 h-0.5 bg-brand-dark" />}
          </button>
          <button
            onClick={() => setActiveCRMTab('perdidos')}
            className={`pb-3 font-bold text-xs uppercase tracking-widest transition-all relative whitespace-nowrap px-1 ${
              activeCRMTab === 'perdidos' ? 'text-brand-dark font-black' : 'text-gray-400 hover:text-brand-dark'
            }`}
          >
            💔 Leads Perdidos
            {activeCRMTab === 'perdidos' && <motion.div layoutId="activeCRMTabLine" className="absolute bottom-0 inset-x-0 h-0.5 bg-brand-dark" />}
          </button>
        </div>

        {/* Seletor de mês visual de dois dropdowns */}
        {(activeCRMTab === 'funil' || activeCRMTab === 'relatorio') && (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 bg-gray-50 border border-black/[0.05] p-1.5 rounded-2xl">
            <select
              value={selectedMonth.split('-')[1]}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-brand-dark focus:ring-0 outline-none border-none py-1.5 pl-3 pr-8 cursor-pointer select-none"
            >
              {MONTHS_LIST.map(m => (
                <option key={m.value} value={m.value} className="bg-white text-gray-800 font-medium py-1">{m.label}</option>
              ))}
            </select>

            <select
              value={selectedMonth.split('-')[0]}
              onChange={(e) => handleYearChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-brand-dark focus:ring-0 outline-none border-none py-1.5 pl-3 pr-8 cursor-pointer select-none border-l border-black/[0.05]"
            >
              {YEARS_LIST.map(y => (
                <option key={y} value={y} className="bg-white text-gray-800 font-medium py-1">{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeCRMTab === 'funil' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 min-h-[800px]">
            <div className="flex gap-6 h-full min-w-max">
              {/* Active Stages */}
              {stages.map(stage => (
                <div key={stage} className="w-80 flex flex-col h-full bg-gray-50/10 rounded-[2rem] p-4 border border-black/[0.01]">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="font-bold text-gray-700 text-sm">{stage}</h3>
                    <span className="bg-white border border-black/[0.05] text-gray-500 text-xs font-bold px-2.5 py-1 rounded-full">
                      {leadsByStage[stage]?.length || 0}
                    </span>
                  </div>
                  
                  <SortableContext 
                    id={stage}
                    items={leadsByStage[stage]?.map(l => l.id) || []}
                    strategy={verticalListSortingStrategy}
                  >
                    <DroppableColumn id={stage}>
                      {leadsByStage[stage]?.length > 0 ? (
                        leadsByStage[stage]?.map(lead => (
                          <LeadCard 
                            key={lead.id} 
                            lead={lead} 
                            stages={stages} 
                            onMove={handleMoveStage}
                            onEdit={() => handleOpenEditModal(lead)}
                            onDelete={() => handleDeleteLead(lead.id)}
                            onUpdateDealValue={handleUpdateDealValue}
                            getSourceIcon={getSourceIcon}
                            onView={() => handleOpenViewModal(lead)}
                          />
                        ))
                      ) : (
                        <div className="py-8 text-center text-xs text-gray-400 italic">
                          Nenhum lead nesta etapa
                        </div>
                      )}
                    </DroppableColumn>
                  </SortableContext>
                </div>
              ))}

              {/* Lost Column (Special) */}
              <div className={`flex flex-col h-full transition-all duration-300 bg-red-50/10 rounded-[2rem] p-4 border border-red-500/[0.02] ${showLost ? 'w-80' : 'w-16'}`}>
                <div className="flex items-center justify-between mb-4 px-2">
                  {showLost ? (
                    <>
                      <h3 className="font-bold text-red-750 text-sm">Perdido</h3>
                      <div className="flex items-center gap-2">
                        <span className="bg-white border border-red-100/50 text-red-600 text-xs font-bold px-2.5 py-1 rounded-full">
                          {leadsByStage['Perdido']?.length || 0}
                        </span>
                        <button onClick={() => setShowLost(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                          <ChevronLeft size={16} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center w-full gap-4 pt-2">
                      <button 
                        onClick={() => setShowLost(true)}
                        className="bg-red-50 text-red-650 text-xs font-bold px-2 py-2 rounded-full hover:bg-red-100 transition-colors"
                        title="Ver Perdidos"
                      >
                        {leadsByStage['Perdido']?.length || 0}
                      </button>
                    </div>
                  )}
                </div>
                
                {showLost && (
                  <SortableContext 
                    id="Perdido"
                    items={leadsByStage['Perdido']?.map(l => l.id) || []}
                    strategy={verticalListSortingStrategy}
                  >
                    <DroppableColumn id="Perdido">
                      {leadsByStage['Perdido']?.length > 0 ? (
                        leadsByStage['Perdido']?.map(lead => (
                          <LeadCard 
                            key={lead.id} 
                            lead={lead} 
                            stages={stages} 
                            onMove={handleMoveStage}
                            onEdit={() => handleOpenEditModal(lead)}
                            onDelete={() => handleDeleteLead(lead.id)}
                            onUpdateDealValue={handleUpdateDealValue}
                            getSourceIcon={getSourceIcon}
                            onView={() => handleOpenViewModal(lead)}
                          />
                        ))
                      ) : (
                        <div className="py-8 text-center text-xs text-gray-400 italic">
                          Nenhum lead marcado como perdido
                        </div>
                      )}
                    </DroppableColumn>
                  </SortableContext>
                )}
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.5',
                },
              },
            }),
          }}>
            {activeId ? (
              <LeadCard 
                lead={leads.find(l => l.id === activeId)!} 
                stages={stages} 
                onMove={() => {}} 
                onEdit={() => {}} 
                onDelete={() => {}} 
                onUpdateDealValue={() => {}} 
                getSourceIcon={getSourceIcon}
                onView={() => {}}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {activeCRMTab === 'fechados' && (
        <div className="flex-1 bg-white border border-black/[0.05] rounded-[2rem] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.03] pb-4">
            <div>
              <h2 className="text-xl font-bold text-brand-dark">Histórico de Contratos Fechados</h2>
              <p className="text-xs text-gray-400 mt-1 font-medium">Todos os fechamentos acumulados da agência (Histórico completo)</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterSpecialty}
                onChange={(e) => setFilterSpecialty(e.target.value)}
                className="bg-gray-50 border border-black/[0.05] rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-brand-dark outline-none cursor-pointer"
              >
                <option value="">Todas Especialidades</option>
                {config.specialty_options?.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>

              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="bg-gray-50 border border-black/[0.05] rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-brand-dark outline-none cursor-pointer"
              >
                <option value="">Todas as Fontes</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Instagram">Instagram</option>
                <option value="Site orgânico">Site orgânico</option>
                <option value="Indicação">Indicação</option>
              </select>

              <select
                value={filterOrigin}
                onChange={(e) => setFilterOrigin(e.target.value)}
                className="bg-gray-50 border border-black/[0.05] rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-brand-dark outline-none cursor-pointer"
              >
                <option value="">Todas Localidades</option>
                {BRAZILIAN_STATES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mini Dashboard de Fechados */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
            <div className="bg-emerald-50/30 border border-emerald-500/10 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-800/60 mb-1">Total Geral</span>
              <div className="text-xl font-black text-emerald-900 tracking-tight">
                {statsFechados.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-[9px] font-bold text-emerald-600/40">{statsFechados.count} contratos fechados</div>
            </div>
            {statsFechados.monthsData.map(m => (
              <div key={m.label} className="bg-white border border-black/[0.05] rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                <span className="text-[10px] uppercase font-bold text-gray-400 mb-1">{m.label}</span>
                <div className="text-sm font-black text-gray-900 tracking-tight">
                  {m.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div className="text-[9px] font-bold text-brand-dark/40">{m.count} contratos</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto min-w-full">
            {filteredClosedLeads.length > 0 ? (
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-black/[0.03] text-[10px] uppercase tracking-wider font-bold text-gray-400">
                    <th className="pb-3 pl-2">Fechamento</th>
                    <th className="pb-3">Nome</th>
                    <th className="pb-3">Telefone</th>
                    <th className="pb-3">Especialidade</th>
                    <th className="pb-3">Local</th>
                    <th className="pb-3">Potencial</th>
                    <th className="pb-3">Valor</th>
                    <th className="pb-3 pr-2 text-right">Canal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.02]">
                  {filteredClosedLeads.map(lead => {
                    const closedDate = lead.closed_at || lead.lead_date || lead.created_at;
                    return (
                      <tr 
                        key={lead.id} 
                        onClick={() => handleOpenViewModal(lead)}
                        className="text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 pl-2 text-emerald-700 font-bold">
                          {dayjs(closedDate).format('DD/MM/YYYY')}
                        </td>
                        <td className="py-3.5 font-bold text-gray-900">{lead.lead_name}</td>
                        <td className="py-3.5 text-gray-500 font-normal">{lead.phone || '—'}</td>
                        <td className="py-3.5 italic text-brand-dark">{lead.specialty || '—'}</td>
                        <td className="py-3.5 uppercase text-gray-500">{lead.origin || '—'}</td>
                        <td className="py-3.5">
                          {lead.potential === 'alto' && <span className="text-green-700 font-bold">🔥 Alto</span>}
                          {lead.potential === 'medio' && <span className="text-yellow-700 font-bold">⚡ Médio</span>}
                          {lead.potential === 'baixo' && <span className="text-gray-600 font-bold">❄️ Baixo</span>}
                        </td>
                        <td className="py-3.5 text-emerald-800 font-black">
                          {Number(lead.deal_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3.5 pr-2 text-right text-brand-dark flex items-center justify-end gap-1.5 font-normal text-[10px] uppercase tracking-wider mt-1.5">
                          {getSourceIcon(lead.source)}
                          <span>{lead.source || '—'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-sm text-gray-400 italic">
                Nenhum lead fechado encontrado com os filtros aplicados
              </div>
            )}
          </div>
        </div>
      )}

      {activeCRMTab === 'perdidos' && (
        <div className="flex-1 bg-white border border-black/[0.05] rounded-[2rem] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.03] pb-4">
            <div>
              <h2 className="text-xl font-bold text-red-700">Histórico de Leads Perdidos</h2>
              <p className="text-xs text-gray-400 mt-1 font-medium">Todas as oportunidades perdidas no funil comercial</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterSpecialty}
                onChange={(e) => setFilterSpecialty(e.target.value)}
                className="bg-gray-50 border border-black/[0.05] rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-brand-dark outline-none cursor-pointer"
              >
                <option value="">Todas Especialidades</option>
                {config.specialty_options?.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>

              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="bg-gray-50 border border-black/[0.05] rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-brand-dark outline-none cursor-pointer"
              >
                <option value="">Todas as Fontes</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Instagram">Instagram</option>
                <option value="Site orgânico">Site orgânico</option>
                <option value="Indicação">Indicação</option>
              </select>
            </div>
          </div>

          {/* Mini Dashboard de Perdidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 shrink-0">
            {statsPerdidos.reasonData.slice(0, 6).map(entry => (
              <div key={entry.name} className="bg-white border border-black/[0.05] rounded-2xl p-3 flex flex-col justify-between shadow-sm">
                <span className="text-[9px] uppercase font-bold text-gray-400 line-clamp-1">{entry.name}</span>
                <div className="flex items-end justify-between mt-1">
                  <div className="text-lg font-black text-red-700 tracking-tighter">{entry.value}</div>
                  <div className="text-[8px] font-bold text-red-300">{statsPerdidos.total > 0 ? ((entry.value / statsPerdidos.total) * 100).toFixed(0) : 0}%</div>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto min-w-full">
            {filteredLostLeads.length > 0 ? (
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-black/[0.03] text-[10px] uppercase tracking-wider font-bold text-gray-400">
                    <th className="pb-3 pl-2">Data do Lead</th>
                    <th className="pb-3">Nome</th>
                    <th className="pb-3">Telefone</th>
                    <th className="pb-3">Especialidade</th>
                    <th className="pb-3">Local</th>
                    <th className="pb-3">Motivo da Perda</th>
                    <th className="pb-3 pr-2 text-right">Canal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.02]">
                  {filteredLostLeads.map(lead => {
                    const leadDate = lead.lead_date || lead.created_at;
                    return (
                      <tr 
                        key={lead.id} 
                        onClick={() => handleOpenViewModal(lead)}
                        className="text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 pl-2 text-gray-400">
                          {dayjs(leadDate).format('DD/MM/YYYY')}
                        </td>
                        <td className="py-3.5 font-bold text-gray-900">{lead.lead_name}</td>
                        <td className="py-3.5 text-gray-500 font-normal">{lead.phone || '—'}</td>
                        <td className="py-3.5 italic text-brand-dark">{lead.specialty || '—'}</td>
                        <td className="py-3.5 uppercase text-gray-500">{lead.origin || '—'}</td>
                        <td className="py-3.5 text-red-600 font-bold">
                          {lead.loss_reason || '—'}
                        </td>
                        <td className="py-3.5 pr-2 text-right text-brand-dark flex items-center justify-end gap-1.5 font-normal text-[10px] uppercase tracking-wider mt-1.5">
                          {getSourceIcon(lead.source)}
                          <span>{lead.source || '—'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-sm text-gray-400 italic">
                Nenhum lead perdido encontrado com os filtros aplicados
              </div>
            )}
          </div>
        </div>
      )}

      {activeCRMTab === 'relatorio' && (
        <div className="space-y-8">
          {/* Mini Dashboard de Relatórios */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 shrink-0">
            <div className="premium-card p-6 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Users size={20} />
                </div>
                <span className="premium-label">Leads no Mês</span>
              </div>
              <div className="text-4xl font-bold tracking-tighter">{stats.total}</div>
            </div>

            <div className="premium-card p-6 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <CheckSquare size={20} />
                </div>
                <span className="premium-label">Fechados no Mês</span>
              </div>
              <div className="text-4xl font-bold tracking-tighter text-emerald-600">{stats.closedMonth}</div>
            </div>

            <div className="premium-card p-6 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <TrendingUp size={20} />
                </div>
                <span className="premium-label">Taxa de Conversão</span>
              </div>
              <div className="text-4xl font-bold tracking-tighter text-purple-600">{stats.conversionRate}%</div>
            </div>

            <div className="premium-card p-6 flex flex-col justify-between border-l-4 border-amber-500 bg-amber-50/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <FileText size={20} />
                </div>
                <span className="premium-label font-bold text-amber-800">Propostas Enviadas</span>
              </div>
              <div className="text-2xl font-black tracking-tight text-amber-700">
                {stats.contractSentRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-[10px] text-gray-400 mt-2 font-semibold">
                <div className="text-amber-600 font-bold flex items-center gap-1 mb-1">
                  <span>💼 Dinheiro na Mesa</span>
                </div>
                <div>{stats.contractSentCount} proposta{stats.contractSentCount === 1 ? '' : 's'} enviada{stats.contractSentCount === 1 ? '' : 's'} este mês</div>
              </div>
            </div>

            <div className="premium-card p-6 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <DollarSign size={20} />
                </div>
                <span className="premium-label">Faturamento CRM</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-emerald-700">
                {stats.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-[10px] text-gray-400 mt-1 font-semibold">
                Soma dos contratos fechados de fato
              </div>
            </div>
          </div>

          {/* Gráficos e Detalhes de Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Gráfico de Barras dos Últimos 6 Meses */}
            <div className="lg:col-span-2 bg-white border border-black/[0.05] rounded-[2rem] p-6 sm:p-8 shadow-sm">
              <h3 className="text-base font-bold text-brand-dark mb-1">Performance Comercial (Últimos 6 Meses)</h3>
              <p className="text-xs text-gray-400 mb-6 font-medium">Gráfico comparativo de Novos Leads vs Contratos Fechados</p>
              
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last6MonthsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                    <XAxis dataKey="name" stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                    <Bar dataKey="Novos Leads" fill="rgba(17,17,17,0.7)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Contratos Fechados" fill="rgba(16,185,129,0.8)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Motivos de Perda no Mês */}
            <div className="bg-white border border-black/[0.05] rounded-[2rem] p-6 sm:p-8 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-brand-dark mb-1">Perdas do Mês</h3>
                <p className="text-xs text-gray-400 mb-6">Motivos recorrentes na etapa de perda comercial</p>

                {stats.lostCount > 0 ? (
                  <div className="space-y-4">
                    {stats.reasonData.slice(0, 4).map((entry, index) => {
                      const perc = Math.round((entry.value / stats.lostCount) * 100);
                      return (
                        <div key={entry.name} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-gray-700">
                            <span>{entry.name}</span>
                            <span>{entry.value} ({perc}%)</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-red-400 rounded-full" 
                              style={{ width: `${perc}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-sm text-gray-400 italic">
                    Nenhum lead perdido neste período
                  </div>
                )}
              </div>

              {stats.lostCount > 0 && (
                <div className="mt-4 pt-4 border-t border-black/[0.03] flex items-center justify-between text-xs text-gray-500">
                  <span>Total de perdas no mês:</span>
                  <span className="font-bold text-red-600">{stats.lostCount} leads</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {isViewModalOpen && selectedLeadForView && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsViewModalOpen(false)}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar space-y-6"
            >
              <div className="flex items-start justify-between border-b border-black/[0.03] pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Ficha do Lead</span>
                  <h3 className="text-2xl font-bold tracking-tight text-brand-dark mt-1">
                    {selectedLeadForView.lead_name}
                  </h3>
                </div>
                <button onClick={() => setIsViewModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-full transition-colors mt-1">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <span className="text-[10px] uppercase font-black text-gray-400 block mb-1">Status Atual</span>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-dark/5 text-xs font-bold text-brand-dark">
                    <span>{selectedLeadForView.kanban_stage}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black text-gray-400 block mb-1">Potencial</span>
                  <div>
                    {selectedLeadForView.potential === 'alto' && <span className="text-xs font-bold text-green-700">🔥 Alto</span>}
                    {selectedLeadForView.potential === 'medio' && <span className="text-xs font-bold text-yellow-700">⚡ Médio</span>}
                    {selectedLeadForView.potential === 'baixo' && <span className="text-xs font-bold text-gray-600">❄️ Baixo</span>}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black text-gray-400 block mb-1">Especialidade</span>
                  <p className="text-sm font-semibold text-gray-800">{selectedLeadForView.specialty || '—'}</p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black text-gray-400 block mb-1">Faturamento Estimado</span>
                  <p className="text-sm font-extrabold text-emerald-800">
                    {Number(selectedLeadForView.deal_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black text-gray-400 block mb-1">Contato</span>
                  <p className="text-sm font-semibold text-gray-800">{selectedLeadForView.phone || '—'}</p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black text-gray-400 block mb-1">Canal de Origem</span>
                  <p className="text-xs font-bold text-brand-dark uppercase tracking-wider flex items-center gap-1.5 mt-1">
                    {getSourceIcon(selectedLeadForView.source)}
                    <span>{selectedLeadForView.source || '—'}</span>
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black text-gray-400 block mb-1">Estado / Região</span>
                  <p className="text-sm font-semibold uppercase text-gray-800">{selectedLeadForView.origin || '—'}</p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black text-gray-400 block mb-1">Data de Cadastro</span>
                  <p className="text-sm font-semibold text-gray-500">
                    {dayjs(selectedLeadForView.lead_date || selectedLeadForView.created_at).format('DD/MM/YYYY')}
                  </p>
                </div>
              </div>

              {selectedLeadForView.kanban_stage === 'Fechado' && (
                <div className="bg-emerald-50/50 border border-emerald-500/10 rounded-2xl p-4">
                  <span className="text-[10px] uppercase font-black text-emerald-800 block mb-1">Concluído em</span>
                  <p className="text-sm font-bold text-emerald-900">
                    {dayjs(selectedLeadForView.closed_at || selectedLeadForView.lead_date || selectedLeadForView.created_at).format('DD/MM/YYYY')}
                  </p>
                </div>
              )}

              {selectedLeadForView.kanban_stage === 'Perdido' && (
                <div className="bg-red-50/50 border border-red-500/10 rounded-2xl p-4">
                  <span className="text-[10px] uppercase font-black text-red-800 block mb-1">Motivo da Perda</span>
                  <p className="text-sm font-bold text-red-900">
                    {selectedLeadForView.loss_reason || '—'}
                  </p>
                </div>
              )}

              <div className="space-y-2 border-t border-black/[0.03] pt-4">
                <span className="text-[10px] uppercase font-black text-gray-400 block">Observações / Informações de Histórico</span>
                <div className="bg-gray-50 rounded-2xl p-4 text-xs font-medium text-gray-600 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {selectedLeadForView.notes || 'Nenhuma observação registrada.'}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    handleOpenEditModal(selectedLeadForView);
                  }}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-brand-dark rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Editar Dados
                </button>
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-5 py-2.5 bg-brand-dark text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  OK / Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold tracking-tight">{editingLead ? 'Editar Lead' : 'Novo Lead'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="premium-label mb-2 block">Nome do Lead *</label>
                  <input 
                    type="text"
                    value={formData.lead_name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, lead_name: e.target.value }))}
                    className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none"
                    placeholder="Ex: João Silva"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="premium-label mb-2 block">Telefone</label>
                    <input 
                      type="text"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none"
                      placeholder="Ex: 11 99999-9999"
                    />
                  </div>
                  <div>
                    <label className="premium-label mb-2 block">Data de Contato</label>
                    <input 
                      type="date"
                      value={formData.lead_date || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, lead_date: e.target.value }))}
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="premium-label mb-2 block">Fonte</label>
                    <select 
                      value={formData.source || LEAD_SOURCES[0]}
                      onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none"
                    >
                      {LEAD_SOURCES.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="premium-label mb-2 block">Origem (Local)</label>
                    <select 
                      value={formData.origin || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, origin: e.target.value }))}
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none"
                    >
                      <option value="">Selecione o estado...</option>
                      {BRAZILIAN_STATES.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="premium-label mb-2 block">Especialidade</label>
                  <select 
                    value={formData.specialty || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value }))}
                    className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none"
                  >
                    <option value="">Selecione...</option>
                    {config.specialty_options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="premium-label mb-2 block">Potencial *</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, potential: 'alto' }))}
                      className={`flex items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all text-xs font-bold ${
                        formData.potential === 'alto' 
                          ? 'bg-green-50 border-green-200 text-green-700 font-extrabold shadow-sm' 
                          : 'bg-white border-black/[0.05] text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      🔥 Alto
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, potential: 'medio' }))}
                      className={`flex items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all text-xs font-bold ${
                        formData.potential === 'medio' 
                          ? 'bg-yellow-50 border-yellow-200 text-yellow-700 font-extrabold shadow-sm' 
                          : 'bg-white border-black/[0.05] text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      ⚡ Médio
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, potential: 'baixo' }))}
                      className={`flex items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all text-xs font-bold ${
                        formData.potential === 'baixo' 
                          ? 'bg-gray-100 border-gray-300 text-gray-700 font-extrabold shadow-sm' 
                          : 'bg-white border-black/[0.05] text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      ❄️ Baixo
                    </button>
                  </div>
                </div>

                {formData.kanban_stage === 'Fechado' && (
                  <div>
                    <label className="premium-label mb-2 block font-black text-emerald-800">📅 Data do Contrato Fechado (De Fato)</label>
                    <input 
                      type="date"
                      value={formData.closed_at || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, closed_at: e.target.value }))}
                      className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-200 outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="premium-label mb-2 block">Observações *</label>
                  <textarea 
                    value={formData.notes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none min-h-[100px]"
                    placeholder="Registre o que o lead procura (Obrigatório)"
                  />
                </div>

                <button 
                  onClick={handleSaveLead}
                  className="w-full premium-button premium-button-primary py-4 mt-4"
                >
                  Salvar Lead
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isLossModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLossModalOpen(false)}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm relative z-10 shadow-2xl"
            >
              <h3 className="text-xl font-bold tracking-tight mb-6">Qual o motivo da perda?</h3>
              
              <select 
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none mb-6"
              >
                {LOSS_REASONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>

              {lossReason === 'Outro' && (
                <input
                  type="text"
                  value={customLossReason}
                  onChange={(e) => setCustomLossReason(e.target.value)}
                  placeholder="Especifique o motivo..."
                  className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none mb-6"
                />
              )}

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsLossModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmLoss}
                  className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isWonModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWonModalOpen(false)}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm relative z-10 shadow-2xl"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <DollarSign size={32} />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2 text-center">Contrato Fechado! 🎉</h3>
              <p className="text-sm text-gray-500 mb-6 text-center">Informe os detalhes do fechamento</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Data do Contrato (De Fato) *</label>
                  <input 
                    type="date"
                    value={closedAtDate}
                    onChange={(e) => setClosedAtDate(e.target.value)}
                    className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl py-3 px-4 text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-green/20 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Valor do Contrato</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                    <input 
                      type="number"
                      value={dealValue || ''}
                      onChange={(e) => setDealValue(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl py-4 pl-12 pr-4 text-lg font-bold focus:ring-2 focus:ring-brand-green/20 outline-none"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Motivo do Fechamento / Notas</label>
                  <textarea 
                    value={winNotes}
                    onChange={(e) => setWinNotes(e.target.value)}
                    className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none h-24 resize-none"
                    placeholder="Ex: Cliente fechou pacote trimestral..."
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsWonModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmWin}
                  disabled={!closedAtDate}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    !closedAtDate ? 'bg-gray-300 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20'
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm relative z-10 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">Excluir Lead?</h3>
              <p className="text-sm text-gray-500 mb-8">Esta ação não pode ser desfeita. Tem certeza que deseja remover este lead?</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDeleteLead}
                  className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isContractValueModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsContractValueModalOpen(false);
                setLeadForContractValue(null);
                setContractValueStage('');
                loadData();
              }}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm relative z-10 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText size={32} />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2 text-center">Proposta Enviada! 💼</h3>
              <p className="text-sm text-gray-500 mb-6 text-center">Informe o valor estimado da proposta que foi enviada para o lead (dinheiro na mesa!).</p>
              
              <div className="space-y-4 mb-6 text-left">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Valor da Proposta</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                    <input 
                      type="number"
                      value={estimatedContractValue || ''}
                      onChange={(e) => setEstimatedContractValue(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl py-4 pl-12 pr-4 text-lg font-bold focus:ring-2 focus:ring-brand-green/20 outline-none"
                      placeholder="0,00"
                      autoFocus
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setIsContractValueModalOpen(false);
                    setLeadForContractValue(null);
                    setContractValueStage('');
                    loadData();
                  }}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmContractValue}
                  className="flex-1 py-3 rounded-xl font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Subcomponent: Lead Card ---

interface LeadCardProps {
  lead: ClientLead;
  stages: string[];
  onMove: (id: string, stage: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateDealValue: (id: string, val: number) => void;
  getSourceIcon: (source?: string) => React.ReactNode;
  onView: () => void;
}

const LeadCard: React.FC<LeadCardProps & { isOverlay?: boolean }> = ({ 
  lead, 
  stages, 
  onMove, 
  onEdit, 
  onDelete, 
  onUpdateDealValue, 
  getSourceIcon,
  onView,
  isOverlay 
}) => {
  const isClosed = lead.kanban_stage === 'Fechado';
  const isLost = lead.kanban_stage === 'Perdido';
  const isContractStage = lead.kanban_stage && isContractSentStage(lead.kanban_stage);
  const showValueField = isClosed || isContractStage || lead.quote_sent;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.phone) {
      const cleanPhone = lead.phone.replace(/\D/g, '');
      window.open(`https://wa.me/55${cleanPhone}`, '_blank');
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('a') || target.closest('input')) {
      return;
    }
    onView();
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={`bg-white rounded-2xl p-4 shadow-sm border border-black/[0.05] group relative hover:shadow-md transition-shadow cursor-pointer ${isOverlay ? 'shadow-xl rotate-2 scale-105 z-50' : ''}`}
    >
      {/* Action Buttons (Hover) */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }} 
          className="p-1.5 text-gray-400 hover:text-brand-dark hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Edit2 size={14} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }} 
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Header */}
      <div className="pr-16 mb-3">
        <h4 className="font-bold text-gray-800 text-sm leading-tight mb-1">{lead.lead_name || 'Sem nome'}</h4>
        {lead.phone && (
          <button 
            onClick={handlePhoneClick}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
          >
            <Phone size={10} />
            {lead.phone}
          </button>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {lead.potential === 'alto' && (
          <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] font-bold">🔥 Alto</span>
        )}
        {lead.potential === 'medio' && (
          <span className="px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-800 text-[10px] font-bold">⚡ Médio</span>
        )}
        {lead.potential === 'baixo' && (
          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">❄️ Baixo</span>
        )}
        {lead.specialty && (
          <span className="px-2 py-0.5 rounded-md bg-brand-dark/5 text-brand-dark text-[10px] font-bold truncate max-w-[120px]">
            {lead.specialty}
          </span>
        )}
        {lead.origin && (
          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
            {lead.origin}
          </span>
        )}
        {lead.source && (
          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center gap-1" title={lead.source}>
            {getSourceIcon(lead.source)}
          </span>
        )}
      </div>

      {/* Notes Snippet */}
      {lead.notes && (
        <div className="mb-3 p-2 bg-gray-50 rounded-xl border border-black/[0.03] flex gap-2 items-start">
          <FileEdit size={12} className="text-gray-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-500 line-clamp-2 italic leading-relaxed">
            {lead.notes}
          </p>
        </div>
      )}

      {/* Deal Value (If Closed, Proposal Stage, or Quote was sent) */}
      {showValueField && (
        <div 
          className={`mb-3 rounded-lg p-2 border flex items-center justify-between ${
            isClosed 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
              : isLost 
                ? 'bg-red-50/70 border-red-200 text-red-700'
                : 'bg-amber-50/70 border-amber-200 text-amber-700'
          }`} 
          onPointerDown={e => e.stopPropagation()}
        >
          <span className="text-[10px] font-bold uppercase">
            {isClosed ? 'Valor Fechado' : isLost ? 'Valor Perdido' : 'Valor Estimado'}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold">R$</span>
            <input 
              type="number"
              defaultValue={lead.deal_value || 0}
              onBlur={(e) => onUpdateDealValue(lead.id, Number(e.target.value))}
              className={`bg-transparent border-none p-0 w-16 text-xs font-bold focus:ring-0 text-right ${
                isClosed 
                  ? 'text-emerald-700' 
                  : isLost 
                    ? 'text-red-700'
                    : 'text-amber-700'
              }`}
            />
          </div>
        </div>
      )}

      {/* Loss Reason (If Lost) */}
      {isLost && lead.loss_reason && (
        <div className="mb-3 bg-red-50 rounded-lg p-2 border border-red-100">
          <span className="text-[10px] font-bold text-red-700 uppercase block mb-0.5">Motivo da perda</span>
          <span className="text-xs text-red-600 font-medium">{lead.loss_reason}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-3 border-t border-black/[0.05]">
        <span className="text-[10px] text-gray-400 font-medium" title="Data de Contato">
          {dayjs(lead.lead_date || lead.created_at).format('DD/MM/YYYY')}
        </span>
        
        <div className="relative" onPointerDown={e => e.stopPropagation()}>
          <select
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            value={lead.kanban_stage || ''}
            onChange={(e) => onMove(lead.id, e.target.value)}
          >
            <option value="" disabled>Mover para...</option>
            {stages.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="Perdido">Perdido</option>
          </select>
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-brand-dark transition-colors pointer-events-none">
            Mover para <ChevronDown size={12} />
          </div>
        </div>
      </div>
    </div>
  );
};

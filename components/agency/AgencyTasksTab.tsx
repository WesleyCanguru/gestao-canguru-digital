import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Calendar, 
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  MoreVertical,
  X,
  Settings2,
  Check,
  Edit2,
  Image as ImageIcon,
  Video,
  Megaphone,
  BarChart3,
  Clock,
  Briefcase,
  Repeat,
  GripVertical
} from 'lucide-react';
import { supabase, useAuth } from '../../lib/supabase';
import { AgencyTask, AgencyTaskPriority, AgencyTaskRecurrenceType, ProcessInstance, ProcessChecklist } from '../../types';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isTomorrow from 'dayjs/plugin/isTomorrow';

// Imports para reordenação com dnd-kit
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isTomorrow);
dayjs.locale('pt-br');

import { ProcessTemplatesModal } from './ProcessTemplatesModal';
import { CustomDatePicker } from '../CustomPickers';

const PROCESS_TYPES = [
  { id: 'carrossel', name: 'Publicação', icon: ImageIcon, color: 'text-purple-500 bg-purple-50 border-purple-100' },
  { id: 'reels', name: 'Reels', icon: Video, color: 'text-pink-500 bg-pink-50 border-pink-100' },
  { id: 'campanha_meta', name: 'Campanha Meta Ads', icon: Megaphone, color: 'text-blue-500 bg-blue-50 border-blue-100' },
  { id: 'campanha_google', name: 'Campanha Google Ads', icon: Search, color: 'text-green-500 bg-green-50 border-green-100' },
  { id: 'relatorio_mensal', name: 'Relatório Mensal', icon: BarChart3, color: 'text-orange-500 bg-orange-50 border-orange-100' },
];

// --- FUNÇÕES DE RECORRÊNCIA DAS TAREFAS ---

// Retorna o estado de pendência ou agendamento de uma tarefa mensal
function getMonthlyTaskState(task: AgencyTask, now = new Date()): 'pending' | 'completed' | 'not_started' {
  const diaConfigurado = task.recurrence_days?.[0] ? parseInt(task.recurrence_days[0], 10) : null;
  if (!diaConfigurado) return 'pending';

  const inicioCicloAtual = new Date(now.getFullYear(), now.getMonth(), diaConfigurado);

  if (task.completed_at) {
    const lastDone = new Date(task.completed_at);
    // Se a última conclusão foi depois ou igual ao início do ciclo do mês atual, ela está concluída
    if (lastDone >= inicioCicloAtual && now >= inicioCicloAtual) {
      return 'completed';
    }
    // Caso de cantinho: o mês começou, mas ainda não chegou o dia do mês configurado, e a tarefa foi concluída no ciclo do mês anterior
    if (now < inicioCicloAtual) {
      const inicioCicloMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, diaConfigurado);
      if (lastDone >= inicioCicloMesAnterior) {
        return 'completed';
      }
    }
  }

  // Se hoje ainda não chegou o dia do mês configurado, o ciclo do mês atual ainda não abriu
  if (now < inicioCicloAtual) {
    return 'not_started';
  }

  return 'pending';
}

// Retorna a data/hora do início do ciclo semanal atual (última ocorrência passada do dia configurado)
function getLastWeeklyOccurrence(recurrenceDays: number[], from: Date): Date | null {
  if (!recurrenceDays || recurrenceDays.length === 0) return null;
  
  let mostRecent: Date | null = null;
  for (const dayOfWeek of recurrenceDays) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    const currentDay = d.getDay(); // 0-6
    const diff = (currentDay - dayOfWeek + 7) % 7;
    d.setDate(d.getDate() - diff);
    
    if (!mostRecent || d > mostRecent) {
      mostRecent = d;
    }
  }
  return mostRecent;
}

// Retorna true se a tarefa precisa ser feita no ciclo atual (está pendente)
function isTaskPendingInCurrentCycle(task: AgencyTask): boolean {
  if (task.recurrence_type === 'none' || !task.recurrence_type) {
    return task.status !== 'completed';
  }

  if (!task.completed_at) return true;

  const lastDone = new Date(task.completed_at);
  const now = new Date();

  if (task.recurrence_type === 'daily') {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return lastDone < todayStart;
  }

  if (task.recurrence_type === 'weekly') {
    const days = (task.recurrence_days || []).map((d: any) => parseInt(d, 10)).filter((d: any) => !isNaN(d));
    let cycleStart = getLastWeeklyOccurrence(days, now);
    if (!cycleStart) {
      // Fallback: início da semana atual (segunda-feira passada)
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // ajusta para segunda-feira
      cycleStart = new Date(d.setDate(diff));
    }
    return lastDone < cycleStart;
  }

  if (task.recurrence_type === 'monthly') {
    return getMonthlyTaskState(task, now) === 'pending';
  }

  return task.status !== 'completed';
}

// Ordena tarefas pelo sort_order persistido; se for 0 ou nulo, cai na data de criação (preservando ordem natural/criação)
function sortTasksByOrder(taskList: AgencyTask[]): AgencyTask[] {
  return [...taskList].sort((a, b) => {
    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;
    
    if (orderA !== orderB) {
      // Prioriza valores maiores que 0 para virem ordenados. Valores de 0/nulos vêm por último ou na ordem natural.
      if (orderA === 0) return 1;
      if (orderB === 0) return -1;
      return orderA - orderB;
    }
    
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

// Retorna true se tarefa semanal está atrasada (ciclo atual já começou mas não foi feita)
function isWeeklyTaskOverdue(task: AgencyTask): boolean {
  if (task.recurrence_type !== 'weekly') return false;
  const isPending = isTaskPendingInCurrentCycle(task);
  if (!isPending) return false;
  
  const now = new Date();
  const days = (task.recurrence_days || []).map((d: any) => parseInt(d, 10)).filter((d: any) => !isNaN(d));
  const cycleStart = getLastWeeklyOccurrence(days, now);
  if (!cycleStart) return false;
  
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return cycleStart < todayStart;
}

// Retorna o label formatado para exibir os dias da semana de recorrência
const getWeeklyDaysLabel = (days: any[]) => {
  if (!days || days.length === 0) return '';
  const dayLabels: Record<number, string> = {
    1: 'segunda-feira',
    2: 'terça-feira',
    3: 'quarta-feira',
    4: 'quinta-feira',
    5: 'sexta-feira',
    6: 'sábado',
    0: 'domingo'
  };
  const shortLabels: Record<number, string> = {
    1: 'Seg',
    2: 'Ter',
    3: 'Qua',
    4: 'Qui',
    5: 'Sex',
    6: 'Sáb',
    0: 'Dom'
  };
  
  const numericDays = days.map(d => parseInt(d, 10)).filter(d => !isNaN(d)).sort((a,b) => {
    const orderA = a === 0 ? 7 : a;
    const orderB = b === 0 ? 7 : b;
    return orderA - orderB;
  });

  if (numericDays.length === 1) {
    return `Toda ${dayLabels[numericDays[0]]}`;
  }
  return numericDays.map(d => shortLabels[d]).join(', ');
};

export const AgencyTasksTab: React.FC = () => {
  const { agencyId } = useAuth();
  const [activeTab, setActiveTab] = useState<'hoje' | 'processos' | 'todas'>('hoje');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isAddingProcess, setIsAddingProcess] = useState(false);
  const [isConfiguringProcesses, setIsConfiguringProcesses] = useState(false);
  const [editingTask, setEditingTask] = useState<AgencyTask | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchClients();
  }, [agencyId]);

  const fetchClients = async () => {
    if (!agencyId) return;
    const { data } = await supabase
      .from('clients')
      .select('id, name, color, initials')
      .eq('agency_id', agencyId)
      .order('name');
    if (data) setClients(data);
  };

  const triggerRefresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 border-b border-gray-100 pb-4">
        <div className="flex gap-6 overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab('hoje')}
            className={`pb-4 text-sm font-bold uppercase tracking-widest transition-colors relative whitespace-nowrap ${activeTab === 'hoje' ? 'text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Hoje
            {activeTab === 'hoje' && <motion.div layoutId="taskTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-dark" />}
          </button>
          <button 
            onClick={() => setActiveTab('processos')}
            className={`pb-4 text-sm font-bold uppercase tracking-widest transition-colors relative whitespace-nowrap ${activeTab === 'processos' ? 'text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Processos
            {activeTab === 'processos' && <motion.div layoutId="taskTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-dark" />}
          </button>
          <button 
            onClick={() => setActiveTab('todas')}
            className={`pb-4 text-sm font-bold uppercase tracking-widest transition-colors relative whitespace-nowrap ${activeTab === 'todas' ? 'text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Todas as Tarefas
            {activeTab === 'todas' && <motion.div layoutId="taskTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-dark" />}
          </button>
        </div>

        <div className="flex gap-3 pb-2">
          {activeTab === 'processos' ? (
            <>
              <button
                onClick={() => setIsConfiguringProcesses(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors whitespace-nowrap"
              >
                <Settings2 size={16} /> Configurar Templates
              </button>
              <button
                onClick={() => setIsAddingProcess(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-dark text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all whitespace-nowrap"
              >
                <Plus size={16} /> Iniciar Processo
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsAddingProcess(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand-dark/5 text-brand-dark rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-dark/10 transition-all whitespace-nowrap"
              >
                + Processo
              </button>
              <button
                onClick={() => { setEditingTask(null); setIsAddingTask(true); }}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-dark text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all whitespace-nowrap"
              >
                <Plus size={16} /> Nova Tarefa
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === 'hoje' && <HojeTasks key={`hoje-${refreshKey}`} clients={clients} onEditTask={(t) => { setEditingTask(t); setIsAddingTask(true); }} onRefresh={triggerRefresh} />}
      {activeTab === 'processos' && <ProcessosView key={`proc-${refreshKey}`} clients={clients} />}
      {activeTab === 'todas' && <TodasTasks key={`todas-${refreshKey}`} clients={clients} onEditTask={(t) => { setEditingTask(t); setIsAddingTask(true); }} onRefresh={triggerRefresh} />}

      {/* Drawer Nova/Editar Tarefa */}
      <AnimatePresence>
        {isAddingTask && (
          <TaskFormDrawer 
            clients={clients} 
            task={editingTask}
            onClose={() => { setIsAddingTask(false); setEditingTask(null); }} 
            onSuccess={() => { setIsAddingTask(false); setEditingTask(null); triggerRefresh(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingProcess && (
          <ProcessFormModal 
            clients={clients} 
            onClose={() => setIsAddingProcess(false)}
            onSuccess={() => { setIsAddingProcess(false); triggerRefresh(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isConfiguringProcesses && (
          <ProcessTemplatesModal
            onClose={() => setIsConfiguringProcesses(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ==========================================
// ABA 1: HOJE
// ==========================================
const HojeTasks: React.FC<{ clients: any[], onEditTask: (t: AgencyTask) => void, onRefresh: () => void }> = ({ clients, onEditTask, onRefresh }) => {
  const { agencyId } = useAuth();
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDragEnd = async (event: DragEndEvent, type: 'daily' | 'weekly' | 'monthly') => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const pendingTypeTasks = sortTasksByOrder(
      tasks.filter(t => {
        if (t.recurrence_type !== type) return false;
        if (type === 'monthly') {
          return getMonthlyTaskState(t, new Date()) === 'pending';
        }
        return isTaskPendingInCurrentCycle(t);
      })
    );

    const oldIndex = pendingTypeTasks.findIndex(t => t.id === active.id);
    const newIndex = pendingTypeTasks.findIndex(t => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedPendingType = arrayMove(pendingTypeTasks, oldIndex, newIndex);

      // Atualiza localmente
      const updatedTasks = tasks.map(task => {
        if (task.recurrence_type === type && (type === 'monthly' ? getMonthlyTaskState(task, new Date()) === 'pending' : isTaskPendingInCurrentCycle(task))) {
          const indexInReordered = reorderedPendingType.findIndex(t => t.id === task.id);
          if (indexInReordered !== -1) {
            return { ...task, sort_order: indexInReordered + 1 };
          }
        }
        return task;
      });

      setTasks(updatedTasks);

      // Persiste no Supabase
      const updates = reorderedPendingType.map((task, index) => {
        const newOrder = index + 1;
        return supabase
          .from('agency_tasks')
          .update({ sort_order: newOrder })
          .eq('agency_id', agencyId)
          .eq('id', task.id);
      });

      try {
        await Promise.all(updates);
      } catch (err) {
        console.error('Erro ao salvar reordenação no Supabase:', err);
      }
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    if (!agencyId) return;
    try {
      setLoading(true);
      const { data } = await supabase
        .from('agency_tasks')
        .select('*, client:clients(id, name, color, initials, client_status)')
        .eq('agency_id', agencyId)
        .or('status.eq.pending,recurrence_type.neq.none')
        .order('sort_order', { ascending: true });

      if (data) {
        const todayString = dayjs().format('YYYY-MM-DD');

        const activeData = data.filter(task => !task.client || task.client.client_status !== 'cancelled');

        const hojeTasks = activeData.filter(task => {
          const isPending = isTaskPendingInCurrentCycle(task);
          
          if (task.recurrence_type === 'none' || !task.recurrence_type) {
            return task.status === 'pending' && (task.priority === 'urgente' || (task.due_date && task.due_date <= todayString));
          }

          if (task.recurrence_type === 'daily') {
            return true;
          }

          if (task.recurrence_type === 'weekly') {
            return true;
          }

          if (task.recurrence_type === 'monthly') {
            return true;
          }

          return false;
        });

        const priorityOrder = { urgente: 1, alta: 2, normal: 3, baixa: 4 };
        const sorted = hojeTasks.sort((a, b) => {
          const p1 = priorityOrder[a.priority as keyof typeof priorityOrder] || 3;
          const p2 = priorityOrder[b.priority as keyof typeof priorityOrder] || 3;
          if (p1 !== p2) return p1 - p2;
          if (a.due_date === b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        });
        setTasks(sorted);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (task: AgencyTask) => {
    const isPending = isTaskPendingInCurrentCycle(task);
    const isDone = !isPending;
    
    if (task.recurrence_type === 'none' || !task.recurrence_type) {
      const newStatus = isDone ? 'pending' : 'completed';
      const completedAt = isDone ? null : new Date().toISOString();
      await supabase.from('agency_tasks')
        .update({ status: newStatus, completed_at: completedAt })
        .eq('agency_id', agencyId)
        .eq('id', task.id);
    } else {
      const completedAt = isDone ? null : new Date().toISOString();
      await supabase.from('agency_tasks')
        .update({ status: 'pending', completed_at: completedAt })
        .eq('agency_id', agencyId)
        .eq('id', task.id);
    }
    onRefresh();
  };

  const [isRotinaDiaExpanded, setIsRotinaDiaExpanded] = useState(false);
  const [isRotinaSemanaExpanded, setIsRotinaSemanaExpanded] = useState(false);
  const [isRotinaMesExpanded, setIsRotinaMesExpanded] = useState(false);

  if (loading) return <div className="text-gray-400 text-sm">Carregando...</div>;

  if (tasks.length === 0) {
    return (
      <div className="bg-brand-dark/5 rounded-3xl p-10 flex flex-col items-center justify-center text-center border border-brand-dark/10 gap-4">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-green-500 shadow-sm border border-black/5">
          <CheckCircle2 size={32} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Tudo tranquilo!</h3>
          <p className="text-gray-500 mt-1">Nada urgente ou atrasado por hoje. ✓</p>
        </div>
      </div>
    );
  }

  // Rotina do Dia (daily recurrence)
  const rotinaDia = tasks.filter(t => t.recurrence_type === 'daily');
  const pendingRotinaDia = sortTasksByOrder(rotinaDia.filter(t => isTaskPendingInCurrentCycle(t)));
  const completedRotinaDia = rotinaDia.filter(t => !isTaskPendingInCurrentCycle(t));
  const sortedCompletedRotinaDia = [...completedRotinaDia].sort((a,b) => {
    if (!a.completed_at) return 1;
    if (!b.completed_at) return -1;
    return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
  });

  // Rotina da Semana (weekly recurrence)
  const rotinaSemana = tasks.filter(t => t.recurrence_type === 'weekly');
  const pendingRotinaSemana = sortTasksByOrder(rotinaSemana.filter(t => isTaskPendingInCurrentCycle(t)));
  const completedRotinaSemana = rotinaSemana.filter(t => !isTaskPendingInCurrentCycle(t));
  const sortedCompletedRotinaSemana = [...completedRotinaSemana].sort((a,b) => {
    if (!a.completed_at) return 1;
    if (!b.completed_at) return -1;
    return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
  });

  // Rotina do Mês (monthly recurrence)
  const rotinaMes = tasks.filter(t => t.recurrence_type === 'monthly');
  const pendingRotinaMes = sortTasksByOrder(rotinaMes.filter(t => getMonthlyTaskState(t, new Date()) === 'pending'));
  const notStartedRotinaMes = sortTasksByOrder(rotinaMes.filter(t => getMonthlyTaskState(t, new Date()) === 'not_started'));
  const completedRotinaMes = rotinaMes.filter(t => getMonthlyTaskState(t, new Date()) === 'completed');
  const sortedCompletedRotinaMes = [...completedRotinaMes].sort((a,b) => {
    if (!a.completed_at) return 1;
    if (!b.completed_at) return -1;
    return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
  });

  // Outras tarefas (não recorrentes - daily/weekly/monthly)
  const altasUrgentes = tasks.filter(t => t.recurrence_type !== 'daily' && t.recurrence_type !== 'weekly' && t.recurrence_type !== 'monthly' && ['urgente', 'alta'].includes(t.priority));
  const normaisBaixas = tasks.filter(t => t.recurrence_type !== 'daily' && t.recurrence_type !== 'weekly' && t.recurrence_type !== 'monthly' && ['normal', 'baixa'].includes(t.priority));

  const renderClientGroup = (taskList: AgencyTask[]) => {
    const groups: Record<string, { label: string, color?: string, tasks: AgencyTask[] }> = {};
    taskList.forEach(t => {
      const gId = t.client_id || 'interno';
      if (!groups[gId]) {
         groups[gId] = {
           label: t.client?.name || 'Canguru Digital',
           color: t.client?.color,
           tasks: []
         };
      }
      groups[gId].tasks.push(t);
    });

    const sortedGroups = Object.keys(groups).sort((a,b) => groups[a].label.localeCompare(groups[b].label));

    return sortedGroups.map(key => {
       const group = groups[key];
       return (
         <div key={key} className="mb-6 bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
               {group.color ? (
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }}></span>
               ) : (
                  <Briefcase size={14} className="text-brand-dark" />
               )}
               <h4 className="font-bold text-gray-800 text-sm tracking-tight">{group.label}</h4>
            </div>
            <div className="divide-y divide-gray-50">
               {group.tasks.map(task => (
                 <TaskListItem key={task.id} task={task} onToggle={() => toggleStatus(task)} onEdit={() => onEditTask(task)} isTodayView />
               ))}
            </div>
         </div>
       );
    });
  };

  return (
    <div className="space-y-10">
      {/* Bloco 1: Rotina do Dia */}
      {rotinaDia.length > 0 && (
         <div>
            <h3 className="text-lg font-black text-brand-dark tracking-tight mb-4 flex items-center gap-2">
               ☀️ Rotina do Dia
            </h3>
            <div className="bg-brand-dark/5 border border-brand-dark/10 rounded-3xl p-5 md:p-6 mb-8">
               {pendingRotinaDia.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                     <div className="w-14 h-14 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-3">
                        <CheckCircle2 size={28} />
                     </div>
                     <h4 className="font-bold text-gray-900 text-lg">Rotina do dia concluída ✓</h4>
                     <p className="text-gray-500 text-sm font-medium">Você finalizou todas as tarefas diárias.</p>
                  </div>
               ) : (
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, 'daily')}
                  >
                    <SortableContext 
                      items={pendingRotinaDia.map(t => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                         {pendingRotinaDia.map(task => (
                            <SortableTaskListItem key={task.id} task={task} onToggle={() => toggleStatus(task)} onEdit={() => onEditTask(task)} isTodayView />
                         ))}
                      </div>
                    </SortableContext>
                  </DndContext>
               )}

               {completedRotinaDia.length > 0 && (
                  <div className="pt-4 border-t border-gray-200/40 mt-4">
                     <button
                        onClick={() => setIsRotinaDiaExpanded(!isRotinaDiaExpanded)}
                        className="flex items-center gap-2 text-[10px] font-extrabold text-gray-500 hover:text-brand-dark uppercase tracking-widest transition-colors mx-auto"
                     >
                        <span>
                           {isRotinaDiaExpanded 
                              ? `Ocultar ${completedRotinaDia.length} tarefas concluídas ▴`
                              : `Ver ${completedRotinaDia.length} tarefas concluídas ▾`
                           }
                        </span>
                     </button>
                     <AnimatePresence>
                        {isRotinaDiaExpanded && (
                           <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden space-y-2 mt-4 opacity-70 grayscale-[0.2]"
                           >
                              {sortedCompletedRotinaDia.map(task => (
                                 <TaskListItem key={task.id} task={task} onToggle={() => toggleStatus(task)} onEdit={() => onEditTask(task)} isTodayView />
                              ))}
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>
               )}
            </div>
         </div>
      )}

      {/* Bloco: Rotina da Semana */}
      {rotinaSemana.length > 0 && (
         <div>
            <h3 className="text-lg font-black text-brand-dark tracking-tight mb-4 flex items-center gap-2">
               🔄 Rotina da Semana
            </h3>
            <div className="bg-brand-dark/5 border border-brand-dark/10 rounded-3xl p-5 md:p-6 mb-8">
               {pendingRotinaSemana.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                     <div className="w-14 h-14 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-3">
                        <CheckCircle2 size={28} />
                     </div>
                     <h4 className="font-bold text-gray-900 text-lg">Rotina da semana concluída ✓</h4>
                     <p className="text-gray-500 text-sm font-medium">Você finalizou todas as tarefas semanais.</p>
                  </div>
               ) : (
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, 'weekly')}
                  >
                    <SortableContext 
                      items={pendingRotinaSemana.map(t => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                         {pendingRotinaSemana.map(task => (
                            <SortableTaskListItem key={task.id} task={task} onToggle={() => toggleStatus(task)} onEdit={() => onEditTask(task)} isTodayView />
                         ))}
                      </div>
                    </SortableContext>
                  </DndContext>
               )}

               {completedRotinaSemana.length > 0 && (
                  <div className="pt-4 border-t border-gray-200/40 mt-4">
                     <button
                        onClick={() => setIsRotinaSemanaExpanded(!isRotinaSemanaExpanded)}
                        className="flex items-center gap-2 text-[10px] font-extrabold text-gray-500 hover:text-brand-dark uppercase tracking-widest transition-colors mx-auto"
                     >
                        <span>
                           {isRotinaSemanaExpanded 
                              ? `Ocultar ${completedRotinaSemana.length} tarefas concluídas ▴`
                              : `Ver ${completedRotinaSemana.length} tarefas concluídas ▾`
                           }
                        </span>
                     </button>
                     <AnimatePresence>
                        {isRotinaSemanaExpanded && (
                           <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden space-y-2 mt-4 opacity-70 grayscale-[0.2]"
                           >
                              {sortedCompletedRotinaSemana.map(task => (
                                 <TaskListItem key={task.id} task={task} onToggle={() => toggleStatus(task)} onEdit={() => onEditTask(task)} isTodayView />
                              ))}
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>
               )}
            </div>
         </div>
      )}

      {/* Bloco: Rotina do Mês */}
      {rotinaMes.length > 0 && (
         <div>
            <h3 className="text-lg font-black text-brand-dark tracking-tight mb-4 flex items-center gap-2">
               📅 Rotina do Mês
            </h3>
            <div className="bg-brand-dark/5 border border-brand-dark/10 rounded-3xl p-5 md:p-6 mb-8">
               {pendingRotinaMes.length === 0 && notStartedRotinaMes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                     <div className="w-14 h-14 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-3">
                        <CheckCircle2 size={28} />
                     </div>
                     <h4 className="font-bold text-gray-900 text-lg">Rotina do mês concluída ✓</h4>
                     <p className="text-gray-500 text-sm font-medium">Você finalizou todas as tarefas mensais deste ciclo.</p>
                  </div>
               ) : (
                  <div className="space-y-4">
                     {/* Tarefas Abertas / Pendentes no Ciclo Atual */}
                     {pendingRotinaMes.length > 0 && (
                        <DndContext 
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) => handleDragEnd(event, 'monthly')}
                        >
                          <SortableContext 
                            items={pendingRotinaMes.map(t => t.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2">
                               {pendingRotinaMes.map(task => (
                                  <SortableTaskListItem key={task.id} task={task} onToggle={() => toggleStatus(task)} onEdit={() => onEditTask(task)} isTodayView />
                               ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                     )}

                     {/* Tarefas Agendadas (Ainda não abriram) */}
                     {notStartedRotinaMes.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-gray-200/40 first:pt-0 first:border-00">
                           <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Futuras Aberturas deste Mês</div>
                           {notStartedRotinaMes.map(task => (
                              <TaskListItem key={task.id} task={task} onToggle={() => toggleStatus(task)} onEdit={() => onEditTask(task)} isTodayView />
                           ))}
                        </div>
                     )}
                  </div>
               )}

               {completedRotinaMes.length > 0 && (
                  <div className="pt-4 border-t border-gray-200/40 mt-4">
                     <button
                        onClick={() => setIsRotinaMesExpanded(!isRotinaMesExpanded)}
                        className="flex items-center gap-2 text-[10px] font-extrabold text-gray-500 hover:text-brand-dark uppercase tracking-widest transition-colors mx-auto"
                     >
                        <span>
                           {isRotinaMesExpanded 
                              ? `Ocultar ${completedRotinaMes.length} tarefas concluídas ▴`
                              : `Ver ${completedRotinaMes.length} tarefas concluídas ▾`
                           }
                        </span>
                     </button>
                     <AnimatePresence>
                        {isRotinaMesExpanded && (
                           <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden space-y-2 mt-4 opacity-70 grayscale-[0.2]"
                           >
                              {sortedCompletedRotinaMes.map(task => (
                                 <TaskListItem key={task.id} task={task} onToggle={() => toggleStatus(task)} onEdit={() => onEditTask(task)} isTodayView />
                              ))}
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>
               )}
            </div>
         </div>
      )}

      {/* Bloco 2: Prioridade Alta & Urgente */}
      {altasUrgentes.length > 0 && (
         <div>
            <h3 className="text-base font-bold text-red-600 uppercase tracking-widest mb-4 flex items-center gap-2">
               ⚡ Prioridade Alta & Urgente
            </h3>
            {renderClientGroup(altasUrgentes)}
         </div>
      )}

      {/* Bloco 3: Normal & Baixa */}
      {normaisBaixas.length > 0 && (
         <div className="opacity-80 hover:opacity-100 transition-opacity">
            <h3 className="text-base font-bold text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
               ● Normal & Baixa
            </h3>
            {renderClientGroup(normaisBaixas)}
         </div>
      )}
    </div>
  );
};

// ==========================================
// ABA 2: PROCESSOS
// ==========================================
const ProcessosView: React.FC<{ clients: any[] }> = ({ clients }) => {
  const { agencyId } = useAuth();
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState<any | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    if (!selectedProcess) fetchInstances();
  }, [selectedProcess]);

  const fetchInstances = async () => {
    if (!agencyId) return;
    try {
      setLoading(true);
      const { data } = await supabase
        .from('process_instances')
        .select('*, client:clients(id, name, color, initials), process_checklist(*)')
        .eq('agency_id', agencyId)
        .in('status', ['active', 'completed'])
        .order('created_at', { ascending: false });

      if (data) {
        const formatted = data.map(pi => {
          const itensPrincipais = pi.process_checklist?.filter((c: any) => !c.parent_id) || [];
          const concluidas = itensPrincipais.filter((c: any) => c.is_completed).length;
          return {
            ...pi,
            total_etapas: itensPrincipais.length,
            etapas_concluidas: concluidas,
            itens_principais: itensPrincipais
          };
        });
        setInstances(formatted);
      }
    } catch (err) {
      console.error('Error fetching process instances:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameClick = async (e: React.MouseEvent, process: any) => {
    e.stopPropagation();
    const novoNome = window.prompt("Novo nome do processo:", process.process_name);
    if (novoNome && novoNome.trim() && novoNome !== process.process_name) {
      await supabase.from('process_instances')
        .update({ process_name: novoNome.trim() })
        .eq('agency_id', agencyId)
        .eq('id', process.id);
      fetchInstances();
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, process: any) => {
    e.stopPropagation();
    if (window.confirm("Tem certeza? Esta ação não pode ser desfeita.")) {
      await supabase.from('process_instances')
        .delete()
        .eq('agency_id', agencyId)
        .eq('id', process.id);
      fetchInstances();
    }
  };

  if (selectedProcess) {
    return (
      <ProcessChecklistView 
        process={selectedProcess} 
        agencyId={agencyId!}
        onBack={() => { setSelectedProcess(null); fetchInstances(); }} 
      />
    );
  }

  if (loading) return <div className="text-gray-400 text-sm">Carregando processos...</div>;

  const activeInstances = instances.filter(p => p.status === 'active');
  const completedInstances = instances.filter(p => p.status === 'completed');

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {activeInstances.map(process => {
          const typeInfo = PROCESS_TYPES.find(t => t.id === process.process_type) || PROCESS_TYPES[0];
          const Icon = typeInfo.icon;
          const progress = process.total_etapas > 0 ? (process.etapas_concluidas / process.total_etapas) * 100 : 0;
          
          return (
            <div 
              key={process.id} 
              onClick={() => setSelectedProcess(process)}
              className="bg-white border border-gray-100 rounded-3xl p-6 cursor-pointer hover:shadow-lg hover:border-brand-dark/20 transition-all group relative overflow-hidden"
            >
             <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
               <button onClick={(e) => handleRenameClick(e, process)} className="p-2 bg-white rounded-lg border border-gray-100 hover:border-brand-dark/20 text-gray-500 hover:text-brand-dark shadow-sm">
                 <Edit2 size={14} />
               </button>
               <button onClick={(e) => handleDeleteClick(e, process)} className="p-2 bg-white rounded-lg border border-gray-100 hover:border-red-200 text-gray-500 hover:text-red-500 shadow-sm">
                 <Trash2 size={14} />
               </button>
             </div>
             
             <div className="flex items-start justify-between mb-4 mt-2">
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${typeInfo.color}`}>
                 <Icon size={24} />
               </div>
               {process.client && (
                 <div className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: process.client.color }}>
                   {process.client.name}
                 </div>
               )}
             </div>
             
             <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand-dark transition-colors pr-16">{process.process_name}</h3>
             <p className="text-xs text-gray-400 font-medium mt-1">Iniciado em {dayjs(process.created_at).format('DD/MM/YY')}</p>
             
             <div className="mt-6">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Progresso</span>
                 <span className="text-xs font-bold text-brand-dark">{process.etapas_concluidas} / {process.total_etapas}</span>
               </div>
               <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                 <div className="h-full bg-brand-dark transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
               </div>
             </div>
            </div>
          );
        })}
        {activeInstances.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-3xl">Nenhum processo em andamento.</div>
        )}
      </div>

      {completedInstances.length > 0 && (
        <div className="mt-12 border-t border-gray-100 pt-8">
          <button 
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-gray-500 font-bold hover:text-brand-dark transition-colors mb-6"
          >
            <ChevronDown size={20} className={`transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
            Ver concluídos ({completedInstances.length})
          </button>
          
          <AnimatePresence>
            {showCompleted && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {completedInstances.map(process => {
                    const typeInfo = PROCESS_TYPES.find(t => t.id === process.process_type) || PROCESS_TYPES[0];
                    const Icon = typeInfo.icon;
                    return (
                      <div 
                        key={process.id} 
                        className="bg-gray-50 border border-gray-100 rounded-3xl p-6 relative group overflow-hidden opacity-70 hover:opacity-100 transition-opacity"
                      >
                       <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                         <button onClick={(e) => handleDeleteClick(e, process)} className="p-2 bg-white rounded-lg border border-gray-100 hover:border-red-200 text-gray-500 hover:text-red-500 shadow-sm">
                           <Trash2 size={14} />
                         </button>
                       </div>
                       
                       <div className="flex items-start justify-between mb-4 mt-2">
                         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-200 text-gray-500`}>
                           <Icon size={24} />
                         </div>
                         {process.client && (
                           <div className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white bg-gray-400">
                             {process.client.name}
                           </div>
                         )}
                       </div>
                       
                       <h3 className="text-lg font-bold text-gray-600 line-through pr-10">{process.process_name}</h3>
                       <p className="text-xs text-gray-400 font-medium mt-1">Concluído em {dayjs(process.completed_at).format('DD/MM/YY')}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

const ProcessChecklistView: React.FC<{ process: any, agencyId: number, onBack: () => void }> = ({ process: initialProcess, agencyId, onBack }) => {
  const [items, setItems] = useState<any[]>([]);
  const [process, setProcess] = useState(initialProcess);
  
  useEffect(() => {
    fetchChecklist();
  }, []);

  const fetchChecklist = async () => {
    const { data } = await supabase
      .from('process_checklist')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('instance_id', process.id)
      .order('position');
      
    if (data) {
      const pais = data.filter(d => !d.parent_id);
      const filhos = data.filter(d => d.parent_id);
      
      const hierarquized = pais.map(p => ({
        ...p,
        subitens: filhos.filter(f => f.parent_id === p.id)
      }));
      setItems(hierarquized);
    }
  };

  const toggleItem = async (item: any) => {
    const newStatus = !item.is_completed;
    const completedAt = newStatus ? new Date().toISOString() : null;

    // Atualização otimista
    const updatedItems = items.map(p => {
      if (p.id === item.id) {
        // Se for o pai, se marcarmos, concluimos pai; e não mexemos nos filhos obrigatoriamente (logica simples)
        return { ...p, is_completed: newStatus, completed_at: completedAt };
      }
      
      // se é filho
      const isMyChild = p.subitens?.find((s: any) => s.id === item.id);
      if (isMyChild) {
        const newSubitens = p.subitens.map((s: any) => s.id === item.id ? { ...s, is_completed: newStatus, completed_at: completedAt } : s);
        // checa se todos os filhos estao concluidos agora
        const allChildrenCompleted = newSubitens.every((s: any) => s.is_completed);
        return { 
          ...p, 
          subitens: newSubitens,
          is_completed: allChildrenCompleted, 
          completed_at: allChildrenCompleted ? (p.completed_at || completedAt) : null 
        };
      }
      return p;
    });
    setItems(updatedItems);
    
    // Atualiza BD
    await supabase.from('process_checklist')
      .update({ is_completed: newStatus, completed_at: completedAt })
      .eq('agency_id', agencyId)
      .eq('id', item.id);
    
    // Se marcamos um filho, e ele fez o pai ser marcado/desmarcado, atualiza o pai no bd
    if (item.parent_id) {
       const parentNow = updatedItems.find(p => p.id === item.parent_id);
       if (parentNow) {
         await supabase.from('process_checklist')
             .update({ is_completed: parentNow.is_completed, completed_at: parentNow.completed_at })
             .eq('agency_id', agencyId)
             .eq('id', parentNow.id);
       }
    }
  };

  const total = items.length;
  const concluidas = items.filter(i => i.is_completed).length;
  const progress = total > 0 ? (concluidas / total) * 100 : 0;

  const handleFinishProcess = async () => {
    await supabase.from('process_instances')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('agency_id', agencyId)
      .eq('id', process.id);
    onBack();
  };

  const typeInfo = PROCESS_TYPES.find(t => t.id === process.process_type) || PROCESS_TYPES[0];

  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-10 shadow-sm">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-50">
        <button onClick={onBack} className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 transition-colors">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-black text-brand-dark">{process.process_name}</h2>
            {process.client && (
               <div className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: process.client.color }}>
                 {process.client.name}
               </div>
            )}
          </div>
          <p className="text-sm font-medium text-gray-500">{typeInfo.name}</p>
        </div>
        <div className="text-right ml-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Progresso</div>
          <div className="text-lg font-black text-brand-dark">{Math.round(progress)}%</div>
        </div>
      </div>

      <div className="space-y-4 mb-10">
        {items.map(pai => (
          <div key={pai.id} className="bg-gray-50/50 rounded-2xl border border-gray-100 p-4">
            <div className={`flex items-start gap-4 ${pai.is_completed ? 'opacity-60' : ''}`}>
              <button 
                onClick={() => toggleItem(pai)}
                className={`mt-1 flex-shrink-0 text-gray-300 hover:text-brand-dark transition-colors ${pai.is_completed ? 'text-green-500' : ''}`}
                disabled={pai.subitens?.length > 0} // Se tem subitem, o pai é marcado automatico pelos filhos
              >
                {pai.is_completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
              </button>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className={`font-bold text-lg ${pai.is_completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                    {pai.title} 
                    {pai.subitens?.length > 0 && (
                       <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full no-underline inline-block">
                         ({pai.subitens.filter((s: any) => s.is_completed).length}/{pai.subitens.length})
                       </span>
                    )}
                  </h4>
                  {pai.responsible === 'sarah' && <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-bold bg-purple-100 text-purple-600">Sarah</span>}
                  {pai.responsible === 'client' && <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-bold bg-blue-100 text-blue-600">Cliente</span>}
                </div>
                {pai.description && <p className="text-sm text-gray-500">{pai.description}</p>}
              </div>
            </div>

            {/* Subitens */}
            {pai.subitens?.length > 0 && (
              <div className="ml-10 mt-4 space-y-2 border-l-2 border-gray-200 pl-4">
                {pai.subitens.map((filho: any) => (
                  <div key={filho.id} className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleItem(filho)}
                      className={`text-gray-300 hover:text-brand-dark transition-colors ${filho.is_completed ? 'text-green-500' : ''}`}
                    >
                      {filho.is_completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                    </button>
                    <span className={`text-sm font-medium ${filho.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {filho.title}
                    </span>
                    {filho.responsible === 'sarah' && <span className="px-1.5 py-0.5 rounded-md text-[9px] uppercase font-bold bg-purple-100 text-purple-600 ml-2">Sarah</span>}
                    {filho.responsible === 'client' && <span className="px-1.5 py-0.5 rounded-md text-[9px] uppercase font-bold bg-blue-100 text-blue-600 ml-2">Cliente</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-6 border-t border-gray-100">
        {concluidas > 0 && concluidas === total ? (
           <button 
             onClick={handleFinishProcess}
             className="px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all bg-green-500 text-white hover:shadow-lg flex items-center justify-center gap-2"
           >
             <Check size={16} /> Marcar Processo como Concluído
           </button>
        ) : (
           <button 
             disabled
             className="px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all bg-gray-100 text-gray-400 cursor-not-allowed"
           >
             Aguardando {total - concluidas} Etapa{total - concluidas > 1 ? 's' : ''}
           </button>
        )}
      </div>
    </div>
  );
};

// ==========================================
// ABA 3: TODAS AS TAREFAS
// ==========================================
const TodasTasks: React.FC<{ clients: any[], onEditTask: (t: AgencyTask) => void, onRefresh: () => void }> = ({ clients, onEditTask, onRefresh }) => {
  const { agencyId } = useAuth();
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState('all');
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    if (!agencyId) return;
    try {
      setLoading(true);
      const { data } = await supabase
        .from('agency_tasks')
        .select('*, client:clients(id, name, color, initials, client_status)')
        .eq('agency_id', agencyId)
        .or('recurrence_type.is.null,recurrence_type.eq.none');

      if (data) {
        const activeTasks = data.filter(t => !t.client || t.client.client_status !== 'cancelled');
        setTasks(activeTasks);
      }
    } catch (err) {
      console.error('Error fetching todas tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (task: AgencyTask) => {
    const isPending = isTaskPendingInCurrentCycle(task);
    const isDone = !isPending;

    if (task.recurrence_type === 'none' || !task.recurrence_type) {
      const newStatus = isDone ? 'pending' : 'completed';
      const completedAt = isDone ? null : new Date().toISOString();
      await supabase.from('agency_tasks')
        .update({ status: newStatus, completed_at: completedAt })
        .eq('agency_id', agencyId)
        .eq('id', task.id);
    } else {
      const completedAt = isDone ? null : new Date().toISOString();
      await supabase.from('agency_tasks')
        .update({ status: 'pending', completed_at: completedAt })
        .eq('agency_id', agencyId)
        .eq('id', task.id);
    }
    await fetchTasks();
    onRefresh();
  };

  const filtered = tasks.filter(t => {
    // Exclude daily, weekly and monthly recurring tasks (REQUISITO 2)
    const isRecurring = t.recurrence_type === 'daily' || t.recurrence_type === 'weekly' || t.recurrence_type === 'monthly';
    if (isRecurring) return false;

    if (filterClient === 'internal') return !t.client_id;
    if (filterClient !== 'all') return t.client_id === filterClient;
    return true;
  });

  const sortPendingTasks = (taskList: AgencyTask[]) => {
    const priorityOrder = { urgente: 1, alta: 2, normal: 3, baixa: 4 };

    return [...taskList].sort((a, b) => {
      // 1. By due_date (earliest first, nulls last)
      if (a.due_date && b.due_date) {
        if (a.due_date !== b.due_date) {
          return a.due_date.localeCompare(b.due_date);
        }
      } else if (a.due_date && !b.due_date) {
        return -1;
      } else if (!a.due_date && b.due_date) {
        return 1;
      }

      // 2. Priority sort within same day
      const p1 = priorityOrder[a.priority as keyof typeof priorityOrder] || 3;
      const p2 = priorityOrder[b.priority as keyof typeof priorityOrder] || 3;
      if (p1 !== p2) return p1 - p2;

      // 3. Alphabetical fallback
      return a.title.localeCompare(b.title);
    });
  };

  const pendingTasks = sortPendingTasks(filtered.filter(t => t.status === 'pending'));
  const completedTasks = filtered.filter(t => t.status === 'completed');

  const sortedCompleted = [...completedTasks].sort((a,b) => {
    if (!a.completed_at) return 1;
    if (!b.completed_at) return -1;
    return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-2 text-gray-400">
          <Filter size={18} />
          <span className="text-xs font-bold uppercase tracking-widest">Filtrar por Cliente:</span>
        </div>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium text-brand-dark outline-none cursor-pointer min-w-[250px] shadow-sm appearance-none"
        >
          <option value="all">Ver Todos</option>
          <option value="internal">Canguru Digital (Interno)</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-3xl text-gray-400 text-sm font-medium shadow-sm">
           Nenhuma tarefa encontrada neste filtro.
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm shadow-black/[0.01] overflow-hidden p-6 sm:p-8 space-y-6">
          {pendingTasks.length > 0 ? (
            <div className="space-y-2">
              {pendingTasks.map(task => (
                <TaskListItem key={task.id} task={task} onToggle={() => toggleStatus(task)} onEdit={() => onEditTask(task)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm">Nenhuma tarefa pendente.</div>
          )}

          {/* Completed Tasks - Collapsible */}
          {completedTasks.length > 0 && (
            <div className="pt-4 border-t border-gray-100 mt-4">
              <button
                onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                className="flex items-center gap-2 text-[11px] font-extrabold text-gray-400 hover:text-brand-dark uppercase tracking-widest transition-colors mx-auto"
              >
                <span>
                  {isCompletedExpanded 
                    ? `Ocultar ${completedTasks.length} tarefas concluídas ▴`
                    : `Ver ${completedTasks.length} tarefas concluídas ▾`
                  }
                </span>
              </button>
              
              <AnimatePresence>
                {isCompletedExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-2 mt-4 opacity-70 grayscale-[0.2]"
                  >
                    {sortedCompleted.map(task => (
                      <TaskListItem key={task.id} task={task} onToggle={() => toggleStatus(task)} onEdit={() => onEditTask(task)} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


// ==========================================
// SHARED UI: TASK ITEM
// ==========================================
const SortableTaskListItem: React.FC<{ 
  task: AgencyTask; 
  onToggle: () => void; 
  onEdit: () => void; 
  isTodayView?: boolean;
}> = ({ task, onToggle, onEdit, isTodayView }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    touchAction: 'none'
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="outline-none">
      <TaskListItem 
        task={task} 
        onToggle={onToggle} 
        onEdit={onEdit} 
        isTodayView={isTodayView} 
        isDragging={isDragging} 
      />
    </div>
  );
};

const TaskListItem: React.FC<{ task: AgencyTask, onToggle: () => void, onEdit: () => void, isTodayView?: boolean, isDragging?: boolean }> = ({ task, onToggle, onEdit, isTodayView, isDragging }) => {
  const isDone = !isTaskPendingInCurrentCycle(task);
  const isOverdue = (task.recurrence_type === 'weekly' && isWeeklyTaskOverdue(task)) || 
    ((task.recurrence_type === 'none' || !task.recurrence_type) && !isDone && task.due_date && dayjs(task.due_date).isBefore(dayjs(), 'day'));

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgente': return 'text-red-500 bg-red-50 border-red-100';
      case 'alta': return 'text-orange-500 bg-orange-50 border-orange-100';
      case 'normal': return 'text-blue-500 bg-blue-50 border-blue-100';
      case 'baixa': return 'text-gray-500 bg-gray-50 border-gray-100';
      default: return 'text-gray-500 bg-gray-50 border-gray-100';
    }
  };
  
  const dateObj = task.due_date ? dayjs(task.due_date) : null;
  const isMonthlyNotStarted = task.recurrence_type === 'monthly' && getMonthlyTaskState(task) === 'not_started';

  return (
    <div className={`group flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-brand-dark/20 hover:shadow-sm transition-all ${isDone ? 'opacity-60 bg-gray-50 pointer-events-auto' : ''} ${isDragging ? 'shadow-lg border-brand-dark/30 scale-[1.01]' : ''}`}>
      {isTodayView && !isDone && !isMonthlyNotStarted && (task.recurrence_type === 'daily' || task.recurrence_type === 'weekly' || task.recurrence_type === 'monthly') && (
        <div className="text-gray-300 group-hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0">
          <GripVertical size={16} />
        </div>
      )}

      <button 
        disabled={isMonthlyNotStarted}
        onClick={onToggle} 
        className={`flex-shrink-0 text-gray-300 hover:text-brand-dark transition-colors ${isDone ? 'text-green-500 hover:text-green-600' : ''} ${isMonthlyNotStarted ? 'text-gray-200 cursor-not-allowed' : ''}`}
      >
        {isDone ? <CheckCircle2 size={24} /> : <Circle size={24} />}
      </button>
      
      <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
        <div className="flex-1 truncate">
          <span className={`font-bold text-sm ${isDone ? 'line-through text-gray-500' : 'text-gray-800'} ${isMonthlyNotStarted ? 'text-gray-400 font-medium' : ''}`}>
            {task.title}
          </span>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {task.client ? (
             <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white whitespace-nowrap" style={{ backgroundColor: task.client.color }}>
               {task.client.name}
             </span>
          ) : (
             <span className="px-2 py-0.5 rounded-md bg-brand-dark/10 text-brand-dark text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
               Interno
             </span>
          )}
          
          <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${getPriorityColor(task.priority)}`}>
            {task.priority || 'Normal'}
          </span>

          {task.recurrence_type && task.recurrence_type !== 'none' && (
            <span title={`Recorrência: ${task.recurrence_type === 'daily' ? 'Diária' : task.recurrence_type === 'weekly' ? 'Semanal' : 'Mensal'}`} className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider whitespace-nowrap bg-purple-50 text-purple-600 border-purple-100`}>
              <Repeat size={10} />
              {task.recurrence_type === 'daily' ? 'Diária 🔄' : task.recurrence_type === 'weekly' ? getWeeklyDaysLabel(task.recurrence_days || []) : `Mensal (Dia ${task.recurrence_days?.[0] || '1'}) 📅`}
            </span>
          )}
          
          {isOverdue && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap text-red-500 bg-red-50 border border-red-100">
              Atrasada
            </span>
          )}

          {isMonthlyNotStarted && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap text-purple-600 bg-purple-50 border border-purple-100">
              Abre dia {task.recurrence_days?.[0] || '1'}
            </span>
          )}

          {dateObj && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${isOverdue ? 'text-red-500 bg-red-50 border border-red-100' : 'text-gray-500 bg-gray-50 border border-gray-100'}`}>
              <Calendar size={12} />
              {dateObj.format('DD/MM')}
            </span>
          )}

          {isDone && task.completed_at && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap text-green-600 bg-green-50 border border-green-100">
              <Clock size={12} />
              Concluída em {dayjs(task.completed_at).format('DD/MM/YYYY [às] HH:mm')}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
          <Edit2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ==========================================
// DRAWER: NOVA TAREFA
// ==========================================
const WEEK_DAYS = [
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
  { id: 0, label: 'Dom' },
];

const TaskFormDrawer: React.FC<{ clients: any[], task?: AgencyTask | null, onClose: () => void, onSuccess: () => void }> = ({ clients, task, onClose, onSuccess }) => {
  const { agencyId } = useAuth();
  const [form, setForm] = useState<{
    title: string;
    client_id: string;
    priority: AgencyTaskPriority;
    due_date: string;
    description: string;
    recurrence_type: AgencyTaskRecurrenceType;
    recurrence_days: number[];
  }>({
    title: task?.title || '',
    client_id: task?.client_id || '',
    priority: (task?.priority as AgencyTaskPriority) || 'normal',
    due_date: task?.due_date || '',
    description: task?.description || '',
    recurrence_type: (task?.recurrence_type as AgencyTaskRecurrenceType) || 'none',
    recurrence_days: task?.recurrence_days 
      ? task.recurrence_days.map((d: any) => parseInt(d, 10)).filter((d: any) => !isNaN(d))
      : []
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    if (form.recurrence_type === 'weekly' && form.recurrence_days.length === 0) {
      alert('Selecione pelo menos 1 dia da semana para a recorrência semanal.');
      return;
    }

    if (form.recurrence_type === 'monthly' && (form.recurrence_days.length === 0 || form.recurrence_days[0] < 1 || form.recurrence_days[0] > 28)) {
      alert('Selecione um dia do mês válido entre 1 e 28.');
      return;
    }
    
    const payload = {
      title: form.title,
      client_id: form.client_id || null,
      priority: form.priority,
      due_date: form.due_date || null,
      description: form.description,
      recurrence_type: form.recurrence_type,
      recurrence_days: form.recurrence_type === 'weekly' 
        ? form.recurrence_days 
        : (form.recurrence_type === 'monthly' 
            ? (form.recurrence_days.length > 0 ? form.recurrence_days : [1]) 
            : null),
      agency_id: agencyId
    };
    
    if (task) {
      await supabase.from('agency_tasks')
        .update(payload)
        .eq('agency_id', agencyId)
        .eq('id', task.id);
    } else {
      await supabase.from('agency_tasks').insert([payload]);
    }
    onSuccess();
  };

  const handleDelete = async () => {
    if (task && window.confirm('Deseja excluir esta tarefa?')) {
      await supabase.from('agency_tasks')
        .delete()
        .eq('agency_id', agencyId)
        .eq('id', task.id);
      onSuccess();
    }
  };

  const toggleDay = (dayId: number) => {
    setForm(prev => {
      const days = [...prev.recurrence_days];
      const index = days.indexOf(dayId);
      if (index === -1) days.push(dayId);
      else days.splice(index, 1);
      return { ...prev, recurrence_days: days };
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[60] flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-brand-dark">{task ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors"><X size={20}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <form id="task-form" onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Título</label>
              <input autoFocus type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-dark/20 outline-none" required />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cliente (Opcional)</label>
              <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-dark/20 outline-none cursor-pointer">
                <option value="">Nenhum (Agência Interno)</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Prioridade</label>
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as AgencyTaskPriority})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-dark/20 outline-none cursor-pointer">
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Data Limite</label>
                <CustomDatePicker value={form.due_date} onChange={date => setForm({...form, due_date: date})} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Recorrência</label>
                <select value={form.recurrence_type} onChange={e => {
                  const val = e.target.value as AgencyTaskRecurrenceType;
                  setForm(prev => ({
                    ...prev,
                    recurrence_type: val,
                    recurrence_days: val === 'monthly' ? [1] : []
                  }));
                }} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-dark/20 outline-none cursor-pointer">
                  <option value="none">Não recorrente</option>
                  <option value="daily">Diária</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </div>

              {form.recurrence_type === 'weekly' && (
                <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-purple-600/70">Dias da Semana</label>
                  <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map(day => {
                      const isSelected = form.recurrence_days.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className={`w-9 h-9 rounded-full text-xs font-bold transition-colors ${isSelected ? 'bg-purple-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {form.recurrence_type === 'monthly' && (
                <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-purple-600/70">Dia do Mês (1 a 28)</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={form.recurrence_days?.[0] || 1}
                    onChange={e => {
                      const val = Math.max(1, Math.min(28, parseInt(e.target.value, 10) || 1));
                      setForm(prev => ({ ...prev, recurrence_days: [val] }));
                    }}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-dark/20 outline-none font-bold text-sm text-brand-dark"
                    required
                  />
                  <p className="text-[10px] text-gray-400">Escolha o dia em que a tarefa se repete mensalmente.</p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Descrição (Opcional)</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={4} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-dark/20 outline-none resize-none"></textarea>
            </div>
          </form>
        </div>
        
        <div className="p-6 border-t border-gray-100 flex gap-4 bg-gray-50/50">
          {task && (
            <button type="button" onClick={handleDelete} className="p-4 text-red-500 hover:bg-red-50 rounded-xl transition-all">
              <Trash2 size={24} />
            </button>
          )}
          <button type="submit" form="task-form" className="flex-1 py-4 bg-brand-dark text-white rounded-xl font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
            Salvar
          </button>
        </div>
      </motion.div>
    </>
  );
};

// ==========================================
// MODAL: NOVO PROCESSO
// ==========================================
const ProcessFormModal: React.FC<{ clients: any[], onClose: () => void, onSuccess: () => void }> = ({ clients, onClose, onSuccess }) => {
  const { agencyId } = useAuth();
  const [form, setForm] = useState({ client_id: '', process_type: PROCESS_TYPES[0].id, process_name: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.process_type || !form.process_name) return alert('Preencha os campos.');
    
    setLoading(true);
    try {
      // 1. Criar a instância
      const { data: instance, error: errInstance } = await supabase
        .from('process_instances')
        .insert({ client_id: form.client_id, process_type: form.process_type, process_name: form.process_name, agency_id: agencyId })
        .select().single();
        
      if (errInstance || !instance) throw errInstance;

      // 2. Buscar templates pai
      let { data: pais } = await supabase
        .from('process_templates')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('process_type', form.process_type)
        .is('parent_id', null)
        .order('position');
        
      let usedAgencyIdForTemplates = agencyId;

      if (!pais || pais.length === 0) {
        if (agencyId !== 1) {
          const { data: defaultPais } = await supabase
            .from('process_templates')
            .select('*')
            .eq('agency_id', 1)
            .eq('process_type', form.process_type)
            .is('parent_id', null)
            .order('position');
            
          if (defaultPais && defaultPais.length > 0) {
            pais = defaultPais;
            usedAgencyIdForTemplates = 1;
          }
        }
      }

      const mapaIds: Record<string, string> = {};
      
      if (pais && pais.length > 0) {
        // 3. Inserir etapas pai e mapear IDs
        for (const pai of pais) {
          const { data } = await supabase
            .from('process_checklist')
            .insert({
              instance_id: instance.id,
              client_id: form.client_id,
              agency_id: agencyId,
              title: pai.title,
              description: pai.description,
              responsible: pai.responsible,
              position: pai.position
            }).select().single();
          if (data) mapaIds[pai.id] = data.id;
        }

        // 4. Buscar e inserir sub-etapas
        const { data: filhos } = await supabase
          .from('process_templates')
          .select('*')
          .eq('agency_id', usedAgencyIdForTemplates)
          .eq('process_type', form.process_type)
          .not('parent_id', 'is', null)
          .order('position');

        if (filhos && filhos.length > 0) {
          const payloadFilhos = filhos.filter(f => mapaIds[f.parent_id!]).map(filho => ({
            instance_id: instance.id,
            client_id: form.client_id,
            agency_id: agencyId,
            title: filho.title,
            description: filho.description,
            responsible: filho.responsible,
            position: filho.position,
            parent_id: mapaIds[filho.parent_id!]
          }));
          if (payloadFilhos.length > 0) {
              await supabase.from('process_checklist')
                  .insert(payloadFilhos.map(p => ({ ...p, agency_id: agencyId })));
          }
        }
      }
      onSuccess();
    } catch (e: any) {
      console.error(e);
      alert('Erro ao iniciar processo: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors"><X size={20}/></button>
          
          <h2 className="text-xl font-bold text-brand-dark mb-6">Iniciar Novo Processo</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cliente</label>
              <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-dark/20 outline-none cursor-pointer" required>
                <option value="">Selecione o Cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Tipo de Processo</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROCESS_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <button 
                      key={type.id} 
                      type="button"
                      onClick={() => setForm({...form, process_type: type.id, process_name: form.process_name || `Novo ${type.name}`})}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${form.process_type === type.id ? 'border-brand-dark bg-brand-dark/5' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className={`p-2 rounded-lg ${type.color}`}><Icon size={16} /></div>
                      <span className="text-sm font-bold text-gray-700">{type.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Identificação do Processo</label>
              <input type="text" value={form.process_name} onChange={e => setForm({...form, process_name: e.target.value})} placeholder="Ex: Campanha Dia das Mães" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-dark/20 outline-none" required />
            </div>
            
            <button type="submit" disabled={loading} className="w-full mt-4 py-4 bg-brand-dark text-white rounded-xl font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? 'Iniciando...' : 'Iniciar Processo'}
            </button>
          </form>
        </div>
      </motion.div>
    </>
  );
}

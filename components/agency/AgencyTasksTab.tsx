
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Calendar, 
  Clock, 
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  X,
  Check,
  Edit2,
  GripVertical
} from 'lucide-react';
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
import { supabase } from '../../lib/supabase';
import { AgencyTask, AgencyTaskPriority, AgencyTaskRecurrenceType } from '../../types';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isTomorrow from 'dayjs/plugin/isTomorrow';

dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isTomorrow);
dayjs.locale('pt-br');

const WEEK_DAYS = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
];

export const AgencyTasksTab: React.FC = () => {
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<AgencyTask | null>(null);
  const [filterClient, setFilterClient] = useState<string>('all');
  const [newTask, setNewTask] = useState({
    title: '',
    client_id: '' as string | null,
    priority: 'normal' as AgencyTaskPriority,
    recurrence_type: 'none' as AgencyTaskRecurrenceType,
    recurrence_days: [] as number[],
    due_date: ''
  });

  useEffect(() => {
    fetchTasks();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, color, initials')
        .order('name');
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agency_tasks')
        .select('*, client:clients(id, name, color, initials)')
        .order('status', { ascending: true })
        .order('priority', { ascending: false }) // Urgent first
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    try {
      const { data, error } = await supabase
        .from('agency_tasks')
        .insert([{
          title: newTask.title,
          client_id: newTask.client_id || null,
          priority: newTask.priority,
          recurrence_type: newTask.recurrence_type,
          recurrence_days: newTask.recurrence_type === 'custom_days' ? newTask.recurrence_days : null,
          is_daily: newTask.recurrence_type === 'daily',
          due_date: newTask.due_date || null,
          status: 'pending'
        }])
        .select();

      if (error) throw error;
      
      if (data && data.length > 0) {
        setTasks(prev => [data[0], ...prev]);
      }
      setIsAddingTask(false);
      setNewTask({ title: '', client_id: '', priority: 'normal', recurrence_type: 'none', recurrence_days: [], due_date: '' });
      fetchTasks(); // Refresh to ensure correct ordering
    } catch (error: any) {
      console.error('Error adding task:', error);
      alert(`Erro ao salvar tarefa: ${error.message || 'Erro desconhecido'}. \n\nCertifique-se de que rodou o SQL para adicionar as novas colunas no Supabase.`);
    }
  };

  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title.trim()) return;

    try {
      const { error } = await supabase
        .from('agency_tasks')
        .update({
          title: editingTask.title,
          client_id: editingTask.client_id || null,
          priority: editingTask.priority,
          recurrence_type: editingTask.recurrence_type,
          recurrence_days: editingTask.recurrence_type === 'custom_days' ? editingTask.recurrence_days : null,
          is_daily: editingTask.recurrence_type === 'daily',
          due_date: editingTask.due_date || null,
        })
        .eq('id', editingTask.id);

      if (error) throw error;
      
      setEditingTask(null);
      fetchTasks(); // Refresh to ensure correct ordering
    } catch (error: any) {
      console.error('Error updating task:', error);
      alert(`Erro ao atualizar tarefa: ${error.message || 'Erro desconhecido'}.`);
    }
  };

  const toggleTaskStatus = async (task: AgencyTask) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : null;

    try {
      const { error } = await supabase
        .from('agency_tasks')
        .update({ 
          status: newStatus,
          completed_at: completedAt
        })
        .eq('id', task.id);

      if (error) throw error;

      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: newStatus, completed_at: completedAt } : t
      ));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase
        .from('agency_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const getPriorityColor = (priority: AgencyTaskPriority) => {
    switch (priority) {
      case 'urgent': return 'text-red-500 bg-red-50 border-red-100';
      case 'high': return 'text-orange-500 bg-orange-50 border-orange-100';
      case 'normal': return 'text-blue-500 bg-blue-50 border-blue-100';
      case 'low': return 'text-gray-500 bg-gray-50 border-gray-100';
      default: return 'text-gray-500 bg-gray-50 border-gray-100';
    }
  };

  const getDueDateLabel = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const date = dayjs(dateStr);
    if (date.isToday()) return { label: 'Hoje', color: 'text-orange-600 bg-orange-50' };
    if (date.isTomorrow()) return { label: 'Amanhã', color: 'text-blue-600 bg-blue-50' };
    if (date.isBefore(dayjs(), 'day')) return { label: 'Atrasado', color: 'text-red-600 bg-red-50' };
    return { label: date.format('DD [de] MMM'), color: 'text-gray-600 bg-gray-50' };
  };

  const filteredTasks = tasks.filter(t => {
    if (filterClient === 'all') return true;
    if (filterClient === 'internal') return !t.client_id;
    return t.client_id === filterClient;
  });

  const urgentTasks = filteredTasks.filter(t => t.priority === 'urgent' && t.status === 'pending').sort((a, b) => (a.position || 0) - (b.position || 0));
  const recurringTasks = filteredTasks.filter(t => t.recurrence_type !== 'none' && t.status === 'pending').sort((a, b) => (a.position || 0) - (b.position || 0));
  const otherTasks = filteredTasks.filter(t => t.priority !== 'urgent' && t.recurrence_type === 'none' && t.status === 'pending').sort((a, b) => (a.position || 0) - (b.position || 0));
  const completedTasks = filteredTasks.filter(t => t.status === 'done').sort((a, b) => (a.position || 0) - (b.position || 0));

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

  const onDragEnd = async (event: DragEndEvent, taskGroup: AgencyTask[]) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = taskGroup.findIndex(t => t.id === active.id);
      const newIndex = taskGroup.findIndex(t => t.id === over.id);
      
      const reordered = arrayMove(taskGroup, oldIndex, newIndex);
      
      const updatedTasks = [...tasks];
      const updatesToDb: any[] = [];

      reordered.forEach((task, index) => {
        const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
        if (taskIndex !== -1) {
          updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], position: index };
          updatesToDb.push({ id: task.id, position: index });
        }
      });
      
      setTasks(updatedTasks);

      for (const update of updatesToDb) {
        await supabase
          .from('agency_tasks')
          .update({ position: update.position })
          .eq('id', update.id);
      }
    }
  };

  const toggleDay = (dayId: number) => {
    setNewTask(prev => ({
      ...prev,
      recurrence_days: prev.recurrence_days.includes(dayId)
        ? prev.recurrence_days.filter(d => d !== dayId)
        : [...prev.recurrence_days, dayId]
    }));
  };

  const toggleDayEdit = (dayId: number) => {
    if (!editingTask) return;
    setEditingTask(prev => {
      if (!prev) return prev;
      const currentDays = prev.recurrence_days || [];
      return {
        ...prev,
        recurrence_days: currentDays.includes(dayId)
          ? currentDays.filter(d => d !== dayId)
          : [...currentDays, dayId]
      };
    });
  };

  return (
    <div className="space-y-8">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark">Processos & Tarefas</h2>
          <p className="text-sm text-gray-500">Gerencie as atividades diárias e urgentes da agência.</p>
        </div>
        <button
          onClick={() => setIsAddingTask(true)}
          className="flex items-center gap-2 px-6 py-3 bg-brand-dark text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:shadow-xl transition-all transform hover:-translate-y-1"
        >
          <Plus size={18} />
          <span>Nova Tarefa</span>
        </button>
      </div>

      {/* Add Task Modal/Form */}
      <AnimatePresence>
        {isAddingTask && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-dark/20 backdrop-blur-sm"
          >
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-black/[0.05] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-brand-dark">Cadastrar Tarefa</h3>
                <button onClick={() => setIsAddingTask(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleAddTask} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cliente / Projeto</label>
                  <select
                    value={newTask.client_id || ''}
                    onChange={e => setNewTask({ ...newTask, client_id: e.target.value || null })}
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-brand-dark/10 text-brand-dark font-medium transition-all appearance-none"
                  >
                    <option value="">Canguru Digital (Interno)</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Título da Tarefa</label>
                  <input
                    autoFocus
                    type="text"
                    value={newTask.title}
                    onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Ex: Checar contas de anúncios"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-brand-dark/10 text-brand-dark font-medium transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Prioridade</label>
                    <select
                      value={newTask.priority}
                      onChange={e => setNewTask({ ...newTask, priority: e.target.value as AgencyTaskPriority })}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-brand-dark/10 text-brand-dark font-medium transition-all appearance-none"
                    >
                      <option value="low">Baixa</option>
                      <option value="normal">Normal</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Data Limite</label>
                    <input
                      type="date"
                      value={newTask.due_date}
                      onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-brand-dark/10 text-brand-dark font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Repetição</label>
                    <select
                      value={newTask.recurrence_type}
                      onChange={e => setNewTask({ ...newTask, recurrence_type: e.target.value as AgencyTaskRecurrenceType })}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-brand-dark/10 text-brand-dark font-medium transition-all appearance-none"
                    >
                      <option value="none">Nenhuma</option>
                      <option value="daily">Diária</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                      <option value="custom_days">Dias Específicos</option>
                    </select>
                  </div>

                  {newTask.recurrence_type === 'custom_days' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Dias da Semana</label>
                      <div className="flex flex-wrap gap-2">
                        {WEEK_DAYS.map(day => (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDay(day.id)}
                            className={`
                              px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border
                              ${newTask.recurrence_days.includes(day.id)
                                ? 'bg-brand-dark border-brand-dark text-white'
                                : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-brand-dark/20'
                              }
                            `}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-brand-dark text-white rounded-2xl font-bold uppercase tracking-widest hover:shadow-xl transition-all transform hover:-translate-y-1"
                >
                  Salvar Tarefa
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Task Modal/Form */}
      <AnimatePresence>
        {editingTask && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-dark/20 backdrop-blur-sm"
          >
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-black/[0.05] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-brand-dark">Editar Tarefa</h3>
                <button onClick={() => setEditingTask(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleEditTask} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cliente / Projeto</label>
                  <select
                    value={editingTask.client_id || ''}
                    onChange={e => setEditingTask({ ...editingTask, client_id: e.target.value || null })}
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-brand-dark/10 text-brand-dark font-medium transition-all appearance-none"
                  >
                    <option value="">Canguru Digital (Interno)</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Título da Tarefa</label>
                  <input
                    autoFocus
                    type="text"
                    value={editingTask.title}
                    onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                    placeholder="Ex: Checar contas de anúncios"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-brand-dark/10 text-brand-dark font-medium transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Prioridade</label>
                    <select
                      value={editingTask.priority}
                      onChange={e => setEditingTask({ ...editingTask, priority: e.target.value as AgencyTaskPriority })}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-brand-dark/10 text-brand-dark font-medium transition-all appearance-none"
                    >
                      <option value="low">Baixa</option>
                      <option value="normal">Normal</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Data Limite</label>
                    <input
                      type="date"
                      value={editingTask.due_date || ''}
                      onChange={e => setEditingTask({ ...editingTask, due_date: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-brand-dark/10 text-brand-dark font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Repetição</label>
                    <select
                      value={editingTask.recurrence_type}
                      onChange={e => setEditingTask({ ...editingTask, recurrence_type: e.target.value as AgencyTaskRecurrenceType })}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-brand-dark/10 text-brand-dark font-medium transition-all appearance-none"
                    >
                      <option value="none">Nenhuma</option>
                      <option value="daily">Diária</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                      <option value="custom_days">Dias Específicos</option>
                    </select>
                  </div>

                  {editingTask.recurrence_type === 'custom_days' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Dias da Semana</label>
                      <div className="flex flex-wrap gap-2">
                        {WEEK_DAYS.map(day => (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDayEdit(day.id)}
                            className={`
                              px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border
                              ${(editingTask.recurrence_days || []).includes(day.id)
                                ? 'bg-brand-dark border-brand-dark text-white'
                                : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-brand-dark/20'
                              }
                            `}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-brand-dark text-white rounded-2xl font-bold uppercase tracking-widest hover:shadow-xl transition-all transform hover:-translate-y-1"
                >
                  Salvar Alterações
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and Task Lists */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2 text-gray-400">
          <Filter size={18} />
          <span className="text-xs font-bold uppercase tracking-widest">Filtrar por Cliente:</span>
        </div>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm font-medium text-brand-dark focus:ring-2 focus:ring-brand-dark/10 outline-none"
        >
          <option value="all">Todos</option>
          <option value="internal">Canguru Digital (Interno)</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Urgent & Daily Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Urgent Section */}
          {urgentTasks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle size={20} />
                <h3 className="font-bold uppercase tracking-[0.2em] text-xs">Urgentes</h3>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, urgentTasks)}>
                <SortableContext items={urgentTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="grid gap-3">
                    {urgentTasks.map(task => (
                      <SortableTaskCard key={task.id} task={task} onToggle={toggleTaskStatus} onDelete={deleteTask} onEdit={setEditingTask} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </section>
          )}

          {/* Recurring Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-brand-dark">
              <Clock size={20} />
              <h3 className="font-bold uppercase tracking-[0.2em] text-xs">Processos Recorrentes</h3>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, recurringTasks)}>
              <SortableContext items={recurringTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="grid gap-3">
                  {recurringTasks.length > 0 ? (
                    recurringTasks.map(task => (
                      <SortableTaskCard key={task.id} task={task} onToggle={toggleTaskStatus} onDelete={deleteTask} onEdit={setEditingTask} />
                    ))
                  ) : (
                    <EmptyState message="Nenhum processo recorrente pendente." />
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </section>

          {/* Other Tasks Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-gray-400">
              <ClipboardList size={20} />
              <h3 className="font-bold uppercase tracking-[0.2em] text-xs">Tarefas Únicas</h3>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, otherTasks)}>
              <SortableContext items={otherTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="grid gap-3">
                  {otherTasks.length > 0 ? (
                    otherTasks.map(task => (
                      <SortableTaskCard key={task.id} task={task} onToggle={toggleTaskStatus} onDelete={deleteTask} onEdit={setEditingTask} />
                    ))
                  ) : (
                    <EmptyState message="Nenhuma outra tarefa pendente." />
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        </div>

        {/* Completed Column */}
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle2 size={20} />
              <h3 className="font-bold uppercase tracking-[0.2em] text-xs">Concluídas</h3>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, completedTasks)}>
              <SortableContext items={completedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="grid gap-3 opacity-60">
                  {completedTasks.length > 0 ? (
                    completedTasks.map(task => (
                      <SortableTaskCard key={task.id} task={task} onToggle={toggleTaskStatus} onDelete={deleteTask} onEdit={setEditingTask} />
                    ))
                  ) : (
                    <EmptyState message="Nenhuma tarefa concluída ainda." />
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        </div>
      </div>
    </div>
  );
};

interface TaskCardProps {
  task: AgencyTask;
  onToggle: (task: AgencyTask) => void;
  onDelete: (id: string) => void;
  onEdit: (task: AgencyTask) => void;
  dragListeners?: any;
  dragAttributes?: any;
}

const SortableTaskCard: React.FC<TaskCardProps> = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard {...props} dragListeners={listeners} dragAttributes={attributes} />
    </div>
  );
};

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onDelete, onEdit, dragListeners, dragAttributes }) => {
  const isDone = task.status === 'done';
  const dueDateInfo = getDueDateLabel(task.due_date);

  function getPriorityColor(priority: AgencyTaskPriority) {
    switch (priority) {
      case 'urgent': return 'text-red-500 bg-red-50 border-red-100';
      case 'high': return 'text-orange-500 bg-orange-50 border-orange-100';
      case 'normal': return 'text-blue-500 bg-blue-50 border-blue-100';
      case 'low': return 'text-gray-500 bg-gray-50 border-gray-100';
      default: return 'text-gray-500 bg-gray-50 border-gray-100';
    }
  }
  
  function getDueDateLabel(dateStr: string | null | undefined) {
    if (!dateStr) return null;
    const date = dayjs(dateStr);
    if (date.isToday()) return { label: 'Hoje', color: 'text-orange-600 bg-orange-50' };
    if (date.isTomorrow()) return { label: 'Amanhã', color: 'text-blue-600 bg-blue-50' };
    if (date.isBefore(dayjs(), 'day')) return { label: 'Atrasado', color: 'text-red-600 bg-red-50' };
    return { label: date.format('DD [de] MMM'), color: 'text-gray-600 bg-gray-50' };
  }

  const getRecurrenceLabel = () => {
    switch (task.recurrence_type) {
      case 'daily': return 'Diário';
      case 'weekly': return 'Semanal';
      case 'monthly': return 'Mensal';
      case 'custom_days': 
        if (!task.recurrence_days) return 'Personalizado';
        return task.recurrence_days.map(d => WEEK_DAYS.find(wd => wd.id === d)?.label).join(', ');
      default: return null;
    }
  };

  const recurrenceLabel = getRecurrenceLabel();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        group flex items-center gap-4 p-5 rounded-3xl bg-white border border-black/[0.03] shadow-sm hover:shadow-md transition-all
        ${isDone ? 'bg-gray-50/50' : ''}
      `}
    >
      <div 
        className="flex-shrink-0 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1"
        {...dragAttributes} 
        {...dragListeners}
      >
        <GripVertical size={16} />
      </div>

      <button
        onClick={() => onToggle(task)}
        className={`
          flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all
          ${isDone 
            ? 'bg-green-500 border-green-500 text-white' 
            : 'border-gray-200 text-transparent hover:border-brand-dark hover:text-brand-dark/20'
          }
        `}
      >
        <Check size={16} strokeWidth={3} />
      </button>

      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`font-bold text-sm truncate ${isDone ? 'text-gray-400 line-through' : 'text-brand-dark'}`}>
            {task.title}
          </h4>
          {task.client ? (
            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter text-white" style={{ backgroundColor: task.client.color }}>
              {task.client.name}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-brand-dark text-white text-[8px] font-black uppercase tracking-tighter">
              Canguru Digital
            </span>
          )}
          {recurrenceLabel && (
            <span className="px-2 py-0.5 rounded-full bg-brand-dark/5 text-brand-dark text-[8px] font-black uppercase tracking-tighter">
              {recurrenceLabel}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
            {task.priority === 'urgent' ? 'Urgente' : task.priority === 'high' ? 'Alta' : task.priority === 'normal' ? 'Normal' : 'Baixa'}
          </span>
          
          {dueDateInfo && !isDone && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${dueDateInfo.color}`}>
              <Calendar size={10} />
              {dueDateInfo.label}
            </span>
          )}

          {isDone && task.completed_at && (
            <span className="text-[9px] text-gray-400 font-medium italic">
              Concluído em {dayjs(task.completed_at).format("DD/MM [às] HH:mm")}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={() => onEdit(task)}
          className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  );
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="p-8 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
    <p className="text-sm text-gray-400 font-medium">{message}</p>
  </div>
);

const ClipboardList: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <path d="M12 11h4"/>
    <path d="M12 16h4"/>
    <path d="M8 11h.01"/>
    <path d="M8 16h.01"/>
  </svg>
);

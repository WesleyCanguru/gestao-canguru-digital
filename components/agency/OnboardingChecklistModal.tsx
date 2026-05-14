import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { OnboardingChecklist, OnboardingTemplate, Client } from '../../types';
import { X, CheckCircle, Circle, Plus, Trash2, Calendar, Target, Flag } from 'lucide-react';
import dayjs from 'dayjs';

interface OnboardingChecklistModalProps {
  client: Client & { onboarding_checklist?: OnboardingChecklist[]; services?: string[] };
  onClose: () => void;
}

const SERVICE_MAP: Record<string, string> = {
  'Social Media': 'social_media',
  'Tráfego Pago': 'trafego_pago',
  'E-mail Marketing': 'email_marketing',
  'Website': 'website'
};

const PHASES = [
  { phase: 2, defaultName: 'Após Fechado' },
  { phase: 3, defaultName: 'Acessos e Configuração' },
  { phase: 4, defaultName: 'Estratégia' },
  { phase: 5, defaultName: 'Produção e Lançamento' },
  { phase: 6, defaultName: 'Kickoff e Entrega' }
];

export function OnboardingChecklistModal({ client, onClose }: OnboardingChecklistModalProps) {
  const [items, setItems] = useState<OnboardingChecklist[]>(client.onboarding_checklist || []);
  const [loading, setLoading] = useState(false);
  const [addingPhase, setAddingPhase] = useState<number | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');

  useEffect(() => {
    if (!client.onboarding_checklist || client.onboarding_checklist.length === 0) {
      generateChecklist();
    } else {
      // Refresh to ensure we have the latest
      fetchChecklist();
    }
  }, []);

  const fetchChecklist = async () => {
    const { data } = await supabase
      .from('onboarding_checklist')
      .select('*')
      .eq('client_id', client.id)
      .order('phase')
      .order('position');
    if (data) setItems(data as OnboardingChecklist[]);
  };

  const generateChecklist = async () => {
    setLoading(true);
    try {
      const { data: templates } = await supabase
        .from('onboarding_templates')
        .select('*')
        .eq('is_active', true)
        .order('phase')
        .order('position');

      if (!templates || templates.length === 0) {
        setLoading(false);
        return;
      }

      const clientServicesSlugs = (client.services || []).map(s => SERVICE_MAP[s]).filter(Boolean);

      const itemsToInsert = templates
        .filter((tpl: OnboardingTemplate) => {
          if (!tpl.required_services || tpl.required_services.length === 0) return true;
          return tpl.required_services.some(slug => clientServicesSlugs.includes(slug));
        })
        .map((tpl: OnboardingTemplate) => ({
          client_id: client.id,
          agency_id: tpl.agency_id,
          phase: tpl.phase,
          phase_name: tpl.phase_name,
          title: tpl.title,
          description: tpl.description,
          is_completed: false,
          position: tpl.position
        }));

      if (itemsToInsert.length > 0) {
        const { data, error } = await supabase
          .from('onboarding_checklist')
          .insert(itemsToInsert)
          .select('*')
          .order('phase')
          .order('position');
        
        if (error) throw error;
        if (data) setItems(data as OnboardingChecklist[]);
      }
    } catch (err) {
      console.error('Error generating checklist:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (item: OnboardingChecklist) => {
    const newIsCompleted = !item.is_completed;
    const now = newIsCompleted ? new Date().toISOString() : null;
    
    // Optimistic update
    setItems(items.map(i => i.id === item.id ? { ...i, is_completed: newIsCompleted, completed_at: now } : i));

    await supabase
      .from('onboarding_checklist')
      .update({ is_completed: newIsCompleted, completed_at: now })
      .eq('id', item.id);
  };

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja remover este item?')) return;
    
    setItems(items.filter(i => i.id !== id));
    await supabase.from('onboarding_checklist').delete().eq('id', id);
  };

  const handleAddItem = async (phase: number, phaseName: string) => {
    if (!newItemTitle.trim()) {
      setAddingPhase(null);
      return;
    }

    const newItem = {
      client_id: client.id,
      agency_id: client.agency_id || 1,
      phase,
      phase_name: phaseName,
      title: newItemTitle,
      description: null,
      is_completed: false,
      position: 999 
    };

    const { data } = await supabase
      .from('onboarding_checklist')
      .insert([newItem])
      .select('*')
      .single();

    if (data) {
      setItems([...items, data as OnboardingChecklist]);
    }
    setNewItemTitle('');
    setAddingPhase(null);
  };

  const itemsByPhase = items.reduce((acc, item) => {
    if (!acc[item.phase]) acc[item.phase] = [];
    acc[item.phase].push(item);
    return acc;
  }, {} as Record<number, OnboardingChecklist[]>);

  const totalItems = items.length;
  const completedItems = items.filter(i => i.is_completed).length;
  const progressPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-2xl font-black text-brand-dark tracking-tight">Checklist de Onboarding</h3>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Cliente: {client.name}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm group"
          >
            <X size={24} className="text-gray-400 group-hover:text-red-500 transition-colors" />
          </button>
        </div>

        <div className="bg-white p-6 border-b border-gray-100 flex gap-6 items-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-dark/5 flex items-center justify-center text-brand-dark flex-shrink-0">
            <Target size={32} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Progresso Geral</span>
              <span className="text-lg font-black text-brand-dark">{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-dark rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">
              {completedItems} de {totalItems} tarefas concluídas
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 hide-scrollbar bg-gray-50/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-dark mb-4"></div>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Gerando Checklist Inicial...</p>
            </div>
          ) : (
            <div className="space-y-12">
              {PHASES.map((p) => {
                const phaseItems = itemsByPhase[p.phase] || [];
                const phaseCompleted = phaseItems.filter(i => i.is_completed).length;
                const phaseTotal = phaseItems.length;
                const phaseProgress = phaseTotal > 0 ? (phaseCompleted / phaseTotal) * 100 : 0;
                
                // Group by phase_name to allow "Estratégia - Social Media" subdivisions
                const subGroups = phaseItems.reduce((acc, item) => {
                  const name = item.phase_name || p.defaultName;
                  if (!acc[name]) acc[name] = [];
                  acc[name].push(item);
                  return acc;
                }, {} as Record<string, OnboardingChecklist[]>);

                return (
                  <div key={p.phase} className="relative">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-brand-dark font-black">
                        {p.phase}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-900">{p.defaultName}</h4>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-dark transition-all" style={{ width: `${phaseProgress}%` }} />
                          </div>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                            {phaseCompleted} / {phaseTotal}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="ml-5 pl-8 border-l-2 border-gray-100 space-y-6">
                      {Object.entries(subGroups).length > 0 ? (
                        Object.entries(subGroups).map(([groupName, groupItems]) => (
                          <div key={groupName} className="space-y-3">
                            {groupName !== p.defaultName && (
                              <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{groupName}</h5>
                            )}
                            {(groupItems as OnboardingChecklist[]).map(item => (
                              <div 
                                key={item.id}
                                className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer group ${
                                  item.is_completed ? 'bg-white border-green-100 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'
                                }`}
                                onClick={() => toggleItem(item)}
                              >
                                <div className={`pt-0.5 transition-colors ${item.is_completed ? 'text-green-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
                                  {item.is_completed ? <CheckCircle size={20} /> : <Circle size={20} />}
                                </div>
                                <div className="flex-1">
                                  <p className={`font-bold transition-all ${item.is_completed ? 'text-gray-900 line-through opacity-70' : 'text-gray-900'}`}>
                                    {item.title}
                                  </p>
                                  {item.description && (
                                    <p className={`text-sm mt-1 transition-all ${item.is_completed ? 'text-gray-400 line-through opacity-70' : 'text-gray-500'}`}>
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                                {item.is_completed && item.completed_at && (
                                  <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                    <Calendar size={10} />
                                    {dayjs(item.completed_at).format('DD/MM')}
                                  </div>
                                )}
                                <button
                                  onClick={(e) => deleteItem(item.id, e)}
                                  className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 italic">Nenhum item nesta fase.</p>
                      )}

                      {addingPhase === p.phase ? (
                        <div className="flex items-center gap-3 mt-4">
                          <input 
                            type="text"
                            autoFocus
                            placeholder="Título da nova tarefa..."
                            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
                            value={newItemTitle}
                            onChange={(e) => setNewItemTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddItem(p.phase, p.defaultName);
                              if (e.key === 'Escape') setAddingPhase(null);
                            }}
                          />
                          <button 
                            onClick={() => handleAddItem(p.phase, p.defaultName)}
                            className="px-6 py-3 bg-brand-dark text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90"
                          >
                            Salvar
                          </button>
                          <button 
                            onClick={() => setAddingPhase(null)}
                            className="p-3 text-gray-400 hover:bg-gray-100 rounded-xl"
                          >
                            <X size={20} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setAddingPhase(p.phase)}
                          className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-brand-dark transition-colors uppercase tracking-widest mt-4"
                        >
                          <Plus size={14} /> Adicionar Item
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

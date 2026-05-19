import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { OnboardingChecklist, OnboardingTemplate, Client } from '../../types';
import { X, CheckCircle, Circle, Plus, Trash2, Calendar, Target, Flag, ChevronRight, ChevronDown } from 'lucide-react';
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

export function ClientChecklistView({ client, onClose }: OnboardingChecklistModalProps) {
  const { userRole, agencyId } = useAuth();
  const [items, setItems] = useState<OnboardingChecklist[]>(client.onboarding_checklist || []);
  const [loading, setLoading] = useState(false);
  const [addingPhase, setAddingPhase] = useState<number | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [activePhase, setActivePhase] = useState<number>(2);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if ((!items || items.length === 0) && userRole === 'admin') {
      generateChecklist();
    } else {
      fetchChecklist();
    }
  }, []);

  const fetchChecklist = async () => {
    if (!agencyId) return;
    const { data } = await supabase
      .from('onboarding_checklist')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('client_id', client.id)
      .order('phase')
      .order('position');
    if (data) setItems(data as OnboardingChecklist[]);
  };

  const generateChecklist = async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const { data: templates } = await supabase
        .from('onboarding_templates')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('phase')
        .order('position');

      if (!templates || templates.length === 0) {
        setLoading(false);
        return;
      }

      const clientServicesSlugs = (client.services || []).map(s => SERVICE_MAP[s] || s).filter(Boolean);

      const validTemplates = templates.filter((tpl: OnboardingTemplate) => {
        if (!tpl.required_services || tpl.required_services.length === 0) return true;
        return tpl.required_services.some(slug => clientServicesSlugs.includes(slug));
      });

      const parentTemplates = validTemplates.filter(t => !t.parent_id);
      const childTemplates = validTemplates.filter(t => t.parent_id);

      // Insert parents first
      const itemsToInsert = parentTemplates.map((tpl: OnboardingTemplate) => ({
        client_id: client.id,
        agency_id: agencyId,
        phase: tpl.phase,
        phase_name: tpl.phase_name,
        title: tpl.title,
        description: tpl.description,
        is_completed: false,
        position: tpl.position,
        parent_id: null
      }));

      let insertedParents: OnboardingChecklist[] = [];
      if (itemsToInsert.length > 0) {
        const { data, error } = await supabase
          .from('onboarding_checklist')
          .insert(itemsToInsert)
          .select('*');
        
        if (error) throw error;
        if (data) insertedParents = data as OnboardingChecklist[];
      }

      // Map child templates to inserted parent ids
      const childItemsToInsert = childTemplates.map((tpl: OnboardingTemplate) => {
        // find matching parent in templates
        const parentTpl = parentTemplates.find(p => p.id === tpl.parent_id);
        // find matching inserted parent
        const insertedParent = insertedParents.find(p => p.title === parentTpl?.title && p.phase === parentTpl?.phase);

        return {
          client_id: client.id,
          agency_id: agencyId,
          phase: tpl.phase,
          phase_name: tpl.phase_name,
          title: tpl.title,
          description: tpl.description,
          is_completed: false,
          position: tpl.position,
          parent_id: insertedParent ? insertedParent.id : null
        };
      });

      if (childItemsToInsert.length > 0) {
        const { data: childData, error: childError } = await supabase
          .from('onboarding_checklist')
          .insert(childItemsToInsert)
          .select('*');
        if (childError) throw childError;
        insertedParents = [...insertedParents, ...(childData as OnboardingChecklist[])];
      }
      
      setItems(insertedParents.sort((a, b) => {
        if (a.phase !== b.phase) return a.phase - b.phase;
        return a.position - b.position;
      }));
    } catch (err) {
      console.error('Error generating checklist:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (item: OnboardingChecklist) => {
    // If it's a parent, don't allow checking natively if it has children?
    // Wait, the instructions imply checking sub-items checks the parent automatically, 
    // it doesn't explicitly restrict clicking the parent. We will just disable interaction on parents that have children later in the UI.

    const newIsCompleted = !item.is_completed;
    const now = newIsCompleted ? new Date().toISOString() : null;
    
    // Set this item
    let updatedItems = items.map(i => i.id === item.id ? { ...i, is_completed: newIsCompleted, completed_at: now } : i);
    
    const dbUpdates = [
      supabase.from('onboarding_checklist')
        .update({ is_completed: newIsCompleted, completed_at: now })
        .eq('agency_id', agencyId)
        .eq('id', item.id)
    ];

    // If it's a child, evaluate parent
    if (item.parent_id) {
      const parentId = item.parent_id;
      const allSiblings = updatedItems.filter(i => i.parent_id === parentId);
      const allCompleted = allSiblings.every(i => i.is_completed);
      
      const parent = updatedItems.find(i => i.id === parentId);
      if (parent && parent.is_completed !== allCompleted) {
        const parentNow = allCompleted ? new Date().toISOString() : null;
        updatedItems = updatedItems.map(i => i.id === parentId ? { ...i, is_completed: allCompleted, completed_at: parentNow } : i);
        dbUpdates.push(
          supabase.from('onboarding_checklist')
            .update({ is_completed: allCompleted, completed_at: parentNow })
            .eq('agency_id', agencyId)
            .eq('id', parentId)
        );
      }
    }

    setItems(updatedItems);
    await Promise.all(dbUpdates);
  };

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja remover este item?')) return;
    
    setItems(items.filter(i => i.id !== id));
    await supabase.from('onboarding_checklist')
      .delete()
      .eq('agency_id', agencyId)
      .eq('id', id);
  };

  const handleAddItem = async (phase: number, phaseName: string) => {
    if (!newItemTitle.trim() || !agencyId) {
      setAddingPhase(null);
      return;
    }

    const newItem = {
      client_id: client.id,
      agency_id: agencyId,
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
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-brand-dark/5 flex items-center justify-center text-brand-dark flex-shrink-0">
            <Target size={32} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-brand-dark tracking-tight">Checklist de Onboarding</h3>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
              Progresso Geral: {Math.round(progressPercent)}%
            </p>
          </div>
        </div>
        
        <div className="md:w-64">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Tarefas</span>
            <span className="text-sm font-black text-brand-dark">{completedItems}/{totalItems}</span>
          </div>
          <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-dark rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-dark mb-4"></div>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Gerando Checklist Inicial...</p>
          </div>
        ) : (
          <div className="p-6 md:p-8">
            <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-8 pb-4 border-b border-gray-100">
              {PHASES.map(p => {
                const phaseItems = itemsByPhase[p.phase] || [];
                const isCompleted = phaseItems.length > 0 && phaseItems.every(i => i.is_completed);
                return (
                  <button 
                    key={p.phase}
                    onClick={() => setActivePhase(p.phase)}
                    className={`flex items-center gap-2 px-6 py-3 whitespace-nowrap rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
                      activePhase === p.phase 
                        ? 'bg-brand-dark text-white shadow-md' 
                        : isCompleted 
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {p.defaultName}
                    {isCompleted && <CheckCircle size={16} />}
                  </button>
                );
              })}
            </div>

            <div className="space-y-6">
              {(() => {
                const p = PHASES.find(ph => ph.phase === activePhase)!;
                const phaseItems = itemsByPhase[activePhase] || [];
                const topLevelItems = phaseItems.filter(i => !i.parent_id);

                return (
                  <div className="min-h-[300px]">
                    <div className="space-y-4">
                      {topLevelItems.length > 0 ? (
                        topLevelItems.map(parentItem => {
                          const children = phaseItems.filter(i => i.parent_id === parentItem.id).sort((a,b) => a.position - b.position);
                          return (
                            <div key={parentItem.id} className="space-y-3">
                              {/* Parent Item */}
                              <div 
                                className={`flex items-start gap-4 p-4 rounded-2xl border transition-all group ${
                                  children.length === 0 ? 'cursor-pointer hover:border-gray-200' : 'cursor-pointer'
                                } ${
                                  parentItem.is_completed ? 'bg-gray-50 border-green-100' : 'bg-white border-gray-100'
                                }`}
                                onClick={() => {
                                  if (children.length > 0) {
                                    setExpandedItems(prev => ({ ...prev, [parentItem.id]: !prev[parentItem.id] }));
                                  } else if (userRole === 'admin') {
                                    toggleItem(parentItem);
                                  }
                                }}
                              >
                                {children.length > 0 && (
                                  <div className="pt-0.5 text-gray-400">
                                    {expandedItems[parentItem.id] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                  </div>
                                )}
                                <div 
                                  className={`pt-0.5 transition-colors ${parentItem.is_completed ? 'text-green-500' : 'text-gray-300'} ${children.length === 0 && userRole === 'admin' ? 'group-hover:text-gray-400' : ''}`}
                                  onClick={(e) => {
                                    // if it has children, we shouldn't allow checking natively through clicking the icon, but it's optional. Let's make icon unclickable if it has children.
                                    if (children.length > 0) return;
                                    e.stopPropagation();
                                    if (userRole === 'admin') toggleItem(parentItem);
                                  }}
                                >
                                  {parentItem.is_completed ? <CheckCircle size={20} /> : <Circle size={20} />}
                                </div>
                                <div className="flex-1">
                                  <p className={`font-bold transition-all ${parentItem.is_completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                    {parentItem.title}
                                    {children.length > 0 && (
                                      <span className="ml-2 text-xs font-semibold text-gray-400 no-underline inline-block rounded-full px-2 py-0.5 bg-gray-100/50">
                                        ({children.filter(c => c.is_completed).length}/{children.length})
                                      </span>
                                    )}
                                  </p>
                                  {parentItem.description && (
                                    <p className={`text-sm mt-1 transition-all ${parentItem.is_completed ? 'text-gray-400 line-through' : 'text-gray-500'}`}>
                                      {parentItem.description}
                                    </p>
                                  )}
                                </div>
                                {parentItem.is_completed && parentItem.completed_at && (
                                  <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                    <Calendar size={10} />
                                    {dayjs(parentItem.completed_at).format('DD/MM')}
                                  </div>
                                )}
                                {userRole === 'admin' && (
                                  <button
                                    onClick={(e) => deleteItem(parentItem.id, e)}
                                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>

                              {/* Children Items */}
                              {children.length > 0 && expandedItems[parentItem.id] && (
                                <div className="pl-6 md:pl-16 space-y-2 relative border-l border-gray-100 ml-6 md:ml-10">
                                  {children.map(child => (
                                    <div 
                                      key={child.id}
                                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${userRole === 'admin' ? 'cursor-pointer' : ''} group ${
                                        child.is_completed ? 'bg-gray-50 border-green-100' : 'bg-white border-gray-100 hover:border-gray-200'
                                      }`}
                                      onClick={() => userRole === 'admin' && toggleItem(child)}
                                    >
                                      <div className={`pt-0.5 transition-colors ${child.is_completed ? 'text-green-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
                                        {child.is_completed ? <CheckCircle size={16} /> : <Circle size={16} />}
                                      </div>
                                      <div className="flex-1">
                                        <p className={`text-sm font-semibold transition-all ${child.is_completed ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                          {child.title}
                                        </p>
                                      </div>
                                      {userRole === 'admin' && (
                                        <button
                                          onClick={(e) => deleteItem(child.id, e)}
                                          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-gray-400 italic bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                          Nenhum item nesta fase.
                        </p>
                      )}
                    </div>

                    {userRole === 'admin' && (
                      <div className="mt-8 pt-6 border-t border-gray-100">
                        {addingPhase === activePhase ? (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <input 
                              type="text"
                              autoFocus
                              placeholder="Título da nova tarefa..."
                              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
                              value={newItemTitle}
                              onChange={(e) => setNewItemTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddItem(activePhase, p.defaultName);
                                if (e.key === 'Escape') setAddingPhase(null);
                              }}
                            />
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleAddItem(activePhase, p.defaultName)}
                                className="flex-1 sm:flex-none px-6 py-3 bg-brand-dark text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                              >
                                Salvar
                              </button>
                              <button 
                                onClick={() => setAddingPhase(null)}
                                className="p-3 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors"
                              >
                                <X size={20} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setAddingPhase(activePhase)}
                            className="flex items-center justify-center w-full sm:w-auto gap-2 px-6 py-3 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                          >
                            <Plus size={16} /> Adicionar Item Extra
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

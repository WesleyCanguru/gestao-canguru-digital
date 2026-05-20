import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { OnboardingTemplate } from '../../types';
import { X, Plus, GripVertical, Settings2, Trash2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  onClose: () => void;
}

const PHASES = [
  { id: 2, name: 'Após Fechado' },
  { id: 3, name: 'Acessos e Configuração' },
  { id: 4, name: 'Estratégia' },
  { id: 5, name: 'Produção e Lançamento' },
  { id: 6, name: 'Kickoff e Entrega' }
];

const AVAILABLE_SERVICES = [
  { id: 'social_media', label: 'Social Media' },
  { id: 'trafego_pago', label: 'Tráfego Pago' },
  { id: 'email_marketing', label: 'E-mail Marketing' },
  { id: 'website', label: 'Website' }
];

export function OnboardingTemplatesModal({ onClose }: Props) {
  const { agencyId } = useAuth();
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Partial<OnboardingTemplate> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchTemplates();
  }, [agencyId]);

  const fetchTemplates = async () => {
    if (!agencyId) return;
    const { data } = await supabase
      .from('onboarding_templates')
      .select('*')
      .eq('agency_id', agencyId)
      .order('phase')
      .order('position');
    if (data) setTemplates(data as OnboardingTemplate[]);
    setLoading(false);
  };

  const handleDragEnd = async (event: DragEndEvent, phaseId: number) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTemplates((items: OnboardingTemplate[]) => {
        const phaseItems = items.filter(i => i.phase === phaseId);
        const oldIndex = phaseItems.findIndex(i => i.id === active.id);
        const newIndex = phaseItems.findIndex(i => i.id === over.id);
        
        const reordered = arrayMove(phaseItems, oldIndex, newIndex) as OnboardingTemplate[];
        
        // Update positions
        const updated = items.map(item => {
          if (item.phase === phaseId) {
            const reordItem = reordered.find(r => r.id === item.id);
            if (reordItem) return { ...item, position: reordered.indexOf(reordItem) };
          }
          return item;
        });

        // Save to DB (Fire and forget for now, to keep UI snappy)
        const updates = reordered.map((r, idx) => ({ id: r.id, position: idx }));
        updates.forEach(u => supabase.from('onboarding_templates').update({ position: u.position }).eq('agency_id', agencyId).eq('id', u.id));

        // Note: For a true robust update, we should do it in bulk, but this is simple enough.
        return updated.sort((a, b) => {
          if (a.phase !== b.phase) return a.phase - b.phase;
          return a.position - b.position;
        });
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate || !editingTemplate.title) return;

    if (editingTemplate.id) {
      // Update
      const { data, error } = await supabase
        .from('onboarding_templates')
        .update(editingTemplate)
        .eq('agency_id', agencyId)
        .eq('id', editingTemplate.id)
        .select('*')
        .single();
      
      if (data) {
        setTemplates(templates.map(t => t.id === (data as any).id ? (data as OnboardingTemplate) : t));
      }
    } else {
      // Insert
      console.log('Inserting', editingTemplate);
      const { data, error } = await supabase
        .from('onboarding_templates')
        .insert([{ 
          ...editingTemplate, 
          agency_id: agencyId,
          position: templates.filter(t => t.phase === editingTemplate.phase).length 
        }])
        .select('*')
        .single();
      
      if (data) {
        setTemplates([...templates, data as OnboardingTemplate]);
      } else if (error) {
        console.error("error adding template", error);
        alert("Erro ao adicionar: " + error.message);
      }
    }
    setEditingTemplate(null);
  };

  const deleteTemplate = async (id: string) => {
    if (!window.confirm('Excluir este template? Isso não afetará checklists de clientes existentes.')) return;
    setTemplates(templates.filter(t => t.id !== id));
    await supabase.from('onboarding_templates').delete().eq('agency_id', agencyId).eq('id', id);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-2xl font-black text-brand-dark tracking-tight">Templates de Onboarding</h3>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Configuração Geral</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
            <X size={24} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30 hide-scrollbar flex gap-8">
          <div className="flex-1 space-y-12">
            {loading && <div className="text-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-dark mx-auto"></div></div>}
            
            {!loading && PHASES.map(phase => {
              const phaseItems = templates.filter(t => t.phase === phase.id).sort((a,b) => a.position - b.position);
              const phaseTopLevel = phaseItems.filter(t => !t.parent_id);
              
              return (
                <div key={phase.id}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-gray-900 border-l-4 border-brand-dark pl-3">
                      Fase {phase.id}: {phase.name}
                    </h4>
                    <button 
                      onClick={() => setEditingTemplate({ phase: phase.id, phase_name: phase.name, is_active: true, required_services: [] })}
                      className="flex items-center gap-2 px-3 py-1.5 bg-brand-dark text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>

                  {phaseTopLevel.length === 0 ? (
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center gap-2">
                       <p className="text-sm text-gray-400 italic">Nenhum template nesta fase.</p>
                       <button 
                         onClick={async () => {
                           if (!window.confirm("Deseja copiar os templates padrão do sistema?")) return;
                           const { data: defaultTpls } = await supabase.from('onboarding_templates').select('*').eq('agency_id', 1).order('phase').order('position');
                           if (!defaultTpls) return;
                           const newTemplates = defaultTpls.map(t => ({...t, id: undefined, created_at: undefined, agency_id: agencyId}));
                           const parents = newTemplates.filter(t => !t.parent_id);
                           const { data: insertedParents } = await supabase.from('onboarding_templates').insert(parents).select('*');
                           if (insertedParents && insertedParents.length > 0) {
                             const children = newTemplates.filter(t => t.parent_id);
                             const childrenWithNewParents = children.map(c => {
                               const parentTpl = defaultTpls.find(p => p.id === c.parent_id);
                               const newParent = insertedParents.find(p => p.title === parentTpl?.title && p.phase === parentTpl?.phase);
                               return { ...c, parent_id: newParent ? newParent.id : null };
                             });
                             if (childrenWithNewParents.length > 0) {
                               await supabase.from('onboarding_templates').insert(childrenWithNewParents);
                             }
                           }
                           fetchTemplates();
                         }}
                         className="px-3 py-1.5 mt-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                       >
                         Carregar Padrões do Sistema
                       </button>
                    </div>
                  ) : (
                    <DndContext 
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDragEnd(e, phase.id)}
                    >
                      <SortableContext items={phaseTopLevel} strategy={verticalListSortingStrategy}>
                        <div className="space-y-4">
                          {phaseTopLevel.map(item => {
                            const children = templates.filter(t => t.parent_id === item.id).sort((a,b) => a.position - b.position);
                            return (
                              <div key={item.id} className="space-y-2">
                                <SortableTemplateItem 
                                  item={item} 
                                  onAddChild={() => setEditingTemplate({ phase: phase.id, phase_name: phase.name, is_active: true, required_services: [], parent_id: item.id })}
                                  onEdit={() => setEditingTemplate(item)}
                                  onDelete={() => deleteTemplate(item.id)}
                                />
                                {children.length > 0 && (
                                  <div className="pl-10 space-y-2">
                                    {children.map(child => (
                                      <div key={child.id} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-xl group hover:border-gray-200 transition-all">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-semibold text-gray-800">{child.title}</p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => setEditingTemplate(child)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded flex-shrink-0">
                                            <Settings2 size={16} />
                                          </button>
                                          <button onClick={() => deleteTemplate(child.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded flex-shrink-0">
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              );
            })}
          </div>

          {/* Edit sidebar */}
          {editingTemplate && (
            <div className="w-[400px] flex-shrink-0 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl h-fit sticky top-0">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-bold text-lg text-gray-900">
                  {editingTemplate.id ? 'Editar Template' : 'Novo Template'}
                </h4>
                <button onClick={() => setEditingTemplate(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Fase selecionada</label>
                  <div className="px-4 py-2 bg-gray-50 text-gray-500 rounded-xl font-medium border border-gray-100">
                    {editingTemplate.phase} - {editingTemplate.phase_name}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Título</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
                    value={editingTemplate.title || ''}
                    onChange={e => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                    placeholder="Ex: Definir Persona"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Descrição (Opcional)</label>
                  <textarea
                    onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                    value={editingTemplate.description || ''}
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark resize-none"
                    placeholder="Pequena descrição da tarefa..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Serviços Obrigatórios</label>
                  <p className="text-[10px] text-gray-400 mb-3">Se vazio, aparecerá para todos.</p>
                  <div className="space-y-2">
                    {AVAILABLE_SERVICES.map(srv => {
                      const isSelected = (editingTemplate.required_services || []).includes(srv.id);
                      return (
                        <label key={srv.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-brand-dark border-brand-dark text-white' : 'border-gray-300'}`}>
                            {isSelected && <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <span className="text-sm font-medium text-gray-700">{srv.label}</span>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={isSelected}
                            onChange={() => {
                              const arr = editingTemplate.required_services || [];
                              setEditingTemplate({
                                ...editingTemplate,
                                required_services: isSelected ? arr.filter(a => a !== srv.id) : [...arr, srv.id]
                              });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={editingTemplate.is_active !== false}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, is_active: e.target.checked })}
                    />
                    <div className={`w-10 h-5 rounded-full p-1 transition-colors ${editingTemplate.is_active !== false ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-transform ${editingTemplate.is_active !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm font-bold text-gray-700">Ativo</span>
                  </label>
                  <p className="text-[10px] text-gray-400 mt-1">Desativar esconde da geração de futuros clientes.</p>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button 
                    onClick={handleSaveTemplate}
                    disabled={!editingTemplate.title}
                    className="w-full px-4 py-4 bg-brand-dark text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Salvar Template
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SortableTemplateItem: React.FC<{ item: OnboardingTemplate, onAddChild: () => void, onEdit: () => void, onDelete: () => void }> = ({ item, onAddChild, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`bg-white rounded-2xl border p-4 flex items-center gap-4 group ${item.is_active ? 'border-gray-100 hover:border-brand-dark/30' : 'border-gray-200 opacity-50'}`}
    >
      <div {...attributes} {...listeners} className="text-gray-300 hover:text-brand-dark cursor-grab active:cursor-grabbing p-1">
        <GripVertical size={20} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 truncate">{item.title}</p>
        <div className="flex gap-2 mt-1 flex-wrap">
          {item.required_services && item.required_services.length > 0 ? (
            item.required_services.map(srv => {
              const lbl = AVAILABLE_SERVICES.find(a => a.id === srv)?.label || srv;
              return <span key={srv} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold uppercase tracking-widest">{lbl}</span>
            })
          ) : (
            <span className="px-2 py-0.5 bg-brand-dark/10 text-brand-dark rounded text-[9px] font-bold uppercase tracking-widest">Todos os Serviços</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onAddChild} title="Adicionar Sub-item" className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors">
          <Plus size={18} />
        </button>
        <button onClick={onEdit} className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
          <Settings2 size={18} />
        </button>
        <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

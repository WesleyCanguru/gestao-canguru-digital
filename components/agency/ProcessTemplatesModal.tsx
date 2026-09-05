import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { X, Plus, GripVertical, Settings2, Trash2, Image as ImageIcon, Video, Megaphone, Search, BarChart3, Clock } from 'lucide-react';
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

const PROCESS_TYPES = [
  { id: 'carrossel', name: 'Publicação / Carrossel', icon: ImageIcon, color: 'text-purple-500 bg-purple-50 border-purple-100' },
  { id: 'reels', name: 'Reels', icon: Video, color: 'text-pink-500 bg-pink-50 border-pink-100' },
  { id: 'campanha_meta', name: 'Campanha Meta Ads', icon: Megaphone, color: 'text-blue-500 bg-blue-50 border-blue-100' },
  { id: 'campanha_google', name: 'Campanha Google Ads', icon: Search, color: 'text-green-500 bg-green-50 border-green-100' },
  { id: 'relatorio_mensal', name: 'Relatório Mensal', icon: BarChart3, color: 'text-orange-500 bg-orange-50 border-orange-100' },
];

export function ProcessTemplatesModal({ onClose }: Props) {
  const { agencyId } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

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
      .from('process_templates')
      .select('*')
      .eq('agency_id', agencyId)
      .order('position');
    if (data) {
      const parsed = data.map(t => {
        let sla = t.sla_days;
        if (sla === undefined || sla === null) {
          if (t.description && t.description.includes('[sla:')) {
            const m = t.description.match(/\[sla:(\d+)\]/);
            if (m) sla = parseInt(m[1], 10);
          }
        }
        return { ...t, sla_days: sla || 1 };
      });
      setTemplates(parsed);
    }
    setLoading(false);
  };

  const handleDragEnd = async (event: DragEndEvent, processType: string) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTemplates((items: any[]) => {
        const typeItems = items.filter(i => i.process_type === processType && !i.parent_id);
        const oldIndex = typeItems.findIndex(i => i.id === active.id);
        const newIndex = typeItems.findIndex(i => i.id === over.id);
        
        const reordered = arrayMove(typeItems, oldIndex, newIndex) as any[];
        
        const updated = items.map(item => {
          if (item.process_type === processType && !item.parent_id) {
            const reordItem = reordered.find(r => r.id === item.id);
            if (reordItem) return { ...item, position: reordered.indexOf(reordItem) };
          }
          return item;
        });

        const updates = reordered.map((r, idx) => ({ id: r.id, position: idx }));
        updates.forEach(u => supabase.from('process_templates').update({ position: u.position }).eq('agency_id', agencyId).eq('id', u.id));

        return updated.sort((a, b) => a.position - b.position);
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate || !editingTemplate.title) return;

    const slaDays = Math.max(1, parseInt(editingTemplate.sla_days, 10) || 1);
    let desc = editingTemplate.description || '';
    // Embed fallback tag in description in case database column sla_days is pending execution
    desc = desc.replace(/\[sla:\d+\]/g, '').trim();
    const descWithTag = desc ? `${desc} [sla:${slaDays}]` : `[sla:${slaDays}]`;

    if (editingTemplate.id) {
      try {
        const { data, error } = await supabase
          .from('process_templates')
          .update({
            title: editingTemplate.title,
            description: descWithTag,
            responsible: editingTemplate.responsible,
            sla_days: slaDays
          })
          .eq('agency_id', agencyId)
          .eq('id', editingTemplate.id)
          .select('*')
          .single();

        if (error) {
          // Fallback if column sla_days doesn't exist
          const { data: fbData } = await supabase
            .from('process_templates')
            .update({
              title: editingTemplate.title,
              description: descWithTag,
              responsible: editingTemplate.responsible
            })
            .eq('agency_id', agencyId)
            .eq('id', editingTemplate.id)
            .select('*')
            .single();

          if (fbData) {
            setTemplates(templates.map(t => t.id === fbData.id ? { ...fbData, sla_days: slaDays } : t));
          }
        } else if (data) {
          setTemplates(templates.map(t => t.id === data.id ? { ...data, sla_days: slaDays } : t));
        }
      } catch (err) {
        console.error('Erro ao atualizar template:', err);
      }
    } else {
      try {
        const { data, error } = await supabase
          .from('process_templates')
          .insert([{ 
            ...editingTemplate, 
            description: descWithTag,
            sla_days: slaDays,
            agency_id: agencyId,
            position: templates.filter(t => t.process_type === editingTemplate.process_type).length 
          }])
          .select('*')
          .single();
        
        if (error) {
          const { data: fbData, error: fbErr } = await supabase
            .from('process_templates')
            .insert([{ 
              ...editingTemplate, 
              description: descWithTag,
              agency_id: agencyId,
              position: templates.filter(t => t.process_type === editingTemplate.process_type).length 
            }])
            .select('*')
            .single();

          if (fbData) {
            setTemplates([...templates, { ...fbData, sla_days: slaDays }]);
          } else if (fbErr) {
            alert("Erro ao adicionar: " + fbErr.message);
          }
        } else if (data) {
          setTemplates([...templates, { ...data, sla_days: slaDays }]);
        }
      } catch (err) {
        console.error('Erro ao criar template:', err);
      }
    }
    setEditingTemplate(null);
  };

  const deleteTemplate = async (id: string) => {
    if (!window.confirm('Excluir este template? Isso não afetará processos existentes.')) return;
    setTemplates(templates.filter(t => t.id !== id));
    await supabase.from('process_templates').delete().eq('agency_id', agencyId).eq('id', id);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-2xl font-black text-brand-dark tracking-tight">Templates de Processos</h3>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Configuração Geral</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
            <X size={24} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30 hide-scrollbar flex gap-8">
          <div className="flex-1 space-y-12">
            {loading && <div className="text-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-dark mx-auto"></div></div>}
            
            {!loading && PROCESS_TYPES.map(type => {
              const typeItems = templates.filter(t => t.process_type === type.id).sort((a,b) => a.position - b.position);
              const typeTopLevel = typeItems.filter(t => !t.parent_id);
              const Icon = type.icon;
              
              return (
                <div key={type.id}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-gray-900 border-l-4 border-brand-dark pl-3 flex items-center gap-2">
                       <Icon size={20} className="text-gray-500" /> {type.name}
                    </h4>
                    <button 
                      onClick={() => setEditingTemplate({ process_type: type.id, responsible: 'agency', sla_days: 1 })}
                      className="flex items-center gap-2 px-3 py-1.5 bg-brand-dark text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>

                  {typeTopLevel.length === 0 ? (
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center gap-2">
                       <p className="text-sm text-gray-400 italic">Nenhum template neste processo.</p>
                       <button 
                         onClick={async () => {
                           if (!window.confirm("Deseja copiar os templates padrão do sistema?")) return;
                           const { data: defaultTpls } = await supabase.from('process_templates').select('*').eq('agency_id', 1).eq('process_type', type.id).order('position');
                           if (!defaultTpls || defaultTpls.length === 0) { alert('Sem padrões para este tipo.'); return; }
                           const newTemplates = defaultTpls.map(t => ({...t, id: undefined, created_at: undefined, agency_id: agencyId}));
                           const parents = newTemplates.filter(t => !t.parent_id);
                           const { data: insertedParents } = await supabase.from('process_templates').insert(parents).select('*');
                           if (insertedParents && insertedParents.length > 0) {
                             const children = newTemplates.filter(t => t.parent_id);
                             const childrenWithNewParents = children.map(c => {
                               const parentTpl = defaultTpls.find(p => p.id === c.parent_id);
                               const newParent = insertedParents.find(p => p.title === parentTpl?.title && p.process_type === parentTpl?.process_type);
                               return { ...c, parent_id: newParent ? newParent.id : null };
                             });
                             if (childrenWithNewParents.length > 0) {
                               await supabase.from('process_templates').insert(childrenWithNewParents);
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
                      onDragEnd={(e) => handleDragEnd(e, type.id)}
                    >
                      <SortableContext items={typeTopLevel} strategy={verticalListSortingStrategy}>
                        <div className="space-y-4">
                          {typeTopLevel.map(item => {
                            const children = templates.filter(t => t.parent_id === item.id).sort((a,b) => a.position - b.position);
                            return (
                              <div key={item.id} className="space-y-2">
                                <SortableTemplateItem 
                                  item={item} 
                                  onAddChild={() => setEditingTemplate({ process_type: type.id, responsible: 'agency', parent_id: item.id, sla_days: 1 })}
                                  onEdit={() => setEditingTemplate(item)}
                                  onDelete={() => deleteTemplate(item.id)}
                                />
                                {children.length > 0 && (
                                  <div className="pl-10 space-y-2">
                                    {children.map(child => (
                                      <div key={child.id} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-xl group hover:border-gray-200 transition-all">
                                        <div className="flex-1 min-w-0 flex items-center gap-3">
                                          <p className="text-sm font-semibold text-gray-800">{child.title}</p>
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                            <Clock size={10} className="text-amber-500" />
                                            SLA: {child.sla_days || 1}d
                                          </span>
                                          <span className="text-[10px] text-gray-400 font-bold uppercase">{child.responsible}</span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => setEditingTemplate(child)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded flex-shrink-0"><Settings2 size={16} /></button>
                                          <button onClick={() => deleteTemplate(child.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded flex-shrink-0"><Trash2 size={16} /></button>
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

          {editingTemplate && (
            <div className="w-[400px] flex-shrink-0 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl h-fit sticky top-0">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-bold text-lg text-gray-900">
                  {editingTemplate.id ? 'Editar Template' : 'Novo Template'}
                </h4>
                <button onClick={() => setEditingTemplate(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Título da Etapa</label>
                  <input
                    type="text"
                    placeholder="Ex: Briefing da arte, Criar arte..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
                    value={editingTemplate.title || ''}
                    onChange={e => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">SLA / Prazo da Etapa</label>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {editingTemplate.sla_days || 1} {Number(editingTemplate.sla_days) === 1 ? 'dia útil' : 'dias úteis'}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
                      value={editingTemplate.sla_days ?? 1}
                      onChange={e => setEditingTemplate({ ...editingTemplate, sla_days: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    />
                    <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Prazo em dias úteis a contar a partir da etapa anterior ao gerar a tarefa.</p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Descrição (Opcional)</label>
                  <textarea
                    onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                    value={editingTemplate.description || ''}
                    rows={3}
                    placeholder="Instruções ou checklist para esta etapa..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Responsável</label>
                  <select
                    value={editingTemplate.responsible || 'agency'}
                    onChange={e => setEditingTemplate({ ...editingTemplate, responsible: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
                  >
                    <option value="agency">Agência</option>
                    <option value="client">Cliente</option>
                    <option value="sarah">Sarah (IA)</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button onClick={handleSaveTemplate} disabled={!editingTemplate.title} className="w-full px-4 py-4 bg-brand-dark text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:opacity-90 disabled:opacity-50 transition-all shadow-md">Salvar Template</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SortableTemplateItem: React.FC<{ item: any, onAddChild: () => void, onEdit: () => void, onDelete: () => void }> = ({ item, onAddChild, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-2xl border border-gray-100 hover:border-brand-dark/30 p-4 flex items-center gap-4 group transition-all">
      <div {...attributes} {...listeners} className="text-gray-300 hover:text-brand-dark cursor-grab active:cursor-grabbing p-1"><GripVertical size={20} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-gray-900 break-words leading-snug">{item.title}</p>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
            <Clock size={11} className="text-amber-500" />
            SLA: {item.sla_days || 1} {Number(item.sla_days) === 1 ? 'dia útil' : 'dias úteis'}
          </span>
          <span className="text-[10px] text-gray-400 font-bold uppercase px-1.5 py-0.5 bg-gray-100 rounded">{item.responsible}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onAddChild} className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50" title="Adicionar sub-etapa"><Plus size={18} /></button>
        <button onClick={onEdit} className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50" title="Editar etapa"><Settings2 size={18} /></button>
        <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Excluir etapa"><Trash2 size={18} /></button>
      </div>
    </div>
  );
};

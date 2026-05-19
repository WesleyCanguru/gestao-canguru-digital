import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { Client, QuickLinkType } from '../../types';
import { X, Plus, GripVertical, Trash2, Globe, Instagram, BarChart2, TrendingUp, Monitor } from 'lucide-react';
import { motion } from 'motion/react';
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

interface QuickLinksEditorModalProps {
  client: Client;
  onClose: () => void;
  onUpdate: () => void;
}

export interface ClientQuickLink {
  id: string;
  client_id: string;
  type: QuickLinkType;
  label: string;
  url: string;
  sort_order: number;
  created_at?: string;
}

const LINK_TYPES: { type: QuickLinkType; label: string; icon: any; color: string }[] = [
  { type: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  { type: 'meta_ads', label: 'Meta Ads', icon: Monitor, color: 'text-blue-600' },
  { type: 'google_ads', label: 'Google Ads', icon: Globe, color: 'text-green-500' },
  { type: 'reportei', label: 'Reportei', icon: BarChart2, color: 'text-blue-500' },
  { type: 'other', label: 'Outro', icon: ExternalLinkIcon, color: 'text-gray-500' },
];

function ExternalLinkIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  );
}

function SortableItem({ link, onEdit, onDelete, key }: { link: ClientQuickLink, onEdit: () => void, onDelete: () => void, key?: React.Key }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  const typeConfig = LINK_TYPES.find(t => t.type === link.type) || LINK_TYPES[4];
  const Icon = typeConfig.icon;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white border rounded-xl shadow-sm mb-2 group ${isDragging ? 'opacity-50 ring-2 ring-brand-dark' : 'border-gray-200'}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab p-1 text-gray-300 hover:text-gray-500">
        <GripVertical size={16} />
      </div>
      <div className={`p-2 rounded-lg bg-gray-50`}>
        <Icon size={16} className={typeConfig.color} />
      </div>
      <div className="flex-1 min-w-0" onClick={onEdit}>
        <p className="text-sm font-bold text-gray-900 truncate cursor-pointer">{link.label}</p>
        <p className="text-xs text-gray-500 truncate cursor-pointer">{link.url}</p>
      </div>
      <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export const QuickLinksEditorModal: React.FC<QuickLinksEditorModalProps> = ({ client, onClose, onUpdate }) => {
  const { agencyId } = useAuth();
  const [links, setLinks] = useState<ClientQuickLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formType, setFormType] = useState<QuickLinkType>('other');
  const [formLabel, setFormLabel] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [showForm, setShowForm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchLinks();
  }, [client.id]);

  const fetchLinks = async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('client_quick_links')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('client_id', client.id)
      .order('sort_order');
      
    if (data) {
      setLinks(data as any as ClientQuickLink[]);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormType('other');
    setFormLabel('');
    setFormUrl('');
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (link: ClientQuickLink) => {
    setFormType(link.type);
    setFormLabel(link.label);
    setFormUrl(link.url);
    setEditingId(link.id);
    setShowForm(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLinks((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const newArray = arrayMove(items, oldIndex, newIndex) as ClientQuickLink[];
      
      saveOrder(newArray);
      return newArray;
    });
  };

  const saveOrder = async (orderedLinks: ClientQuickLink[]) => {
    const updates = orderedLinks.map((link, index) => ({
      id: link.id,
      agency_id: agencyId,
      sort_order: index
    }));
    await supabase.from('client_quick_links').upsert(updates);
    onUpdate();
  };

  const handleSave = async (e: React.FormEvent) => {
    if (!agencyId) return;
    e.preventDefault();
    try {
      if (editingId) {
        await supabase
          .from('client_quick_links')
          .update({
            type: formType,
            label: formLabel,
            url: formUrl
          })
          .eq('agency_id', agencyId)
          .eq('id', editingId);
      } else {
        await supabase
          .from('client_quick_links')
          .insert([{
            client_id: client.id,
            agency_id: agencyId,
            type: formType,
            label: formLabel,
            url: formUrl,
            sort_order: links.length
          }]);
      }
      resetForm();
      fetchLinks();
      onUpdate();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este link?')) return;
    await supabase
      .from('client_quick_links')
      .delete()
      .eq('agency_id', agencyId)
      .eq('id', id);
    fetchLinks();
    onUpdate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Links Rápidos</h3>
            <p className="text-sm text-gray-500">{client.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          {showForm ? (
            <form onSubmit={handleSave} className="space-y-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h4 className="font-bold text-gray-900 mb-2">{editingId ? 'Editar Link' : 'Novo Link'}</h4>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tipo</label>
                <div className="grid grid-cols-5 gap-2">
                  {LINK_TYPES.map(t => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => setFormType(t.type)}
                      className={`p-2 flex justify-center items-center rounded-xl border transition-all ${formType === t.type ? 'border-brand-dark bg-brand-dark/5' : 'border-gray-200 hover:border-gray-300'}`}
                      title={t.label}
                    >
                      <t.icon size={18} className={t.color} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Rótulo</label>
                <input
                  type="text"
                  required
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-dark transition-colors"
                  placeholder="Ex: Instagram da Empresa"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">URL / Link</label>
                <input
                  type="url"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-dark transition-colors"
                  placeholder="https://..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand-dark text-white rounded-xl font-bold text-sm hover:bg-brand-dark/90 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          ) : (
            <>
              {loading ? (
                <div className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-brand-dark border-t-transparent rounded-full" /></div>
              ) : links.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Globe size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Nenhum link adicionado ainda.</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={links} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {links.map((link) => (
                        <SortableItem
                          key={link.id}
                          link={link}
                          onEdit={() => startEdit(link)}
                          onDelete={() => handleDelete(link.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              <button
                onClick={() => setShowForm(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:bg-gray-50 hover:text-brand-dark hover:border-brand-dark transition-colors"
              >
                <Plus size={18} /> Adicionar Link
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

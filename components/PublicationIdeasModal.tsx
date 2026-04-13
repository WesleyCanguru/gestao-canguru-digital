
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Calendar, Type, Trash2, Edit2, Save, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import { supabase, useAuth } from '../lib/supabase';
import { PublicationIdea } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface PublicationIdeasModalProps {
  onClose: () => void;
}

export const PublicationIdeasModal: React.FC<PublicationIdeasModalProps> = ({ onClose }) => {
  const { userRole, activeClient } = useAuth();
  const [ideas, setIdeas] = useState<PublicationIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form State
  const [theme, setTheme] = useState('');
  const [date, setDate] = useState('');
  const [format, setFormat] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchIdeas();
  }, [activeClient]);

  const fetchIdeas = async () => {
    if (!activeClient?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('publication_ideas')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setIdeas(data as PublicationIdea[]);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!theme.trim() || !activeClient?.id) return;
    setIsSaving(true);

    const payload: any = {
      client_id: activeClient.id,
      theme,
      suggested_date: date || null,
      format: format || null,
      created_by_role: userRole,
      created_by_name: userRole === 'admin' ? 'Canguru' : (activeClient?.responsible || 'Wesley'),
      updated_at: new Date().toISOString()
    };

    if (editingId) {
      const { error } = await supabase
        .from('publication_ideas')
        .update(payload)
        .eq('id', editingId);
      if (!error) {
        setEditingId(null);
        setIsAdding(false);
        fetchIdeas();
      }
    } else {
      const { error } = await supabase
        .from('publication_ideas')
        .insert({ ...payload, created_at: new Date().toISOString() });
      if (!error) {
        setIsAdding(false);
        fetchIdeas();
      }
    }

    setTheme('');
    setDate('');
    setFormat('');
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('publication_ideas').delete().eq('id', id);
      if (!error) fetchIdeas();
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const startEdit = (idea: PublicationIdea) => {
    setEditingId(idea.id);
    setTheme(idea.theme);
    setDate(idea.suggested_date || '');
    setFormat(idea.format || '');
    setIsAdding(true);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-brand-dark/40 backdrop-blur-md" 
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#fcfbf9] w-full max-w-3xl max-h-[85vh] rounded-[2.5rem] shadow-2xl relative z-10 flex flex-col overflow-hidden border border-white/20"
      >
        <div className="p-8 border-b border-black/[0.03] flex justify-between items-center bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-dark flex items-center justify-center text-white shadow-xl shadow-brand-dark/20">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="font-serif text-2xl text-brand-dark tracking-tight">Ideias de Publicação</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Sugestões e Insights</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
          {isAdding ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl border border-black/[0.05] shadow-sm mb-8 space-y-6"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-brand-dark uppercase tracking-widest flex items-center gap-2">
                  <Plus size={16} /> {editingId ? 'Editar Ideia' : 'Nova Sugestão'}
                </h3>
                <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-[10px] font-bold text-gray-400 hover:text-brand-dark uppercase tracking-widest">Cancelar</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Tema / Assunto *</label>
                  <input 
                    type="text" 
                    value={theme} 
                    onChange={e => setTheme(e.target.value)}
                    className="w-full bg-gray-50 border border-black/[0.05] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/10 transition-all"
                    placeholder="Ex: Bastidores da produção de EPIs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Data Sugerida (Opcional)</label>
                    <input 
                      type="date" 
                      value={date} 
                      onChange={e => setDate(e.target.value)}
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Formato (Opcional)</label>
                    <input 
                      type="text" 
                      value={format} 
                      onChange={e => setFormat(e.target.value)}
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/10 transition-all"
                      placeholder="Ex: Reels, Carrossel..."
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSave}
                disabled={isSaving || !theme.trim()}
                className="w-full py-4 bg-brand-dark text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-brand-dark/20 hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingId ? 'Salvar Alterações' : 'Enviar Sugestão'}
              </button>
            </motion.div>
          ) : (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full py-6 border-2 border-dashed border-black/[0.05] rounded-3xl text-gray-400 hover:text-brand-dark hover:border-brand-dark/20 hover:bg-brand-dark/[0.02] transition-all flex flex-col items-center justify-center gap-2 mb-8 group"
            >
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-brand-dark group-hover:text-white transition-all">
                <Plus size={20} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest">Adicionar nova ideia</span>
            </button>
          )}

          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-brand-dark/20" />
              </div>
            ) : ideas.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-black/[0.03]">
                <MessageSquare size={32} className="mx-auto text-gray-200 mb-4" />
                <p className="text-sm text-gray-400 font-medium">Nenhuma ideia sugerida ainda.</p>
              </div>
            ) : (
              ideas.map(idea => (
                <div key={idea.id} className="bg-white p-6 rounded-3xl border border-black/[0.03] shadow-sm hover:shadow-md transition-all group relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-dark/5 flex items-center justify-center text-brand-dark">
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-brand-dark leading-tight">{idea.theme}</h4>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                          Por {idea.created_by_name} • {new Date(idea.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    
                    {(userRole === 'admin' || (userRole === 'approver' && idea.created_by_role === 'approver')) && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(idea)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => setConfirmDeleteId(idea.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {idea.suggested_date && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 border border-black/[0.02]">
                        <Calendar size={12} /> {new Date(idea.suggested_date).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                    {idea.format && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 border border-black/[0.02]">
                        <Type size={12} /> {idea.format}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Excluir Ideia"
        message="Tem certeza que deseja excluir esta ideia?"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};

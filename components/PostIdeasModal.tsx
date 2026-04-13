import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PostIdea } from '../types';
import { X, Plus, Trash2, Edit2, Loader2, Calendar, LayoutTemplate, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmModal } from './ConfirmModal';

interface PostIdeasModalProps {
  clientId: string;
  monthName: string;
  onClose: () => void;
}

export const PostIdeasModal: React.FC<PostIdeasModalProps> = ({ clientId, monthName, onClose }) => {
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [theme, setTheme] = useState('');
  const [date, setDate] = useState('');
  const [format, setFormat] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchIdeas();
  }, [clientId, monthName]);

  const fetchIdeas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('post_ideas')
        .select('*')
        .eq('client_id', clientId)
        .eq('month', monthName)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIdeas(data || []);
    } catch (err) {
      console.error('Erro ao buscar ideias:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForm = (idea?: PostIdea) => {
    if (idea) {
      setEditingId(idea.id);
      setTheme(idea.theme);
      setDate(idea.date || '');
      setFormat(idea.format || '');
    } else {
      setEditingId(null);
      setTheme('');
      setDate('');
      setFormat('');
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setTheme('');
    setDate('');
    setFormat('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme.trim()) return;

    setIsSubmitting(true);
    try {
      const ideaData = {
        client_id: clientId,
        month: monthName,
        theme: theme.trim(),
        date: date || null,
        format: format.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('post_ideas')
          .update(ideaData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_ideas')
          .insert([ideaData]);
        if (error) throw error;
      }

      await fetchIdeas();
      handleCloseForm();
    } catch (err) {
      console.error('Erro ao salvar ideia:', err);
      alert('Erro ao salvar ideia. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('post_ideas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      setIdeas(ideas.filter(idea => idea.id !== id));
    } catch (err) {
      console.error('Erro ao excluir ideia:', err);
      alert('Erro ao excluir ideia.');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-dark/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-dark text-white flex items-center justify-center">
              <Lightbulb size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-dark">Ideias de Publicações</h2>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mt-1">{monthName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {isFormOpen ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                  Tema / Ideia (Obrigatório)
                </label>
                <textarea
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  required
                  rows={3}
                  className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl px-4 py-3 text-brand-dark focus:outline-none focus:border-brand-dark/20 focus:bg-white transition-all resize-none"
                  placeholder="Descreva sua ideia para a publicação..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Data Sugerida (Opcional)
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl pl-11 pr-4 py-3 text-brand-dark focus:outline-none focus:border-brand-dark/20 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Formato (Opcional)
                  </label>
                  <div className="relative">
                    <LayoutTemplate className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl pl-11 pr-4 py-3 text-brand-dark focus:outline-none focus:border-brand-dark/20 focus:bg-white transition-all"
                      placeholder="Ex: Reels, Carrossel, Foto..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !theme.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-brand-dark text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />}
                  Salvar Ideia
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex justify-end mb-6">
                <button
                  onClick={() => handleOpenForm()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-dark text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors shadow-lg shadow-brand-dark/20"
                >
                  <Plus size={14} /> Nova Ideia
                </button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-brand-dark/30" />
                </div>
              ) : ideas.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Lightbulb size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">Nenhuma ideia registrada para este mês.</p>
                  <p className="text-sm text-gray-400 mt-1">Clique em "Nova Ideia" para sugerir conteúdos.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ideas.map((idea) => (
                    <div key={idea.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="text-brand-dark font-medium whitespace-pre-wrap">{idea.theme}</p>
                          
                          {(idea.date || idea.format) && (
                            <div className="flex flex-wrap gap-3 mt-3">
                              {idea.date && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
                                  <Calendar size={12} />
                                  {new Date(idea.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                </div>
                              )}
                              {idea.format && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
                                  <LayoutTemplate size={12} />
                                  {idea.format}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenForm(idea)}
                            className="p-2 text-gray-400 hover:text-brand-dark hover:bg-gray-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(idea.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
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

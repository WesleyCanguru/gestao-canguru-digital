import React, { useState, useEffect } from 'react';
import { X, MessageSquarePlus, Image as ImageIcon, Send, Clock, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { supabase, useAuth } from '../lib/supabase';
import { ConfirmModal } from './ConfirmModal';

interface WebsiteFeedback {
  id: string;
  content: string;
  image_url: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  user_id: string;
}

interface WebsiteFeedbackPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WebsiteFeedbackPanel({ isOpen, onClose }: WebsiteFeedbackPanelProps) {
  const { activeClient, userRole, user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<WebsiteFeedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newFeedback, setNewFeedback] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeClient) {
      loadFeedbacks();
    }
  }, [isOpen, activeClient]);

  const loadFeedbacks = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('website_feedbacks')
        .select('*')
        .eq('client_id', activeClient?.id)
        .order('created_at', { ascending: false });

      if (error) {
        // If table doesn't exist yet, just set empty
        if (error.code === '42P01') {
          setFeedbacks([]);
        } else {
          throw error;
        }
      } else {
        setFeedbacks(data || []);
      }
    } catch (err) {
      console.error('Error loading feedbacks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedback.trim() || !activeClient || !user) return;

    try {
      setIsSubmitting(true);
      setError('');
      let imageUrl = null;

      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('website-feedbacks')
          .upload(fileName, selectedImage);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('website-feedbacks')
          .getPublicUrl(fileName);
          
        imageUrl = publicUrlData.publicUrl;
      }

      const { error: insertError } = await supabase
        .from('website_feedbacks')
        .insert([{
          client_id: activeClient.id,
          user_id: user.id,
          content: newFeedback.trim(),
          image_url: imageUrl,
          status: 'pending'
        }]);

      if (insertError) throw insertError;

      setNewFeedback('');
      setSelectedImage(null);
      loadFeedbacks();
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setError('Erro ao enviar observação. Verifique se as tabelas foram criadas no banco de dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    if (userRole !== 'admin') return;
    
    try {
      const { error } = await supabase
        .from('website_feedbacks')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      loadFeedbacks();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const deleteFeedback = async (id: string) => {
    if (userRole !== 'admin') return;
    
    try {
      const { error } = await supabase
        .from('website_feedbacks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadFeedbacks();
    } catch (err) {
      console.error('Error deleting feedback:', err);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, text: 'Concluído', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
      case 'in_progress':
        return { icon: Clock, text: 'Em andamento', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
      default:
        return { icon: AlertCircle, text: 'Pendente', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <MessageSquarePlus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-brand-dark">Observações</h2>
              <p className="text-xs text-gray-500">Solicite alterações no site</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mb-8 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <textarea
              value={newFeedback}
              onChange={(e) => setNewFeedback(e.target.value)}
              placeholder="Descreva a alteração desejada (ex: Trocar o texto da seção X para Y...)"
              className="w-full text-sm border-0 focus:ring-0 p-0 resize-none min-h-[100px] text-gray-700 placeholder:text-gray-400"
              required
            />
            
            {selectedImage && (
              <div className="relative mt-4 mb-2 inline-block">
                <img 
                  src={URL.createObjectURL(selectedImage)} 
                  alt="Preview" 
                  className="h-20 rounded-lg border border-gray-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center text-gray-500 hover:text-red-500 border border-gray-100"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
              <label className="cursor-pointer p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-indigo-600 transition-colors">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedImage(e.target.files[0]);
                    }
                  }}
                />
                <ImageIcon size={20} />
              </label>
              <button
                type="submit"
                disabled={isSubmitting || !newFeedback.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white rounded-xl text-sm font-medium hover:bg-brand-dark/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar'}
                <Send size={16} />
              </button>
            </div>
          </form>

          {/* Feedbacks List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Histórico de Solicitações</h3>
            
            {isLoading ? (
              <div className="text-center py-8 text-gray-400 text-sm">Carregando...</div>
            ) : feedbacks.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100 border-dashed">
                Nenhuma observação registrada ainda.
              </div>
            ) : (
              feedbacks.map((feedback) => {
                const status = getStatusConfig(feedback.status);
                const StatusIcon = status.icon;

                return (
                  <div key={feedback.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${status.bg} ${status.color} ${status.border}`}>
                        <StatusIcon size={12} />
                        {status.text}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(feedback.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-4">
                      {feedback.content}
                    </p>

                    {feedback.image_url && (
                      <a 
                        href={feedback.image_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block mb-4 rounded-xl overflow-hidden border border-gray-100 hover:opacity-90 transition-opacity"
                      >
                        <img src={feedback.image_url} alt="Anexo" className="w-full h-32 object-cover" />
                      </a>
                    )}

                    {userRole === 'admin' && (
                      <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-4">
                        <select
                          value={feedback.status}
                          onChange={(e) => updateStatus(feedback.id, e.target.value)}
                          className="text-xs border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="pending">Pendente</option>
                          <option value="in_progress">Em andamento</option>
                          <option value="completed">Concluído</option>
                        </select>
                        <button
                          onClick={() => setConfirmDeleteId(feedback.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Excluir Observação"
        message="Tem certeza que deseja excluir esta observação?"
        onConfirm={() => confirmDeleteId && deleteFeedback(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth, supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { Camera, Upload, Check, X, MessageSquare, Trash2, Settings, AlertCircle, Sparkles } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface AiPhoto {
  id: string;
  client_id: string;
  image_url: string;
  feedback: string | null;
  status: 'pending_approval' | 'approved' | 'changes_requested' | 'rejected' | 'interested';
  created_at: string;
  updated_at: string;
}

export const AiPhotosView: React.FC = () => {
  const { activeClient, userRole } = useAuth();
  const [photos, setPhotos] = useState<AiPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<number>(0);
  const [showSettings, setShowSettings] = useState(false);
  const [newQuota, setNewQuota] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  type TabType = 'pending_approval' | 'changes_requested' | 'approved' | 'rejected' | 'interested';
  const [activeTab, setActiveTab] = useState<TabType>('pending_approval');

  // Admin Replace States
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);
  const [agencyFeedback, setAgencyFeedback] = useState('');
  const [replacingFile, setReplacingFile] = useState<File | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  // Confirm Modals
  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState<string | null>(null);
  const [confirmDeleteFeedbackId, setConfirmDeleteFeedbackId] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (activeClient?.id) {
      fetchData();
    }
  }, [activeClient?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const { data: clientData } = await supabase
        .from('clients')
        .select('ai_photos_quota')
        .eq('id', activeClient!.id)
        .single();

      if (clientData) {
        setQuota(clientData.ai_photos_quota || 0);
        setNewQuota((clientData.ai_photos_quota || 0).toString());
      }

      // Fetch photos
      const { data: photosData } = await supabase
        .from('ai_photos')
        .select('*')
        .eq('client_id', activeClient!.id)
        .order('updated_at', { ascending: false });

      if (photosData) {
        setPhotos(photosData as AiPhoto[]);
      }
    } catch (error) {
      console.error('Error fetching AI photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!activeClient) return;
    try {
      await supabase
        .from('clients')
        .update({ ai_photos_quota: parseInt(newQuota, 10) || 0 })
        .eq('id', activeClient.id);

      setQuota(parseInt(newQuota, 10) || 0);
      setShowSettings(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erro ao salvar configurações.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeClient) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const uniqueId = Math.random().toString(36).substring(2, 15);
        const fileName = `ai-photo-${Date.now()}-${uniqueId}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post-uploads')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('post-uploads')
          .getPublicUrl(fileName);

        return {
          client_id: activeClient.id,
          image_url: data.publicUrl,
          status: 'pending_approval'
        };
      });

      const newPhotos = await Promise.all(uploadPromises);

      const { error: dbError } = await supabase
        .from('ai_photos')
        .insert(newPhotos);

      if (dbError) throw dbError;

      fetchData();
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Erro ao fazer upload das fotos. Verifique o console para mais detalhes.');
    } finally {
      setUploading(false);
      // Limpa o input para permitir selecionar os mesmos arquivos novamente se necessário
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (id: string) => {
    try {
      await supabase.from('ai_photos').delete().eq('id', id);
      fetchData();
    } catch (error) {
      console.error('Error deleting photo:', error);
    } finally {
      setConfirmDeletePhotoId(null);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    try {
      await supabase.from('ai_photos').update({ feedback: null }).eq('id', id);
      fetchData();
    } catch (error) {
      console.error('Error deleting feedback:', error);
    } finally {
      setConfirmDeleteFeedbackId(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: AiPhoto['status'], feedback?: string) => {
    try {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (feedback !== undefined) {
        updateData.feedback = feedback;
      }
      await supabase.from('ai_photos').update(updateData).eq('id', id);
      fetchData();
      setActivePhotoId(null);
      setFeedbackText('');
      setActiveTab(status); // Automatically switch to the tab of the new status
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleReplacePhoto = async (id: string, currentFeedback: string | null) => {
    if (!replacingFile) return;
    setIsReplacing(true);
    try {
      const fileExt = replacingFile.name.split('.').pop();
      const uniqueId = Math.random().toString(36).substring(2, 15);
      const fileName = `ai-photo-${Date.now()}-${uniqueId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('post-uploads')
        .upload(fileName, replacingFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('post-uploads')
        .getPublicUrl(fileName);

      const newFeedback = currentFeedback 
        ? `${currentFeedback}\n\nCanguru Digital: ${agencyFeedback}` 
        : `Canguru Digital: ${agencyFeedback}`;

      await supabase.from('ai_photos').update({
        image_url: data.publicUrl,
        feedback: newFeedback,
        status: 'pending_approval',
        updated_at: new Date().toISOString()
      }).eq('id', id);

      fetchData();
      setReplacingPhotoId(null);
      setReplacingFile(null);
      setAgencyFeedback('');
      setActiveTab('pending_approval');
    } catch (error) {
      console.error('Error replacing photo:', error);
      alert('Erro ao substituir foto.');
    } finally {
      setIsReplacing(false);
    }
  };

  const approvedCount = photos.filter(p => p.status === 'approved').length;
  const filteredPhotos = photos.filter(p => p.status === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fuchsia-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/[0.02]">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-fuchsia-50 rounded-2xl flex items-center justify-center text-fuchsia-600">
            <Camera size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Fotos com IA</h1>
            <p className="text-gray-500 font-medium mt-1">
              Aprove e comente os ensaios fotográficos gerados por Inteligência Artificial.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="bg-fuchsia-50 px-4 py-2 rounded-xl border border-fuchsia-100 flex flex-col items-end">
            <span className="text-xs font-bold text-fuchsia-600 uppercase tracking-wider">Cota de Fotos</span>
            <span className="text-2xl font-black text-brand-dark">
              {approvedCount} <span className="text-gray-400 text-lg font-medium">/ {quota || '?'}</span>
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-xs font-bold text-gray-400 hover:text-brand-dark uppercase tracking-widest flex items-center gap-1 transition-colors"
            >
              <Settings size={12} /> Configurar
            </button>
          )}
        </div>
      </div>

      {isAdmin && showSettings && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-black/[0.02] flex flex-col md:flex-row gap-4 items-end"
        >
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Quantidade de Fotos Contratadas</label>
            <input
              type="number"
              value={newQuota}
              onChange={(e) => setNewQuota(e.target.value)}
              placeholder="Ex: 12"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500 font-medium"
            />
          </div>
          <button
            onClick={handleSaveSettings}
            className="w-full md:w-auto px-8 py-3 bg-brand-dark text-white rounded-xl font-bold hover:bg-black transition-colors"
          >
            Salvar Configuração
          </button>
        </motion.div>
      )}

      {!isAdmin && quota > 0 && approvedCount >= quota && (
        <div className="bg-purple-50 border border-purple-100 p-4 rounded-2xl flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-purple-900">Cota Atingida</h4>
            <p className="text-sm text-purple-700 mt-1">
              Você já selecionou as {quota} fotos do seu pacote. Você ainda pode marcar outras fotos com "Tenho Interesse" caso queira adquiri-las separadamente.
            </p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-black/[0.02] flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-brand-dark">Adicionar Nova Foto</h3>
            <p className="text-sm text-gray-500">Faça o upload de uma imagem gerada por IA para a aprovação do cliente.</p>
          </div>
          <label className={`
            px-8 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer
            ${uploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'}
          `}>
            <Upload size={18} />
            {uploading ? 'Enviando...' : 'Selecionar Imagens'}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
        <button 
          onClick={() => setActiveTab('pending_approval')} 
          className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'pending_approval' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
        >
          Pendentes ({photos.filter(p => p.status === 'pending_approval').length})
        </button>
        <button 
          onClick={() => setActiveTab('changes_requested')} 
          className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'changes_requested' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-amber-600 hover:bg-amber-50 border border-amber-200'}`}
        >
          Ajustes Solicitados ({photos.filter(p => p.status === 'changes_requested').length})
        </button>
        <button 
          onClick={() => setActiveTab('approved')} 
          className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'approved' ? 'bg-green-500 text-white shadow-md' : 'bg-white text-green-600 hover:bg-green-50 border border-green-200'}`}
        >
          Aprovadas ({photos.filter(p => p.status === 'approved').length})
        </button>
        <button 
          onClick={() => setActiveTab('rejected')} 
          className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'rejected' ? 'bg-red-500 text-white shadow-md' : 'bg-white text-red-600 hover:bg-red-50 border border-red-200'}`}
        >
          Rejeitadas ({photos.filter(p => p.status === 'rejected').length})
        </button>
        <button 
          onClick={() => setActiveTab('interested')} 
          className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'interested' ? 'bg-purple-500 text-white shadow-md' : 'bg-white text-purple-600 hover:bg-purple-50 border border-purple-200'}`}
        >
          Interesse ({photos.filter(p => p.status === 'interested').length})
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPhotos.map((photo) => (
          <motion.div
            key={photo.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-black/[0.02] flex flex-col"
          >
            <div className="relative bg-gray-100 flex items-center justify-center">
              <img src={photo.image_url} alt="AI Generated" className="w-full h-auto max-h-[600px] object-contain" />
              
              {/* Status Badge */}
              <div className="absolute top-4 left-4">
                {photo.status === 'approved' && (
                  <span className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg flex items-center gap-1">
                    <Check size={14} /> Aprovada
                  </span>
                )}
                {photo.status === 'interested' && (
                  <span className="px-3 py-1.5 bg-purple-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg flex items-center gap-1">
                    <Sparkles size={14} /> Tenho Interesse
                  </span>
                )}
                {photo.status === 'rejected' && (
                  <span className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg flex items-center gap-1">
                    <X size={14} /> Rejeitada
                  </span>
                )}
                {photo.status === 'changes_requested' && (
                  <span className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg flex items-center gap-1">
                    <AlertCircle size={14} /> Ajustes
                  </span>
                )}
                {photo.status === 'pending_approval' && (
                  <span className="px-3 py-1.5 bg-gray-900/80 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
                    Pendente
                  </span>
                )}
              </div>

              {isAdmin && (
                <button
                  onClick={() => setConfirmDeletePhotoId(photo.id)}
                  className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm text-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="p-6 flex-1 flex flex-col">
              {photo.feedback && (() => {
                const agencyPrefix = 'Canguru Digital:';
                const hasAgency = photo.feedback.includes(agencyPrefix);
                
                let clientFeedback = photo.feedback;
                let agencyFeedback = '';

                if (hasAgency) {
                  const parts = photo.feedback.split(agencyPrefix);
                  clientFeedback = parts[0].trim();
                  agencyFeedback = parts.slice(1).join(agencyPrefix).trim();
                }

                return (
                  <div className="mb-6 space-y-3">
                    {clientFeedback && (
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 relative group">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Feedback do Cliente</p>
                          <div className="flex items-center gap-3">
                            {photo.updated_at && !agencyFeedback && (
                              <span className="text-[10px] font-medium text-gray-400">
                                {new Date(photo.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => setConfirmDeleteFeedbackId(photo.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                title="Excluir comentário"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 font-medium whitespace-pre-wrap">{clientFeedback}</p>
                      </div>
                    )}

                    {agencyFeedback && (
                      <div className="bg-brand-dark/5 p-4 rounded-xl border border-brand-dark/10 relative group">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-brand-dark uppercase tracking-wider">Canguru Digital</p>
                          <div className="flex items-center gap-3">
                            {photo.updated_at && (
                              <span className="text-[10px] font-medium text-brand-dark/60">
                                {new Date(photo.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {isAdmin && !clientFeedback && (
                              <button
                                onClick={() => handleDeleteFeedback(photo.id)}
                                className="text-brand-dark/40 hover:text-red-500 transition-colors"
                                title="Excluir comentário"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-brand-dark font-medium whitespace-pre-wrap">{agencyFeedback}</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {isAdmin && photo.status === 'changes_requested' && !replacingPhotoId && (
                <button
                  onClick={() => setReplacingPhotoId(photo.id)}
                  className="w-full py-2.5 bg-fuchsia-50 text-fuchsia-600 rounded-xl text-sm font-bold hover:bg-fuchsia-100 transition-colors mb-4 border border-fuchsia-200"
                >
                  Substituir Imagem
                </button>
              )}

              {isAdmin && replacingPhotoId === photo.id && (
                <div className="mb-4 space-y-3 bg-white p-4 rounded-xl border border-fuchsia-200 shadow-sm">
                  <p className="text-xs font-bold text-fuchsia-600 uppercase tracking-wider">Substituir Imagem</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => setReplacingFile(e.target.files?.[0] || null)} 
                    className="text-sm w-full text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-fuchsia-50 file:text-fuchsia-700 hover:file:bg-fuchsia-100" 
                  />
                  <textarea
                    value={agencyFeedback}
                    onChange={(e) => setAgencyFeedback(e.target.value)}
                    placeholder="Mensagem da agência (ex: Ajustes feitos!)..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none h-20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReplacePhoto(photo.id, photo.feedback)}
                      disabled={!replacingFile || isReplacing}
                      className="flex-1 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-bold hover:bg-fuchsia-700 transition-colors disabled:opacity-50"
                    >
                      {isReplacing ? 'Enviando...' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => { setReplacingPhotoId(null); setReplacingFile(null); setAgencyFeedback(''); }}
                      className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {!isAdmin && (
                <div className="mt-auto flex flex-col gap-2">
                  {activePhotoId === photo.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="O que precisa ser ajustado?"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none h-24"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(photo.id, 'changes_requested', feedbackText)}
                          disabled={!feedbackText.trim()}
                          className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
                        >
                          Enviar
                        </button>
                        <button
                          onClick={() => { setActivePhotoId(null); setFeedbackText(''); }}
                          className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {quota > 0 && approvedCount >= quota && photo.status !== 'approved' ? (
                        <button
                          onClick={() => handleUpdateStatus(photo.id, 'interested')}
                          className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all ${photo.status === 'interested' ? 'bg-purple-50 text-purple-600 border border-purple-200' : 'bg-gray-50 text-gray-500 hover:bg-purple-50 hover:text-purple-600'}`}
                        >
                          <Sparkles size={18} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Interesse</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(photo.id, 'approved')}
                          className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all ${photo.status === 'approved' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-gray-50 text-gray-500 hover:bg-green-50 hover:text-green-600'}`}
                        >
                          <Check size={18} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Aprovar</span>
                        </button>
                      )}
                      <button
                        onClick={() => setActivePhotoId(photo.id)}
                        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all ${photo.status === 'changes_requested' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-gray-50 text-gray-500 hover:bg-amber-50 hover:text-amber-600'}`}
                      >
                        <MessageSquare size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Ajustar</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(photo.id, 'rejected')}
                        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all ${photo.status === 'rejected' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600'}`}
                      >
                        <X size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Rejeitar</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {filteredPhotos.length === 0 && !loading && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
              <Camera size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhuma foto nesta categoria</h3>
            <p className="text-gray-500 max-w-md">
              Não há imagens com o status "{activeTab === 'pending_approval' ? 'Pendente' : activeTab === 'changes_requested' ? 'Ajustes Solicitados' : activeTab === 'approved' ? 'Aprovadas' : activeTab === 'rejected' ? 'Rejeitadas' : 'Interesse'}" no momento.
            </p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirmDeletePhotoId}
        title="Excluir Foto"
        message="Tem certeza que deseja excluir esta foto?"
        onConfirm={() => confirmDeletePhotoId && handleDeletePhoto(confirmDeletePhotoId)}
        onCancel={() => setConfirmDeletePhotoId(null)}
      />

      <ConfirmModal
        isOpen={!!confirmDeleteFeedbackId}
        title="Excluir Comentário"
        message="Tem certeza que deseja excluir este comentário?"
        onConfirm={() => confirmDeleteFeedbackId && handleDeleteFeedback(confirmDeleteFeedbackId)}
        onCancel={() => setConfirmDeleteFeedbackId(null)}
      />
    </div>
  );
};

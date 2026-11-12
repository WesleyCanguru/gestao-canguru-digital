import React, { useState } from 'react';
import { useScripts, Script } from '../../hooks/useScripts';
import { ScriptEditor } from './ScriptEditor';
import { 
  Plus, FileText, CheckCircle2, ChevronDown, ChevronUp, Trash2, 
  Search, Link, Clock, User, Eye, ArrowRight, Play, ExternalLink
} from 'lucide-react';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'motion/react';
import { useT } from '../../lib/i18n';

interface RoteirosSectionProps {
  clientId: string;
  clientName: string;
}

export const RoteirosSection: React.FC<RoteirosSectionProps> = ({ clientId, clientName }) => {
  const { t } = useT();
  const { scripts, loading, createScript, updateScript, deleteScript } = useScripts(clientId);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [isRecordedExpanded, setIsRecordedExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const activeScripts = scripts.filter(s => s.status === 'active');
  const recordedScripts = scripts.filter(s => s.status === 'recorded');

  const filteredActive = activeScripts.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredRecorded = recordedScripts.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim() === '') return;
    
    const created = await createScript(newTitle.trim());
    if (created) {
      setSelectedScript(created);
      setIsCreating(false);
      setNewTitle('');
    }
  };

  const handleDelete = async (scriptId: string) => {
    if (window.confirm("Tem certeza que deseja excluir este roteiro? Esta ação não pode ser desfeita.")) {
      await deleteScript(scriptId);
      if (selectedScript?.id === scriptId) {
        setSelectedScript(null);
      }
    }
  };

  // Se houver um roteiro selecionado, abre o Editor integrado
  if (selectedScript) {
    // Busca novamente o script atualizado na lista mais recente de scripts
    const currentScript = scripts.find(s => s.id === selectedScript.id) || selectedScript;
    return (
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[550px]">
        <ScriptEditor
          script={currentScript}
          onUpdate={updateScript}
          onBack={() => setSelectedScript(null)}
          clientName={clientName}
          isPublicView={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-black text-brand-dark tracking-tight">{t('Roteiros e Scripts')}</h2>
          <p className="text-xs text-gray-400 font-extrabold uppercase tracking-wider mt-1">Colaboração em tempo real com {clientName}</p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-5 py-3 bg-brand-dark hover:bg-brand-dark/95 text-white rounded-2xl text-xs font-extrabold uppercase tracking-widest transition-all shadow-md active:scale-95"
        >
          <Plus size={16} />
          {t('Novo Roteiro')}
        </button>
      </div>

      {/* Modal / Inline form for creating script */}
      <AnimatePresence>
        {isCreating && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-brand-dark/5 border border-brand-dark/15 rounded-3xl p-6"
          >
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <h3 className="font-extrabold text-brand-dark text-sm uppercase tracking-widest">{t('Criar Novo Roteiro')}</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder={t('Digite o título do roteiro (ex: Relação com clientes - Reels)')}
                  className="flex-1 px-4 py-3 bg-white border border-gray-200 outline-none rounded-2xl text-sm font-semibold text-brand-dark focus:border-brand-dark/30 focus:ring-2 focus:ring-brand-dark/5"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  required
                />
                <div className="flex gap-2 shrink-0">
                  <button
                    type="submit"
                    className="flex-grow sm:flex-grow-0 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all"
                  >
                    {t('Confirmar e Abrir')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsCreating(false); setNewTitle(''); }}
                    className="flex-grow sm:flex-grow-0 px-6 py-3 bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-widest rounded-2xl transition-all"
                  >
                    {t('Cancelar')}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Input */}
      {scripts.length > 0 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={t('Buscar por título do roteiro...')}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl outline-none text-sm font-semibold text-brand-dark shadow-sm focus:border-brand-dark/20 focus:ring-2 focus:ring-brand-dark/5 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-dark"></div>
        </div>
      ) : scripts.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-[2.5rem]">
          <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400 shadow-sm">
            <FileText size={22} className="opacity-80" />
          </div>
          <p className="text-sm font-bold text-gray-800">{t('Nenhum roteiro cadastrado.')}</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto mb-5 leading-relaxed">
            {t('Comece a planejar os vídeos, reels ou de roteiros com o cliente de forma ultra colaborativa.')}
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-dark hover:bg-brand-dark/95 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:scale-105 active:scale-95"
          >
            <Plus size={14} />
            {t('Criar Primeiro Roteiro')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Scripts List */}
          <div>
            <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Play size={10} className="text-green-500 fill-green-500" />
              Roteiros Ativos ({activeScripts.length})
            </h3>
            
            {filteredActive.length === 0 ? (
              <div className="bg-white rounded-[2rem] border border-gray-100 p-8 text-center text-sm font-medium text-gray-400 shadow-sm">
                {t('Nenhum roteiro ativo no momento.')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredActive.map(script => (
                  <motion.div
                    key={script.id}
                    layoutId={script.id}
                    className="group bg-white rounded-3xl p-5 border border-gray-100 hover:border-brand-dark/10 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full bg-green-50 text-green-600 border border-green-100">
                          {t('Ativo')}
                        </span>
                        
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <button
                            onClick={() => setSelectedScript(script)}
                            className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-brand-dark rounded-lg transition-all"
                            title={t('Editar Roteiro')}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(script.id)}
                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all"
                            title={t('Deletar Roteiro')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <h4 
                        onClick={() => setSelectedScript(script)} 
                        className="font-bold text-gray-900 text-lg tracking-tight group-hover:text-brand-dark transition-colors cursor-pointer"
                      >
                        {script.title}
                      </h4>
                    </div>

                    <div className="border-t border-gray-50/50 pt-3 mt-4 flex items-center justify-between text-[10px] text-gray-400 font-semibold gap-2">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="opacity-60" />
                        Criado {dayjs(script.created_at).format('DD/MM/YYYY')}
                      </span>

                      <button
                        onClick={() => setSelectedScript(script)}
                        className="flex items-center gap-1 font-bold text-brand-dark text-[10px] uppercase tracking-wider opacity-90 hover:opacity-100 group-hover:translate-x-1 transition-all duration-300"
                      >
                        {t('Escrever')}
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Recorded Scripts Collapsible Section */}
          {recordedScripts.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={() => setIsRecordedExpanded(!isRecordedExpanded)}
                className="flex items-center gap-2 text-[10px] font-extrabold text-gray-500 hover:text-brand-dark uppercase tracking-widest transition-colors mx-auto py-2 px-4 rounded-xl hover:bg-gray-50"
              >
                <span>
                  {isRecordedExpanded
                    ? `Ocultar ${recordedScripts.length} Roteiros Gravados ▴`
                    : `Ver ${recordedScripts.length} Roteiros Gravados ▾`
                  }
                </span>
              </button>

              <AnimatePresence>
                {isRecordedExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4 mt-4"
                  >
                    {filteredRecorded.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs font-semibold">
                        {t('Nenhum roteiro gravado encontrado no filtro de busca.')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75 hover:opacity-95 transition-all">
                        {filteredRecorded.map(script => (
                          <div
                            key={script.id}
                            className="group bg-gray-50/40 rounded-3xl p-5 border border-gray-100 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full bg-gray-100 text-gray-400 border border-gray-200">
                                  Gravado {script.recorded_at ? `em ${dayjs(script.recorded_at).format('DD/MM')}` : ''}
                                </span>

                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                  <button
                                    onClick={() => setSelectedScript(script)}
                                    className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-brand-dark rounded-lg transition-all"
                                    title={t('Visualizar')}
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(script.id)}
                                    className="p-1.5 hover:bg-red-100 text-yellow-600 hover:text-red-500 rounded-lg transition-all"
                                    title={t('Deletar Roteiro')}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>

                              <h4 className="font-bold text-gray-500 text-base tracking-tight leading-snug line-through">
                                {script.title}
                              </h4>
                            </div>

                            <div className="border-t border-gray-100 pt-3 mt-4 flex items-center justify-between text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                              <span className="flex items-center gap-1 font-semibold normal-case tracking-normal">
                                <User size={11} />
                                Marcado por {script.recorded_by === 'client' ? t('Cliente') : t('Agência')}
                              </span>

                              <button
                                onClick={() => setSelectedScript(script)}
                                className="flex items-center gap-1 font-extrabold text-brand-dark hover:opacity-95 text-[9px]"
                              >
                                {t('Ver Roteiro')}
                                <ExternalLink size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

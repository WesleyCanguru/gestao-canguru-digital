import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, MessageSquare, XCircle, Search, Calendar, ChevronRight, LayoutList, Target, AlertCircle, Save, Send } from 'lucide-react';
import { Logo } from './Logo';

export const ThemeApprovalPublic: React.FC<{ sessionToken: string }> = ({ sessionToken }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [themes, setThemes] = useState<any[]>([]);
  const [userName, setUserName] = useState('');
  const [nameEntered, setNameEntered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [showRejected, setShowRejected] = useState(false);

  const displayToast = (message: string, type: 'success'|'error' = 'success') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchSession();
  }, [sessionToken]);

  const fetchSession = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('theme_sessions')
        .select(`*, clients (name, logo_url)`)
        .eq('session_token', sessionToken)
        .single();
        
      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error('Sessão não encontrada');

      setSession(sessionData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('theme_items')
        .select('*')
        .eq('session_id', sessionData.id)
        .order('position', { ascending: true });

      if (itemsError) throw itemsError;

      // Initialize local state for edits
      setThemes(itemsData.map(item => ({
        ...item,
        temp_status: item.approval_status,
        temp_comment: item.client_comment || ''
      })));

      if (sessionData.status === 'reviewed') {
          // If already reviewed, just show finished state or read-only
          // Could allow further edits, but let's assume it's read-only for now, except maybe if admin changes status
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao carregar a sessão.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateThemeStatus = (id: string, newStatus: string) => {
    if (newStatus === 'revision') setShowRevisions(true);
    if (newStatus === 'rejected') setShowRejected(true);
    handleUpdateTheme(id, { temp_status: newStatus, temp_comment: newStatus === 'approved' ? '' : themes.find(t => t.id === id)?.temp_comment });
  };

  const handleUpdateTheme = (id: string, updates: any) => {
    setThemes(themes.map(t => t.id === id ? { ...t, ...updates } : t));
  };


  const saveProgress = async (finish = false, showNotification = true) => {
    if (!userName.trim()) {
      displayToast("Por favor, preencha o seu nome.", 'error');
      return;
    }

    setSaving(true);
    try {
      // For each theme, save status and comment to database
      for (const theme of themes) {
        // Only append name if there's a comment and it doesn't already have the name
        let finalComment = theme.temp_comment?.trim();
        if (finalComment && !finalComment.startsWith(`[${userName}]`)) {
           finalComment = `[${userName}] ${finalComment}`;
        }
        
        await supabase
          .from('theme_items')
          .update({
            approval_status: theme.temp_status,
            client_comment: finalComment || null,
            reviewed_at: finish ? new Date().toISOString() : theme.reviewed_at
          })
          .eq('id', theme.id);
      }

      if (finish) {
        await supabase
          .from('theme_sessions')
          .update({ status: 'reviewed' })
          .eq('id', session.id);
        setFinished(true);
      } else {
        if (showNotification) displayToast("Progresso salvo com sucesso!");
        fetchSession(); // reload data
      }
    } catch (err) {
      console.error(err);
      displayToast("Erro ao salvar.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const allAnswered = themes.length > 0 && themes.every(t => 
      t.temp_status === 'approved' || 
      ((t.temp_status === 'rejected' || t.temp_status === 'revision') && t.temp_comment?.length > 0)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD]">
        <Loader2 size={32} className="text-brand-dark animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFDFD] p-6 text-center">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Ops! Algum problema ocorreu.</h2>
        <p className="text-gray-500">{error || 'Link inválido ou expirado.'}</p>
      </div>
    );
  }

  if (session.status === 'reviewed' || finished) {
      const approvedCount = themes.filter(t => t.temp_status === 'approved' || t.temp_status === 'transferred').length;
      const revisionCount = themes.filter(t => t.temp_status === 'revision').length;
      const rejectedCount = themes.filter(t => t.temp_status === 'rejected').length;

      return (
        <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-dark/5 rounded-full blur-[100px] pointer-events-none"></div>
            
            <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-100/50">
                    <CheckCircle2 size={40} className="text-green-600" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tighter mb-4">Aprovação Concluída</h1>
                <p className="text-lg text-gray-500 font-medium mb-12">Obrigado! A equipe já foi notificada das suas respostas para a sessão <strong className="text-brand-dark">{session.title}</strong>.</p>
                
                <div className="grid grid-cols-3 gap-4 w-full">
                    <div className="bg-white rounded-3xl p-6 border border-black/[0.05] shadow-lg shadow-black/[0.02]">
                        <div className="text-green-600 mb-2"><CheckCircle2 size={24} className="mx-auto" /></div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">{approvedCount}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">Aprovados</div>
                    </div>
                    <div className="bg-white rounded-3xl p-6 border border-black/[0.05] shadow-lg shadow-black/[0.02]">
                        <div className="text-amber-500 mb-2"><MessageSquare size={24} className="mx-auto" /></div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">{revisionCount}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">Alterações</div>
                    </div>
                    <div className="bg-white rounded-3xl p-6 border border-black/[0.05] shadow-lg shadow-black/[0.02]">
                        <div className="text-red-500 mb-2"><XCircle size={24} className="mx-auto" /></div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">{rejectedCount}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">Reprovados</div>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  if (!nameEntered) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-6 bg-texture">
          <div className="max-w-md w-full bg-white rounded-[2rem] p-8 shadow-2xl border border-black/[0.02] shadow-black/[0.05]">
              <div className="flex justify-center mb-10">
                  {session.clients?.logo_url ? (
                      <img src={session.clients.logo_url} alt={session.clients?.name} className="h-16 object-contain" />
                  ) : <Logo size="medium" />}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center tracking-tight">Quem está avaliando?</h2>
              <p className="text-gray-500 text-center mb-8 text-sm font-medium">Precisamos do seu nome para identificar os comentários e aprovações no sistema.</p>
              
              <input 
                 type="text"
                 autoFocus
                 value={userName}
                 onChange={e => setUserName(e.target.value)}
                 className="w-full h-14 bg-gray-50 border-transparent rounded-2xl px-5 font-medium text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-dark focus:ring-4 focus:ring-brand-dark/10 transition-all text-lg mb-6"
                 placeholder="Seu nome completo"
                 onKeyDown={(e) => {
                     if (e.key === 'Enter' && userName.trim()) setNameEntered(true);
                 }}
              />
              
              <button 
                 disabled={!userName.trim()}
                 onClick={() => setNameEntered(true)}
                 className="w-full h-14 bg-brand-dark text-white rounded-2xl font-bold uppercase tracking-widest text-[11px] hover:bg-black transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3"
              >
                 <span>Acessar Temas</span>
                 <ChevronRight size={16} />
              </button>
          </div>
      </div>
    );
  }

  const pendingAndApproved = themes.filter(t => t.temp_status === 'pending' || t.temp_status === 'approved' || !t.temp_status);
  const revisions = themes.filter(t => t.temp_status === 'revision');
  const rejected = themes.filter(t => t.temp_status === 'rejected');

  const renderTheme = (theme: any) => {
      const index = themes.findIndex(t => t.id === theme.id);
      const isApproved = theme.temp_status === 'approved';
      const isRevision = theme.temp_status === 'revision';
      const isRejected = theme.temp_status === 'rejected';

      return (
          <motion.div 
            key={theme.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${
                isApproved ? 'border-green-200 shadow-xl shadow-green-100/20' :
                isRevision ? 'border-amber-200 shadow-xl shadow-amber-100/20' :
                isRejected ? 'border-red-200 shadow-xl shadow-red-100/20' :
                'border-black/[0.05] shadow-xl shadow-black/[0.02] hover:border-black/[0.1]'
            }`}
          >
              <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-3 mb-6">
                      <div className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5">
                          <Target size={12} /> Tema {index + 1}
                      </div>
                      <div className="px-3 py-1 bg-brand-dark/5 text-brand-dark text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5">
                          <LayoutList size={12} /> {theme.format || 'Post'}
                      </div>
                  </div>
                  
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 tracking-tight leading-tight">{theme.title}</h3>
                  {theme.description && (
                      <p className="text-gray-500 font-medium leading-relaxed whitespace-pre-wrap text-sm sm:text-base">{theme.description}</p>
                  )}

                  {theme.reference_links && theme.reference_links.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Links de Referência</p>
                          <div className="flex flex-col gap-2">
                              {theme.reference_links.map((link: string, i: number) => (
                                  <a key={i} href={link} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-dark hover:underline truncate">
                                      {link}
                                  </a>
                              ))}
                          </div>
                      </div>
                  )}
              </div>

              {/* Approval Action Bar */}
              <div className={`p-4 sm:p-6 border-t ${
                  isApproved ? 'bg-green-50/50 border-green-100/50' :
                  isRevision ? 'bg-amber-50/50 border-amber-100/50' :
                  isRejected ? 'bg-red-50/50 border-red-100/50' :
                  'bg-gray-50 border-black/[0.02]'
              }`}>
                  <div className="flex flex-wrap gap-2">
                      <button
                         onClick={() => handleUpdateThemeStatus(theme.id, 'approved')}
                         className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all ${
                             isApproved ? 'bg-green-600 text-white shadow-lg shadow-green-600/30 ring-2 ring-green-600 ring-offset-2' : 'bg-white text-gray-500 hover:text-green-600 hover:bg-green-50 border border-gray-200'
                         }`}
                      >
                          <CheckCircle2 size={16} /> Aprovar
                      </button>
                      <button
                         onClick={() => handleUpdateThemeStatus(theme.id, 'revision')}
                         className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all ${
                             isRevision ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 ring-2 ring-amber-500 ring-offset-2' : 'bg-white text-gray-500 hover:text-amber-500 hover:bg-amber-50 border border-gray-200'
                         }`}
                      >
                          <MessageSquare size={16} /> Alteração
                      </button>
                      <button
                         onClick={() => handleUpdateThemeStatus(theme.id, 'rejected')}
                         className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all ${
                             isRejected ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 ring-2 ring-red-500 ring-offset-2' : 'bg-white text-gray-500 hover:text-red-500 hover:bg-red-50 border border-gray-200'
                         }`}
                      >
                          <XCircle size={16} /> Reprovar
                      </button>
                  </div>

                  {/* Comment Field (Required for Revision/Rejected) */}
                  <AnimatePresence>
                      {(isRevision || isRejected) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                            className="overflow-hidden"
                          >
                              <div className="relative">
                                  <textarea
                                      placeholder={isRevision ? "O que precisamos alterar neste tema?" : "Por que este tema não é adequado?"}
                                      value={theme.temp_comment || ''}
                                      onChange={(e) => handleUpdateTheme(theme.id, { temp_comment: e.target.value })}
                                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-brand-dark focus:ring-4 focus:ring-brand-dark/10 transition-all resize-none min-h-[100px] mb-2"
                                  />
                                  <div className="flex items-center justify-between">
                                      {!theme.temp_comment?.trim() ? (
                                          <p className="text-red-500 text-xs font-bold flex items-center gap-1"><AlertCircle size={12}/> Justificativa obrigatória.</p>
                                      ) : (
                                          <p className="text-gray-400 text-xs font-bold flex items-center gap-1"></p>
                                      )}
                                      <button
                                          onClick={() => saveProgress(false, true)}
                                          disabled={!theme.temp_comment?.trim() || saving}
                                          className="px-4 py-2 bg-brand-dark hover:bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
                                      >
                                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                          Salvar Comentário
                                      </button>
                                  </div>
                              </div>
                          </motion.div>
                      )}
                  </AnimatePresence>
              </div>
          </motion.div>
      );
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] bg-texture pb-32">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-black/[0.02] sticky top-0 z-50">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 h-20 sm:h-24 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  {session.clients?.logo_url ? (
                      <img src={session.clients.logo_url} alt={session.clients?.name} className="h-8 max-w-[120px] object-contain" />
                  ) : <Logo size="small" />}
                  <div className="h-4 w-px bg-gray-200"></div>
                  <div>
                    <div className="text-[9px] font-bold text-brand-dark uppercase tracking-widest mb-0.5">Aprovação de Temas</div>
                    <div className="text-sm font-semibold text-gray-900 truncate max-w-[150px] sm:max-w-xs">{session.title}</div>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                   <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden sm:block mr-2">Olá, {userName}</div>
                   <button 
                     onClick={() => saveProgress(false)} 
                     disabled={saving}
                     className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold uppercase tracking-widest text-[9px] sm:text-[10px] hover:bg-gray-200 hover:text-gray-900 transition-all flex items-center gap-2 border border-black/[0.05]"
                   >
                       {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                       <span className="hidden sm:inline">Salvar Progresso</span>
                   </button>
               </div>
            </div>
            {/* Progress Bar */}
            <div className="h-1 bg-gray-50 flex w-full">
                <div 
                  className="h-full bg-brand-dark transition-all duration-500 ease-out" 
                  style={{ width: `${(themes.filter(t => t.temp_status !== 'pending').length / themes.length) * 100}%` }}
                ></div>
            </div>
        </header>

        {/* List of Themes */}
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
            {pendingAndApproved.map(theme => renderTheme(theme))}

            {revisions.length > 0 && (
                <div className="mt-10 pt-6 border-t border-gray-100">
                    <button 
                        onClick={() => setShowRevisions(!showRevisions)}
                        className="w-full bg-amber-50/50 hover:bg-amber-50 border border-amber-200/60 rounded-2xl p-5 flex items-center justify-between text-amber-800 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100/50 rounded-xl flex items-center justify-center text-amber-600">
                                <MessageSquare size={20} />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-sm">Temas com Alteração</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{revisions.length} {revisions.length === 1 ? 'tema' : 'temas'}</p>
                            </div>
                        </div>
                        <ChevronRight className={`transform transition-transform ${showRevisions ? 'rotate-90' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {showRevisions && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-6 space-y-8">
                                    {revisions.map(theme => renderTheme(theme))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {rejected.length > 0 && (
                <div className="mt-10 pt-6 border-t border-gray-100">
                    <button 
                        onClick={() => setShowRejected(!showRejected)}
                        className="w-full bg-red-50/50 hover:bg-red-50 border border-red-200/60 rounded-2xl p-5 flex items-center justify-between text-red-800 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100/50 rounded-xl flex items-center justify-center text-red-600">
                                <XCircle size={20} />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-sm">Temas Reprovados</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{rejected.length} {rejected.length === 1 ? 'tema' : 'temas'}</p>
                            </div>
                        </div>
                        <ChevronRight className={`transform transition-transform ${showRejected ? 'rotate-90' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {showRejected && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-6 space-y-8">
                                    {rejected.map(theme => renderTheme(theme))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </main>

        {/* Footer actions */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-black/[0.05] z-50 transform translate-y-0">
            <div className="max-w-3xl mx-auto flex sm:flex-row flex-col items-center justify-between gap-4">
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                   <CheckCircle2 size={16} className={allAnswered ? 'text-green-500' : 'text-gray-300'} /> 
                   {themes.filter(t => t.temp_status !== 'pending').length} de {themes.length} Respondidos
                </div>
                <button
                   disabled={!allAnswered || saving}
                   onClick={() => saveProgress(true)}
                   className="w-full sm:w-auto px-8 py-4 bg-brand-dark text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-brand-dark/30 hover:bg-black hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-3"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    <span>Enviar Respostas Finais</span>
                </button>
            </div>
        </div>
        {/* Toast */}
        <AnimatePresence>
            {toast && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className={`fixed bottom-[130px] left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
                        toast.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'
                    }`}
                >
                    {toast.type === 'success' ? <CheckCircle2 size={24} className="text-green-600"/> : <AlertCircle size={24} className="text-red-600"/>}
                    <span className="font-semibold text-sm">{toast.message}</span>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};

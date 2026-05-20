import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash, Link2, Copy, Save, AlertCircle, Sparkles, X, ChevronDown, ChevronRight, MessageSquare, Target, CheckCircle2, XCircle, LayoutList, GripVertical, Edit2 } from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';

interface ThemeBankProps {
  onTransferTheme: (theme: any) => void;
}

export const ThemeBankAdmin: React.FC<ThemeBankProps> = ({ onTransferTheme }) => {
  const { activeClient, agencyId } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionTitle, setEditSessionTitle] = useState('');

  
  // Theme creation inside a session
  const [newItemModel, setNewItemModel] = useState<{session_id: string, title: string, description: string, format: string, reference_links: string}>({ session_id: '', title: '', description: '', format: 'Post Estático', reference_links: '' });
  const [loadingItemSession, setLoadingItemSession] = useState<string | null>(null);

  // Theme editing inside a session
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemModel, setEditItemModel] = useState<{title: string, description: string, format: string, reference_links: string}>({ title: '', description: '', format: 'Post Estático', reference_links: '' });

  // Multi-select
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Confirm Modals
  const [confirmSessionId, setConfirmSessionId] = useState<string | null>(null);
  const [confirmThemeId, setConfirmThemeId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    if (activeClient) fetchSessions();
  }, [activeClient]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('theme_sessions')
        .select(`
          *,
          theme_items (*)
        `)
        .eq('agency_id', agencyId)
        .eq('client_id', activeClient?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Sort items by position
      const structuredData = (data || []).map((session: any) => ({
         ...session,
         theme_items: (session.theme_items || []).sort((a: any, b: any) => a.position - b.position)
      }));

      setSessions(structuredData);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar banco de temas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!newSessionTitle.trim() || !activeClient) return;
    
    setCreatingSession(true);
    try {
      const session_token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      
      const { error } = await supabase
        .from('theme_sessions')
        .insert({
           client_id: activeClient.id,
           agency_id: agencyId,
           title: newSessionTitle,
           session_token,
           status: 'draft'
        });
        
      if (error) throw error;
      setNewSessionTitle('');
      fetchSessions();
    } catch (err) {
       console.error(err);
       alert('Erro ao criar sessão de temas.');
    } finally {
       setCreatingSession(false);
    }
  };

  const handleUpdateSessionTitle = async (sessionId: string) => {
    if (!editSessionTitle.trim()) return;
    try {
      const { error } = await supabase
        .from('theme_sessions')
        .update({ title: editSessionTitle })
        .eq('id', sessionId);
        
      if (error) throw error;
      setEditingSessionId(null);
      fetchSessions();
      showToast('Nome da sessão atualizado!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar nome da sessão.');
    }
  };

  const copyApprovalLink = (token: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/temas/${token}`;
    navigator.clipboard.writeText(url);
    alert('Link copiado!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-500';
      case 'sent': return 'bg-blue-100 text-blue-600';
      case 'reviewed': return 'bg-green-100 text-green-600';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Rascunho';
      case 'sent': return 'Enviado';
      case 'reviewed': return 'Revisado';
      default: return 'Rascunho';
    }
  };

  const getApprovalColor = (status: string) => {
    switch(status) {
      case 'approved': return 'bg-green-50 text-green-600 border-green-200';
      case 'rejected': return 'bg-red-50 text-red-600 border-red-200';
      case 'revision': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'transferred': return 'bg-brand-dark/5 text-brand-dark border-brand-dark/20';
      default: return 'bg-gray-50 text-gray-500 border-gray-200';
    }
  };

  const parseLinks = (rawStr: string): string[] => {
     if (!rawStr.trim()) return [];
     return rawStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };

  const handleAddItem = async (sessionId: string) => {
      if (!newItemModel.title.trim()) return;
      setLoadingItemSession(sessionId);

      const sessionObj = sessions.find(s => s.id === sessionId);
      const position = sessionObj?.theme_items?.length || 0;

      try {
          const { error } = await supabase
            .from('theme_items')
            .insert({
                session_id: sessionId,
                title: newItemModel.title,
                description: newItemModel.description,
                format: newItemModel.format,
                reference_links: parseLinks(newItemModel.reference_links),
                position,
                approval_status: 'pending'
            });

          if (error) throw error;
          setNewItemModel({ session_id: '', title: '', description: '', format: 'Post Estático', reference_links: '' });
          fetchSessions();
      } catch (err) {
          console.error(err);
          alert("Erro ao adicionar tema.");
      } finally {
          setLoadingItemSession(null);
      }
  };

  const startEditingItem = (item: any) => {
      setEditingItemId(item.id);
      setEditItemModel({
          title: item.title,
          description: item.description || '',
          format: item.format || 'Post Estático',
          reference_links: (item.reference_links || []).join(', ')
      });
  };

  const handleUpdateItem = async (itemId: string, sessionId: string) => {
      if (!editItemModel.title.trim()) return;
      setLoadingItemSession(sessionId);

      try {
          const { error } = await supabase
            .from('theme_items')
            .update({
                title: editItemModel.title,
                description: editItemModel.description,
                format: editItemModel.format,
                reference_links: parseLinks(editItemModel.reference_links),
            })
            .eq('id', itemId);

          if (error) throw error;
          setEditingItemId(null);
          fetchSessions();
      } catch (err) {
          console.error(err);
          alert("Erro ao salvar alterações.");
      } finally {
          setLoadingItemSession(null);
      }
  };

  const handleDeleteSession = async (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!id) return;
      
      try {
          const { error } = await supabase.from('theme_sessions').delete().eq('agency_id', agencyId).eq('id', id);
          if (error) throw error;
          fetchSessions();
          showToast('Sessão excluída com sucesso!');
      } catch (err) {
          console.error(err);
          alert("Erro ao excluir.");
      } finally {
          setConfirmSessionId(null);
      }
  };

  const handleDeleteItem = async (itemId: string) => {
      if (!itemId) return;
      try {
         await supabase.from('theme_items').delete().eq('id', itemId);
         // Clear from selection if it was there
         const newSet = new Set(selectedItemIds);
         if (newSet.has(itemId)) {
            newSet.delete(itemId);
            setSelectedItemIds(newSet);
         }
         fetchSessions();
         showToast('Tema excluído com sucesso!');
      } catch (err) {
          console.error(err);
      } finally {
          setConfirmThemeId(null);
      }
  };

  const toggleSelection = (itemId: string) => {
    const newSet = new Set(selectedItemIds);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedItemIds(newSet);
  };

  const toggleSelectAllInSession = (sessionId: string, items: any[]) => {
    const itemIds = items.map(i => i.id);
    const allInSessionSelected = itemIds.every(id => selectedItemIds.has(id));
    const newSet = new Set(selectedItemIds);
    
    if (allInSessionSelected) {
        itemIds.forEach(id => newSet.delete(id));
    } else {
        itemIds.forEach(id => newSet.add(id));
    }
    setSelectedItemIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (selectedItemIds.size === 0) return;

    try {
        const { error } = await supabase
            .from('theme_items')
            .delete()
            .in('id', Array.from(selectedItemIds));
        
        if (error) throw error;
        
        setSelectedItemIds(new Set());
        fetchSessions();
        showToast(`${selectedItemIds.size} temas excluídos com sucesso!`);
    } catch (err) {
        console.error(err);
        alert("Erro ao excluir temas selecionados.");
    } finally {
        setConfirmBulkDelete(false);
    }
  };

  // Drag and Drop
  const moveItem = async (sessionId: string, items: any[], dragIndex: number, hoverIndex: number) => {
      const draftItems = [...items];
      const draggedItem = draftItems[dragIndex];
      draftItems.splice(dragIndex, 1);
      draftItems.splice(hoverIndex, 0, draggedItem);
      
      // update local
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, theme_items: draftItems } : s));

      // update DB
      try {
          for (let i = 0; i < draftItems.length; i++) {
              if (draftItems[i].position !== i) {
                 await supabase.from('theme_items').update({ position: i }).eq('id', draftItems[i].id);
              }
          }
          fetchSessions();
      } catch (err) {
          console.error(err);
      }
  };

  if (loading) {
     return <div className="p-10 flex justify-center"><AlertCircle size={24} className="text-gray-300 animate-pulse" /></div>;
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-black/[0.05] shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2"><Sparkles size={18} className="text-brand-dark" /> Banco de Temas</h3>
            <p className="text-sm font-medium text-gray-500">Crie sessões de temas e envie para aprovação do cliente.</p>
          </div>
          <div className="flex gap-2">
             <input 
               type="text" 
               placeholder="Nome da nova sessão (ex: Temas Agosto)"
               value={newSessionTitle}
               onChange={e => setNewSessionTitle(e.target.value)}
               className="h-10 border border-gray-200 rounded-xl px-4 text-sm focus:border-brand-dark outline-none font-medium text-gray-900"
             />
             <button
               onClick={handleCreateSession}
               disabled={creatingSession || !newSessionTitle.trim()}
               className="h-10 px-5 bg-brand-dark text-white rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-black transition-all flex items-center justify-center whitespace-nowrap"
             >
                {creatingSession ? 'Criando...' : 'Criar Sessão'}
             </button>
          </div>
       </div>

       {selectedItemIds.size > 0 && (
         <motion.div 
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center justify-between"
         >
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold text-xs">
               {selectedItemIds.size}
             </div>
             <p className="text-sm font-bold text-red-700">Temas selecionados</p>
           </div>
           <div className="flex gap-2">
             <button 
               onClick={() => setSelectedItemIds(new Set())}
               className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-700"
             >
               Cancelar
             </button>
             <button 
               onClick={() => setConfirmBulkDelete(true)}
               className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center gap-2"
             >
               <Trash size={14} /> Excluir Selecionados
             </button>
           </div>
         </motion.div>
       )}

       {sessions.map(session => (
           <div key={session.id} className="bg-white rounded-3xl border border-black/[0.05] overflow-hidden shadow-sm">
               <div 
                 onClick={(e) => {
                   if (editingSessionId === session.id) return;
                   setExpandedSession(expandedSession === session.id ? null : session.id);
                 }}
                 className="group p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
               >
                   <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${expandedSession === session.id ? 'rotate-90 bg-brand-dark text-white' : 'bg-gray-100 text-gray-400'}`}>
                         <ChevronRight size={16} />
                      </div>
                      <div>
                         {editingSessionId === session.id ? (
                           <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                             <input 
                               autoFocus
                               value={editSessionTitle}
                               onChange={(e) => setEditSessionTitle(e.target.value)}
                               className="border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-gray-900 focus:border-brand-dark outline-none bg-white"
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter') handleUpdateSessionTitle(session.id);
                                 if (e.key === 'Escape') setEditingSessionId(null);
                               }}
                             />
                             <button onClick={() => handleUpdateSessionTitle(session.id)} className="p-1.5 bg-brand-dark text-white rounded-lg hover:bg-black"><Save size={14}/></button>
                             <button onClick={() => setEditingSessionId(null)} className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"><X size={14}/></button>
                           </div>
                         ) : (
                           <div className="flex items-center gap-2">
                             <h4 className="text-base font-bold text-gray-900 leading-tight">{session.title}</h4>
                             <button 
                               onClick={(e) => {
                                  e.stopPropagation();
                                  setEditSessionTitle(session.title);
                                  setEditingSessionId(session.id);
                               }}
                               className="text-gray-300 hover:text-brand-dark opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                               <Edit2 size={12} />
                             </button>
                           </div>
                         )}
                         <p className="text-xs text-gray-400 font-medium">{session.theme_items?.length || 0} temas cadastrados</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${getStatusColor(session.status)}`}>
                         {getStatusLabel(session.status)}
                      </span>
                      <button
                        onClick={(e) => copyApprovalLink(session.session_token, e)}
                        className="p-2 text-gray-400 hover:text-brand-dark hover:bg-brand-dark/5 rounded-lg transition-all"
                        title="Copiar Link de Aprovação"
                      >
                         <Link2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmSessionId(session.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Excluir Sessão"
                      >
                         <Trash size={16} />
                      </button>
                   </div>
               </div>

               <AnimatePresence>
                  {expandedSession === session.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100 bg-gray-50/50 p-6 flex flex-col gap-4"
                      >
                         {/* Selection Bar for session */}
                         {session.theme_items?.length > 0 && (
                           <div className="flex items-center justify-between bg-white/50 p-3 rounded-xl border border-black/[0.03] mb-2">
                             <button 
                               onClick={() => toggleSelectAllInSession(session.id, session.theme_items)}
                               className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-brand-dark transition-colors"
                             >
                               {session.theme_items.every((i: any) => selectedItemIds.has(i.id)) ? (
                                 <><XCircle size={14} className="text-red-400" /> Desmarcar Todos</>
                               ) : (
                                 <><CheckCircle2 size={14} className="text-brand-dark" /> Selecionar Todos da Sessão</>
                               )}
                             </button>
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                               {session.theme_items.filter((i: any) => selectedItemIds.has(i.id)).length} de {session.theme_items.length} selecionados
                             </span>
                           </div>
                         )}

                         {/* Lista de temas */}
                         {session.theme_items?.map((item: any, idx: number) => (
                             <div 
                                key={item.id} 
                                draggable 
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', idx.toString());
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault(); // allow drop
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
                                    if (!isNaN(sourceIdx) && sourceIdx !== idx) {
                                       moveItem(session.id, session.theme_items, sourceIdx, idx);
                                    }
                                }}
                                className={`p-5 bg-white border rounded-2xl shadow-sm transition-all hover:shadow-md flex gap-4 ${getApprovalColor(item.approval_status)} ${selectedItemIds.has(item.id) ? 'ring-2 ring-brand-dark border-brand-dark/30 shadow-brand-dark/10' : ''}`}
                             >
                                 <div className="pt-1">
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       toggleSelection(item.id);
                                     }}
                                     className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${selectedItemIds.has(item.id) ? 'bg-brand-dark border-brand-dark text-white' : 'bg-white border-gray-200 text-transparent hover:border-brand-dark'}`}
                                   >
                                     <CheckCircle2 size={12} />
                                   </button>
                                 </div>
                                 <div className="flex-1">
                                 {editingItemId === item.id ? (
                                     <div className="flex flex-col gap-3">
                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                             <input 
                                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brand-dark outline-none font-medium" 
                                                placeholder="Título do Tema" 
                                                value={editItemModel.title}
                                                onChange={e => setEditItemModel({...editItemModel, title: e.target.value})}
                                             />
                                             <select 
                                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brand-dark outline-none font-medium bg-white"
                                                value={editItemModel.format}
                                                onChange={e => setEditItemModel({...editItemModel, format: e.target.value})}
                                             >
                                                 <option>Post Estático</option>
                                                 <option>Reels</option>
                                                 <option>Carrossel</option>
                                                 <option>Stories</option>
                                             </select>
                                         </div>
                                         <textarea 
                                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brand-dark outline-none font-medium resize-none" 
                                            placeholder="Descrição detalhada..." 
                                            rows={2}
                                            value={editItemModel.description}
                                            onChange={e => setEditItemModel({...editItemModel, description: e.target.value})}
                                         />
                                         <input 
                                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brand-dark outline-none font-medium" 
                                            placeholder="Links de Referência (separados por vírgula)" 
                                            value={editItemModel.reference_links}
                                            onChange={e => setEditItemModel({...editItemModel, reference_links: e.target.value})}
                                         />
                                         <div className="flex justify-end mt-1 gap-2">
                                             <button 
                                                onClick={() => setEditingItemId(null)}
                                                className="px-4 py-2 bg-gray-100 text-gray-500 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-200 transition-all"
                                             >
                                                 Cancelar
                                             </button>
                                             <button 
                                                onClick={() => handleUpdateItem(item.id, session.id)}
                                                disabled={!editItemModel.title.trim()}
                                                className="px-5 py-2 bg-brand-dark text-white rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-black transition-all"
                                             >
                                                 Salvar Tema
                                             </button>
                                         </div>
                                     </div>
                                 ) : (
                                     <>
                                         <div className="flex justify-between items-start mb-3">
                                             <div className="flex items-center gap-2">
                                                 <span className="cursor-move p-1 text-gray-300 hover:text-gray-500"><GripVertical size={14} /></span>
                                                 <h5 className="font-bold text-gray-900 text-sm">{item.title}</h5>
                                                 <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-widest rounded">{item.format}</span>
                                             </div>
                                             <div className="flex items-center gap-2">
                                                 {item.approval_status === 'approved' && (
                                                     <button 
                                                        onClick={() => onTransferTheme(item)}
                                                        className="px-3 py-1.5 bg-brand-dark text-white text-[9px] font-bold uppercase tracking-widest rounded-lg hover:bg-black transition-all"
                                                     >
                                                        Transferir para Mapa
                                                     </button>
                                                 )}
                                                 <button onClick={() => startEditingItem(item)} className="text-gray-300 hover:text-blue-500"><Edit2 size={14} /></button>
                                                 <button onClick={() => setConfirmThemeId(item.id)} className="text-gray-300 hover:text-red-500"><Trash size={14} /></button>
                                             </div>
                                         </div>
                                         <p className="text-sm text-gray-600 mb-3 ml-7">{item.description}</p>
                                         
                                         {item.client_comment && (() => {
                                             let parsed = { author: 'Cliente', content: item.client_comment, date: '' };
                                             try {
                                                const j = JSON.parse(item.client_comment);
                                                if (j.content) parsed = j;
                                             } catch {
                                                const match = item.client_comment.match(/^\[(.*?)\] (.*)$/s);
                                                if (match) {
                                                   parsed = { author: match[1], content: match[2], date: '' };
                                                }
                                             }
                                             return (
                                               <div className="ml-7 mt-3 p-3 bg-gray-50 rounded-xl border border-black/[0.05]">
                                                   <div className="flex justify-between items-center mb-1">
                                                     <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1"><MessageSquare size={10}/> Feedback de {parsed.author}</p>
                                                     {parsed.date && (
                                                       <p className="text-[10px] text-gray-400 font-medium">
                                                         {new Date(parsed.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                       </p>
                                                     )}
                                                   </div>
                                                   <p className="text-sm font-medium text-gray-700 whitespace-pre-wrap">{parsed.content}</p>
                                               </div>
                                             );
                                         })()}
                                     </>
                                 )}
                                 </div>
                             </div>
                         ))}

                         {/* Form Adicionar */}
                         <div className="mt-4 p-5 border border-dashed border-gray-300 rounded-2xl bg-white shadow-sm flex flex-col gap-3 relative">
                             {loadingItemSession === session.id && (
                                 <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-2xl">
                                     <AlertCircle size={24} className="text-brand-dark animate-pulse" />
                                 </div>
                             )}
                             <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={12} /> Novo Tema
                             </h5>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 <input 
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brand-dark outline-none font-medium" 
                                    placeholder="Título do Tema" 
                                    value={newItemModel.session_id === session.id ? newItemModel.title : ''}
                                    onChange={e => setNewItemModel({...newItemModel, session_id: session.id, title: e.target.value})}
                                 />
                                 <select 
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brand-dark outline-none font-medium bg-white"
                                    value={newItemModel.session_id === session.id ? newItemModel.format : 'Post Estático'}
                                    onChange={e => setNewItemModel({...newItemModel, session_id: session.id, format: e.target.value})}
                                 >
                                     <option>Post Estático</option>
                                     <option>Reels</option>
                                     <option>Carrossel</option>
                                     <option>Stories</option>
                                 </select>
                             </div>
                             <textarea 
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brand-dark outline-none font-medium resize-none" 
                                placeholder="Descrição detalhada..." 
                                rows={2}
                                value={newItemModel.session_id === session.id ? newItemModel.description : ''}
                                onChange={e => setNewItemModel({...newItemModel, session_id: session.id, description: e.target.value})}
                             />
                             <input 
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brand-dark outline-none font-medium" 
                                placeholder="Links de Referência (separados por vírgula)" 
                                value={newItemModel.session_id === session.id ? newItemModel.reference_links : ''}
                                onChange={e => setNewItemModel({...newItemModel, session_id: session.id, reference_links: e.target.value})}
                             />
                             <div className="flex justify-end mt-1">
                                 <button 
                                    onClick={() => handleAddItem(session.id)}
                                    disabled={newItemModel.session_id !== session.id || !newItemModel.title.trim()}
                                    className="px-5 py-2 bg-brand-dark text-white rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-black transition-all"
                                 >
                                     Salvar Tema
                                 </button>
                             </div>
                         </div>
                      </motion.div>
                  )}
               </AnimatePresence>
           </div>
       ))}
       
       {sessions.length === 0 && !loading && (
           <div className="py-20 text-center">
               <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-black/[0.05]">
                   <Target size={24} className="text-gray-300" />
               </div>
               <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhuma sessão criada</h3>
               <p className="text-gray-500 font-medium">Use o campo acima para criar a primeira sessão de temas deste cliente.</p>
           </div>
       )}

       <ConfirmModal
         isOpen={!!confirmSessionId}
         title="Excluir Sessão"
         message="Tem certeza que deseja excluir esta sessão completa? Todos os temas associados a ela também serão excluídos."
         onConfirm={() => confirmSessionId && handleDeleteSession(confirmSessionId)}
         onCancel={() => setConfirmSessionId(null)}
         confirmText="Excluir"
       />

       <ConfirmModal
         isOpen={!!confirmThemeId}
         title="Excluir Tema"
         message="Tem certeza que deseja excluir este tema?"
         onConfirm={() => confirmThemeId && handleDeleteItem(confirmThemeId)}
         onCancel={() => setConfirmThemeId(null)}
         confirmText="Excluir"
       />
       
       <ConfirmModal
         isOpen={confirmBulkDelete}
         title="Excluir Selecionados"
         message={`Tem certeza que deseja excluir os ${selectedItemIds.size} temas selecionados?`}
         onConfirm={handleBulkDelete}
         onCancel={() => setConfirmBulkDelete(false)}
         confirmText="Excluir Selecionados"
       />

       {/* Toast */}
       <AnimatePresence>
           {toastMsg && (
               <motion.div
                   initial={{ opacity: 0, y: 50, scale: 0.9 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   exit={{ opacity: 0, y: 20, scale: 0.9 }}
                   className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[9999]"
               >
                   <CheckCircle2 size={18} className="text-green-400" />
                   <span className="text-sm font-medium">{toastMsg}</span>
               </motion.div>
           )}
       </AnimatePresence>
    </div>
  );
};

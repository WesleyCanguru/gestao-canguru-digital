
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DETAILED_MONTHLY_PLANS } from '../constants';
import { PostData, PostStatus, DailyContent, PostComment } from '../types';
import { InstagramView, LinkedInView } from './PlatformViews';
import { Logo } from './Logo';
import { CheckCircle2, AlertTriangle, Send, User, Loader2, XCircle, Instagram, Linkedin, MessageSquare } from 'lucide-react';

export const PublicApprovalScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  
  // States para Multi-plataforma
  const [primaryPost, setPrimaryPost] = useState<PostData | null>(null);
  const [counterpartPost, setCounterpartPost] = useState<PostData | null>(null);
  const [primaryContent, setPrimaryContent] = useState<DailyContent | null>(null);
  const [counterpartContent, setCounterpartContent] = useState<DailyContent | null>(null);
  
  // Comments State
  const [comments, setComments] = useState<PostComment[]>([]);

  // View State
  const [activeTab, setActiveTab] = useState<'meta' | 'linkedin'>('meta'); // Default, atualizado no load

  const [error, setError] = useState('');
  
  // Interaction State
  const [userName, setUserName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'request_changes' | null>(null);
  const [comment, setComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Get ID from URL
  const queryParams = new URLSearchParams(window.location.search);
  const dateKey = queryParams.get('id');

  // Helper para buscar dados (DB ou Estático) de uma chave específica
  const fetchPostData = async (key: string) => {
      // 1. Busca DB
      const { data: dbData } = await supabase
          .from('posts')
          .select('*')
          .eq('date_key', key)
          .maybeSingle();

      // 2. Busca Estático (Fallback)
      let staticContent: DailyContent | null = null;
      const parts = key.split('-');
      if (parts.length >= 3) {
          const day = parts[0];
          const month = parts[1];
          const searchKey = `${day}/${month}`;
          
          for (const plan of DETAILED_MONTHLY_PLANS) {
               for (const week of plan.weeks) {
                  for (const d of week.days) {
                     if (d.day.startsWith(searchKey)) {
                        const platformInKey = parts.length > 3 ? parts[3] : null;
                        if (!platformInKey || d.platform === platformInKey) {
                           staticContent = d;
                           break;
                        }
                     }
                  }
                  if (staticContent) break;
               }
               if (staticContent) break;
          }
      }

      // 3. Monta Objeto Final
      if (dbData) {
          // Existe no banco
          const content = staticContent || {
                day: `${parts[0]}/${parts[1]}`,
                platform: (key.includes('linkedin') ? 'linkedin' : 'meta') as 'meta' | 'linkedin',
                type: dbData.type || 'Post',
                theme: dbData.theme || 'Sem tema',
                bullets: dbData.bullets || [],
                initialImageUrl: dbData.image_url || undefined
          };
          return { post: dbData as PostData, content };
      } else if (staticContent) {
          // Apenas estático
          const dummyPost: PostData = {
              date_key: key,
              status: staticContent.exclusive ? 'approved' : 'draft',
              image_url: staticContent.initialImageUrl || null,
              caption: null,
              last_updated: new Date().toISOString()
          };
          return { post: dummyPost, content: staticContent };
      }
      
      return null; // Não existe
  };

  useEffect(() => {
    if (!dateKey) {
      setError('Link inválido ou expirado.');
      setLoading(false);
      return;
    }

    const loadAll = async () => {
      try {
         // 1. Load Primary (from URL)
         const primary = await fetchPostData(dateKey);
         if (!primary) throw new Error('Publicação não encontrada.');
         
         setPrimaryPost(primary.post);
         setPrimaryContent(primary.content);
         setActiveTab(primary.content.platform);

         // 2. Try to Load Counterpart
         const parts = dateKey.split('-');
         const currentPlatform = dateKey.includes('linkedin') ? 'linkedin' : 'meta';
         const otherPlatform = currentPlatform === 'linkedin' ? 'meta' : 'linkedin';
         const counterpartKey = `${parts[0]}-${parts[1]}-${parts[2]}-${otherPlatform}`;
         
         const partner = await fetchPostData(counterpartKey);
         if (partner) {
             setCounterpartPost(partner.post);
             setCounterpartContent(partner.content);
         }

         // 3. Load Comments (fetch for both keys to be safe)
         const keysToFetch = [primary.post.date_key];
         if (partner) keysToFetch.push(partner.post.date_key);

         const { data: commentsData } = await supabase
            .from('comments')
            .select('*')
            .in('post_id', keysToFetch)
            .eq('visible_to_admin', true) // Only show comments intended for public/admin/approver flow
            .order('created_at', { ascending: true });

         if (commentsData) {
            setComments(commentsData as PostComment[]);
         }

      } catch (err) {
         console.error(err);
         setError('Publicação não encontrada.');
      } finally {
         setLoading(false);
      }
    };
    
    loadAll();
  }, [dateKey]);

  // --- ACTIONS ---

  const handleActionClick = (action: 'approve' | 'request_changes') => {
    setPendingAction(action);
    if (!userName) {
       setShowNamePrompt(true);
    } else {
       executeAction(action, userName);
    }
  };

  const handleNameSubmit = () => {
     if (!userName.trim()) return;
     setShowNamePrompt(false);
     if (pendingAction) {
        executeAction(pendingAction, userName);
     }
  };

  const executeAction = (action: 'approve' | 'request_changes', name: string) => {
     if (action === 'request_changes') {
        setShowCommentBox(true); 
     } else {
        submitApproval(name);
     }
  };

  // Helper para salvar um único post
  const savePostStatus = async (pData: PostData, cData: DailyContent, status: PostStatus) => {
      await supabase
           .from('posts')
           .upsert({
              date_key: pData.date_key,
              status: status,
              image_url: pData.image_url || cData.initialImageUrl,
              caption: pData.caption,
              theme: pData.theme || cData.theme,
              type: pData.type || cData.type,
              bullets: pData.bullets || cData.bullets,
              last_updated: new Date().toISOString()
           }, { onConflict: 'date_key' });
  };

  const submitApproval = async (name: string) => {
     if (!primaryPost || !primaryContent) return;
     setSubmitting(true);
     try {
        // 1. Aprovar Principal
        await savePostStatus(primaryPost, primaryContent, 'approved');

        // 2. Aprovar Contraparte (se existir)
        if (counterpartPost && counterpartContent) {
            await savePostStatus(counterpartPost, counterpartContent, 'approved');
        }

        // 3. Comentário no Principal (para registro)
        const newCommentObj = {
           post_id: primaryPost.date_key,
           author_role: 'approver',
           author_name: name,
           content: `✅ APROVOU a publicação${counterpartPost ? ' (e a versão vinculada)' : ''}.`,
           visible_to_admin: true
        };
        const { data: insertedComment } = await supabase.from('comments').insert(newCommentObj).select().single();
        if (insertedComment) {
            setComments(prev => [...prev, insertedComment as PostComment]);
        }

        // Atualizar estado local
        setPrimaryPost(prev => prev ? ({...prev, status: 'approved'}) : null);
        if (counterpartPost) setCounterpartPost(prev => prev ? ({...prev, status: 'approved'}) : null);
        
        setSuccessMessage('Publicação aprovada com sucesso!');
        setPendingAction(null);
     } catch (err) {
        alert('Erro ao aprovar.');
     } finally {
        setSubmitting(false);
     }
  };

  const submitChanges = async () => {
     if (!primaryPost || !comment.trim()) return;
     setSubmitting(true);
     try {
        // 1. Marcar changes_requested Principal
        await savePostStatus(primaryPost, primaryContent!, 'changes_requested');

        // 2. Marcar changes_requested Contraparte (se existir)
        if (counterpartPost && counterpartContent) {
            await savePostStatus(counterpartPost, counterpartContent, 'changes_requested');
        }

        // 3. Comentário
        const newCommentObj = {
           post_id: primaryPost.date_key,
           author_role: 'approver',
           author_name: userName,
           content: comment,
           visible_to_admin: true
        };
        
        const { data: insertedComment } = await supabase.from('comments').insert(newCommentObj).select().single();
        if (insertedComment) {
            setComments(prev => [...prev, insertedComment as PostComment]);
        }

        setPrimaryPost(prev => prev ? ({...prev, status: 'changes_requested'}) : null);
        if (counterpartPost) setCounterpartPost(prev => prev ? ({...prev, status: 'changes_requested'}) : null);

        setSuccessMessage('Solicitação de ajuste enviada!');
        setShowCommentBox(false);
        setComment('');
        setPendingAction(null);

     } catch (err) {
        alert('Erro ao enviar solicitação.');
     } finally {
        setSubmitting(false);
     }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  
  if (error || !primaryContent || !primaryPost) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-brand-dark p-6 text-center">
          <XCircle size={48} className="text-red-400 mb-4" />
          <h2 className="text-xl font-bold mb-2">Link Indisponível</h2>
          <p className="text-gray-500">{error}</p>
      </div>
  );

  // --- RENDER HELPERS ---

  // Determine which data to show based on active tab
  const activePost = activeTab === 'meta' 
      ? (primaryContent.platform === 'meta' ? primaryPost : counterpartPost) 
      : (primaryContent.platform === 'linkedin' ? primaryPost : counterpartPost);

  const activeContent = activeTab === 'meta'
      ? (primaryContent.platform === 'meta' ? primaryContent : counterpartContent)
      : (primaryContent.platform === 'linkedin' ? primaryContent : counterpartContent);

  // Safe checks incase tab switch is weird
  const safePost = activePost || primaryPost;
  const safeContent = activeContent || primaryContent;

  const isVideo = (safePost.image_url || safeContent.initialImageUrl)?.match(/\.(mp4|webm|ogg)$/i);
  
  // Overrides
  const effectiveContent: DailyContent = {
     ...safeContent,
     theme: safePost.theme || safeContent.theme,
     type: safePost.type || safeContent.type,
     bullets: safePost.bullets || safeContent.bullets
  };

  const displayImage = safePost.image_url || safeContent.initialImageUrl || '';
  const displayCaption = safePost.caption || '';

  const getStatusLabel = (s?: string) => {
    const map: Record<string, string> = {
        'draft': 'Rascunho',
        'pending_approval': 'Aprovação Pendente',
        'changes_requested': 'Ajustes Solicitados',
        'internal_review': 'Discussão Interna',
        'approved': 'Aprovado',
        'scheduled': 'Programado',
        'published': 'Publicado'
    };
    return map[s || 'draft'] || s;
  };

  const hasMultiple = !!counterpartPost;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
       {/* Header Public */}
       <header className="bg-white border-b border-gray-200 py-4 sticky top-0 z-20">
          <div className="max-w-3xl mx-auto px-4 flex justify-between items-center">
             <Logo size="small" />
             <div className="text-right">
                <span className="block text-[10px] text-gray-400 uppercase tracking-widest font-bold">Ambiente de Aprovação</span>
                {userName && <span className="text-xs font-bold text-blue-600">Olá, {userName}</span>}
             </div>
          </div>
       </header>

       <main className="flex-grow flex flex-col items-center p-4 sm:p-8">
          
          {successMessage ? (
             <div className="w-full max-w-lg bg-green-50 border border-green-200 rounded-xl p-8 text-center animate-in zoom-in-95">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                   <CheckCircle2 size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Sucesso!</h2>
                <p className="text-gray-600">{successMessage}</p>
                <button 
                  onClick={() => setSuccessMessage('')}
                  className="mt-6 text-sm text-green-700 font-bold underline"
                >
                   Voltar para visualização
                </button>
             </div>
          ) : (
             <div className="w-full max-w-4xl flex flex-col md:flex-row gap-8 items-start">
                
                {/* Preview Column */}
                <div className="w-full md:w-1/2 flex flex-col">
                   
                   {/* Platform Tabs (if multiple) */}
                   {hasMultiple && (
                       <div className="flex gap-2 mb-4 bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm self-center">
                           <button 
                               onClick={() => setActiveTab('meta')}
                               className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'meta' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                           >
                               <Instagram size={16} /> Instagram
                           </button>
                           <button 
                               onClick={() => setActiveTab('linkedin')}
                               className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'linkedin' ? 'bg-[#0077B5] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                           >
                               <Linkedin size={16} /> LinkedIn
                           </button>
                       </div>
                   )}

                   <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 transition-all duration-300">
                      {activeTab === 'linkedin' ? (
                         <LinkedInView 
                           dayContent={effectiveContent} 
                           caption={displayCaption} 
                           imageUrl={displayImage} 
                           isVideo={!!isVideo} 
                         />
                      ) : (
                         <InstagramView 
                           dayContent={effectiveContent} 
                           caption={displayCaption} 
                           imageUrl={displayImage} 
                           isVideo={!!isVideo} 
                         />
                      )}
                   </div>
                   
                   <div className="text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border 
                         ${safePost.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : 
                           safePost.status === 'changes_requested' ? 'bg-red-100 text-red-700 border-red-200' : 
                           'bg-gray-100 text-gray-600 border-gray-200'
                         }`}>
                         Status: {getStatusLabel(safePost.status)}
                      </span>
                   </div>
                </div>

                {/* Actions Column */}
                <div className="w-full md:w-1/2 flex flex-col gap-4 sticky top-24">
                   
                   {/* Context Box */}
                   <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <h2 className="text-lg font-bold text-gray-900 mb-1">{effectiveContent.day.split(' – ')[0]}</h2>
                      <p className="text-sm text-gray-500 mb-6 font-medium">{effectiveContent.theme}</p>
                      
                      {hasMultiple && (
                          <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 font-medium text-center">
                              Esta aprovação se aplica a ambas as plataformas (Instagram e LinkedIn).
                          </div>
                      )}

                      {!showCommentBox && !showNamePrompt && (
                         <div className="flex flex-col gap-3">
                            <button 
                              onClick={() => handleActionClick('approve')}
                              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                            >
                               <CheckCircle2 size={20} /> Aprovar Publicação
                            </button>
                            <button 
                              onClick={() => handleActionClick('request_changes')}
                              className="w-full py-4 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                            >
                               <AlertTriangle size={20} /> Solicitar Ajuste
                            </button>
                         </div>
                      )}

                      {/* Name Prompt */}
                      {showNamePrompt && (
                         <div className="animate-in fade-in slide-in-from-bottom-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Para continuar, qual seu nome?</label>
                            <input 
                              autoFocus
                              type="text" 
                              value={userName}
                              onChange={e => setUserName(e.target.value)}
                              placeholder="Ex: Viviane..."
                              className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <div className="flex gap-2">
                               <button onClick={handleNameSubmit} disabled={!userName.trim()} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold disabled:opacity-50">Continuar</button>
                               <button onClick={() => setShowNamePrompt(false)} className="px-4 text-gray-500">Cancelar</button>
                            </div>
                         </div>
                      )}

                      {/* Comment Box */}
                      {showCommentBox && (
                         <div className="animate-in fade-in slide-in-from-bottom-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">O que precisa ser ajustado?</label>
                            <textarea 
                              autoFocus
                              value={comment}
                              onChange={e => setComment(e.target.value)}
                              placeholder="Descreva o que gostaria de alterar..."
                              className="w-full h-32 p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-red-500 outline-none resize-none text-sm"
                            />
                            <div className="flex gap-2">
                               <button 
                                 onClick={submitChanges} 
                                 disabled={!comment.trim() || submitting} 
                                 className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                               >
                                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                                  Enviar Solicitação
                               </button>
                               <button onClick={() => setShowCommentBox(false)} disabled={submitting} className="px-4 text-gray-500 font-medium">Cancelar</button>
                            </div>
                         </div>
                      )}
                      
                      {/* Comments History Section */}
                      {comments.length > 0 && (
                          <div className="mt-8 pt-6 border-t border-gray-100">
                              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-4">
                                  <MessageSquare size={16} className="text-blue-500" /> Histórico de Comentários
                              </h3>
                              <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                  {comments.map((c) => (
                                      <div key={c.id} className="flex flex-col gap-1 text-sm">
                                          <div className="flex items-center gap-2">
                                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0 ${c.author_role === 'admin' ? 'bg-brand-dark' : c.author_role === 'approver' ? 'bg-green-600' : 'bg-purple-600'}`}>
                                                  {c.author_name.charAt(0)}
                                              </div>
                                              <span className="font-bold text-gray-700 text-xs">{c.author_name}</span>
                                              <span className="text-[10px] text-gray-400">
                                                  {new Date(c.created_at).toLocaleDateString('pt-BR')}
                                              </span>
                                          </div>
                                          <div className={`p-3 rounded-xl ${c.author_role === 'admin' ? 'bg-gray-50 rounded-tl-none' : c.author_role === 'approver' ? 'bg-green-50 text-green-900 rounded-tl-none' : 'bg-purple-50 rounded-tl-none'}`}>
                                              <p className="text-gray-600 leading-relaxed">{c.content}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                   </div>

                   <p className="text-xs text-gray-400 text-center leading-relaxed">
                      Ao aprovar, a publicação será marcada como pronta.<br/>
                      Ao solicitar ajustes, a equipe será notificada.
                   </p>
                </div>
             </div>
          )}
       </main>
    </div>
  );
};

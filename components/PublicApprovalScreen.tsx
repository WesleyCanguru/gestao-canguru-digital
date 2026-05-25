
import React, { useState, useEffect } from 'react';
import { supabase, parseImageUrl, stringifyImageUrl } from '../lib/supabase';
import { PostData, PostStatus, DailyContent, PostComment, Client } from '../types';
import { InstagramView, LinkedInView, TikTokView } from './PlatformViews';
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
  const [client, setClient] = useState<Client | null>(null);
  const [agencyId, setAgencyId] = useState<number | null>(null);

  // View State
  const [activeTab, setActiveTab] = useState<'meta' | 'linkedin' | 'tiktok'>('meta'); // Default, atualizado no load

  const [error, setError] = useState('');
  
  // Interaction State
  const [userName, setUserName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'request_changes' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const handleImageClick = (url: string) => {
      setLightboxImage(url);
      setLightboxOpen(true);
  };

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

      // 2. Monta Objeto Final
      if (dbData) {
          if (dbData.agency_id) setAgencyId(dbData.agency_id);

          // Fetch client data
          const { data: clientData } = await supabase
             .from('clients')
             .select('*')
             .eq('id', dbData.client_id)
             .maybeSingle();
          if (clientData) setClient(clientData as Client);

          // Parse image_url if it's a stringified array
          const parsedImage = parseImageUrl(dbData.image_url);
          
          const parts = key.split('-');
          
          // Existe no banco
          const content = {
                day: `${parts[0]}/${parts[1]}`,
                platform: (key.includes('linkedin') ? 'linkedin' : 'meta') as 'meta' | 'linkedin',
                type: dbData.type || 'Post',
                theme: dbData.theme || 'Sem tema',
                bullets: dbData.bullets || [],
                initialImageUrl: (parsedImage as string | string[] | undefined)
          };
          return { post: { ...dbData, image_url: parsedImage } as PostData, content };
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
         const currentPlatform = dateKey.includes('linkedin') ? 'linkedin' : 'meta';
         const otherPlatform = currentPlatform === 'linkedin' ? 'meta' : 'linkedin';
         const counterpartKey = dateKey.replace(currentPlatform, otherPlatform);
         
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

  const handleActionClick = (action: 'approve' | 'request_changes' | 'reject') => {
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

  const executeAction = (action: 'approve' | 'request_changes' | 'reject', name: string) => {
     if (action === 'request_changes' || action === 'reject') {
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
              client_id: pData.client_id,
              agency_id: pData.agency_id || agencyId,
              status: status,
              image_url: stringifyImageUrl(pData.image_url) || stringifyImageUrl(cData.initialImageUrl),
              video_thumbnail_url: pData.video_thumbnail_url,
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
        const approvedStatus = isThemeMode ? 'theme_approved' : 'approved';
        
        // 1. Salvar Comentário Primeiro
        const newCommentObj = {
           post_id: primaryPost.date_key,
           agency_id: primaryPost.agency_id || agencyId || 1,
           author_role: 'approver',
           author_name: name,
           content: isThemeMode ? `✅ APROVOU o tema${counterpartPost ? ' (e a versão vinculada)' : ''}.` : `✅ APROVOU a publicação${counterpartPost ? ' (e a versão vinculada)' : ''}.`,
           visible_to_admin: true
        };
        const { data: insertedComment, error: commentError } = await supabase.from('comments').insert(newCommentObj).select().single();
        if (commentError) {
             alert('⚠️ Não foi possível registrar a aprovação. Tente novamente em instantes.');
             setSubmitting(false);
             return;
        }

        // 2. Aprovar Principal e Contraparte
        await savePostStatus(primaryPost, primaryContent, approvedStatus);
        if (counterpartPost && counterpartContent) {
            await savePostStatus(counterpartPost, counterpartContent, approvedStatus);
        }

        if (insertedComment) {
            setComments(prev => [...prev, insertedComment as PostComment]);
        }

        // Atualizar estado local
        setPrimaryPost(prev => prev ? ({...prev, status: approvedStatus}) : null);
        if (counterpartPost) setCounterpartPost(prev => prev ? ({...prev, status: approvedStatus}) : null);
        
        setSuccessMessage(isThemeMode ? 'Tema aprovado com sucesso!' : 'Publicação aprovada com sucesso!');
        setPendingAction(null);
     } catch (err) {
        alert('Erro ao aprovar.');
     } finally {
        setSubmitting(false);
     }
  };

  const submitReject = async () => {
     if (!primaryPost || !comment.trim()) return;
     setSubmitting(true);
     try {
        const rejectedStatus = isThemeMode ? 'theme_rejected' : 'rejected';
        const extraFields = isThemeMode ? { theme_rejection_reason: comment } : {};
        
        // 1. Salvar Comentário Primeiro
        const newCommentObj = {
           post_id: primaryPost.date_key,
           agency_id: primaryPost.agency_id || agencyId || 1,
           author_role: 'approver',
           author_name: userName,
           content: isThemeMode ? `❌ REPROVOU o tema. Justificativa: ${comment}` : `❌ REPROVOU a publicação. Justificativa: ${comment}`,
           visible_to_admin: true
        };
        
        const { data: insertedComment, error: commentError } = await supabase.from('comments').insert(newCommentObj).select().single();
        if (commentError) {
             alert('⚠️ Não foi possível salvar sua justificativa. Seu texto está preservado na caixa de texto — copie-o e tente novamente em instantes.');
             setSubmitting(false);
             return; // DONT close modal, dont save status
        }

        // Helper inline para lidar com extraFields
        const saveRejectedStatus = async (pData: PostData, cData: DailyContent) => {
            await supabase
                 .from('posts')
                 .upsert({
                    date_key: pData.date_key,
                    client_id: pData.client_id,
                    status: rejectedStatus,
                    ...extraFields,
                    image_url: stringifyImageUrl(pData.image_url) || stringifyImageUrl(cData.initialImageUrl),
                    video_thumbnail_url: pData.video_thumbnail_url,
                    caption: pData.caption,
                    theme: pData.theme || cData.theme,
                    type: pData.type || cData.type,
                    bullets: pData.bullets || cData.bullets,
                    last_updated: new Date().toISOString()
                 }, { onConflict: 'date_key' });
        };

        // 2. Marcar rejected Principal e Contraparte
        await saveRejectedStatus(primaryPost, primaryContent!);
        if (counterpartPost && counterpartContent) {
            await saveRejectedStatus(counterpartPost, counterpartContent);
        }

        if (insertedComment) {
            setComments(prev => [...prev, insertedComment as PostComment]);
        }

        setPrimaryPost(prev => prev ? ({...prev, status: rejectedStatus, ...extraFields}) : null);
        if (counterpartPost) setCounterpartPost(prev => prev ? ({...prev, status: rejectedStatus, ...extraFields}) : null);

        setSuccessMessage(isThemeMode ? 'Tema reprovado com sucesso!' : 'Publicação reprovada com sucesso!');
        setShowCommentBox(false);
        setComment('');
        setPendingAction(null);

     } catch (err) {
        alert('Erro ao enviar reprovação.');
     } finally {
        setSubmitting(false);
     }
  };

  const submitChanges = async () => {
     if (!primaryPost || !comment.trim()) return;
     setSubmitting(true);
     try {
        const changesStatus = isThemeMode ? 'theme_approved_with_notes' : 'changes_requested';
        const extraFields = isThemeMode ? { theme_client_notes: comment } : {};

        // 1. Salvar Comentário Primeiro
        const newCommentObj = {
           post_id: primaryPost.date_key,
           agency_id: primaryPost.agency_id || agencyId || 1,
           author_role: 'approver',
           author_name: userName,
           content: isThemeMode ? `⚠️ APROVOU O TEMA com observação: ${comment}` : comment,
           visible_to_admin: true
        };
        
        const { data: insertedComment, error: commentError } = await supabase.from('comments').insert(newCommentObj).select().single();
        if (commentError) {
             alert('⚠️ Não foi possível enviar sua solicitação. Seu texto está preservado na caixa de texto — copie-o e tente novamente em instantes.');
             setSubmitting(false);
             return; 
        }

        // Helper inline para lidar com extraFields
        const saveChangesStatus = async (pData: PostData, cData: DailyContent) => {
            await supabase
                 .from('posts')
                 .upsert({
                    date_key: pData.date_key,
                    client_id: pData.client_id,
                    status: changesStatus,
                    ...extraFields,
                    image_url: stringifyImageUrl(pData.image_url) || stringifyImageUrl(cData.initialImageUrl),
                    video_thumbnail_url: pData.video_thumbnail_url,
                    caption: pData.caption,
                    theme: pData.theme || cData.theme,
                    type: pData.type || cData.type,
                    bullets: pData.bullets || cData.bullets,
                    last_updated: new Date().toISOString()
                 }, { onConflict: 'date_key' });
        };

        // 2. Marcar changes_requested Principal e Contraparte
        await saveChangesStatus(primaryPost, primaryContent!);
        if (counterpartPost && counterpartContent) {
            await saveChangesStatus(counterpartPost, counterpartContent);
        }

        if (insertedComment) {
            setComments(prev => [...prev, insertedComment as PostComment]);
        }

        setPrimaryPost(prev => prev ? ({...prev, status: changesStatus, ...extraFields}) : null);
        if (counterpartPost) setCounterpartPost(prev => prev ? ({...prev, status: changesStatus, ...extraFields}) : null);

        setSuccessMessage(isThemeMode ? 'Tema aprovado com observação!' : 'Solicitação de ajuste enviada!');
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

  const imgUrl = safePost.image_url || safeContent.initialImageUrl;
  const isVideo = typeof imgUrl === 'string' ? imgUrl.match(/\.(mp4|webm|ogg)$/i) : false;
  
  // Overrides
  const effectiveContent: DailyContent = {
     ...safeContent,
     theme: safePost.theme || safeContent.theme,
     type: safePost.type || safeContent.type,
     bullets: safePost.bullets || safeContent.bullets
  };

  const displayImage = safePost.image_url || safeContent.initialImageUrl || null;
  const displayCaption = safePost.caption || '';
  
  const isThemeMode = ['theme_pending', 'theme_approved_with_notes', 'theme_approved', 'theme_rejected'].includes(safePost.status);

  const getStatusLabel = (s?: string) => {
    const map: Record<string, string> = {
        'theme_pending': 'Tema para Aprovação',
        'theme_approved': 'Tema Aprovado',
        'theme_approved_with_notes': 'Tema Aprovado (Obs)',
        'theme_rejected': 'Tema Reprovado',
        'draft': 'Em Produção',
        'pending_approval': 'Esperando Aprovação',
        'changes_requested': 'Ajustes Solicitados',
        'rejected': 'Reprovado',
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
             <div className="flex items-center gap-4">
                {client?.logo_url ? (
                   <img src={client.logo_url} alt={client.name} className="h-20 w-auto object-contain mix-blend-multiply" />
                ) : (
                   <span className="text-3xl font-bold text-brand-dark tracking-tighter serif italic">{client?.name}</span>
                )}
                <div className="h-6 w-px bg-gray-100 hidden sm:block"></div>
                <div className="flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity duration-500">
                   <span className="text-[7px] uppercase tracking-[0.3em] text-gray-400 font-bold hidden lg:block">Strategy by</span>
                   <Logo size="small" />
                </div>
             </div>
             <div className="text-right">
                <span className="block text-[10px] text-gray-400 uppercase tracking-widest font-bold">Ambiente de Aprovação</span>
                {userName && <span className="text-xs font-bold text-blue-600">Olá, {userName}</span>}
             </div>
          </div>
       </header>

       <main className="flex-grow flex flex-col items-center p-4 sm:p-8">
          
          {lightboxOpen && lightboxImage && (
              <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setLightboxOpen(false)}>
                  <button className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors" onClick={() => setLightboxOpen(false)}>
                      <XCircle size={32} />
                  </button>
                  {typeof lightboxImage === 'string' && lightboxImage.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video src={lightboxImage} controls className="w-full h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
                  ) : (
                      <img src={lightboxImage as string} alt="Full size" className="w-full h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
                  )}
              </div>
          )}

          {successMessage ? (
             <div className="fixed inset-0 bg-[#FDFDFD] z-50 flex items-center justify-center p-6 text-center">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/5 rounded-full blur-[100px] pointer-events-none"></div>
                 <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
                     <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-green-200/50">
                         <CheckCircle2 size={48} className="text-green-600" />
                     </div>
                     <h2 className="text-4xl font-bold text-gray-900 tracking-tighter mb-4">Concluído!</h2>
                     <p className="text-lg text-gray-500 font-medium mb-12 px-8 leading-relaxed">
                        {successMessage}
                     </p>
                     <button 
                       onClick={() => setSuccessMessage('')}
                       className="px-8 py-4 bg-brand-dark hover:bg-black text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-[11px] transition-all shadow-xl shadow-brand-dark/20 flex items-center gap-3"
                     >
                        Voltar para Publicação
                     </button>
                 </div>
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
                           <button 
                               onClick={() => setActiveTab('tiktok')}
                               className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'tiktok' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                           >
                               <span className="font-bold">♪</span> TikTok
                           </button>
                       </div>
                   )}

                   <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 transition-all duration-300 relative group">
                      {isThemeMode ? (
                          <div className="bg-brand-dark rounded-xl p-8 border shadow-lg text-center h-full flex flex-col justify-center">
                              <div className="w-16 h-16 bg-white/10 flex items-center justify-center rounded-2xl mx-auto mb-6 border border-white/20">
                                  <AlertTriangle className="text-[#5DCAA5] w-8 h-8" />
                              </div>
                              <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-gray-400 mb-2">Proposta de Tema</h3>
                              <h4 className="font-serif text-2xl text-white mb-6 leading-tight">{safePost.theme || 'Sem tema definido'}</h4>
                              <div className="bg-white/5 p-5 rounded-2xl text-left border border-white/10 shadow-inner">
                                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{safePost.bullets?.join('\n') || 'Nenhuma descrição fornecida.'}</p>
                              </div>
                          </div>
                      ) : (
                          <>
                              <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">
                                 Clique para ampliar
                              </div>
                              {activeTab === 'linkedin' ? (
                                 <LinkedInView 
                                   dayContent={effectiveContent} 
                                   caption={displayCaption} 
                                   imageUrl={displayImage} 
                                   isVideo={!!isVideo} 
                                   videoThumbnailUrl={safePost.video_thumbnail_url}
                                   onImageClick={handleImageClick}
                                   client={client}
                                 />
                              ) : activeTab === 'tiktok' ? (
                                 <TikTokView
                                   dayContent={effectiveContent} 
                                   caption={displayCaption} 
                                   imageUrl={displayImage} 
                                   isVideo={!!isVideo} 
                                   videoThumbnailUrl={safePost.video_thumbnail_url}
                                   onImageClick={handleImageClick}
                                   client={client}
                                 />
                              ) : (
                                 <InstagramView 
                                   dayContent={effectiveContent} 
                                   caption={displayCaption} 
                                   imageUrl={displayImage} 
                                   isVideo={!!isVideo} 
                                   videoThumbnailUrl={safePost.video_thumbnail_url}
                                   onImageClick={handleImageClick}
                                   client={client}
                                 />
                              )}
                          </>
                      )}
                   </div>
                   
                   <div className="text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border 
                         ${safePost.status === 'theme_approved' ? 'bg-[#fce5ff] text-[#9333ea] border-[#f4cbf7]' : 
                           safePost.status === 'theme_pending' ? 'bg-gray-300 text-gray-800 border-gray-400' : 
                           safePost.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : 
                           ['theme_approved_with_notes', 'changes_requested'].includes(safePost.status) ? 'bg-orange-100 text-orange-700 border-orange-200' : 
                           ['rejected', 'theme_rejected'].includes(safePost.status) ? 'bg-red-100 text-red-700 border-red-200' : 
                           safePost.status === 'pending_approval' ? 'bg-amber-100 text-amber-700 border-amber-200' :
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
                      
                      {hasMultiple ? (
                          <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 font-medium text-center flex items-center justify-center gap-2">
                              <CheckCircle2 size={14} />
                              Esta aprovação se aplica a ambas as plataformas (Instagram e LinkedIn).
                          </div>
                      ) : (
                          <div className={`mb-6 p-3 border rounded-lg text-xs font-bold text-center flex items-center justify-center gap-2 ${primaryContent.platform === 'meta' ? 'bg-purple-50 border-purple-100 text-purple-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                              {primaryContent.platform === 'meta' ? <Instagram size={14} /> : <Linkedin size={14} />}
                              Publicação exclusiva para {primaryContent.platform === 'meta' ? 'Instagram' : 'LinkedIn'}.
                          </div>
                      )}

                      {!showCommentBox && !showNamePrompt && (
                         <div className="flex flex-col gap-3">
                            {isThemeMode ? (
                                <>
                                    <button 
                                      onClick={() => handleActionClick('approve')}
                                      className="w-full py-4 bg-[#5DCAA5] hover:bg-[#4BA88A] text-brand-dark rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                                    >
                                       <CheckCircle2 size={20} /> Aprovar Tema
                                    </button>
                                    <div className="flex gap-3">
                                        <button 
                                          onClick={() => handleActionClick('request_changes')}
                                          className="flex-1 py-4 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                        >
                                           <AlertTriangle size={20} /> Observação
                                        </button>
                                        <button 
                                          onClick={() => handleActionClick('reject')}
                                          className="flex-1 py-4 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                        >
                                           <XCircle size={20} /> Reprovar Tema
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <button 
                                      onClick={() => handleActionClick('approve')}
                                      className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                                    >
                                       <CheckCircle2 size={20} /> Aprovar Publicação
                                    </button>
                                    <div className="flex gap-3">
                                        <button 
                                          onClick={() => handleActionClick('request_changes')}
                                          className="flex-1 py-4 bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                        >
                                           <AlertTriangle size={20} /> Ajuste
                                        </button>
                                        <button 
                                          onClick={() => handleActionClick('reject')}
                                          className="flex-1 py-4 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                        >
                                           <XCircle size={20} /> Reprovar
                                        </button>
                                    </div>
                                </>
                            )}
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
                              placeholder={`Ex: ${client?.responsible || 'Wesley'}...`}
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
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                {pendingAction === 'reject' ? 'Qual a justificativa da reprovação?' : 'O que precisa ser ajustado?'}
                            </label>
                            <textarea 
                              autoFocus
                              value={comment}
                              onChange={e => setComment(e.target.value)}
                              placeholder={pendingAction === 'reject' ? "Justifique o motivo da reprovação..." : "Descreva o que gostaria de alterar..."}
                              className={`w-full h-32 p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 outline-none resize-none text-sm ${pendingAction === 'reject' ? 'focus:ring-red-500' : 'focus:ring-orange-500'}`}
                            />
                            <div className="flex gap-2">
                               <button 
                                 onClick={pendingAction === 'reject' ? submitReject : submitChanges} 
                                 disabled={!comment.trim() || submitting} 
                                 className={`flex-1 text-white py-2 rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2 ${pendingAction === 'reject' ? 'bg-red-600' : 'bg-orange-600'}`}
                               >
                                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                                  {pendingAction === 'reject' ? 'Enviar Reprovação' : 'Enviar Solicitação'}
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


import React, { useState, useEffect, useRef } from 'react';
import { DailyContent, PostData, PostComment, PostStatus } from '../types';
import { useAuth, supabase } from '../lib/supabase';
import { X, Send, Image as ImageIcon, CheckCircle2, AlertTriangle, MessageCircle, Clock, Save, Eye, UploadCloud, Trash2, History, Lock, Globe, Edit3, RefreshCw, FileVideo, Heart, Bookmark, MoreHorizontal, Share2, Link, Copy, Check, LayoutTemplate, Calendar, Facebook, Linkedin } from 'lucide-react';
import { InstagramView, LinkedInView } from './PlatformViews';

interface PostModalProps {
  dayContent: DailyContent;
  dateKey: string;
  onClose: () => void;
  onUpdate?: () => void;
  isNew?: boolean; // Se é um post sendo criado do zero
  defaultDate?: string; // Data YYYY-MM-DD para pré-preencher
}

const POST_TYPES = [
  "Vídeo (Reel - Produto)",
  "Vídeo (Reel - Informação)",
  "Texto técnico",
  "Texto analítico",
  "Texto consultivo",
  "Estático",
  "Estático técnico",
  "Estático institucional",
  "Carrossel",
  "Carrossel educacional",
  "Carrossel técnico"
];

export const PostModal: React.FC<PostModalProps> = ({ dayContent, dateKey, onClose, onUpdate, isNew = false, defaultDate = '' }) => {
  const { userRole } = useAuth();
  const canComment = true; 
  const commentsEndRef = useRef<HTMLDivElement>(null);
  
  // Data States
  const [post, setPost] = useState<PostData | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Interaction States
  const [showRequestChangesInput, setShowRequestChangesInput] = useState(false);
  
  // Content States
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState(dayContent.initialImageUrl || '');
  
  // Structure Overrides
  const [editedTheme, setEditedTheme] = useState(dayContent.theme);
  const [editedType, setEditedType] = useState(dayContent.type);
  const [editedBullets, setEditedBullets] = useState(dayContent.bullets ? dayContent.bullets.join('\n') : '');
  
  // NEW: Date & Platform (For Move/Create)
  const [postDate, setPostDate] = useState(''); // YYYY-MM-DD
  const [platform, setPlatform] = useState<'meta' | 'linkedin'>('meta');

  const [newComment, setNewComment] = useState('');

  // Initializer
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      
      // Setup Initial Date & Platform from Key or Defaults
      if (isNew) {
         setPostDate(defaultDate);
         setPlatform(dayContent.platform);
         setIsEditing(true); // Force edit mode for new posts
      } else {
         // Key format: DD-MM-YYYY-platform
         if (dateKey !== 'new') {
             const parts = dateKey.split('-');
             if (parts.length >= 3) {
                 const [d, m, y] = parts;
                 setPostDate(`${y}-${m}-${d}`);
             }
         }
         setPlatform(dayContent.platform);
      }

      if (!isNew) {
        // Fetch existing data
        const { data: postData } = await supabase
            .from('posts')
            .select('*')
            .eq('date_key', dateKey)
            .single();

        if (postData) {
            setPost(postData);
            setCaption(postData.caption || '');
            setImageUrl(postData.image_url || dayContent.initialImageUrl || '');
            setEditedTheme(postData.theme || dayContent.theme);
            setEditedType(postData.type || dayContent.type);
            setEditedBullets(postData.bullets ? postData.bullets.join('\n') : (dayContent.bullets ? dayContent.bullets.join('\n') : ''));
            
            if (userRole === 'admin' && (!postData.caption && !postData.image_url)) {
               setIsEditing(true);
            }
        } else {
            // New "Draft" based on static
            const newPost = {
                date_key: dateKey,
                status: 'draft' as PostStatus,
                image_url: dayContent.initialImageUrl || null,
                caption: null,
                last_updated: new Date().toISOString()
            };
            setPost(newPost as PostData);
            setImageUrl(dayContent.initialImageUrl || '');
            if (userRole === 'admin') setIsEditing(true);
        }

        // Comments
        const { data: commentsData } = await supabase
            .from('comments')
            .select('*')
            .eq('post_id', dateKey)
            .order('created_at', { ascending: true });
        if (commentsData) setComments(commentsData as PostComment[]);
      } else {
          // It's a brand new post creation
          const dummyPost = {
             date_key: 'temp',
             status: 'draft' as PostStatus,
             last_updated: new Date().toISOString()
          };
          setPost(dummyPost as PostData);
      }
      setLoading(false);
    };
    init();
  }, [dateKey, dayContent, isNew, defaultDate, userRole]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);


  // Actions
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `upload-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('post-uploads').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('post-uploads').getPublicUrl(fileName);
      setImageUrl(data.publicUrl);
    } catch (error) {
      alert('Erro no upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}?mode=public&id=${dateKey}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSavePost = async () => {
    if (!postDate) {
        alert("Por favor, selecione uma data.");
        return;
    }

    try {
      setLoading(true);

      // 1. Generate Target Key
      const [y, m, d] = postDate.split('-');
      const newKey = `${d}-${m}-${y}-${platform}`;

      // 2. Logic for MOVE or CREATE
      const isMove = !isNew && newKey !== dateKey;

      if (isMove) {
          if (confirm(`Atenção: Você está alterando a data ou a plataforma.\nDeseja mover este post para ${d}/${m} (${platform})?`)) {
             
             // A. MARK OLD KEY AS DELETED
             // Isso é crucial: se não marcarmos o antigo como deleted, 
             // o sistema vai renderizar o conteúdo estático original naquele dia (duplicação).
             const { error: deleteError } = await supabase.from('posts').upsert({
                 date_key: dateKey,
                 status: 'deleted',
                 last_updated: new Date().toISOString()
             });
             
             if (deleteError) throw deleteError;
             
          } else {
              setLoading(false);
              return;
          }
      }

      // 3. Determine Status
      let statusToSave: PostStatus = post?.status || 'draft';
      
      // Se estava deletado e estamos salvando, reativa como rascunho
      if (statusToSave === 'deleted') statusToSave = 'draft';

      if (statusToSave !== 'approved' && statusToSave !== 'published') {
         const hasCreative = (imageUrl && imageUrl !== dayContent.initialImageUrl) || (caption && caption.trim().length > 0);
         statusToSave = hasCreative ? 'pending_approval' : 'draft';
      }

      const payload = {
        date_key: newKey,
        image_url: imageUrl,
        caption: caption,
        status: statusToSave,
        theme: editedTheme,
        type: editedType,
        bullets: editedBullets.split('\n').filter(l => l.trim() !== ''),
        last_updated: new Date().toISOString()
      };

      const { error } = await supabase
        .from('posts')
        .upsert(payload, { onConflict: 'date_key' });

      if (error) throw error;

      // Update Local State
      setPost(prev => ({ ...prev, ...payload } as PostData));

      if (onUpdate) onUpdate();
      
      // Se foi um movimento (troca de data), fecha o modal pois o contexto mudou
      if (isMove) {
          onClose();
      } else {
          // Se foi só edição, fecha o modo de edição mas mantem preview
          setIsEditing(false);
      }

    } catch (error) {
      console.error(error);
      alert('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async () => {
      if (!confirm("Tem certeza que deseja excluir esta publicação?")) return;
      try {
          setLoading(true);
          
          // Soft delete logic: Explicitly upsert status = 'deleted' to current key
          const { error } = await supabase.from('posts').upsert({
              date_key: dateKey,
              status: 'deleted',
              last_updated: new Date().toISOString()
          }, { onConflict: 'date_key' });

          if (error) throw error;

          if (onUpdate) onUpdate();
          onClose(); // Fecha o modal após excluir
      } catch (e) {
          console.error(e);
          alert("Erro ao excluir. Tente novamente.");
      } finally {
          setLoading(false);
      }
  };

  // --- DELETE COMMENT LOGIC ---
  const handleDeleteComment = async (commentId: string) => {
      if (!confirm("Excluir este comentário permanentemente?")) return;
      try {
          const { error } = await supabase.from('comments').delete().eq('id', commentId);
          if (error) throw error;
          // Update local state
          setComments(prev => prev.filter(c => c.id !== commentId));
      } catch (err) {
          alert('Erro ao excluir comentário.');
          console.error(err);
      }
  };
  
  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    
    const newCommentObj = { 
        post_id: dateKey, 
        author_role: userRole, 
        author_name: userRole === 'admin' ? 'Canguru' : userRole === 'approver' ? 'Viviane' : 'Equipe', 
        content: newComment, 
        visible_to_admin: true 
    };

    try {
        const { data: savedComment, error } = await supabase
            .from('comments')
            .insert(newCommentObj)
            .select()
            .single();

        if (error) throw error;

        if (userRole === 'approver') {
            await supabase.from('posts').update({ status: 'changes_requested' }).eq('date_key', dateKey);
        }

        // Add real comment to state
        if (savedComment) {
            setComments(prev => [...prev, savedComment as PostComment]);
        }

        setNewComment('');
        if (onUpdate) onUpdate();
        
    } catch (err) {
        console.error(err);
        alert('Erro ao enviar comentário.');
    }
  };

  const handleApprove = async () => {
      await supabase.from('posts').update({ status: 'approved' }).eq('date_key', dateKey);
      setPost(prev => ({ ...prev!, status: 'approved' }));
      if (onUpdate) onUpdate();
  };
  const handlePublish = async () => {
    if(confirm('Marcar como publicado?')) {
        await supabase.from('posts').update({ status: 'published' }).eq('date_key', dateKey);
        setPost(prev => ({ ...prev!, status: 'published' }));
        if (onUpdate) onUpdate();
    }
  };

  // Helper Translation
  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = {
        'draft': 'Rascunho',
        'pending_approval': 'Em Aprovação',
        'changes_requested': 'Ajustes Solicitados',
        'internal_review': 'Discussão Interna',
        'approved': 'Aprovado',
        'published': 'Publicado',
        'deleted': 'Excluído'
    };
    return map[s] || s;
  };

  // Helper consts
  const isVideo = imageUrl?.match(/\.(mp4|webm|ogg)$/i);
  const effectiveDayContent = { ...dayContent, theme: editedTheme, type: editedType, bullets: editedBullets ? editedBullets.split('\n') : [] };
  // Use state platform if creating/editing, otherwise dayContent platform
  const currentPlatform = (isNew || isEditing) ? platform : dayContent.platform;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-[98%] xl:max-w-[90rem] h-[95vh] rounded-xl shadow-2xl relative z-10 flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <button onClick={onClose} className="absolute top-3 right-3 z-50 p-2 bg-white rounded-full text-gray-500 hover:text-red-500 shadow-md border border-gray-100 transition-colors"><X size={20} /></button>

        {/* LEFT: Preview */}
        <div className="w-full md:w-[60%] bg-gray-100 flex flex-col border-r border-gray-200 overflow-y-auto custom-scrollbar relative">
           <div className="sticky top-0 z-20 w-full p-4 flex justify-between items-start pointer-events-none">
                <div className="flex gap-2">
                    {/* TRADUÇÃO DO STATUS AQUI */}
                    {!isNew && <span className="pointer-events-auto px-4 py-1.5 rounded-full text-xs font-bold border uppercase bg-white shadow-sm text-gray-600">
                        {getStatusLabel(post?.status || 'draft')}
                    </span>}
                </div>
           </div>
           <div className="flex-grow p-6 sm:p-10 flex items-start justify-center">
             <div className="w-full max-w-lg">
                {currentPlatform === 'linkedin' ? (
                  <LinkedInView dayContent={effectiveDayContent} caption={caption} imageUrl={imageUrl} isVideo={!!isVideo} isUploading={isUploading} />
                ) : (
                  <InstagramView dayContent={effectiveDayContent} caption={caption} imageUrl={imageUrl} isVideo={!!isVideo} isUploading={isUploading} />
                )}
             </div>
           </div>
        </div>

        {/* RIGHT: Edit */}
        <div className="w-full md:w-[40%] flex flex-col h-full bg-white relative border-l border-gray-200">
           
           {/* Added pr-12 to prevent overlap with the absolute Close X button */}
           <div className="p-5 border-b border-gray-100 flex flex-col gap-4 bg-gray-50/50 pr-12">
              <div className="flex justify-between items-start">
                 <div>
                    {isNew ? (
                        <h2 className="font-bold text-gray-900 text-lg">Criar Nova Publicação</h2>
                    ) : (
                        <h2 className="font-bold text-gray-900 text-lg">{effectiveDayContent.day.split(' ')[0]}</h2>
                    )}
                    <span className="text-xs text-gray-500 uppercase font-medium">{currentPlatform}</span>
                 </div>
                 {userRole === 'admin' && (
                     <div className="flex gap-2">
                        {/* Copy Link Button - RESTORED */}
                        {!isNew && (
                            <button 
                                onClick={handleCopyLink}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded border border-gray-200 transition-all"
                                title="Copiar Link de Aprovação Público"
                            >
                                {copiedLink ? <Check size={16} className="text-green-600" /> : <Link size={16} />}
                            </button>
                        )}

                        {!isNew && (
                            <button onClick={handleDeletePost} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-all" title="Excluir Post">
                                <Trash2 size={16} />
                            </button>
                        )}
                        <button onClick={() => setIsEditing(!isEditing)} className={`text-xs font-bold px-4 py-2 rounded border flex items-center gap-2 transition-colors ${isEditing ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100 shadow-sm'}`}>
                            <Edit3 size={14} /> {isEditing ? 'Concluir' : 'Editar'}
                        </button>
                     </div>
                 )}
              </div>
              
              {/* Approver Actions */}
              {userRole === 'approver' && !isNew && (
                  <div className="flex gap-3">
                      {!showRequestChangesInput && (
                        <>
                        <button onClick={handleApprove} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm shadow-sm"><CheckCircle2 size={18} /> Aprovar</button>
                        <button onClick={() => setShowRequestChangesInput(true)} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold text-sm"><AlertTriangle size={18} /> Ajuste</button>
                        </>
                      )}
                      {showRequestChangesInput && (
                        <div className="flex items-center justify-between w-full bg-red-50 text-red-800 px-3 py-2 rounded border border-red-100 text-sm">
                            <span className="font-bold">Escreva o ajuste abaixo</span>
                            <button onClick={() => setShowRequestChangesInput(false)} className="text-xs underline">Cancelar</button>
                        </div>
                      )}
                  </div>
              )}
           </div>

           <div className="flex-grow flex flex-col overflow-hidden">
             {userRole === 'admin' && isEditing && (
                 <div className="p-5 border-b border-gray-100 bg-blue-50/30 overflow-y-auto max-h-[60%] custom-scrollbar">
                    
                    {/* Metadata Edit (Date/Platform) */}
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm mb-4">
                        <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-1"><Calendar size={14} /> Agendamento</h3>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Data</label>
                                <input type="date" value={postDate} onChange={e => setPostDate(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Plataforma</label>
                                {/* Platform Switcher Always Available in Edit Mode */}
                                <div className="flex gap-2">
                                    <button onClick={() => setPlatform('meta')} className={`flex-1 flex items-center justify-center p-2 rounded border ${platform === 'meta' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white'}`}><Facebook size={16}/></button>
                                    <button onClick={() => setPlatform('linkedin')} className={`flex-1 flex items-center justify-center p-2 rounded border ${platform === 'linkedin' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white'}`}><Linkedin size={16}/></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm mb-4">
                       <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-1"><LayoutTemplate size={14} /> Estrutura</h3>
                       <div className="mb-3">
                          <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Tema</label>
                          <input type="text" value={editedTheme} onChange={(e) => setEditedTheme(e.target.value)} className="w-full text-sm p-2.5 border border-gray-200 rounded focus:border-blue-500 outline-none" />
                       </div>
                       <div className="mb-3">
                          <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Formato</label>
                          <select value={editedType} onChange={(e) => setEditedType(e.target.value)} className="w-full text-sm p-2.5 border border-gray-200 rounded focus:border-blue-500 outline-none bg-white">
                             {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                       </div>
                       <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Bullets</label>
                          <textarea value={editedBullets} onChange={(e) => setEditedBullets(e.target.value)} rows={3} className="w-full text-sm p-2.5 border border-gray-200 rounded focus:border-blue-500 outline-none resize-none" />
                       </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm mb-4">
                        <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-1"><ImageIcon size={14} /> Criativo</h3>
                        <label className={`h-16 border-2 border-dashed border-blue-200 bg-gray-50 hover:bg-blue-50 rounded-lg flex flex-row items-center justify-center gap-3 cursor-pointer mb-3 ${isUploading ? 'opacity-50' : ''}`}>
                              <input type="file" accept="image/*,video/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                              <UploadCloud size={20} className="text-blue-400" />
                              <span className="text-xs text-blue-800 font-bold">{isUploading ? 'Enviando...' : 'Upload Mídia'}</span>
                        </label>
                        <textarea 
                            placeholder="Legenda da publicação..." 
                            value={caption} 
                            onChange={e => setCaption(e.target.value)} 
                            className="w-full h-64 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed" 
                        />
                    </div>

                    <button onClick={handleSavePost} disabled={loading} className="w-full text-sm font-bold bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2">
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} Salvar Publicação
                    </button>
                 </div>
             )}

             {/* Comments List */}
             {!isNew && (
                 <div className="flex-grow overflow-y-auto p-5 bg-gray-50 custom-scrollbar flex flex-col gap-4">
                     {comments.map((comment) => (
                        <div key={comment.id} className={`flex gap-2 max-w-[90%] ${comment.author_role === 'admin' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0 ${comment.author_role === 'admin' ? 'bg-brand-dark' : comment.author_role === 'approver' ? 'bg-green-600' : 'bg-purple-600'}`}>{comment.author_name.charAt(0)}</div>
                           <div className={`p-3 rounded-xl text-sm shadow-sm relative group ${comment.author_role === 'admin' ? 'bg-white rounded-tr-none' : comment.author_role === 'approver' ? 'bg-green-100 text-green-900 rounded-tl-none' : 'bg-purple-100 rounded-tl-none'}`}>
                              <p>{comment.content}</p>
                              {/* DELETE BUTTON FOR ADMIN */}
                              {userRole === 'admin' && (
                                <button 
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-red-500 rounded-full p-1 shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Excluir comentário"
                                >
                                    <Trash2 size={12} />
                                </button>
                              )}
                           </div>
                        </div>
                     ))}
                     <div ref={commentsEndRef} />
                 </div>
             )}

             {/* Comment Input */}
             {(!isNew && canComment) && (
                <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                    <div className="relative flex items-center gap-2">
                        <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Comentário..." className="flex-grow pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" onKeyDown={e => e.key === 'Enter' && handleSendComment()} autoFocus={showRequestChangesInput} />
                        <button onClick={handleSendComment} disabled={!newComment.trim()} className="absolute right-2 p-2 bg-brand-dark text-white rounded-lg"><Send size={16} /></button>
                    </div>
                </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

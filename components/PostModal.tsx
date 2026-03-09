
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DailyContent, PostData, PostComment, PostStatus } from '../types';
import { useAuth, supabase, parseImageUrl, stringifyImageUrl } from '../lib/supabase';
import { X, Send, Image as ImageIcon, CheckCircle2, AlertTriangle, Save, UploadCloud, Trash2, Edit3, RefreshCw, Link, Check, Calendar, Instagram, Linkedin, ChevronDown, Layers, Copy, LayoutTemplate } from 'lucide-react';
import { InstagramView, LinkedInView } from './PlatformViews';

interface PostModalProps {
  dayContent: DailyContent;
  dateKey: string;
  onClose: () => void;
  onUpdate?: () => void;
  isNew?: boolean; 
  defaultDate?: string; 
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

const STATUS_OPTIONS: { value: PostStatus; label: string }[] = [
    { value: 'draft', label: 'Rascunho' },
    { value: 'pending_approval', label: 'Em Aprovação' },
    { value: 'changes_requested', label: 'Ajustes Solicitados' },
    { value: 'approved', label: 'Aprovado' },
    { value: 'scheduled', label: 'Programado' },
    { value: 'published', label: 'Publicado' }
];

export const PostModal: React.FC<PostModalProps> = ({ dayContent, dateKey, onClose, onUpdate, isNew = false, defaultDate = '' }) => {
  const { userRole, activeClient } = useAuth();
  const canComment = !!userRole;
  const commentsEndRef = useRef<HTMLDivElement>(null);
  
  // Data States
  const [post, setPost] = useState<PostData | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  
  // Para gerenciar mudança de data (evitar duplicação)
  const [originalKeys, setOriginalKeys] = useState<string[]>([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Interaction States
  const [showRequestChangesInput, setShowRequestChangesInput] = useState(false);
  
  // Multi-Platform & Caption Logic
  const [selectedPlatforms, setSelectedPlatforms] = useState<('meta' | 'linkedin')[]>([]);
  const [previewPlatform, setPreviewPlatform] = useState<'meta' | 'linkedin'>('meta'); // Qual está sendo visualizada na esquerda
  
  const [useDifferentCaptions, setUseDifferentCaptions] = useState(false);
  const [captionMeta, setCaptionMeta] = useState('');
  const [captionLinkedin, setCaptionLinkedin] = useState('');
  
  // Content States (Shared)
  const [imageUrl, setImageUrl] = useState<string | string[]>(dayContent.initialImageUrl || '');
  const [isDragging, setIsDragging] = useState(false);
  
  // Structure Overrides (Shared)
  const [editedTheme, setEditedTheme] = useState(dayContent.theme);
  const [editedType, setEditedType] = useState(dayContent.type);
  const [editedBullets, setEditedBullets] = useState(dayContent.bullets ? dayContent.bullets.join('\n') : '');
  
  // Date State
  const [postDate, setPostDate] = useState(''); // YYYY-MM-DD
  
  // Manual Status Change
  const [manualStatus, setManualStatus] = useState<PostStatus>('draft');
  const [newComment, setNewComment] = useState('');

  // --------------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------------
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      
      // 1. Setup Base Date
      let currentY = '', currentM = '', currentD = '';

      if (isNew) {
         setPostDate(defaultDate);
         setSelectedPlatforms([dayContent.platform]);
         setPreviewPlatform(dayContent.platform);
         setIsEditing(true);
         setManualStatus('draft');
         setOriginalKeys([]); // Novo post não tem chaves antigas
         
         // Dummy post for new
         setPost({ date_key: 'temp', status: 'draft', last_updated: new Date().toISOString() } as PostData);
      } else {
         // Existing Post Logic
         if (dateKey !== 'new') {
             const parts = dateKey.split('-'); // DD-MM-YYYY-platform[-suffix]
             if (parts.length >= 3) {
                 [currentD, currentM, currentY] = parts;
                 const pad = (n: string) => n.length === 1 ? `0${n}` : n;
                 setPostDate(`${currentY}-${pad(currentM)}-${pad(currentD)}`);
             }
         }

         // Load MAIN post data
         const { data: mainPostData } = await supabase
            .from('posts')
            .select('*')
            .eq('date_key', dateKey)
            .eq('client_id', activeClient?.id)
            .maybeSingle();

         // Load COUNTERPART post data (se abri o Meta, tenta achar o Linkedin do mesmo dia)
         // A chave counterpart tem a mesma estrutura, só muda a plataforma
         // Nota: Isso assume chave padrão DD-MM-YYYY-platform. Se tiver sufixo numérico (posts extras), não busca automático.
         const currentPlat = dateKey.includes('linkedin') ? 'linkedin' : 'meta';
         const otherPlat = currentPlat === 'linkedin' ? 'meta' : 'linkedin';
         const baseKey = `${currentD}-${currentM}-${currentY}`;
         const otherKey = `${baseKey}-${otherPlat}`;

         const { data: otherPostData } = await supabase
            .from('posts')
            .select('*')
            .eq('date_key', otherKey)
            .eq('client_id', activeClient?.id)
            .maybeSingle();

         // Populate State
         const primaryData = mainPostData || { 
             date_key: dateKey, status: 'draft', image_url: dayContent.initialImageUrl, theme: dayContent.theme, type: dayContent.type, bullets: dayContent.bullets 
         };

         setPost(primaryData as PostData);
         setManualStatus(primaryData.status);
         
         const parsedUrl = parseImageUrl(primaryData.image_url || dayContent.initialImageUrl || '');
         setImageUrl(parsedUrl || '');
         
         setEditedTheme(primaryData.theme || dayContent.theme);
         setEditedType(primaryData.type || dayContent.type);
         setEditedBullets(primaryData.bullets ? primaryData.bullets.join('\n') : (dayContent.bullets ? dayContent.bullets.join('\n') : ''));
         
         // Captions & Platforms
         const platformsFound: ('meta' | 'linkedin')[] = [currentPlat];
         let metaCap = '';
         let linkedCap = '';

         // Guardar chaves originais para caso de "Move" (Alteração de data)
         const foundKeys = [dateKey];

         if (currentPlat === 'meta') {
             metaCap = primaryData.caption || '';
         } else {
             linkedCap = primaryData.caption || '';
         }

         if (otherPostData && otherPostData.status !== 'deleted') {
             platformsFound.push(otherPlat);
             if (otherPlat === 'meta') metaCap = otherPostData.caption || '';
             else linkedCap = otherPostData.caption || '';
             foundKeys.push(otherPostData.date_key);
         }
         
         setOriginalKeys(foundKeys); // Armazena chaves originais
         setSelectedPlatforms(platformsFound);
         setCaptionMeta(metaCap);
         setCaptionLinkedin(linkedCap);
         setPreviewPlatform(currentPlat);

         // Check if captions are different
         if (platformsFound.length > 1 && metaCap !== linkedCap && (metaCap || linkedCap)) {
             setUseDifferentCaptions(true);
         } else {
             // Se forem iguais, coloca no input do Meta e usa ele como "Geral"
             setCaptionMeta(metaCap || linkedCap);
             setUseDifferentCaptions(false);
         }

         // Fetch Comments
         const { data: commentsData } = await supabase
            .from('comments')
            .select('*')
            .eq('post_id', dateKey)
            .order('created_at', { ascending: true });
         if (commentsData) setComments(commentsData as PostComment[]);
         
         if (userRole === 'admin' && (!primaryData.caption && !primaryData.image_url)) {
             setIsEditing(true);
         }
      }
      setLoading(false);
    };
    init();
  }, [dateKey, dayContent, isNew, defaultDate, userRole]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);


  // --------------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------------

  const togglePlatform = (p: 'meta' | 'linkedin') => {
      if (selectedPlatforms.includes(p)) {
          // Prevent removing the last one
          if (selectedPlatforms.length > 1) {
              const newPlats = selectedPlatforms.filter(x => x !== p);
              setSelectedPlatforms(newPlats);
              // Switch preview if we removed the active one
              if (previewPlatform === p) {
                  setPreviewPlatform(newPlats[0]);
              }
          }
      } else {
          setSelectedPlatforms([...selectedPlatforms, p]);
      }
  };

  const processFiles = async (files: FileList | File[]) => {
      if (!files || files.length === 0) return;
      
      try {
          setIsUploading(true);
          const uploadedUrls: string[] = [];
          
          // Limit to 20 images if carousel
          const isCarousel = editedType.toLowerCase().includes('carrossel');
          const maxFiles = isCarousel ? 20 : 1;
          const filesToProcess = Array.from(files).slice(0, maxFiles);

          for (const file of filesToProcess) {
              const fileExt = file.name.split('.').pop();
              const fileName = `upload-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
              const { error } = await supabase.storage.from('post-uploads').upload(fileName, file);
              if (error) throw error;
              const { data } = supabase.storage.from('post-uploads').getPublicUrl(fileName);
              uploadedUrls.push(data.publicUrl);
          }

          if (isCarousel) {
              // If it's a carousel, we append or replace? 
              // User said "já ficar na sequência", implies replacing or setting the list.
              // Let's replace for now to keep it simple and consistent with drag-drop behavior.
              // Or if dragging multiple, we just set them.
              setImageUrl(uploadedUrls);
          } else {
              // Single image
              setImageUrl(uploadedUrls[0]);
          }

      } catch (error) {
          alert('Erro no upload.');
          console.error(error);
      } finally {
          setIsUploading(false);
          setIsDragging(false);
      }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        await processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          await processFiles(e.dataTransfer.files);
      }
  };

  const handleSavePost = async () => {
    if (!postDate) {
        alert("Por favor, selecione uma data.");
        return;
    }

    try {
      setLoading(true);
      const [y, m, d] = postDate.split('-');
      
      // Determine base status
      let statusToSave: PostStatus = manualStatus;
      if (userRole !== 'admin' || !isEditing) {
          statusToSave = post?.status || 'draft';
          if (statusToSave === 'deleted') statusToSave = 'draft';
          if (!['approved', 'published', 'scheduled'].includes(statusToSave)) {
            const hasCreative = (imageUrl && imageUrl !== dayContent.initialImageUrl) || (captionMeta && captionMeta.trim().length > 0);
            statusToSave = hasCreative ? 'pending_approval' : 'draft';
          }
      }
      if (userRole === 'admin' && isEditing) {
          statusToSave = manualStatus;
      }

      // --- CHECAGEM DE MUDANÇA DE DATA (MOVER POST) ---
      // Se não é novo, verificamos se a data mudou comparando com a dateKey original
      let dateChanged = false;
      if (!isNew && originalKeys.length > 0) {
          // Extrair a parte da data da primeira chave original (formato DD-MM-YYYY-...)
          const originalDateParts = originalKeys[0].split('-').slice(0, 3);
          // Normalizar para inteiros para evitar problemas com zeros à esquerda (ex: 05 vs 5)
          const originalDateStr = originalDateParts.map(p => parseInt(p)).join('-');
          const newDateStr = `${parseInt(d)}-${parseInt(m)}-${parseInt(y)}`;

          if (originalDateStr !== newDateStr) {
              dateChanged = true;
              // A Data Mudou! Precisamos "deletar" os posts da data antiga.
              // Percorre todas as chaves originais (ex: Meta e LinkedIn da data antiga) e marca como deleted
              for (const oldKey of originalKeys) {
                  await supabase.from('posts').upsert({
                      date_key: oldKey,
                      client_id: activeClient?.id,
                      status: 'deleted',
                      last_updated: new Date().toISOString()
                  }, { onConflict: 'date_key' });
              }
          }
      }

      // Loop through selected platforms and save independently
      for (const plat of selectedPlatforms) {
          // Generate key logic
          let targetKey = `${d}-${m}-${y}-${plat}`;
          
          // Se for NEW ou se a DATA MUDOU, adiciona timestamp pra evitar colisão e garantir unicidade
          // Isso resolve o problema de sobrescrever posts existentes no destino
          if (isNew || dateChanged) {
             targetKey = `${targetKey}-${Date.now()}`;
          } else {
              // Se estamos editando e a data for a mesma, tentamos preservar a chave original 
              // (para o caso de posts com sufixos).
              
              const existingKeyForPlat = originalKeys.find(k => k.includes(plat));
              
              if (existingKeyForPlat) {
                  targetKey = existingKeyForPlat;
              }
          }

          // Determine Caption
          let finalCaption = captionMeta;
          if (useDifferentCaptions) {
              finalCaption = plat === 'meta' ? captionMeta : captionLinkedin;
          }

          const payload = {
            date_key: targetKey,
            client_id: activeClient?.id,
            image_url: stringifyImageUrl(imageUrl),
            caption: finalCaption,
            status: statusToSave,
            theme: editedTheme,
            type: editedType,
            bullets: editedBullets.split('\n').filter(l => l.trim() !== ''),
            last_updated: new Date().toISOString()
          };

          const { error } = await supabase.from('posts').upsert(payload, { onConflict: 'date_key' });
          if (error) throw error;

          // --- MIGRAÇÃO DE COMENTÁRIOS ---
          // Se a data mudou, precisamos mover os comentários da chave antiga para a nova
          if (dateChanged && !isNew) {
              const oldKeyForPlat = originalKeys.find(k => k.includes(plat));
              if (oldKeyForPlat) {
                  await supabase.from('comments')
                      .update({ post_id: targetKey })
                      .eq('post_id', oldKeyForPlat);
              }
          }
      }

      // Update Local State for immediate feedback (Partial)
      setPost(prev => ({ ...prev, status: statusToSave } as PostData));

      if (onUpdate) onUpdate();
      
      // Close or Exit Edit
      if (isNew || (dateKey !== 'new' && postDate !== dateKey.split('-').slice(0,3).reverse().join('-'))) {
          onClose(); // Se mudou data ou é novo, fecha
      } else {
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
          // Se houver múltiplas (grupo), deleta todas
          const keysToDelete = originalKeys.length > 0 ? originalKeys : [dateKey];
          
          for (const k of keysToDelete) {
             const { error } = await supabase.from('posts').upsert({
                date_key: k,
                client_id: activeClient?.id,
                status: 'deleted',
                last_updated: new Date().toISOString()
             }, { onConflict: 'date_key' });
             if (error) throw error;
          }

          if (onUpdate) onUpdate();
          onClose(); 
      } catch (e) {
          console.error(e);
          alert("Erro ao excluir.");
      } finally {
          setLoading(false);
      }
  };

  // --- COMMENT LOGIC ---
  const handleDeleteComment = async (commentId: string) => {
      if (!confirm("Excluir comentário?")) return;
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (!error) setComments(prev => prev.filter(c => c.id !== commentId));
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
    const { data, error } = await supabase.from('comments').insert(newCommentObj).select().single();
    if (!error && data) {
        setComments(prev => [...prev, data as PostComment]);
        setNewComment('');
        if (userRole === 'approver') {
             await supabase.from('posts').update({ status: 'changes_requested' }).eq('date_key', dateKey);
             if (onUpdate) onUpdate();
        }
    }
  };

  const handleApprove = async () => {
      await supabase.from('posts').update({ status: 'approved' }).eq('date_key', dateKey).eq('client_id', activeClient?.id);
      setPost(prev => ({ ...prev!, status: 'approved' }));
      if (onUpdate) onUpdate();
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}?mode=public&id=${dateKey}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // --------------------------------------------------------------------------------
  // RENDER HELPERS
  // --------------------------------------------------------------------------------

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = {
        'draft': 'Rascunho',
        'pending_approval': 'Em Aprovação',
        'changes_requested': 'Ajustes Solicitados',
        'internal_review': 'Discussão Interna',
        'approved': 'Aprovado',
        'scheduled': 'Programado',
        'published': 'Publicado',
        'deleted': 'Excluído'
    };
    return map[s] || s;
  };

  const isVideo = typeof imageUrl === 'string' ? imageUrl.match(/\.(mp4|webm|ogg)$/i) : false;
  const effectiveDayContent = { ...dayContent, theme: editedTheme, type: editedType, bullets: editedBullets ? editedBullets.split('\n') : [] };
  
  // Determine which caption to show in Preview
  const previewCaption = (previewPlatform === 'meta' || !useDifferentCaptions) ? captionMeta : captionLinkedin;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4">
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
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-[#fcfbf9] w-full max-w-[98%] xl:max-w-[95rem] h-[95vh] rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.25)] relative z-10 flex flex-col md:flex-row overflow-hidden border border-white/20"
      >
        {/* Background Decorations inside Modal */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-30">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-50 rounded-full blur-[100px]"></div>
        </div>
        
        <button onClick={onClose} className="absolute top-6 right-6 z-50 p-3 bg-white/80 backdrop-blur-md rounded-full text-gray-400 hover:text-red-500 shadow-xl border border-white/50 transition-all hover:scale-110 active:scale-95"><X size={20} /></button>

        {/* ================= LEFT: PREVIEW ================= */}
        <div className="w-full md:w-[65%] bg-[#1a1c20] flex flex-col border-r border-white/5 overflow-y-auto custom-scrollbar relative">
           
           {/* Header: Status + Preview Tabs */}
           <div className="sticky top-0 z-20 w-full p-6 flex justify-between items-start pointer-events-none">
                <div className="flex gap-3">
                    {!isNew && (
                      <div className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold border uppercase bg-white/10 backdrop-blur-md border-white/10 shadow-xl text-white tracking-widest">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                          post?.status === 'approved' ? 'bg-green-400' : 
                          post?.status === 'published' ? 'bg-blue-400' : 
                          post?.status === 'changes_requested' ? 'bg-red-400' : 'bg-yellow-400'
                        }`} />
                        {getStatusLabel(post?.status || 'draft')}
                      </div>
                    )}
                </div>
                
                {/* Preview Toggles (Only if both selected) */}
                {selectedPlatforms.length > 1 && (
                    <div className="pointer-events-auto bg-white/5 backdrop-blur-md p-1.5 rounded-xl shadow-2xl border border-white/10 flex gap-1.5">
                        <button 
                            onClick={() => setPreviewPlatform('meta')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2 transition-all tracking-widest uppercase ${previewPlatform === 'meta' ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                        >
                            <Instagram size={14} /> Instagram
                        </button>
                        <button 
                            onClick={() => setPreviewPlatform('linkedin')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2 transition-all tracking-widest uppercase ${previewPlatform === 'linkedin' ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                        >
                            <Linkedin size={14} /> LinkedIn
                        </button>
                    </div>
                )}
           </div>

           <div className="flex-grow p-8 sm:p-16 flex items-center justify-center">
             <div className="w-full max-w-lg transition-all duration-500 transform hover:scale-[1.01]">
                {previewPlatform === 'linkedin' ? (
                  <LinkedInView dayContent={effectiveDayContent} caption={previewCaption} imageUrl={imageUrl} isVideo={!!isVideo} isUploading={isUploading} />
                ) : (
                  <InstagramView dayContent={effectiveDayContent} caption={previewCaption} imageUrl={imageUrl} isVideo={!!isVideo} isUploading={isUploading} />
                )}
             </div>
           </div>

           {/* Decorative elements for premium feel */}
           <div className="absolute bottom-6 left-6 pointer-events-none opacity-20">
              <span className="font-serif italic text-white/50 text-4xl tracking-tighter">Bolsa</span>
           </div>
        </div>

        {/* ================= RIGHT: EDIT ================= */}
        <div className="w-full md:w-[35%] flex flex-col h-full bg-[#fcfbf9] relative border-l border-black/[0.03]">
           
           <div className="p-6 border-b border-black/[0.03] flex flex-col gap-5 bg-white/50 backdrop-blur-sm pr-14">
              <div className="flex justify-between items-start">
                 <div>
                    {isNew ? (
                        <h2 className="font-serif text-2xl text-brand-dark tracking-tight">Nova Publicação</h2>
                    ) : (
                        <h2 className="font-serif text-2xl text-brand-dark tracking-tight">{effectiveDayContent.day.split(' ')[0]}</h2>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-gray-400 uppercase font-bold tracking-[0.2em]">
                          {selectedPlatforms.length > 1 ? 'Multi-plataforma' : (previewPlatform === 'meta' ? 'Instagram/Face' : 'LinkedIn')}
                      </span>
                      <div className="w-1 h-1 rounded-full bg-gray-300" />
                      <span className="text-[9px] text-gray-400 uppercase font-bold tracking-[0.2em]">
                        {editedType.split(' ')[0]}
                      </span>
                    </div>
                 </div>
                 {userRole === 'admin' && (
                     <div className="flex gap-2">
                        {!isNew && (
                            <button onClick={handleCopyLink} className="p-2.5 text-gray-400 hover:text-brand-dark hover:bg-black/[0.03] rounded-xl border border-black/[0.05] transition-all" title="Copiar Link"><Link size={16} /></button>
                        )}
                        {!isNew && (
                            <button onClick={handleDeletePost} className="p-2.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl border border-transparent transition-all" title="Excluir"><Trash2 size={16} /></button>
                        )}
                        <button onClick={() => setIsEditing(!isEditing)} className={`text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-xl border flex items-center gap-2 transition-all ${isEditing ? 'bg-brand-dark text-white border-brand-dark shadow-lg shadow-brand-dark/20' : 'bg-white text-gray-600 border-black/[0.08] hover:bg-gray-50 shadow-sm'}`}>
                            <Edit3 size={14} /> {isEditing ? 'Concluir' : 'Editar'}
                        </button>
                     </div>
                 )}
              </div>
              
              {/* Approver Actions */}
              {userRole === 'approver' && !isNew && (
                  <div className="flex gap-3">
                      {!showRequestChangesInput ? (
                        <>
                        <button onClick={handleApprove} className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-brand-dark hover:bg-black text-white rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-xl shadow-brand-dark/10 transition-all active:scale-95"><CheckCircle2 size={18} /> Aprovar</button>
                        <button onClick={() => setShowRequestChangesInput(true)} className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-white hover:bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all active:scale-95"><AlertTriangle size={18} /> Ajuste</button>
                        </>
                      ) : (
                        <div className="flex items-center justify-between w-full bg-red-50 text-red-800 px-4 py-3 rounded-xl border border-red-100 text-[11px] font-bold uppercase tracking-widest">
                            <span>Escreva o ajuste abaixo</span>
                            <button onClick={() => setShowRequestChangesInput(false)} className="text-[10px] underline tracking-normal">Cancelar</button>
                        </div>
                      )}
                  </div>
              )}
           </div>

           <div className="flex-grow flex flex-col overflow-hidden">
             <AnimatePresence mode="wait">
               {userRole === 'admin' && isEditing ? (
                 <motion.div 
                   key="edit-form"
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -20 }}
                   className="p-5 border-b border-gray-100 bg-blue-50/30 overflow-y-auto max-h-[100%] custom-scrollbar pb-20"
                 >
                    
                    {/* 1. Status */}
                    <div className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-sm mb-5">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><AlertTriangle size={14} className="text-brand-dark" /> Status da Publicação</h3>
                        <div className="relative">
                            <select 
                                value={manualStatus} 
                                onChange={(e) => setManualStatus(e.target.value as PostStatus)}
                                className="w-full appearance-none bg-white border border-black/[0.08] text-brand-dark py-3 px-4 rounded-xl leading-tight focus:outline-none focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark font-bold text-[11px] uppercase tracking-widest transition-all"
                            >
                                {STATUS_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400"><ChevronDown size={14} /></div>
                        </div>
                    </div>

                    {/* 2. Agendamento & Plataformas */}
                    <div className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-sm mb-5">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Calendar size={14} className="text-brand-dark" /> Agendamento</h3>
                        <div className="flex flex-col gap-5">
                            <div>
                                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Data da Publicação</label>
                                <input type="date" value={postDate} onChange={e => setPostDate(e.target.value)} className="w-full text-xs font-bold p-3 border border-black/[0.08] rounded-xl outline-none focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark transition-all" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Plataformas</label>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => togglePlatform('meta')} 
                                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest ${selectedPlatforms.includes('meta') ? 'bg-brand-dark text-white border-brand-dark shadow-lg shadow-brand-dark/20' : 'bg-white text-gray-500 border-black/[0.08] hover:bg-gray-50'}`}
                                    >
                                        <Instagram size={16} /> Instagram
                                    </button>
                                    <button 
                                        onClick={() => togglePlatform('linkedin')} 
                                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest ${selectedPlatforms.includes('linkedin') ? 'bg-brand-dark text-white border-brand-dark shadow-lg shadow-brand-dark/20' : 'bg-white text-gray-500 border-black/[0.08] hover:bg-gray-50'}`}
                                    >
                                        <Linkedin size={16} /> LinkedIn
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Estrutura */}
                    <div className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-sm mb-5">
                       <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><LayoutTemplate size={14} className="text-brand-dark" /> Estrutura do Conteúdo</h3>
                       <div className="space-y-4">
                          <div>
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Tema Central</label>
                            <input type="text" value={editedTheme} onChange={(e) => setEditedTheme(e.target.value)} className="w-full text-xs font-bold p-3 border border-black/[0.08] rounded-xl focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none transition-all" />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Formato da Entrega</label>
                            <div className="relative">
                              <select value={editedType} onChange={(e) => setEditedType(e.target.value)} className="w-full appearance-none text-xs font-bold p-3 border border-black/[0.08] rounded-xl focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none bg-white transition-all">
                                 {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400"><ChevronDown size={14} /></div>
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Bullets / Direcionamento</label>
                            <textarea value={editedBullets} onChange={(e) => setEditedBullets(e.target.value)} rows={4} className="w-full text-xs p-3 border border-black/[0.08] rounded-xl focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none resize-none leading-relaxed transition-all" />
                          </div>
                       </div>
                    </div>

                    {/* 4. Criativo & Legendas */}
                    <div className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-sm mb-8">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><ImageIcon size={14} className="text-brand-dark" /> Criativo & Legenda</h3>
                        
                        {/* Image Upload */}
                        <label 
                            className={`h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer mb-6 transition-all
                                ${isDragging ? 'border-brand-dark bg-brand-dark/5' : 'border-black/[0.08] bg-black/[0.01] hover:bg-black/[0.03]'}
                                ${isUploading ? 'opacity-50 pointer-events-none' : ''}
                            `}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                              <input 
                                type="file" 
                                accept="image/*,video/*" 
                                onChange={handleImageUpload} 
                                className="hidden" 
                                disabled={isUploading} 
                                multiple={editedType.toLowerCase().includes('carrossel')}
                              />
                              <div className={`p-3 rounded-full ${isDragging ? 'bg-brand-dark text-white' : 'bg-white text-gray-400 shadow-sm border border-black/[0.05]'}`}>
                                <UploadCloud size={20} />
                              </div>
                              <div className="text-center">
                                <span className={`text-[10px] font-bold uppercase tracking-widest block ${isDragging ? 'text-brand-dark' : 'text-gray-500'}`}>
                                    {isUploading ? 'Enviando...' : isDragging ? 'Solte os arquivos' : 'Carregar Mídia'}
                                </span>
                                <span className="text-[8px] text-gray-400 font-medium mt-1 block">Arraste ou clique para selecionar</span>
                              </div>
                        </label>

                        {/* Caption Switcher */}
                        <div className="flex items-center justify-between mb-4 border-b border-black/[0.03] pb-3">
                             <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Legenda da Publicação</label>
                             <div className="flex items-center gap-3">
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${useDifferentCaptions ? 'text-brand-dark' : 'text-gray-400'}`}>Legendas Customizadas</span>
                                <button 
                                    onClick={() => setUseDifferentCaptions(!useDifferentCaptions)}
                                    className={`w-9 h-5 rounded-full p-1 transition-all ${useDifferentCaptions ? 'bg-brand-dark' : 'bg-gray-200'}`}
                                >
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${useDifferentCaptions ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </button>
                             </div>
                        </div>

                        {!useDifferentCaptions ? (
                            <div className="relative group/caption">
                                <textarea 
                                    placeholder="Escreva a legenda estratégica aqui..." 
                                    value={captionMeta} 
                                    onChange={e => setCaptionMeta(e.target.value)} 
                                    className="w-full h-56 px-4 py-3 border border-black/[0.08] rounded-2xl text-xs focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none resize-none leading-relaxed transition-all" 
                                />
                                <div className="absolute bottom-3 right-3 text-[8px] text-gray-400 font-bold bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-black/[0.05] pointer-events-none tracking-widest uppercase">Legenda Geral</div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="relative">
                                    <div className="flex items-center gap-2 mb-2 text-[9px] font-bold uppercase tracking-widest text-purple-600"><Instagram size={12}/> Instagram</div>
                                    <textarea 
                                        placeholder="Legenda exclusiva para Instagram..." 
                                        value={captionMeta} 
                                        onChange={e => setCaptionMeta(e.target.value)} 
                                        className="w-full h-40 px-4 py-3 border border-purple-100 bg-purple-50/10 rounded-2xl text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none leading-relaxed transition-all" 
                                    />
                                </div>
                                <div className="relative">
                                    <div className="flex items-center gap-2 mb-2 text-[9px] font-bold uppercase tracking-widest text-[#0077B5]"><Linkedin size={12}/> LinkedIn</div>
                                    <textarea 
                                        placeholder="Legenda exclusiva para LinkedIn..." 
                                        value={captionLinkedin} 
                                        onChange={e => setCaptionLinkedin(e.target.value)} 
                                        className="w-full h-40 px-4 py-3 border border-blue-100 bg-blue-50/10 rounded-2xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none leading-relaxed transition-all" 
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={handleSavePost} disabled={loading} className="w-full text-[11px] font-bold uppercase tracking-[0.2em] bg-brand-dark text-white px-6 py-4 rounded-2xl hover:bg-black shadow-xl shadow-brand-dark/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50">
                        {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} Salvar Alterações
                    </button>
                 </motion.div>
               ) : (
                 <motion.div 
                   key="view-details"
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 20 }}
                   className="flex-grow flex flex-col overflow-hidden"
                 >
                    {/* Post Details View Mode */}
                    <div className="p-6 border-b border-black/[0.03] space-y-6 bg-white/30">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-black/[0.03] shadow-sm">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Tema</span>
                                <p className="text-[11px] font-bold text-brand-dark leading-tight">{editedTheme}</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-black/[0.03] shadow-sm">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Formato</span>
                                <p className="text-[11px] font-bold text-brand-dark leading-tight">{editedType}</p>
                            </div>
                        </div>
                        {editedBullets && (
                            <div className="bg-white p-4 rounded-2xl border border-black/[0.03] shadow-sm">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Direcionamento</span>
                                <div className="space-y-2">
                                    {editedBullets.split('\n').filter(b => b.trim()).map((bullet, idx) => (
                                        <div key={idx} className="flex gap-2 items-start">
                                            <div className="w-1 h-1 rounded-full bg-brand-dark mt-1.5 flex-shrink-0" />
                                            <p className="text-[11px] text-gray-600 leading-relaxed">{bullet}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Comments List */}
                    <div className="flex-grow overflow-y-auto p-6 bg-black/[0.01] custom-scrollbar flex flex-col gap-6 relative">
                        {/* Subtle Watermark */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]">
                            <span className="font-serif italic text-9xl -rotate-12">Bolsa</span>
                        </div>

                        {comments.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-center opacity-30 py-10 relative z-10">
                             <div className="w-16 h-16 rounded-full border border-dashed border-gray-400 flex items-center justify-center mb-4">
                               <Send size={24} className="text-gray-400" />
                             </div>
                             <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Nenhum comentário ainda</p>
                             <p className="text-[9px] text-gray-400 mt-1">Inicie a conversa sobre esta publicação</p>
                          </div>
                        ) : (
                          comments.map((comment) => (
                             <motion.div 
                               initial={{ opacity: 0, y: 10 }}
                               animate={{ opacity: 1, y: 0 }}
                               key={comment.id} 
                               className={`flex flex-col gap-2 max-w-[90%] relative z-10 ${comment.author_role === 'admin' ? 'self-end' : 'self-start'}`}
                             >
                                <div className={`text-[9px] font-bold text-gray-400 uppercase tracking-widest px-1 ${comment.author_role === 'admin' ? 'text-right' : 'text-left'}`}>{comment.author_name}</div>
                                <div className={`flex gap-3 ${comment.author_role === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shadow-lg flex-shrink-0 border border-white/20 ${comment.author_role === 'admin' ? 'bg-brand-dark' : comment.author_role === 'approver' ? 'bg-green-600' : 'bg-purple-600'}`}>{comment.author_name.charAt(0)}</div>
                                    <div className={`p-4 rounded-2xl text-[13px] shadow-sm relative group leading-relaxed ${comment.author_role === 'admin' ? 'bg-white text-brand-dark rounded-tr-none border border-black/[0.03]' : comment.author_role === 'approver' ? 'bg-green-50 text-green-900 rounded-tl-none border border-green-100' : 'bg-purple-50 text-purple-900 rounded-tl-none border border-purple-100'}`}>
                                       <p>{comment.content}</p>
                                       {userRole === 'admin' && (
                                         <button onClick={() => handleDeleteComment(comment.id)} className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-red-500 rounded-full p-1.5 shadow-md border border-black/[0.05] opacity-0 group-hover:opacity-100 transition-all" title="Excluir"><Trash2 size={12} /></button>
                                       )}
                                    </div>
                                </div>
                             </motion.div>
                          ))
                        )}
                        <div ref={commentsEndRef} />
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>

             {/* Comment Input */}
             {(!isNew && canComment) && (
                <div className="p-6 bg-white border-t border-black/[0.03] shrink-0">
                    <div className="relative flex items-center gap-3">
                        <input 
                          type="text" 
                          value={newComment} 
                          onChange={e => setNewComment(e.target.value)} 
                          placeholder="Adicionar comentário estratégico..." 
                          className="flex-grow pl-5 pr-14 py-4 bg-black/[0.02] border border-black/[0.05] rounded-2xl outline-none text-sm focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark transition-all" 
                          onKeyDown={e => e.key === 'Enter' && handleSendComment()} 
                          autoFocus={showRequestChangesInput} 
                        />
                        <button onClick={handleSendComment} disabled={!newComment.trim()} className="absolute right-2 p-2.5 bg-brand-dark text-white rounded-xl shadow-lg shadow-brand-dark/20 hover:bg-black transition-all active:scale-90 disabled:opacity-30"><Send size={18} /></button>
                    </div>
                </div>
             )}
           </div>
        </div>
      </motion.div>
    </div>
  );
};

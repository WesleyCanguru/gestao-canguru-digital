
import React, { useState, useEffect, useRef } from 'react';
import { DailyContent, PostData, PostComment, PostStatus } from '../types';
import { useAuth, supabase } from '../lib/supabase';
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
  const { userRole } = useAuth();
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
  const [imageUrl, setImageUrl] = useState(dayContent.initialImageUrl || '');
  
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
            .maybeSingle();

         // Populate State
         const primaryData = mainPostData || { 
             date_key: dateKey, status: 'draft', image_url: dayContent.initialImageUrl, theme: dayContent.theme, type: dayContent.type, bullets: dayContent.bullets 
         };

         setPost(primaryData as PostData);
         setManualStatus(primaryData.status);
         setImageUrl(primaryData.image_url || dayContent.initialImageUrl || '');
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
            image_url: imageUrl,
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
      await supabase.from('posts').update({ status: 'approved' }).eq('date_key', dateKey);
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

  const isVideo = imageUrl?.match(/\.(mp4|webm|ogg)$/i);
  const effectiveDayContent = { ...dayContent, theme: editedTheme, type: editedType, bullets: editedBullets ? editedBullets.split('\n') : [] };
  
  // Determine which caption to show in Preview
  const previewCaption = (previewPlatform === 'meta' || !useDifferentCaptions) ? captionMeta : captionLinkedin;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-[98%] xl:max-w-[90rem] h-[95vh] rounded-xl shadow-2xl relative z-10 flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <button onClick={onClose} className="absolute top-3 right-3 z-50 p-2 bg-white rounded-full text-gray-500 hover:text-red-500 shadow-md border border-gray-100 transition-colors"><X size={20} /></button>

        {/* ================= LEFT: PREVIEW ================= */}
        <div className="w-full md:w-[60%] bg-gray-100 flex flex-col border-r border-gray-200 overflow-y-auto custom-scrollbar relative">
           
           {/* Header: Status + Preview Tabs */}
           <div className="sticky top-0 z-20 w-full p-4 flex justify-between items-start pointer-events-none">
                <div className="flex gap-2">
                    {!isNew && <span className="pointer-events-auto px-4 py-1.5 rounded-full text-xs font-bold border uppercase bg-white shadow-sm text-gray-600">
                        {getStatusLabel(post?.status || 'draft')}
                    </span>}
                </div>
                
                {/* Preview Toggles (Only if both selected) */}
                {selectedPlatforms.length > 1 && (
                    <div className="pointer-events-auto bg-white p-1 rounded-lg shadow-sm border border-gray-200 flex gap-1">
                        <button 
                            onClick={() => setPreviewPlatform('meta')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${previewPlatform === 'meta' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <Instagram size={14} /> Instagram
                        </button>
                        <button 
                            onClick={() => setPreviewPlatform('linkedin')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${previewPlatform === 'linkedin' ? 'bg-[#0077B5] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <Linkedin size={14} /> LinkedIn
                        </button>
                    </div>
                )}
           </div>

           <div className="flex-grow p-6 sm:p-10 flex items-start justify-center">
             <div className="w-full max-w-lg transition-all duration-300">
                {previewPlatform === 'linkedin' ? (
                  <LinkedInView dayContent={effectiveDayContent} caption={previewCaption} imageUrl={imageUrl} isVideo={!!isVideo} isUploading={isUploading} />
                ) : (
                  <InstagramView dayContent={effectiveDayContent} caption={previewCaption} imageUrl={imageUrl} isVideo={!!isVideo} isUploading={isUploading} />
                )}
             </div>
           </div>
        </div>

        {/* ================= RIGHT: EDIT ================= */}
        <div className="w-full md:w-[40%] flex flex-col h-full bg-white relative border-l border-gray-200">
           
           <div className="p-5 border-b border-gray-100 flex flex-col gap-4 bg-gray-50/50 pr-12">
              <div className="flex justify-between items-start">
                 <div>
                    {isNew ? (
                        <h2 className="font-bold text-gray-900 text-lg">Criar Nova Publicação</h2>
                    ) : (
                        <h2 className="font-bold text-gray-900 text-lg">{effectiveDayContent.day.split(' ')[0]}</h2>
                    )}
                    <span className="text-xs text-gray-500 uppercase font-medium">
                        {selectedPlatforms.length > 1 ? 'Multi-plataforma' : (previewPlatform === 'meta' ? 'Instagram/Face' : 'LinkedIn')}
                    </span>
                 </div>
                 {userRole === 'admin' && (
                     <div className="flex gap-2">
                        {!isNew && (
                            <button onClick={handleCopyLink} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded border border-gray-200" title="Copiar Link"><Link size={16} /></button>
                        )}
                        {!isNew && (
                            <button onClick={handleDeletePost} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-100" title="Excluir"><Trash2 size={16} /></button>
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
                      {!showRequestChangesInput ? (
                        <>
                        <button onClick={handleApprove} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm shadow-sm"><CheckCircle2 size={18} /> Aprovar</button>
                        <button onClick={() => setShowRequestChangesInput(true)} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold text-sm"><AlertTriangle size={18} /> Ajuste</button>
                        </>
                      ) : (
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
                 <div className="p-5 border-b border-gray-100 bg-blue-50/30 overflow-y-auto max-h-[100%] custom-scrollbar pb-20">
                    
                    {/* 1. Status */}
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm mb-4">
                        <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-1"><AlertTriangle size={14} /> Status da Publicação</h3>
                        <div className="relative">
                            <select 
                                value={manualStatus} 
                                onChange={(e) => setManualStatus(e.target.value as PostStatus)}
                                className="w-full appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded leading-tight focus:outline-none focus:border-blue-500 font-medium text-sm"
                            >
                                {STATUS_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ChevronDown size={14} /></div>
                        </div>
                    </div>

                    {/* 2. Agendamento & Plataformas */}
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm mb-4">
                        <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-1"><Calendar size={14} /> Agendamento</h3>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Data</label>
                                <input type="date" value={postDate} onChange={e => setPostDate(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Plataformas (Selecione)</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => togglePlatform('meta')} 
                                        className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded border transition-all ${selectedPlatforms.includes('meta') ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        <Instagram size={18} /> Instagram
                                    </button>
                                    <button 
                                        onClick={() => togglePlatform('linkedin')} 
                                        className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded border transition-all ${selectedPlatforms.includes('linkedin') ? 'bg-[#0077B5] text-white border-transparent shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        <Linkedin size={18} /> LinkedIn
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Estrutura */}
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm mb-4">
                       <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-1"><LayoutTemplate size={14} /> Estrutura</h3>
                       <div className="space-y-3">
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Tema</label>
                            <input type="text" value={editedTheme} onChange={(e) => setEditedTheme(e.target.value)} className="w-full text-sm p-2.5 border border-gray-200 rounded focus:border-blue-500 outline-none" />
                          </div>
                          <div>
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
                    </div>

                    {/* 4. Criativo & Legendas */}
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm mb-4">
                        <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-1"><ImageIcon size={14} /> Criativo</h3>
                        
                        {/* Image Upload */}
                        <label className={`h-24 border-2 border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer mb-4 ${isUploading ? 'opacity-50' : ''}`}>
                              <input type="file" accept="image/*,video/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                              <UploadCloud size={24} className="text-blue-400" />
                              <span className="text-xs text-blue-700 font-bold">{isUploading ? 'Enviando...' : 'Carregar Imagem / Vídeo'}</span>
                        </label>

                        {/* Caption Switcher */}
                        <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                             <label className="text-[11px] font-bold text-gray-500 uppercase">Legenda</label>
                             <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold ${useDifferentCaptions ? 'text-blue-600' : 'text-gray-400'}`}>Legendas Diferentes</span>
                                <button 
                                    onClick={() => setUseDifferentCaptions(!useDifferentCaptions)}
                                    className={`w-8 h-4 rounded-full p-0.5 transition-colors ${useDifferentCaptions ? 'bg-blue-600' : 'bg-gray-300'}`}
                                >
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${useDifferentCaptions ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </button>
                             </div>
                        </div>

                        {!useDifferentCaptions ? (
                            <div className="relative">
                                <textarea 
                                    placeholder="Escreva a legenda aqui..." 
                                    value={captionMeta} 
                                    onChange={e => setCaptionMeta(e.target.value)} 
                                    className="w-full h-48 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed" 
                                />
                                <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 font-bold bg-white/80 px-1 rounded pointer-events-none">GERAL</div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="relative">
                                    <div className="flex items-center gap-1 mb-1 text-xs font-bold text-purple-600"><Instagram size={12}/> Instagram</div>
                                    <textarea 
                                        placeholder="Legenda exclusiva para Instagram..." 
                                        value={captionMeta} 
                                        onChange={e => setCaptionMeta(e.target.value)} 
                                        className="w-full h-32 px-3 py-2 border border-purple-100 bg-purple-50/20 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none leading-relaxed" 
                                    />
                                </div>
                                <div className="relative">
                                    <div className="flex items-center gap-1 mb-1 text-xs font-bold text-[#0077B5]"><Linkedin size={12}/> LinkedIn</div>
                                    <textarea 
                                        placeholder="Legenda exclusiva para LinkedIn..." 
                                        value={captionLinkedin} 
                                        onChange={e => setCaptionLinkedin(e.target.value)} 
                                        className="w-full h-32 px-3 py-2 border border-blue-100 bg-blue-50/20 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed" 
                                    />
                                </div>
                            </div>
                        )}
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
                        <div key={comment.id} className={`flex flex-col gap-1 max-w-[90%] ${comment.author_role === 'admin' ? 'self-end' : 'self-start'}`}>
                           <div className={`text-xs font-bold text-gray-500 px-1 ${comment.author_role === 'admin' ? 'text-right' : 'text-left'}`}>{comment.author_name}</div>
                           <div className={`flex gap-2 ${comment.author_role === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}>
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0 ${comment.author_role === 'admin' ? 'bg-brand-dark' : comment.author_role === 'approver' ? 'bg-green-600' : 'bg-purple-600'}`}>{comment.author_name.charAt(0)}</div>
                               <div className={`p-3 rounded-xl text-sm shadow-sm relative group ${comment.author_role === 'admin' ? 'bg-white rounded-tr-none' : comment.author_role === 'approver' ? 'bg-green-100 text-green-900 rounded-tl-none' : 'bg-purple-100 rounded-tl-none'}`}>
                                  <p>{comment.content}</p>
                                  {userRole === 'admin' && (
                                    <button onClick={() => handleDeleteComment(comment.id)} className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-red-500 rounded-full p-1 shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-all" title="Excluir"><Trash2 size={12} /></button>
                                  )}
                               </div>
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

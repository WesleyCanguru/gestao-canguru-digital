
import React, { useState, useEffect } from 'react';
import { DailyContent, PostData, PostComment, PostStatus, AdFormat } from '../types';
import { useAuth, supabase } from '../lib/supabase';
import { X, Send, Image as ImageIcon, CheckCircle2, AlertTriangle, MessageCircle, Clock, Save, Eye } from 'lucide-react';
import { FeedMockup } from './mockups/FeedMockup';
import { StoryMockup } from './mockups/StoryMockup';

interface PostModalProps {
  dayContent: DailyContent;
  dateKey: string;
  onClose: () => void;
}

export const PostModal: React.FC<PostModalProps> = ({ dayContent, dateKey, onClose }) => {
  const { userRole } = useAuth();
  const [post, setPost] = useState<PostData | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form States
  const [caption, setCaption] = useState('');
  // Inicializa com a imagem do banco OU a imagem direta do constants.ts
  const [imageUrl, setImageUrl] = useState(dayContent.initialImageUrl || '');
  const [newComment, setNewComment] = useState('');

  // Fetch Data Mock (Since user hasn't set up Supabase tables yet, we simulate)
  // In real implementation: fetch from Supabase 'posts' and 'comments'
  useEffect(() => {
    // Simulação de Fetch
    const mockFetch = async () => {
      // Tentar buscar do Supabase se existisse
      // const { data } = await supabase.from('posts').select('*').eq('date_key', dateKey).single();
      
      // Mock inicial
      setPost({
        date_key: dateKey,
        status: 'draft',
        image_url: dayContent.initialImageUrl || null,
        caption: null,
        last_updated: new Date().toISOString()
      });
      setComments([]);
      setLoading(false);
    };

    mockFetch();
  }, [dateKey, dayContent.initialImageUrl]);

  const handleSavePost = async () => {
    if (!imageUrl || !caption) return;
    
    // Simulação de salvamento
    setPost(prev => ({
      ...prev!,
      image_url: imageUrl,
      caption: caption,
      status: 'pending_approval' // Ao salvar, vira pendente
    }));
  };

  const handleSendComment = async (visibilityToAdmin: boolean = true) => {
    if (!newComment.trim()) return;

    const newCommentObj: PostComment = {
      id: Math.random().toString(),
      post_id: dateKey,
      author_role: userRole!,
      author_name: userRole === 'admin' ? 'Canguru' : userRole === 'approver' ? 'Viviane' : 'Equipe Next',
      content: newComment,
      created_at: new Date().toISOString(),
      visible_to_admin: visibilityToAdmin
    };

    setComments([...comments, newCommentObj]);
    setNewComment('');

    // Lógica de mudança de status automática
    if (userRole === 'team') {
       // Equipe comentou: muda para Roxo (Internal Review)
       setPost(prev => ({ ...prev!, status: 'internal_review' }));
    } else if (userRole === 'approver') {
       // Viviane comentou: muda para Laranja (Changes Requested) se for para Admin
       // Se for resposta interna, mantém roxo? Vamos simplificar: Viviane comentou = Laranja
       if (visibilityToAdmin) {
         setPost(prev => ({ ...prev!, status: 'changes_requested' }));
       }
    }
  };

  const handleApprove = () => {
    setPost(prev => ({ ...prev!, status: 'approved' }));
  };

  // Filtragem de comentários baseada no papel
  const visibleComments = comments.filter(c => {
    if (userRole === 'admin') return c.visible_to_admin; // Admin só vê o que é publico
    return true; // Viviane e Equipe veem tudo
  });

  const getStatusColor = (s: PostStatus) => {
    switch(s) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'changes_requested': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'internal_review': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'pending_approval': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const getStatusLabel = (s: PostStatus) => {
    // Admin vê "Em Análise" mesmo se estiver "Review Interno"
    if (userRole === 'admin' && s === 'internal_review') return 'Aguardando Cliente';
    
    switch(s) {
      case 'approved': return 'Aprovado';
      case 'changes_requested': return 'Ajustes Solicitados';
      case 'internal_review': return 'Discussão Interna';
      case 'pending_approval': return 'Em Aprovação';
      default: return 'Em Produção';
    }
  };

  // Mockup data transformer
  const isStory = dayContent.type.toLowerCase().includes('vídeo') || dayContent.type.toLowerCase().includes('story');
  
  const mockupData = {
    type: (isStory ? 'story' : 'feed') as AdFormat,
    mainImage: imageUrl || undefined,
    title: dayContent.theme,
    subtitle: 'Next Safety',
    tagline: 'PREVIEW'
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl relative z-10 flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 bg-white/80 hover:bg-white rounded-full text-gray-500 hover:text-red-500 transition-colors">
          <X size={24} />
        </button>

        {/* LEFT: Preview */}
        <div className="w-full md:w-1/2 bg-gray-100 p-8 flex flex-col items-center justify-center border-r border-gray-200 overflow-y-auto">
          <div className="mb-6 flex items-center gap-3">
             <span className={`px-4 py-1.5 rounded-full text-sm font-bold border uppercase tracking-wide shadow-sm ${getStatusColor(post?.status || 'draft')}`}>
                {getStatusLabel(post?.status || 'draft')}
             </span>
          </div>

          <div className="transform scale-90 sm:scale-100 origin-center transition-all duration-300">
             {imageUrl ? (
                isStory ? (
                  <StoryMockup data={mockupData} />
                ) : (
                  <FeedMockup data={mockupData} />
                )
             ) : (
               <div className="w-[320px] aspect-square bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                 <ImageIcon size={48} className="mb-4 opacity-30" />
                 <span className="text-sm font-medium">Nenhuma imagem definida</span>
                 <span className="text-xs opacity-60 mt-1">Cole a URL ao lado ou no constants.ts</span>
               </div>
             )}
          </div>
          
          <div className="mt-8 text-center max-w-md">
             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Tema / Pauta</h3>
             <p className="text-gray-800 font-medium">{dayContent.theme}</p>
          </div>
        </div>

        {/* RIGHT: Actions & Chat */}
        <div className="w-full md:w-1/2 flex flex-col h-full bg-white">
          
          {/* Header Actions */}
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
             <div>
                <h2 className="font-bold text-gray-900 text-lg">{dayContent.day}</h2>
                <span className="text-xs text-gray-500 uppercase font-medium">{dayContent.platform}</span>
             </div>
             
             {/* Action Buttons based on Role */}
             <div className="flex gap-2">
                {userRole === 'approver' && (
                  <>
                    <button onClick={handleApprove} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm shadow-sm transition-all">
                       <CheckCircle2 size={16} /> Aprovar
                    </button>
                  </>
                )}
             </div>
          </div>

          {/* Chat / Content Area */}
          <div className="flex-grow overflow-y-auto p-6 space-y-6">
             
             {/* Admin Input Area (Only visible to admin or if content exists) */}
             {(userRole === 'admin' || post?.caption) && (
               <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                  <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                     <Clock size={14} /> Conteúdo da Publicação
                  </h3>
                  
                  {userRole === 'admin' && post?.status !== 'approved' ? (
                     <div className="space-y-4">
                        <input 
                          type="text" 
                          placeholder="URL da Imagem (Ex: https://...)"
                          value={imageUrl}
                          onChange={e => setImageUrl(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <textarea 
                          placeholder="Escreva a legenda aqui..."
                          value={caption}
                          onChange={e => setCaption(e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        />
                        <div className="flex justify-end">
                           <button onClick={handleSavePost} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                              <Save size={14} /> Salvar e Enviar
                           </button>
                        </div>
                     </div>
                  ) : (
                     <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                        {post?.caption || caption || "Nenhuma legenda definida."}
                     </p>
                  )}
               </div>
             )}

             {/* Comments Feed */}
             <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                   <MessageCircle size={16} className="text-gray-400" />
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      {userRole === 'admin' ? 'Histórico de Alterações' : 'Comentários da Equipe'}
                   </h3>
                </div>
                
                {visibleComments.length === 0 ? (
                   <div className="text-center py-8 text-gray-400 text-sm italic">
                      Nenhum comentário ainda.
                   </div>
                ) : (
                   visibleComments.map((comment) => (
                      <div key={comment.id} className={`flex gap-3 ${comment.author_role === 'admin' ? 'flex-row-reverse' : ''}`}>
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            comment.author_role === 'admin' ? 'bg-brand-dark text-white' : 
                            comment.author_role === 'approver' ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'
                         }`}>
                            {comment.author_name.charAt(0)}
                         </div>
                         <div className={`p-3 rounded-xl max-w-[80%] text-sm ${
                            comment.author_role === 'admin' ? 'bg-gray-100 text-gray-800 rounded-tr-none' : 
                            comment.author_role === 'approver' ? 'bg-green-50 text-green-900 border border-green-100 rounded-tl-none' :
                            'bg-purple-50 text-purple-900 border border-purple-100 rounded-tl-none'
                         }`}>
                            <div className="flex items-center gap-2 mb-1">
                               <span className="font-bold text-xs">{comment.author_name}</span>
                               <span className="text-[10px] opacity-60">10:42</span>
                            </div>
                            {comment.content}
                         </div>
                      </div>
                   ))
                )}
             </div>

          </div>

          {/* Footer Input */}
          <div className="p-4 border-t border-gray-100 bg-white">
             <div className="relative">
                <input 
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder={userRole === 'team' ? "Comentar internamente..." : "Escreva um comentário..."}
                  className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-dark outline-none transition-all"
                  onKeyDown={e => e.key === 'Enter' && handleSendComment(userRole !== 'team')}
                />
                <button 
                  onClick={() => handleSendComment(userRole !== 'team')}
                  className="absolute right-2 top-2 p-1.5 bg-brand-dark text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                   <Send size={16} />
                </button>
             </div>
             {userRole === 'approver' && (
               <div className="flex justify-end mt-2">
                 <button onClick={() => handleSendComment(false)} className="text-[10px] text-purple-600 font-bold hover:underline">
                    Enviar apenas para Equipe (Roxo)
                 </button>
               </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

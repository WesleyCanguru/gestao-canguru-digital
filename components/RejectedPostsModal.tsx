import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  FileText, 
  Calendar, 
  MessageSquare, 
  AlertCircle, 
  Clock, 
  Search, 
  Layers, 
  Film, 
  Image as ImageIcon, 
  Sparkles,
  ExternalLink,
  Instagram,
  Linkedin
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PostData } from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

interface RejectedPostsModalProps {
  clientId: string;
  agencyId?: number;
  isOpen: boolean;
  onClose: () => void;
  onPostRestored?: () => void;
}

export const RejectedPostsModal: React.FC<RejectedPostsModalProps> = ({
  clientId,
  agencyId,
  isOpen,
  onClose,
  onPostRestored
}) => {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (isOpen && clientId) {
      fetchRejectedPosts();
    }
  }, [isOpen, clientId, agencyId]);

  const fetchRejectedPosts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('posts')
        .select('*')
        .eq('client_id', clientId)
        .or('status.eq.rejected,status.eq.theme_rejected')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (agencyId) {
        query = query.eq('agency_id', agencyId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Erro ao buscar histórico de reprovadas:', error);
      } else {
        setPosts(data || []);
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatOriginalDate = (dateKey: string) => {
    if (!dateKey) return 'Data não definida';
    const parts = dateKey.split('-');
    if (parts.length >= 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${d}/${m}/${y}`;
    }
    return dateKey;
  };

  const getPlatformIcon = (dateKey: string) => {
    const lower = (dateKey || '').toLowerCase();
    if (lower.includes('linkedin')) {
      return <Linkedin size={12} className="text-blue-600" />;
    }
    if (lower.includes('tiktok')) {
      return <span className="text-[10px] font-bold text-black">TT</span>;
    }
    return <Instagram size={12} className="text-pink-600" />;
  };

  const getPlatformName = (dateKey: string) => {
    const lower = (dateKey || '').toLowerCase();
    if (lower.includes('linkedin')) return 'LinkedIn';
    if (lower.includes('tiktok')) return 'TikTok';
    return 'Meta / Instagram';
  };

  const getTypeIcon = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('reels') || t.includes('vídeo') || t.includes('video')) return <Film size={12} className="text-rose-500" />;
    if (t.includes('carrossel') || t.includes('carousel')) return <Layers size={12} className="text-indigo-500" />;
    return <ImageIcon size={12} className="text-emerald-500" />;
  };

  const filteredPosts = posts.filter(post => {
    const title = (post.theme || post.theme_title || '').toLowerCase();
    const reason = (post.theme_rejection_reason || post.theme_client_notes || '').toLowerCase();
    const type = (post.type || '').toLowerCase();
    const date = formatOriginalDate(post.date_key).toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = title.includes(search) || reason.includes(search) || type.includes(search) || date.includes(search);
    if (!matchesSearch) return false;

    if (filterType !== 'all') {
      return type.includes(filterType.toLowerCase());
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#0A0A0A]/70 backdrop-blur-md" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-[2.5rem] shadow-[0_30px_90px_rgba(0,0,0,0.3)] border border-stone-100 max-w-3xl w-full overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-brand-dark px-6 sm:px-8 py-6 text-white flex justify-between items-start shrink-0 relative">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <AlertCircle size={11} /> Reprovações Arquivadas
              </span>
              <span className="text-[10px] font-bold text-stone-400 bg-white/10 px-2.5 py-1 rounded-full">
                {posts.length} {posts.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
              Publicações Reprovadas
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 font-medium leading-relaxed">
              Histórico de publicações excluídas após reprovação para consulta estratégica e aprendizado
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all shrink-0 hover:rotate-90 duration-200"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar with Search and Filter */}
        <div className="p-4 sm:p-6 bg-stone-50/80 border-b border-stone-200/70 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por tema, motivo da reprovação ou formato..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200/80 rounded-2xl text-xs font-medium text-brand-dark focus:outline-none focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/10 transition-all placeholder:text-stone-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'reels', 'carrossel', 'estático'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 ${
                  filterType === f
                    ? 'bg-brand-dark text-white shadow-sm'
                    : 'bg-white text-stone-600 border border-stone-200/70 hover:bg-stone-100'
                }`}
              >
                {f === 'all' ? 'Todos' : f}
              </button>
            ))}
          </div>
        </div>

        {/* Content / List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-brand-dark/20 border-t-brand-dark rounded-full animate-spin" />
              <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Carregando histórico...
              </p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-stone-50/50 rounded-3xl border border-dashed border-stone-200">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
                <FileText size={24} />
              </div>
              <h3 className="text-sm font-bold text-stone-800">
                {searchTerm || filterType !== 'all' ? 'Nenhuma publicação encontrada para o filtro' : 'Nenhuma publicação reprovada arquivada'}
              </h3>
              <p className="text-xs text-stone-400 mt-1 max-w-sm font-medium">
                {searchTerm || filterType !== 'all'
                  ? 'Tente remover os termos de busca ou mudar o filtro de formato.'
                  : 'Quando uma publicação reprovada pelo cliente for excluída do calendário, seu histórico e motivo ficarão registrados aqui.'}
              </p>
            </div>
          ) : (
            filteredPosts.map((post, idx) => {
              const originalDate = formatOriginalDate(post.date_key);
              const themeName = post.theme || post.theme_title || 'Sem título de tema';
              const rejectionReason = post.theme_rejection_reason || post.theme_client_notes;
              const hasImage = post.image_url && typeof post.image_url === 'string' && post.image_url.startsWith('http');

              return (
                <motion.div
                  key={post.id || post.date_key || idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="p-4 sm:p-5 rounded-3xl bg-white border border-stone-200/80 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:border-stone-300 transition-all space-y-3.5 group"
                >
                  {/* Top Bar: Title, Date and Tags */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Format Tag */}
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200/70">
                          {getTypeIcon(post.type)}
                          {post.type || 'Post'}
                        </span>

                        {/* Platform Tag */}
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200/70">
                          {getPlatformIcon(post.date_key)}
                          {getPlatformName(post.date_key)}
                        </span>

                        {/* Status Badge */}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Reprovada
                        </span>
                      </div>

                      {/* Theme Title */}
                      <h4 className="text-base font-bold text-brand-dark tracking-tight leading-snug group-hover:text-black">
                        {themeName}
                      </h4>
                    </div>

                    {/* Original Calendar Date */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-1 shrink-0 text-stone-500">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200/80">
                        <Calendar size={13} className="text-stone-500" />
                        {originalDate}
                      </span>
                    </div>
                  </div>

                  {/* Rejection Reason / Client Feedback */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/60 border border-rose-100/90 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-rose-800 text-[10px] font-black uppercase tracking-wider">
                      <MessageSquare size={12} className="text-rose-600" />
                      <span>Motivo da Reprovação / Feedback do Cliente</span>
                    </div>
                    {rejectionReason ? (
                      <p className="text-xs sm:text-sm text-rose-950 font-medium leading-relaxed italic whitespace-pre-wrap">
                        "{rejectionReason}"
                      </p>
                    ) : (
                      <p className="text-xs text-rose-800/70 italic font-medium">
                        Reprovada sem comentário detalhado registrado.
                      </p>
                    )}
                  </div>

                  {/* Bullets / Details if available */}
                  {post.bullets && post.bullets.length > 0 && (
                    <div className="text-xs text-stone-600 space-y-1 pl-1">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">Tópicos do Conteúdo:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-stone-600">
                        {post.bullets.map((bullet, bIdx) => (
                          <li key={bIdx} className="leading-relaxed">{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer Meta: Excluída em */}
                  <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-stone-400" />
                      <span>
                        Excluída do calendário em: <strong className="text-stone-600 font-semibold">{post.deleted_at ? dayjs(post.deleted_at).format('DD/MM/YYYY [às] HH:mm') : 'Data não informada'}</strong>
                      </span>
                    </div>
                    {post.last_updated && (
                      <span className="text-[10px] text-stone-400">
                        Última atualização: {dayjs(post.last_updated).format('DD/MM/YYYY')}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200/80 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-stone-500 font-medium">
            Mostrando <strong>{filteredPosts.length}</strong> de <strong>{posts.length}</strong> publicações reprovadas arquivadas
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-brand-dark hover:bg-black text-white text-xs font-bold rounded-2xl transition-all shadow-sm active:scale-95"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

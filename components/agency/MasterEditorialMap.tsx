import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, useAuth } from '../../lib/supabase';
import { STATUS_CONFIG } from '../../constants';
import { PostStatus, DailyContent } from '../../types';
import { PostModal } from '../PostModal';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Instagram, 
  Linkedin, 
  Building2, 
  Sparkles,
  Search,
  Check,
  RefreshCw,
  Clock,
  LayoutDashboard
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

interface MasterEditorialMapProps {
  onBackToHome?: () => void;
}

interface GroupedPost {
  primaryKey: string;
  keys: string[];
  platforms: ('meta' | 'linkedin' | 'tiktok')[];
  client: { id: string; name: string; logo_url: string | null } | null;
  client_id: string;
  theme: string;
  type: string;
  status: PostStatus;
  scheduled_time?: string | null;
  day: number;
  rawPosts: any[];
}

export const MasterEditorialMap: React.FC<MasterEditorialMapProps> = ({ onBackToHome }) => {
  const { agencyId, userRole } = useAuth();
  
  // Data de referência (mês ativo)
  const [currentDate, setCurrentDate] = useState(dayjs());
  
  // Estados para dados do banco
  const [posts, setPosts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros selecionados
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Modal de edição/criação
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{
    dayContent: DailyContent;
    dateKey: string;
    groupKeys?: string[];
    isNew?: boolean;
    defaultDate?: string;
    clientOverride?: any;
  } | null>(null);

  // Busca inicial dos clientes ativos e posts do mês
  const fetchClients = useCallback(async () => {
    if (!agencyId) return;
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name, logo_url')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('name');
      if (data) {
        setClients(data);
      }
    } catch (e) {
      console.error("Erro ao buscar clientes no Mapa Master:", e);
    }
  }, [agencyId]);

  const fetchPosts = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          clients (
            id,
            name,
            logo_url,
            client_status,
            cancelled_at
          )
        `)
        .eq('agency_id', agencyId)
        .neq('status', 'deleted');
        
      if (error) throw error;
      if (data) {
        setPosts(data);
      }
    } catch (e) {
      console.error("Erro ao carregar posts no Mapa Master:", e);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    fetchClients();
    fetchPosts();
  }, [fetchClients, fetchPosts]);

  // Navegação de Meses
  const handlePrevMonth = () => {
    setCurrentDate(prev => prev.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => prev.add(1, 'month'));
  };

  const handleCurrentMonth = () => {
    setCurrentDate(dayjs());
  };

  // Utilitário para formatar a legenda/badge do status
  const getStatusLabel = (status: PostStatus) => {
    return STATUS_CONFIG[status]?.label || status;
  };

  const getStatusColorClass = (status: PostStatus) => {
    switch (status) {
      case 'published':
        return 'bg-green-50/70 border-green-100 text-green-800 hover:bg-green-100/30';
      case 'scheduled':
        return 'bg-purple-50/70 border-purple-100 text-purple-800 hover:bg-purple-100/30';
      case 'approved':
        return 'bg-blue-50/70 border-blue-100 text-blue-800 hover:bg-blue-100/30';
      case 'pending_approval':
        return 'bg-amber-50/70 border-amber-100 text-amber-800 hover:bg-amber-100/30';
      case 'changes_requested':
        return 'bg-yellow-50/70 border-yellow-200 text-yellow-800 hover:bg-yellow-100/30';
      case 'rejected':
        return 'bg-rose-50/70 border-rose-100 text-rose-800 hover:bg-rose-100/30';
      case 'draft':
      default:
        return 'bg-gray-50/50 border-gray-100 text-gray-700 hover:bg-gray-100/20';
    }
  };

  // Filtragem e Agrupamento dos posts
  const getGroupedPostsForCalendar = () => {
    const targetMonth = currentDate.month() + 1;
    const targetYear = currentDate.year();

    // 1. Filtragem por Mês/Ano e filtros da UI (Cliente, Status)
    const filtered = posts.filter(post => {
      if (!post.date_key) return false;
      const parts = post.date_key.split('-'); // DD-MM-YYYY-platform-clientId
      if (parts.length < 3) return false;

      const dMonth = parseInt(parts[1], 10);
      const dYear = parseInt(parts[2], 10);

      const matchesMonthStr = dMonth === targetMonth && dYear === targetYear;
      if (!matchesMonthStr) return false;

      // Ocultar posts futuros de clientes cancelados
      if (post.clients?.client_status === 'cancelled') {
        const cancelledAt = post.clients.cancelled_at;
        if (cancelledAt) {
          const postDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
          if (postDateStr > cancelledAt) {
            return false;
          }
        }
      }

      const matchesClient = filterClient === 'all' || post.client_id === filterClient;
      const matchesStatus = filterStatus === 'all' || post.status === filterStatus;

      return matchesClient && matchesStatus;
    });

    // 2. Agrupamento em GroupedPost (dia + client_id + tema limpo)
    const groups: Record<string, GroupedPost> = {};

    filtered.forEach(post => {
      const parts = post.date_key.split('-');
      const day = parts[0];
      const platform = parts[3] as 'meta' | 'linkedin' | 'tiktok';
      const cleanTheme = (post.theme || '').trim().toLowerCase();
      const client_id = post.client_id;

      const groupKey = `${day}-${client_id}-${cleanTheme}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          primaryKey: post.date_key,
          keys: [post.date_key],
          platforms: [platform],
          client: post.clients,
          client_id: post.client_id,
          theme: post.theme || 'Sem tema definido',
          type: post.type || 'Post',
          status: post.status as PostStatus,
          scheduled_time: post.scheduled_time || null,
          day: parseInt(day, 10),
          rawPosts: [post]
        };
      } else {
        groups[groupKey].keys.push(post.date_key);
        if (!groups[groupKey].platforms.includes(platform)) {
          groups[groupKey].platforms.push(platform);
        }
        groups[groupKey].rawPosts.push(post);

        // Precedência de status
        const s1 = groups[groupKey].status;
        const s2 = post.status as PostStatus;

        const STATUS_PRIORITY: Record<PostStatus, number> = {
          'theme_rejected': 1,
          'rejected': 1,
          'theme_pending': 2,
          'theme_approved_with_notes': 3,
          'changes_requested': 4,
          'pending_approval': 5,
          'draft': 6,
          'theme_approved': 7,
          'approved': 8,
          'scheduled': 9,
          'published': 10,
          'deleted': 11,
          'internal_review': 99
        };

        if ((STATUS_PRIORITY[s2] || 99) < (STATUS_PRIORITY[s1] || 99)) {
          groups[groupKey].status = s2;
        }
      }
    });

    return Object.values(groups);
  };

  const groupedPosts = getGroupedPostsForCalendar();

  // Abertura de Modais
  const handleOpenPost = (group: GroupedPost) => {
    const mainPost = group.rawPosts[0];
    const monthStr = currentDate.format('MM');
    const dayStr = group.day < 10 ? `0${group.day}` : `${group.day}`;

    const dayContent: DailyContent = {
      day: `${dayStr}/${monthStr}`,
      platform: group.platforms[0],
      type: group.type,
      theme: group.theme,
      bullets: mainPost.bullets || [],
      initialImageUrl: mainPost.image_url || undefined
    };

    setSelectedPost({
      dayContent,
      dateKey: group.primaryKey,
      groupKeys: group.keys,
      clientOverride: group.client,
      isNew: false
    });
    setModalOpen(true);
  };

  const handleCreatePost = (dayNum: number) => {
    const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
    const monthStr = currentDate.format('MM');
    const defaultDateStr = `${currentDate.format('YYYY')}-${monthStr}-${dayStr}`;

    const dayContent: DailyContent = {
      day: `${dayStr}/${monthStr}`,
      platform: 'meta',
      type: '',
      theme: '',
      bullets: []
    };

    setSelectedPost({
      dayContent,
      dateKey: 'new',
      groupKeys: [],
      isNew: true,
      defaultDate: defaultDateStr,
      clientOverride: filterClient !== 'all' ? clients.find(c => c.id === filterClient) : null
    });
    setModalOpen(true);
  };

  // Geração da grade de células do calendário
  const renderCalendarGrid = () => {
    const startOfMonth = currentDate.startOf('month');
    const daysInMonth = currentDate.daysInMonth();
    
    // Day of week (0 = Sunday, 1 = Monday... 6 = Saturday)
    // Queremos alinhar com Segunda-Feira como index inicial se desejável, mas vamos usar o padrão para fidelidade de código
    const firstDayOfWeek = startOfMonth.day(); 
    
    const cells = [];

    // Células vazias iniciais
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(
        <div key={`empty-start-${i}`} className="bg-gray-50/20 border-b border-r border-gray-100 min-h-[140px] md:min-h-[180px]"></div>
      );
    }

    // Dias do mês
    for (let d = 1; d <= daysInMonth; d++) {
      const dayOfWeek = dayjs(new Date(currentDate.year(), currentDate.month(), d)).day();
      const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Eventos/Posts deste dia
      const dayEvents = groupedPosts.filter(p => p.day === d);

      cells.push(
        <div 
          key={`day-${d}`}
          className={`border-b border-r border-gray-100 min-h-[140px] md:min-h-[180px] p-2.5 flex flex-col relative group transition-colors ${
            isWeekend ? 'bg-gray-50/10' : 'bg-white'
          } hover:bg-blue-50/10`}
        >
          {/* Cabeçalho do dia */}
          <div className="flex justify-between items-center mb-2">
            <span className={`text-xs md:text-sm font-black ${
              dayEvents.length > 0 ? 'text-brand-dark' : 'text-gray-400'
            }`}>
              {d} <span className="md:hidden text-[9px] font-medium ml-1 text-gray-400">{dayNames[dayOfWeek]}</span>
            </span>
            {userRole === 'admin' && (
              <button 
                onClick={() => handleCreatePost(d)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-brand-dark transition-all p-1 rounded hover:bg-gray-100"
                title="Criar publicação neste dia"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          {/* Lista de posts agrupados do dia */}
          <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[110px] md:max-h-[140px] custom-scrollbar pr-0.5 pb-1">
            {dayEvents.map((group, idx) => {
              const hasMeta = group.platforms.some(p => ['meta', 'instagram', 'facebook'].includes(p.toLowerCase()));
              const hasLinkedin = group.platforms.some(p => p.toLowerCase().includes('linkedin'));
              const hasTikTok = group.platforms.some(p => p.toLowerCase().includes('tiktok'));
              const statusBg = getStatusColorClass(group.status);

              return (
                <div 
                  key={idx}
                  onClick={() => handleOpenPost(group)}
                  className={`p-2 rounded-xl border border-black/[0.04] shadow-[0_2px_4px_rgba(0,0,0,0.02)] cursor-pointer hover:shadow-md transition-all duration-300 flex flex-col gap-1 text-left ${statusBg}`}
                >
                  {/* Badge de Plataformas e o Badge de Cliente */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex -space-x-1">
                      {hasMeta && <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm border border-black/[0.03]"><Instagram size={9} className="text-[#E1306C]" /></div>}
                      {hasLinkedin && <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm border border-black/[0.03]"><Linkedin size={9} className="text-[#0077B5]" /></div>}
                      {hasTikTok && <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center shadow-sm border border-black/[0.02]"><span className="text-[9px] text-white font-bold leading-none -mt-0.5" style={{ textShadow: '-0.5px -0.5px 0 #00f2fe, 0.5px 0.5px 0 #fe0979' }}>♪</span></div>}
                    </div>

                    {/* Badge do Cliente */}
                    {group.client && (
                      <span className="text-[7.5px] font-black uppercase tracking-wider text-gray-600 bg-white/60 border border-black/[0.04] px-1 py-0.5 rounded-md truncate max-w-[80px]" title={group.client.name}>
                        {group.client.name}
                      </span>
                    )}
                  </div>

                  {/* Tema do Post */}
                  <p className="text-[10px] sm:text-[10.5px] font-bold text-brand-dark leading-tight line-clamp-2" title={group.theme}>
                    {group.theme}
                  </p>

                  {/* Informações Extras (Horário e Status) */}
                  <div className="flex items-center justify-between gap-1 mt-1 font-mono text-[7px] font-bold uppercase tracking-wider text-gray-500">
                    <span className="truncate max-w-[50px]">
                      {getStatusLabel(group.status)}
                    </span>
                    {group.scheduled_time && (
                      <span className="flex items-center gap-0.5 font-medium shrink-0 text-gray-400">
                        <Clock size={8} />
                        {group.scheduled_time}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return cells;
  };

  const capitalizedMonthName = currentDate.format('MMMM').charAt(0).toUpperCase() + currentDate.format('MMMM').slice(1);
  const currentYear = currentDate.format('YYYY');

  return (
    <div className="min-h-screen bg-[#FDFDFD] pb-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        
        {/* Topo unificado do painel master */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-6 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-[#0A0A0A]/40">
              <Sparkles size={14} className="text-brand-dark" /> Visão Agência Unificada
            </div>
            <h1 className="text-3xl font-serif font-medium tracking-tight italic text-brand-dark">
              Mapa Editorial <span className="not-italic font-sans font-black text-blue-600">Master</span>
            </h1>
            <p className="text-xs text-gray-400 max-w-lg">
              Gerencie todo o fluxo de postagens, agendamento e aprovação de clientes da sua agência em um único painel mensal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Mês e Controles Temporais */}
            <div className="flex items-center bg-white border border-black/[0.04] p-1.5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <button 
                onClick={handlePrevMonth} 
                className="p-2 cursor-pointer text-gray-500 hover:text-brand-dark hover:bg-gray-100 rounded-xl transition-all"
                title="Mês Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div 
                onClick={handleCurrentMonth}
                className="px-4 font-serif font-bold italic text-brand-dark text-sm sm:text-base select-none cursor-pointer hover:opacity-85 transition-all text-center min-w-[120px]"
                title="Voltar para Hoje"
              >
                {capitalizedMonthName} <span className="font-sans font-bold not-italic opacity-40 ml-1 text-xs">{currentYear}</span>
              </div>

              <button 
                onClick={handleNextMonth} 
                className="p-2 cursor-pointer text-gray-500 hover:text-brand-dark hover:bg-gray-100 rounded-xl transition-all"
                title="Próximo Mês"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Ações primárias */}
            <button 
              onClick={() => handleCreatePost(dayjs().date())}
              className="flex items-center gap-2 bg-brand-dark hover:bg-black text-white px-5 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-brand-dark/10 transition-all active:scale-95"
            >
              <Plus size={14} /> Nova Publicação
            </button>
          </div>
        </div>

        {/* Filtros da UI */}
        <div className="bg-white border border-black/[0.04] p-5 rounded-[2rem] shadow-[0_10px_35px_rgba(0,0,0,0.02)] mb-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 z-20">
          <div className="flex flex-col sm:flex-row flex-grow gap-4 max-w-4xl">
            {/* Filtro de Clientes */}
            <div className="flex-1 space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <Building2 size={11} className="text-gray-400" /> Filtrar por Cliente
              </label>
              <div className="relative">
                <select 
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="w-full appearance-none bg-[#FDFDFD] border border-black/[0.05] text-brand-dark py-2.5 px-4 pr-10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                >
                  <option value="all">TODOS OS CLIENTES</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                  <ChevronRight size={12} className="rotate-90" />
                </div>
              </div>
            </div>

            {/* Filtro de Status */}
            <div className="flex-1 space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <Sparkles size={11} className="text-gray-400" /> Filtrar por Status
              </label>
              <div className="relative">
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full appearance-none bg-[#FDFDFD] border border-black/[0.05] text-brand-dark py-2.5 px-4 pr-10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                >
                  <option value="all">TODOS OS STATUS</option>
                  <option value="draft">EM PRODUÇÃO (RASCUNHO)</option>
                  <option value="pending_approval">ESPERANDO APROVAÇÃO</option>
                  <option value="changes_requested">AJUSTES SOLICITADOS</option>
                  <option value="approved">APROVADO</option>
                  <option value="scheduled">PROGRAMADO</option>
                  <option value="published">PUBLICADO</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                  <ChevronRight size={12} className="rotate-90" />
                </div>
              </div>
            </div>
          </div>

          {/* Botão de Atualizar rápido da agência */}
          <button 
            onClick={fetchPosts}
            disabled={loading}
            className="flex items-center justify-center gap-2 border border-black/[0.05] hover:bg-gray-50 text-gray-600 px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all self-end md:self-auto shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>

        {/* Quadro Principal do Calendário */}
        <div className="bg-white rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.04)] border border-black/[0.03] overflow-hidden">
          {/* Cabeçalho de Dias da Semana */}
          <div className="grid grid-cols-7 border-b border-gray-100 bg-[#FAF9F5]/40 text-center font-bold text-[9px] uppercase tracking-widest text-gray-400 py-4 font-mono">
            <div>Domingo</div>
            <div>Segunda</div>
            <div>Terça</div>
            <div>Quarta</div>
            <div>Quinta</div>
            <div>Sexta</div>
            <div>Sábado</div>
          </div>

          <div className="relative">
            {loading ? (
              <div className="h-[500px] flex flex-col items-center justify-center">
                <RefreshCw size={36} className="text-blue-500 animate-spin mb-4" />
                <p className="text-xs text-gray-400 font-mono font-medium animate-pulse">CARREGANDO O MAPA EDITORIAL MASTER...</p>
              </div>
            ) : (
              <div className="grid grid-cols-7 min-h-[500px]">
                {renderCalendarGrid()}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Renderização do PostModal robusto */}
      {modalOpen && selectedPost && (
        <PostModal
          dayContent={selectedPost.dayContent}
          dateKey={selectedPost.dateKey}
          groupKeys={selectedPost.groupKeys}
          isNew={selectedPost.isNew}
          defaultDate={selectedPost.defaultDate}
          clientOverride={selectedPost.clientOverride}
          isMasterMap={true}
          onClose={() => {
            setModalOpen(false);
            setSelectedPost(null);
          }}
          onUpdate={() => {
            fetchPosts(); // Recarrega os posts na hora no Mapa Master!
            setModalOpen(false);
            setSelectedPost(null);
          }}
        />
      )}
    </div>
  );
};

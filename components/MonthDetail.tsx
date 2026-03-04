
import React, { useState, useEffect, useCallback } from 'react';
import { DETAILED_MONTHLY_PLANS } from '../constants';
import { MonthlyDetailedPlan, DailyContent, PostStatus, PostData } from '../types';
import { Instagram, Linkedin, CalendarDays, Target, BarChart3, Repeat, FileCheck, CheckCircle2, ArrowLeft, MessageCircle, List, Calendar as CalendarIcon, Plus, Loader2, Check } from 'lucide-react';
import { PostModal } from './PostModal';
import { useAuth, supabase } from '../lib/supabase';
import { StatusLegend } from './StatusLegend';

interface MonthDetailProps {
  monthName: string;
  onBack: () => void;
}

type ViewMode = 'list' | 'calendar';

// Interface auxiliar para agrupar posts visuais
interface GroupedPost {
    primaryKey: string; // Chave principal para abrir o modal
    keys: string[]; // Todas as chaves associadas (ex: meta e linkedin)
    platforms: ('meta' | 'linkedin')[];
    content: DailyContent;
    status: PostStatus; // Status unificado (se um estiver pendente, mostra pendente)
    theme: string;
    type: string;
    bullets: string[];
}

export const MonthDetail: React.FC<MonthDetailProps> = ({ monthName, onBack }) => {
  const { userRole } = useAuth();
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{content: DailyContent, key: string} | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPostDefaultDate, setNewPostDefaultDate] = useState<string>('');

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  
  // Data States
  const [dbPosts, setDbPosts] = useState<Record<string, PostData>>({});
  const [mergedPosts, setMergedPosts] = useState<Array<{ content: DailyContent, key: string, sortDate: number }>>([]);
  const [groupedPosts, setGroupedPosts] = useState<GroupedPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const plan = DETAILED_MONTHLY_PLANS.find(p => p.month.toLowerCase().includes(monthName.toLowerCase()));

  // 1. Helper: Gerar chave única
  const getDateKey = (day: string, platform: string) => {
     const datePart = day.split(' ')[0].replace('/', '-');
     return `${datePart}-2026-${platform}`; 
  };

  // 2. Buscar Dados do Supabase
  const fetchMonthPosts = useCallback(async () => {
    if (!plan) return;
    setLoadingPosts(true);
    
    const { data } = await supabase
      .from('posts')
      .select('*');

    const postsMap: Record<string, PostData> = {};
    if (data) {
      data.forEach((post: PostData) => {
        postsMap[post.date_key] = post;
      });
    }
    setDbPosts(postsMap);
    setLoadingPosts(false);
  }, [plan]);

  useEffect(() => {
    fetchMonthPosts();
  }, [fetchMonthPosts]);

  // 3. Mesclar Posts Estáticos + Posts do Banco
  useEffect(() => {
    if (!plan) return;

    const tempPosts: Array<{ content: DailyContent, key: string, sortDate: number }> = [];
    const processedKeys = new Set<string>();

    // A. Adicionar Posts Estáticos
    plan.weeks.forEach(week => {
      week.days.forEach(day => {
        const key = getDateKey(day.day, day.platform);
        const dbPost = dbPosts[key];
        if (dbPost && dbPost.status === 'deleted') return;

        processedKeys.add(key);
        const [d, m] = day.day.split(' ')[0].split('/');
        const sortDate = new Date(2026, parseInt(m) - 1, parseInt(d)).getTime();

        tempPosts.push({
          content: day,
          key: key,
          sortDate
        });
      });
    });

    // B. Adicionar Posts NOVOS (DB only)
    Object.values(dbPosts).forEach((post: PostData) => {
      if (post.status === 'deleted') return;
      if (processedKeys.has(post.date_key)) return;

      const parts = post.date_key.split('-');
      const d = parts[0];
      const m = parts[1];
      const y = parts[2];
      const platform = parts[3] as 'meta' | 'linkedin';
      
      const postMonthName = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
        .toLocaleString('pt-BR', { month: 'long' })
        .toUpperCase();
        
      if (!plan.month.toUpperCase().includes(postMonthName)) return;

      const dateStr = `${d}/${m}`;
      const newContent: DailyContent = {
        day: `${dateStr} – (Novo)`,
        platform: platform,
        type: post.type || 'Post Novo',
        theme: post.theme || 'Sem tema definido',
        bullets: post.bullets || [],
        initialImageUrl: post.image_url || undefined
      };

      tempPosts.push({
        content: newContent,
        key: post.date_key,
        sortDate: new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getTime()
      });
    });

    tempPosts.sort((a, b) => a.sortDate - b.sortDate);
    setMergedPosts(tempPosts);
    
    // --- LÓGICA DE AGRUPAMENTO ---
    // Agrupa posts que são do mesmo dia e têm temas similares (ou são contrapartes)
    const groups: GroupedPost[] = [];
    const usedIndices = new Set<number>();

    tempPosts.forEach((post, i) => {
        if (usedIndices.has(i)) return;

        const dbPost = dbPosts[post.key];
        const currentTheme = dbPost?.theme || post.content.theme;
        
        // Inicializa o grupo com o post atual
        const group: GroupedPost = {
            primaryKey: post.key,
            keys: [post.key],
            platforms: [post.content.platform],
            content: post.content,
            status: dbPost?.status || 'draft',
            theme: currentTheme,
            type: dbPost?.type || post.content.type,
            bullets: dbPost?.bullets || post.content.bullets || []
        };
        
        usedIndices.add(i);

        // Tenta encontrar pares no restante da lista (mesmo dia, tema idêntico)
        for (let j = i + 1; j < tempPosts.length; j++) {
            if (usedIndices.has(j)) continue;
            
            const other = tempPosts[j];
            const otherDb = dbPosts[other.key];
            const otherTheme = otherDb?.theme || other.content.theme;
            
            // Verifica se é mesmo dia (pela sortDate)
            if (other.sortDate === post.sortDate) {
                 // Verifica se é a "contraparte" (tema igual ou chaves compatíveis)
                 // Simplificação: Se for mesmo dia e mesmo tema, agrupa.
                 if (otherTheme === currentTheme) {
                     group.keys.push(other.key);
                     if (!group.platforms.includes(other.content.platform)) {
                         group.platforms.push(other.content.platform);
                     }
                     // Se um dos posts não estiver publicado, o grupo todo não está "pronto" visualmente (prioriza status de atenção)
                     const s1 = group.status;
                     const s2 = otherDb?.status || 'draft';
                     
                     // Hierarquia de visualização de status: 
                     // changes_requested > pending > draft > approved > published
                     if (s2 === 'changes_requested') group.status = 'changes_requested';
                     else if (s2 === 'pending_approval' && s1 !== 'changes_requested') group.status = 'pending_approval';
                     else if (s2 === 'draft' && s1 !== 'changes_requested' && s1 !== 'pending_approval') group.status = 'draft';
                     
                     usedIndices.add(j);
                 }
            }
        }
        groups.push(group);
    });

    setGroupedPosts(groups);

  }, [dbPosts, plan]);


  // Handlers
  const handleDragStart = (e: React.DragEvent, key: string) => {
      e.dataTransfer.setData('text/plain', key);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDay: number) => {
      e.preventDefault();
      const key = e.dataTransfer.getData('text/plain');
      if (key) {
          await movePost(key, targetDay);
      }
  };

  const movePost = async (originalKey: string, targetDay: number) => {
      const postGroup = groupedPosts.find(g => g.primaryKey === originalKey);
      if (!postGroup || !plan) return;

      const monthMap: { [key: string]: string } = {
          'JANEIRO': '01', 'FEVEREIRO': '02', 'MARÇO': '03', 'ABRIL': '04', 'MAIO': '05', 'JUNHO': '06',
          'JULHO': '07', 'AGOSTO': '08', 'SETEMBRO': '09', 'OUTUBRO': '10', 'NOVEMBRO': '11', 'DEZEMBRO': '12'
       };
      const monthStr = plan.month.split(' ')[0].toUpperCase();
      const yearStr = plan.month.split(' ')[1];
      const m = monthMap[monthStr];
      const y = yearStr;
      const d = targetDay < 10 ? `0${targetDay}` : `${targetDay}`;

      // Check if moving to same day
      const originalDay = parseInt(originalKey.split('-')[0]);
      if (originalDay === targetDay) return;

      if (!confirm(`Mover publicação para o dia ${d}/${m}?`)) return;

      setLoadingPosts(true);
      try {
          for (const oldKey of postGroup.keys) {
              const parts = oldKey.split('-');
              // Format: DD-MM-YYYY-platform[-timestamp]
              // platform is at index 3 usually, but let's be safe
              // If oldKey is 20-02-2026-meta, parts[3] is meta.
              const platform = parts[3]; 
              
              const newKey = `${d}-${m}-${y}-${platform}-${Date.now()}`;

              const dbPost = dbPosts[oldKey];
              
              const payload = {
                  date_key: newKey,
                  status: dbPost?.status || 'draft',
                  theme: dbPost?.theme || postGroup.theme,
                  type: dbPost?.type || postGroup.type,
                  bullets: dbPost?.bullets || postGroup.bullets,
                  image_url: dbPost?.image_url || postGroup.content.initialImageUrl || null,
                  caption: dbPost?.caption || null,
                  last_updated: new Date().toISOString()
              };

              // 1. Create New
              const { error: insertError } = await supabase.from('posts').insert(payload);
              if (insertError) throw insertError;

              // 2. Delete Old
              const { error: deleteError } = await supabase.from('posts').upsert({
                  date_key: oldKey,
                  status: 'deleted',
                  last_updated: new Date().toISOString()
              });
              if (deleteError) throw deleteError;
              
              // 3. Move Comments
              await supabase.from('comments').update({ post_id: newKey }).eq('post_id', oldKey);
          }
          
          await fetchMonthPosts();
      } catch (error) {
          console.error(error);
          alert("Erro ao mover publicação.");
      } finally {
          setLoadingPosts(false);
      }
  };

  const handleOpenPost = (item: { content: DailyContent, key: string }) => {
    setSelectedPost(item);
    setIsCreatingNew(false);
    setModalOpen(true);
  };

  const handleCreatePost = (day?: number) => {
    if (day && plan) {
       const monthMap: { [key: string]: string } = {
          'JANEIRO': '01', 'FEVEREIRO': '02', 'MARÇO': '03', 'ABRIL': '04', 'MAIO': '05', 'JUNHO': '06',
          'JULHO': '07', 'AGOSTO': '08', 'SETEMBRO': '09', 'OUTUBRO': '10', 'NOVEMBRO': '11', 'DEZEMBRO': '12'
       };
       const monthStr = plan.month.split(' ')[0].toUpperCase();
       const yearStr = plan.month.split(' ')[1];
       const dStr = day < 10 ? `0${day}` : `${day}`;
       setNewPostDefaultDate(`${yearStr}-${monthMap[monthStr]}-${dStr}`); 
    } else {
       setNewPostDefaultDate('');
    }
    
    const emptyContent: DailyContent = {
       day: 'Nova Data',
       platform: 'meta',
       type: 'Estático',
       theme: '',
       bullets: []
    };
    
    setSelectedPost({ content: emptyContent, key: 'new' });
    setIsCreatingNew(true);
    setModalOpen(true);
  };

  const handleQuickPublish = async (e: React.MouseEvent, group: GroupedPost) => {
    e.stopPropagation();
    if (userRole !== 'admin') return;
    if (group.status === 'published') return;

    if (!confirm("Marcar esta publicação (todas as plataformas) como PUBLICADA?")) return;

    try {
        setLoadingPosts(true);
        
        // Itera sobre todas as chaves do grupo (Meta e LinkedIn se existirem)
        for (const key of group.keys) {
             const dbPost = dbPosts[key];
             
             const payload: any = {
                date_key: key,
                status: 'published',
                last_updated: new Date().toISOString(),
             };

             if (!dbPost) {
                // Se era estático puro, copia dados para persistir
                payload.theme = group.theme;
                payload.type = group.type;
                payload.bullets = group.bullets;
                payload.image_url = group.content.initialImageUrl || null;
             }
             
             await supabase.from('posts').upsert(payload, { onConflict: 'date_key' });
        }
        
        await fetchMonthPosts(); 
    } catch (err) {
        console.error(err);
        alert("Erro ao publicar.");
        setLoadingPosts(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedPost(null);
  };

  // --- RENDERS ---

  if (!plan) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Planejamento em desenvolvimento</h2>
        <button onClick={onBack} className="px-6 py-2 bg-gray-100 rounded-lg">Voltar</button>
      </div>
    );
  }

  const getStatusLabel = (s: PostStatus) => {
    switch(s) {
      case 'draft': return 'Em Produção';
      case 'pending_approval': return 'Em Aprovação';
      case 'changes_requested': return 'Ajustes';
      case 'internal_review': return 'Discussão';
      case 'approved': return 'Aprovado';
      case 'scheduled': return 'Agendado';
      case 'published': return 'Publicado';
      default: return 'Em Produção';
    }
  };

  const getStatusColorClass = (status: PostStatus) => {
    switch(status) {
      case 'draft': return 'bg-gray-100 border-gray-200 hover:bg-gray-200';
      case 'pending_approval': return 'bg-orange-100 border-orange-200 hover:bg-orange-200';
      case 'changes_requested': return 'bg-red-100 border-red-200 hover:bg-red-200';
      case 'internal_review': return 'bg-purple-100 border-purple-200 hover:bg-purple-200';
      case 'approved': return 'bg-blue-100 border-blue-200 hover:bg-blue-200';
      case 'scheduled': return 'bg-purple-100 border-purple-200 hover:bg-purple-200'; 
      case 'published': return 'bg-green-100 border-green-200 hover:bg-green-200'; 
      default: return 'bg-gray-50 border-gray-100';
    }
  };

  // --- CALENDAR RENDERER ---
  const renderCalendar = () => {
    const monthMap: { [key: string]: number } = {
      'JANEIRO': 0, 'FEVEREIRO': 1, 'MARÇO': 2, 'ABRIL': 3, 'MAIO': 4, 'JUNHO': 5,
      'JULHO': 6, 'AGOSTO': 7, 'SETEMBRO': 8, 'OUTUBRO': 9, 'NOVEMBRO': 10, 'DEZEMBRO': 11
    };
    const [monthStr, yearStr] = plan.month.split(' ');
    const monthIndex = monthMap[monthStr.toUpperCase()];
    const year = parseInt(yearStr);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, monthIndex, 1).getDay(); 

    const calendarCells = [];

    // Empty Start
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarCells.push(<div key={`empty-start-${i}`} className="bg-gray-50/30 border-b border-r border-gray-100 min-h-[200px]"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dayString = d < 10 ? `0${d}` : `${d}`;
      const monthNum = monthIndex + 1;
      const monthString = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
      
      // Filtrar posts do dia (usando groupedPosts)
      const dayEvents = groupedPosts.filter(p => {
         const pDate = p.primaryKey.split('-').slice(0, 2).join('/');
         return pDate === `${dayString}/${monthString}`;
      });

      calendarCells.push(
        <div 
          key={`day-${d}`} 
          className="bg-white border-b border-r border-gray-100 min-h-[200px] p-2 relative group hover:bg-gray-50/50 transition-colors"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, d)}
        >
          <div className="flex justify-between items-start mb-2">
            <span className={`text-sm font-semibold ${dayEvents.length > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{d}</span>
            {userRole === 'admin' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleCreatePost(d); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-500 transition-all p-1"
                  title="Criar publicação neste dia"
                >
                  <Plus size={16} />
                </button>
            )}
          </div>
          
          <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
            {dayEvents.map((group, idx) => {
               const statusColor = getStatusColorClass(group.status);
               const hasMeta = group.platforms.includes('meta');
               const hasLinkedin = group.platforms.includes('linkedin');

               return (
                <div 
                  key={idx}
                  onClick={() => handleOpenPost({ content: group.content, key: group.primaryKey })}
                  className={`p-2 rounded-lg border shadow-sm cursor-pointer hover:scale-[1.02] ${statusColor} relative group/card shrink-0 transition-transform`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, group.primaryKey)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {/* Renderiza ambos os ícones se tiver as duas plataformas */}
                      {hasMeta && <Instagram size={12} className="text-[#E1306C]" />}
                      {hasLinkedin && <Linkedin size={12} className="text-[#0077B5]" />}
                      
                      <span className="text-[9px] font-bold uppercase opacity-70 truncate max-w-[60px] ml-1">
                        {group.type.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-gray-900 leading-tight line-clamp-2 mb-1" title={group.theme}>
                    {group.theme}
                  </p>
                  <div className="flex items-center justify-between mt-1 h-5">
                      <span className="text-[8px] font-bold uppercase text-gray-500 border border-black/10 px-1 rounded bg-white/40">
                         {getStatusLabel(group.status)}
                      </span>
                      {userRole === 'admin' && group.status !== 'published' && (
                          <button 
                             onClick={(e) => handleQuickPublish(e, group)}
                             className="opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 p-1 rounded bg-white text-gray-400 hover:text-green-600 hover:bg-green-50 shadow-sm border border-gray-200 transition-all"
                             title="Marcar como Publicado"
                          >
                              <Check size={12} />
                          </button>
                      )}
                  </div>
                </div>
               );
            })}
          </div>
        </div>
      );
    }

    // Empty End
    const totalCells = calendarCells.length;
    const remainingCells = 7 - (totalCells % 7);
    if (remainingCells < 7) {
      for (let i = 0; i < remainingCells; i++) {
        calendarCells.push(<div key={`empty-end-${i}`} className="bg-gray-50/30 border-b border-r border-gray-100 min-h-[200px]"></div>);
      }
    }

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d, i) => (
            <div key={d} className={`py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-widest ${i === 0 || i === 6 ? 'bg-gray-100/50 text-gray-400' : ''}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">{calendarCells}</div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {modalOpen && selectedPost && (
        <PostModal 
          dayContent={selectedPost.content} 
          dateKey={selectedPost.key} 
          onClose={handleCloseModal}
          onUpdate={fetchMonthPosts}
          isNew={isCreatingNew} 
          defaultDate={newPostDefaultDate}
        />
      )}

      {/* Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-brand-dark transition-colors font-medium">
          <ArrowLeft size={20} /> Voltar
        </button>

        <div className="flex items-center gap-4">
            {loadingPosts && <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 size={14} className="animate-spin" /> Atualizando...</div>}
            
            {userRole === 'admin' && (
                <button 
                  onClick={() => handleCreatePost()}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-green text-white rounded-md text-xs font-bold uppercase shadow-sm hover:bg-green-600 transition-all"
                >
                    <Plus size={16} /> Criar Post
                </button>
            )}

            <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase transition-all ${viewMode === 'list' ? 'bg-brand-dark text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <List size={14} /> Lista
                </button>
                <button onClick={() => setViewMode('calendar')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase transition-all ${viewMode === 'calendar' ? 'bg-brand-dark text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <CalendarIcon size={14} /> Calendário
                </button>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-brand-dark text-white p-8 md:p-10 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10"><CalendarDays size={200} /></div>
           <div className="relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight mb-2">{plan.month}</h2>
            <div className="inline-block bg-white/10 backdrop-blur-sm px-3 py-1 rounded border border-white/20 text-blue-200 text-xs font-bold uppercase tracking-[0.2em] mb-6">Tema: {plan.theme}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
               <div>
                  <h4 className="flex items-center gap-2 text-brand-green font-bold text-sm uppercase tracking-wider mb-2"><Target size={16} /> Objetivo</h4>
                  <p className="text-gray-300 leading-relaxed">{plan.objective}</p>
               </div>
               <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <h4 className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider mb-3"><BarChart3 size={16} /> Visão Geral</h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-purple-300 font-bold uppercase mb-1">Meta</p>
                      <ul className="text-sm text-gray-400 space-y-1">{plan.overview.meta.map((item, i) => <li key={i}>• {item}</li>)}</ul>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-10 bg-gray-50/50">
           <StatusLegend />
           {viewMode === 'list' ? (
             <div className="flex flex-col gap-4">
                {groupedPosts.map((group, idx) => {
                   const statusColor = getStatusColorClass(group.status);
                   const hasMeta = group.platforms.includes('meta');
                   const hasLinkedin = group.platforms.includes('linkedin');

                   const targetDay = parseInt(group.content.day.split('/')[0]);
                   
                   return (
                      <div 
                        key={idx} 
                        onClick={() => handleOpenPost({ content: group.content, key: group.primaryKey })} 
                        className={`p-4 rounded-xl border flex gap-4 cursor-pointer hover:shadow-md transition-all ${statusColor} items-center`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, group.primaryKey)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, targetDay)}
                      >
                         <div className="w-24 flex-shrink-0">
                            <span className="font-bold text-gray-900 block">{group.content.day.split(' – ')[0]}</span>
                            <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-1">
                               {hasMeta && <Instagram size={12} className="text-[#E1306C]" />}
                               {hasLinkedin && <Linkedin size={12} className="text-[#0077B5]" />}
                               <span className="capitalize text-[10px]">{group.platforms.length > 1 ? 'Multi' : group.platforms[0]}</span>
                            </div>
                            <span className="inline-block mt-2 px-2 py-0.5 rounded text-[9px] font-bold border border-black/10 bg-white/50 uppercase text-gray-700">{getStatusLabel(group.status)}</span>
                         </div>
                         <div className="flex-grow">
                            <span className="text-xs font-bold px-2 py-0.5 rounded border bg-white/50 border-black/10 text-gray-800 mb-2 inline-block">📌 {group.type}</span>
                            <h4 className="font-bold text-gray-900 mb-1">{group.theme}</h4>
                            {group.bullets && group.bullets.length > 0 && <p className="text-xs text-gray-600 line-clamp-2">{group.bullets.join(' • ')}</p>}
                         </div>
                         {userRole === 'admin' && group.status !== 'published' && (
                            <button 
                                onClick={(e) => handleQuickPublish(e, group)}
                                className="flex items-center gap-2 px-3 py-2 bg-white text-gray-500 border border-gray-200 rounded-lg hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-all shadow-sm ml-4"
                                title="Publicar Agora"
                            >
                                <Check size={16} /> <span className="text-xs font-bold">Publicar</span>
                            </button>
                         )}
                      </div>
                   )
                })}
             </div>
           ) : renderCalendar()}
        </div>
      </div>
    </div>
  );
};

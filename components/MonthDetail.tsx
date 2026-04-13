
import React, { useState, useEffect, useCallback } from 'react';
import { MonthlyDetailedPlan, DailyContent, PostStatus, PostData } from '../types';
import { Instagram, Linkedin, CalendarDays, Target, BarChart3, Repeat, FileCheck, CheckCircle2, ArrowLeft, MessageCircle, List, Calendar as CalendarIcon, Plus, Loader2, Check, Edit2, Save, X, Trash, Sparkles } from 'lucide-react';
import { PostModal } from './PostModal';
import { PostIdeasModal } from './PostIdeasModal';
import { useAuth, supabase } from '../lib/supabase';
import { StatusLegend } from './StatusLegend';
import { ConfirmModal } from './ConfirmModal';
import { useEditorialData, MONTH_NAMES, DAY_NAMES } from '../hooks/useEditorialData';
import { motion, AnimatePresence } from 'motion/react';

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
  const { userRole, activeClient } = useAuth();
  const { monthlyPlans, weeklySchedule, updateMonthlyPlan, loading: loadingEditorial } = useEditorialData();
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{content: DailyContent, key: string} | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPostDefaultDate, setNewPostDefaultDate] = useState<string>('');

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  
  // Confirm Action State
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmButtonColor?: 'red' | 'brand';
    confirmText?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  // Data States
  const [dbPosts, setDbPosts] = useState<Record<string, PostData>>({});
  const [mergedPosts, setMergedPosts] = useState<Array<{ content: DailyContent, key: string, sortDate: number }>>([]);
  const [groupedPosts, setGroupedPosts] = useState<GroupedPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Edit State
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editTheme, setEditTheme] = useState('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  
  // Post Ideas State
  const [showPostIdeas, setShowPostIdeas] = useState(false);

  // Selection State
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const currentPlan = monthlyPlans.find(p => MONTH_NAMES[p.month - 1].toLowerCase() === monthName.toLowerCase());
  const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
  const year = 2026;

  // 1. Helper: Gerar chave única
  const getDateKey = (day: string, platform: string) => {
     const datePart = day.split(' ')[0].replace('/', '-');
     return `${datePart}-${year}-${platform}-${activeClient?.id}`; 
  };

  // 2. Buscar Dados do Supabase
  const fetchMonthPosts = useCallback(async () => {
    if (!currentPlan) return;
    setLoadingPosts(true);
    
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('client_id', activeClient?.id);

    const postsMap: Record<string, PostData> = {};
    if (data) {
      data.forEach((post: PostData) => {
        postsMap[post.date_key] = post;
      });
    }
    setDbPosts(postsMap);
    setLoadingPosts(false);
  }, [currentPlan, activeClient]);

  useEffect(() => {
    fetchMonthPosts();
  }, [fetchMonthPosts]);

  // 3. Mesclar Posts Estáticos + Posts do Banco
  useEffect(() => {
    if (!currentPlan || monthIndex === -1) return;

    const tempPosts: Array<{ content: DailyContent, key: string, sortDate: number }> = [];
    const processedKeys = new Set<string>();

    // A. Adicionar Posts Estáticos (gerados a partir da agenda semanal)
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, monthIndex, d);
      const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      
      // Map JS getDay() to our day_of_week (1=Mon, ..., 5=Fri, 6=Sat, 7=Sun)
      const mappedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

      const scheduleItems = weeklySchedule.filter(s => s.day_of_week === mappedDayOfWeek);
      
      scheduleItems.forEach(item => {
        const dayString = d < 10 ? `0${d}` : `${d}`;
        const monthString = (monthIndex + 1) < 10 ? `0${monthIndex + 1}` : `${monthIndex + 1}`;
        const dayFormatted = `${dayString}/${monthString}`;
        
        const key = getDateKey(`${dayFormatted} – ${DAY_NAMES[mappedDayOfWeek]}`, item.platform);
        const dbPost = dbPosts[key];
        if (dbPost && dbPost.status === 'deleted') return;

        processedKeys.add(key);
        const sortDate = date.getTime();

        const content: DailyContent = {
          day: `${dayFormatted} – ${DAY_NAMES[mappedDayOfWeek]}`,
          platform: item.platform as 'meta' | 'linkedin',
          type: item.content_type || 'Post',
          theme: item.theme || 'Tema',
          bullets: item.description ? [item.description] : []
        };

        tempPosts.push({
          content,
          key,
          sortDate
        });
      });
    }

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
        
      if (!MONTH_NAMES[currentPlan.month - 1].toUpperCase().includes(postMonthName)) return;

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

  }, [dbPosts, currentPlan, weeklySchedule, monthIndex]);


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
      if (!postGroup || !currentPlan) return;

      const m = (monthIndex + 1) < 10 ? `0${monthIndex + 1}` : `${monthIndex + 1}`;
      const y = year.toString();
      const d = targetDay < 10 ? `0${targetDay}` : `${targetDay}`;

      // Check if moving to same day
      const originalDay = parseInt(originalKey.split('-')[0]);
      if (originalDay === targetDay) return;

      setConfirmAction({
        isOpen: true,
        title: 'Mover Publicação',
        message: `Tem certeza que deseja mover esta publicação para o dia ${d}/${m}?`,
        confirmText: 'Mover',
        confirmButtonColor: 'brand',
        onConfirm: async () => {
          setConfirmAction(prev => ({ ...prev, isOpen: false }));
          setLoadingPosts(true);
          try {
              const timestamp = Date.now();
              for (const oldKey of postGroup.keys) {
                  const parts = oldKey.split('-');
                  // Format: DD-MM-YYYY-platform[-timestamp]
                  // platform is at index 3 usually, but let's be safe
                  // If oldKey is 20-02-2026-meta, parts[3] is meta.
                  const platform = parts[3]; 
                  
                  const newKey = `${d}-${m}-${y}-${platform}-${timestamp}`;

                  const dbPost = dbPosts[oldKey];
                  
                  const payload = {
                      date_key: newKey,
                      client_id: activeClient?.id,
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

                  // 2. Delete Old (Hide)
                  // We must provide enough data to satisfy constraints if this is a new insert (hiding a static post)
                  const deletePayload = {
                      date_key: oldKey,
                      client_id: activeClient?.id,
                      status: 'deleted',
                      last_updated: new Date().toISOString(),
                      // Include other fields just in case they are required
                      theme: dbPost?.theme || postGroup.theme,
                      type: dbPost?.type || postGroup.type,
                      bullets: dbPost?.bullets || postGroup.bullets,
                      image_url: dbPost?.image_url || postGroup.content.initialImageUrl || null,
                      caption: dbPost?.caption || null
                  };

                  const { error: deleteError } = await supabase.from('posts').upsert(deletePayload, { onConflict: 'date_key' });
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
        }
      });
  };

  const handleOpenPost = (item: { content: DailyContent, key: string }) => {
    setSelectedPost(item);
    setIsCreatingNew(false);
    setModalOpen(true);
  };

  const handleCreatePost = (day?: number) => {
    if (day && currentPlan) {
       const m = (monthIndex + 1) < 10 ? `0${monthIndex + 1}` : `${monthIndex + 1}`;
       const y = year.toString();
       const dStr = day < 10 ? `0${day}` : `${day}`;
       setNewPostDefaultDate(`${y}-${m}-${dStr}`); 
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

    setConfirmAction({
      isOpen: true,
      title: 'Publicar',
      message: 'Marcar esta publicação (todas as plataformas) como PUBLICADA?',
      confirmText: 'Publicar',
      confirmButtonColor: 'brand',
      onConfirm: async () => {
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        try {
            setLoadingPosts(true);
            
            // Itera sobre todas as chaves do grupo (Meta e LinkedIn se existirem)
            for (const key of group.keys) {
                 const dbPost = dbPosts[key];
                 
                 const payload: any = {
                    date_key: key,
                    client_id: activeClient?.id,
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
      }
    });
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedPost(null);
  };

  const togglePostSelection = (e: React.MouseEvent, primaryKey: string) => {
    e.stopPropagation();
    const newSelection = new Set(selectedPosts);
    if (newSelection.has(primaryKey)) {
      newSelection.delete(primaryKey);
    } else {
      newSelection.add(primaryKey);
    }
    setSelectedPosts(newSelection);
  };

  const handleBulkDelete = async () => {
    if (selectedPosts.size === 0) return;
    
    setConfirmAction({
      isOpen: true,
      title: 'Excluir Publicações',
      message: `Tem certeza que deseja excluir ${selectedPosts.size} publicação(ões)?`,
      confirmText: 'Excluir',
      confirmButtonColor: 'red',
      onConfirm: async () => {
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        setIsDeleting(true);
        
        const payloads: any[] = [];
        groupedPosts.forEach(group => {
          if (selectedPosts.has(group.primaryKey)) {
            group.keys.forEach(key => {
              const dbPost = dbPosts[key];
              const payload: any = {
                date_key: key,
                client_id: activeClient?.id,
                status: 'deleted',
                last_updated: new Date().toISOString()
              };

              if (!dbPost) {
                payload.theme = group.theme;
                payload.type = group.type;
                payload.bullets = group.bullets;
                payload.image_url = group.content.initialImageUrl || null;
              }

              payloads.push(payload);
            });
          }
        });

        if (payloads.length > 0) {
          const { error } = await supabase
            .from('posts')
            .upsert(payloads, { onConflict: 'date_key' });
            
          if (error) {
            console.error("Erro ao excluir publicações:", error);
            alert("Erro ao excluir publicações.");
          } else {
            setSelectedPosts(new Set());
            fetchMonthPosts();
          }
        }
        setIsDeleting(false);
      }
    });
  };

  const handleEditPlan = () => {
    if (!currentPlan) return;
    setEditTheme(currentPlan.theme || '');
    setIsEditingPlan(true);
  };

  const handleSavePlan = async () => {
    if (!currentPlan) return;
    setIsSavingPlan(true);
    
    const success = await updateMonthlyPlan(currentPlan.id, {
      theme: editTheme
    });

    if (success) {
      setIsEditingPlan(false);
    } else {
      alert("Erro ao salvar o plano mensal.");
    }
    setIsSavingPlan(false);
  };

  // --- RENDERS ---

  if (loadingEditorial) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-green" />
      </div>
    );
  }

  if (!currentPlan) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Plano não encontrado para este mês</h2>
        <button onClick={onBack} className="px-6 py-2 bg-gray-100 rounded-lg">Voltar</button>
      </div>
    );
  }

  const getStatusLabel = (s: PostStatus) => {
    switch(s) {
      case 'draft': return 'Em Produção';
      case 'pending_approval': return 'Esperando Aprovação';
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
      case 'changes_requested': return 'bg-yellow-100 border-yellow-200 hover:bg-yellow-200';
      case 'rejected': return 'bg-rose-100 border-rose-200 hover:bg-rose-200';
      case 'internal_review': return 'bg-purple-100 border-purple-200 hover:bg-purple-200';
      case 'approved': return 'bg-blue-100 border-blue-200 hover:bg-blue-200';
      case 'scheduled': return 'bg-purple-100 border-purple-200 hover:bg-purple-200'; 
      case 'published': return 'bg-green-100 border-green-200 hover:bg-green-200'; 
      default: return 'bg-gray-50 border-gray-100';
    }
  };

  // --- CALENDAR RENDERER ---
  const renderCalendar = () => {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, monthIndex, 1).getDay(); 

    const calendarCells = [];

    // Empty Start
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarCells.push(<div key={`empty-start-${i}`} className="hidden md:block bg-gray-50/30 border-b border-r border-gray-100 min-h-[200px]"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dayString = d < 10 ? `0${d}` : `${d}`;
      const monthNum = monthIndex + 1;
      const monthString = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
      
      const dayOfWeek = new Date(year, monthIndex, d).getDay();
      const dayName = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][dayOfWeek];

      // Filtrar posts do dia (usando groupedPosts)
      const dayEvents = groupedPosts.filter(p => {
         const pDate = p.primaryKey.split('-').slice(0, 2).join('/');
         return pDate === `${dayString}/${monthString}`;
      });

      calendarCells.push(
        <div 
          key={`day-${d}`} 
          className="bg-white border-b border-r border-gray-100 min-h-[120px] md:min-h-[200px] p-3 md:p-2 relative group hover:bg-gray-50/50 transition-colors"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, d)}
        >
          <div className="flex justify-between items-start mb-3 md:mb-2">
            <span className={`text-sm font-semibold ${dayEvents.length > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
              {d} <span className="md:hidden text-[10px] font-normal ml-1 text-gray-400">{dayName}</span>
            </span>
            {userRole === 'admin' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleCreatePost(d); }}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-gray-400 hover:text-blue-500 transition-all p-1"
                  title="Criar publicação neste dia"
                >
                  <Plus size={16} />
                </button>
            )}
          </div>
          
          <div className="flex flex-col gap-2 max-h-[300px] md:max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
            {dayEvents.map((group, idx) => {
               const statusColor = getStatusColorClass(group.status);
               const hasMeta = group.platforms.includes('meta');
               const hasLinkedin = group.platforms.includes('linkedin');
               const isSelected = selectedPosts.has(group.primaryKey);

               return (
                <div 
                  key={idx}
                  onClick={() => handleOpenPost({ content: group.content, key: group.primaryKey })}
                  className={`p-3 rounded-xl border shadow-sm cursor-pointer hover:scale-[1.02] ${statusColor} ${isSelected ? 'ring-2 ring-brand-dark' : ''} relative group/card shrink-0 transition-all duration-300`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, group.primaryKey)}
                >
                  {userRole === 'admin' && (
                    <div 
                      className={`absolute -top-2 -right-2 z-10 bg-white rounded-full p-1 shadow-md border ${isSelected ? 'border-brand-dark opacity-100' : 'border-gray-200 opacity-0 group-hover/card:opacity-100'} transition-all`}
                      onClick={(e) => togglePostSelection(e, group.primaryKey)}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'bg-brand-dark border-brand-dark' : 'border-gray-300'}`}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {/* Renderiza ambos os ícones se tiver as duas plataformas */}
                      <div className="flex -space-x-1">
                        {hasMeta && <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm border border-black/[0.03]"><Instagram size={10} className="text-[#E1306C]" /></div>}
                        {hasLinkedin && <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm border border-black/[0.03]"><Linkedin size={10} className="text-[#0077B5]" /></div>}
                      </div>
                      
                      <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 truncate max-w-[50px]">
                        {group.type.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-brand-dark leading-tight line-clamp-2 mb-2" title={group.theme}>
                    {group.theme}
                  </p>
                  <div className="flex items-center justify-between mt-2 h-6">
                      <span className="text-[7px] font-bold uppercase tracking-widest text-gray-500 border border-black/[0.05] px-1.5 py-0.5 rounded-md bg-white/50 backdrop-blur-sm">
                         {getStatusLabel(group.status)}
                      </span>
                      {userRole === 'admin' && group.status !== 'published' && (
                          <button 
                             onClick={(e) => handleQuickPublish(e, group)}
                             className="opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 p-1.5 rounded-lg bg-white text-gray-400 hover:text-green-600 hover:bg-green-50 shadow-sm border border-black/[0.03] transition-all"
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
        calendarCells.push(<div key={`empty-end-${i}`} className="hidden md:block bg-gray-50/30 border-b border-r border-gray-100 min-h-[200px]"></div>);
      }
    }

    return (
      <div className="bg-white rounded-3xl border border-black/[0.03] shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="hidden md:grid grid-cols-7 bg-gray-50/50 border-b border-black/[0.03]">
          {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d, i) => (
            <div key={d} className={`py-5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] ${i === 0 || i === 6 ? 'bg-gray-100/30 text-gray-300' : ''}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-7">{calendarCells}</div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="pb-12"
    >
      
      <AnimatePresence>
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
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-6 mb-8 sm:mb-10">
        <motion.button 
          whileHover={{ x: -4 }}
          onClick={onBack} 
          className="flex items-center gap-2 sm:gap-4 text-gray-400 hover:text-brand-dark transition-all font-bold text-[10px] sm:text-[11px] uppercase tracking-[0.3em] group"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-black/[0.05] flex items-center justify-center group-hover:border-brand-dark group-hover:bg-brand-dark group-hover:text-white transition-all duration-300">
            <ArrowLeft size={14} className="sm:w-4 sm:h-4" />
          </div>
          <span className="hidden sm:inline">Voltar</span>
        </motion.button>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {loadingPosts && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest"
              >
                <Loader2 size={12} className="animate-spin" /> Atualizando...
              </motion.div>
            )}
            
            {userRole === 'admin' && selectedPosts.size > 0 && (
                <motion.button 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="premium-button-secondary bg-red-50 text-red-600 border-red-100 hover:bg-red-100 px-4 sm:px-6 py-2 sm:py-3 text-[9px] sm:text-[10px]"
                >
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash size={14} />} 
                    <span className="hidden sm:inline">Excluir ({selectedPosts.size})</span>
                </motion.button>
            )}

            {userRole === 'admin' && (
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleCreatePost()}
                  className="premium-button-primary px-4 sm:px-6 py-2 sm:py-3 text-[9px] sm:text-[10px] whitespace-nowrap"
                >
                    <Plus size={14} /> Criar Post
                </motion.button>
            )}

            <div className="hidden md:flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                <span className="text-[9px] uppercase tracking-widest text-gray-400 font-bold ml-1 sm:ml-0">Modo de Visualização:</span>
                <div className="flex bg-white rounded-xl sm:rounded-2xl p-1 sm:p-1.5 border border-black/[0.03] shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
                    <button onClick={() => setViewMode('list')} className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${viewMode === 'list' ? 'bg-brand-dark text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>
                        <List size={14} /> <span>Lista</span>
                    </button>
                    <button onClick={() => setViewMode('calendar')} className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${viewMode === 'calendar' ? 'bg-brand-dark text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>
                        <CalendarIcon size={14} /> <span>Calendário</span>
                    </button>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-[0_40px_80px_rgba(0,0,0,0.08)] border border-black/[0.02] overflow-hidden">
        {/* Header */}
        <div className="bg-brand-dark text-white p-8 md:p-12 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none transform translate-x-1/4 -translate-y-1/4"><CalendarDays size={400} /></div>
           <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">
                  <Sparkles size={14} /> Planejamento Mensal
                </div>
                <h2 className="text-5xl md:text-7xl font-serif font-medium tracking-tight italic leading-none">
                  {monthName} <span className="not-italic font-sans font-bold opacity-20">{year}</span>
                </h2>
              </div>
              
              <div className="flex items-center gap-3">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setShowPostIdeas(true)}
                  className="flex items-center gap-3 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all backdrop-blur-md border border-white/10 shadow-xl"
                >
                  <Sparkles size={14} /> Ideias de Publicações
                </motion.button>
                {userRole === 'admin' && !isEditingPlan && (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    onClick={handleEditPlan}
                    className="flex items-center gap-3 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all backdrop-blur-md border border-white/10 shadow-xl"
                  >
                    <Edit2 size={14} /> Editar Plano
                  </motion.button>
                )}
              </div>
            </div>

            {isEditingPlan ? (
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 mt-6 space-y-4 backdrop-blur-xl">
                <div>
                  <label className="premium-label text-white/60 mb-2 block">Tema do Mês</label>
                  <input 
                    type="text" 
                    value={editTheme} 
                    onChange={e => setEditTheme(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-white/40 transition-all font-medium"
                    placeholder="Ex: Inovação e Segurança"
                  />
                </div>
                <div className="flex justify-end gap-4 mt-6">
                  <button 
                    onClick={() => setIsEditingPlan(false)}
                    className="flex items-center gap-2 px-6 py-3 bg-transparent hover:bg-white/5 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    <X size={14} /> Cancelar
                  </button>
                  <button 
                    onClick={handleSavePlan}
                    disabled={isSavingPlan}
                    className="flex items-center gap-2 px-8 py-3 bg-white text-brand-dark hover:bg-gray-100 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 shadow-xl"
                  >
                    {isSavingPlan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 
                    Salvar Alterações
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white/80 text-[10px] font-bold uppercase tracking-[0.2em] mb-6 mt-2">
                  <Target size={12} className="text-white/40" />
                  Tema: <span className="text-white">{currentPlan.theme || 'Não definido'}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-10 bg-gray-50/50">
           <StatusLegend />
           <div className={viewMode === 'list' ? 'block' : 'block md:hidden'}>
             <div className="flex flex-col gap-4">
                {groupedPosts.map((group, idx) => {
                   const statusColor = getStatusColorClass(group.status);
                   const hasMeta = group.platforms.includes('meta');
                   const hasLinkedin = group.platforms.includes('linkedin');
                   const isSelected = selectedPosts.has(group.primaryKey);

                   const targetDay = parseInt(group.content.day.split('/')[0]);
                   
                   return (
                      <div 
                        key={idx} 
                        onClick={() => handleOpenPost({ content: group.content, key: group.primaryKey })} 
                        className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 cursor-pointer hover:shadow-md transition-all ${statusColor} ${isSelected ? 'ring-2 ring-brand-dark' : ''} md:items-center relative group`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, group.primaryKey)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, targetDay)}
                      >
                         {userRole === 'admin' && (
                           <div 
                             className={`absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center -ml-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                             onClick={(e) => togglePostSelection(e, group.primaryKey)}
                           >
                             <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-brand-dark border-brand-dark' : 'border-gray-400 bg-white'}`}>
                               {isSelected && <Check size={14} className="text-white" />}
                             </div>
                           </div>
                         )}
                         <div className={`flex md:flex-col items-center md:items-start gap-3 md:gap-0 md:w-24 flex-shrink-0 ${userRole === 'admin' ? 'ml-6' : ''}`}>
                            <span className="font-bold text-gray-900 text-lg md:text-base">{group.content.day.split(' – ')[0]}</span>
                            <div className="flex items-center gap-1.5 text-xs text-gray-600 md:mt-1">
                               {hasMeta && <Instagram size={12} className="text-[#E1306C]" />}
                               {hasLinkedin && <Linkedin size={12} className="text-[#0077B5]" />}
                               <span className="capitalize text-[10px] hidden md:inline">{group.platforms.length > 1 ? 'Multi' : group.platforms[0]}</span>
                            </div>
                            <span className="inline-block md:mt-2 px-2 py-0.5 rounded text-[9px] font-bold border border-black/10 bg-white/50 uppercase text-gray-700">{getStatusLabel(group.status)}</span>
                         </div>
                         <div className="flex-grow">
                            <span className="text-xs font-bold px-2 py-0.5 rounded border bg-white/50 border-black/10 text-gray-800 mb-2 inline-block">📌 {group.type}</span>
                            <h4 className="font-bold text-gray-900 mb-1">{group.theme}</h4>
                            {group.bullets && group.bullets.length > 0 && <p className="text-xs text-gray-600 line-clamp-2">{group.bullets.join(' • ')}</p>}
                         </div>
                         {userRole === 'admin' && group.status !== 'published' && (
                            <button 
                                onClick={(e) => handleQuickPublish(e, group)}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-white text-gray-500 border border-gray-200 rounded-lg hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-all shadow-sm md:ml-4 mt-2 md:mt-0 w-full md:w-auto"
                                title="Publicar Agora"
                            >
                                <Check size={16} /> <span className="text-xs font-bold">Publicar</span>
                            </button>
                         )}
                      </div>
                   )
                })}
             </div>
           </div>

           {viewMode === 'calendar' && (
             <div className="hidden md:block">
               {renderCalendar()}
             </div>
           )}
        </div>
      </div>
      
      {showPostIdeas && activeClient && (
        <PostIdeasModal
          clientId={activeClient.id}
          monthName={monthName}
          onClose={() => setShowPostIdeas(false)}
        />
      )}

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        onConfirm={confirmAction.onConfirm}
        onCancel={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        confirmText={confirmAction.confirmText}
        confirmButtonColor={confirmAction.confirmButtonColor}
      />
    </motion.div>
  );
};

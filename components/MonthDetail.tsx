
import React, { useState, useEffect, useCallback } from 'react';
import { MonthlyDetailedPlan, DailyContent, PostStatus, PostData, PostTheme } from '../types';
import { Instagram, Linkedin, CalendarDays, Target, BarChart3, Repeat, FileCheck, CheckCircle2, ArrowLeft, MessageCircle, List, Calendar as CalendarIcon, Plus, Loader2, Check, Edit2, Edit3, RefreshCw, Save, X, Trash, Sparkles, FileText } from 'lucide-react';
import { PostModal } from './PostModal';
import { PostIdeasModal } from './PostIdeasModal';
import { ImportPdfModal } from './ImportPdfModal';
import { ThemeBankAdmin } from './agency/ThemeBankAdmin';
import { useAuth, supabase } from '../lib/supabase';
import { StatusLegend } from './StatusLegend';
import { ConfirmModal } from './ConfirmModal';
import { useEditorialData, MONTH_NAMES, DAY_NAMES } from '../hooks/useEditorialData';
import { motion, AnimatePresence } from 'motion/react';

interface MonthDetailProps {
  monthName: string;
  onBack: () => void;
  initialViewMode?: ViewMode;
}

type ViewMode = 'list' | 'calendar';

// Interface auxiliar para agrupar posts visuais
interface GroupedPost {
    primaryKey: string; // Chave principal para abrir o modal
    keys: string[]; // Todas as chaves associadas (ex: meta e linkedin)
    platforms: ('meta' | 'linkedin' | 'tiktok')[];
    content: DailyContent;
    status: PostStatus; // Status unificado (se um estiver pendente, mostra pendente)
    theme: string;
    type: string;
    bullets: string[];
    scheduled_time?: string | null;
}

export const MonthDetail: React.FC<MonthDetailProps> = ({ monthName, onBack, initialViewMode }) => {
  const { userRole, activeClient, agencyId } = useAuth();
  const { monthlyPlans, weeklySchedule, updateMonthlyPlan, loading: loadingEditorial } = useEditorialData();
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{content: DailyContent, key: string, groupKeys?: string[]} | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPostDefaultDate, setNewPostDefaultDate] = useState<string>('');

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode || 'calendar');
  
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
  const [showImportPdf, setShowImportPdf] = useState(false);

  // Selection State
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [transferringTheme, setTransferringTheme] = useState<any>(null);
  const [themeBankKey, setThemeBankKey] = useState(0);

  const currentPlan = monthlyPlans.find(p => MONTH_NAMES[p.month - 1].toLowerCase() === monthName.toLowerCase());
  const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
  const year = 2026;

  const isReleased = currentPlan?.is_released;
  const isLockedForClient = userRole !== 'admin' && !isReleased;

  // --- STATE FOR NEW THEME SYSTEM ---
  const [themes, setThemes] = useState<PostTheme[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(true);
  
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [selectedThemeDay, setSelectedThemeDay] = useState<number | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<PostTheme | null>(null);
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  // Form states for Suggestion (Agency)
  const [theme1, setTheme1] = useState('');
  const [format1, setFormat1] = useState('Reels');
  const [theme2, setTheme2] = useState('');
  const [format2, setFormat2] = useState('Reels');

  // Client Comment/Observation state
  const [clientComment, setClientComment] = useState('');

  // --- NEW INDEPENDENT EVALUATION SYSTEM ---
  interface ThemeStatusState {
    status_1: 'pending' | 'approved' | 'rejected' | 'revision';
    comment_1: string;
    status_2: 'pending' | 'approved' | 'rejected' | 'revision' | null;
    comment_2: string;
    chosen_theme?: 1 | 2 | null;
  }

  const [themeStatusState, setThemeStatusState] = useState<ThemeStatusState>({
    status_1: 'pending',
    comment_1: '',
    status_2: 'pending',
    comment_2: '',
    chosen_theme: null
  });

  const [activeAction, setActiveAction] = useState<{
    suggestionIndex: 1 | 2;
    type: 'revision' | 'rejected';
  } | null>(null);

  const [actionReason, setActionReason] = useState('');
  const [editingCommentIndex, setEditingCommentIndex] = useState<1 | 2 | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [confirmResetIndex, setConfirmResetIndex] = useState<1 | 2 | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const getThemeStatusObject = (theme: PostTheme): ThemeStatusState => {
    try {
      if (theme.status && (theme.status.startsWith('{') || theme.status.startsWith('['))) {
        const parsed = JSON.parse(theme.status);
        return {
          status_1: parsed.status_1 || 'pending',
          comment_1: parsed.comment_1 || '',
          status_2: parsed.status_2 !== undefined ? parsed.status_2 : (theme.theme_2 ? 'pending' : null),
          comment_2: parsed.comment_2 || '',
          chosen_theme: parsed.chosen_theme || null,
        };
      }
    } catch (e) {
      console.error('Failed to parse theme status JSON:', e);
    }

    const legacyStatus = (theme.status as any) || 'pending';
    return {
      status_1: legacyStatus,
      comment_1: theme.client_comment || '',
      status_2: theme.theme_2 ? 'pending' : null,
      comment_2: '',
      chosen_theme: legacyStatus === 'approved' ? 1 : null,
    };
  };

  const getOverallDayStatus = (theme: PostTheme): 'pending' | 'approved' | 'rejected' | 'revision' => {
    const state = getThemeStatusObject(theme);
    const hasTheme2 = !!theme.theme_2;

    if (!hasTheme2) {
      return state.status_1;
    }

    const s1 = state.status_1;
    const s2 = state.status_2;

    if (s1 === 'pending' || s2 === 'pending') {
      return 'pending';
    }

    if (s1 === 'approved' && s2 === 'approved') {
      return state.chosen_theme ? 'approved' : 'pending';
    }

    if (s1 === 'approved' || s2 === 'approved') {
      return 'approved';
    }

    if (s1 === 'revision' || s2 === 'revision') {
      return 'revision';
    }

    return 'rejected';
  };

  // Fetching themes function
  const fetchThemes = useCallback(async () => {
    if (!activeClient) return;
    setLoadingThemes(true);
    try {
      const monthNum = monthIndex + 1;
      const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${new Date(year, monthNum, 0).getDate()}`;
      
      const { data, error } = await supabase
        .from('post_themes')
        .select('*')
        .eq('client_id', activeClient.id)
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (error) throw error;
      setThemes(data || []);
    } catch (err) {
      console.error('Error fetching post themes:', err);
    } finally {
      setLoadingThemes(false);
    }
  }, [activeClient, monthIndex]);

  useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  const openCreateThemeModal = (day: number) => {
    setSelectedThemeDay(day);
    setSelectedTheme(null);
    setTheme1('');
    setFormat1('Reels');
    setTheme2('');
    setFormat2('Reels');
    setClientComment('');
    setThemeStatusState({
      status_1: 'pending',
      comment_1: '',
      status_2: null,
      comment_2: '',
      chosen_theme: null
    });
    setActiveAction(null);
    setEditingCommentIndex(null);
    setEditCommentText('');
    setConfirmResetIndex(null);
    setConfirmDelete(false);
    setIsThemeModalOpen(true);
  };

  const handleOpenThemeModal = (theme: PostTheme) => {
    setSelectedTheme(theme);
    setSelectedThemeDay(parseInt(theme.date.split('-')[2]));
    setTheme1(theme.theme_1 || '');
    setFormat1(theme.format_1 || 'Reels');
    setTheme2(theme.theme_2 || '');
    setFormat2(theme.format_2 || 'Reels');
    setClientComment(theme.client_comment || '');
    
    const parsedState = getThemeStatusObject(theme);
    setThemeStatusState(parsedState);
    
    setActiveAction(null);
    setEditingCommentIndex(null);
    setEditCommentText('');
    setConfirmResetIndex(null);
    setConfirmDelete(false);
    setIsThemeModalOpen(true);
  };

  const handleSaveThemeSuggestion = async () => {
    if (!activeClient || !agencyId || !selectedThemeDay) return;
    if (!theme1.trim()) {
      alert('O Tema 1 é obrigatório.');
      return;
    }

    setIsSavingTheme(true);
    try {
      const monthNum = monthIndex + 1;
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(selectedThemeDay).padStart(2, '0')}`;

      const initialJSONState = {
        status_1: 'pending',
        comment_1: '',
        status_2: theme2.trim() ? 'pending' : null,
        comment_2: '',
        chosen_theme: null
      };

      const payload = {
        client_id: activeClient.id,
        agency_id: agencyId,
        date: dateStr,
        theme_1: theme1.trim(),
        format_1: format1,
        theme_2: theme2.trim() || null,
        format_2: theme2.trim() ? format2 : null,
        status: JSON.stringify(initialJSONState),
        client_comment: null,
        reviewed_at: null,
        reviewed_by: null
      };

      if (selectedTheme) {
        const { error } = await supabase
          .from('post_themes')
          .update(payload)
          .eq('id', selectedTheme.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_themes')
          .insert(payload);
        if (error) throw error;
      }

      await fetchThemes();
      setIsThemeModalOpen(false);
    } catch (err) {
      console.error('Error saving theme suggestion:', err);
      alert('Erro ao salvar sugestão de temas. Tente novamente.');
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleDeleteThemeSuggestion = async () => {
    if (!selectedTheme) return;

    setIsSavingTheme(true);
    try {
      const { error } = await supabase
        .from('post_themes')
        .delete()
        .eq('id', selectedTheme.id);
      if (error) throw error;

      await fetchThemes();
      setIsThemeModalOpen(false);
    } catch (err) {
      console.error('Error deleting theme suggestion:', err);
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleSaveClientReviewState = async (updatedState: ThemeStatusState) => {
    if (!selectedTheme) return;
    setIsSavingTheme(true);
    try {
      const userName = userRole === 'admin' ? 'Agência' : (activeClient?.name || 'Cliente');
      
      let finalStatus: 'pending' | 'approved' | 'rejected' | 'revision' = 'pending';
      const s1 = updatedState.status_1;
      const s2 = updatedState.status_2;
      const hasTheme2 = !!selectedTheme.theme_2;

      let finalChosenTheme = updatedState.chosen_theme;

      if (!hasTheme2) {
        finalStatus = s1;
        finalChosenTheme = s1 === 'approved' ? 1 : null;
      } else {
        // Se ambos são aprovados
        if (s1 === 'approved' && s2 === 'approved') {
          // Se o cliente já escolheu qual publicar
          if (finalChosenTheme === 1 || finalChosenTheme === 2) {
            finalStatus = 'approved';
          } else {
            // Se ainda não escolheu, o dia fica pendente de decisão final
            finalStatus = 'pending';
            finalChosenTheme = null;
          }
        }
        // Se apenas o tema 1 é aprovado
        else if (s1 === 'approved' && s2 !== 'approved') {
          if (s2 === 'pending') {
            // Ainda aguardando avaliação do tema 2, status geral pendente, escolhido ainda indefinido
            finalStatus = 'pending';
            finalChosenTheme = null;
          } else {
            // Tema 2 foi rejeitado ou alterado, então o tema 1 é o definitivo
            finalStatus = 'approved';
            finalChosenTheme = 1;
          }
        }
        // Se apenas o tema 2 é aprovado
        else if (s2 === 'approved' && s1 !== 'approved') {
          if (s1 === 'pending') {
            // Ainda aguardando avaliação do tema 1, status geral pendente, escolhido ainda indefinido
            finalStatus = 'pending';
            finalChosenTheme = null;
          } else {
            // Tema 1 foi rejeitado ou alterado, então o tema 2 é o definitivo
            finalStatus = 'approved';
            finalChosenTheme = 2;
          }
        }
        // Se nenhum é aprovado, mas pelo menos um está pendente
        else if (s1 === 'pending' || s2 === 'pending') {
          finalStatus = 'pending';
          finalChosenTheme = null;
        }
        // Se pelo menos um está em revisão
        else if (s1 === 'revision' || s2 === 'revision') {
          finalStatus = 'revision';
          finalChosenTheme = null;
        }
        // Se ambos foram rejeitados
        else {
          finalStatus = 'rejected';
          finalChosenTheme = null;
        }
      }

      const stateToSave = {
        ...updatedState,
        chosen_theme: finalChosenTheme
      };

      const { error } = await supabase
        .from('post_themes')
        .update({
          status: JSON.stringify(stateToSave),
          client_comment: stateToSave.comment_1 || stateToSave.comment_2 || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userName
        })
        .eq('id', selectedTheme.id);

      if (error) throw error;

      await fetchThemes();
      
      const updatedTheme = {
        ...selectedTheme,
        status: JSON.stringify(stateToSave),
        reviewed_at: new Date().toISOString(),
        reviewed_by: userName
      };
      setSelectedTheme(updatedTheme);
      setThemeStatusState(stateToSave);
      
      setActiveAction(null);
      setEditingCommentIndex(null);
      setActionReason('');
    } catch (err) {
      console.error('Error saving client review state:', err);
      alert('Erro ao salvar avaliação. Tente novamente.');
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleResetDecision = async (index: 1 | 2) => {
    const updated = { ...themeStatusState };
    if (index === 1) {
      updated.status_1 = 'pending';
      updated.comment_1 = '';
    } else {
      updated.status_2 = 'pending';
      updated.comment_2 = '';
    }
    updated.chosen_theme = null;
    await handleSaveClientReviewState(updated);
  };

  const handleSaveEditedComment = async (index: 1 | 2) => {
    const updated = { ...themeStatusState };
    if (index === 1) {
      updated.comment_1 = editCommentText.trim();
    } else {
      updated.comment_2 = editCommentText.trim();
    }
    await handleSaveClientReviewState(updated);
  };

  const handleApproveSuggestion = async (index: 1 | 2) => {
    const updated: ThemeStatusState = { ...themeStatusState };
    if (index === 1) {
      updated.status_1 = 'approved';
    } else {
      updated.status_2 = 'approved';
    }

    const hasTheme2 = !!selectedTheme?.theme_2;
    if (hasTheme2 && updated.status_1 === 'approved' && updated.status_2 === 'approved') {
      updated.chosen_theme = null;
    }
    
    await handleSaveClientReviewState(updated);
  };


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
      const platform = parts[3] as 'meta' | 'linkedin' | 'tiktok';
      
      if (parseInt(m) !== currentPlan.month || parseInt(y) !== currentPlan.year) return;

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
            bullets: dbPost?.bullets || post.content.bullets || [],
            scheduled_time: dbPost?.scheduled_time || null
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
                     const s1 = group.status as PostStatus;
                     const s2 = (otherDb?.status as PostStatus) || 'draft';
                     
                     const STATUS_PRIORITY: Record<PostStatus, number> = {
                         'theme_rejected': 1,
                         'rejected': 1, // Same as theme_rejected
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
                         group.status = s2;
                     }
                     
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
              const uniqueKeys: string[] = Array.from(new Set(postGroup.keys));
              const suffixMap = new Map<string, string>();
              const baseTimestamp = Date.now();
              let suffixCounter = 0;
              
              for (const oldKey of uniqueKeys) {
                  const parts = oldKey.split('-');
                  // Format: DD-MM-YYYY-platform[-suffix]
                  const platform = parts[3]; 
                  const oldSuffix = parts.length > 4 ? parts.slice(4).join('-') : '';
                  
                  let newSuffix = suffixMap.get(oldSuffix);
                  if (!newSuffix) {
                      newSuffix = `${baseTimestamp + suffixCounter}`;
                      suffixMap.set(oldSuffix, newSuffix);
                      suffixCounter++;
                  }
                  
                  const newKey = `${d}-${m}-${y}-${platform}-${activeClient?.id}-${newSuffix}`;

                  const dbPost = dbPosts[oldKey];
                  
                  const payload = {
                      date_key: newKey,
                      client_id: activeClient?.id,
                      agency_id: agencyId,
                      status: dbPost?.status || 'draft',
                      theme: dbPost?.theme || postGroup.theme,
                      type: dbPost?.type || postGroup.type,
                      bullets: dbPost?.bullets || postGroup.bullets,
                      image_url: dbPost?.image_url || postGroup.content.initialImageUrl || null,
                      video_thumbnail_url: dbPost?.video_thumbnail_url || null,
                      caption: dbPost?.caption || null,
                      scheduled_time: dbPost?.scheduled_time || postGroup.scheduled_time || null,
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
                      agency_id: agencyId,
                      status: 'deleted',
                      last_updated: new Date().toISOString(),
                      // Include other fields just in case they are required
                      theme: dbPost?.theme || postGroup.theme,
                      type: dbPost?.type || postGroup.type,
                      bullets: dbPost?.bullets || postGroup.bullets,
                      image_url: dbPost?.image_url || postGroup.content.initialImageUrl || null,
                      video_thumbnail_url: dbPost?.video_thumbnail_url || null,
                      caption: dbPost?.caption || null
                  };

                  const { error: deleteError } = await supabase.from('posts').upsert(deletePayload, { onConflict: 'date_key' });
                  if (deleteError) throw deleteError;
                  
                  // 3. Move Comments
                  await supabase.from('comments')
                      .update({ post_id: newKey })
                      
                      .eq('post_id', oldKey);
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

  const handleOpenPost = (group: GroupedPost) => {
    setSelectedPost({ content: group.content, key: group.primaryKey, groupKeys: group.keys });
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
                    agency_id: agencyId,
                    status: 'published',
                    scheduled_time: dbPost?.scheduled_time || group.scheduled_time || null,
                    last_updated: new Date().toISOString(),
                    // Se era estático puro, copia dados para persistir
                    theme: group.theme,
                    type: group.type,
                    bullets: group.bullets,
                    image_url: group.content.initialImageUrl || null,
                 };
                 
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
                agency_id: agencyId,
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

  const handleBulkStatusChange = async (newStatus: PostStatus) => {
    if (selectedPosts.size === 0) return;
    
    setConfirmAction({
      isOpen: true,
      title: 'Alterar Status',
      message: `Deseja mudar o status de ${selectedPosts.size} publicações para "${getStatusLabel(newStatus)}"?`,
      confirmText: 'Confirmar',
      confirmButtonColor: 'brand',
      onConfirm: async () => {
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        setIsBulkUpdating(true);
        
        try {
          const payloads: any[] = [];
          groupedPosts.forEach(group => {
            if (selectedPosts.has(group.primaryKey)) {
              group.keys.forEach(key => {
                const dbPost = dbPosts[key];
                const payload: any = {
                  date_key: key,
                  client_id: activeClient?.id,
                  agency_id: agencyId,
                  status: newStatus,
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
              
            if (error) throw error;
            
            setSelectedPosts(new Set());
            await fetchMonthPosts();
          }
        } catch (error) {
          console.error("Erro ao atualizar status em massa:", error);
          alert("Erro ao atualizar status das publicações.");
        } finally {
          setIsBulkUpdating(false);
        }
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

  if (loadingEditorial || loadingPosts) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-green" />
      </div>
    );
  }

  const isAdmin = userRole === 'admin';

  if (!isAdmin && !isReleased) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-10 bg-white rounded-[2.5rem] border border-black/[0.03]">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-8">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h2 className="text-3xl font-bold text-brand-dark mb-4 tracking-tight">Conteúdo em Preparação</h2>
        <p className="text-gray-500 mb-10 max-w-md leading-relaxed font-medium">
          Nossa equipe está finalizando a estratégia e o planejamento editorial para este mês. Você será notificado assim que estiver liberado para aprovação.
        </p>
        <button 
          onClick={onBack} 
          className="px-10 py-5 bg-brand-dark text-white rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-brand-dark/20 hover:scale-105 active:scale-95 transition-all"
        >
          Voltar ao Dashboard
        </button>
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
      case 'theme_pending': return 'Tema P/ Aprovação';
      case 'theme_approved': return 'Tema Aprovado';
      case 'theme_approved_with_notes': return 'Tema com Ajustes';
      case 'theme_rejected': return 'Tema Reprovado';
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
      case 'theme_pending': return 'bg-gray-300 border-gray-400 hover:bg-gray-400';
      case 'theme_approved': return 'bg-[#fce5ff] border-[#f4cbf7] hover:bg-[#fae0fd]';
      case 'theme_approved_with_notes': return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100';
      case 'theme_rejected': return 'bg-rose-100 border-rose-200 hover:bg-rose-200';
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

  const getThemeStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#EAB308'; // yellow-500
      case 'approved': return '#10B981'; // emerald-500
      case 'rejected': return '#EF4444'; // red-500
      case 'revision': return '#3B82F6'; // blue-500
      default: return '#9CA3AF';
    }
  };

  const getThemeStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Reprovado';
      case 'revision': return 'Pedido de Alteração';
      default: return status;
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

      const formattedDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTheme = themes.find(t => t.date === formattedDate);

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
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-semibold ${dayEvents.length > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                {d} <span className="md:hidden text-[10px] font-normal ml-1 text-gray-400">{dayName}</span>
              </span>
              {dayTheme && (() => {
                const overallStatus = getOverallDayStatus(dayTheme);
                return (
                  <div 
                    onClick={(e) => { e.stopPropagation(); handleOpenThemeModal(dayTheme); }}
                    className="w-2 h-2 rounded-full cursor-pointer transition-transform hover:scale-125 shadow-sm border border-white"
                    style={{ backgroundColor: getThemeStatusColor(overallStatus) }}
                    title={`Sugestão de Tema: ${getThemeStatusLabel(overallStatus)}`}
                  />
                );
              })()}
            </div>
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
              const hasMeta = group.platforms.some(p => p.toLowerCase().includes('meta') || p.toLowerCase().includes('instagram') || p.toLowerCase().includes('facebook'));
              const hasLinkedin = group.platforms.some(p => p.toLowerCase().includes('linkedin'));
              const hasTikTok = group.platforms.some(p => p.toLowerCase().includes('tiktok'));
               const isSelected = selectedPosts.has(group.primaryKey);

               return (
                <div 
                  key={idx}
                  onClick={() => handleOpenPost(group)}
                  className={`p-3 rounded-xl border shadow-sm cursor-pointer hover:scale-[1.02] ${statusColor} ${isSelected ? 'ring-2 ring-brand-dark' : ''} relative group/card shrink-0 transition-all duration-300`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, group.primaryKey)}
                >
                  {userRole === 'admin' && (
                    <div 
                      className={`absolute -top-2 -left-2 z-20 bg-white rounded-full w-8 h-8 shadow-md border flex items-center justify-center ${isSelected ? 'border-brand-dark opacity-100' : 'border-gray-200 opacity-0 group-hover/card:opacity-100'} transition-all cursor-pointer`}
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
                        {hasTikTok && <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center shadow-sm border border-black/[0.03]"><span className="text-[10px] text-white font-bold leading-none -mt-0.5" style={{ textShadow: '-1px -1px 0 #00f2fe, 1px 1px 0 #fe0979' }}>♪</span></div>}
                      </div>
                      
                      <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 truncate max-w-[50px]">
                        {group.type.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-brand-dark leading-tight line-clamp-2 mb-2" title={group.theme}>
                    {group.theme}
                  </p>
                  {group.scheduled_time && (
                      <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-medium mb-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                          {group.scheduled_time}
                      </div>
                  )}
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

            {dayTheme && (() => {
              const overallStatus = getOverallDayStatus(dayTheme);
              const statusObj = getThemeStatusObject(dayTheme);
              return (
                <div 
                  onClick={(e) => { e.stopPropagation(); handleOpenThemeModal(dayTheme); }}
                  className="p-3 rounded-xl border border-dashed hover:shadow-md cursor-pointer transition-all duration-300 flex flex-col gap-1.5 text-left shrink-0 bg-white"
                  style={{ 
                    borderColor: getThemeStatusColor(overallStatus) + '60',
                    boxShadow: `0 4px 12px ${getThemeStatusColor(overallStatus)}08`
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-extrabold uppercase tracking-widest text-gray-400">Sugestão de Tema</span>
                    <span 
                      className="px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider rounded-md text-white"
                      style={{ backgroundColor: getThemeStatusColor(overallStatus) }}
                    >
                      {getThemeStatusLabel(overallStatus)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex items-center gap-1.5 justify-between">
                        <p className="text-[10px] font-bold text-gray-700 leading-tight">
                          💡 {dayTheme.theme_1}
                        </p>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getThemeStatusColor(statusObj.status_1) }} />
                      </div>
                      <span className="inline-block text-[8px] font-semibold text-gray-400 px-1.5 py-0.5 bg-gray-50 rounded-md border border-gray-100 mt-1">
                        {dayTheme.format_1}
                      </span>
                    </div>

                    {dayTheme.theme_2 && (
                      <>
                        <div className="border-t border-gray-100 my-1.5" />
                        <div>
                          <div className="flex items-center gap-1.5 justify-between">
                            <p className="text-[10px] font-bold text-gray-500 leading-tight">
                              💡 {dayTheme.theme_2}
                            </p>
                            {statusObj.status_2 && (
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getThemeStatusColor(statusObj.status_2) }} />
                            )}
                          </div>
                          <span className="inline-block text-[8px] font-semibold text-gray-400 px-1.5 py-0.5 bg-gray-50 rounded-md border border-gray-100 mt-1">
                            {dayTheme.format_2}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {userRole === 'admin' && dayEvents.length === 0 && !dayTheme && (
              <div className="flex items-center justify-center py-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); openCreateThemeModal(d); }}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-brand-dark/5 text-brand-dark hover:bg-brand-dark hover:text-white transition-all py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-brand-dark/10"
                >
                  <Plus size={12} /> Sugerir Temas
                </button>
              </div>
            )}
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
            groupKeys={selectedPost.groupKeys}
            onClose={() => {
                handleCloseModal();
                setTransferringTheme(null);
            }}
            onUpdate={async () => {
                fetchMonthPosts();
                if (transferringTheme) {
                   await supabase.from('theme_items')
                       .update({ approval_status: 'transferred' })
                       
                       .eq('id', transferringTheme.id);
                   setTransferringTheme(null);
                   setThemeBankKey(k => k + 1); // trigger refetch in ThemeBank
                }
            }}
            isNew={isCreatingNew} 
            defaultDate={newPostDefaultDate}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showImportPdf && (
          <ImportPdfModal
            monthIndex={monthIndex}
            year={year}
            isOpen={showImportPdf}
            onClose={() => setShowImportPdf(false)}
            onSuccess={(count) => {
              setShowImportPdf(false);
              fetchMonthPosts();
              alert(`${count} publicações foram importadas com sucesso!`);
            }}
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
                  onClick={async () => {
                    if (!currentPlan) return;
                    const nextState = !currentPlan.is_released;
                    await updateMonthlyPlan(currentPlan.id, { is_released: nextState });
                  }}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all border ${
                    currentPlan?.is_released 
                      ? 'bg-green-50 border-green-100 text-green-600 hover:bg-green-100 shadow-sm' 
                      : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'
                  }`}
                  title={currentPlan?.is_released ? 'Bloquear acesso do cliente' : 'Liberar acesso para o cliente'}
                >
                  {currentPlan?.is_released ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  )}
                  {currentPlan?.is_released ? 'Mês Liberado' : 'Mês Oculto'}
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

            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <span className="text-[9px] uppercase tracking-widest text-gray-400 font-bold ml-1 sm:ml-0">Visualização:</span>
                <div className="flex bg-white rounded-xl sm:rounded-2xl p-1 sm:p-1.5 border border-black/[0.03] shadow-[0_4px_15px_rgba(0,0,0,0.03)] w-full sm:w-auto justify-between sm:justify-start">
                    <button onClick={() => setViewMode('list')} className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${viewMode === 'list' ? 'bg-brand-dark text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>
                        <List size={14} /> <span>Lista</span>
                    </button>
                    <button onClick={() => setViewMode('calendar')} className={`hidden md:flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${viewMode === 'calendar' ? 'bg-brand-dark text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>
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
              
              <div className="flex flex-wrap items-center gap-3">
                {userRole === 'admin' && (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setShowImportPdf(true)}
                    className="flex items-center gap-3 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all backdrop-blur-md border border-white/10 shadow-xl"
                  >
                    <FileText size={14} /> Importar PDF
                  </motion.button>
                )}
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
              <div className="flex flex-wrap items-center gap-4">
                <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white/80 text-[10px] font-bold uppercase tracking-[0.2em] mb-6 mt-2">
                  <Target size={12} className="text-white/40" />
                  Tema: <span className="text-white">{currentPlan?.theme || 'Não definido'}</span>
                </div>

                {userRole === 'admin' && themes.length > 0 && (
                  <div className="inline-flex flex-wrap items-center gap-x-4 gap-y-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white/80 text-[10px] font-bold uppercase tracking-[0.15em] mb-6 mt-2">
                    <Sparkles size={12} className="text-white/40 animate-pulse" />
                    <span>Temas do mês:</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" /> {themes.filter(t => getOverallDayStatus(t) === 'pending').length} pendentes</span>
                    <span className="text-white/20">|</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {themes.filter(t => getOverallDayStatus(t) === 'approved').length} aprovados</span>
                    <span className="text-white/20">|</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> {themes.filter(t => getOverallDayStatus(t) === 'revision').length} alterações</span>
                    <span className="text-white/20">|</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> {themes.filter(t => getOverallDayStatus(t) === 'rejected').length} reprovados</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-10 bg-gray-50/50">
             <>
               <StatusLegend />
               <div className={viewMode === 'list' ? 'block' : 'block md:hidden'}>
             <div className="flex flex-col gap-4">
                {groupedPosts.map((group, idx) => {
                   const statusColor = getStatusColorClass(group.status);
                   const hasMeta = group.platforms.some(p => p.toLowerCase().includes('meta') || p.toLowerCase().includes('instagram') || p.toLowerCase().includes('facebook'));
                   const hasLinkedin = group.platforms.some(p => p.toLowerCase().includes('linkedin'));
                   const hasTikTok = group.platforms.some(p => p.toLowerCase().includes('tiktok'));
                   const isSelected = selectedPosts.has(group.primaryKey);

                   const targetDay = parseInt(group.content.day.split('/')[0]);
                   
                   return (
                      <div 
                        key={idx} 
                        onClick={() => handleOpenPost(group)} 
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
                               {hasTikTok && <div className="w-3.5 h-3.5 rounded-full bg-black flex items-center justify-center -ml-0.5"><span className="text-[7px] text-white font-bold leading-none -mt-[0.5px]" style={{ textShadow: '-1px -1px 0 #00f2fe, 1px 1px 0 #fe0979' }}>♪</span></div>}
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
           </>
        </div>
      </div>
      
      {showPostIdeas && activeClient && (
        <PostIdeasModal
          clientId={activeClient.id}
          monthName={monthName}
          onClose={() => setShowPostIdeas(false)}
        />
      )}

      {/* --- MODAL DE APROVAÇÃO DE TEMAS --- */}
      {isThemeModalOpen && selectedThemeDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-[#0A0A0A]/60 backdrop-blur-md" 
            onClick={() => setIsThemeModalOpen(false)}
          />
          
          {/* Modal Card */}
          <div className="bg-white rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] border border-gray-100 max-w-lg w-full overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-brand-dark p-6 text-white flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-green">
                  Calendário Editorial
                </span>
                <h3 className="text-lg font-extrabold tracking-tight mt-1">
                  Sugestão de Temas — Dia {selectedThemeDay} de {monthName}
                </h3>
              </div>
              <button 
                onClick={() => setIsThemeModalOpen(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-grow space-y-6">
              {/* HISTÓRICO DE REVISÃO GERAL (Para auditoria simples de quem atualizou por último) */}
              {selectedTheme && selectedTheme.reviewed_at && (
                <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      Última Avaliação Geral
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-gray-600">
                    Processado por <span className="font-bold text-gray-900">{selectedTheme.reviewed_by}</span> em {new Date(selectedTheme.reviewed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}

              {/* DUPLA APROVAÇÃO: EXIGIR ESCOLHA DE QUAL TEMA PUBLICAR */}
              {userRole !== 'admin' && themeStatusState.status_1 === 'approved' && themeStatusState.status_2 === 'approved' && !themeStatusState.chosen_theme && (
                <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Sparkles size={18} className="text-amber-500 shrink-0" />
                    <h4 className="font-extrabold text-xs uppercase tracking-wider">Qual publicação você quer para este dia?</h4>
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Você aprovou os dois temas para o mesmo dia! Selecione qual deles será publicado no <strong>Dia {selectedThemeDay}</strong>. O outro tema será reposicionado para outro dia pela equipe da agência.
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      onClick={async () => {
                        const updated: ThemeStatusState = { ...themeStatusState, chosen_theme: 1 };
                        await handleSaveClientReviewState(updated);
                      }}
                      disabled={isSavingTheme}
                      className="w-full bg-brand-dark hover:bg-opacity-95 text-white text-[10px] font-black uppercase tracking-widest py-3 px-4 rounded-xl transition-all shadow-md active:scale-95 text-left flex items-center justify-between"
                    >
                      <span>💡 1. {theme1}</span>
                      <span className="bg-brand-green/20 text-brand-green text-[9px] px-2 py-0.5 rounded">Escolher este</span>
                    </button>
                    <button
                      onClick={async () => {
                        const updated: ThemeStatusState = { ...themeStatusState, chosen_theme: 2 };
                        await handleSaveClientReviewState(updated);
                      }}
                      disabled={isSavingTheme}
                      className="w-full bg-brand-dark hover:bg-opacity-95 text-white text-[10px] font-black uppercase tracking-widest py-3 px-4 rounded-xl transition-all shadow-md active:scale-95 text-left flex items-center justify-between"
                    >
                      <span>💡 2. {theme2}</span>
                      <span className="bg-brand-green/20 text-brand-green text-[9px] px-2 py-0.5 rounded">Escolher este</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODO AGÊNCIA: EDIÇÃO OU CRIAÇÃO */}
              {userRole === 'admin' ? (
                <div className="space-y-6">
                  {/* Tema 1 */}
                  <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">Sugestão de Tema 1</span>
                      <span className="text-[10px] font-bold text-brand-dark bg-brand-dark/5 px-2 py-0.5 rounded-md">Obrigatório</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Ideia de Tema</label>
                        <textarea
                          value={theme1}
                          onChange={(e) => setTheme1(e.target.value)}
                          placeholder="Digite o título ou ideia do tema"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark transition-all resize-none min-h-[60px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Formato</label>
                        <select
                          value={format1}
                          onChange={(e) => setFormat1(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark transition-all font-semibold"
                        >
                          <option value="Reels">Reels</option>
                          <option value="Carrossel">Carrossel</option>
                          <option value="Imagem Estática">Imagem Estática</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Tema 2 */}
                  <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">Sugestão de Tema 2</span>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">Opcional</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Ideia de Tema</label>
                        <textarea
                          value={theme2}
                          onChange={(e) => setTheme2(e.target.value)}
                          placeholder="Digite o título ou ideia do tema (opcional)"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark transition-all resize-none min-h-[60px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Formato</label>
                        <select
                          value={format2}
                          onChange={(e) => setFormat2(e.target.value)}
                          disabled={!theme2.trim()}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark transition-all font-semibold disabled:opacity-50"
                        >
                          <option value="Reels">Reels</option>
                          <option value="Carrossel">Carrossel</option>
                          <option value="Imagem Estática">Imagem Estática</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* MODO CLIENTE: LEITURA E AVALIAÇÃO INDEPENDENTE */
                <div className="space-y-6">
                  {/* --- CARD SUGESTÃO 1 --- */}
                  <div className={`p-6 rounded-3xl border transition-all ${
                    themeStatusState.status_1 === 'approved' ? 'bg-emerald-50/30 border-emerald-200/60 shadow-sm' :
                    themeStatusState.status_1 === 'rejected' ? 'bg-rose-50/30 border-rose-200/60' :
                    themeStatusState.status_1 === 'revision' ? 'bg-blue-50/30 border-blue-200/60' :
                    'bg-gray-50/30 border-gray-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black uppercase tracking-widest text-brand-dark border border-brand-dark/10 px-2.5 py-1 rounded-md bg-white shadow-sm">
                        Sugestão 1
                      </span>
                      <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-md text-white ${
                        themeStatusState.status_1 === 'approved' ? 'bg-emerald-500' :
                        themeStatusState.status_1 === 'rejected' ? 'bg-rose-500' :
                        themeStatusState.status_1 === 'revision' ? 'bg-blue-500' :
                        'bg-yellow-500'
                      }`}>
                        {themeStatusState.status_1 === 'approved' && themeStatusState.chosen_theme === 1 ? 'Aprovado (Que Segue)' :
                         themeStatusState.status_1 === 'approved' ? 'Aprovado (Aguardando Escolha)' :
                         getThemeStatusLabel(themeStatusState.status_1)}
                      </span>
                    </div>
                    
                    <h4 className="text-sm font-extrabold text-gray-900 mt-4">💡 {theme1}</h4>
                    <span className="inline-block text-[9px] font-extrabold text-gray-500 bg-white border border-gray-150 px-2.5 py-1 rounded-md shadow-sm mt-2">
                      {format1}
                    </span>

                    {/* BOTÕES DE AÇÃO SE TEMA 1 FOR PENDENTE */}
                    {themeStatusState.status_1 === 'pending' && (!activeAction || activeAction.suggestionIndex !== 1) && (
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => handleApproveSuggestion(1)}
                          disabled={isSavingTheme}
                          className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all text-[9px] font-black uppercase tracking-widest shadow-sm"
                        >
                          <CheckCircle2 size={12} /> Aprovar
                        </button>
                        <button
                          onClick={() => {
                            setActiveAction({ suggestionIndex: 1, type: 'revision' });
                            setActionReason('');
                          }}
                          disabled={isSavingTheme}
                          className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all text-[9px] font-black uppercase tracking-widest shadow-sm"
                        >
                          <Edit2 size={12} /> Alteração
                        </button>
                        <button
                          onClick={() => {
                            setActiveAction({ suggestionIndex: 1, type: 'rejected' });
                            setActionReason('');
                          }}
                          disabled={isSavingTheme}
                          className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all text-[9px] font-black uppercase tracking-widest shadow-sm"
                        >
                          <Trash size={12} /> Reprovar
                        </button>
                      </div>
                    )}

                    {/* FORM INLINE PARA MOTIVO REJEIÇÃO/REVISÃO TEMA 1 */}
                    {activeAction && activeAction.suggestionIndex === 1 && (
                      <div className="bg-white border border-gray-150 rounded-2xl p-4 mt-4 space-y-3 shadow-inner animate-in slide-in-from-top-3 duration-300">
                        <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">
                          {activeAction.type === 'revision' ? 'Pedir Alteração — Sugestão 1' : 'Reprovar — Sugestão 1'}
                        </span>
                        <textarea
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          placeholder={activeAction.type === 'revision' ? "Digite detalhadamente qual alteração você deseja..." : "Digite o motivo da reprovação..."}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark transition-all resize-none min-h-[70px]"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setActiveAction(null)}
                            className="px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-wider"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={async () => {
                              if (!actionReason.trim()) {
                                alert('Por favor, informe a observação/motivo.');
                                return;
                              }
                              const updated = { ...themeStatusState, status_1: activeAction.type, comment_1: actionReason.trim() };
                              await handleSaveClientReviewState(updated);
                            }}
                            disabled={isSavingTheme}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-white shadow-sm ${
                              activeAction.type === 'revision' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-rose-500 hover:bg-rose-600'
                            }`}
                          >
                            Confirmar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* MOSTRAR FEEDBACK E BOTÃO EDITAR PARA TEMA 1 */}
                    {themeStatusState.status_1 !== 'pending' && (
                      <div className="mt-4 pt-3 border-t border-gray-100/60 space-y-2">
                        {themeStatusState.comment_1 && (
                          <div className="bg-white/80 border border-black/[0.03] rounded-xl p-3 text-xs text-gray-600">
                            <span className="font-bold text-[9px] uppercase text-gray-400 tracking-wider block mb-1">
                              {themeStatusState.status_1 === 'revision' ? 'Feedback de Alteração:' : 'Motivo da Reprovação:'}
                            </span>
                            {editingCommentIndex === 1 ? (
                              <div className="space-y-3 mt-1.5">
                                <textarea
                                  value={editCommentText}
                                  onChange={(e) => setEditCommentText(e.target.value)}
                                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark transition-all resize-none min-h-[60px]"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingCommentIndex(null)}
                                    className="px-3 py-1.5 rounded bg-gray-100 text-gray-600 text-[9px] font-bold uppercase transition-all"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => handleSaveEditedComment(1)}
                                    disabled={isSavingTheme}
                                    className="px-3 py-1.5 rounded bg-brand-dark text-white hover:bg-opacity-95 text-[9px] font-bold uppercase transition-all"
                                  >
                                    Salvar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="italic">"{themeStatusState.comment_1}"</p>
                            )}
                          </div>
                        )}

                        {editingCommentIndex !== 1 && (
                          <div className="flex gap-2 items-center">
                            {themeStatusState.comment_1 && (
                              <button
                                onClick={() => {
                                  setEditingCommentIndex(1);
                                  setEditCommentText(themeStatusState.comment_1);
                                }}
                                className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-brand-dark hover:opacity-85"
                              >
                                <Edit3 size={11} /> Editar Observação
                              </button>
                            )}
                            {confirmResetIndex === 1 ? (
                              <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl ml-auto animate-in fade-in duration-200">
                                <span className="text-[9px] font-bold text-rose-700">Confirmar?</span>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setConfirmResetIndex(null);
                                    await handleResetDecision(1);
                                  }}
                                  className="px-2 py-0.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-[8px] font-black uppercase transition-all"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmResetIndex(null);
                                  }}
                                  className="px-2 py-0.5 bg-gray-150 hover:bg-gray-200 text-gray-700 rounded text-[8px] font-black uppercase transition-all"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmResetIndex(1)}
                                className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-500 hover:opacity-85 ml-auto"
                              >
                                <RefreshCw size={11} /> Refazer Avaliação
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>


                  {/* --- CARD SUGESTÃO 2 (Se existir) --- */}
                  {theme2.trim() && (
                    <div className={`p-6 rounded-3xl border transition-all ${
                      themeStatusState.status_2 === 'approved' ? 'bg-emerald-50/30 border-emerald-200/60 shadow-sm' :
                      themeStatusState.status_2 === 'rejected' ? 'bg-rose-50/30 border-rose-200/60' :
                      themeStatusState.status_2 === 'revision' ? 'bg-blue-50/30 border-blue-200/60' :
                      'bg-gray-50/30 border-gray-100'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black uppercase tracking-widest text-brand-dark border border-brand-dark/10 px-2.5 py-1 rounded-md bg-white shadow-sm">
                          Sugestão 2
                        </span>
                        <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-md text-white ${
                          themeStatusState.status_2 === 'approved' ? 'bg-emerald-500' :
                          themeStatusState.status_2 === 'rejected' ? 'bg-rose-500' :
                          themeStatusState.status_2 === 'revision' ? 'bg-blue-500' :
                          'bg-yellow-500'
                        }`}>
                          {themeStatusState.status_2 === 'approved' && themeStatusState.chosen_theme === 2 ? 'Aprovado (Que Segue)' :
                           themeStatusState.status_2 === 'approved' ? 'Aprovado (Aguardando Escolha)' :
                           getThemeStatusLabel(themeStatusState.status_2 || 'pending')}
                        </span>
                      </div>
                      
                      <h4 className="text-sm font-extrabold text-gray-900 mt-4">💡 {theme2}</h4>
                      <span className="inline-block text-[9px] font-extrabold text-gray-500 bg-white border border-gray-150 px-2.5 py-1 rounded-md shadow-sm mt-2">
                        {format2}
                      </span>

                      {/* BOTÕES DE AÇÃO SE TEMA 2 FOR PENDENTE */}
                      {themeStatusState.status_2 === 'pending' && (!activeAction || activeAction.suggestionIndex !== 2) && (
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
                          <button
                            onClick={() => handleApproveSuggestion(2)}
                            disabled={isSavingTheme}
                            className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all text-[9px] font-black uppercase tracking-widest shadow-sm"
                          >
                            <CheckCircle2 size={12} /> Aprovar
                          </button>
                          <button
                            onClick={() => {
                              setActiveAction({ suggestionIndex: 2, type: 'revision' });
                              setActionReason('');
                            }}
                            disabled={isSavingTheme}
                            className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all text-[9px] font-black uppercase tracking-widest shadow-sm"
                          >
                            <Edit2 size={12} /> Alteração
                          </button>
                          <button
                            onClick={() => {
                              setActiveAction({ suggestionIndex: 2, type: 'rejected' });
                              setActionReason('');
                            }}
                            disabled={isSavingTheme}
                            className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all text-[9px] font-black uppercase tracking-widest shadow-sm"
                          >
                            <Trash size={12} /> Reprovar
                          </button>
                        </div>
                      )}

                      {/* FORM INLINE PARA MOTIVO REJEIÇÃO/REVISÃO TEMA 2 */}
                      {activeAction && activeAction.suggestionIndex === 2 && (
                        <div className="bg-white border border-gray-150 rounded-2xl p-4 mt-4 space-y-3 shadow-inner animate-in slide-in-from-top-3 duration-300">
                          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">
                            {activeAction.type === 'revision' ? 'Pedir Alteração — Sugestão 2' : 'Reprovar — Sugestão 2'}
                          </span>
                          <textarea
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                            placeholder={activeAction.type === 'revision' ? "Digite detalhadamente qual alteração você deseja..." : "Digite o motivo da reprovação..."}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark transition-all resize-none min-h-[70px]"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setActiveAction(null)}
                              className="px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-wider"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={async () => {
                                if (!actionReason.trim()) {
                                  alert('Por favor, informe a observação/motivo.');
                                  return;
                                }
                                const updated = { ...themeStatusState, status_2: activeAction.type, comment_2: actionReason.trim() };
                                await handleSaveClientReviewState(updated);
                              }}
                              disabled={isSavingTheme}
                              className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-white shadow-sm ${
                                activeAction.type === 'revision' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-rose-500 hover:bg-rose-600'
                              }`}
                            >
                              Confirmar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* MOSTRAR FEEDBACK E BOTÃO EDITAR PARA TEMA 2 */}
                      {themeStatusState.status_2 !== 'pending' && themeStatusState.status_2 !== null && (
                        <div className="mt-4 pt-3 border-t border-gray-100/60 space-y-2">
                          {themeStatusState.comment_2 && (
                            <div className="bg-white/80 border border-black/[0.03] rounded-xl p-3 text-xs text-gray-600">
                              <span className="font-bold text-[9px] uppercase text-gray-400 tracking-wider block mb-1">
                                {themeStatusState.status_2 === 'revision' ? 'Feedback de Alteração:' : 'Motivo da Reprovação:'}
                              </span>
                              {editingCommentIndex === 2 ? (
                                <div className="space-y-3 mt-1.5">
                                  <textarea
                                    value={editCommentText}
                                    onChange={(e) => setEditCommentText(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark transition-all resize-none min-h-[60px]"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => setEditingCommentIndex(null)}
                                      className="px-3 py-1.5 rounded bg-gray-100 text-gray-600 text-[9px] font-bold uppercase transition-all"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={() => handleSaveEditedComment(2)}
                                      disabled={isSavingTheme}
                                      className="px-3 py-1.5 rounded bg-brand-dark text-white hover:bg-opacity-95 text-[9px] font-bold uppercase transition-all"
                                    >
                                      Salvar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="italic">"{themeStatusState.comment_2}"</p>
                              )}
                            </div>
                          )}

                           {editingCommentIndex !== 2 && (
                             <div className="flex gap-2 items-center">
                               {themeStatusState.comment_2 && (
                                 <button
                                   onClick={() => {
                                     setEditingCommentIndex(2);
                                     setEditCommentText(themeStatusState.comment_2);
                                   }}
                                   className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-brand-dark hover:opacity-85"
                                 >
                                   <Edit3 size={11} /> Editar Observação
                                 </button>
                               )}
                               {confirmResetIndex === 2 ? (
                                 <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl ml-auto animate-in fade-in duration-200">
                                   <span className="text-[9px] font-bold text-rose-700">Confirmar?</span>
                                   <button
                                     onClick={async (e) => {
                                       e.stopPropagation();
                                       setConfirmResetIndex(null);
                                       await handleResetDecision(2);
                                     }}
                                     className="px-2 py-0.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-[8px] font-black uppercase transition-all"
                                   >
                                     Sim
                                   </button>
                                   <button
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setConfirmResetIndex(null);
                                     }}
                                     className="px-2 py-0.5 bg-gray-150 hover:bg-gray-200 text-gray-700 rounded text-[8px] font-black uppercase transition-all"
                                   >
                                     Não
                                   </button>
                                 </div>
                               ) : (
                                 <button
                                   onClick={() => setConfirmResetIndex(2)}
                                   className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-500 hover:opacity-85 ml-auto"
                                 >
                                   <RefreshCw size={11} /> Refazer Avaliação
                                 </button>
                               )}
                             </div>
                           )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="bg-gray-50 p-6 border-t border-gray-100 shrink-0 flex flex-wrap gap-3 items-center justify-end">
              {userRole === 'admin' ? (
                /* FOOTER AGÊNCIA */
                <>
                  {selectedTheme && (
                    confirmDelete ? (
                      <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl mr-auto animate-in fade-in duration-200">
                        <span className="text-[10px] font-bold text-rose-700">Confirmar Exclusão?</span>
                        <button
                          onClick={async () => {
                            setConfirmDelete(false);
                            await handleDeleteThemeSuggestion();
                          }}
                          className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase transition-all"
                        >
                          Sim
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[9px] font-black uppercase transition-all"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        disabled={isSavingTheme}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all text-[10px] font-black uppercase tracking-widest mr-auto disabled:opacity-50"
                      >
                        <Trash size={14} /> Excluir
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setIsThemeModalOpen(false)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl hover:bg-gray-100 text-gray-500 transition-all text-[10px] font-black uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveThemeSuggestion}
                    disabled={isSavingTheme || !theme1.trim()}
                    className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-brand-dark text-white hover:bg-opacity-90 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50 shadow-lg"
                  >
                    {isSavingTheme ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {selectedTheme ? 'Atualizar' : 'Salvar Sugestão'}
                  </button>
                </>
              ) : (
                /* FOOTER CLIENTE */
                <>
                  <button
                    onClick={() => setIsThemeModalOpen(false)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl hover:bg-gray-100 text-gray-500 transition-all text-[10px] font-black uppercase tracking-widest"
                  >
                    Fechar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
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

      {/* Floating Bulk Actions Bar */}
      <AnimatePresence>
        {userRole === 'admin' && selectedPosts.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0A0A0A]/95 text-white px-6 py-4 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col md:flex-row items-center gap-6 backdrop-blur-2xl max-w-[95vw] md:max-w-none"
          >
            {/* Counter Section */}
            <div className="flex items-center gap-4 pr-6 md:border-r border-white/10">
              <div className="w-10 h-10 rounded-full bg-brand-green text-brand-dark flex items-center justify-center font-black text-sm shadow-lg shadow-brand-green/20">
                {selectedPosts.size}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Selecionados</span>
                <span className="text-[9px] font-medium text-white/40 uppercase tracking-widest">Publicações do mês</span>
              </div>
            </div>

            {/* Actions Section */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={10} className="text-brand-green" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Mudar Status em Massa</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Send for Approval - Main Action */}
                <button
                  onClick={() => handleBulkStatusChange('pending_approval')}
                  disabled={isBulkUpdating}
                  className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-green text-brand-dark hover:bg-white transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-brand-green/10"
                >
                  <FileCheck size={14} className="group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Enviar p/ Aprovação</span>
                </button>

                <div className="h-4 w-px bg-white/10 mx-1 hidden md:block" />

                {[
                  { id: 'draft', label: 'Produção', icon: <Edit2 size={12} /> },
                  { id: 'approved', label: 'Aprovar', icon: <Check size={12} /> },
                  { id: 'scheduled', label: 'Agendar', icon: <CalendarIcon size={12} /> },
                  { id: 'published', label: 'Publicar', icon: <CheckCircle2 size={12} /> }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleBulkStatusChange(s.id as PostStatus)}
                    disabled={isBulkUpdating}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                  >
                    <span className="text-white/40">{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Utilities Section */}
            <div className="flex items-center gap-3 pl-6 md:border-l border-white/10">
              <button 
                onClick={handleBulkDelete}
                disabled={isDeleting || isBulkUpdating}
                className="w-11 h-11 flex items-center justify-center bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all shadow-lg active:scale-90"
                title="Excluir Selecionados"
              >
                <Trash size={18} />
              </button>
              <button 
                onClick={() => setSelectedPosts(new Set())}
                className="w-11 h-11 flex items-center justify-center bg-white/5 hover:bg-white/20 text-white/60 hover:text-white rounded-2xl transition-all active:scale-90"
                title="Desmarcar Todos"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

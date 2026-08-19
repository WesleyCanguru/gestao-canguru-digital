import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  CheckCircle2, 
  BarChart3, 
  Clock, 
  Building2, 
  ListTodo, 
  Eye, 
  EyeOff, 
  Briefcase,
  Hourglass,
  Edit3,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Instagram,
  Linkedin,
  Video,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { motion, AnimatePresence } from 'motion/react';
import { Client, AgencyTask, AgencyCRM, AgencyLead, PostStatus, DailyContent } from '../../types';
import { parseExpenseRow, filterExpensesForMonth } from '../../lib/expenses';
import { AgencyLogo } from '../AgencyLogo';
import { PostModal } from '../PostModal';
import { GoalsWidget } from './GoalsWidget';

dayjs.locale('pt-br');

interface FinancialData {
  receitas: number;
  despesas: number;
  saldo: number;
  ticketMedio: number;
  faturamentoAcumulado: number;
}

interface CRMOverview {
  board: AgencyCRM;
  totalActive: number;
  topStages: { name: string; count: number }[];
}

interface DaySummaryCounts {
  hoje: number;
  pendentes: number;
  alteracao: number;
}

interface WeekPostItem {
  id: string;
  dateKey: string;
  groupKeys?: string[];
  day: number;
  month: number;
  year: number;
  dateStr: string;
  client: {
    id: string;
    name: string;
    logo_url?: string | null;
    color?: string | null;
    initials?: string | null;
  };
  type: string;
  theme: string;
  status: PostStatus;
  platforms: ('meta' | 'linkedin' | 'tiktok')[];
  scheduled_time?: string | null;
  rawPost?: any;
}

interface WeekDayGroup {
  date: dayjs.Dayjs;
  isToday: boolean;
  isTomorrow: boolean;
  label: string;
  items: WeekPostItem[];
}

interface HomeTabProps {
  onNavigateToClients: (client: Client) => void;
  onNavigateToMasterMap?: (filter?: { aba?: 'dashboard' | 'publicacoes'; status?: string; periodo?: string; date?: string }) => void;
  onNavigateToPainelConteudo?: (filter?: { aba?: 'dashboard' | 'publicacoes'; status?: string; periodo?: string; date?: string }) => void;
  onNavigateToMetas?: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({ onNavigateToClients, onNavigateToMasterMap, onNavigateToPainelConteudo, onNavigateToMetas }) => {
  const { agencyId, agencyName } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Modal de edição / visualização de post direto da semana
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{
    dayContent: DailyContent;
    dateKey: string;
    groupKeys?: string[];
    isNew?: boolean;
    clientOverride?: any;
  } | null>(null);

  const [financial, setFinancial] = useState<FinancialData>({ 
    receitas: 0, 
    despesas: 0, 
    saldo: 0,
    ticketMedio: 0,
    faturamentoAcumulado: 0
  });

  const [summaryCounts, setSummaryCounts] = useState<DaySummaryCounts>({
    hoje: 0,
    pendentes: 0,
    alteracao: 0
  });

  const [weekGroups, setWeekGroups] = useState<WeekDayGroup[]>([]);
  const [totalWeekPostsCount, setTotalWeekPostsCount] = useState(0);

  const [urgentTasks, setUrgentTasks] = useState<AgencyTask[]>([]);
  const [crmOverviews, setCrmOverviews] = useState<CRMOverview[]>([]);
  const [showFinancials, setShowFinancials] = useState(() => {
    const stored = localStorage.getItem('canguru_show_financials');
    return stored ? JSON.parse(stored) : true;
  });

  const toggleFinancials = () => {
    setShowFinancials((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('canguru_show_financials', JSON.stringify(next));
      return next;
    });
  };

  const [showWeekPosts, setShowWeekPosts] = useState(() => {
    const stored = localStorage.getItem('canguru_show_week_posts');
    return stored !== null ? JSON.parse(stored) : true;
  });

  const toggleWeekPosts = () => {
    setShowWeekPosts((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('canguru_show_week_posts', JSON.stringify(next));
      return next;
    });
  };

  const fetchData = async () => {
    if (!agencyId) return;
    try {
      setLoading(true);
      const currentMonthYear = dayjs().format('YYYY-MM');

      const [
        { data: tempRevenue }, 
        { data: tempExpenses },
        { data: tempTasks },
        { data: tempCrms },
        { data: tempLeads },
        { data: tempClients },
        { data: tempPosts }
      ] = await Promise.all([
        supabase.from('agency_billing')
          .select('total_value')
          .eq('agency_id', agencyId)
          .eq('status', 'paid')
          .eq('month_year', currentMonthYear),
        supabase.from('agency_expenses')
          .select('*')
          .eq('agency_id', agencyId)
          .not('is_deleted', 'is', true),
        supabase.from('agency_tasks')
          .select('*, client:clients(id, name, color, initials)')
          .eq('agency_id', agencyId)
          .neq('status', 'done')
          .order('due_date', { ascending: false }),
        supabase.from('agency_crms')
          .select('*')
          .eq('agency_id', agencyId)
          .order('position', { ascending: true }),
        supabase.from('agency_leads')
          .select('*')
          .eq('agency_id', agencyId)
          .neq('stage', 'Perdido'),
        supabase.from('clients')
          .select('id, name, logo_url, color, initials, base_value, created_at, updated_at, client_status, service_end_date, client_type')
          .eq('agency_id', agencyId)
          .neq('is_internal', true)
          .in('client_status', ['active', 'completed', 'cancelled']),
        supabase.from('posts')
          .select(`
            *,
            clients:client_id (
              id,
              name,
              logo_url,
              color,
              initials,
              client_status,
              cancelled_at
            )
          `)
          .eq('agency_id', agencyId)
          .neq('status', 'deleted')
          .limit(10000)
      ]);

      // Calculate Finances
      let totalReceitas = 0;
      let totalDespesas = 0;
      
      if (tempRevenue) {
        totalReceitas = tempRevenue.reduce((sum, r) => sum + (Number(r.total_value) || 0), 0);
      }
      if (tempExpenses) {
        const parsedExpenses = tempExpenses.map(parseExpenseRow);
        const activeMonthExpenses = filterExpensesForMonth(parsedExpenses, currentMonthYear);
        totalDespesas = activeMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      }

      // Calculate Ticket Médio (only active and recurring clients)
      const activeRecurringClients = (tempClients || []).filter((c: any) => c.client_status === 'active' && c.client_type === 'recurring');
      const totalActiveBaseValue = activeRecurringClients.reduce((sum: number, c: any) => sum + (Number(c.base_value) || 0), 0);
      const ticketMedio = activeRecurringClients.length > 0 ? totalActiveBaseValue / activeRecurringClients.length : 0;

      // Calculate Faturamento Acumulado no Ano
      const anoAtual = dayjs().year();
      const mesAtual = dayjs().month() + 1; // 1-12

      let faturamentoAcumulado = 0;

      for (const client of (tempClients || []) as any[]) {
        if (!client.base_value) continue;
        
        const criacao = dayjs(client.created_at);
        const anoCriacao = criacao.year();
        const mesCriacao = criacao.month() + 1;
        
        const mesInicio = anoCriacao < anoAtual ? 1 : mesCriacao;
        
        let mesFim = mesAtual;
        if (client.client_status === 'cancelled' || client.client_status === 'completed') {
          const endDateStr = client.service_end_date || client.updated_at;
          if (endDateStr) {
            const endDate = dayjs(endDateStr);
            const anoEnd = endDate.year();
            const mesEnd = endDate.month() + 1;
            if (anoEnd < anoAtual) {
              mesFim = 0;
            } else if (anoEnd === anoAtual) {
              mesFim = Math.min(mesAtual, mesEnd);
            }
          }
        }
        
        const mesesAtivos = Math.max(0, mesFim - mesInicio + 1);
        faturamentoAcumulado += (Number(client.base_value) || 0) * mesesAtivos;
      }
      
      setFinancial({
        receitas: totalReceitas,
        despesas: totalDespesas,
        saldo: totalReceitas - totalDespesas,
        ticketMedio,
        faturamentoAcumulado
      });

      // Process Posts for Summary & This Week
      const validPosts = (tempPosts || []).filter((post: any) => {
        if (post.is_deleted) return false;
        if (post.status === 'deleted') return false;

        // Ocultar posts futuros de clientes cancelados
        if (post.clients?.client_status === 'cancelled' && post.clients?.cancelled_at) {
          const parts = (post.date_key || '').split('-');
          if (parts.length >= 3) {
            const postDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            if (postDateStr > post.clients.cancelled_at) {
              return false;
            }
          }
        }
        return true;
      });

      const today = dayjs();
      const todayDay = today.date();
      const todayMonth = today.month() + 1;
      const todayYear = today.year();

      let countHoje = 0;
      let countPendentes = 0;
      let countAlteracao = 0;

      // Group posts for summary counts and week
      const todayGroupKeys = new Set<string>();

      validPosts.forEach((post: any) => {
        const parts = (post.date_key || '').split('-');
        if (parts.length < 3) return;

        const pDay = parseInt(parts[0], 10);
        const pMonth = parseInt(parts[1], 10);
        const pYear = parseInt(parts[2], 10);

        if (pDay === todayDay && pMonth === todayMonth && pYear === todayYear) {
          const groupKey = `${pDay}-${pMonth}-${pYear}-${post.client_id}-${(post.theme || '').trim().toLowerCase()}`;
          if (!todayGroupKeys.has(groupKey)) {
            todayGroupKeys.add(groupKey);
            countHoje++;
          }
        }

        if (post.status === 'pending_approval' || post.status === 'theme_pending') {
          countPendentes++;
        } else if (post.status === 'changes_requested') {
          countAlteracao++;
        }
      });

      setSummaryCounts({
        hoje: countHoje,
        pendentes: countPendentes,
        alteracao: countAlteracao
      });

      // Build 7-day groups (today to today+6)
      const weekDays: WeekDayGroup[] = [];
      const STATUS_PRIORITY: Record<string, number> = {
        'theme_rejected': 1,
        'rejected': 1,
        'changes_requested': 2,
        'pending_approval': 3,
        'theme_pending': 4,
        'draft': 5,
        'approved': 6,
        'theme_approved': 7,
        'scheduled': 8,
        'published': 9
      };

      let totalWeekItems = 0;

      for (let i = 0; i < 7; i++) {
        const dObj = today.add(i, 'day');
        const dDay = dObj.date();
        const dMonth = dObj.month() + 1;
        const dYear = dObj.year();

        const isToday = i === 0;
        const isTomorrow = i === 1;

        let label = '';
        if (isToday) {
          label = `Hoje, ${dObj.format('DD/MM')}`;
        } else if (isTomorrow) {
          label = `Amanhã, ${dObj.format('DD/MM')}`;
        } else {
          const dayName = dObj.format('dddd');
          const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
          label = `${capitalized}, ${dObj.format('DD/MM')}`;
        }

        // Find posts matching this specific day
        const dayPosts = validPosts.filter((post: any) => {
          const parts = (post.date_key || '').split('-');
          if (parts.length < 3) return false;
          return parseInt(parts[0], 10) === dDay && 
                 parseInt(parts[1], 10) === dMonth && 
                 parseInt(parts[2], 10) === dYear;
        });

        // Group sibling platform posts for the same client & theme
        const groupedMap: Record<string, WeekPostItem> = {};

        dayPosts.forEach((post: any) => {
          const parts = post.date_key.split('-');
          const platform = (parts[3] || 'meta') as 'meta' | 'linkedin' | 'tiktok';
          const cleanTheme = (post.theme || post.theme_title || 'Sem tema definido').trim().toLowerCase();
          const clientId = post.client_id || post.clients?.id || 'unknown';
          const gKey = `${clientId}-${cleanTheme}`;

          const clientData = post.clients || {
            id: clientId,
            name: 'Cliente',
            logo_url: null,
            color: '#1A1A1A',
            initials: 'CL'
          };

          if (!groupedMap[gKey]) {
            groupedMap[gKey] = {
              id: post.id || post.date_key,
              dateKey: post.date_key,
              groupKeys: [post.date_key],
              day: dDay,
              month: dMonth,
              year: dYear,
              dateStr: dObj.format('YYYY-MM-DD'),
              client: {
                id: clientData.id,
                name: clientData.name || 'Cliente sem nome',
                logo_url: clientData.logo_url,
                color: clientData.color,
                initials: clientData.initials
              },
              type: post.type || 'Post',
              theme: post.theme || post.theme_title || 'Sem tema definido',
              status: post.status as PostStatus,
              platforms: [platform],
              scheduled_time: post.scheduled_time || null,
              rawPost: post
            };
          } else {
            if (groupedMap[gKey].groupKeys && !groupedMap[gKey].groupKeys.includes(post.date_key)) {
              groupedMap[gKey].groupKeys.push(post.date_key);
            }
            if (!groupedMap[gKey].platforms.includes(platform)) {
              groupedMap[gKey].platforms.push(platform);
            }
            // Update to highest priority status
            const currentPriority = STATUS_PRIORITY[groupedMap[gKey].status] || 99;
            const newPriority = STATUS_PRIORITY[post.status] || 99;
            if (newPriority < currentPriority) {
              groupedMap[gKey].status = post.status;
            }
          }
        });

        const dayItems = Object.values(groupedMap);
        totalWeekItems += dayItems.length;

        weekDays.push({
          date: dObj,
          isToday,
          isTomorrow,
          label,
          items: dayItems
        });
      }

      setWeekGroups(weekDays);
      setTotalWeekPostsCount(totalWeekItems);

      // Urgent Tasks (Due <= 3 days OR priority IN ['alta', 'urgente'])
      const pTasks = (tempTasks || []) as any[];
      const filteredTasks = pTasks.filter(t => {
        if (t.priority === 'alta' || t.priority === 'urgente') return true;
        if (!t.due_date) return false;
        return dayjs(t.due_date).isBefore(dayjs().add(3, 'day'), 'day') || dayjs(t.due_date).isSame(dayjs().add(3, 'day'), 'day');
      });
      filteredTasks.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf();
      });
      
      setUrgentTasks(filteredTasks.slice(0, 5));

      // CRM Overview
      const leads = tempLeads || [];
      const crms = tempCrms as AgencyCRM[] || [];
      
      const crmOvs = crms.map(board => {
        const boardLeads = leads.filter(l => l.crm_id === board.id);
        const counts: Record<string, number> = {};
        boardLeads.forEach(l => {
          counts[l.stage] = (counts[l.stage] || 0) + 1;
        });
        
        const topStages = Object.keys(counts)
          .map(stageName => ({ name: stageName, count: counts[stageName] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
          
        return {
          board,
          totalActive: boardLeads.length,
          topStages
        };
      });
      
      setCrmOverviews(crmOvs);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('home_tab_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_tasks', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_crms', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_leads', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_billing', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_expenses', filter: `agency_id=eq.${agencyId}` }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId, agencyName]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-3xl animate-pulse" />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {[1,2].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-white rounded-3xl animate-pulse" />
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const labelPeriodo = `Jan–${monthNames[dayjs().month()]} de ${dayjs().year()}`;

  const handleOpenPostModal = (item: WeekPostItem) => {
    const dayStr = item.day < 10 ? `0${item.day}` : `${item.day}`;
    const monthStr = item.month < 10 ? `0${item.month}` : `${item.month}`;

    const dayContent: DailyContent = {
      day: `${dayStr}/${monthStr}`,
      platform: item.platforms[0] || 'meta',
      type: item.type,
      theme: item.theme,
      bullets: item.rawPost?.bullets || [],
      initialImageUrl: item.rawPost?.image_url || undefined
    };

    setSelectedPost({
      dayContent,
      dateKey: item.dateKey,
      groupKeys: item.groupKeys || [item.dateKey],
      clientOverride: item.client,
      isNew: false
    });
    setModalOpen(true);
  };

  const getStatusBadge = (status: PostStatus) => {
    switch (status) {
      case 'pending_approval':
      case 'theme_pending':
        return {
          label: 'Aprovação',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
          dotClass: 'bg-amber-500'
        };
      case 'changes_requested':
        return {
          label: 'Alteração',
          badgeClass: 'bg-orange-50 text-orange-700 border-orange-200/80',
          dotClass: 'bg-orange-500'
        };
      case 'approved':
      case 'theme_approved':
        return {
          label: 'Aprovado',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          dotClass: 'bg-emerald-500'
        };
      case 'published':
        return {
          label: 'Publicado',
          badgeClass: 'bg-green-50 text-green-700 border-green-200/80',
          dotClass: 'bg-green-500'
        };
      case 'scheduled':
        return {
          label: 'Programado',
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
          dotClass: 'bg-indigo-500'
        };
      case 'rejected':
      case 'theme_rejected':
        return {
          label: 'Reprovado',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
          dotClass: 'bg-rose-500'
        };
      case 'draft':
      default:
        return {
          label: 'Rascunho',
          badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
          dotClass: 'bg-stone-400'
        };
    }
  };

  // Flatten week items to enforce the 10-item limit across days
  let renderedCount = 0;
  const maxDisplayItems = 10;

  return (
    <div className="space-y-10 pb-16">
      
      {/* HEADER MOTIVACIONAL */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-4 pt-6 px-2">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            <AgencyLogo className="h-20 mix-blend-multiply" />
            <div className="text-center md:text-left space-y-1">
              <h1 className="text-brand-dark font-bold text-4xl sm:text-5xl tracking-tighter font-serif italic">
                Bolsa
              </h1>
              <div className="h-0.5 bg-brand-dark w-10 opacity-20 md:mr-auto mx-auto translate-y-1"></div>
              <p className="text-stone-400 text-[9px] uppercase tracking-[0.35em] font-bold !mt-4">
                {agencyName || 'Canguru Digital'} • Gestão & Estratégia
              </p>
            </div>
          </div>
          <div className="max-w-2xl">
            <p className="text-lg text-stone-500 font-medium leading-relaxed italic opacity-85 border-l-2 border-brand-dark/15 pl-5 py-1">
              "Cada cliente bem cuidado é mais um passo no que estamos construindo."
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={toggleFinancials}
            className="flex items-center gap-2.5 px-5 py-3.5 bg-white rounded-2xl border border-black/[0.04] shadow-2xs text-stone-500 hover:text-brand-dark transition-all font-bold uppercase text-[10px] tracking-widest group active:scale-95"
          >
            {showFinancials ? (
              <>
                <EyeOff size={16} className="group-hover:scale-110 transition-transform" />
                <span>Ocultar Finanças</span>
              </>
            ) : (
              <>
                <Eye size={16} className="group-hover:scale-110 transition-transform" />
                <span>Mostrar Finanças</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* BLOCO FINANCEIRO */}
      <div className="space-y-4">
        {/* Linha 1 - Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-6 rounded-3xl border border-black/[0.03] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Receitas do Mês</p>
                <h3 className="text-xl font-bold text-brand-dark">
                  {showFinancials ? formatCurrency(financial.receitas) : 'R$ ••••••••'}
                </h3>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-black/[0.03] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
                <TrendingDown size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Despesas do Mês</p>
                <h3 className="text-xl font-bold text-brand-dark">
                  {showFinancials ? formatCurrency(financial.despesas) : 'R$ ••••••••'}
                </h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-black/[0.03] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${financial.saldo >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                <DollarSign size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Saldo do Mês</p>
                <h3 className={`text-xl font-bold ${!showFinancials ? 'text-brand-dark' : financial.saldo >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {showFinancials ? formatCurrency(financial.saldo) : 'R$ ••••••••'}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Linha 2 - Indicadores de Apoio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div className="bg-white/80 p-4 rounded-2xl border border-black/[0.02] shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Briefcase size={16} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Ticket Médio</p>
                <h4 className="text-base font-bold text-brand-dark">
                  {showFinancials ? formatCurrency(financial.ticketMedio) : 'R$ ••••••••'}
                </h4>
                <p className="text-[8px] text-stone-400 font-medium mt-0.5">por cliente recorrente</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 p-4 rounded-2xl border border-black/[0.02] shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <BarChart3 size={16} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Faturado no Ano</p>
                <h4 className="text-base font-bold text-brand-dark">
                  {showFinancials ? formatCurrency(financial.faturamentoAcumulado) : 'R$ ••••••••'}
                </h4>
                <p className="text-[8px] text-stone-400 font-medium mt-0.5">{labelPeriodo}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: RESUMO DO DIA (LINHA DE NÚMEROS / MINI-CARDS CLICÁVEIS) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <h2 className="text-xs font-bold text-stone-400 uppercase tracking-[0.2em]">
            Visão Rápida • O que precisa de atenção
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Publicações Hoje */}
          <button
            onClick={() => (onNavigateToPainelConteudo || onNavigateToMasterMap)?.({ aba: 'publicacoes', periodo: 'hoje' })}
            className={`p-4 sm:p-5 rounded-2xl border transition-all text-left flex items-center justify-between group active:scale-[0.98] cursor-pointer ${
              summaryCounts.hoje > 0 
                ? 'bg-white hover:bg-indigo-50/40 border-indigo-200/80 shadow-2xs' 
                : 'bg-stone-50/70 hover:bg-stone-100/80 border-stone-200/60 text-stone-500'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                summaryCounts.hoje > 0 
                  ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100' 
                  : 'bg-stone-100 text-stone-400'
              }`}>
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Publicações Hoje
                </p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className={`text-xl font-bold tracking-tight ${summaryCounts.hoje > 0 ? 'text-indigo-900' : 'text-stone-600'}`}>
                    {summaryCounts.hoje}
                  </span>
                  <span className="text-xs font-medium text-stone-500">
                    {summaryCounts.hoje === 1 ? 'pub agendada' : 'pubs agendadas'}
                  </span>
                </div>
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 pr-1">
              <ChevronRight size={18} />
            </div>
          </button>

          {/* 2. Aguardando Aprovação */}
          <button
            onClick={() => (onNavigateToPainelConteudo || onNavigateToMasterMap)?.({ aba: 'publicacoes', status: 'pending_approval' })}
            className={`p-4 sm:p-5 rounded-2xl border transition-all text-left flex items-center justify-between group active:scale-[0.98] cursor-pointer ${
              summaryCounts.pendentes > 0 
                ? 'bg-white hover:bg-amber-50/40 border-amber-300 shadow-2xs' 
                : 'bg-stone-50/70 hover:bg-stone-100/80 border-stone-200/60 text-stone-500'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                summaryCounts.pendentes > 0 
                  ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-100' 
                  : 'bg-stone-100 text-stone-400'
              }`}>
                <Clock size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Aguardando Aprovação
                </p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className={`text-xl font-bold tracking-tight ${summaryCounts.pendentes > 0 ? 'text-amber-900' : 'text-stone-600'}`}>
                    {summaryCounts.pendentes}
                  </span>
                  <span className="text-xs font-medium text-stone-500">
                    {summaryCounts.pendentes === 1 ? 'pub pendente' : 'pubs pendentes'}
                  </span>
                </div>
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 pr-1">
              <ChevronRight size={18} />
            </div>
          </button>

          {/* 3. Com Alteração Solicitada */}
          <button
            onClick={() => (onNavigateToPainelConteudo || onNavigateToMasterMap)?.({ aba: 'publicacoes', status: 'changes_requested' })}
            className={`p-4 sm:p-5 rounded-2xl border transition-all text-left flex items-center justify-between group active:scale-[0.98] cursor-pointer ${
              summaryCounts.alteracao > 0 
                ? 'bg-white hover:bg-orange-50/40 border-orange-300 shadow-2xs' 
                : 'bg-stone-50/70 hover:bg-stone-100/80 border-stone-200/60 text-stone-500'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                summaryCounts.alteracao > 0 
                  ? 'bg-orange-50 text-orange-600 group-hover:bg-orange-100' 
                  : 'bg-stone-100 text-stone-400'
              }`}>
                <Edit3 size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Alteração Solicitada
                </p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className={`text-xl font-bold tracking-tight ${summaryCounts.alteracao > 0 ? 'text-orange-900' : 'text-stone-600'}`}>
                    {summaryCounts.alteracao}
                  </span>
                  <span className="text-xs font-medium text-stone-500">
                    {summaryCounts.alteracao === 1 ? 'pub com ajuste' : 'pubs com ajustes'}
                  </span>
                </div>
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 pr-1">
              <ChevronRight size={18} />
            </div>
          </button>
        </div>
      </div>

      {/* SEÇÃO 2: PUBLICAÇÕES DESTA SEMANA (LISTA COMPACTA) */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-black/[0.03] shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-dark/5 flex items-center justify-center text-brand-dark">
              <Calendar size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-brand-dark tracking-tight">
                  Publicações desta semana
                </h3>
                {totalWeekPostsCount > 0 && (
                  <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                    {totalWeekPostsCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 font-medium">Programação dos próximos 7 dias em todas as marcas</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Botão Minimizar / Mostrar */}
            <button
              onClick={toggleWeekPosts}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-stone-600 hover:text-brand-dark bg-stone-50 hover:bg-stone-100 transition-all border border-stone-200/70 cursor-pointer active:scale-95"
              title={showWeekPosts ? 'Minimizar publicações da semana' : 'Mostrar publicações da semana'}
            >
              {showWeekPosts ? (
                <>
                  <ChevronUp size={14} />
                  <span>Minimizar</span>
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  <span>Mostrar ({totalWeekPostsCount})</span>
                </>
              )}
            </button>

            {totalWeekPostsCount > 0 && (
              <button
                onClick={() => (onNavigateToPainelConteudo || onNavigateToMasterMap)?.({ aba: 'publicacoes' })}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-brand-dark transition-colors px-3 py-1.5 rounded-xl hover:bg-stone-50 group cursor-pointer"
              >
                <span>Ver todas no Painel</span>
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>

        {/* Resumo quando minimizado */}
        {!showWeekPosts && totalWeekPostsCount > 0 && (
          <div 
            onClick={toggleWeekPosts}
            className="py-3.5 px-4 rounded-2xl bg-stone-50/80 border border-stone-200/60 flex items-center justify-between text-xs text-stone-600 cursor-pointer hover:bg-stone-100/70 transition-all group"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-brand-dark">{totalWeekPostsCount} {totalWeekPostsCount === 1 ? 'publicação programada' : 'publicações programadas'}</span>
              <span className="text-stone-400 hidden sm:inline">• Clique para expandir a lista da semana</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-stone-500 group-hover:text-brand-dark text-[11px]">
              <span>Expandir</span>
              <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
            </div>
          </div>
        )}

        {/* LISTA AGRUPADA POR DIA (COM ANIMAÇÃO DE EXPANDIR/RECOLHER) */}
        <AnimatePresence initial={false}>
          {showWeekPosts && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-6"
            >
              {totalWeekPostsCount === 0 ? (
                <div className="py-12 px-6 rounded-3xl bg-stone-50/70 border border-dashed border-stone-200 text-center flex flex-col items-center justify-center">
                  <CheckCircle2 size={32} className="text-stone-300 mb-2" />
                  <p className="text-sm font-bold text-stone-700">Nenhuma publicação agendada para esta semana.</p>
                  <p className="text-xs text-stone-400 mt-1">Os calendários estão em dia ou os novos temas ainda serão planejados.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {weekGroups.map((group) => {
                    if (group.items.length === 0) return null;

                    return (
                      <div key={group.date.format('YYYY-MM-DD')} className="space-y-3">
                        {/* Cabeçalho do Dia */}
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                            group.isToday 
                              ? 'bg-indigo-100 text-indigo-800' 
                              : group.isTomorrow 
                                ? 'bg-stone-200/80 text-stone-800' 
                                : 'bg-stone-100 text-stone-600'
                          }`}>
                            {group.label}
                          </span>
                          <div className="h-px bg-stone-100 flex-grow"></div>
                        </div>

                        {/* Itens do Dia */}
                        <div className="grid grid-cols-1 gap-2.5">
                          {group.items.map((item) => {
                            if (renderedCount >= maxDisplayItems) return null;
                            renderedCount++;

                            const statusBadge = getStatusBadge(item.status);

                            return (
                              <div
                                key={item.id}
                                onClick={() => handleOpenPostModal(item)}
                                className="p-3.5 sm:p-4 rounded-2xl bg-stone-50/60 hover:bg-stone-100/70 border border-stone-200/70 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group active:scale-[0.99]"
                              >
                                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                                  {/* Logo ou Avatar do Cliente */}
                                  {item.client.logo_url ? (
                                    <img 
                                      src={item.client.logo_url} 
                                      alt={item.client.name} 
                                      className="w-6 h-6 rounded-full object-cover border border-stone-200 shrink-0 mt-0.5 sm:mt-0" 
                                    />
                                  ) : (
                                    <div 
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 sm:mt-0 shadow-2xs"
                                      style={{ backgroundColor: item.client.color || '#1A1A1A' }}
                                    >
                                      {item.client.initials || item.client.name.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}

                                  {/* Informações Principais */}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                                        {item.client.name}
                                      </span>
                                      <span className="text-stone-300 text-xs hidden sm:inline">•</span>
                                      <span className="text-[11px] font-semibold text-stone-500 bg-white/90 px-2 py-0.5 rounded-md border border-stone-200/60 shrink-0">
                                        {item.type || 'Post'}
                                      </span>
                                      {item.platforms && item.platforms.length > 0 && (
                                        <div className="flex items-center gap-1 text-stone-400">
                                          {item.platforms.includes('meta') && <Instagram size={12} className="text-pink-600" />}
                                          {item.platforms.includes('linkedin') && <Linkedin size={12} className="text-blue-600" />}
                                          {item.platforms.includes('tiktok') && <Video size={12} className="text-stone-700" />}
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-xs text-stone-600 font-medium truncate mt-0.5">
                                      Tema: "{item.theme}"
                                    </p>
                                  </div>
                                </div>

                                {/* Status Badge */}
                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 self-end sm:self-center">
                                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusBadge.badgeClass}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`}></span>
                                    {statusBadge.label}
                                  </span>
                                  <ChevronRight size={16} className="text-stone-300 group-hover:text-stone-600 transition-colors hidden sm:block" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {totalWeekPostsCount > maxDisplayItems && (
                    <div className="pt-2 text-center">
                      <button
                        onClick={() => (onNavigateToPainelConteudo || onNavigateToMasterMap)?.({ aba: 'publicacoes' })}
                        className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-brand-dark bg-stone-50 hover:bg-stone-100 px-4 py-2.5 rounded-xl transition-all border border-stone-200/60 cursor-pointer"
                      >
                        <span>Ver todas as {totalWeekPostsCount} publicações no Painel de Conteúdo</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* WIDGET DE METAS DO MÊS */}
      <GoalsWidget onNavigateToMetas={onNavigateToMetas || (() => {})} />

      {/* BLOCO 3 & 4 - TAREFAS URGENTES E FUNIS DO CRM (MANTIDOS) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* BLOCO 3 - TAREFAS URGENTES */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-black/[0.03] shadow-2xs flex flex-col gap-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2 text-brand-dark">
              <ListTodo className="text-stone-400" size={20}/> Tarefas Urgentes
            </h3>
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
              Próx 3 dias / Alta
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {urgentTasks.map(task => {
              const isOverdue = task.due_date && dayjs(task.due_date).isBefore(dayjs(), 'day');
              return (
                <div key={task.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${isOverdue ? 'bg-rose-50/70 border-rose-200' : 'bg-stone-50/60 border-stone-100 hover:border-stone-200'}`}>
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                    <p className="text-sm font-bold break-words leading-snug text-stone-900">{task.title}</p>
                    {task.client?.name && (
                      <p className="text-[11px] text-stone-500 font-medium truncate">{task.client.name}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {task.due_date && (
                      <div className={`flex items-center gap-1 text-[11px] font-bold ${isOverdue ? 'text-rose-600' : 'text-stone-500'}`}>
                        <Calendar size={12} />
                        {dayjs(task.due_date).format('DD/MM/YY')}
                      </div>
                    )}
                    {task.priority === 'urgente' && (
                      <span className="text-[9px] uppercase tracking-widest bg-rose-600 text-white px-2 py-0.5 rounded font-bold">URGENTE</span>
                    )}
                    {task.priority === 'alta' && (
                      <span className="text-[9px] uppercase tracking-widest bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold">ALTA</span>
                    )}
                  </div>
                </div>
              );
            })}
            {urgentTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-stone-400 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                <CheckCircle2 size={32} className="opacity-30 mb-2 text-emerald-500"/>
                <p className="text-sm font-bold text-stone-700">Tudo sob controle!</p>
                <p className="text-xs text-stone-400 mt-0.5">Nenhuma tarefa urgente pendente para os próximos dias.</p>
              </div>
            )}
          </div>
        </div>

        {/* BLOCO 4 - VISÃO DO CRM */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-black/[0.03] shadow-2xs flex flex-col gap-6 xl:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2 text-brand-dark">
              <BarChart3 className="text-stone-400" size={20}/> Funis do CRM
            </h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {crmOverviews.map(crm => (
              <div key={crm.board.id} className="p-5 rounded-2xl border border-stone-100 bg-stone-50/40 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-stone-900 text-sm">{crm.board.name}</h4>
                  <span className="text-xs bg-brand-dark/5 text-brand-dark font-bold px-2.5 py-0.5 rounded-full">
                    {crm.totalActive} leads
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {crm.topStages.length > 0 ? crm.topStages.map((stage, i) => (
                    <div key={i} className="flex justify-between items-center text-xs text-stone-600 border-b border-stone-100 pb-1.5 last:border-0 last:pb-0">
                      <span className="truncate pr-2 font-medium">{stage.name}</span>
                      <span className="font-bold opacity-60 bg-white px-1.5 py-0.5 rounded border border-stone-200/50">{stage.count}</span>
                    </div>
                  )) : (
                    <p className="text-xs text-stone-400 italic">Nenhum lead neste funil.</p>
                  )}
                </div>
              </div>
            ))}
            {crmOverviews.length === 0 && (
              <div className="py-8 text-center text-stone-400 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                <p className="text-xs font-medium">Nenhum painel de CRM configurado.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* POST MODAL PARA VISUALIZAÇÃO / EDIÇÃO DIRETA */}
      {modalOpen && selectedPost && (
        <PostModal
          dayContent={selectedPost.dayContent}
          dateKey={selectedPost.dateKey}
          groupKeys={selectedPost.groupKeys}
          isNew={selectedPost.isNew}
          clientOverride={selectedPost.clientOverride}
          isMasterMap={true}
          onClose={() => {
            setModalOpen(false);
            setSelectedPost(null);
          }}
          onUpdate={() => {
            fetchData();
            setModalOpen(false);
            setSelectedPost(null);
          }}
        />
      )}

    </div>
  );
};

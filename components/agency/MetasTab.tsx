import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Edit3, 
  Users, 
  PhoneCall, 
  Smartphone, 
  DollarSign, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Clock, 
  X,
  Send,
  PenLine,
  TrendingDown,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Building2,
  FileCheck,
  Lock
} from 'lucide-react';
import { useAgencyGoals } from '../../hooks/useAgencyGoals';
import { useAuth } from '../../lib/supabase';
import { CommercialActionType } from '../../types';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

interface MetasTabProps {
  onBack?: () => void;
}

export const MetasTab: React.FC<MetasTabProps> = () => {
  const { agencyId, agencyName } = useAuth();
  const isKanoa = agencyId === 2 || (agencyName && agencyName.toLowerCase().includes('kanoa'));
  const nomeProprio = isKanoa ? 'Kanoa Studio' : 'Canguru Digital';

  const {
    monthYear,
    monthLabel,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth,
    isMonthLocked,
    loading,
    goal,
    hasGoalConfigured,

    faturamentoRecebido,
    faturamentoEstaSemana,
    churnRealizado,
    saldoLiquido,
    clientPostsCount,
    ownPostsCount,
    postsCount,
    blogPostsCount,
    meetingsCount,
    proposalsCount,
    newClientsCount,

    commercialActions,

    revenueGoal,
    churnGoal,
    clientPostsGoal,
    ownPostsGoal,
    blogPostsGoal,
    meetingsGoal,
    proposalsGoal,
    newClientsGoal,
    postsGoal,

    pctFaturamento,
    pctChurn,
    pctClientPosts,
    pctOwnPosts,
    pctBlogPosts,
    pctReunioes,
    pctPropostas,
    pctNovosClientes,
    pctPublicacoes,

    weeklyGoal,
    semanaAtual,
    isPaceOnTrack,
    faltamFaturamento,
    superouFaturamento,

    coachingMessage,

    nextMonth,
    prevMonth,
    goToCurrentMonth,
    lockCurrentMonth,
    copyPreviousMonthGoals,
    refresh,
    saveGoal,
    addCommercialAction,
    deleteCommercialAction
  } = useAgencyGoals();

  // Modals & Lock/Copy state
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showProspeccaoSection, setShowProspeccaoSection] = useState(true);
  const [isProspeccaoAccordionOpen, setIsProspeccaoAccordionOpen] = useState(false);

  // Form states for Goal
  const [form, setForm] = useState({
    revenue_goal: '',
    churn_goal: '',
    client_posts_goal: '',
    own_posts_goal: '',
    blog_posts_goal: '',
    meetings_goal: '',
    proposals_goal: '',
    notes: '',
  });
  const [salvando, setSalvando] = useState(false);

  // Sincronizar form sempre que o goal ou o mês mudar
  useEffect(() => {
    if (goal) {
      setForm({
        revenue_goal: goal.revenue_goal ? String(goal.revenue_goal) : '',
        churn_goal: goal.churn_goal !== null && goal.churn_goal !== undefined ? String(goal.churn_goal) : '',
        client_posts_goal: goal.client_posts_goal !== null && goal.client_posts_goal !== undefined 
          ? String(goal.client_posts_goal) 
          : (goal.posts_goal ? String(goal.posts_goal) : ''),
        own_posts_goal: goal.own_posts_goal !== null && goal.own_posts_goal !== undefined ? String(goal.own_posts_goal) : '',
        blog_posts_goal: goal.blog_posts_goal ? String(goal.blog_posts_goal) : '',
        meetings_goal: goal.meetings_goal ? String(goal.meetings_goal) : '',
        proposals_goal: goal.proposals_goal ? String(goal.proposals_goal) : '',
        notes: goal.notes ?? '',
      });
    } else {
      setForm({
        revenue_goal: '',
        churn_goal: '',
        client_posts_goal: '',
        own_posts_goal: '',
        blog_posts_goal: '',
        meetings_goal: '',
        proposals_goal: '',
        notes: '',
      });
    }
  }, [goal, monthYear]);

  // Form states for Action
  const [actionDate, setActionDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [actionType, setActionType] = useState<CommercialActionType>('meeting');
  const [contactName, setContactName] = useState<string>('');
  const [actionResult, setActionResult] = useState<string>('');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [isSavingAction, setIsSavingAction] = useState(false);

  // Formatação de data e mês para o cabeçalho
  const monthDate = dayjs(monthYear, 'YYYY-MM');
  const rawNomeMes = monthDate.locale('pt-br').format('MMMM');
  const nomeMes = rawNomeMes.charAt(0).toUpperCase() + rawNomeMes.slice(1);
  const ano = monthDate.format('YYYY');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Resumo de metas para meses fechados
  const summaryGoalsList = React.useMemo(() => {
    const list = [];

    // Faturamento
    if (revenueGoal > 0) {
      list.push({
        key: 'revenue',
        title: 'Faturamento',
        icon: '💰',
        goalText: formatCurrency(revenueGoal),
        realizedText: formatCurrency(faturamentoRecebido),
        pct: pctFaturamento,
      });
    }

    // Reuniões
    if (meetingsGoal > 0) {
      list.push({
        key: 'meetings',
        title: 'Reuniões',
        icon: '🤝',
        goalText: String(meetingsGoal),
        realizedText: String(meetingsCount),
        pct: pctReunioes,
      });
    }

    // Posts publicados
    if (postsGoal > 0) {
      list.push({
        key: 'posts',
        title: 'Posts publicados',
        icon: '📲',
        goalText: String(postsGoal),
        realizedText: String(postsCount),
        pct: pctPublicacoes,
      });
    }

    // Propostas enviadas
    if (proposalsGoal > 0) {
      list.push({
        key: 'proposals',
        title: 'Propostas enviadas',
        icon: '📄',
        goalText: String(proposalsGoal),
        realizedText: String(proposalsCount),
        pct: pctPropostas,
      });
    }

    // Churn
    if (churnGoal > 0) {
      list.push({
        key: 'churn',
        title: 'Churn',
        icon: '📉',
        goalText: formatCurrency(churnGoal),
        realizedText: formatCurrency(churnRealizado),
        pct: pctChurn,
      });
    }

    // Novos clientes (se definido)
    if (newClientsGoal > 0) {
      list.push({
        key: 'new_clients',
        title: 'Novos clientes',
        icon: '👥',
        goalText: String(newClientsGoal),
        realizedText: String(newClientsCount),
        pct: pctNovosClientes,
      });
    }

    return list;
  }, [
    revenueGoal, faturamentoRecebido, pctFaturamento,
    meetingsGoal, meetingsCount, pctReunioes,
    postsGoal, postsCount, pctPublicacoes,
    proposalsGoal, proposalsCount, pctPropostas,
    churnGoal, churnRealizado, pctChurn,
    newClientsGoal, newClientsCount, pctNovosClientes
  ]);

  const handleConfirmLock = async () => {
    try {
      setIsLocking(true);
      await lockCurrentMonth();
      setShowLockModal(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao fechar o mês. Tente novamente.');
    } finally {
      setIsLocking(false);
    }
  };

  const handleCopyPreviousGoals = async () => {
    setIsCopying(true);
    setCopyFeedback(null);
    try {
      const res = await copyPreviousMonthGoals();
      if (!res.success) {
        setCopyFeedback({
          type: 'error',
          message: res.message || 'Nenhuma meta encontrada no mês anterior.'
        });
      } else {
        setCopyFeedback({
          type: 'success',
          message: 'Metas do mês anterior mantidas com sucesso!'
        });
      }
    } catch (err) {
      console.error('Erro ao copiar metas:', err);
      setCopyFeedback({
        type: 'error',
        message: 'Erro ao copiar metas do mês anterior.'
      });
    } finally {
      setIsCopying(false);
    }
  };

  const abrirFormulario = () => {
    if (isMonthLocked) return;
    if (goal) {
      setForm({
        revenue_goal: goal.revenue_goal ? String(goal.revenue_goal) : '',
        churn_goal: goal.churn_goal !== null && goal.churn_goal !== undefined ? String(goal.churn_goal) : '',
        client_posts_goal: goal.client_posts_goal !== null && goal.client_posts_goal !== undefined 
          ? String(goal.client_posts_goal) 
          : (goal.posts_goal ? String(goal.posts_goal) : ''),
        own_posts_goal: goal.own_posts_goal !== null && goal.own_posts_goal !== undefined ? String(goal.own_posts_goal) : '',
        blog_posts_goal: goal.blog_posts_goal ? String(goal.blog_posts_goal) : '',
        meetings_goal: goal.meetings_goal ? String(goal.meetings_goal) : '',
        proposals_goal: goal.proposals_goal ? String(goal.proposals_goal) : '',
        notes: goal.notes ?? '',
      });
      // Abrir o acordeão de prospecção se já houver valores nele
      if ((goal.meetings_goal || 0) > 0 || (goal.proposals_goal || 0) > 0) {
        setIsProspeccaoAccordionOpen(true);
      }
    }
    setShowGoalModal(true);
  };

  const fecharFormulario = () => {
    setShowGoalModal(false);
  };

  const salvar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSalvando(true);

    try {
      await saveGoal({
        revenue_goal: parseFloat(form.revenue_goal) || 0,
        churn_goal: form.churn_goal ? parseFloat(form.churn_goal) : null,
        client_posts_goal: form.client_posts_goal ? parseInt(form.client_posts_goal, 10) : null,
        own_posts_goal: form.own_posts_goal ? parseInt(form.own_posts_goal, 10) : null,
        blog_posts_goal: form.blog_posts_goal ? parseInt(form.blog_posts_goal, 10) : null,
        meetings_goal: form.meetings_goal ? parseInt(form.meetings_goal, 10) : null,
        proposals_goal: form.proposals_goal ? parseInt(form.proposals_goal, 10) : null,
        notes: form.notes ? form.notes.trim() : null,
      });

      fecharFormulario();
    } catch (err) {
      console.error('Erro ao salvar metas:', err);
      alert('Erro ao salvar metas. Por favor, tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleOpenActionModal = () => {
    setActionDate(isCurrentMonth ? dayjs().format('YYYY-MM-DD') : `${monthYear}-01`);
    setActionType('meeting');
    setContactName('');
    setActionResult('');
    setActionNotes('');
    setShowActionModal(true);
  };

  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;
    try {
      setIsSavingAction(true);
      await addCommercialAction({
        action_date: actionDate,
        action_type: actionType,
        contact_name: contactName.trim(),
        result: actionResult.trim() || 'Em andamento',
        notes: actionNotes.trim() || null
      });
      setShowActionModal(false);
    } catch (err) {
      console.error('Erro ao salvar ação comercial:', err);
    } finally {
      setIsSavingAction(false);
    }
  };

  const getActionTypeBadge = (type: CommercialActionType) => {
    switch (type) {
      case 'meeting':
        return {
          label: 'Reunião',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          dotClass: 'bg-emerald-500'
        };
      case 'call':
        return {
          label: 'Call',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
          dotClass: 'bg-blue-500'
        };
      case 'proposal':
        return {
          label: 'Proposta',
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
          dotClass: 'bg-purple-500'
        };
      case 'follow_up':
      default:
        return {
          label: 'Follow-up',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
          dotClass: 'bg-amber-500'
        };
    }
  };

  if (loading && !goal) {
    return (
      <div className="space-y-6 animate-pulse py-4">
        <div className="h-16 bg-white rounded-2xl" />
        <div className="h-64 bg-white rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-36 bg-white rounded-3xl" />
          <div className="h-36 bg-white rounded-3xl" />
          <div className="h-36 bg-white rounded-3xl" />
        </div>
      </div>
    );
  }

  const hasGoals = Boolean(goal) || hasGoalConfigured;

  return (
    <div className="space-y-7 pb-16">
      {/* 1. NAVEGADOR DE MÊS */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button 
            onClick={prevMonth}
            className="w-10 h-10 rounded-xl bg-white border border-[#e5e7eb] text-[#13284D] hover:bg-stone-50 flex items-center justify-center font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Mês anterior"
            type="button"
          >
            ◀
          </button>
          
          <h2 className="text-xl font-bold tracking-tight text-[#13284D] min-w-[170px] text-center capitalize">
            {nomeMes} de {ano}
          </h2>

          <button 
            onClick={nextMonth}
            className="w-10 h-10 rounded-xl bg-white border border-[#e5e7eb] text-[#13284D] hover:bg-stone-50 flex items-center justify-center font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Próximo mês"
            type="button"
          >
            ▶
          </button>

          {!isCurrentMonth && (
            <button
              onClick={goToCurrentMonth}
              className="px-3 py-2 text-xs font-bold bg-white text-[#13284D] hover:bg-stone-50 border border-[#e5e7eb] rounded-xl transition-all shadow-2xs cursor-pointer"
              type="button"
            >
              Mês atual
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2.5 flex-wrap">
          {/* Botão "Manter metas do mês passado" */}
          {isCurrentMonth && (!hasGoals || !hasGoalConfigured) && !isMonthLocked && (
            <button
              onClick={handleCopyPreviousGoals}
              disabled={isCopying}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              type="button"
            >
              <Sparkles size={16} />
              <span>{isCopying ? 'Copiando...' : 'Manter metas do mês passado'}</span>
            </button>
          )}

          {/* Botão "Fechar mês" (apenas no mês atual e se não estiver bloqueado) */}
          {isCurrentMonth && !isMonthLocked && (
            <button
              onClick={() => setShowLockModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              type="button"
              title="Encerrar o mês e bloquear edições"
            >
              <Lock size={16} />
              <span>Fechar mês</span>
            </button>
          )}

          {/* Indicador de Mês Bloqueado / Botão Editar Metas */}
          {isMonthLocked ? (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 border border-stone-200/80 rounded-xl text-xs font-bold text-stone-600">
              <Lock size={14} className="text-stone-500" />
              <span>Mês Bloqueado</span>
            </div>
          ) : (
            <button 
              onClick={abrirFormulario} 
              className="flex items-center gap-2 px-4 py-2.5 bg-[#13284D] text-white rounded-xl text-sm font-bold hover:bg-[#13284D]/90 transition-all shadow-xs cursor-pointer active:scale-95"
              type="button"
            >
              <span>✏️</span>
              <span>{hasGoals ? 'Editar metas' : 'Definir metas'}</span>
            </button>
          )}
        </div>
      </div>

      {/* AVISO DE MÊS PASSADO (HISTÓRICO) */}
      {isPastMonth && (
        <div className="bg-stone-100/80 border border-stone-200/80 rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-stone-500" />
            <span className="font-bold text-stone-800">{nomeMes} de {ano} — Mês Encerrado</span>
            <span className="text-stone-400 hidden sm:inline">• Visualização em modo histórico consolidado (somente leitura)</span>
          </div>
          <span className="font-semibold text-[11px] bg-stone-200/70 text-stone-700 px-2.5 py-0.5 rounded-full">
            Histórico
          </span>
        </div>
      )}

      {/* CARD DE RESUMO EM MESES FECHADOS */}
      {isMonthLocked && (
        <div className="bg-slate-50 border border-slate-200/90 rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/70">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#13284D] text-white flex items-center justify-center font-bold shadow-xs">
                <Target size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#13284D]">
                  Resultado de {nomeMes} {ano}
                </h3>
                <p className="text-xs text-stone-500 font-medium">
                  Resumo consolidado do desempenho e atingimento de metas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-200/80 text-stone-700 rounded-full text-xs font-bold">
                <Lock size={14} />
                Mês Fechado
              </span>
            </div>
          </div>

          {/* Lista de Metas Definidas */}
          {summaryGoalsList.length > 0 ? (
            <div className="space-y-4">
              {summaryGoalsList.map((item) => {
                let barColor = 'bg-rose-500';
                let textColor = 'text-rose-700';
                let badgeBg = 'bg-rose-50 border-rose-200/80';

                if (item.pct >= 100) {
                  barColor = 'bg-emerald-500';
                  textColor = 'text-emerald-700';
                  badgeBg = 'bg-emerald-50 border-emerald-200/80';
                } else if (item.pct >= 70) {
                  barColor = 'bg-amber-500';
                  textColor = 'text-amber-700';
                  badgeBg = 'bg-amber-50 border-amber-200/80';
                }

                return (
                  <div key={item.key} className="bg-white p-4.5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm font-bold text-[#13284D]">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.icon}</span>
                        <span>{item.title}</span>
                      </div>
                      <div className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold border ${badgeBg} ${textColor}`}>
                        {item.realizedText} de {item.goalText} ({item.pct}%)
                      </div>
                    </div>

                    <div className="relative w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`} 
                        style={{ width: `${Math.min(100, item.pct)}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-stone-500 italic text-center py-4">
              Nenhuma meta foi configurada para este mês.
            </p>
          )}

          {/* Rodapé conclusivo */}
          <div className="pt-2 flex items-center justify-between text-xs text-stone-500 border-t border-slate-200/70">
            <span className="flex items-center gap-1.5 font-medium text-stone-600">
              <Clock size={14} className="text-stone-400" />
              {goal?.locked_at 
                ? `Mês encerrado em ${dayjs(goal.locked_at).format('DD/MM/YYYY [às] HH:mm')}`
                : `Mês encerrado`
              }
            </span>
            <span className="font-semibold text-stone-400">Somente Leitura</span>
          </div>
        </div>
      )}

      {/* 2. ESTADO VAZIO (MÊS SEM METAS) */}
      {!hasGoals && !isMonthLocked ? (
        <div className="text-center py-20 px-6 bg-white rounded-[2rem] border border-black/[0.04] shadow-2xs max-w-2xl mx-auto my-4 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#13284D]/5 text-[#13284D] flex items-center justify-center mx-auto">
            <Target size={32} />
          </div>
          <div className="space-y-1">
            <p className="text-[#8A8F98] text-sm font-medium">
              Nenhuma meta definida para {nomeMes} de {ano}.
            </p>
            <p className="text-xs text-stone-400 max-w-md mx-auto">
              Defina as metas financeiras (MRR, Churn) e de entregas de conteúdo para alinhar o ritmo da agência.
            </p>
          </div>

          {copyFeedback && (
            <div className={`p-3.5 rounded-xl text-xs font-semibold max-w-md mx-auto ${
              copyFeedback.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {copyFeedback.message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {isCurrentMonth && (
              <button
                onClick={handleCopyPreviousGoals}
                disabled={isCopying}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-50"
                type="button"
              >
                <Sparkles size={18} />
                <span>{isCopying ? 'Copiando...' : 'Manter metas do mês passado'}</span>
              </button>
            )}

            <button 
              onClick={abrirFormulario}
              className="w-full sm:w-auto bg-[#13284D] text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-[#13284D]/90 transition-all shadow-sm active:scale-95 cursor-pointer inline-flex items-center justify-center gap-2"
              type="button"
            >
              <span>Definir metas do mês</span>
            </button>
          </div>
        </div>
      ) : (
        /* 3. DASHBOARD DE PROGRESSO - NOVA ESTRUTURA DE KPIS */
        <div className="space-y-8">
          
          {/* ============================================================ */}
          {/* BLOCO 1: FINANCEIRO (MRR, CHURN, SALDO LÍQUIDO) */}
          {/* ============================================================ */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-xs uppercase tracking-wider font-bold text-stone-500">
                  1. Financeiro & Receita Recorrente (MRR)
                </h3>
              </div>
            </div>

            {/* CARD PRINCIPAL — MRR / FATURAMENTO */}
            <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-black/[0.04] shadow-2xs space-y-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <DollarSign size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-[#13284D]">
                        Receita Recorrente (MRR)
                      </h3>
                      <span className="text-xs font-semibold text-stone-400">
                        • {nomeMes} de {ano}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400">Faturamento contratado no mês</p>
                  </div>
                </div>

                <div className="self-start sm:self-auto">
                  {pctFaturamento >= 100 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-bold">
                      <CheckCircle2 size={14} />
                      <span>Meta Batida ({pctFaturamento}%)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 text-stone-700 border border-stone-200/70 rounded-full text-xs font-bold">
                      <span>{pctFaturamento}% atingido</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Valores e Barra */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-3xl sm:text-4xl font-extrabold text-[#13284D] tracking-tight">
                      {formatCurrency(faturamentoRecebido)}
                    </span>
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-2">
                      realizado
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-stone-400 uppercase tracking-wider mr-2">
                      meta MRR
                    </span>
                    <span className="text-xl sm:text-2xl font-bold text-stone-700">
                      {formatCurrency(revenueGoal)}
                    </span>
                  </div>
                </div>

                <div className="relative w-full h-4 bg-stone-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, pctFaturamento)}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className={`h-full rounded-full transition-all ${
                      pctFaturamento >= 100 
                        ? 'bg-emerald-500' 
                        : pctFaturamento >= 70 
                          ? 'bg-emerald-600' 
                          : 'bg-[#13284D]'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-semibold text-stone-600">
                    {pctFaturamento >= 100 ? (
                      <span className="text-emerald-600 font-bold">
                        🎉 Meta superada em {formatCurrency(superouFaturamento)}!
                      </span>
                    ) : (
                      <span>Falta <strong className="text-[#13284D]">{formatCurrency(faltamFaturamento)}</strong> para a meta de MRR</span>
                    )}
                  </span>
                  <span className="font-bold text-stone-400">{pctFaturamento}%</span>
                </div>
              </div>

              {/* Sub-métricas: Ritmo Semanal */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 bg-stone-50/70 p-4 rounded-2xl border border-stone-200/60">
                <div className="space-y-0.5">
                  <p className="text-xs text-stone-500 font-medium">
                    Meta semanal: <strong className="text-[#13284D]">{formatCurrency(weeklyGoal)}/semana</strong>
                  </p>
                  <p className="text-xs text-stone-600 font-medium">
                    Esta semana: <strong className="text-[#13284D]">{formatCurrency(faturamentoEstaSemana)}</strong>{' '}
                    <span className="text-stone-400 font-normal">(semana {semanaAtual} de 4)</span>
                  </p>
                </div>

                <div>
                  {isPaceOnTrack ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-bold">
                      <CheckCircle2 size={15} />
                      <span>No ritmo</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-bold">
                      <AlertTriangle size={15} />
                      <span>Precisa acelerar</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* CARDS SECUNDÁRIOS FINANCEIROS: CHURN & SALDO LÍQUIDO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card Churn */}
              <div className="bg-white p-6 rounded-[2rem] border border-black/[0.04] shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <TrendingDown size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#13284D]">Churn Realizado</h4>
                      <p className="text-[11px] text-stone-400">Cancelamentos no mês</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    {churnRealizado === 0 ? 'Sem perdas' : `${pctChurn}% do teto`}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl sm:text-3xl font-extrabold text-[#13284D]">
                        {formatCurrency(churnRealizado)}
                      </span>
                    </div>
                    {churnGoal > 0 && (
                      <div className="text-right text-xs text-stone-500 font-semibold">
                        Teto máximo: <span className="text-stone-700">{formatCurrency(churnGoal)}</span>
                      </div>
                    )}
                  </div>

                  {churnGoal > 0 ? (
                    <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          churnRealizado > churnGoal ? 'bg-rose-500' : 'bg-emerald-500'
                        }`} 
                        style={{ width: `${Math.min(100, pctChurn)}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-400 font-medium pt-1">
                      Nenhum teto de churn configurado para este mês.
                    </p>
                  )}
                </div>
              </div>

              {/* Card Saldo Líquido */}
              <div className="bg-white p-6 rounded-[2rem] border border-black/[0.04] shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#13284D]">Saldo Líquido</h4>
                      <p className="text-[11px] text-stone-400">MRR Realizado - Churn</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                    Líquido
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                        {formatCurrency(saldoLiquido)}
                      </span>
                    </div>
                    <div className="text-right text-xs text-stone-500 font-medium">
                      Calculado automaticamente
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-500 font-medium pt-1">
                    Crescimento consolidado da receita após dedução de cancelamentos.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* BLOCO 2: ENTREGAS & PRODUÇÃO DE CONTEÚDO */}
          {/* ============================================================ */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <h3 className="text-xs uppercase tracking-wider font-bold text-stone-500">
                  2. Entregas & Produção de Conteúdo
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Card 1: Publicações dos Clientes */}
              <div className="bg-white p-6 rounded-[2rem] border border-black/[0.04] shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Smartphone size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#13284D]">Publicações Clientes</h4>
                      <p className="text-[11px] text-stone-400">Entregues para clientes</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-stone-400">{pctClientPosts}%</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#13284D]">
                      {clientPostsCount}
                    </span>
                    <span className="text-base font-bold text-stone-400">
                      / {clientPostsGoal || 0}
                    </span>
                    <span className="text-xs text-stone-400 ml-1 font-medium">publicadas</span>
                  </div>

                  <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, pctClientPosts)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Publicações Próprias da Agência */}
              <div className="bg-white p-6 rounded-[2rem] border border-black/[0.04] shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#13284D] truncate max-w-[140px]">
                        {nomeProprio}
                      </h4>
                      <p className="text-[11px] text-stone-400">Conteúdo institucional</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-stone-400">{pctOwnPosts}%</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#13284D]">
                      {ownPostsCount}
                    </span>
                    <span className="text-base font-bold text-stone-400">
                      / {ownPostsGoal || 0}
                    </span>
                    <span className="text-xs text-stone-400 ml-1 font-medium">publicadas</span>
                  </div>

                  <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-600 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, pctOwnPosts)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Posts no Blog */}
              <div className="bg-white p-6 rounded-[2rem] border border-black/[0.04] shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <PenLine size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#13284D]">Posts no Blog</h4>
                      <p className="text-[11px] text-stone-400">Artigos e SEO</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-stone-400">{pctBlogPosts}%</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#13284D]">
                      {blogPostsCount}
                    </span>
                    <span className="text-base font-bold text-stone-400">
                      / {blogPostsGoal || 0}
                    </span>
                    <span className="text-xs text-stone-400 ml-1 font-medium">artigos</span>
                  </div>

                  <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-600 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, pctBlogPosts)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* BLOCO 3: PROSPECÇÃO & COMERCIAL */}
          {/* ============================================================ */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h3 className="text-xs uppercase tracking-wider font-bold text-stone-500">
                  3. Prospecção & Comercial
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Card 1: Reuniões & Calls */}
              <div className="bg-white p-6 rounded-[2rem] border border-black/[0.04] shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <PhoneCall size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#13284D]">Reuniões & Calls</h4>
                      <p className="text-[11px] text-stone-400">Realizadas no mês</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-stone-400">{pctReunioes}%</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#13284D]">
                      {meetingsCount}
                    </span>
                    <span className="text-base font-bold text-stone-400">
                      / {meetingsGoal || 0}
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, pctReunioes)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Propostas Comerciais */}
              <div className="bg-white p-6 rounded-[2rem] border border-black/[0.04] shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Send size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#13284D]">Propostas Enviadas</h4>
                      <p className="text-[11px] text-stone-400">Ofertas comerciais</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-stone-400">{pctPropostas}%</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#13284D]">
                      {proposalsCount}
                    </span>
                    <span className="text-base font-bold text-stone-400">
                      / {proposalsGoal || 0}
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-600 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, pctPropostas)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* MENSAGEM DE COACHING / NOTAS DO MÊS */}
          {/* ============================================================ */}
          <div className="bg-gradient-to-r from-[#13284D] to-stone-900 text-white p-6 sm:p-7 rounded-[2rem] shadow-xs relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={20} className="text-amber-300" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-widest font-bold text-stone-300">
                  {goal?.notes ? 'Observações e Direcionamento Estratégico' : 'Direcionamento do Mês'}
                </p>
                <p className="text-sm sm:text-base font-medium leading-relaxed text-stone-100 italic">
                  "{goal?.notes || coachingMessage}"
                </p>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* SEÇÃO: AÇÕES COMERCIAIS DO MÊS */}
          {/* ============================================================ */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-black/[0.04] shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#13284D]/5 flex items-center justify-center text-[#13284D]">
                  <PhoneCall size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[#13284D]">
                      Ações Comerciais Registradas
                    </h3>
                    <span className="text-xs font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                      {commercialActions.length}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 font-medium">Reuniões, calls, propostas e follow-ups realizados no mês</p>
                </div>
              </div>

              {!isPastMonth && (
                <button
                  onClick={handleOpenActionModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200/80 text-[#13284D] rounded-xl text-xs font-bold transition-all self-start sm:self-auto cursor-pointer active:scale-95"
                  type="button"
                >
                  <Plus size={15} />
                  <span>Registrar Ação</span>
                </button>
              )}
            </div>

            {/* Lista de Ações Comerciais */}
            {commercialActions.length === 0 ? (
              <div className="py-12 px-6 rounded-3xl bg-stone-50/70 border border-dashed border-stone-200 text-center flex flex-col items-center justify-center space-y-3">
                <PhoneCall size={28} className="text-stone-300" />
                <div>
                  <p className="text-sm font-bold text-stone-700">Nenhuma ação comercial registrada para {nomeMes} de {ano}.</p>
                  <p className="text-xs text-stone-400 mt-0.5">Registre reuniões, propostas e contatos para somar no progresso do mês.</p>
                </div>
                {!isPastMonth && (
                  <button
                    onClick={handleOpenActionModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#13284D] text-white rounded-xl text-xs font-bold hover:bg-[#13284D]/90 transition-all cursor-pointer"
                    type="button"
                  >
                    <Plus size={14} />
                    <span>Registrar primeira ação</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {commercialActions.map((action) => {
                  const badge = getActionTypeBadge(action.action_type);
                  const formattedDate = dayjs(action.action_date).format('DD/MM');

                  return (
                    <div
                      key={action.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-stone-50/60 px-3 rounded-2xl transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        {/* Data */}
                        <div className="w-12 text-center shrink-0">
                          <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-lg">
                            {formattedDate}
                          </span>
                        </div>

                        {/* Tipo de Ação */}
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${badge.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                          {badge.label}
                        </span>

                        {/* Contato & Resultado */}
                        <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                          <span className="text-sm font-bold text-[#13284D] truncate">
                            {action.contact_name}
                          </span>
                          <span className="text-xs text-stone-500 truncate">
                            {action.result}
                          </span>
                        </div>
                      </div>

                      {/* Botão de Excluir */}
                      {!isPastMonth && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Excluir ação com "${action.contact_name}"?`)) {
                              deleteCommercialAction(action.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 self-end sm:self-center cursor-pointer"
                          title="Excluir ação"
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* 4. MODAL: DEFINIÇÃO / EDIÇÃO DE METAS (3 BLOCOS CONFORME SPEC) */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showGoalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-stone-200/70 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#13284D]/5 flex items-center justify-center text-[#13284D]">
                    <Target size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#13284D]">
                      {hasGoals ? 'Editar Metas do Mês' : 'Definir Metas do Mês'}
                    </h3>
                    <p className="text-xs text-[#8A8F98] font-medium">{nomeMes} de {ano}</p>
                  </div>
                </div>
                <button
                  onClick={fecharFormulario}
                  className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
                  type="button"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={salvar} className="flex flex-col gap-6 font-sans">
                
                {/* BLOCO 1 — FINANCEIRO */}
                <div className="bg-stone-50/70 p-5 rounded-2xl border border-stone-200/60 space-y-4">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-emerald-600" />
                    <h4 className="text-xs font-bold text-[#13284D] uppercase tracking-wider">
                      1. Metas Financeiras
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Meta MRR */}
                    <div>
                      <label className="block text-xs font-bold text-[#13284D] mb-1.5">
                        Meta de MRR (R$) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={form.revenue_goal}
                        onChange={(e) => setForm(f => ({ ...f, revenue_goal: e.target.value }))}
                        placeholder="Ex: 15000"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-sm font-semibold text-[#13284D]"
                      />
                      <p className="text-[10px] text-stone-400 mt-1">Faturamento total contratado</p>
                    </div>

                    {/* Meta Churn Máximo */}
                    <div>
                      <label className="block text-xs font-bold text-[#13284D] mb-1.5">
                        Churn Máximo Aceitável (R$)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={form.churn_goal}
                        onChange={(e) => setForm(f => ({ ...f, churn_goal: e.target.value }))}
                        placeholder="Ex: 1500"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-sm font-semibold text-[#13284D]"
                      />
                      <p className="text-[10px] text-stone-400 mt-1">Teto máximo de cancelamento</p>
                    </div>
                  </div>
                </div>

                {/* BLOCO 2 — ENTREGAS */}
                <div className="bg-stone-50/70 p-5 rounded-2xl border border-stone-200/60 space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-indigo-600" />
                    <h4 className="text-xs font-bold text-[#13284D] uppercase tracking-wider">
                      2. Metas de Entregas & Produção
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Publicações dos Clientes */}
                    <div>
                      <label className="block text-xs font-bold text-[#13284D] mb-1.5">
                        Posts Clientes
                      </label>
                      <input
                        type="number"
                        value={form.client_posts_goal}
                        onChange={(e) => setForm(f => ({ ...f, client_posts_goal: e.target.value }))}
                        placeholder="Ex: 40"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-sm font-semibold text-[#13284D]"
                      />
                      <p className="text-[10px] text-stone-400 mt-1">Entregas para clientes</p>
                    </div>

                    {/* Publicações Próprias */}
                    <div>
                      <label className="block text-xs font-bold text-[#13284D] mb-1.5">
                        Posts {isKanoa ? 'Kanoa' : 'Canguru'}
                      </label>
                      <input
                        type="number"
                        value={form.own_posts_goal}
                        onChange={(e) => setForm(f => ({ ...f, own_posts_goal: e.target.value }))}
                        placeholder="Ex: 12"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-sm font-semibold text-[#13284D]"
                      />
                      <p className="text-[10px] text-stone-400 mt-1">Conteúdo institucional</p>
                    </div>

                    {/* Posts no Blog */}
                    <div>
                      <label className="block text-xs font-bold text-[#13284D] mb-1.5">
                        Posts no Blog
                      </label>
                      <input
                        type="number"
                        value={form.blog_posts_goal}
                        onChange={(e) => setForm(f => ({ ...f, blog_posts_goal: e.target.value }))}
                        placeholder="Ex: 8"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-sm font-semibold text-[#13284D]"
                      />
                      <p className="text-[10px] text-stone-400 mt-1">Artigos publicados</p>
                    </div>
                  </div>
                </div>

                {/* BLOCO 3 — PROSPECÇÃO & COMERCIAL (COLAPSÁVEL) */}
                <div className="bg-stone-50/70 rounded-2xl border border-stone-200/60 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsProspeccaoAccordionOpen(!isProspeccaoAccordionOpen)}
                    className="w-full p-4 flex items-center justify-between hover:bg-stone-100/60 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <PhoneCall size={16} className="text-blue-600" />
                      <span className="text-xs font-bold text-[#13284D] uppercase tracking-wider">
                        3. Metas de Prospecção & Comercial (Opcional)
                      </span>
                    </div>
                    <div className="text-stone-400">
                      {isProspeccaoAccordionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isProspeccaoAccordionOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-5 pb-5 pt-1 space-y-4 border-t border-stone-200/50"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-[#13284D] mb-1.5">
                              Meta de Reuniões & Calls
                            </label>
                            <input
                              type="number"
                              value={form.meetings_goal}
                              onChange={(e) => setForm(f => ({ ...f, meetings_goal: e.target.value }))}
                              placeholder="Ex: 8"
                              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-sm font-semibold text-[#13284D]"
                            />
                            <p className="text-[10px] text-stone-400 mt-1">Reuniões com leads</p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-[#13284D] mb-1.5">
                              Meta de Propostas Enviadas
                            </label>
                            <input
                              type="number"
                              value={form.proposals_goal}
                              onChange={(e) => setForm(f => ({ ...f, proposals_goal: e.target.value }))}
                              placeholder="Ex: 5"
                              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-sm font-semibold text-[#13284D]"
                            />
                            <p className="text-[10px] text-stone-400 mt-1">Propostas enviadas</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* NOTAS LIVRES DO MÊS */}
                <div>
                  <label className="block text-xs font-bold text-[#13284D] mb-1.5">
                    Observações Estratégicas do Mês (Opcional)
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Foco prioritário, estratégia de upsell, parcerias, contexto..."
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-sm text-[#13284D] resize-vertical"
                  />
                </div>

                {/* BOTÕES DE AÇÃO */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                  <button 
                    type="button"
                    onClick={fecharFormulario}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={salvando}
                    className="px-6 py-2.5 rounded-xl bg-[#13284D] text-white text-xs font-bold hover:bg-[#13284D]/90 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {salvando ? 'Salvando...' : 'Salvar metas'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* 5. MODAL: REGISTRAR AÇÃO COMERCIAL */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showActionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-stone-200/70 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#13284D]/5 flex items-center justify-center text-[#13284D]">
                    <PhoneCall size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#13284D]">
                      Registrar Ação Comercial
                    </h3>
                    <p className="text-xs text-stone-500 font-medium">Reunião, Call, Proposta ou Follow-up</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowActionModal(false)}
                  className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
                  type="button"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveAction} className="space-y-4 font-sans">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#13284D] mb-1">
                      Data da Ação
                    </label>
                    <input
                      type="date"
                      value={actionDate}
                      onChange={(e) => setActionDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-xs font-semibold text-[#13284D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#13284D] mb-1">
                      Tipo de Ação
                    </label>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value as CommercialActionType)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-xs font-semibold text-[#13284D]"
                    >
                      <option value="meeting">Reunião</option>
                      <option value="call">Call</option>
                      <option value="proposal">Proposta</option>
                      <option value="follow_up">Follow-up</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#13284D] mb-1">
                    Nome do Contato / Empresa
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Dra. Ana Paula (Clínica Santa Maria)"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-xs font-semibold text-[#13284D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#13284D] mb-1">
                    Resultado / Status
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Proposta de R$ 3.500 enviada, retorno na sexta"
                    value={actionResult}
                    onChange={(e) => setActionResult(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-xs font-semibold text-[#13284D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#13284D] mb-1">
                    Observações (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Anotações sobre a negociação..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#13284D] text-xs text-[#13284D]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setShowActionModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAction}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#13284D] text-white hover:bg-[#13284D]/90 transition-all shadow-xs disabled:opacity-50"
                  >
                    {isSavingAction ? 'Salvando...' : 'Salvar Ação'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal de Confirmação: Fechar Mês */}
        {showLockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Lock size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#13284D]">Fechar {nomeMes}?</h3>
                  <p className="text-xs text-stone-500 font-medium">Bloqueio de edições para o mês atual</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/70 text-amber-900 text-xs leading-relaxed space-y-1">
                <p className="font-bold">Tem certeza?</p>
                <p>Após fechar, o mês não poderá mais ser editado nem ter novas ações comerciais registradas.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLockModal(false)}
                  disabled={isLocking}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLock}
                  disabled={isLocking}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLocking ? (
                    <span>Fechando...</span>
                  ) : (
                    <>
                      <Lock size={14} />
                      <span>Sim, Fechar Mês</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

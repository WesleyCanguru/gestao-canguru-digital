import React, { useState } from 'react';
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
  MessageSquare,
  FileCheck,
  PenLine
} from 'lucide-react';
import { useAgencyGoals } from '../../hooks/useAgencyGoals';
import { CommercialActionType } from '../../types';
import dayjs from 'dayjs';

interface MetasTabProps {
  onBack?: () => void;
}

export const MetasTab: React.FC<MetasTabProps> = () => {
  const {
    monthYear,
    monthLabel,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth,
    loading,
    goal,
    hasGoalConfigured,

    faturamentoRecebido,
    faturamentoEstaSemana,
    newClientsCount,
    meetingsCount,
    postsCount,
    blogPostsCount,
    blogPostsGoal,

    commercialActions,

    pctFaturamento,
    pctNovosClientes,
    pctReunioes,
    pctPublicacoes,
    pctBlogPosts,

    weeklyGoal,
    semanaAtual,
    isPaceOnTrack,
    faltamFaturamento,
    superouFaturamento,

    coachingMessage,

    nextMonth,
    prevMonth,
    goToCurrentMonth,
    saveGoal,
    addCommercialAction,
    deleteCommercialAction
  } = useAgencyGoals();

  // Modals state
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);

  // Form states for Goal
  const [revenueGoalInput, setRevenueGoalInput] = useState<string>('');
  const [newClientsGoalInput, setNewClientsGoalInput] = useState<string>('');
  const [meetingsGoalInput, setMeetingsGoalInput] = useState<string>('');
  const [postsGoalInput, setPostsGoalInput] = useState<string>('');
  const [blogPostsGoalInput, setBlogPostsGoalInput] = useState<string>('');
  const [goalNotesInput, setGoalNotesInput] = useState<string>('');
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  // Form states for Action
  const [actionDate, setActionDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [actionType, setActionType] = useState<CommercialActionType>('meeting');
  const [contactName, setContactName] = useState<string>('');
  const [actionResult, setActionResult] = useState<string>('');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [isSavingAction, setIsSavingAction] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleOpenGoalModal = () => {
    setRevenueGoalInput(goal?.revenue_goal ? String(goal.revenue_goal) : '');
    setNewClientsGoalInput(goal?.new_clients_goal ? String(goal.new_clients_goal) : '');
    setMeetingsGoalInput(goal?.meetings_goal ? String(goal.meetings_goal) : '');
    setPostsGoalInput(goal?.posts_goal ? String(goal.posts_goal) : '');
    setBlogPostsGoalInput(goal?.blog_posts_goal ? String(goal.blog_posts_goal) : '');
    setGoalNotesInput(goal?.notes || '');
    setShowGoalModal(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingGoal(true);
      await saveGoal({
        revenue_goal: parseFloat(revenueGoalInput.replace(/\./g, '').replace(',', '.')) || 0,
        new_clients_goal: parseInt(newClientsGoalInput, 10) || 0,
        meetings_goal: parseInt(meetingsGoalInput, 10) || 0,
        posts_goal: parseInt(postsGoalInput, 10) || 0,
        blog_posts_goal: parseInt(blogPostsGoalInput, 10) || 0,
        notes: goalNotesInput
      });
      setShowGoalModal(false);
    } catch (err) {
      console.error('Erro ao salvar meta:', err);
    } finally {
      setIsSavingGoal(false);
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
        <div className="h-20 bg-white rounded-3xl" />
        <div className="h-64 bg-white rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-36 bg-white rounded-3xl" />
          <div className="h-36 bg-white rounded-3xl" />
          <div className="h-36 bg-white rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* 3a. CABEÇALHO + SELETOR DE MÊS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-b border-black/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-dark/5 flex items-center justify-center text-brand-dark">
              <Target size={22} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-dark">
                Metas
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 font-medium">
                Acompanhamento comercial da Canguru Digital
              </p>
            </div>
          </div>
        </div>

        {/* CONTROLES DE NAVEGAÇÃO E CONFIGURAÇÃO */}
        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          {/* Seletor de Mês */}
          <div className="inline-flex items-center bg-white border border-stone-200/80 rounded-2xl p-1 shadow-2xs">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-stone-100 rounded-xl text-stone-600 hover:text-brand-dark transition-colors cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-3 py-1 text-xs sm:text-sm font-bold text-brand-dark min-w-[130px] text-center capitalize">
              {monthLabel}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-stone-100 rounded-xl text-stone-600 hover:text-brand-dark transition-colors cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              onClick={goToCurrentMonth}
              className="px-3 py-2 text-xs font-bold bg-white text-stone-600 hover:text-brand-dark border border-stone-200/80 rounded-2xl hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
            >
              Mês Atual
            </button>
          )}

          {/* Botão Configurar Metas */}
          <button
            onClick={handleOpenGoalModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-dark text-white rounded-2xl text-xs sm:text-sm font-bold hover:bg-brand-dark/90 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Edit3 size={15} />
            <span>{hasGoalConfigured ? 'Editar Metas' : 'Configurar Metas'}</span>
          </button>
        </div>
      </div>

      {/* AVISO DE MÊS PASSADO (HISTÓRICO) */}
      {isPastMonth && (
        <div className="bg-stone-100/80 border border-stone-200/80 rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-stone-500" />
            <span className="font-bold text-stone-800">{monthLabel} — Mês Encerrado</span>
            <span className="text-stone-400 hidden sm:inline">• Visualização em modo histórico consolidado</span>
          </div>
          <span className="font-semibold text-[11px] bg-stone-200/70 text-stone-700 px-2.5 py-0.5 rounded-full">
            Histórico
          </span>
        </div>
      )}

      {/* CASO NÃO HAJA METAS CONFIGURADAS */}
      {!hasGoalConfigured ? (
        <div className="bg-white rounded-[2.5rem] border border-black/[0.04] p-10 sm:p-16 text-center space-y-6 shadow-2xs max-w-3xl mx-auto my-6">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
            <Target size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-brand-dark">
              Nenhuma meta definida para {monthLabel}
            </h2>
            <p className="text-sm text-stone-500 max-w-md mx-auto leading-relaxed">
              Defina as metas de faturamento, novos clientes, reuniões e publicações para engajar o ritmo comercial da agência.
            </p>
          </div>
          <button
            onClick={handleOpenGoalModal}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-brand-dark text-white rounded-2xl text-sm font-bold hover:bg-brand-dark/90 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Sparkles size={18} />
            <span>Configurar metas deste mês</span>
          </button>
        </div>
      ) : (
        /* 3c. DASHBOARD DE METAS */
        <div className="space-y-8">
          
          {/* CARD PRINCIPAL — FATURAMENTO */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-black/[0.04] shadow-2xs space-y-6 relative overflow-hidden">
            {/* Header do Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-brand-dark">
                      Faturamento
                    </h3>
                    <span className="text-xs font-semibold text-stone-400">
                      • {monthLabel}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400">Faturamento já recebido neste período</p>
                </div>
              </div>

              {/* Status Badge */}
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

            {/* Linha de valores e Barra de Progresso */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-3xl sm:text-4xl font-extrabold text-brand-dark tracking-tight">
                    {formatCurrency(faturamentoRecebido)}
                  </span>
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-2">
                    recebido
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-stone-400 uppercase tracking-wider mr-2">
                    meta
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-stone-700">
                    {formatCurrency(goal?.revenue_goal || 0)}
                  </span>
                </div>
              </div>

              {/* Barra de Progresso */}
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
                        : 'bg-brand-dark'
                  }`}
                />
              </div>

              {/* Texto de Falta / Superação */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-semibold text-stone-600">
                  {pctFaturamento >= 100 ? (
                    <span className="text-emerald-600 font-bold">
                      🎉 Meta superada em {formatCurrency(superouFaturamento)}!
                    </span>
                  ) : (
                    <span>Falta <strong className="text-brand-dark">{formatCurrency(faltamFaturamento)}</strong> para a meta</span>
                  )}
                </span>
                <span className="font-bold text-stone-400">{pctFaturamento}%</span>
              </div>
            </div>

            {/* Divisor */}
            <div className="h-px bg-stone-100" />

            {/* Meta Semanal e Ritmo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 bg-stone-50/70 p-4 rounded-2xl border border-stone-200/60">
              <div className="space-y-0.5">
                <p className="text-xs text-stone-500 font-medium">
                  Meta semanal: <strong className="text-brand-dark">{formatCurrency(weeklyGoal)}/semana</strong>
                </p>
                <p className="text-xs text-stone-600 font-medium">
                  Esta semana: <strong className="text-brand-dark">{formatCurrency(faturamentoEstaSemana)}</strong>{' '}
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

          {/* CARDS SECUNDÁRIOS */}
          <div className={`grid grid-cols-1 ${blogPostsGoal > 0 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'} gap-6`}>
            {/* Card 1: Novos Clientes */}
            <div className="bg-white p-6 rounded-[2rem] border border-black/[0.04] shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Users size={18} />
                  </div>
                  <h4 className="text-sm font-bold text-brand-dark">Novos Clientes</h4>
                </div>
                <span className="text-xs font-bold text-stone-400">{pctNovosClientes}%</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-brand-dark">
                    {newClientsCount}
                  </span>
                  <span className="text-base font-bold text-stone-400">
                    / {goal?.new_clients_goal || 0}
                  </span>
                </div>

                <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-600 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, pctNovosClientes)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Reuniões / Calls */}
            <div className="bg-white p-6 rounded-[2rem] border border-black/[0.04] shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <PhoneCall size={18} />
                  </div>
                  <h4 className="text-sm font-bold text-brand-dark">Reuniões & Calls</h4>
                </div>
                <span className="text-xs font-bold text-stone-400">{pctReunioes}%</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-brand-dark">
                    {meetingsCount}
                  </span>
                  <span className="text-base font-bold text-stone-400">
                    / {goal?.meetings_goal || 0}
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

            {/* Card 3: Publicações */}
            <div className="bg-white p-6 rounded-[2rem] border border-black/[0.04] shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Smartphone size={18} />
                  </div>
                  <h4 className="text-sm font-bold text-brand-dark">Publicações</h4>
                </div>
                <span className="text-xs font-bold text-stone-400">{pctPublicacoes}%</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-brand-dark">
                    {postsCount}
                  </span>
                  <span className="text-base font-bold text-stone-400">
                    / {goal?.posts_goal || 0}
                  </span>
                </div>

                <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, pctPublicacoes)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 4: Posts no Blog (condicional se blogPostsGoal > 0) */}
            {blogPostsGoal > 0 && (
              <div className="bg-white p-6 rounded-[2rem] border border-black/[0.04] shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <PenLine size={18} />
                    </div>
                    <h4 className="text-sm font-bold text-brand-dark">Posts no Blog</h4>
                  </div>
                  <span className="text-xs font-bold text-stone-400">{pctBlogPosts}%</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-brand-dark">
                      {blogPostsCount}
                    </span>
                    <span className="text-base font-bold text-stone-400">
                      / {blogPostsGoal}
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-600 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, pctBlogPosts)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MENSAGEM DE COACHING (DINÂMICA) */}
          <div className="bg-gradient-to-r from-brand-dark to-stone-900 text-white p-6 sm:p-7 rounded-[2rem] shadow-xs relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={20} className="text-amber-300" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-widest font-bold text-stone-300">
                  Direcionamento do Mês
                </p>
                <p className="text-sm sm:text-base font-medium leading-relaxed text-stone-100 italic">
                  "{coachingMessage}"
                </p>
              </div>
            </div>
          </div>

          {/* SEÇÃO: AÇÕES COMERCIAIS DO MÊS */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-black/[0.04] shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-dark/5 flex items-center justify-center text-brand-dark">
                  <PhoneCall size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-brand-dark">
                      Ações Comerciais
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200/80 text-brand-dark rounded-xl text-xs font-bold transition-all self-start sm:self-auto cursor-pointer active:scale-95"
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
                  <p className="text-sm font-bold text-stone-700">Nenhuma ação comercial registrada para {monthLabel}.</p>
                  <p className="text-xs text-stone-400 mt-0.5">Registre reuniões, propostas e contatos para somar no progresso do mês.</p>
                </div>
                {!isPastMonth && (
                  <button
                    onClick={handleOpenActionModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-dark text-white rounded-xl text-xs font-bold hover:bg-brand-dark/90 transition-all cursor-pointer"
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
                          <span className="text-sm font-bold text-brand-dark truncate">
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

      {/* MODAL "CONFIGURAR METAS DO MÊS" */}
      <AnimatePresence>
        {showGoalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-stone-200/70 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-dark/5 flex items-center justify-center text-brand-dark">
                    <Target size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-brand-dark">
                      Configurar Metas
                    </h3>
                    <p className="text-xs text-stone-500 font-medium">{monthLabel}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGoalModal(false)}
                  className="text-stone-400 hover:text-stone-700 p-1 rounded-xl hover:bg-stone-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveGoal} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Meta de Faturamento (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 10000.00"
                    value={revenueGoalInput}
                    onChange={(e) => setRevenueGoalInput(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark text-sm font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Novos Clientes
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 2"
                      value={newClientsGoalInput}
                      onChange={(e) => setNewClientsGoalInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Reuniões / Calls
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 12"
                      value={meetingsGoalInput}
                      onChange={(e) => setMeetingsGoalInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark text-sm font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Meta de Publicações no Mês
                  </label>
                  <input
                    type="number"
                    placeholder="Ex: 60"
                    value={postsGoalInput}
                    onChange={(e) => setPostsGoalInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark text-sm font-semibold"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">Total de publicações planejadas/publicadas no mês</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Meta de Posts no Blog (por mês)
                  </label>
                  <input
                    type="number"
                    placeholder="Ex: 9"
                    value={blogPostsGoalInput}
                    onChange={(e) => setBlogPostsGoalInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark text-sm font-semibold"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">Total de artigos/posts publicados no blog da agência</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Observações / Foco Estratégico (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Foco no fechamento de 2 clientes do nicho médico..."
                    value={goalNotesInput}
                    onChange={(e) => setGoalNotesInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setShowGoalModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingGoal}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-dark text-white hover:bg-brand-dark/90 transition-all shadow-xs disabled:opacity-50"
                  >
                    {isSavingGoal ? 'Salvando...' : 'Salvar Metas'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL "REGISTRAR AÇÃO COMERCIAL" */}
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
                  <div className="w-10 h-10 rounded-2xl bg-brand-dark/5 flex items-center justify-center text-brand-dark">
                    <PhoneCall size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-brand-dark">
                      Registrar Ação Comercial
                    </h3>
                    <p className="text-xs text-stone-500 font-medium">Reunião, Call, Proposta ou Follow-up</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowActionModal(false)}
                  className="text-stone-400 hover:text-stone-700 p-1 rounded-xl hover:bg-stone-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveAction} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Data da Ação
                    </label>
                    <input
                      type="date"
                      value={actionDate}
                      onChange={(e) => setActionDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Tipo
                    </label>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value as CommercialActionType)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark text-xs font-semibold"
                    >
                      <option value="meeting">Reunião</option>
                      <option value="call">Call</option>
                      <option value="proposal">Proposta</option>
                      <option value="follow_up">Follow-up</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Nome do Contato / Lead
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Léo (Trabalhista) ou Dra. Juliana"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Resultado / Status
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Proposta enviada / Aguardando retorno / Fechado"
                    value={actionResult}
                    onChange={(e) => setActionResult(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Observações Adicionais (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Detalhes sobre a conversa..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark text-xs"
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
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-dark text-white hover:bg-brand-dark/90 transition-all shadow-xs disabled:opacity-50"
                  >
                    {isSavingAction ? 'Registrando...' : 'Registrar Ação'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

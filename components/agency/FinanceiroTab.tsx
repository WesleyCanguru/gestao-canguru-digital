
import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  Save,
  Edit2,
  X,
  Lock,
  Zap,
  Briefcase,
  BarChart3,
  CalendarDays,
  Check,
  Building2,
  User,
  Layers,
  Repeat,
  LayoutDashboard,
  Receipt,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Percent,
  CheckCheck,
  Eye,
  EyeOff,
  FileText,
  PieChart as PieChartIcon,
  ShieldCheck,
  Scale
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { useAgencyFinanceiro } from '../../hooks/useAgencyFinanceiro';
import dayjs from 'dayjs';

export const FinanceiroTab: React.FC = () => {
  const [currentMonthYear, setCurrentMonthYear] = useState(dayjs().format('YYYY-MM'));
  const [hideValues, setHideValues] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('agency_finance_hide_values') === 'true';
    }
    return false;
  });

  const { 
    billings, 
    expenses, 
    ticketMedio, 
    faturamentoAcumulado, 
    history,
    loading, 
    updateBilling, 
    deleteBilling, 
    addExpense, 
    updateExpense,
    overrideExpenseForMonth,
    updateMotherExpenseAllMonths,
    deleteExpenseForMonth,
    deleteExpenseFromMonthOnwards,
    deleteExpensePermanently
  } = useAgencyFinanceiro(currentMonthYear);

  const toggleHideValues = () => {
    setHideValues(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('agency_finance_hide_values', String(next));
      }
      return next;
    });
  };

  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthFullNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const labelPeriodo = `Jan–${monthNames[dayjs().month()]} de ${dayjs().year()}`;
  const currentMonthFormatted = `${monthFullNames[dayjs(currentMonthYear).month()]} de ${dayjs(currentMonthYear).year()}`;
  
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'faturamento' | 'despesas'>('overview');
  const [expenseFilterOrigin, setExpenseFilterOrigin] = useState<'all' | 'canguru' | 'kanoa' | 'pessoal'>('all');
  const [expenseFilterStatus, setExpenseFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSporadicModal, setShowSporadicModal] = useState(false);
  const [deletingSporadicBilling, setDeletingSporadicBilling] = useState<any>(null);
  const [editingBilling, setEditingBilling] = useState<any>(null);
  const [newSporadicBilling, setNewSporadicBilling] = useState({
    sporadic_name: '',
    base_value: 0,
    due_day: 10,
    notes: ''
  });
  const [newExpense, setNewExpense] = useState({ 
    description: '', 
    category: 'fixed' as 'fixed' | 'variable', 
    expense_type: 'tools' as 'tools' | 'freelancers' | 'extras',
    origin: 'canguru' as 'canguru' | 'kanoa' | 'pessoal',
    amount: 0,
    due_day: 10,
    notes: ''
  });
  const [payingExpense, setPayingExpense] = useState<any>(null);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [deletingExpense, setDeletingExpense] = useState<any>(null);
  const [pendingEditExpense, setPendingEditExpense] = useState<any>(null);
  const [showEditScopeModal, setShowEditScopeModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const stats = useMemo(() => {
    const totalToReceive = billings.reduce((acc, b) => acc + (b.base_value + b.extra_value), 0);
    const totalReceived = billings.filter(b => b.status === 'paid').reduce((acc, b) => acc + (b.base_value + b.extra_value), 0);
    const totalOpen = totalToReceive - totalReceived;
    
    const totalFixedExpenses = expenses.filter(e => e.category === 'fixed').reduce((acc, e) => acc + e.amount, 0);
    const totalVariableExpenses = expenses.filter(e => e.category === 'variable').reduce((acc, e) => acc + e.amount, 0);
    const totalExpenses = totalFixedExpenses + totalVariableExpenses;
    
    const totalExpensesPaid = expenses.filter(e => e.paid).reduce((acc, e) => acc + e.amount, 0);
    const totalExpensesPending = totalExpenses - totalExpensesPaid;

    // Lucro Projetado / Estimado (Faturamento Total Previsto - Total de Despesas Previstas)
    const lucroProjetado = totalToReceive - totalExpenses;

    // Lucro Realizado / Caixa do Mês (Total Efetivamente Recebido - Despesas Efetivamente Pagas)
    const lucroRealizado = totalReceived - totalExpensesPaid;

    // Margens (%)
    const margemProjetada = totalToReceive > 0 ? (lucroProjetado / totalToReceive) * 100 : 0;
    const margemRealizada = totalReceived > 0 ? (lucroRealizado / totalReceived) * 100 : 0;

    const taxaRecebimento = totalToReceive > 0 ? (totalReceived / totalToReceive) * 100 : 0;
    const taxaDespesasPagas = totalExpenses > 0 ? (totalExpensesPaid / totalExpenses) * 100 : 0;
    
    const result = totalReceived - totalExpenses;

    return { 
      totalToReceive, 
      totalReceived, 
      totalOpen, 
      totalExpenses, 
      totalFixedExpenses, 
      totalVariableExpenses, 
      totalExpensesPaid,
      totalExpensesPending,
      lucroProjetado,
      lucroRealizado,
      margemProjetada,
      margemRealizada,
      taxaRecebimento,
      taxaDespesasPagas,
      result 
    };
  }, [billings, expenses]);

  const sortedBillings = useMemo(() => {
    return [...billings].sort((a, b) => (a.due_day || 0) - (b.due_day || 0));
  }, [billings]);

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => {
      const dayA = a.due_date ? dayjs(a.due_date).date() : (a.due_day || 99);
      const dayB = b.due_date ? dayjs(b.due_date).date() : (b.due_day || 99);
      return dayA - dayB;
    });
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return sortedExpenses.filter(e => {
      if (expenseFilterOrigin !== 'all' && (e.origin || 'canguru') !== expenseFilterOrigin) {
        return false;
      }
      if (expenseFilterStatus === 'paid' && !e.paid) return false;
      if (expenseFilterStatus === 'pending' && e.paid) return false;
      return true;
    });
  }, [sortedExpenses, expenseFilterOrigin, expenseFilterStatus]);

  // Alertas e Agenda Imediata (Estilo refinado e discreto)
  const alertsAndAgenda = useMemo(() => {
    const today = dayjs();
    const currentMonth = dayjs(currentMonthYear);

    // Contas em atraso
    const lateExpenses = sortedExpenses.filter(e => {
      if (e.paid) return false;
      const dayNum = e.due_day || (e.due_date ? dayjs(e.due_date).date() : null);
      if (!dayNum) return false;
      const dueDate = currentMonth.date(dayNum);
      return today.isAfter(dueDate, 'day');
    });

    // Contas vencendo nos próximos 7 dias
    const upcomingExpenses = sortedExpenses.filter(e => {
      if (e.paid) return false;
      const dayNum = e.due_day || (e.due_date ? dayjs(e.due_date).date() : null);
      if (!dayNum) return false;
      const dueDate = currentMonth.date(dayNum);
      const diff = dueDate.diff(today, 'day');
      return diff >= 0 && diff <= 7;
    });

    // Faturamentos em aberto
    const pendingBillings = sortedBillings.filter(b => b.status !== 'paid');

    return {
      lateExpenses,
      upcomingExpenses,
      pendingBillings
    };
  }, [sortedExpenses, sortedBillings, currentMonthYear]);

  const handlePrevMonth = () => setCurrentMonthYear(dayjs(currentMonthYear).subtract(1, 'month').format('YYYY-MM'));
  const handleNextMonth = () => setCurrentMonthYear(dayjs(currentMonthYear).add(1, 'month').format('YYYY-MM'));

  const formatCurrency = (value: number) => {
    if (hideValues) return 'R$ ••••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const sporadicTotal = useMemo(() => {
    return billings.filter(b => b.is_sporadic).reduce((acc, b) => acc + (b.base_value + b.extra_value), 0);
  }, [billings]);

  const recurringTotal = useMemo(() => {
    return stats.totalToReceive - sporadicTotal;
  }, [stats.totalToReceive, sporadicTotal]);

  const expenseBreakdown = useMemo(() => {
    const tools = expenses.filter(e => e.expense_type === 'tools').reduce((sum, e) => sum + e.amount, 0);
    const freelancers = expenses.filter(e => e.expense_type === 'freelancers').reduce((sum, e) => sum + e.amount, 0);
    const extras = expenses.filter(e => e.expense_type === 'extras' || !e.expense_type).reduce((sum, e) => sum + e.amount, 0);

    const canguru = expenses.filter(e => (e.origin || 'canguru') === 'canguru').reduce((sum, e) => sum + e.amount, 0);
    const kanoa = expenses.filter(e => e.origin === 'kanoa').reduce((sum, e) => sum + e.amount, 0);
    const pessoal = expenses.filter(e => e.origin === 'pessoal').reduce((sum, e) => sum + e.amount, 0);

    const total = stats.totalExpenses || 1;

    return {
      byType: [
        { name: 'Ferramentas & SaaS', value: tools, percent: (tools / total) * 100, color: '#3B82F6' },
        { name: 'Freelancers & Equipe', value: freelancers, percent: (freelancers / total) * 100, color: '#8B5CF6' },
        { name: 'Custos Extras & Op.', value: extras, percent: (extras / total) * 100, color: '#F59E0B' }
      ].filter(item => item.value > 0),
      byOrigin: [
        { name: 'Canguru Digital', value: canguru, percent: (canguru / total) * 100, color: '#10B981' },
        { name: 'Kanoa', value: kanoa, percent: (kanoa / total) * 100, color: '#6366F1' },
        { name: 'Pessoal', value: pessoal, percent: (pessoal / total) * 100, color: '#EC4899' }
      ].filter(item => item.value > 0)
    };
  }, [expenses, stats.totalExpenses]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let due_date = null;
    if (newExpense.category === 'fixed') {
      due_date = dayjs(currentMonthYear).date(newExpense.due_day || 10).format('YYYY-MM-DD');
    }

    await addExpense({ 
      description: newExpense.description,
      category: newExpense.category,
      expense_type: newExpense.expense_type,
      origin: newExpense.origin,
      amount: newExpense.amount,
      month_year: currentMonthYear,
      due_date,
      due_day: newExpense.due_day,
      paid: false,
      paid_at: null,
      notes: newExpense.notes,
      agency_id: 0 // Will be handled by hook
    });
    
    setShowExpenseModal(false);
    setNewExpense({ description: '', category: 'fixed', expense_type: 'tools', origin: 'canguru', amount: 0, due_day: 10, notes: '' });
  };

  const handleMarkExpensePaid = async (expense: any, paidAt?: string) => {
    const isFixed = expense.is_fixed || expense.category === 'fixed';
    if (expense.category === 'variable' && !paidAt && !expense.parent_id) {
      setPayingExpense(expense);
      return;
    }

    const dateToSet = paidAt || new Date().toISOString();

    if (isFixed && !expense.parent_id) {
      await overrideExpenseForMonth(
        expense,
        {
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          expense_type: expense.expense_type,
          origin: expense.origin,
          due_date: expense.due_date,
          due_day: expense.due_day,
          notes: expense.notes,
          paid: true,
          paid_at: dateToSet
        },
        currentMonthYear
      );
    } else {
      await updateExpense(expense.id, {
        paid: true,
        paid_at: dateToSet
      });
    }
    setPayingExpense(null);
  };

  const handleAddSporadicBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBilling({
      is_sporadic: true,
      sporadic_name: newSporadicBilling.sporadic_name,
      base_value: newSporadicBilling.base_value,
      extra_value: 0,
      total_value: newSporadicBilling.base_value,
      due_day: newSporadicBilling.due_day,
      notes: newSporadicBilling.notes,
      month_year: currentMonthYear,
      status: 'pending'
    });
    setShowSporadicModal(false);
    setNewSporadicBilling({ sporadic_name: '', base_value: 0, due_day: 10, notes: '' });
  };

  const handleUpdateBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBilling && !isUpdating) {
      setIsUpdating(true);
      try {
        await updateBilling(editingBilling);
        setEditingBilling(null);
      } catch (error) {
        console.error('Failed to update billing:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const startEditingExpense = (expense: any) => {
    const dueDay = expense.due_day || (expense.due_date ? dayjs(expense.due_date).date() : 10);
    setEditingExpense({
      ...expense,
      due_day: dueDay,
      origin: expense.origin || 'canguru'
    });
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || isUpdating) return;

    const isFixed = editingExpense.is_fixed || editingExpense.category === 'fixed' || Boolean(editingExpense.parent_id);

    let due_date = editingExpense.due_date;
    if (editingExpense.category === 'fixed' && editingExpense.due_day) {
      due_date = dayjs(currentMonthYear).date(editingExpense.due_day).format('YYYY-MM-DD');
    } else if (editingExpense.category === 'variable') {
      due_date = null;
    }

    const payload = {
      description: editingExpense.description,
      category: editingExpense.category,
      expense_type: editingExpense.expense_type,
      origin: editingExpense.origin,
      amount: editingExpense.amount,
      due_date,
      due_day: editingExpense.due_day,
      notes: editingExpense.notes,
      paid: editingExpense.paid,
      paid_at: editingExpense.paid ? (editingExpense.paid_at || new Date().toISOString()) : null
    };

    if (isFixed) {
      setPendingEditExpense({ original: editingExpense, payload });
      setShowEditScopeModal(true);
    } else {
      setIsUpdating(true);
      try {
        await updateExpense(editingExpense.id, payload);
        setEditingExpense(null);
      } catch (error) {
        console.error('Failed to update expense:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const confirmEditOnlyThisMonth = async () => {
    if (!pendingEditExpense || isUpdating) return;
    setIsUpdating(true);
    try {
      await overrideExpenseForMonth(pendingEditExpense.original, pendingEditExpense.payload, currentMonthYear);
      setShowEditScopeModal(false);
      setPendingEditExpense(null);
      setEditingExpense(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmEditAllMonths = async () => {
    if (!pendingEditExpense || isUpdating) return;
    setIsUpdating(true);
    try {
      await updateMotherExpenseAllMonths(pendingEditExpense.original, pendingEditExpense.payload);
      setShowEditScopeModal(false);
      setPendingEditExpense(null);
      setEditingExpense(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDeleteOnlyThisMonth = async () => {
    if (!deletingExpense || isUpdating) return;
    setIsUpdating(true);
    try {
      await deleteExpenseForMonth(deletingExpense, currentMonthYear);
      setDeletingExpense(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDeleteFromMonthOnwards = async () => {
    if (!deletingExpense || isUpdating) return;
    setIsUpdating(true);
    try {
      await deleteExpenseFromMonthOnwards(deletingExpense, currentMonthYear);
      setDeletingExpense(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDeleteAllMonths = async () => {
    if (!deletingExpense || isUpdating) return;
    setIsUpdating(true);
    try {
      await deleteExpensePermanently(deletingExpense);
      setDeletingExpense(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (billing: any) => {
    if (billing.status === 'paid') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/50 text-emerald-600 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-emerald-100/50">
          <div className="w-1 h-1 rounded-full bg-emerald-600" />
          Pago
        </div>
      );
    }
    
    const today = dayjs();
    const billingDate = dayjs(billing.month_year).date(billing.due_day);
    const isOverdue = today.isAfter(billingDate, 'day');
    
    if (isOverdue || billing.status === 'overdue') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50/50 text-rose-600 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-rose-100/50">
          <div className="w-1 h-1 rounded-full bg-rose-600" />
          Atrasado
        </div>
      );
    }
    
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/50 text-amber-600 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-amber-100/50">
        <div className="w-1 h-1 rounded-full bg-amber-600" />
        Pendente
      </div>
    );
  };

  const getExpenseOriginBadge = (origin?: string) => {
    if (origin === 'kanoa') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100/70 inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Kanoa
        </span>
      );
    }
    if (origin === 'pessoal') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-amber-50 text-amber-800 border border-amber-100/70 inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Pessoal
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100/70 inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Canguru
      </span>
    );
  };

  const getExpenseStatusBadge = (expense: any) => {
    if (expense.paid) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/50 text-emerald-600 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-emerald-100/50">
          <div className="w-1 h-1 rounded-full bg-emerald-600" />
          Pago
        </div>
      );
    }
    
    if (expense.category === 'fixed' && expense.due_date) {
      const today = dayjs();
      const dueDate = dayjs(expense.due_date);
      if (today.isAfter(dueDate, 'day')) {
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50/50 text-rose-600 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-rose-100/50">
            <div className="w-1 h-1 rounded-full bg-rose-600" />
            Atrasado
          </div>
        );
      }
    }
    
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/50 text-amber-600 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-amber-100/50">
        <div className="w-1 h-1 rounded-full bg-amber-600" />
        Pendente
      </div>
    );
  };

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-stone-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl border border-stone-700/50 shadow-2xl text-xs space-y-2 min-w-[190px]">
          <p className="font-bold text-stone-300 border-b border-stone-800 pb-1.5 text-[11px] uppercase tracking-wider">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between items-center gap-3">
              <span className="flex items-center gap-1.5 text-stone-300 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-bold text-white text-[11px]">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Main Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark">Financeiro</h2>
          <p className="text-sm text-gray-500 mt-1">Gestão executiva de receitas, despesas e rentabilidade da agência.</p>
        </div>

        {/* Subtabs Navigation (Clean, Professional, No Values) */}
        <div className="flex items-center gap-1.5 p-1.5 bg-stone-100/90 rounded-[2rem] border border-black/[0.04] self-start lg:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setActiveSubTab('overview')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
              activeSubTab === 'overview'
                ? 'bg-white text-brand-dark shadow-sm'
                : 'text-gray-500 hover:text-brand-dark hover:bg-white/50'
            }`}
          >
            <LayoutDashboard size={15} />
            <span>Visão Geral</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('faturamento')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
              activeSubTab === 'faturamento'
                ? 'bg-white text-brand-dark shadow-sm'
                : 'text-gray-500 hover:text-brand-dark hover:bg-white/50'
            }`}
          >
            <DollarSign size={15} />
            <span>Faturamento</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('despesas')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
              activeSubTab === 'despesas'
                ? 'bg-white text-brand-dark shadow-sm'
                : 'text-gray-500 hover:text-brand-dark hover:bg-white/50'
            }`}
          >
            <Receipt size={15} />
            <span>Despesas</span>
          </button>
        </div>
      </div>

      {/* Auxiliary Control Bar with Month Selector, Privacy Eye and Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-3 sm:p-4 rounded-3xl border border-black/[0.04] shadow-sm">
        {/* Month Selector & Privacy Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-stone-50 p-1 rounded-2xl border border-black/[0.03]">
            <button 
              type="button"
              onClick={handlePrevMonth} 
              className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-brand-dark"
              title="Mês Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-4 py-1 text-center min-w-[130px]">
              <p className="text-[8px] uppercase tracking-[0.2em] font-bold text-gray-400">Período</p>
              <p className="text-xs font-bold text-brand-dark capitalize">
                {dayjs(currentMonthYear).format('MMMM YYYY')}
              </p>
            </div>
            <button 
              type="button"
              onClick={handleNextMonth} 
              className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-brand-dark"
              title="Próximo Mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Privacy Eye Toggle */}
          <button
            type="button"
            onClick={toggleHideValues}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
              hideValues 
                ? 'bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20' 
                : 'bg-stone-50 text-stone-600 border-black/[0.04] hover:bg-stone-100 hover:text-brand-dark'
            }`}
            title={hideValues ? 'Clique para exibir valores monetários' : 'Clique para ocultar valores monetários (Modo Privacidade)'}
          >
            {hideValues ? <EyeOff size={15} className="text-amber-600" /> : <Eye size={15} className="text-stone-500" />}
            <span className="text-[11px] tracking-wide">{hideValues ? 'Valores Ocultos' : 'Ocultar Valores'}</span>
          </button>
        </div>

        {/* Action Buttons based on Context */}
        <div className="flex items-center gap-2.5">
          {(activeSubTab === 'overview' || activeSubTab === 'faturamento') && (
            <button 
              type="button"
              onClick={() => setShowSporadicModal(true)}
              className="flex-1 sm:flex-initial flex justify-center items-center gap-2 px-4 sm:px-5 py-2.5 bg-stone-50 text-brand-dark border border-black/[0.05] rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-100 transition-all shadow-sm"
            >
              <Plus size={15} />
              <span>Faturamento Esporádico</span>
            </button>
          )}
          {(activeSubTab === 'overview' || activeSubTab === 'despesas') && (
            <button 
              type="button"
              onClick={() => setShowExpenseModal(true)}
              className="flex-1 sm:flex-initial flex justify-center items-center gap-2 px-4 sm:px-5 py-2.5 bg-brand-dark text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg shadow-brand-dark/10"
            >
              <Plus size={15} />
              <span>Nova Despesa</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: VISÃO GERAL (DASHBOARD EXECUTIVO COMPLETO) */}
      {/* ========================================================================= */}
      {activeSubTab === 'overview' && (
        <div className="space-y-8">
          {/* DESTAQUE PRINCIPAL: LUCRO E RENTABILIDADE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lucro Projetado / Estimado */}
            <motion.div
              whileHover={{ y: -2 }}
              className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-stone-900 to-stone-950 p-6 sm:p-7 rounded-3xl text-white shadow-xl shadow-emerald-950/10 border border-emerald-900/40"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/80 block">
                      Lucro Líquido Projetado
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5">
                      {formatCurrency(stats.lucroProjetado)}
                    </h3>
                  </div>
                </div>
                <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 font-bold text-xs flex items-center gap-1">
                  <Percent size={12} />
                  <span>{stats.margemProjetada.toFixed(1)}% Margem</span>
                </div>
              </div>

              <p className="text-xs text-stone-300/90 leading-relaxed mb-4">
                Resultado total previsto para o mês ({currentMonthFormatted}), calculado a partir do faturamento total previsto subtraído de todas as despesas cadastradas.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-xs">
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-stone-400 block">Faturamento Previsto</span>
                  <span className="font-bold text-emerald-300 text-sm">{formatCurrency(stats.totalToReceive)}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-stone-400 block">Despesas Totais</span>
                  <span className="font-bold text-rose-300 text-sm">{formatCurrency(stats.totalExpenses)}</span>
                </div>
              </div>
            </motion.div>

            {/* Lucro Realizado / Saldo em Caixa Real */}
            <motion.div
              whileHover={{ y: -2 }}
              className="relative overflow-hidden bg-white p-6 sm:p-7 rounded-3xl text-brand-dark shadow-sm border border-stone-200/80"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <Wallet size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 block">
                      Lucro Realizado em Caixa
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-dark mt-0.5">
                      {formatCurrency(stats.lucroRealizado)}
                    </h3>
                  </div>
                </div>
                <div className="px-3 py-1 bg-stone-100 rounded-xl text-gray-600 font-bold text-xs flex items-center gap-1">
                  <CheckCheck size={14} className="text-emerald-600" />
                  <span>Realizado</span>
                </div>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                Saldo financeiro já consolidado na conta bancária até o momento: faturamentos efetivamente recebidos menos as contas já quitadas.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 text-xs">
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400 block">Já Recebido</span>
                  <span className="font-bold text-emerald-600 text-sm">{formatCurrency(stats.totalReceived)}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400 block">Já Quitado</span>
                  <span className="font-bold text-rose-600 text-sm">{formatCurrency(stats.totalExpensesPaid)}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 4 CARDS DE RESUMO OPERACIONAL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Faturamento Total */}
            <div className="bg-white p-5 rounded-3xl border border-black/[0.04] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-gray-400">Faturamento Previsto</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <DollarSign size={16} />
                </div>
              </div>
              <h4 className="text-xl font-bold text-brand-dark">{formatCurrency(stats.totalToReceive)}</h4>
              <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                <span>{stats.taxaRecebimento.toFixed(0)}% recebido</span>
                <span className="font-medium text-amber-600">{formatCurrency(stats.totalOpen)} em aberto</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, stats.taxaRecebimento)}%` }} />
              </div>
            </div>

            {/* 2. Total Recebido */}
            <div className="bg-white p-5 rounded-3xl border border-black/[0.04] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-gray-400">Total Recebido</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <h4 className="text-xl font-bold text-emerald-600">{formatCurrency(stats.totalReceived)}</h4>
              <p className="text-[11px] text-gray-400 mt-3">
                {billings.filter(b => b.status === 'paid').length} de {billings.length} cobranças quitadas
              </p>
            </div>

            {/* 3. Total de Despesas */}
            <div className="bg-white p-5 rounded-3xl border border-black/[0.04] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-gray-400">Total de Despesas</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Receipt size={16} />
                </div>
              </div>
              <h4 className="text-xl font-bold text-rose-600">{formatCurrency(stats.totalExpenses)}</h4>
              <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                <span>{stats.taxaDespesasPagas.toFixed(0)}% quitado</span>
                <span className="font-medium text-rose-600">{formatCurrency(stats.totalExpensesPending)} a pagar</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-rose-600 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, stats.taxaDespesasPagas)}%` }} />
              </div>
            </div>

            {/* 4. Despesas Fixas vs Variáveis */}
            <div className="bg-white p-5 rounded-3xl border border-black/[0.04] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-gray-400">Composição de Custos</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers size={16} />
                </div>
              </div>
              <div className="space-y-1.5 mt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Fixas:</span>
                  <span className="font-bold text-brand-dark">{formatCurrency(stats.totalFixedExpenses)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Variáveis:</span>
                  <span className="font-bold text-brand-dark">{formatCurrency(stats.totalVariableExpenses)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* INDICADORES ESTRATÉGICOS & ANUAIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <BarChart3 size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Acumulado no Ano</p>
                <p className="text-sm font-bold text-brand-dark truncate">{formatCurrency(faturamentoAcumulado)}</p>
                <p className="text-[9px] text-gray-400">{labelPeriodo}</p>
              </div>
            </div>

            <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Briefcase size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Ticket Médio</p>
                <p className="text-sm font-bold text-brand-dark truncate">{formatCurrency(ticketMedio)}</p>
                <p className="text-[9px] text-gray-400">por contrato recorrente</p>
              </div>
            </div>

            <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Scale size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Ponto de Equilíbrio</p>
                <p className="text-sm font-bold text-brand-dark truncate">{formatCurrency(stats.totalExpenses)}</p>
                <p className="text-[9px] text-gray-400">break-even operacional</p>
              </div>
            </div>

            <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Comprometimento Fixo</p>
                <p className="text-sm font-bold text-brand-dark truncate">
                  {stats.totalToReceive > 0 ? ((stats.totalFixedExpenses / stats.totalToReceive) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-[9px] text-gray-400">da receita em custos fixos</p>
              </div>
            </div>
          </div>

          {/* PAINEL DE GRÁFICOS EXECUTIVOS (HISTÓRICO & COMPOSIÇÃO) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico 1: Evolução Financeira Multi-Mensal (2 Colunas) */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-black/[0.04] shadow-sm p-6 sm:p-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-brand-dark">Evolução Financeira</h3>
                  <p className="text-xs text-gray-400">Histórico de Faturamento, Despesas e Lucro Líquido (últimos 6 meses)</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full self-start sm:self-auto">
                  Visão Histórica
                </span>
              </div>

              <div className="pt-2">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={history} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.85}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.35}/>
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.85}/>
                        <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.35}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis 
                      dataKey="monthLabel" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 500 }} 
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: '#9CA3AF', fontSize: 10 }}
                      tickFormatter={(val) => hideValues ? '•••' : `R$ ${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                    />
                    <RechartsTooltip content={<CustomChartTooltip />} />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: 15, fontSize: 11, fontWeight: 600 }}
                    />
                    <Bar dataKey="revenue" name="Faturamento" fill="url(#revenueGrad)" radius={[6, 6, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="expenses" name="Despesas" fill="url(#expenseGrad)" radius={[6, 6, 0, 0]} maxBarSize={30} />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      name="Lucro Líquido" 
                      stroke="#10B981" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#FFFFFF' }}
                      activeDot={{ r: 6 }} 
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Composição de Despesas & Centro de Custos */}
            <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm p-6 sm:p-7 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-brand-dark">Centro de Custos</h3>
                  <p className="text-xs text-gray-400">Distribuição das despesas do mês</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center">
                  <PieChartIcon size={16} />
                </div>
              </div>

              {expenseBreakdown.byType.length > 0 ? (
                <div>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseBreakdown.byType}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={72}
                          paddingAngle={3}
                        >
                          {expenseBreakdown.byType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(val: any) => [formatCurrency(Number(val)), 'Total']}
                          contentStyle={{ backgroundColor: '#18181B', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legenda de Tipos */}
                  <div className="space-y-2 mt-2 pt-3 border-t border-gray-100 text-xs">
                    {expenseBreakdown.byType.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-gray-600 font-medium text-[11px]">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-brand-dark text-[11px]">{formatCurrency(item.value)}</span>
                          <span className="text-[10px] text-gray-400 font-medium w-8 text-right">({item.percent.toFixed(0)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400">
                  <p className="text-xs">Nenhuma despesa cadastrada no mês.</p>
                </div>
              )}
            </div>
          </div>

          {/* DRE SINTÉTICA (DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO) */}
          <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-brand-dark">DRE Sintética Mensal</h3>
                  <p className="text-xs text-gray-400">Demonstrativo de Resultado do Exercício consolidado ({currentMonthFormatted})</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3.5 py-1.5 rounded-full self-start sm:self-auto">
                Margem Líquida: {stats.margemProjetada.toFixed(1)}%
              </span>
            </div>

            <div className="mt-4 divide-y divide-stone-100 text-xs">
              {/* Receita Recorrente */}
              <div className="py-3 flex items-center justify-between">
                <span className="text-stone-600 font-medium">(+) Receita Recorrente de Contratos</span>
                <span className="font-bold text-brand-dark">{formatCurrency(recurringTotal)}</span>
              </div>
              {/* Receita Esporádica */}
              <div className="py-3 flex items-center justify-between">
                <span className="text-stone-600 font-medium">(+) Receita de Serviços Esporádicos</span>
                <span className="font-bold text-brand-dark">{formatCurrency(sporadicTotal)}</span>
              </div>
              {/* Receita Bruta Total */}
              <div className="py-3 flex items-center justify-between bg-blue-50/40 px-3.5 rounded-xl font-bold my-1">
                <span className="text-blue-950">(=) Receita Operacional Bruta (Faturamento)</span>
                <span className="text-blue-700 font-extrabold text-sm">{formatCurrency(stats.totalToReceive)}</span>
              </div>
              {/* Despesas Fixas */}
              <div className="py-3 flex items-center justify-between">
                <span className="text-stone-600 font-medium">(-) Despesas Operacionais Fixas (Ferramentas, Infra, Assinaturas)</span>
                <span className="font-bold text-rose-600">{formatCurrency(stats.totalFixedExpenses)}</span>
              </div>
              {/* Despesas Variáveis */}
              <div className="py-3 flex items-center justify-between">
                <span className="text-stone-600 font-medium">(-) Despesas Operacionais Variáveis (Freelancers, Terceiros, Extras)</span>
                <span className="font-bold text-rose-600">{formatCurrency(stats.totalVariableExpenses)}</span>
              </div>
              {/* Total Despesas */}
              <div className="py-3 flex items-center justify-between bg-rose-50/40 px-3.5 rounded-xl font-bold my-1">
                <span className="text-rose-950">(=) Total de Despesas Operacionais</span>
                <span className="text-rose-700 font-extrabold text-sm">{formatCurrency(stats.totalExpenses)}</span>
              </div>
              {/* Lucro Líquido */}
              <div className="py-3.5 flex items-center justify-between bg-stone-900 text-white px-4 rounded-2xl font-bold mt-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-400" />
                  <span className="text-sm">(=) Resultado Operacional Líquido (EBITDA Projetado)</span>
                </div>
                <div className="text-right">
                  <span className="text-base sm:text-lg text-emerald-400 font-extrabold">{formatCurrency(stats.lucroProjetado)}</span>
                  <span className="text-[10px] text-stone-300 block font-medium">Margem de {stats.margemProjetada.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: FATURAMENTO */}
      {/* ========================================================================= */}
      {activeSubTab === 'faturamento' && (
        <div className="space-y-6">
          {/* Cards de Métricas de Faturamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {[
              { label: 'Total a Receber', value: stats.totalToReceive, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50/50' },
              { label: 'Total Recebido', value: stats.totalReceived, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
              { label: 'Total em Aberto', value: stats.totalOpen, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50/50' },
              { label: 'Ticket Médio', value: ticketMedio, icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-50/50', subtitle: 'por cliente recorrente' },
              { label: 'Faturado no Ano', value: faturamentoAcumulado, icon: BarChart3, color: 'text-teal-600', bg: 'bg-teal-50/50', subtitle: labelPeriodo },
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -2 }}
                className="bg-white p-5 rounded-3xl border border-black/[0.03] shadow-sm flex items-center gap-4"
              >
                <div className={`w-10 h-10 ${item.bg} rounded-2xl flex-shrink-0 flex items-center justify-center ${item.color}`}>
                  <item.icon size={18} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-gray-400 text-[9px] uppercase tracking-[0.15em] font-bold mb-0.5 leading-tight">
                    {item.label}
                  </p>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-brand-dark">
                    {formatCurrency(item.value)}
                  </h3>
                  {('subtitle' in item) && item.subtitle && (
                    <p className="text-[8px] text-gray-400 font-medium mt-0.5">{item.subtitle}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Billings Table */}
          <div className="bg-white rounded-3xl border border-black/[0.03] shadow-sm overflow-hidden">
            <div className="px-6 sm:px-8 py-5 border-b border-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-brand-dark">Faturamento por Cliente</h3>
                <p className="text-xs text-gray-400 mt-0.5">Listagem de cobranças recorrentes e serviços esporádicos do mês</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowSporadicModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              >
                <Plus size={14} />
                <span>Adicionar Esporádico</span>
              </button>
            </div>
            
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {sortedBillings.map((billing) => (
                <div key={billing.id} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {billing.is_sporadic ? (
                        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px] bg-gray-400">ES</div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px]" style={{ backgroundColor: billing.client?.color }}>
                          {billing.client?.initials}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-sm text-brand-dark block">{billing.is_sporadic ? billing.sporadic_name : billing.client?.name}</span>
                        {billing.is_sporadic && <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Esporádico</span>}
                      </div>
                    </div>
                    <div>{getStatusBadge(billing)}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm bg-white p-3 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-0.5">Base</p>
                      <p className="font-medium text-brand-dark">{formatCurrency(billing.base_value)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-0.5">Extra</p>
                      <p className="font-medium text-brand-dark">{formatCurrency(billing.extra_value)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-0.5">Total</p>
                      <p className="font-bold text-brand-dark">{formatCurrency(billing.base_value + billing.extra_value)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-0.5">Venc.</p>
                      <p className="font-medium text-gray-600">Dia {billing.due_day}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button 
                      type="button"
                      onClick={() => setEditingBilling(billing)}
                      className="flex-1 p-2.5 text-blue-600 bg-blue-50/50 hover:bg-blue-100 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold"
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                    {billing.status !== 'paid' ? (
                      <button 
                        type="button"
                        onClick={() => updateBilling({ 
                          id: billing.id, 
                          client_id: billing.client_id, 
                          month_year: billing.month_year, 
                          status: 'paid', 
                          paid_at: new Date().toISOString() 
                        })}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all text-center"
                      >
                        Marcar Pago
                      </button>
                    ) : (
                      <div className="flex-1 py-2.5 bg-gray-100 text-gray-400 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-gray-200 text-center">
                        Recebido
                      </div>
                    )}
                    {billing.is_sporadic && (
                      <button 
                        type="button"
                        onClick={() => setDeletingSporadicBilling(billing)}
                        className="p-2.5 text-rose-600 bg-rose-50/50 hover:bg-rose-100 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sortedBillings.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">Nenhum faturamento para este mês.</p>
              )}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/30">
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Cliente</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Valor Base</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Extras</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Total</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Vencimento</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Status</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedBillings.map((billing) => (
                    <tr key={billing.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          {billing.is_sporadic ? (
                            <>
                              <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px] bg-gray-400">
                                ES
                              </div>
                              <span className="font-bold text-sm text-brand-dark whitespace-normal leading-tight">{billing.sporadic_name} <span className="text-[10px] text-gray-400 font-normal ml-1">(Esporádico)</span></span>
                            </>
                          ) : (
                            <>
                              <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px]" style={{ backgroundColor: billing.client?.color }}>
                                {billing.client?.initials}
                              </div>
                              <span className="font-bold text-sm text-brand-dark whitespace-normal leading-tight">{billing.client?.name}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-sm font-medium text-brand-dark">{formatCurrency(billing.base_value)}</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-sm font-medium text-brand-dark">{formatCurrency(billing.extra_value)}</span>
                      </td>
                      <td className="px-8 py-5 font-bold text-sm text-brand-dark">
                        {formatCurrency(billing.base_value + billing.extra_value)}
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-gray-500 text-sm font-medium">Dia {billing.due_day}</span>
                      </td>
                      <td className="px-8 py-5">{getStatusBadge(billing)}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => setEditingBilling(billing)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Editar Detalhes"
                          >
                            <Edit2 size={14} />
                          </button>
                          {billing.status !== 'paid' ? (
                            <button 
                              type="button"
                              onClick={() => updateBilling({ 
                                id: billing.id, 
                                client_id: billing.client_id, 
                                month_year: billing.month_year, 
                                status: 'paid', 
                                paid_at: new Date().toISOString() 
                              })}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10 whitespace-nowrap"
                            >
                              Marcar Pago
                            </button>
                          ) : (
                            <div className="px-4 py-2 bg-gray-50 text-gray-400 rounded-xl text-[9px] font-bold uppercase tracking-widest border border-gray-100 whitespace-nowrap">
                              Recebido
                            </div>
                          )}
                          {billing.is_sporadic && (
                            <button 
                              type="button"
                              onClick={() => setDeletingSporadicBilling(billing)}
                              className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                              title="Excluir Faturamento"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: DESPESAS */}
      {/* ========================================================================= */}
      {activeSubTab === 'despesas' && (
        <div className="space-y-6">
          {/* Cards de Métricas de Despesas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-black/[0.03] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-gray-400">Total Despesas</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Receipt size={16} />
                </div>
              </div>
              <h4 className="text-xl font-bold text-rose-600">{formatCurrency(stats.totalExpenses)}</h4>
              <p className="text-[11px] text-gray-400 mt-2">{expenses.length} contas no mês</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-black/[0.03] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-gray-400">Despesas Fixas</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Lock size={16} />
                </div>
              </div>
              <h4 className="text-xl font-bold text-brand-dark">{formatCurrency(stats.totalFixedExpenses)}</h4>
              <p className="text-[11px] text-gray-400 mt-2">Custos recorrentes agência</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-black/[0.03] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-gray-400">Despesas Variáveis</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Zap size={16} />
                </div>
              </div>
              <h4 className="text-xl font-bold text-brand-dark">{formatCurrency(stats.totalVariableExpenses)}</h4>
              <p className="text-[11px] text-gray-400 mt-2">Gastos pontuais e extras</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-black/[0.03] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-gray-400">Contas a Pagar</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock size={16} />
                </div>
              </div>
              <h4 className="text-xl font-bold text-amber-600">{formatCurrency(stats.totalExpensesPending)}</h4>
              <p className="text-[11px] text-gray-400 mt-2">{expenses.filter(e => !e.paid).length} contas pendentes</p>
            </div>
          </div>

          {/* Filtros e Barra de Ações de Despesas */}
          <div className="bg-white p-4 rounded-3xl border border-black/[0.03] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {/* Filtros de Origem & Status */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-bold text-gray-400 mr-1">Origem:</span>
              {(['all', 'canguru', 'kanoa', 'pessoal'] as const).map((origin) => (
                <button
                  key={origin}
                  type="button"
                  onClick={() => setExpenseFilterOrigin(origin)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    expenseFilterOrigin === origin
                      ? 'bg-brand-dark text-white shadow-sm'
                      : 'bg-stone-50 text-gray-600 hover:bg-stone-100'
                  }`}
                >
                  {origin === 'all' ? 'Todas' : origin === 'canguru' ? 'Canguru' : origin === 'kanoa' ? 'Kanoa' : 'Pessoal'}
                </button>
              ))}

              <div className="h-4 w-px bg-gray-200 mx-1 hidden sm:block" />

              <span className="text-xs font-bold text-gray-400 mr-1">Status:</span>
              {(['all', 'pending', 'paid'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setExpenseFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    expenseFilterStatus === status
                      ? 'bg-brand-dark text-white shadow-sm'
                      : 'bg-stone-50 text-gray-600 hover:bg-stone-100'
                  }`}
                >
                  {status === 'all' ? 'Todas' : status === 'pending' ? 'Pendentes' : 'Pagas'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowExpenseModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-dark text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-md shadow-brand-dark/10"
            >
              <Plus size={15} />
              <span>Nova Despesa</span>
            </button>
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-3xl border border-black/[0.03] shadow-sm overflow-hidden">
            <div className="px-6 sm:px-8 py-5 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-brand-dark">Despesas da Agência</h3>
                <p className="text-xs text-gray-400 mt-0.5">Exibindo {filteredExpenses.length} de {expenses.length} despesas</p>
              </div>
              <div className="flex items-center gap-2 text-rose-600 font-bold bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100/50">
                <span className="text-[10px] uppercase tracking-widest">Total no Mês:</span>
                <span className="text-base">{formatCurrency(stats.totalExpenses)}</span>
              </div>
            </div>

            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-sm text-brand-dark block">{expense.description}</span>
                      {expense.notes && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{expense.notes}</p>}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="font-bold text-base text-brand-dark block">{formatCurrency(expense.amount)}</span>
                      {getExpenseStatusBadge(expense)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
                    {getExpenseOriginBadge(expense.origin)}
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest ${expense.category === 'fixed' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                      {expense.category === 'fixed' ? 'Fixa' : 'Variável'}
                    </span>
                    {expense.expense_type && (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-gray-200 text-gray-600">
                        {expense.expense_type === 'tools' ? 'Ferramentas' : expense.expense_type === 'freelancers' ? 'Freelancers' : 'Custos Extras'}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-gray-100 text-gray-500">
                      Venc: {expense.category === 'fixed' ? (expense.due_date ? `${dayjs(expense.due_date).date()}` : '-') : '-'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100/50">
                    <button 
                      type="button"
                      onClick={() => startEditingExpense(expense)}
                      className="p-2.5 text-blue-600 bg-blue-50/50 hover:bg-blue-100/55 rounded-xl transition-all"
                      title="Editar Despesa"
                    >
                      <Edit2 size={16} />
                    </button>
                    {!expense.paid ? (
                      <button 
                        type="button"
                        onClick={() => handleMarkExpensePaid(expense)}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all text-center"
                      >
                        Marcar Pago
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => updateExpense(expense.id, { paid: false, paid_at: null })}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-gray-200 text-center"
                      >
                        Estornar
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => setDeletingExpense(expense)}
                      className="p-2.5 text-rose-600 bg-rose-50/50 hover:bg-rose-100 rounded-xl transition-all"
                      title="Excluir Despesa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {filteredExpenses.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">Nenhuma despesa encontrada para os filtros selecionados.</p>
              )}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/30">
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Descrição</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Origem</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Categoria</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Valor</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Vencimento</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Status</th>
                    <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50/30 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex flex-col min-w-[200px]">
                          <span className="font-bold text-sm text-brand-dark whitespace-normal leading-tight">{expense.description}</span>
                          {expense.notes && <span className="text-[10px] text-gray-400 mt-1 leading-relaxed">{expense.notes}</span>}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        {getExpenseOriginBadge(expense.origin)}
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest ${expense.category === 'fixed' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                          {expense.category === 'fixed' ? 'Fixa' : 'Variável'}
                        </span>
                        {expense.expense_type && (
                          <span className="ml-2 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest bg-gray-100 text-gray-600">
                            {expense.expense_type === 'tools' ? 'Ferramentas' : expense.expense_type === 'freelancers' ? 'Freelancers' : 'Custos Extras'}
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-5">
                        <span className="font-bold text-sm text-brand-dark">{formatCurrency(expense.amount)}</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-gray-500 text-sm font-medium">
                          {expense.category === 'fixed' ? (expense.due_date ? `Dia ${dayjs(expense.due_date).date()}` : '-') : '-'}
                        </span>
                      </td>
                      <td className="px-8 py-5">{getExpenseStatusBadge(expense)}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => startEditingExpense(expense)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Editar Detalhes"
                          >
                            <Edit2 size={14} />
                          </button>
                          {!expense.paid ? (
                            <button 
                              type="button"
                              onClick={() => handleMarkExpensePaid(expense)}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10 whitespace-nowrap"
                            >
                              Marcar Pago
                            </button>
                          ) : (
                            <button 
                              type="button"
                              onClick={() => updateExpense(expense.id, { paid: false, paid_at: null })}
                              className="px-4 py-2 bg-gray-50 text-gray-400 rounded-xl text-[9px] font-bold uppercase tracking-widest border border-gray-100 whitespace-nowrap hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all"
                            >
                              Estornar
                            </button>
                          )}
                          <button 
                            type="button"
                            onClick={() => setDeletingExpense(expense)}
                            className="p-2 text-gray-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Excluir Despesa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-8 py-12 text-center text-gray-400 text-sm">
                        Nenhuma despesa encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-dark/20 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-black/[0.03] max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-brand-dark">Nova Despesa</h3>
                <p className="text-xs text-gray-400 mt-0.5">Cadastre uma nova conta ou custo da agência</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowExpenseModal(false)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-5">
              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                  Descrição / Nome da Conta *
                </label>
                <input 
                  type="text" 
                  required
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200/80 rounded-2xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-all outline-none text-sm font-medium text-brand-dark"
                  placeholder="Ex: Assinatura Reportei, Servidor Cloud, etc."
                />
              </div>

              {/* Origin / Quem Paga */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                  Origem / Quem Paga *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewExpense({ ...newExpense, origin: 'canguru' })}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                      newExpense.origin === 'canguru'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-600/15 shadow-sm'
                        : 'bg-stone-50 text-gray-600 border-stone-200/80 hover:bg-stone-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Canguru
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewExpense({ ...newExpense, origin: 'kanoa' })}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                      newExpense.origin === 'kanoa'
                        ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-600/15 shadow-sm'
                        : 'bg-stone-50 text-gray-600 border-stone-200/80 hover:bg-stone-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Kanoa
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewExpense({ ...newExpense, origin: 'pessoal' })}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                      newExpense.origin === 'pessoal'
                        ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-600/15 shadow-sm'
                        : 'bg-stone-50 text-gray-600 border-stone-200/80 hover:bg-stone-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Pessoal
                  </button>
                </div>
              </div>

              {/* Amount and Due Day */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                    Valor Estimado (R$) *
                  </label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    min="0"
                    value={newExpense.amount || ''}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200/80 rounded-2xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-all outline-none text-sm font-medium text-brand-dark"
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                    Dia do Vencimento
                  </label>
                  <input 
                    type="number" 
                    required 
                    min={1} 
                    max={31}
                    value={newExpense.due_day || 10}
                    onChange={(e) => setNewExpense({ ...newExpense, due_day: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200/80 rounded-2xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-all outline-none text-sm font-medium text-brand-dark"
                    placeholder="Ex: 10"
                  />
                </div>
              </div>

              {/* Expense Type and Recurrence toggle card */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                  Tipo de Despesa
                </label>
                <select 
                  value={newExpense.expense_type}
                  onChange={(e) => setNewExpense({ ...newExpense, expense_type: e.target.value as 'tools' | 'freelancers' | 'extras' })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200/80 rounded-2xl focus:bg-white focus:border-emerald-600 transition-all outline-none text-sm font-medium text-brand-dark appearance-none"
                >
                  <option value="tools">Ferramentas / Softwares</option>
                  <option value="freelancers">Freelancers / Prestadores</option>
                  <option value="extras">Custos Extras / Operacionais</option>
                </select>
              </div>

              {/* Recurring Card */}
              <div 
                onClick={() => setNewExpense({ ...newExpense, category: newExpense.category === 'fixed' ? 'variable' : 'fixed' })}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                  newExpense.category === 'fixed'
                    ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                    : 'bg-stone-50/70 border-stone-200/80 text-gray-600 hover:bg-stone-100/70'
                }`}
              >
                <input 
                  type="checkbox"
                  checked={newExpense.category === 'fixed'}
                  onChange={(e) => setNewExpense({ ...newExpense, category: e.target.checked ? 'fixed' : 'variable' })}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-brand-dark flex items-center gap-1.5">
                      <Repeat size={13} className="text-emerald-600" />
                      Despesa Fixa Recorrente
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                      newExpense.category === 'fixed' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {newExpense.category === 'fixed' ? 'Ativo' : 'Pontual'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Repetir automaticamente todos os meses na planilha até ser cancelada.
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                  Notas / Observações
                </label>
                <textarea 
                  value={newExpense.notes}
                  onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200/80 rounded-2xl focus:bg-white focus:border-emerald-600 transition-all outline-none text-sm font-medium text-brand-dark resize-none"
                  rows={2}
                  placeholder="Informações adicionais, link de pagamento, etc."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 px-6 py-3.5 border border-stone-200 text-gray-500 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-700/20"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Sporadic Billing Modal */}
      {showSporadicModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-dark/20 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl border border-black/[0.03]"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-brand-dark">Faturamento Esporádico</h3>
              <button onClick={() => setShowSporadicModal(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleAddSporadicBilling} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Nome do Serviço / Cliente</label>
                <input 
                  type="text" 
                  required
                  value={newSporadicBilling.sporadic_name}
                  onChange={(e) => setNewSporadicBilling({ ...newSporadicBilling, sporadic_name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium"
                  placeholder="Ex: Criação de Landing Page"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Valor (R$)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    value={newSporadicBilling.base_value}
                    onChange={(e) => setNewSporadicBilling({ ...newSporadicBilling, base_value: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium"
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Dia Vencimento</label>
                  <input 
                    type="number" 
                    required min={1} max={31}
                    value={newSporadicBilling.due_day}
                    onChange={(e) => setNewSporadicBilling({ ...newSporadicBilling, due_day: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Notas</label>
                <textarea 
                  value={newSporadicBilling.notes}
                  onChange={(e) => setNewSporadicBilling({ ...newSporadicBilling, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium resize-none"
                  rows={2}
                  placeholder="Observações..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowSporadicModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-100 text-gray-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 bg-brand-dark text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg shadow-brand-dark/10"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Billing Edit Modal */}
      {editingBilling && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-dark/20 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl border border-black/[0.03]"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold text-brand-dark">Editar Faturamento</h3>
                <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">
                  {editingBilling.is_sporadic ? editingBilling.sporadic_name : editingBilling.client?.name}
                </p>
              </div>
              <button onClick={() => setEditingBilling(null)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateBilling} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Valor Base (R$)</label>
                  <input 
                    type="number" 
                    required
                    value={editingBilling.base_value}
                    onChange={(e) => setEditingBilling({ ...editingBilling, base_value: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Extras (R$)</label>
                  <input 
                    type="number" 
                    required
                    value={editingBilling.extra_value}
                    onChange={(e) => setEditingBilling({ ...editingBilling, extra_value: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium"
                  />
                </div>
                
                {!editingBilling.is_sporadic && (
                  <div className="space-y-2 col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs text-gray-600 font-medium select-none bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                      <input 
                        type="checkbox" 
                        checked={editingBilling.update_global_contract !== false}
                        onChange={(e) => setEditingBilling({ ...editingBilling, update_global_contract: e.target.checked })}
                        className="w-4 h-4 text-brand-dark rounded border-gray-300 focus:ring-brand-dark"
                      />
                      Atualizar valor do contrato para todos os meses seguintes
                    </label>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Dia Vencimento</label>
                  <input 
                    type="number" 
                    required min={1} max={31}
                    value={editingBilling.due_day}
                    onChange={(e) => setEditingBilling({ ...editingBilling, due_day: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Status</label>
                  <select 
                    value={editingBilling.status}
                    onChange={(e) => setEditingBilling({ ...editingBilling, status: e.target.value as any })}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium appearance-none"
                  >
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Atrasado</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Notas / Observações</label>
                <textarea 
                  value={editingBilling.notes || ''}
                  onChange={(e) => setEditingBilling({ ...editingBilling, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium resize-none"
                  rows={2}
                  placeholder="Ex: Pago via Pix..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setEditingBilling(null)}
                  className="flex-1 px-6 py-3 border border-gray-100 text-gray-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 px-6 py-3 bg-brand-dark text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg shadow-brand-dark/10 disabled:opacity-50"
                >
                  {isUpdating ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Expense Edit Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-dark/20 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-black/[0.03] max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-brand-dark">Editar Despesa</h3>
                <p className="text-xs text-gray-400 mt-0.5">Atualize os valores e informações da despesa</p>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingExpense(null)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateExpense} className="space-y-5">
              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                  Descrição / Nome da Conta *
                </label>
                <input 
                  type="text" 
                  required
                  value={editingExpense.description}
                  onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200/80 rounded-2xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-all outline-none text-sm font-medium text-brand-dark"
                />
              </div>

              {/* Origin / Quem Paga */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                  Origem / Quem Paga *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingExpense({ ...editingExpense, origin: 'canguru' })}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                      (editingExpense.origin || 'canguru') === 'canguru'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-600/15 shadow-sm'
                        : 'bg-stone-50 text-gray-600 border-stone-200/80 hover:bg-stone-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Canguru
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingExpense({ ...editingExpense, origin: 'kanoa' })}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                      editingExpense.origin === 'kanoa'
                        ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-600/15 shadow-sm'
                        : 'bg-stone-50 text-gray-600 border-stone-200/80 hover:bg-stone-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Kanoa
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingExpense({ ...editingExpense, origin: 'pessoal' })}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                      editingExpense.origin === 'pessoal'
                        ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-600/15 shadow-sm'
                        : 'bg-stone-50 text-gray-600 border-stone-200/80 hover:bg-stone-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Pessoal
                  </button>
                </div>
              </div>

              {/* Amount and Due Day */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                    Valor (R$) *
                  </label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    min="0"
                    value={editingExpense.amount}
                    onChange={(e) => setEditingExpense({ ...editingExpense, amount: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200/80 rounded-2xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-all outline-none text-sm font-medium text-brand-dark"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                    Dia do Vencimento
                  </label>
                  <input 
                    type="number" 
                    required 
                    min={1} 
                    max={31}
                    value={editingExpense.due_day || 10}
                    onChange={(e) => setEditingExpense({ ...editingExpense, due_day: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200/80 rounded-2xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-all outline-none text-sm font-medium text-brand-dark"
                  />
                </div>
              </div>

              {/* Expense Type and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                    Tipo de Despesa
                  </label>
                  <select 
                    value={editingExpense.expense_type}
                    onChange={(e) => setEditingExpense({ ...editingExpense, expense_type: e.target.value as 'tools' | 'freelancers' | 'extras' })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200/80 rounded-2xl focus:bg-white focus:border-emerald-600 transition-all outline-none text-sm font-medium text-brand-dark appearance-none"
                  >
                    <option value="tools">Ferramentas</option>
                    <option value="freelancers">Freelancers</option>
                    <option value="extras">Custos Extras</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                    Status de Pagamento
                  </label>
                  <select 
                    value={editingExpense.paid ? "true" : "false"}
                    onChange={(e) => setEditingExpense({ ...editingExpense, paid: e.target.value === "true", paid_at: e.target.value === "true" ? (editingExpense.paid_at || new Date().toISOString()) : null })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200/80 rounded-2xl focus:bg-white focus:border-emerald-600 transition-all outline-none text-sm font-medium text-brand-dark appearance-none"
                  >
                    <option value="false">Pendente</option>
                    <option value="true">Pago</option>
                  </select>
                </div>
              </div>

              {/* Recurring Card */}
              <div 
                onClick={() => setEditingExpense({ ...editingExpense, category: editingExpense.category === 'fixed' ? 'variable' : 'fixed' })}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                  editingExpense.category === 'fixed'
                    ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                    : 'bg-stone-50/70 border-stone-200/80 text-gray-600 hover:bg-stone-100/70'
                }`}
              >
                <input 
                  type="checkbox"
                  checked={editingExpense.category === 'fixed'}
                  onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.checked ? 'fixed' : 'variable' })}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-brand-dark flex items-center gap-1.5">
                      <Repeat size={13} className="text-emerald-600" />
                      Despesa Fixa Recorrente
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                      editingExpense.category === 'fixed' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {editingExpense.category === 'fixed' ? 'Fixa (Recorrente)' : 'Variável / Pontual'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Despesas fixas são replicadas automaticamente todos os meses no painel financeiro.
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">
                  Notas / Observações
                </label>
                <textarea 
                  value={editingExpense.notes || ''}
                  onChange={(e) => setEditingExpense({ ...editingExpense, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200/80 rounded-2xl focus:bg-white focus:border-emerald-600 transition-all outline-none text-sm font-medium text-brand-dark resize-none"
                  rows={2}
                  placeholder="Observações..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 px-6 py-3.5 border border-stone-200 text-gray-500 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 px-6 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-700/20 disabled:opacity-50"
                >
                  {isUpdating ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Date Picker Modal for Variable Expenses */}
      {payingExpense && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-brand-dark/20 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-black/[0.03]"
          >
            <h3 className="text-lg font-bold text-brand-dark mb-6 text-center">Data de Pagamento</h3>
            <div className="space-y-6">
              <input 
                type="date"
                defaultValue={dayjs().format('YYYY-MM-DD')}
                id="payment-date"
                className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium"
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setPayingExpense(null)}
                  className="flex-1 px-6 py-3 border border-gray-100 text-gray-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    const date = (document.getElementById('payment-date') as HTMLInputElement).value;
                    handleMarkExpensePaid(payingExpense, dayjs(date).toISOString());
                  }}
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Sporadic Billing Modal */}
      {deletingSporadicBilling && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-brand-dark/20 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-black/[0.03] text-center"
          >
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-brand-dark mb-2">Excluir Faturamento?</h3>
            <p className="text-sm text-gray-500 mb-8">
              Tem certeza que deseja excluir o faturamento esporádico <strong>{deletingSporadicBilling.sporadic_name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeletingSporadicBilling(null)}
                className="flex-1 px-6 py-3 border border-gray-100 text-gray-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  await deleteBilling(deletingSporadicBilling.id);
                  setDeletingSporadicBilling(null);
                }}
                className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Scope Confirmation Modal */}
      {showEditScopeModal && pendingEditExpense && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-brand-dark/30 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl border border-black/[0.03]"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-brand-dark">Alterar Despesa Recorrente</h3>
              <button 
                type="button"
                onClick={() => { setShowEditScopeModal(false); setPendingEditExpense(null); }} 
                className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Esta despesa é <strong>Fixa / Recorrente</strong>. Como você deseja aplicar as alterações feitas em <strong>"{pendingEditExpense.original.description}"</strong>?
            </p>

            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={confirmEditOnlyThisMonth}
                disabled={isUpdating}
                className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-blue-50/50 hover:border-blue-200 transition-all group disabled:opacity-50"
              >
                <span className="font-bold text-sm text-brand-dark block group-hover:text-blue-600 mb-1">
                  Editar apenas neste mês ({currentMonthFormatted})
                </span>
                <span className="text-xs text-gray-500 block leading-relaxed">
                  Cria uma exceção exclusiva para o mês atual. Os outros meses continuarão com os valores originais da conta fixa.
                </span>
              </button>

              <button
                type="button"
                onClick={confirmEditAllMonths}
                disabled={isUpdating}
                className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-blue-50/50 hover:border-blue-200 transition-all group disabled:opacity-50"
              >
                <span className="font-bold text-sm text-brand-dark block group-hover:text-blue-600 mb-1">
                  Editar para todos os meses
                </span>
                <span className="text-xs text-gray-500 block leading-relaxed">
                  Atualiza a conta fixa principal. As mudanças serão refletidas imediatamente no mês atual e em todos os outros meses.
                </span>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setShowEditScopeModal(false); setPendingEditExpense(null); }}
                className="px-6 py-3 border border-gray-100 text-gray-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Expense Modal with 3 Options */}
      {deletingExpense && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-brand-dark/20 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-black/[0.03] max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-brand-dark">
                    {(deletingExpense.is_fixed || deletingExpense.category === 'fixed' || deletingExpense.parent_id)
                      ? 'Escopo de Exclusão de Despesa Fixa'
                      : 'Excluir Despesa Pontual'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(deletingExpense.is_fixed || deletingExpense.category === 'fixed' || deletingExpense.parent_id)
                      ? 'Esta é uma conta marcada como fixa. Como deseja excluí-la?'
                      : 'Confirme a exclusão desta despesa do mês atual.'}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setDeletingExpense(null)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {(deletingExpense.is_fixed || deletingExpense.category === 'fixed' || deletingExpense.parent_id) ? (
              <>
                <div className="mb-6 p-4 rounded-2xl bg-stone-50/80 border border-stone-200/70">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">Despesa selecionada:</span>
                    <span className="text-xs font-bold text-brand-dark">{formatCurrency(deletingExpense.amount)}</span>
                  </div>
                  <p className="font-bold text-sm text-brand-dark mt-1">"{deletingExpense.description}"</p>
                </div>

                {/* 3 Scope Options */}
                <div className="space-y-3 mb-6">
                  {/* Option 1: Remover apenas este mês */}
                  <button
                    type="button"
                    onClick={confirmDeleteOnlyThisMonth}
                    disabled={isUpdating}
                    className="w-full text-left p-4 rounded-2xl border border-stone-200/90 bg-stone-50/60 hover:bg-stone-100/80 transition-all group disabled:opacity-50 cursor-pointer select-none"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-stone-900 group-hover:text-emerald-800 transition-colors">
                        Remover apenas este mês ({currentMonthFormatted})
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-200/70 text-stone-700">
                        Este Mês
                      </span>
                    </div>
                    <span className="text-xs text-stone-600 block leading-relaxed">
                      A despesa será removida apenas no mês atual. Ela continuará sendo gerada normalmente em meses anteriores e futuros.
                    </span>
                  </button>

                  {/* Option 2: Excluir deste mês para frente */}
                  <button
                    type="button"
                    onClick={confirmDeleteFromMonthOnwards}
                    disabled={isUpdating}
                    className="w-full text-left p-4 rounded-2xl border border-amber-200/80 bg-amber-50/60 hover:bg-amber-100/70 transition-all group disabled:opacity-50 cursor-pointer select-none"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-amber-950 group-hover:text-amber-900 transition-colors">
                        Excluir deste mês para frente
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900">
                        Deste mês em diante
                      </span>
                    </div>
                    <span className="text-xs text-amber-800/90 block leading-relaxed">
                      Cancela as recorrências futuras a partir de {currentMonthFormatted}. As despesas de meses passados permanecerão intactas no histórico financeiro.
                    </span>
                  </button>

                  {/* Option 3: Excluir permanentemente todos os meses */}
                  <button
                    type="button"
                    onClick={confirmDeleteAllMonths}
                    disabled={isUpdating}
                    className="w-full text-left p-4 rounded-2xl border border-rose-200/80 bg-rose-50/50 hover:bg-rose-100/60 transition-all group disabled:opacity-50 cursor-pointer select-none"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-rose-950 group-hover:text-rose-900 transition-colors">
                        Excluir permanentemente (todos os meses)
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-900">
                        Definitivo
                      </span>
                    </div>
                    <span className="text-xs text-rose-800/90 block leading-relaxed">
                      Remove totalmente o registro principal e cancela as recorrências deste item de todos os meses (passados e futuros).
                    </span>
                  </button>
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setDeletingExpense(null)}
                    className="px-6 py-3 border border-stone-200 text-gray-500 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-50 transition-all"
                  >
                    Voltar / Manter Guardada
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                  Tem certeza que deseja excluir a despesa <strong>"{deletingExpense.description}"</strong> de <strong>{formatCurrency(deletingExpense.amount)}</strong>? Esta ação removerá a conta do mês atual.
                </p>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setDeletingExpense(null)}
                    className="flex-1 px-6 py-3.5 border border-stone-200 text-gray-500 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={confirmDeleteOnlyThisMonth}
                    disabled={isUpdating}
                    className="flex-1 px-6 py-3.5 bg-rose-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10 disabled:opacity-50"
                  >
                    {isUpdating ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};

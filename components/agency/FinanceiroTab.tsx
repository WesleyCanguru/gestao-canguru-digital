
import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  DollarSign, 
  TrendingUp, 
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
  Zap
} from 'lucide-react';
import { useAgencyFinanceiro } from '../../hooks/useAgencyFinanceiro';
import dayjs from 'dayjs';

export const FinanceiroTab: React.FC = () => {
  const [currentMonthYear, setCurrentMonthYear] = useState(dayjs().format('YYYY-MM'));
  const { billings, expenses, loading, updateBilling, deleteBilling, addExpense, updateExpense, deleteExpense } = useAgencyFinanceiro(currentMonthYear);
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
    amount: 0,
    due_day: 10,
    notes: ''
  });
  const [payingExpense, setPayingExpense] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const stats = useMemo(() => {
    const totalToReceive = billings.reduce((acc, b) => acc + (b.base_value + b.extra_value), 0);
    const totalReceived = billings.filter(b => b.status === 'paid').reduce((acc, b) => acc + (b.base_value + b.extra_value), 0);
    const totalOpen = totalToReceive - totalReceived;
    
    const totalFixedExpenses = expenses.filter(e => e.category === 'fixed').reduce((acc, e) => acc + e.amount, 0);
    const totalVariableExpenses = expenses.filter(e => e.category === 'variable').reduce((acc, e) => acc + e.amount, 0);
    const totalExpenses = totalFixedExpenses + totalVariableExpenses;
    
    const result = totalReceived - totalExpenses;

    return { totalToReceive, totalReceived, totalOpen, totalExpenses, totalFixedExpenses, totalVariableExpenses, result };
  }, [billings, expenses]);

  const sortedBillings = useMemo(() => {
    return [...billings].sort((a, b) => (a.due_day || 0) - (b.due_day || 0));
  }, [billings]);

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => {
      const dayA = a.due_date ? dayjs(a.due_date).date() : 99;
      const dayB = b.due_date ? dayjs(b.due_date).date() : 99;
      return dayA - dayB;
    });
  }, [expenses]);

  const handlePrevMonth = () => setCurrentMonthYear(dayjs(currentMonthYear).subtract(1, 'month').format('YYYY-MM'));
  const handleNextMonth = () => setCurrentMonthYear(dayjs(currentMonthYear).add(1, 'month').format('YYYY-MM'));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let due_date = null;
    if (newExpense.category === 'fixed') {
      due_date = dayjs(currentMonthYear).date(newExpense.due_day).format('YYYY-MM-DD');
    }

    await addExpense({ 
      description: newExpense.description,
      category: newExpense.category,
      expense_type: newExpense.expense_type,
      amount: newExpense.amount,
      month_year: currentMonthYear,
      due_date,
      paid: false,
      paid_at: null,
      notes: newExpense.notes,
      agency_id: 0 // Will be handled by hook
    });
    
    setShowExpenseModal(false);
    setNewExpense({ description: '', category: 'fixed', expense_type: 'tools', amount: 0, due_day: 10, notes: '' });
  };

  const handleMarkExpensePaid = async (expense: any, paidAt?: string) => {
    if (expense.category === 'variable' && !paidAt) {
      setPayingExpense(expense);
      return;
    }

    await updateExpense(expense.id, {
      paid: true,
      paid_at: paidAt || new Date().toISOString()
    });
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

  return (
    <div className="space-y-10">
      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark">Financeiro</h2>
          <p className="text-sm text-gray-500 mt-1">Gerencie fluxos, receitas e despesas da agência.</p>
        </div>
      </div>

      {/* Auxiliary Header with Month Selector */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-1 bg-white p-1 rounded-[2rem] border border-black/[0.03] shadow-sm">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-50 rounded-2xl transition-all text-gray-400 hover:text-brand-dark">
            <ChevronLeft size={16} />
          </button>
          <div className="px-5 py-1 text-center min-w-[140px]">
            <p className="text-[8px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-0.5">Período</p>
            <p className="text-xs font-bold text-brand-dark capitalize">
              {dayjs(currentMonthYear).format('MMMM YYYY')}
            </p>
          </div>
          <button onClick={handleNextMonth} className="p-2 hover:bg-gray-50 rounded-2xl transition-all text-gray-400 hover:text-brand-dark">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowSporadicModal(true)}
            className="flex justify-center items-center gap-2 px-6 py-3 bg-white text-brand-dark border border-black/[0.05] rounded-[2rem] font-bold text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm"
          >
            <Plus size={16} />
            Faturamento Esporádico
          </button>
          <button 
            onClick={() => setShowExpenseModal(true)}
            className="flex justify-center items-center gap-2 px-6 py-3 bg-brand-dark text-white rounded-[2rem] font-bold text-[10px] uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg shadow-brand-dark/10"
          >
            <Plus size={16} />
            Nova Despesa
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[
          { label: 'Total a Receber', value: stats.totalToReceive, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50/50' },
          { label: 'Total Recebido', value: stats.totalReceived, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
          { label: 'Total em Aberto', value: stats.totalOpen, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50/50' },
          { label: 'Total Fixas', value: stats.totalFixedExpenses, icon: Lock, color: 'text-indigo-600', bg: 'bg-indigo-50/50' },
          { label: 'Total Variáveis', value: stats.totalVariableExpenses, icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50/50' },
          { label: 'Resultado do Mês', value: stats.result, icon: TrendingUp, color: stats.result >= 0 ? 'text-emerald-600' : 'text-rose-600', bg: stats.result >= 0 ? 'bg-emerald-50/50' : 'bg-rose-50/50' },
        ].map((item, idx) => (
          <motion.div 
            key={idx}
            whileHover={{ y: -3, shadow: '0 15px 20px -5px rgba(0, 0, 0, 0.04)' }}
            className="bg-white p-6 rounded-[2rem] border border-black/[0.03] shadow-sm transition-all duration-300 flex items-center gap-5"
          >
            <div className={`w-12 h-12 ${item.bg} rounded-2xl flex-shrink-0 flex items-center justify-center ${item.color}`}>
              <item.icon size={22} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] font-bold mb-0.5 leading-tight">
                {item.label}
              </p>
              <h3 className={`text-2xl font-bold tracking-tight ${item.label === 'Resultado do Mês' ? item.color : 'text-brand-dark'}`}>
                {formatCurrency(item.value)}
              </h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Billings Table */}
      <div className="bg-white rounded-3xl border border-black/[0.03] shadow-[0_2px_15px_rgba(0,0,0,0.01)] overflow-hidden">
        <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-brand-dark">Faturamento por Cliente</h2>
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
                  onClick={() => setEditingBilling(billing)}
                  className="flex-1 p-2.5 text-blue-600 bg-blue-50/50 hover:bg-blue-100 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <Edit2 size={14} /> Editar
                </button>
                {billing.status !== 'paid' ? (
                  <button 
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
                        onClick={() => setEditingBilling(billing)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Editar Detalhes"
                      >
                        <Edit2 size={14} />
                      </button>
                      {billing.status !== 'paid' ? (
                        <button 
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

      {/* Expenses Section */}
      <div className="bg-white rounded-3xl border border-black/[0.03] shadow-[0_2px_15px_rgba(0,0,0,0.01)] overflow-hidden">
        <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
          <h2 className="text-lg font-bold text-brand-dark">Despesas da Agência</h2>
          <div className="flex items-center gap-2 text-rose-600 font-bold bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100/50">
            <span className="text-[10px] uppercase tracking-widest">Total:</span>
            <span className="text-lg sm:text-base">{formatCurrency(stats.totalExpenses)}</span>
          </div>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden p-4 space-y-4">
          {sortedExpenses.map((expense) => (
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

              <div className="flex flex-wrap gap-2 text-xs mb-1">
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
                {!expense.paid ? (
                  <button 
                    onClick={() => handleMarkExpensePaid(expense)}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all text-center"
                  >
                    Marcar Pago
                  </button>
                ) : (
                  <button 
                    onClick={() => updateExpense(expense.id, { paid: false, paid_at: null })}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-gray-200 text-center"
                  >
                    Estornar
                  </button>
                )}
                <button 
                  onClick={() => deleteExpense(expense.id)}
                  className="p-2.5 text-rose-600 bg-rose-50/50 hover:bg-rose-100 rounded-xl transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">Nenhuma despesa para este mês.</p>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/30">
                <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Descrição</th>
                <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Categoria</th>
                <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Valor</th>
                <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Vencimento</th>
                <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Status</th>
                <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-gray-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex flex-col min-w-[200px]">
                      <span className="font-bold text-sm text-brand-dark whitespace-normal leading-tight">{expense.description}</span>
                      {expense.notes && <span className="text-[10px] text-gray-400 mt-1 leading-relaxed">{expense.notes}</span>}
                    </div>
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
                      {!expense.paid ? (
                        <button 
                          onClick={() => handleMarkExpensePaid(expense)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10 whitespace-nowrap"
                        >
                          Marcar Pago
                        </button>
                      ) : (
                        <button 
                          onClick={() => updateExpense(expense.id, { paid: false, paid_at: null })}
                          className="px-4 py-2 bg-gray-50 text-gray-400 rounded-xl text-[9px] font-bold uppercase tracking-widest border border-gray-100 whitespace-nowrap hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all"
                        >
                          Estornar
                        </button>
                      )}
                      <button 
                        onClick={() => deleteExpense(expense.id)}
                        className="p-2 text-gray-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-gray-400 text-sm">
                    Nenhuma despesa cadastrada para este mês.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-dark/20 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl border border-black/[0.03]"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-brand-dark">Nova Despesa</h3>
              <button onClick={() => setShowExpenseModal(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Descrição</label>
                <input 
                  type="text" 
                  required
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium"
                  placeholder="Ex: Reportei"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Valor (R$)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium"
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Recorrência</label>
                  <select 
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as 'fixed' | 'variable' })}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium appearance-none"
                  >
                    <option value="fixed">Fixa</option>
                    <option value="variable">Variável</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Tipo de Despesa</label>
                <select 
                  value={newExpense.expense_type}
                  onChange={(e) => setNewExpense({ ...newExpense, expense_type: e.target.value as 'tools' | 'freelancers' | 'extras' })}
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium appearance-none"
                >
                  <option value="tools">Ferramentas</option>
                  <option value="freelancers">Freelancers</option>
                  <option value="extras">Custos Extras</option>
                </select>
              </div>

              {newExpense.category === 'fixed' && (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Dia de Vencimento</label>
                  <input 
                    type="number" 
                    required min={1} max={31}
                    value={newExpense.due_day}
                    onChange={(e) => setNewExpense({ ...newExpense, due_day: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium"
                    placeholder="Ex: 15"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Notas</label>
                <textarea 
                  value={newExpense.notes}
                  onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-600 transition-all outline-none text-sm font-medium resize-none"
                  rows={2}
                  placeholder="Observações..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-100 text-gray-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 bg-brand-dark text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg shadow-brand-dark/10"
                >
                  Salvar
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
    </div>
  );
};

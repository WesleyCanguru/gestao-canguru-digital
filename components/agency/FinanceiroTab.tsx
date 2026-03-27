
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
  X
} from 'lucide-react';
import { useAgencyFinanceiro } from '../../hooks/useAgencyFinanceiro';
import dayjs from 'dayjs';

export const FinanceiroTab: React.FC = () => {
  const [currentMonthYear, setCurrentMonthYear] = useState(dayjs().format('YYYY-MM'));
  const { billings, expenses, loading, updateBilling, addExpense, updateExpense, deleteExpense } = useAgencyFinanceiro(currentMonthYear);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingBilling, setEditingBilling] = useState<any>(null);
  const [newExpense, setNewExpense] = useState({ 
    description: '', 
    category: 'fixed' as 'fixed' | 'variable', 
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
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const result = totalReceived - totalExpenses;

    return { totalToReceive, totalReceived, totalOpen, totalExpenses, result };
  }, [billings, expenses]);

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
      amount: newExpense.amount,
      month_year: currentMonthYear,
      due_date,
      paid: false,
      paid_at: null,
      notes: newExpense.notes
    });
    
    setShowExpenseModal(false);
    setNewExpense({ description: '', category: 'fixed', amount: 0, due_day: 10, notes: '' });
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
      return <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-widest">Pago</span>;
    }
    
    const today = dayjs();
    // Get the due date for the specific month/year of the billing
    const billingDate = dayjs(billing.month_year).date(billing.due_day);
    const isOverdue = today.isAfter(billingDate, 'day');
    
    if (isOverdue || billing.status === 'overdue') {
      return <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-widest">Atrasado</span>;
    }
    
    return <span className="px-3 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full uppercase tracking-widest">Pendente</span>;
  };

  const getExpenseStatusBadge = (expense: any) => {
    if (expense.paid) {
      return <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-widest">Pago</span>;
    }
    
    if (expense.category === 'fixed' && expense.due_date) {
      const today = dayjs();
      const dueDate = dayjs(expense.due_date);
      if (today.isAfter(dueDate, 'day')) {
        return <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-widest">Atrasado</span>;
      }
    }
    
    return <span className="px-3 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full uppercase tracking-widest">Pendente</span>;
  };

  return (
    <div className="space-y-10">
      {/* Header with Month Selector */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-black/[0.03] shadow-sm">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-brand-dark">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3 px-4">
            <Calendar size={18} className="text-blue-600" />
            <span className="text-lg font-bold text-brand-dark uppercase tracking-widest">
              {dayjs(currentMonthYear).format('MMMM YYYY')}
            </span>
          </div>
          <button onClick={handleNextMonth} className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-brand-dark">
            <ChevronRight size={20} />
          </button>
        </div>

        <button 
          onClick={() => setShowExpenseModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-brand-dark text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-brand-dark/10"
        >
          <Plus size={18} />
          Adicionar Despesa
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2rem] border border-black/[0.03] shadow-sm">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-6">
            <DollarSign size={24} />
          </div>
          <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Total a Receber</p>
          <h3 className="text-2xl font-bold text-brand-dark">{formatCurrency(stats.totalToReceive)}</h3>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-black/[0.03] shadow-sm">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 mb-6">
            <CheckCircle2 size={24} />
          </div>
          <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Total Recebido</p>
          <h3 className="text-2xl font-bold text-brand-dark">{formatCurrency(stats.totalReceived)}</h3>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-black/[0.03] shadow-sm">
          <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center text-yellow-600 mb-6">
            <AlertCircle size={24} />
          </div>
          <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Total em Aberto</p>
          <h3 className="text-2xl font-bold text-brand-dark">{formatCurrency(stats.totalOpen)}</h3>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-black/[0.03] shadow-sm">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${stats.result >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'}`}>
            <TrendingUp size={24} />
          </div>
          <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Resultado do Mês</p>
          <h3 className={`text-2xl font-bold ${stats.result >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>{formatCurrency(stats.result)}</h3>
        </div>
      </div>

      {/* Billings Table */}
      <div className="bg-white rounded-[2.5rem] border border-black/[0.03] shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-brand-dark">Faturamento por Cliente</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Cliente</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Valor Base</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Extras</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Total</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Vencimento</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Notas</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Status</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {billings.map((billing) => (
                <tr key={billing.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: billing.client?.color }}>
                        {billing.client?.initials}
                      </div>
                      <span className="font-bold text-brand-dark">{billing.client?.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-medium text-brand-dark">{formatCurrency(billing.base_value)}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-medium text-brand-dark">{formatCurrency(billing.extra_value)}</span>
                  </td>
                  <td className="px-8 py-6 font-bold text-brand-dark">
                    {formatCurrency(billing.base_value + billing.extra_value)}
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-gray-500 font-medium">Dia {billing.due_day}</span>
                  </td>
                  <td className="px-8 py-6">
                    <input 
                      type="text" 
                      placeholder="Nota rápida..."
                      defaultValue={billing.notes || ''}
                      onBlur={(e) => updateBilling({ id: billing.id, client_id: billing.client_id, month_year: currentMonthYear, notes: e.target.value })}
                      className="w-32 bg-transparent border-b border-gray-100 focus:border-blue-600 outline-none text-xs text-gray-500 italic py-1"
                    />
                  </td>
                  <td className="px-8 py-6">{getStatusBadge(billing)}</td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setEditingBilling(billing)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Editar Detalhes"
                      >
                        <Edit2 size={16} />
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
                          className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 whitespace-nowrap"
                        >
                          Marcar Pago
                        </button>
                      ) : (
                        <div className="px-4 py-2 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-gray-100 whitespace-nowrap">
                          Recebido
                        </div>
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
      <div className="bg-white rounded-[2.5rem] border border-black/[0.03] shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-brand-dark">Despesas da Agência</h2>
          <div className="flex items-center gap-2 text-red-600 font-bold">
            <span className="text-sm uppercase tracking-widest">Total:</span>
            <span>{formatCurrency(stats.totalExpenses)}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Descrição</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Categoria</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Valor</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Vencimento</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Status</th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-brand-dark">{expense.description}</span>
                      {expense.notes && <span className="text-[10px] text-gray-400 italic">{expense.notes}</span>}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${expense.category === 'fixed' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                      {expense.category === 'fixed' ? 'Fixa' : 'Variável'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-bold text-brand-dark">{formatCurrency(expense.amount)}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-gray-500 font-medium">
                      {expense.category === 'fixed' ? (expense.due_date ? dayjs(expense.due_date).format('DD/MM') : '-') : '-'}
                    </span>
                  </td>
                  <td className="px-8 py-6">{getExpenseStatusBadge(expense)}</td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      {!expense.paid ? (
                        <button 
                          onClick={() => handleMarkExpensePaid(expense)}
                          className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 whitespace-nowrap"
                        >
                          Marcar Pago
                        </button>
                      ) : (
                        <button 
                          onClick={() => updateExpense(expense.id, { paid: false, paid_at: null })}
                          className="px-4 py-2 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-gray-100 whitespace-nowrap hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                        >
                          Estornar
                        </button>
                      )}
                      <button 
                        onClick={() => deleteExpense(expense.id)}
                        className="p-2 text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-gray-400">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold text-brand-dark">Nova Despesa</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
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
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  placeholder="Ex: Reportei"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Valor (R$)</label>
                  <input 
                    type="number" 
                    required
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Categoria</label>
                  <select 
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as 'fixed' | 'variable' })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  >
                    <option value="fixed">Fixa</option>
                    <option value="variable">Variável</option>
                  </select>
                </div>
              </div>

              {newExpense.category === 'fixed' && (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Dia de Vencimento</label>
                  <input 
                    type="number" 
                    required min={1} max={31}
                    value={newExpense.due_day}
                    onChange={(e) => setNewExpense({ ...newExpense, due_day: Number(e.target.value) })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Notas</label>
                <input 
                  type="text" 
                  value={newExpense.notes}
                  onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  placeholder="Observações..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-brand-dark text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-brand-dark/10"
                >
                  Salvar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Billing Edit Modal */}
      {editingBilling && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-bold text-brand-dark">Editar Faturamento</h3>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{editingBilling.client?.name}</p>
              </div>
              <button onClick={() => setEditingBilling(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
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
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Extras (R$)</label>
                  <input 
                    type="number" 
                    required
                    value={editingBilling.extra_value}
                    onChange={(e) => setEditingBilling({ ...editingBilling, extra_value: Number(e.target.value) })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Dia Vencimento</label>
                  <input 
                    type="number" 
                    required min={1} max={31}
                    value={editingBilling.due_day}
                    onChange={(e) => setEditingBilling({ ...editingBilling, due_day: Number(e.target.value) })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Status</label>
                  <select 
                    value={editingBilling.status}
                    onChange={(e) => setEditingBilling({ ...editingBilling, status: e.target.value as any })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
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
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium h-24 resize-none"
                  placeholder="Ex: Pago via Pix, desconto aplicado..."
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setEditingBilling(null)}
                  className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-4 bg-brand-dark text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-brand-dark/10 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-brand-dark mb-6 text-center">Data de Pagamento</h3>
            <div className="space-y-6">
              <input 
                type="date"
                defaultValue={dayjs().format('YYYY-MM-DD')}
                id="payment-date"
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => setPayingExpense(null)}
                  className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    const date = (document.getElementById('payment-date') as HTMLInputElement).value;
                    handleMarkExpensePaid(payingExpense, dayjs(date).toISOString());
                  }}
                  className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-green-700 transition-all shadow-xl shadow-green-600/10"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

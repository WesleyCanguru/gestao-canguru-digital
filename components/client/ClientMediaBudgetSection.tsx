import React, { useState, useEffect } from 'react';
import { Client } from '../../types';
import { useMediaBudgets } from '../../hooks/useMediaBudgets';
import { parseCurrencyInput, formatCurrency } from '../../lib/currencyUtils';
import { DollarSign, Save, Calendar, Check, Loader2, History, TrendingUp } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

interface ClientMediaBudgetSectionProps {
  client: Client;
  onSaved?: () => void;
}

export const ClientMediaBudgetSection: React.FC<ClientMediaBudgetSectionProps> = ({ client, onSaved }) => {
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(dayjs().format('YYYY-MM'));
  const { 
    budgets, 
    budgetHistory, 
    saveBudget, 
    loading, 
    fetchBudgetHistory, 
    fetchClientBudgets 
  } = useMediaBudgets(client.id, selectedMonthYear);

  // Raw text input state to allow fluid typing of any number (e.g. 3500, 1500.50, 3.500,00)
  const [inputValue, setInputValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);

  // Sync input value whenever budgets or selectedMonthYear changes
  useEffect(() => {
    // Find budget for this month (prioritize 'total', fallback to sum of platform budgets if any)
    const totalBudgetRecord = budgets.find(b => b.platform === 'total');
    let currentAmount = 0;
    
    if (totalBudgetRecord) {
      currentAmount = Number(totalBudgetRecord.budget_amount) || 0;
    } else if (budgets.length > 0) {
      currentAmount = budgets.reduce((acc, b) => acc + (Number(b.budget_amount) || 0), 0);
    }

    if (currentAmount > 0) {
      // Format initial value without forcing format on every keystroke
      setInputValue(currentAmount.toString());
    } else {
      setInputValue('');
    }
  }, [budgets, selectedMonthYear]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setIsJustSaved(false);

    const numericAmount = parseCurrencyInput(inputValue);
    const res = await saveBudget(numericAmount, selectedMonthYear);

    setIsSaving(false);
    if (res.success) {
      setIsJustSaved(true);
      setTimeout(() => setIsJustSaved(false), 2500);
      onSaved?.();
      fetchBudgetHistory();
      fetchClientBudgets();
    }
  };

  const parsedPreview = parseCurrencyInput(inputValue);
  const formattedMonth = dayjs(selectedMonthYear + '-01').locale('pt-br').format('MMMM [de] YYYY');

  return (
    <div className="bg-stone-50/70 border border-stone-200/80 rounded-2xl p-5 sm:p-6 space-y-6">
      {/* Header com Título e Seletor de Mês */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/60 pb-4">
        <div>
          <h3 className="text-sm font-bold text-[#13284D] uppercase tracking-wider flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-600" />
            Verba de Mídia
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Defina a verba mensal única acordada com o cliente para tráfego pago
          </p>
        </div>

        {/* Seletor de Mês/Ano */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-2xs">
          <Calendar size={14} className="text-stone-400" />
          <span className="text-xs font-semibold text-stone-500">Mês:</span>
          <input
            type="month"
            value={selectedMonthYear}
            onChange={(e) => setSelectedMonthYear(e.target.value)}
            className="bg-transparent text-xs font-bold text-stone-800 focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Formulário de Verba Única */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex-1 max-w-md">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Verba de Mídia ({formattedMonth})
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 font-bold text-sm">
                  R$
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-base font-bold text-stone-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:bg-white focus:border-emerald-500 transition-all"
                />
              </div>
              {inputValue.trim() !== '' && (
                <p className="text-xs text-stone-500 mt-1.5 flex items-center gap-1 font-medium">
                  <span>Valor reconhecido:</span>
                  <strong className="text-emerald-700 font-mono">{formatCurrency(parsedPreview)}</strong>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving || loading}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer h-11 shrink-0 ${
                isJustSaved
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-2xs'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : isJustSaved ? (
                <>
                  <Check size={16} className="text-emerald-700" />
                  <span>Salvo com Sucesso!</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Salvar Verba</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Histórico dos Últimos 6 Meses */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-[#13284D] uppercase tracking-wider flex items-center gap-1.5">
            <History size={14} className="text-stone-400" />
            <span>Histórico de Verbas (Últimos 6 Meses)</span>
          </h4>
          <span className="text-[11px] text-stone-400 font-medium">
            Registrado por mês
          </span>
        </div>

        {budgetHistory.length === 0 ? (
          <div className="bg-white rounded-xl p-4 border border-stone-200 text-center text-xs text-stone-400">
            Nenhuma verba cadastrada anteriormente para este cliente.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-100 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Mês</th>
                    <th className="py-2.5 px-4 text-right">Verba Cadastrada</th>
                    <th className="py-2.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {budgetHistory.map((item) => {
                    const monthDate = dayjs(item.month_year + '-01');
                    const monthName = monthDate.isValid() 
                      ? monthDate.locale('pt-br').format('MMM YYYY')
                      : item.month_year;
                    
                    const isCurrentSelection = item.month_year === selectedMonthYear;

                    return (
                      <tr 
                        key={item.id || item.month_year} 
                        className={`hover:bg-stone-50/60 transition-colors ${
                          isCurrentSelection ? 'bg-emerald-50/40 font-semibold' : ''
                        }`}
                      >
                        <td className="py-3 px-4 capitalize font-semibold text-stone-800">
                          {monthName}
                          {isCurrentSelection && (
                            <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                              Selecionado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#13284D]">
                          {formatCurrency(item.budget_amount)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedMonthYear(item.month_year)}
                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
                          >
                            Carregar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


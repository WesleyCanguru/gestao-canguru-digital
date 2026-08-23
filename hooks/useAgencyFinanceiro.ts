
import { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { AgencyBilling, AgencyExpense } from '../types';
import { parseExpenseRow, filterExpensesForMonth } from '../lib/expenses';
import dayjs from 'dayjs';

export interface MonthFinancialSummary {
  monthYear: string;
  monthLabel: string;
  revenue: number;
  revenueReceived: number;
  expenses: number;
  expensesPaid: number;
  profit: number;
  profitRealized: number;
  margin: number;
}

export function useAgencyFinanceiro(monthYear: string) {
  const { agencyId } = useAuth();
  const [billings, setBillings] = useState<AgencyBilling[]>([]);
  const [expenses, setExpenses] = useState<AgencyExpense[]>([]);
  const [rawExpenses, setRawExpenses] = useState<AgencyExpense[]>([]);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [faturamentoAcumulado, setFaturamentoAcumulado] = useState(0);
  const [history, setHistory] = useState<MonthFinancialSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      // Fetch Clients for calculations (both active, completed, cancelled)
      const { data: clientsForCalcs } = await supabase
        .from('clients')
        .select('id, base_value, created_at, updated_at, client_status, service_end_date, client_type, is_internal')
        .eq('agency_id', agencyId)
        .neq('is_internal', true)
        .in('client_status', ['active', 'completed', 'cancelled']);

      // Calculate Ticket Médio (only active and recurring clients)
      const activeRecurringClients = (clientsForCalcs || []).filter((c: any) => c.client_status === 'active' && c.client_type === 'recurring');
      const totalActiveBaseValue = activeRecurringClients.reduce((sum: number, c: any) => sum + (Number(c.base_value) || 0), 0);
      const computedTicketMedio = activeRecurringClients.length > 0 ? totalActiveBaseValue / activeRecurringClients.length : 0;

      // Calculate Faturamento Acumulado no Ano
      const anoAtual = dayjs().year();
      const mesAtual = dayjs().month() + 1; // 1-12

      let computedFaturamentoAcumulado = 0;

      for (const client of (clientsForCalcs || []) as any[]) {
        if (!client.base_value) continue;
        
        const criacao = dayjs(client.created_at);
        const anoCriacao = criacao.year();
        const mesCriacao = criacao.month() + 1;
        
        // Mês de início no ano atual
        const mesInicio = anoCriacao < anoAtual ? 1 : mesCriacao;
        
        // Mês de fim
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
        computedFaturamentoAcumulado += (Number(client.base_value) || 0) * mesesAtivos;
      }

      setTicketMedio(computedTicketMedio);
      setFaturamentoAcumulado(computedFaturamentoAcumulado);
      
      // Fetch Clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*, contract:contract_forms(contract_start_date)')
        .eq('agency_id', agencyId)
        .neq('is_internal', true)
        .order('name');

      const clients = (clientsData || []).filter(c => {
        if (c.is_internal) return false;
        if (c.client_status !== 'cancelled') return true;
        if (!c.cancelled_at) return false;
        const cancelMonthYear = dayjs(c.cancelled_at).format('YYYY-MM');
        return monthYear <= cancelMonthYear;
      }) as any[];

      // Fetch Billings for the month
      const { data: billingsData } = await supabase
        .from('agency_billing')
        .select('*, client:clients(*)')
        .eq('agency_id', agencyId)
        .eq('month_year', monthYear);

      // Fetch all Billings of current and past months for historical chart
      const { data: allYearBillingsData } = await supabase
        .from('agency_billing')
        .select('*, client:clients(*)')
        .eq('agency_id', agencyId);

      let currentBillings = ((billingsData || []) as AgencyBilling[]).filter(b => {
        if (b.is_sporadic) return true;
        const c = b.client as any;
        if (c?.is_internal) return false;
        if (c && c.client_status === 'cancelled') {
          if (!c.cancelled_at) return false;
          const cancelMonthYear = dayjs(c.cancelled_at).format('YYYY-MM');
          return monthYear <= cancelMonthYear;
        }
        return true;
      });

      const existingClientIds = new Set(currentBillings.filter(b => !b.is_sporadic).map(b => b.client_id));
      
      const missingClients = clients.filter(c => {
        if (existingClientIds.has(c.id)) return false;
        
        let startDate = c.created_at;
        if (c.contract && c.contract.length > 0 && c.contract[0].contract_start_date) {
            startDate = c.contract[0].contract_start_date;
        }

        if (!startDate) return true;

        const clientStartMonth = dayjs(startDate).format('YYYY-MM');
        return clientStartMonth <= monthYear;
      });

      const placeholderBillings: AgencyBilling[] = missingClients.map(c => ({
        id: `temp-${c.id}`,
        client_id: c.id,
        month_year: monthYear,
        base_value: c.base_value || 0,
        extra_value: 0,
        total_value: 0,
        due_day: c.due_day || 10,
        status: 'pending',
        notes: null,
        paid_at: null,
        created_at: new Date().toISOString(),
        client: c,
        is_sporadic: false,
        agency_id: agencyId!
      }));

      setBillings([...currentBillings, ...placeholderBillings]);

      // Fetch all non-deleted Expenses for agency
      const { data: rawExpensesData } = await supabase
        .from('agency_expenses')
        .select('id, description, category, amount, month_year, notes, due_date, paid, paid_at, expense_type, is_deleted, is_fixed, origin, due_day, parent_id, cancelled_from, agency_id, created_at')
        .eq('agency_id', agencyId)
        .not('is_deleted', 'is', true)
        .order('created_at', { ascending: false });

      const parsedAll = (rawExpensesData || []).map(parseExpenseRow);
      setRawExpenses(parsedAll);

      const monthExpenses = filterExpensesForMonth(parsedAll, monthYear);
      setExpenses(monthExpenses);

      // Compute multi-month historical summaries (e.g. for last 6 to 12 months)
      const selectedDate = dayjs(monthYear);
      const monthsList: string[] = [];
      for (let i = 5; i >= 0; i--) {
        monthsList.push(selectedDate.subtract(i, 'month').format('YYYY-MM'));
      }

      const allYearBillings = (allYearBillingsData || []) as AgencyBilling[];
      const computedHistory = monthsList.map(mStr => {
        const mDate = dayjs(mStr);
        const mLabel = `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][mDate.month()]} ${mDate.format('YY')}`;
        
        // Month billings
        const mExplicitBillings = allYearBillings.filter(b => b.month_year === mStr && (!b.client || !(b.client as any).is_internal));
        const explicitClientIds = new Set(mExplicitBillings.filter(b => !b.is_sporadic).map(b => b.client_id));
        
        const mActiveClients = clients.filter(c => {
          if (c.client_status === 'cancelled' && c.cancelled_at && dayjs(c.cancelled_at).format('YYYY-MM') < mStr) {
            return false;
          }
          let startDate = c.created_at;
          if (c.contract && c.contract.length > 0 && c.contract[0].contract_start_date) {
            startDate = c.contract[0].contract_start_date;
          }
          if (startDate && dayjs(startDate).format('YYYY-MM') > mStr) return false;
          return true;
        });

        const missingInMonth = mActiveClients.filter(c => !explicitClientIds.has(c.id));
        const totalBaseMissing = missingInMonth.reduce((sum, c) => sum + (Number(c.base_value) || 0), 0);
        
        const explicitTotal = mExplicitBillings.reduce((sum, b) => sum + (Number(b.base_value || 0) + Number(b.extra_value || 0)), 0);
        const explicitReceived = mExplicitBillings.filter(b => b.status === 'paid').reduce((sum, b) => sum + (Number(b.base_value || 0) + Number(b.extra_value || 0)), 0);

        const totalRevenue = explicitTotal + totalBaseMissing;
        const totalRevenueReceived = explicitReceived;

        // Month expenses
        const mExp = filterExpensesForMonth(parsedAll, mStr);
        const totalExp = mExp.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const totalExpPaid = mExp.filter(e => e.paid).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        const profit = totalRevenue - totalExp;
        const profitRealized = totalRevenueReceived - totalExpPaid;
        const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

        return {
          monthYear: mStr,
          monthLabel: mLabel,
          revenue: totalRevenue,
          revenueReceived: totalRevenueReceived,
          expenses: totalExp,
          expensesPaid: totalExpPaid,
          profit,
          profitRealized,
          margin
        };
      });

      setHistory(computedHistory);
    } catch (error) {
      console.error('Error fetching financeiro data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [monthYear, agencyId]);

  const updateBilling = async (billing: Partial<AgencyBilling> & { update_global_contract?: boolean }) => {
    try {
      if (!agencyId) return;

      const existing = billings.find(b => {
        if (billing.id && b.id === billing.id) return true;
        if (billing.client_id && b.client_id === billing.client_id && !b.is_sporadic) return true;
        return false;
      });
      
      const base = billing.base_value !== undefined ? Number(billing.base_value) : (existing?.base_value || 0);
      const extra = billing.extra_value !== undefined ? Number(billing.extra_value) : (existing?.extra_value || 0);
      const total = base + extra;

      let newStatus = billing.status || existing?.status || 'pending';
      let paidAt = billing.paid_at !== undefined ? billing.paid_at : (existing?.paid_at || null);
      if (newStatus === 'paid' && !paidAt) {
        paidAt = new Date().toISOString();
      } else if (newStatus === 'pending' || newStatus === 'overdue') {
        paidAt = null;
      }

      const dbData = {
        client_id: billing.client_id || existing?.client_id || null,
        month_year: billing.month_year || existing?.month_year || monthYear,
        base_value: base,
        extra_value: extra,
        total_value: total,
        due_day: billing.due_day !== undefined ? billing.due_day : (existing?.due_day || 10),
        status: newStatus,
        notes: billing.notes !== undefined ? billing.notes : (existing?.notes || null),
        paid_at: paidAt,
        is_sporadic: billing.is_sporadic !== undefined ? billing.is_sporadic : (existing?.is_sporadic || false),
        sporadic_name: billing.sporadic_name !== undefined ? billing.sporadic_name : (existing?.sporadic_name || null),
        agency_id: agencyId
      };

      let existingDbId = (billing.id && !billing.id.startsWith('temp-')) ? billing.id : null;

      // If no valid DB ID, check if record already exists in database to prevent duplicates/errors
      if (!existingDbId && dbData.client_id && !dbData.is_sporadic) {
        const { data: found } = await supabase
          .from('agency_billing')
          .select('id')
          .eq('agency_id', agencyId)
          .eq('client_id', dbData.client_id)
          .eq('month_year', dbData.month_year)
          .limit(1);

        if (found && found.length > 0) {
          existingDbId = found[0].id;
        }
      }

      let savedRecord: AgencyBilling | null = null;

      if (!existingDbId) {
        const { data, error } = await supabase
          .from('agency_billing')
          .insert([dbData])
          .select('*, client:clients(*)');
        
        if (error) throw error;
        if (data && data.length > 0) {
          savedRecord = data[0];
        }
      } else {
        const { data, error } = await supabase
          .from('agency_billing')
          .update(dbData)
          .eq('agency_id', agencyId)
          .eq('id', existingDbId)
          .select('*, client:clients(*)');

        if (error) throw error;
        if (data && data.length > 0) {
          savedRecord = data[0];
        }
      }

      if (savedRecord) {
        const fullRecord: AgencyBilling = {
          ...savedRecord,
          client: savedRecord.client || existing?.client || billing.client
        };
        setBillings(prev => {
          const matchIndex = prev.findIndex(b => 
            b.id === fullRecord.id || 
            (fullRecord.client_id && b.client_id === fullRecord.client_id && !b.is_sporadic)
          );
          if (matchIndex > -1) {
            const next = [...prev];
            next[matchIndex] = fullRecord;
            return next;
          }
          return [...prev, fullRecord];
        });
      }

      // If user explicitly checked to update global contract
      if (dbData.client_id && !dbData.is_sporadic && billing.update_global_contract === true) {
        try {
          const { data: clientData } = await supabase
            .from('clients')
            .select('features_settings')
            .eq('id', dbData.client_id)
            .single();

          const currentFeatures = clientData?.features_settings || {};
          const clientHistory = currentFeatures.value_history || [];
          
          const monthYearToUpdate = dbData.month_year;
          const existingClientEntryIndex = clientHistory.findIndex((h: any) => h.date === monthYearToUpdate);
          
          if (existingClientEntryIndex > -1) {
            clientHistory[existingClientEntryIndex].value = dbData.base_value;
          } else {
            clientHistory.push({ date: monthYearToUpdate, value: dbData.base_value });
          }
          clientHistory.sort((a: any, b: any) => a.date.localeCompare(b.date));

          const updatedFeatures = {
            ...currentFeatures,
            value_history: clientHistory
          };

          await supabase
            .from('clients')
            .update({
              base_value: dbData.base_value,
              due_day: dbData.due_day,
              features_settings: updatedFeatures
            })
            .eq('agency_id', agencyId)
            .eq('id', dbData.client_id);

          const { data: contractData } = await supabase
            .from('contract_forms')
            .select('*')
            .eq('client_id', dbData.client_id)
            .eq('status', 'signed')
            .limit(1);

          if (contractData && contractData.length > 0) {
            const contract = contractData[0];
            const formData = contract.form_data || {};
            const history = formData.value_history || [];
            
            const existingEntryIndex = history.findIndex((h: any) => h.date === monthYearToUpdate);
            
            if (existingEntryIndex > -1) {
              history[existingEntryIndex].value = dbData.base_value;
            } else {
              history.push({ date: monthYearToUpdate, value: dbData.base_value });
            }
            
            history.sort((a: any, b: any) => a.date.localeCompare(b.date));
            
            await supabase
              .from('contract_forms')
              .update({
                contract_value: dbData.base_value,
                form_data: { ...formData, value_history: history }
              })
              .eq('id', contract.id);
          }
        } catch (globalErr) {
          console.warn('Non-fatal: could not sync global contract data:', globalErr);
        }
      }
    } catch (error) {
      console.error('Error updating billing:', error);
      throw error;
    }
  };

  const addExpense = async (expense: Omit<AgencyExpense, 'id' | 'created_at'>) => {
    try {
      const isFixed = expense.category === 'fixed' || expense.is_fixed === true;
      const currentMonth = expense.month_year || monthYear;
      const dueDay = expense.due_day ? Number(expense.due_day) : 10;
      const origin = expense.origin || 'canguru';

      if (isFixed) {
        // Criar a despesa-mãe (mês atual)
        const { data: parent, error: parentError } = await supabase
          .from('agency_expenses')
          .insert([{
            description: expense.description,
            amount: expense.amount,
            category: 'fixed',
            expense_type: expense.expense_type || 'tools',
            is_fixed: true,
            origin,
            due_day: dueDay,
            due_date: expense.due_date || null,
            month_year: currentMonth,
            notes: expense.notes || null,
            agency_id: agencyId,
            paid: expense.paid || false,
            paid_at: expense.paid_at || null,
            is_deleted: false
          }])
          .select('id')
          .single();

        if (parentError) throw parentError;

        // Criar instâncias para os próximos 11 meses
        const instances = [];
        for (let i = 1; i <= 11; i++) {
          const nextMonthStr = dayjs(currentMonth, 'YYYY-MM').add(i, 'month').format('YYYY-MM');
          const nextDueDate = dayjs(nextMonthStr, 'YYYY-MM').date(dueDay).format('YYYY-MM-DD');
          instances.push({
            description: expense.description,
            amount: expense.amount,
            category: 'fixed',
            expense_type: expense.expense_type || 'tools',
            is_fixed: true,
            origin,
            due_day: dueDay,
            due_date: nextDueDate,
            month_year: nextMonthStr,
            parent_id: parent.id,
            agency_id: agencyId,
            notes: expense.notes || null,
            paid: false,
            paid_at: null,
            is_deleted: false
          });
        }
        await supabase.from('agency_expenses').insert(instances);
      } else {
        const { data, error } = await supabase
          .from('agency_expenses')
          .insert([{
            description: expense.description,
            category: 'variable',
            expense_type: expense.expense_type || 'tools',
            amount: expense.amount,
            month_year: currentMonth,
            due_date: expense.due_date || null,
            due_day: dueDay,
            paid: expense.paid || false,
            paid_at: expense.paid_at || null,
            notes: expense.notes || null,
            agency_id: agencyId,
            is_fixed: false,
            origin,
            is_deleted: false
          }])
          .select()
          .single();

        if (error) throw error;
      }

      await fetchData();
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  };

  const updateExpense = async (id: string, updates: Partial<AgencyExpense>) => {
    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.expense_type !== undefined) dbUpdates.expense_type = updates.expense_type;
      if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
      if (updates.due_date !== undefined) dbUpdates.due_date = updates.due_date;
      if (updates.due_day !== undefined) dbUpdates.due_day = updates.due_day;
      if (updates.paid !== undefined) dbUpdates.paid = updates.paid;
      if (updates.paid_at !== undefined) dbUpdates.paid_at = updates.paid_at;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.is_fixed !== undefined) dbUpdates.is_fixed = updates.is_fixed;
      dbUpdates.origin = updates.origin ?? 'canguru';

      const { error } = await supabase
        .from('agency_expenses')
        .update(dbUpdates)
        .eq('agency_id', agencyId)
        .eq('id', id);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  };

  const overrideExpenseForMonth = async (
    targetExpense: AgencyExpense,
    editedData: {
      description: string;
      amount: number;
      category?: 'fixed' | 'variable';
      expense_type?: 'tools' | 'freelancers' | 'extras';
      due_date?: string | null;
      notes?: string | null;
      paid?: boolean;
      paid_at?: string | null;
      origin?: string | null;
      due_day?: number;
    },
    targetMonthYear: string = monthYear
  ) => {
    try {
      if (!agencyId) return;

      const dbUpdates: Record<string, any> = {
        description: editedData.description,
        amount: editedData.amount,
        category: editedData.category || 'fixed',
        expense_type: editedData.expense_type,
        due_date: editedData.due_date,
        due_day: editedData.due_day,
        notes: editedData.notes,
        origin: editedData.origin ?? 'canguru',
        paid: editedData.paid,
        paid_at: editedData.paid_at
      };

      await supabase
        .from('agency_expenses')
        .update(dbUpdates)
        .eq('agency_id', agencyId)
        .eq('id', targetExpense.id);

      await fetchData();
    } catch (error) {
      console.error('Error overriding expense:', error);
      throw error;
    }
  };

  const updateMotherExpenseAllMonths = async (
    targetExpense: AgencyExpense,
    editedData: {
      description: string;
      amount: number;
      category: 'fixed' | 'variable';
      expense_type?: 'tools' | 'freelancers' | 'extras';
      due_date?: string | null;
      notes?: string | null;
      paid?: boolean;
      paid_at?: string | null;
      origin?: string | null;
      due_day?: number;
    }
  ) => {
    try {
      if (!agencyId) return;
      const baseId = targetExpense.parent_id ?? targetExpense.id;

      const dbUpdates: Record<string, any> = {
        description: editedData.description,
        amount: editedData.amount,
        category: 'fixed',
        is_fixed: true,
        expense_type: editedData.expense_type,
        due_day: editedData.due_day,
        notes: editedData.notes,
        origin: editedData.origin ?? 'canguru'
      };
      if (editedData.due_date !== undefined) dbUpdates.due_date = editedData.due_date;

      const { error } = await supabase
        .from('agency_expenses')
        .update(dbUpdates)
        .eq('agency_id', agencyId)
        .or(`id.eq.${baseId},parent_id.eq.${baseId}`);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error updating mother expense:', error);
      throw error;
    }
  };

  const updateExpenseFromMonthOnwards = async (
    targetExpense: AgencyExpense,
    editedData: {
      description: string;
      amount: number;
      category: 'fixed' | 'variable';
      expense_type?: 'tools' | 'freelancers' | 'extras';
      due_date?: string | null;
      notes?: string | null;
      paid?: boolean;
      paid_at?: string | null;
      origin?: string | null;
      due_day?: number;
    },
    targetMonthYear: string = monthYear
  ) => {
    try {
      if (!agencyId) return;
      const baseId = targetExpense.parent_id ?? targetExpense.id;

      const dbUpdates: Record<string, any> = {
        description: editedData.description,
        amount: editedData.amount,
        category: 'fixed',
        is_fixed: true,
        expense_type: editedData.expense_type,
        due_day: editedData.due_day,
        notes: editedData.notes,
        origin: editedData.origin ?? 'canguru'
      };
      if (editedData.due_date !== undefined) dbUpdates.due_date = editedData.due_date;

      const { error } = await supabase
        .from('agency_expenses')
        .update(dbUpdates)
        .eq('agency_id', agencyId)
        .or(`id.eq.${baseId},parent_id.eq.${baseId}`)
        .gte('month_year', targetMonthYear);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error updating expense from month onwards:', error);
      throw error;
    }
  };

  const deleteExpenseForMonth = async (targetExpense: AgencyExpense, targetMonthYear: string = monthYear) => {
    try {
      if (!agencyId) return;

      const { error } = await supabase
        .from('agency_expenses')
        .update({ is_deleted: true })
        .eq('agency_id', agencyId)
        .eq('id', targetExpense.id);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error deleting expense for month:', error);
      throw error;
    }
  };

  const deleteExpenseFromMonthOnwards = async (targetExpense: AgencyExpense, targetMonthYear: string = monthYear) => {
    try {
      if (!agencyId) return;
      const baseId = targetExpense.parent_id ?? targetExpense.id;

      // Passo 1: marcar a despesa atual e todas as instâncias futuras como deletadas
      const { error: delErr } = await supabase
        .from('agency_expenses')
        .update({ is_deleted: true })
        .eq('agency_id', agencyId)
        .or(`id.eq.${baseId},parent_id.eq.${baseId}`)
        .gte('month_year', targetMonthYear);

      if (delErr) throw delErr;

      // Passo 2: marcar cancelled_from na despesa-mãe
      const { error: cancelErr } = await supabase
        .from('agency_expenses')
        .update({ cancelled_from: targetMonthYear })
        .eq('id', baseId);

      if (cancelErr) throw cancelErr;

      await fetchData();
    } catch (error) {
      console.error('Error deleting expense from month onwards:', error);
      throw error;
    }
  };

  const deleteExpensePermanently = async (targetExpense: AgencyExpense) => {
    try {
      if (!agencyId) return;
      const baseId = targetExpense.parent_id ?? targetExpense.id;

      const { error } = await supabase
        .from('agency_expenses')
        .update({ is_deleted: true })
        .eq('agency_id', agencyId)
        .or(`id.eq.${baseId},parent_id.eq.${baseId}`);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error deleting expense permanently:', error);
      throw error;
    }
  };

  const deleteBilling = async (id: string) => {
    try {
      const { error } = await supabase
        .from('agency_billing')
        .delete()
        .eq('agency_id', agencyId)
        .eq('id', id);

      if (error) throw error;
      setBillings(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting billing:', error);
      throw error;
    }
  };

  return {
    billings,
    expenses,
    rawExpenses,
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
    updateExpenseFromMonthOnwards,
    deleteExpenseForMonth,
    deleteExpenseFromMonthOnwards,
    deleteExpensePermanently,
    refresh: fetchData
  };
}


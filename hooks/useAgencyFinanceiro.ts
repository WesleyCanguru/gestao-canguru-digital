
import { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { AgencyBilling, AgencyExpense } from '../types';
import { parseExpenseRow, filterExpensesForMonth, encodeNotesAndMeta } from '../lib/expenses';
import dayjs from 'dayjs';

export function useAgencyFinanceiro(monthYear: string) {
  const { agencyId } = useAuth();
  const [billings, setBillings] = useState<AgencyBilling[]>([]);
  const [expenses, setExpenses] = useState<AgencyExpense[]>([]);
  const [rawExpenses, setRawExpenses] = useState<AgencyExpense[]>([]);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [faturamentoAcumulado, setFaturamentoAcumulado] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      // Fetch Clients for calculations (both active, completed, cancelled)
      const { data: clientsForCalcs } = await supabase
        .from('clients')
        .select('id, base_value, created_at, updated_at, client_status, service_end_date, client_type')
        .eq('agency_id', agencyId)
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
        .order('name');

      const clients = (clientsData || []).filter(c => {
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

      let currentBillings = ((billingsData || []) as AgencyBilling[]).filter(b => {
        if (b.is_sporadic) return true;
        const c = b.client as any;
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
        .select('*')
        .eq('agency_id', agencyId)
        .not('is_deleted', 'is', true)
        .order('created_at', { ascending: false });

      const parsedAll = (rawExpensesData || []).map(parseExpenseRow);
      setRawExpenses(parsedAll);

      const monthExpenses = filterExpensesForMonth(parsedAll, monthYear);
      setExpenses(monthExpenses);
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
      const existing = billings.find(b => {
        if (billing.id && b.id === billing.id) return true;
        if (billing.client_id && b.client_id === billing.client_id && !b.is_sporadic) return true;
        return false;
      });
      
      const base = billing.base_value !== undefined ? billing.base_value : (existing?.base_value || 0);
      const extra = billing.extra_value !== undefined ? billing.extra_value : (existing?.extra_value || 0);
      const total = base + extra;

      const dbData = {
        client_id: billing.client_id || existing?.client_id || null,
        month_year: billing.month_year || existing?.month_year || monthYear,
        base_value: base,
        extra_value: extra,
        total_value: total,
        due_day: billing.due_day !== undefined ? billing.due_day : (existing?.due_day || 10),
        status: billing.status || existing?.status || 'pending',
        notes: billing.notes !== undefined ? billing.notes : (existing?.notes || null),
        paid_at: billing.paid_at !== undefined ? billing.paid_at : (existing?.paid_at || null),
        is_sporadic: billing.is_sporadic !== undefined ? billing.is_sporadic : (existing?.is_sporadic || false),
        sporadic_name: billing.sporadic_name !== undefined ? billing.sporadic_name : (existing?.sporadic_name || null),
        agency_id: agencyId
      };

      if (billing.id?.startsWith('temp-') || !billing.id) {
        const { data, error } = await supabase
          .from('agency_billing')
          .insert([dbData])
          .select('*, client:clients(*)');
        
        if (error) throw error;
        if (data && data.length > 0) {
          const inserted = data[0];
          if (billing.id?.startsWith('temp-')) {
            setBillings(prev => prev.map(b => b.client_id === inserted.client_id && !b.is_sporadic ? inserted : b));
          } else {
            setBillings(prev => [...prev, inserted]);
          }
        }
      } else {
        const { data, error } = await supabase
          .from('agency_billing')
          .update(dbData)
          .eq('agency_id', agencyId)
          .eq('id', billing.id)
          .select('*, client:clients(*)');

        if (error) throw error;
        if (data && data.length > 0) {
          const updated = data[0];
          setBillings(prev => prev.map(b => b.id === updated.id ? updated : b));
        }
      }

      if (dbData.client_id && !dbData.is_sporadic && billing.update_global_contract !== false) {
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
      }
    } catch (error) {
      console.error('Error updating billing:', error);
      throw error;
    }
  };

  const addExpense = async (expense: Omit<AgencyExpense, 'id' | 'created_at'>) => {
    try {
      const isFixed = expense.category === 'fixed' || expense.is_fixed === true;
      const rawNotes = encodeNotesAndMeta(expense.notes, {
        is_fixed: isFixed,
        exclude_months: expense.exclude_months || [],
        parent_id: expense.parent_id || null,
        cancelled_from: expense.cancelled_from || null,
        origin: expense.origin || null,
        due_day: expense.due_day
      });

      const { data, error } = await supabase
        .from('agency_expenses')
        .insert([{
          description: expense.description,
          category: isFixed ? 'fixed' : 'variable',
          expense_type: expense.expense_type || 'tools',
          amount: expense.amount,
          month_year: expense.month_year || monthYear,
          due_date: expense.due_date || null,
          paid: expense.paid || false,
          paid_at: expense.paid_at || null,
          notes: rawNotes,
          agency_id: agencyId,
          is_deleted: false
        }])
        .select()
        .single();

      if (error) throw error;
      await fetchData();
      return data;
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  };

  const updateExpense = async (id: string, updates: Partial<AgencyExpense>) => {
    try {
      const existing = rawExpenses.find(e => e.id === id);
      const isFixed = updates.is_fixed !== undefined ? updates.is_fixed : (existing?.is_fixed ?? (updates.category === 'fixed' || existing?.category === 'fixed'));
      const rawNotes = encodeNotesAndMeta(
        updates.notes !== undefined ? updates.notes : existing?.notes,
        {
          is_fixed: isFixed,
          exclude_months: updates.exclude_months || existing?.exclude_months || [],
          parent_id: updates.parent_id !== undefined ? updates.parent_id : (existing?.parent_id || null),
          cancelled_from: updates.cancelled_from !== undefined ? updates.cancelled_from : (existing?.cancelled_from || null),
          origin: updates.origin !== undefined ? updates.origin : (existing?.origin || null),
          due_day: updates.due_day !== undefined ? updates.due_day : existing?.due_day
        }
      );

      const dbUpdates: Record<string, any> = {
        notes: rawNotes
      };
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.expense_type !== undefined) dbUpdates.expense_type = updates.expense_type;
      if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
      if (updates.due_date !== undefined) dbUpdates.due_date = updates.due_date;
      if (updates.paid !== undefined) dbUpdates.paid = updates.paid;
      if (updates.paid_at !== undefined) dbUpdates.paid_at = updates.paid_at;

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

      if (targetExpense.parent_id) {
        // Already a child override
        await updateExpense(targetExpense.id, {
          description: editedData.description,
          amount: editedData.amount,
          expense_type: editedData.expense_type,
          due_date: editedData.due_date,
          notes: editedData.notes,
          paid: editedData.paid,
          paid_at: editedData.paid_at,
          origin: editedData.origin !== undefined ? editedData.origin : targetExpense.origin,
          due_day: editedData.due_day
        });
        return;
      }

      // Add targetMonthYear to mother exclude_months
      const updatedExcludeMonths = Array.from(new Set([...(targetExpense.exclude_months || []), targetMonthYear]));
      const motherRawNotes = encodeNotesAndMeta(targetExpense.notes, {
        exclude_months: updatedExcludeMonths,
        is_fixed: true,
        cancelled_from: targetExpense.cancelled_from || null,
        origin: targetExpense.origin || null,
        due_day: targetExpense.due_day
      });

      const { error: motherErr } = await supabase
        .from('agency_expenses')
        .update({ notes: motherRawNotes })
        .eq('agency_id', agencyId)
        .eq('id', targetExpense.id);

      if (motherErr) throw motherErr;

      // Insert child override
      const childRawNotes = encodeNotesAndMeta(editedData.notes, {
        parent_id: targetExpense.id,
        is_fixed: false,
        origin: editedData.origin || targetExpense.origin || null,
        due_day: editedData.due_day
      });

      const { error: childErr } = await supabase
        .from('agency_expenses')
        .insert([{
          agency_id: agencyId,
          description: editedData.description,
          amount: editedData.amount,
          category: 'variable',
          expense_type: editedData.expense_type || 'tools',
          month_year: targetMonthYear,
          due_date: editedData.due_date || null,
          paid: editedData.paid ?? false,
          paid_at: editedData.paid_at ?? null,
          notes: childRawNotes,
          is_deleted: false
        }]);

      if (childErr) throw childErr;
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
      const motherId = targetExpense.parent_id || targetExpense.id;

      const motherExp = rawExpenses.find(e => e.id === motherId) || targetExpense;
      const rawNotes = encodeNotesAndMeta(editedData.notes ?? motherExp.notes, {
        exclude_months: motherExp.exclude_months || [],
        is_fixed: true,
        cancelled_from: motherExp.cancelled_from || null,
        origin: editedData.origin !== undefined ? editedData.origin : (motherExp.origin || null),
        due_day: editedData.due_day !== undefined ? editedData.due_day : motherExp.due_day
      });

      const { error } = await supabase
        .from('agency_expenses')
        .update({
          description: editedData.description,
          amount: editedData.amount,
          category: 'fixed',
          expense_type: editedData.expense_type,
          due_date: editedData.due_date,
          paid: editedData.paid,
          paid_at: editedData.paid_at,
          notes: rawNotes
        })
        .eq('agency_id', agencyId)
        .eq('id', motherId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error updating mother expense:', error);
      throw error;
    }
  };

  const deleteExpenseForMonth = async (targetExpense: AgencyExpense, targetMonthYear: string = monthYear) => {
    try {
      if (!agencyId) return;
      const motherId = targetExpense.parent_id || targetExpense.id;

      const motherExp = rawExpenses.find(e => e.id === motherId) || targetExpense;
      const updatedExcludeMonths = Array.from(new Set([...(motherExp.exclude_months || []), targetMonthYear]));
      const motherRawNotes = encodeNotesAndMeta(motherExp.notes, {
        exclude_months: updatedExcludeMonths,
        is_fixed: true,
        cancelled_from: motherExp.cancelled_from || null,
        origin: motherExp.origin || null,
        due_day: motherExp.due_day
      });

      await supabase
        .from('agency_expenses')
        .update({ notes: motherRawNotes })
        .eq('agency_id', agencyId)
        .eq('id', motherId);

      if (targetExpense.parent_id) {
        await supabase
          .from('agency_expenses')
          .update({ is_deleted: true })
          .eq('agency_id', agencyId)
          .eq('id', targetExpense.id);
      }

      await fetchData();
    } catch (error) {
      console.error('Error deleting expense for month:', error);
      throw error;
    }
  };

  const deleteExpenseFromMonthOnwards = async (targetExpense: AgencyExpense, targetMonthYear: string = monthYear) => {
    try {
      if (!agencyId) return;
      const motherId = targetExpense.parent_id || targetExpense.id;
      const motherExp = rawExpenses.find(e => e.id === motherId) || targetExpense;

      // If mother expense started on or after targetMonthYear, there is no prior history to preserve -> delete mother
      if (motherExp.month_year && motherExp.month_year >= targetMonthYear) {
        await supabase
          .from('agency_expenses')
          .update({ is_deleted: true })
          .eq('agency_id', agencyId)
          .eq('id', motherId);
      } else {
        // Mother was created in an earlier month -> set cancelled_from to targetMonthYear
        const motherRawNotes = encodeNotesAndMeta(motherExp.notes, {
          exclude_months: motherExp.exclude_months || [],
          is_fixed: true,
          cancelled_from: targetMonthYear,
          origin: motherExp.origin || null,
          due_day: motherExp.due_day
        });

        await supabase
          .from('agency_expenses')
          .update({ notes: motherRawNotes })
          .eq('agency_id', agencyId)
          .eq('id', motherId);
      }

      // Delete all child / override records from targetMonthYear onwards
      const childIdsToDelete = rawExpenses
        .filter(e => e.parent_id === motherId && e.month_year >= targetMonthYear)
        .map(e => e.id);

      if (targetExpense.parent_id && !childIdsToDelete.includes(targetExpense.id)) {
        childIdsToDelete.push(targetExpense.id);
      }

      if (childIdsToDelete.length > 0) {
        await supabase
          .from('agency_expenses')
          .update({ is_deleted: true })
          .in('id', childIdsToDelete);
      }

      await fetchData();
    } catch (error) {
      console.error('Error deleting expense from month onwards:', error);
      throw error;
    }
  };

  const deleteExpensePermanently = async (targetExpense: AgencyExpense) => {
    try {
      if (!agencyId) return;
      const motherId = targetExpense.parent_id || targetExpense.id;

      await supabase
        .from('agency_expenses')
        .update({ is_deleted: true })
        .eq('agency_id', agencyId)
        .eq('id', motherId);

      const childIdsToDelete = rawExpenses
        .filter(e => e.parent_id === motherId)
        .map(e => e.id);

      if (childIdsToDelete.length > 0) {
        await supabase
          .from('agency_expenses')
          .update({ is_deleted: true })
          .in('id', childIdsToDelete);
      }

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
    loading,
    updateBilling,
    deleteBilling,
    addExpense,
    updateExpense,
    overrideExpenseForMonth,
    updateMotherExpenseAllMonths,
    deleteExpenseForMonth,
    deleteExpenseFromMonthOnwards,
    deleteExpensePermanently,
    refresh: fetchData
  };
}


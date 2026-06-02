
import { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { AgencyBilling, AgencyExpense, Client } from '../types';

import dayjs from 'dayjs';

export function useAgencyFinanceiro(monthYear: string) {
  const { agencyId } = useAuth();
  const [billings, setBillings] = useState<AgencyBilling[]>([]);
  const [expenses, setExpenses] = useState<AgencyExpense[]>([]);
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
      // Fetch Clients to ensure we have all clients even if no billing record exists yet
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*, contract:contract_forms(contract_start_date)')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('name');

      const clients = (clientsData || []) as any[];

      // Fetch Billings for the month
      const { data: billingsData } = await supabase
        .from('agency_billing')
        .select('*, client:clients(*)')
        .eq('agency_id', agencyId)
        .eq('month_year', monthYear);

      let currentBillings = (billingsData || []) as AgencyBilling[];

      // If a client doesn't have a billing record for this month, we should ideally create one or show it as pending
      // For now, let's just merge them in memory for the UI
      const existingClientIds = new Set(currentBillings.filter(b => !b.is_sporadic).map(b => b.client_id));
      
      const missingClients = clients.filter(c => {
        if (existingClientIds.has(c.id)) return false;
        
        // Determine the start date of the client
        // Prefer contract_start_date if available (it is an array because of 1:M relationship, we take the first)
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

      // Fetch Expenses
      const { data: expensesData } = await supabase
        .from('agency_expenses')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('month_year', monthYear)
        .not('is_deleted', 'is', true)
        .order('created_at', { ascending: false });

      // Fetch all current month expenses (including deleted ones) to perform correct replication checks
      const { data: allCurrentMonthExpenses } = await supabase
        .from('agency_expenses')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('month_year', monthYear);

      let currentExpenses = (expensesData || []) as AgencyExpense[];
      const existingAll = allCurrentMonthExpenses || [];

      // Check fixed expenses from previous month that are NOT in the current month (matching by description)
      const prevMonth = dayjs(monthYear + '-01').subtract(1, 'month').format('YYYY-MM');
      const { data: prevExpenses } = await supabase
        .from('agency_expenses')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('month_year', prevMonth)
        .eq('category', 'fixed')
        .not('is_deleted', 'is', true);

      if (prevExpenses && prevExpenses.length > 0) {
        // Filter out those that already have a matching description in the current month's expenses
        const newExpensesToInsert = prevExpenses
          .filter(prevExp => {
            const hasMatch = existingAll.some(currExp => 
              currExp.category === 'fixed' && 
              currExp.description.toLowerCase().trim() === prevExp.description.toLowerCase().trim()
            );
            return !hasMatch;
          })
          .map(e => ({
            description: e.description,
            category: e.category,
            expense_type: e.expense_type,
            amount: e.amount,
            month_year: monthYear,
            due_date: e.due_date ? dayjs(monthYear + '-01').date(dayjs(e.due_date).date()).format('YYYY-MM-DD') : null,
            paid: false,
            paid_at: null,
            notes: e.notes,
            agency_id: agencyId,
            is_deleted: false
          }));

        if (newExpensesToInsert.length > 0) {
          const { data: insertedExpenses } = await supabase
            .from('agency_expenses')
            .insert(newExpensesToInsert)
            .select();

          if (insertedExpenses) {
            currentExpenses = [...currentExpenses, ...(insertedExpenses.filter(e => !e.is_deleted))];
          }
        }
      }

      setExpenses(currentExpenses);
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

      // Define exactly what we want to save to the DB to avoid sending extra fields
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

      // Update client base_value and due_day so it carries over to next months
      if (dbData.client_id && !dbData.is_sporadic && billing.update_global_contract !== false) {
        await supabase
          .from('clients')
          .update({
            base_value: dbData.base_value,
            due_day: dbData.due_day
          })
          .eq('agency_id', agencyId)
          .eq('id', dbData.client_id);
      }
    } catch (error) {
      console.error('Error updating billing:', error);
      throw error;
    }
  };

  const addExpense = async (expense: Omit<AgencyExpense, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('agency_expenses')
        .insert([{ ...expense, agency_id: agencyId }])
        .select()
        .single();

      if (error) throw error;
      setExpenses(prev => [data, ...prev]);
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  };

  const updateExpense = async (id: string, updates: Partial<AgencyExpense>) => {
    try {
      const { data, error } = await supabase
        .from('agency_expenses')
        .update(updates)
        .eq('agency_id', agencyId)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setExpenses(prev => prev.map(e => e.id === id ? data : e));
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      // Fetch target expense first to verify its properties
      const { data: targetExpense, error: fetchError } = await supabase
        .from('agency_expenses')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (targetExpense.category === 'fixed') {
        // Soft delete from this month onwards for matching fixed descriptions
        const { error: updateError } = await supabase
          .from('agency_expenses')
          .update({ is_deleted: true })
          .eq('agency_id', agencyId)
          .eq('category', 'fixed')
          .ilike('description', targetExpense.description)
          .gte('month_year', targetExpense.month_year);

        if (updateError) throw updateError;
        setExpenses(prev => prev.filter(e => e.id !== id));
      } else {
        // Variable expense: soft delete only this specific one
        const { error: updateError } = await supabase
          .from('agency_expenses')
          .update({ is_deleted: true })
          .eq('agency_id', agencyId)
          .eq('id', id);

        if (updateError) throw updateError;
        setExpenses(prev => prev.filter(e => e.id !== id));
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
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
    ticketMedio,
    faturamentoAcumulado,
    loading,
    updateBilling,
    deleteBilling,
    addExpense,
    updateExpense,
    deleteExpense,
    refresh: fetchData
  };
}

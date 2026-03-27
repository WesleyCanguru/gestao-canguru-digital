
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AgencyBilling, AgencyExpense, Client } from '../types';

export function useAgencyFinanceiro(monthYear: string) {
  const [billings, setBillings] = useState<AgencyBilling[]>([]);
  const [expenses, setExpenses] = useState<AgencyExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Clients to ensure we have all clients even if no billing record exists yet
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .order('name');

      const clients = (clientsData || []) as Client[];

      // Fetch Billings for the month
      const { data: billingsData } = await supabase
        .from('agency_billing')
        .select('*, client:clients(*)')
        .eq('month_year', monthYear);

      let currentBillings = (billingsData || []) as AgencyBilling[];

      // If a client doesn't have a billing record for this month, we should ideally create one or show it as pending
      // For now, let's just merge them in memory for the UI
      const existingClientIds = new Set(currentBillings.map(b => b.client_id));
      const missingClients = clients.filter(c => !existingClientIds.has(c.id));

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
        client: c
      }));

      setBillings([...currentBillings, ...placeholderBillings]);

      // Fetch Expenses
      const { data: expensesData } = await supabase
        .from('agency_expenses')
        .select('*')
        .eq('month_year', monthYear)
        .order('created_at', { ascending: false });

      setExpenses((expensesData || []) as AgencyExpense[]);
    } catch (error) {
      console.error('Error fetching financeiro data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [monthYear]);

  const updateBilling = async (billing: Partial<AgencyBilling>) => {
    try {
      const existing = billings.find(b => b.id === billing.id || b.client_id === billing.client_id);
      
      const base = billing.base_value !== undefined ? billing.base_value : (existing?.base_value || 0);
      const extra = billing.extra_value !== undefined ? billing.extra_value : (existing?.extra_value || 0);
      const total = base + extra;

      // Define exactly what we want to save to the DB to avoid sending extra fields
      const dbData = {
        client_id: billing.client_id || existing?.client_id,
        month_year: billing.month_year || existing?.month_year || monthYear,
        base_value: base,
        extra_value: extra,
        total_value: total,
        due_day: billing.due_day !== undefined ? billing.due_day : (existing?.due_day || 10),
        status: billing.status || existing?.status || 'pending',
        notes: billing.notes !== undefined ? billing.notes : (existing?.notes || null),
        paid_at: billing.paid_at !== undefined ? billing.paid_at : (existing?.paid_at || null),
      };

      if (billing.id?.startsWith('temp-')) {
        const { data, error } = await supabase
          .from('agency_billing')
          .insert([dbData])
          .select('*, client:clients(*)');
        
        if (error) throw error;
        if (data && data.length > 0) {
          const inserted = data[0];
          setBillings(prev => prev.map(b => b.client_id === inserted.client_id ? inserted : b));
        }
      } else {
        const { data, error } = await supabase
          .from('agency_billing')
          .update(dbData)
          .eq('id', billing.id)
          .select('*, client:clients(*)');

        if (error) throw error;
        if (data && data.length > 0) {
          const updated = data[0];
          setBillings(prev => prev.map(b => b.id === updated.id ? updated : b));
        }
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
        .insert([expense])
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
      const { error } = await supabase
        .from('agency_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  };

  return {
    billings,
    expenses,
    loading,
    updateBilling,
    addExpense,
    updateExpense,
    deleteExpense,
    refresh: fetchData
  };
}


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
        base_value: 0,
        extra_value: 0,
        total_value: 0,
        due_day: 10,
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
      if (billing.id?.startsWith('temp-')) {
        // Create new record
        const { client, id, ...newRecord } = billing as any;
        const { data, error } = await supabase
          .from('agency_billing')
          .insert([newRecord])
          .select('*, client:clients(*)')
          .single();
        
        if (error) throw error;
        setBillings(prev => prev.map(b => b.client_id === data.client_id ? data : b));
      } else {
        // Update existing
        const { client, ...updateData } = billing as any;
        const { data, error } = await supabase
          .from('agency_billing')
          .update(updateData)
          .eq('id', billing.id)
          .select('*, client:clients(*)')
          .single();

        if (error) throw error;
        setBillings(prev => prev.map(b => b.id === data.id ? data : b));
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
    deleteExpense,
    refresh: fetchData
  };
}

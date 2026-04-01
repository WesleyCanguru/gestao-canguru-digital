
import { supabase } from '../lib/supabase';
import { ClientLead, ClientLeadConfig } from '../types';
import dayjs from 'dayjs';

export function useLeadTracker() {
  const fetchConfig = async (clientId: string): Promise<ClientLeadConfig | null> => {
    try {
      const { data, error } = await supabase
        .from('client_lead_configs')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching lead config:', error);
      return null;
    }
  };

  const fetchLeads = async (clientId: string, date: string): Promise<ClientLead[]> => {
    try {
      const { data, error } = await supabase
        .from('client_leads')
        .select('*')
        .eq('client_id', clientId)
        .eq('lead_date', date)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching leads:', error);
      return [];
    }
  };

  const fetchMonthLeads = async (clientId: string, monthYear: string): Promise<ClientLead[]> => {
    // monthYear is YYYY-MM
    try {
      const startDate = dayjs(monthYear).startOf('month').format('YYYY-MM-DD');
      const endDate = dayjs(monthYear).endOf('month').format('YYYY-MM-DD');

      const { data, error } = await supabase
        .from('client_leads')
        .select('*')
        .eq('client_id', clientId)
        .gte('lead_date', startDate)
        .lte('lead_date', endDate);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching month leads:', error);
      return [];
    }
  };

  const addLead = async (lead: Omit<ClientLead, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('client_leads')
        .insert([lead])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding lead:', error);
      throw error;
    }
  };

  const updateLead = async (id: string, data: Partial<ClientLead>) => {
    try {
      const { data: updatedData, error } = await supabase
        .from('client_leads')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedData;
    } catch (error) {
      console.error('Error updating lead:', error);
      throw error;
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('client_leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting lead:', error);
      throw error;
    }
  };

  const upsertConfig = async (clientId: string, config: Partial<ClientLeadConfig>) => {
    try {
      const { data, error } = await supabase
        .from('client_lead_configs')
        .upsert({ 
          client_id: clientId, 
          ...config,
          updated_at: new Date().toISOString()
        }, { onConflict: 'client_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error upserting lead config:', error);
      throw error;
    }
  };

  return {
    fetchConfig,
    fetchLeads,
    fetchMonthLeads,
    addLead,
    updateLead,
    deleteLead,
    upsertConfig
  };
}

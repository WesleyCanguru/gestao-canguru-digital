
import { supabase } from '../lib/supabase';
import { ClientLead, ClientLeadConfig } from '../types';
import dayjs from 'dayjs';

const isUUID = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export function useLeadTracker() {
  const fetchConfig = async (clientId: string): Promise<ClientLeadConfig | null> => {
    if (!clientId || !isUUID(clientId)) {
      console.warn('Skipping fetchConfig due to invalid/missing clientId:', clientId);
      return null;
    }
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

  const fetchLeads = async (clientId: string): Promise<ClientLead[]> => {
    if (!clientId || !isUUID(clientId)) {
      console.warn('Skipping fetchLeads due to invalid/missing clientId:', clientId);
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('client_leads')
        .select('*')
        .eq('client_id', clientId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Error fetching leads:', error);
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

  const updateLeadStage = async (id: string, stage: string, lossReason?: string, position?: number) => {
    try {
      const updateData: any = { kanban_stage: stage };
      if (stage === 'Perdido' && lossReason) {
        updateData.loss_reason = lossReason;
      } else if (stage !== 'Perdido') {
        updateData.loss_reason = null;
      }

      if (position !== undefined) {
        updateData.position = position;
      }

      const { data, error } = await supabase
        .from('client_leads')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating lead stage:', error);
      throw error;
    }
  };

  const updateLeadsPositions = async (leads: { id: string, position: number, kanban_stage?: string }[]) => {
    try {
      const promises = leads.map(l => 
        supabase
          .from('client_leads')
          .update({ 
            position: l.position, 
            ...(l.kanban_stage ? { kanban_stage: l.kanban_stage } : {}),
            updated_at: new Date().toISOString() 
          })
          .eq('id', l.id)
      );

      const results = await Promise.all(promises);
      const firstError = results.find(r => r.error);
      if (firstError) throw firstError.error;
    } catch (error) {
      console.error('Error updating leads positions:', error);
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
    if (!clientId || !isUUID(clientId)) {
      throw new Error('Invalid client ID format');
    }
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
    addLead,
    updateLeadStage,
    updateLeadsPositions,
    updateLead,
    deleteLead,
    upsertConfig
  };
}

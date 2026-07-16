import { useState, useCallback } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { AgencyCRM, AgencyLead, KanbanStage } from '../types';

export function useAgencyCRM() {
  const { agencyId } = useAuth();
  const [crms, setCRMs] = useState<AgencyCRM[]>([]);
  const [leads, setLeads] = useState<AgencyLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCRMs = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agency_crms')
        .select('*')
        .eq('agency_id', agencyId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCRMs(data || []);
      return data;
    } catch (err: any) {
      console.error('Error fetching CRMs:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  const fetchLeads = useCallback(async (crmId: string) => {
    if (!agencyId) return;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(crmId);
    if (!crmId || !isUUID) {
      console.warn('Skipping fetchLeads due to invalid/missing crmId:', crmId);
      return [];
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agency_leads')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('crm_id', crmId)
        .order('kanban_position', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
      return data;
    } catch (err: any) {
      console.warn('Error fetching leads:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  const createCRM = async (data: Partial<AgencyCRM>) => {
    if (!agencyId) throw new Error('Agency ID not found');
    try {
      const { data: newCRM, error } = await supabase
        .from('agency_crms')
        .insert({
          name: data.name,
          description: data.description || null,
          kanban_stages: data.kanban_stages || [],
          form_fields: data.form_fields || [],
          auto_advance_time: data.auto_advance_time || '09:00',
          position: data.position || 0,
          agency_id: agencyId
        })
        .select()
        .single();

      if (error) throw error;
      setCRMs(prev => [...prev, newCRM]);
      return newCRM;
    } catch (err: any) {
      console.error('Error creating CRM:', err);
      throw err;
    }
  };

  const updateCRM = async (id: string, data: Partial<AgencyCRM>) => {
    try {
      const { data: updatedCRM, error } = await supabase
        .from('agency_crms')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setCRMs(prev => prev.map(c => c.id === id ? updatedCRM : c));
      return updatedCRM;
    } catch (err: any) {
      console.error('Error updating CRM:', err);
      throw err;
    }
  };

  const deleteCRM = async (id: string) => {
    try {
      // First delete all leads associated with this CRM to avoid FK constraint issues
      await supabase
        .from('agency_leads')
        .delete()
        .eq('crm_id', id);

      const { error } = await supabase
        .from('agency_crms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCRMs(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      console.error('Error deleting CRM:', err);
      throw err;
    }
  };

  const addLead = async (crmId: string, name: string, formData: Record<string, any>) => {
    if (!agencyId) throw new Error('Agency ID not found');
    try {
      const { data: newLead, error } = await supabase
        .from('agency_leads')
        .insert({
          crm_id: crmId,
          agency_id: agencyId,
          name,
          stage: 'Novos Leads', // Default stage, might need to be dynamic based on CRM stages
          stage_entered_at: new Date().toISOString(),
          next_stage_at: null,
          auto_advance_paused: false,
          kanban_position: 0,
          form_data: formData
        })
        .select()
        .single();

      if (error) throw error;
      setLeads(prev => [...prev, newLead]);
      return newLead;
    } catch (err: any) {
      console.error('Error adding lead:', err);
      throw err;
    }
  };

  const updateLead = async (id: string, data: Partial<AgencyLead>) => {
    try {
      const { data: updatedLead, error } = await supabase
        .from('agency_leads')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === id ? updatedLead : l));
      return updatedLead;
    } catch (err: any) {
      console.error('Error updating lead:', err);
      throw err;
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('agency_leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      console.error('Error deleting lead:', err);
      throw err;
    }
  };

  const calculateNextStageAt = (autoAdvanceDays: number | null, autoAdvanceTime: string) => {
    if (autoAdvanceDays === null) return null;

    const now = new Date();
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + autoAdvanceDays);
    
    const [hours, minutes] = autoAdvanceTime.split(':').map(Number);
    nextDate.setHours(hours || 9, minutes || 0, 0, 0);

    return nextDate.toISOString();
  };

  const moveLeadToStage = async (lead: AgencyLead, newStageName: string, stages: KanbanStage[], crmAutoAdvanceTime: string, newPosition?: number) => {
    const newStage = stages.find(s => s.name === newStageName);
    if (!newStage) return;

    const nextStageAt = calculateNextStageAt(newStage.auto_advance_days, crmAutoAdvanceTime);
    const autoAdvancePaused = newStage.auto_advance_days === null;

    const updateData: Partial<AgencyLead> = {
      stage: newStageName,
      stage_entered_at: new Date().toISOString(),
      next_stage_at: nextStageAt,
      auto_advance_paused: autoAdvancePaused,
    };

    if (newPosition !== undefined) {
      updateData.kanban_position = newPosition;
    }

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...updateData } : l));

    try {
      const { data: updatedLead, error } = await supabase
        .from('agency_leads')
        .update(updateData)
        .eq('id', lead.id)
        .select()
        .single();

      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === lead.id ? updatedLead : l));
      return updatedLead;
    } catch (err: any) {
      console.error('Error moving lead:', err);
      // Revert optimistic update
      setLeads(prev => prev.map(l => l.id === lead.id ? lead : l));
      throw err;
    }
  };

  const autoAdvanceLeads = async (currentLeads: AgencyLead[], stages: KanbanStage[], crm: AgencyCRM) => {
    const now = new Date();
    const leadsToAdvance = currentLeads.filter(lead => {
      if (lead.auto_advance_paused || !lead.next_stage_at) return false;
      const nextStageDate = new Date(lead.next_stage_at);
      return nextStageDate <= now;
    });

    if (leadsToAdvance.length === 0) return currentLeads;

    const updatedLeadsList = [...currentLeads];
    const updates = [];

    for (const lead of leadsToAdvance) {
      const currentStageIndex = stages.findIndex(s => s.name === lead.stage);
      if (currentStageIndex !== -1 && currentStageIndex < stages.length - 1) {
        let nextStage = stages[currentStageIndex + 1];
        
        // CORRECTION: Mensagem Final stage (stage_1775861497416 or "Mensagem Final") must auto-advance to Perdido, skipping Proposta Enviada
        const currentStage = stages[currentStageIndex];
        if (currentStage.id === 'stage_1775861497416' || currentStage.name === 'Mensagem Final') {
          const perdidoStage = stages.find(s => s.id === 'perdido' || s.name === 'Perdido');
          if (perdidoStage) {
            nextStage = perdidoStage;
          }
        }

        const nextStageAt = calculateNextStageAt(nextStage.auto_advance_days, crm.auto_advance_time);
        
        const updateData = {
          stage: nextStage.name,
          stage_entered_at: new Date().toISOString(),
          next_stage_at: nextStageAt,
          auto_advance_paused: nextStage.auto_advance_days === null,
        };

        updates.push({ id: lead.id, ...updateData });
        
        const leadIndex = updatedLeadsList.findIndex(l => l.id === lead.id);
        if (leadIndex !== -1) {
          updatedLeadsList[leadIndex] = { ...updatedLeadsList[leadIndex], ...updateData };
        }
      }
    }

    if (updates.length > 0) {
      // Update local state immediately
      setLeads(updatedLeadsList);

      // Perform updates in DB
      for (const update of updates) {
        try {
          await supabase
            .from('agency_leads')
            .update({
              stage: update.stage,
              stage_entered_at: update.stage_entered_at,
              next_stage_at: update.next_stage_at,
              auto_advance_paused: update.auto_advance_paused
            })
            .eq('id', update.id);
        } catch (err) {
          console.error(`Error auto-advancing lead ${update.id}:`, err);
        }
      }
    }

    return updatedLeadsList;
  };

  return {
    crms,
    leads,
    loading,
    error,
    fetchCRMs,
    fetchLeads,
    createCRM,
    updateCRM,
    deleteCRM,
    addLead,
    updateLead,
    deleteLead,
    moveLeadToStage,
    autoAdvanceLeads
  };
}


import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lead, LeadStage } from '../types';
import dayjs from 'dayjs';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads((data || []) as Lead[]);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const calculateNextFollowup = (stage: LeadStage): string | null => {
    const today = dayjs();
    switch (stage) {
      case 'first_message':
        return today.add(2, 'day').toISOString();
      case 'followup_1':
        return today.add(3, 'day').toISOString();
      case 'followup_2':
        return today.add(4, 'day').toISOString();
      default:
        return null;
    }
  };

  const addLead = async (lead: Omit<Lead, 'id' | 'created_at' | 'kanban_stage' | 'next_followup_date' | 'stage_changed_at'>) => {
    try {
      const newLead = {
        ...lead,
        kanban_stage: 'lead' as LeadStage,
        next_followup_date: null,
        stage_changed_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('leads')
        .insert([newLead])
        .select()
        .single();

      if (error) throw error;
      setLeads(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error adding lead:', error);
      throw error;
    }
  };

  const updateLeadStage = async (id: string, newStage: LeadStage) => {
    try {
      const nextFollowup = calculateNextFollowup(newStage);
      const updateData = {
        kanban_stage: newStage,
        next_followup_date: nextFollowup,
        stage_changed_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === id ? data : l));
      return data;
    } catch (error) {
      console.error('Error updating lead stage:', error);
      throw error;
    }
  };

  const updateLead = async (id: string, lead: Partial<Lead>) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update(lead)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === id ? data : l));
      return data;
    } catch (error) {
      console.error('Error updating lead:', error);
      throw error;
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting lead:', error);
      throw error;
    }
  };

  return {
    leads,
    loading,
    addLead,
    updateLeadStage,
    updateLead,
    deleteLead,
    refresh: fetchLeads
  };
}

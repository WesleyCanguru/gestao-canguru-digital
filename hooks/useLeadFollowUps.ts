import { useCallback, useEffect, useState } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import type { FollowUpRecord } from '../lib/followups';

export interface LeadFollowUpRow extends FollowUpRecord {
  id: string;
  crm_id: string;
  agency_id: number;
  note?: string | null;
}

/** Histórico de follow-ups de um CRM da agência. */
export function useLeadFollowUps(crmId: string) {
  const { agencyId } = useAuth();
  const [history, setHistory] = useState<LeadFollowUpRow[]>([]);

  const fetchHistory = useCallback(async () => {
    if (!agencyId || !crmId) return;
    const { data, error } = await supabase
      .from('agency_lead_followups')
      .select('*')
      .eq('crm_id', crmId)
      .order('created_at', { ascending: true });
    if (!error) setHistory((data || []) as LeadFollowUpRow[]);
  }, [agencyId, crmId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const recordFollowUp = useCallback(async (leadId: string, stage: string, step: number, outcome: 'feito' | 'pulado' = 'feito', note?: string) => {
    if (!agencyId) return null;
    const row = { agency_id: agencyId, crm_id: crmId, lead_id: leadId, stage, step, outcome, note: note || null };
    const { data, error } = await supabase.from('agency_lead_followups').insert(row).select().single();
    if (error) throw error;
    setHistory(prev => [...prev, data as LeadFollowUpRow]);
    return data as LeadFollowUpRow;
  }, [agencyId, crmId]);

  return { history, fetchHistory, recordFollowUp };
}

import { useState, useEffect, useCallback } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { ReferralPartner, ReferralCommission, AgencyBilling, Client } from '../types';
import dayjs from 'dayjs';

const SEED_PARTNERS_KEY = 'bolsa_referral_partners_fallback_v1';
const SEED_COMMISSIONS_KEY = 'bolsa_referral_commissions_fallback_v1';

export function useReferralProgram() {
  const { agencyId } = useAuth();
  const [partners, setPartners] = useState<ReferralPartner[]>([]);
  const [commissions, setCommissions] = useState<ReferralCommission[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);

  const fetchReferralData = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);

    try {
      // 1. Fetch clients to get referral links and client details
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('agency_id', agencyId);

      const loadedClients = (clientsData || []) as Client[];
      setClients(loadedClients);

      // 2. Try fetching referral_partners from Supabase
      const { data: partnersData, error: partnersErr } = await supabase
        .from('referral_partners')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: true });

      // 3. Try fetching referral_commissions from Supabase
      const { data: commissionsData, error: commissionsErr } = await supabase
        .from('referral_commissions')
        .select('*, partner:referral_partners(*), client:clients(*)')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (partnersErr || commissionsErr) {
        // Fallback to local state / initial seed if tables don't exist yet in Supabase
        console.warn('Supabase referral tables not ready, using fallback state:', partnersErr || commissionsErr);
        setUsingFallback(true);
        loadFallbackData(agencyId, loadedClients);
        return;
      }

      let fetchedPartners = (partnersData || []) as ReferralPartner[];
      let fetchedCommissions = (commissionsData || []) as ReferralCommission[];

      // Initial seed check if empty
      if (fetchedPartners.length === 0) {
        fetchedPartners = await seedInitialPartnersInSupabase(agencyId, loadedClients);
      }

      // Calculate computed properties for partners (linked_clients_count and total_paid_history)
      const partnersWithMetrics = calculatePartnerMetrics(fetchedPartners, loadedClients, fetchedCommissions);
      setPartners(partnersWithMetrics);
      setCommissions(fetchedCommissions);
      setUsingFallback(false);
    } catch (err) {
      console.error('Error fetching referral program data:', err);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  // Load local state / seed fallback data
  const loadFallbackData = (currentAgencyId: number, currentClients: Client[]) => {
    let localPartners: ReferralPartner[] = [];
    let localCommissions: ReferralCommission[] = [];

    try {
      const storedP = localStorage.getItem(`${SEED_PARTNERS_KEY}_${currentAgencyId}`);
      if (storedP) {
        localPartners = JSON.parse(storedP);
      }
      const storedC = localStorage.getItem(`${SEED_COMMISSIONS_KEY}_${currentAgencyId}`);
      if (storedC) {
        localCommissions = JSON.parse(storedC);
      }
    } catch (e) {
      console.warn('Error reading fallback referral data:', e);
    }

    // Seed Eric and Zizi if local fallback is empty
    if (localPartners.length === 0) {
      const varejaoClient = currentClients.find(c => c.name.toLowerCase().includes('varejão') || c.name.toLowerCase().includes('varejao'));
      
      const ericPartner: ReferralPartner = {
        id: 'eric-partner-uuid-001',
        agency_id: currentAgencyId,
        name: 'Eric',
        contact: '',
        commission_rate: 10,
        notes: 'Parceiro comercial (10% de comissão)',
        is_active: true,
        created_at: new Date().toISOString()
      };

      const ziziPartner: ReferralPartner = {
        id: 'zizi-partner-uuid-002',
        agency_id: currentAgencyId,
        name: 'Zizi',
        contact: '',
        commission_rate: 0,
        notes: 'Prospect em andamento (comissão a definir)',
        is_active: true,
        created_at: new Date().toISOString()
      };

      localPartners = [ericPartner, ziziPartner];
      localStorage.setItem(`${SEED_PARTNERS_KEY}_${currentAgencyId}`, JSON.stringify(localPartners));

      // Link Varejão do ferro if found
      if (varejaoClient) {
        varejaoClient.referral_partner_id = ericPartner.id;
      }
    }

    const partnersWithMetrics = calculatePartnerMetrics(localPartners, currentClients, localCommissions);
    setPartners(partnersWithMetrics);
    setCommissions(localCommissions);
  };

  // Seed initial partners directly into Supabase if table exists but empty
  const seedInitialPartnersInSupabase = async (currentAgencyId: number, currentClients: Client[]) => {
    try {
      const varejaoClient = currentClients.find(c => c.name.toLowerCase().includes('varejão') || c.name.toLowerCase().includes('varejao'));

      const { data: createdPartners, error } = await supabase
        .from('referral_partners')
        .insert([
          {
            agency_id: currentAgencyId,
            name: 'Eric',
            commission_rate: 10,
            notes: 'Parceiro comercial (10% de comissão)',
            is_active: true
          },
          {
            agency_id: currentAgencyId,
            name: 'Zizi',
            commission_rate: 0,
            notes: 'Prospect em andamento (comissão a definir)',
            is_active: true
          }
        ])
        .select('*');

      if (!error && createdPartners) {
        const eric = createdPartners.find((p: any) => p.name === 'Eric');
        if (eric && varejaoClient) {
          await supabase
            .from('clients')
            .update({ referral_partner_id: eric.id })
            .eq('id', varejaoClient.id);
        }
        return createdPartners as ReferralPartner[];
      }
    } catch (e) {
      console.warn('Seed initial partners warning:', e);
    }
    return [];
  };

  const calculatePartnerMetrics = (
    partnerList: ReferralPartner[],
    clientList: Client[],
    commissionList: ReferralCommission[]
  ): ReferralPartner[] => {
    return partnerList.map(partner => {
      const linkedClients = clientList.filter(c => c.referral_partner_id === partner.id);
      const paidCommissions = commissionList.filter(c => c.partner_id === partner.id && c.paid_to_partner);
      const totalPaid = paidCommissions.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);

      return {
        ...partner,
        linked_clients_count: linkedClients.length,
        total_paid_history: totalPaid
      };
    });
  };

  // Add Partner
  const addPartner = async (partnerData: Omit<ReferralPartner, 'id' | 'created_at'>) => {
    if (!agencyId) return;

    if (!usingFallback) {
      try {
        const { error } = await supabase
          .from('referral_partners')
          .insert([{ ...partnerData, agency_id: agencyId }]);

        if (!error) {
          await fetchReferralData();
          return;
        }
      } catch (e) {
        console.warn('Error inserting partner into DB, falling back:', e);
      }
    }

    // Fallback insertion
    const newPartner: ReferralPartner = {
      ...partnerData,
      id: `partner-${Date.now()}`,
      agency_id: agencyId,
      created_at: new Date().toISOString()
    };
    const nextPartners = [...partners, newPartner];
    localStorage.setItem(`${SEED_PARTNERS_KEY}_${agencyId}`, JSON.stringify(nextPartners));
    const partnersWithMetrics = calculatePartnerMetrics(nextPartners, clients, commissions);
    setPartners(partnersWithMetrics);
  };

  // Update Partner
  const updatePartner = async (partnerId: string, partnerData: Partial<ReferralPartner>) => {
    if (!agencyId) return;

    if (!usingFallback) {
      try {
        const { error } = await supabase
          .from('referral_partners')
          .update(partnerData)
          .eq('agency_id', agencyId)
          .eq('id', partnerId);

        if (!error) {
          await fetchReferralData();
          return;
        }
      } catch (e) {
        console.warn('Error updating partner in DB:', e);
      }
    }

    // Fallback update
    const nextPartners = partners.map(p => p.id === partnerId ? { ...p, ...partnerData } : p);
    localStorage.setItem(`${SEED_PARTNERS_KEY}_${agencyId}`, JSON.stringify(nextPartners));
    const partnersWithMetrics = calculatePartnerMetrics(nextPartners, clients, commissions);
    setPartners(partnersWithMetrics);
  };

  // Link Client to Partner
  const linkClientToPartner = async (clientId: string, partnerId: string | null) => {
    if (!agencyId) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update({ referral_partner_id: partnerId })
        .eq('agency_id', agencyId)
        .eq('id', clientId);

      if (error) {
        console.warn('Error updating referral_partner_id on client in DB:', error);
      }
    } catch (e) {
      console.warn('Non-fatal client partner link warning:', e);
    }

    // Update local state
    const nextClients = clients.map(c => c.id === clientId ? { ...c, referral_partner_id: partnerId } : c);
    setClients(nextClients);
    const partnersWithMetrics = calculatePartnerMetrics(partners, nextClients, commissions);
    setPartners(partnersWithMetrics);
  };

  // Mark Commission as Paid
  const markCommissionAsPaid = async (commissionId: string) => {
    if (!agencyId) return;
    const nowIso = new Date().toISOString();

    if (!usingFallback) {
      try {
        const { error } = await supabase
          .from('referral_commissions')
          .update({
            paid_to_partner: true,
            paid_to_partner_at: nowIso
          })
          .eq('agency_id', agencyId)
          .eq('id', commissionId);

        if (!error) {
          await fetchReferralData();
          return;
        }
      } catch (e) {
        console.warn('Error marking commission as paid in DB:', e);
      }
    }

    // Fallback update
    const nextCommissions = commissions.map(c =>
      c.id === commissionId ? { ...c, paid_to_partner: true, paid_to_partner_at: nowIso } : c
    );
    localStorage.setItem(`${SEED_COMMISSIONS_KEY}_${agencyId}`, JSON.stringify(nextCommissions));
    setCommissions(nextCommissions);
    const partnersWithMetrics = calculatePartnerMetrics(partners, clients, nextCommissions);
    setPartners(partnersWithMetrics);
  };

  // Auto-generate Commission for Billing
  const generateCommissionForBilling = async (billing: AgencyBilling, clientPaidAtDate?: string) => {
    if (!agencyId || !billing.client_id) return;

    // Check client referral partner
    let client = billing.client || clients.find(c => c.id === billing.client_id);
    
    // If client is missing referral_partner_id, fetch fresh client record from DB
    if (client && !client.referral_partner_id) {
      try {
        const { data: dbClient } = await supabase
          .from('clients')
          .select('referral_partner_id')
          .eq('id', billing.client_id)
          .single();
        if (dbClient?.referral_partner_id) {
          client = { ...client, referral_partner_id: dbClient.referral_partner_id };
        }
      } catch (e) {}
    }

    const partnerId = client?.referral_partner_id;
    if (!partnerId) return; // Client has no partner associated

    // Find partner
    const partner = partners.find(p => p.id === partnerId);
    if (!partner || partner.commission_rate <= 0) return;

    // Check if commission already exists for this billing
    const existingCommission = commissions.find(c => c.billing_id === billing.id);
    if (existingCommission) return;

    // Calculate commission amount based ONLY on base_value (never extra_value or total_value)
    const baseVal = Number(billing.base_value || 0);
    const commissionAmount = Number(((baseVal * Number(partner.commission_rate)) / 100).toFixed(2));
    if (commissionAmount <= 0) return;

    const paidAt = clientPaidAtDate || billing.paid_at || dayjs().format('YYYY-MM-DD');
    const clientPaidAtFormatted = dayjs(paidAt).format('YYYY-MM-DD');
    const partnerDueDate = dayjs(clientPaidAtFormatted).add(5, 'day').format('YYYY-MM-DD');

    const newCommData = {
      agency_id: agencyId,
      partner_id: partner.id,
      client_id: billing.client_id,
      billing_id: billing.id.startsWith('temp-') ? null : billing.id,
      commission_amount: commissionAmount,
      client_paid_at: clientPaidAtFormatted,
      partner_due_date: partnerDueDate,
      paid_to_partner: false,
      paid_to_partner_at: null,
      notes: `Comissão (${partner.commission_rate}%) referente à fatura ${billing.month_year}`
    };

    if (!usingFallback) {
      try {
        const { error } = await supabase
          .from('referral_commissions')
          .insert([newCommData]);

        if (!error) {
          await fetchReferralData();
          return;
        }
      } catch (e) {
        console.warn('Error auto-generating commission in DB:', e);
      }
    }

    // Fallback insertion
    const fallbackComm: ReferralCommission = {
      ...newCommData,
      id: `comm-${Date.now()}`,
      created_at: new Date().toISOString(),
      partner,
      client,
      billing
    };
    const nextCommissions = [fallbackComm, ...commissions];
    localStorage.setItem(`${SEED_COMMISSIONS_KEY}_${agencyId}`, JSON.stringify(nextCommissions));
    setCommissions(nextCommissions);
    const partnersWithMetrics = calculatePartnerMetrics(partners, clients, nextCommissions);
    setPartners(partnersWithMetrics);
  };

  // Compute overdue commissions (due date <= today and not paid)
  const todayStr = dayjs().format('YYYY-MM-DD');
  const overdueCommissions = commissions.filter(c => !c.paid_to_partner && c.partner_due_date <= todayStr);
  const pendingCommissions = commissions.filter(c => !c.paid_to_partner);

  return {
    partners,
    commissions,
    overdueCommissions,
    pendingCommissions,
    clients,
    loading,
    usingFallback,
    addPartner,
    updatePartner,
    linkClientToPartner,
    markCommissionAsPaid,
    generateCommissionForBilling,
    refresh: fetchReferralData
  };
}

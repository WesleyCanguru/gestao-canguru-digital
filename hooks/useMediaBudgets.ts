import { useState, useEffect, useCallback } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import dayjs from 'dayjs';
import { ClientMediaBudget, Client } from '../types';

export function normalizePlatformKey(platform: string): string {
  if (!platform) return '';
  const p = platform.toLowerCase();
  if (p.includes('meta')) return 'meta';
  if (p.includes('google')) return 'google';
  if (p.includes('tiktok')) return 'tiktok';
  if (p.includes('linkedin')) return 'linkedin';
  if (p.includes('youtube')) return 'youtube';
  if (p.includes('pinterest')) return 'pinterest';
  return p;
}

export function getPlatformLabel(platform: string): string {
  const key = normalizePlatformKey(platform);
  switch (key) {
    case 'meta': return 'Meta Ads';
    case 'google': return 'Google Ads';
    case 'tiktok': return 'TikTok Ads';
    case 'linkedin': return 'LinkedIn Ads';
    case 'youtube': return 'YouTube Ads';
    case 'pinterest': return 'Pinterest Ads';
    default: return platform;
  }
}

export interface PlatformBudgetConsumption {
  platformKey: string;
  platformLabel: string;
  budgetAmount: number;
  investedAmount: number;
  percentage: number;
  remainingAmount: number;
  exceededAmount: number;
  isOverBudget: boolean;
  isHighConsumption: boolean;
  statusColor: 'green' | 'yellow' | 'red';
}

export interface ClientBudgetAlert {
  clientId: string;
  clientName: string;
  platformKey: string;
  platformLabel: string;
  type: 'high_consumption' | 'over_budget';
  percentage: number;
  remainingDays: number;
  budgetAmount: number;
  investedAmount: number;
  exceededAmount: number;
  remainingAmount: number;
}

export function useMediaBudgets(clientId?: string | null, targetMonthYear?: string) {
  const { agencyId } = useAuth();
  const [budgets, setBudgets] = useState<ClientMediaBudget[]>([]);
  const [consumptions, setConsumptions] = useState<Record<string, PlatformBudgetConsumption>>({});
  const [alerts, setAlerts] = useState<ClientBudgetAlert[]>([]);
  const [overBudgetClientIds, setOverBudgetClientIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const monthYear = targetMonthYear || dayjs().format('YYYY-MM');

  // Load budgets for a single client
  const fetchClientBudgets = useCallback(async () => {
    if (!agencyId || !clientId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('client_media_budgets')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('client_id', clientId)
        .eq('month_year', monthYear);

      if (error) {
        console.warn('Erro ao carregar orçamentos de mídia:', error.message);
      } else {
        setBudgets((data as ClientMediaBudget[]) || []);
      }
    } catch (e) {
      console.error('Erro ao buscar orçamentos:', e);
    } finally {
      setLoading(false);
    }
  }, [agencyId, clientId, monthYear]);

  // Save budget for client + platform + month_year
  const saveBudget = async (platform: string, amount: number) => {
    if (!agencyId || !clientId) return { success: false, error: 'Cliente não identificado' };

    const platformKey = normalizePlatformKey(platform);
    if (!platformKey) return { success: false, error: 'Plataforma inválida' };

    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('client_media_budgets')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('client_id', clientId)
        .eq('month_year', monthYear)
        .eq('platform', platformKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('client_media_budgets')
          .update({ budget_amount: amount })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('client_media_budgets')
          .insert([{
            agency_id: agencyId,
            client_id: clientId,
            month_year: monthYear,
            platform: platformKey,
            budget_amount: amount,
          }]);
        if (error) throw error;
      }

      await fetchClientBudgets();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar verba de mídia:', err);
      return { success: false, error: err.message || 'Erro ao salvar' };
    }
  };

  // Fetch consumption for a single client
  const fetchClientConsumption = useCallback(async (platformsToTrack: string[] = ['meta', 'google']) => {
    if (!agencyId || !clientId) return;

    const startOfMonth = `${monthYear}-01`;
    const endOfMonth = dayjs(startOfMonth).endOf('month').format('YYYY-MM-DD');

    try {
      // 1. Fetch budgets for this client and month
      const { data: bData } = await supabase
        .from('client_media_budgets')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('client_id', clientId)
        .eq('month_year', monthYear);

      const budgetMap: Record<string, number> = {};
      (bData || []).forEach((b: any) => {
        const key = normalizePlatformKey(b.platform);
        budgetMap[key] = Number(b.budget_amount) || 0;
      });

      // 2. Fetch daily investments
      const { data: iData } = await supabase
        .from('paid_traffic_daily')
        .select('platform, investment')
        .eq('agency_id', agencyId)
        .eq('client_id', clientId)
        .gte('report_date', startOfMonth)
        .lte('report_date', endOfMonth);

      const investmentMap: Record<string, number> = {};
      (iData || []).forEach((row: any) => {
        const key = normalizePlatformKey(row.platform);
        investmentMap[key] = (investmentMap[key] || 0) + (Number(row.investment) || 0);
      });

      // Build consumption dict for all active platforms
      const result: Record<string, PlatformBudgetConsumption> = {};

      // Normalize platform list
      const normalizedPlatforms = Array.from(new Set(platformsToTrack.map(normalizePlatformKey))).filter(Boolean);

      normalizedPlatforms.forEach((pKey) => {
        const budget = budgetMap[pKey] || 0;
        const invested = investmentMap[pKey] || 0;
        const percentage = budget > 0 ? Math.round((invested / budget) * 100) : 0;
        const remaining = Math.max(0, budget - invested);
        const exceeded = invested > budget ? invested - budget : 0;
        const isOverBudget = budget > 0 && invested > budget;
        const isHighConsumption = budget > 0 && percentage >= 85 && !isOverBudget;

        let statusColor: 'green' | 'yellow' | 'red' = 'green';
        if (percentage > 90 || isOverBudget) {
          statusColor = 'red';
        } else if (percentage >= 70) {
          statusColor = 'yellow';
        }

        result[pKey] = {
          platformKey: pKey,
          platformLabel: getPlatformLabel(pKey),
          budgetAmount: budget,
          investedAmount: invested,
          percentage,
          remainingAmount: remaining,
          exceededAmount: exceeded,
          isOverBudget,
          isHighConsumption,
          statusColor,
        };
      });

      setConsumptions(result);
    } catch (e) {
      console.error('Erro ao calcular consumo de mídia:', e);
    }
  }, [agencyId, clientId, monthYear]);

  // Fetch alerts for ALL clients across agency for current month
  const fetchAgencyBudgetAlerts = useCallback(async () => {
    if (!agencyId) return;

    const currentMY = dayjs().format('YYYY-MM');
    const startOfMonth = `${currentMY}-01`;
    const endOfMonth = dayjs(startOfMonth).endOf('month').format('YYYY-MM-DD');

    // Remaining days in current month
    const totalDaysInMonth = dayjs(startOfMonth).daysInMonth();
    const currentDay = dayjs().date();
    const remainingDaysInMonth = Math.max(0, totalDaysInMonth - currentDay);

    try {
      // 1. Fetch active non-internal non-test clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, is_internal, client_status')
        .eq('agency_id', agencyId);

      const activeClients = (clientsData || []).filter((c: any) => {
        if (c.is_internal) return false;
        if (c.client_status === 'cancelled' || c.client_status === 'inactive') return false;
        if (c.name && c.name.toLowerCase().includes('a-teste')) return false;
        return true;
      });

      const activeClientIds = activeClients.map(c => c.id);
      const clientNameMap: Record<string, string> = {};
      activeClients.forEach(c => { clientNameMap[c.id] = c.name; });

      if (activeClientIds.length === 0) {
        setAlerts([]);
        setOverBudgetClientIds(new Set());
        return;
      }

      // 2. Fetch all media budgets for current month
      const { data: budgetsData } = await supabase
        .from('client_media_budgets')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('month_year', currentMY)
        .in('client_id', activeClientIds);

      if (!budgetsData || budgetsData.length === 0) {
        setAlerts([]);
        setOverBudgetClientIds(new Set());
        return;
      }

      // Group budgets by clientId -> platformKey
      const budgetByClientPlatform: Record<string, Record<string, number>> = {};
      budgetsData.forEach((b: any) => {
        const cId = b.client_id;
        const pKey = normalizePlatformKey(b.platform);
        if (!budgetByClientPlatform[cId]) budgetByClientPlatform[cId] = {};
        budgetByClientPlatform[cId][pKey] = Number(b.budget_amount) || 0;
      });

      // 3. Fetch investments for current month
      const { data: investmentsData } = await supabase
        .from('paid_traffic_daily')
        .select('client_id, platform, investment')
        .eq('agency_id', agencyId)
        .in('client_id', activeClientIds)
        .gte('report_date', startOfMonth)
        .lte('report_date', endOfMonth);

      const investmentByClientPlatform: Record<string, Record<string, number>> = {};
      (investmentsData || []).forEach((row: any) => {
        const cId = row.client_id;
        const pKey = normalizePlatformKey(row.platform);
        if (!investmentByClientPlatform[cId]) investmentByClientPlatform[cId] = {};
        investmentByClientPlatform[cId][pKey] = (investmentByClientPlatform[cId][pKey] || 0) + (Number(row.investment) || 0);
      });

      const newAlerts: ClientBudgetAlert[] = [];
      const overBudgetSet = new Set<string>();

      Object.keys(budgetByClientPlatform).forEach((cId) => {
        const clientName = clientNameMap[cId] || 'Cliente';
        const clientBudgets = budgetByClientPlatform[cId];
        const clientInvestments = investmentByClientPlatform[cId] || {};

        Object.keys(clientBudgets).forEach((pKey) => {
          const budget = clientBudgets[pKey] || 0;
          if (budget <= 0) return;

          const invested = clientInvestments[pKey] || 0;
          const percentage = Math.round((invested / budget) * 100);

          if (invested > budget) {
            // Estouro de verba (> 100%)
            overBudgetSet.add(cId);
            newAlerts.push({
              clientId: cId,
              clientName,
              platformKey: pKey,
              platformLabel: getPlatformLabel(pKey),
              type: 'over_budget',
              percentage,
              remainingDays: remainingDaysInMonth,
              budgetAmount: budget,
              investedAmount: invested,
              exceededAmount: invested - budget,
              remainingAmount: 0,
            });
          } else if (percentage >= 85 && remainingDaysInMonth > 5) {
            // Consumo acima de 85% E ainda faltando mais de 5 dias no mês
            newAlerts.push({
              clientId: cId,
              clientName,
              platformKey: pKey,
              platformLabel: getPlatformLabel(pKey),
              type: 'high_consumption',
              percentage,
              remainingDays: remainingDaysInMonth,
              budgetAmount: budget,
              investedAmount: invested,
              exceededAmount: 0,
              remainingAmount: budget - invested,
            });
          }
        });
      });

      setAlerts(newAlerts);
      setOverBudgetClientIds(overBudgetSet);
    } catch (e) {
      console.error('Erro ao calcular alertas de verba de mídia:', e);
    }
  }, [agencyId]);

  useEffect(() => {
    if (clientId) {
      fetchClientBudgets();
    }
  }, [clientId, fetchClientBudgets]);

  return {
    budgets,
    consumptions,
    alerts,
    overBudgetClientIds,
    loading,
    fetchClientBudgets,
    fetchClientConsumption,
    fetchAgencyBudgetAlerts,
    saveBudget,
  };
}

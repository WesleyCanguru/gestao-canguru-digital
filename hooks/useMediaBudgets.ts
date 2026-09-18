import { useState, useEffect, useCallback } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { ClientMediaBudget, Client } from '../types';

export function normalizePlatformKey(platform?: string | null): string {
  if (!platform) return 'total';
  const p = platform.toLowerCase().trim();
  if (p === 'total' || p === 'all' || p === 'geral') return 'total';
  if (p.includes('meta')) return 'meta';
  if (p.includes('google')) return 'google';
  if (p.includes('tiktok')) return 'tiktok';
  if (p.includes('linkedin')) return 'linkedin';
  if (p.includes('youtube')) return 'youtube';
  if (p.includes('pinterest')) return 'pinterest';
  return p;
}

export function getPlatformLabel(platform?: string | null): string {
  const key = normalizePlatformKey(platform);
  switch (key) {
    case 'total': return 'Verba Total de Mídia';
    case 'meta': return 'Meta Ads';
    case 'google': return 'Google Ads';
    case 'tiktok': return 'TikTok Ads';
    case 'linkedin': return 'LinkedIn Ads';
    case 'youtube': return 'YouTube Ads';
    case 'pinterest': return 'Pinterest Ads';
    default: return platform || 'Verba de Mídia';
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
  const [budgetHistory, setBudgetHistory] = useState<ClientMediaBudget[]>([]);
  const [consumptions, setConsumptions] = useState<Record<string, PlatformBudgetConsumption>>({});
  const [totalConsumption, setTotalConsumption] = useState<PlatformBudgetConsumption | null>(null);
  const [alerts, setAlerts] = useState<ClientBudgetAlert[]>([]);
  const [overBudgetClientIds, setOverBudgetClientIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const monthYear = targetMonthYear || dayjs().format('YYYY-MM');

  // Load budgets for a single client for selected month
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

  // Load last 6 months budget history for this client
  const fetchBudgetHistory = useCallback(async () => {
    if (!agencyId || !clientId) return;
    try {
      const { data, error } = await supabase
        .from('client_media_budgets')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('client_id', clientId)
        .order('month_year', { ascending: false });

      if (!error && data) {
        // Group by month_year, prioritizing platform === 'total'
        const monthMap = new Map<string, ClientMediaBudget>();
        (data as ClientMediaBudget[]).forEach(item => {
          if (!monthMap.has(item.month_year)) {
            monthMap.set(item.month_year, item);
          } else {
            const prev = monthMap.get(item.month_year)!;
            if (item.platform === 'total') {
              monthMap.set(item.month_year, item);
            } else if (prev.platform !== 'total') {
              monthMap.set(item.month_year, {
                ...prev,
                budget_amount: Number(prev.budget_amount || 0) + Number(item.budget_amount || 0)
              });
            }
          }
        });

        const sortedHistory = Array.from(monthMap.values())
          .sort((a, b) => b.month_year.localeCompare(a.month_year))
          .slice(0, 6);

        setBudgetHistory(sortedHistory);
      }
    } catch (e) {
      console.error('Erro ao buscar histórico de verbas de mídia:', e);
    }
  }, [agencyId, clientId]);

  // Save budget for client (Unified total budget with upsert by client_id + agency_id + month_year + platform='total')
  const saveBudget = async (
    amountOrPlatform: number | string,
    amountOrMonth?: number | string,
    targetMonth?: string
  ) => {
    if (!agencyId || !clientId) return { success: false, error: 'Cliente não identificado' };

    let platform = 'total';
    let amount = 0;
    let selectedMY = monthYear;

    if (typeof amountOrPlatform === 'number') {
      amount = amountOrPlatform;
      if (typeof amountOrMonth === 'string') {
        selectedMY = amountOrMonth;
      }
    } else if (typeof amountOrPlatform === 'string' && typeof amountOrMonth === 'number') {
      platform = normalizePlatformKey(amountOrPlatform);
      amount = amountOrMonth;
      if (targetMonth) {
        selectedMY = targetMonth;
      }
    } else if (typeof amountOrPlatform === 'string') {
      amount = parseFloat(amountOrPlatform) || 0;
      if (typeof amountOrMonth === 'string') {
        selectedMY = amountOrMonth;
      }
    }

    try {
      // Check if record exists for client + agency + month_year + platform
      const { data: existing } = await supabase
        .from('client_media_budgets')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('client_id', clientId)
        .eq('month_year', selectedMY)
        .eq('platform', platform)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('client_media_budgets')
          .update({ 
            budget_amount: amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('client_media_budgets')
          .insert([{
            agency_id: agencyId,
            client_id: clientId,
            month_year: selectedMY,
            platform: platform,
            budget_amount: amount,
          }]);
        if (error) throw error;
      }

      await fetchClientBudgets();
      await fetchBudgetHistory();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar verba de mídia:', err);
      return { success: false, error: err.message || 'Erro ao salvar' };
    }
  };

  // Fetch consumption for a single client (Total consumption across all platforms)
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

      let totalBudget = 0;
      const budgetMap: Record<string, number> = {};
      
      const totalBudgetRecord = (bData || []).find((b: any) => normalizePlatformKey(b.platform) === 'total');
      if (totalBudgetRecord) {
        totalBudget = Number(totalBudgetRecord.budget_amount) || 0;
      } else {
        // Fallback to summing platform-specific budgets
        (bData || []).forEach((b: any) => {
          const key = normalizePlatformKey(b.platform);
          const amt = Number(b.budget_amount) || 0;
          budgetMap[key] = amt;
          totalBudget += amt;
        });
      }

      (bData || []).forEach((b: any) => {
        const key = normalizePlatformKey(b.platform);
        budgetMap[key] = Number(b.budget_amount) || 0;
      });

      // 2. Fetch daily investments across all platforms for this client in the month
      const { data: iData } = await supabase
        .from('paid_traffic_daily')
        .select('platform, investment')
        .eq('agency_id', agencyId)
        .eq('client_id', clientId)
        .gte('report_date', startOfMonth)
        .lte('report_date', endOfMonth);

      let totalInvested = 0;
      const investmentMap: Record<string, number> = {};
      (iData || []).forEach((row: any) => {
        const key = normalizePlatformKey(row.platform);
        const inv = Number(row.investment) || 0;
        investmentMap[key] = (investmentMap[key] || 0) + inv;
        totalInvested += inv;
      });

      // Build unified total consumption
      const totalPercentage = totalBudget > 0 ? Math.round((totalInvested / totalBudget) * 100) : 0;
      const totalRemaining = Math.max(0, totalBudget - totalInvested);
      const totalExceeded = totalInvested > totalBudget ? totalInvested - totalBudget : 0;
      const totalIsOver = totalBudget > 0 && totalInvested > totalBudget;
      const totalIsHigh = totalBudget > 0 && totalPercentage >= 85 && !totalIsOver;

      let totalStatusColor: 'green' | 'yellow' | 'red' = 'green';
      if (totalPercentage > 90 || totalIsOver) {
        totalStatusColor = 'red';
      } else if (totalPercentage >= 70) {
        totalStatusColor = 'yellow';
      }

      const totalObj: PlatformBudgetConsumption = {
        platformKey: 'total',
        platformLabel: 'Verba Total de Mídia',
        budgetAmount: totalBudget,
        investedAmount: totalInvested,
        percentage: totalPercentage,
        remainingAmount: totalRemaining,
        exceededAmount: totalExceeded,
        isOverBudget: totalIsOver,
        isHighConsumption: totalIsHigh,
        statusColor: totalStatusColor,
      };

      setTotalConsumption(totalObj);

      // Build platform dict for backward compatibility
      const result: Record<string, PlatformBudgetConsumption> = {
        total: totalObj
      };

      const normalizedPlatforms = Array.from(new Set(platformsToTrack.map(normalizePlatformKey))).filter(Boolean);
      normalizedPlatforms.forEach((pKey) => {
        const budget = budgetMap[pKey] || (pKey === 'total' ? totalBudget : 0);
        const invested = investmentMap[pKey] || (pKey === 'total' ? totalInvested : 0);
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

      // Group total budget per client (prioritizing platform='total')
      const budgetByClient: Record<string, number> = {};
      const platformBudgetsByClient: Record<string, Record<string, number>> = {};

      budgetsData.forEach((b: any) => {
        const cId = b.client_id;
        const pKey = normalizePlatformKey(b.platform);
        const amount = Number(b.budget_amount) || 0;

        if (!platformBudgetsByClient[cId]) platformBudgetsByClient[cId] = {};
        platformBudgetsByClient[cId][pKey] = amount;

        if (pKey === 'total') {
          budgetByClient[cId] = amount;
        } else if (budgetByClient[cId] === undefined) {
          budgetByClient[cId] = (budgetByClient[cId] || 0) + amount;
        }
      });

      // 3. Fetch investments for current month
      const { data: investmentsData } = await supabase
        .from('paid_traffic_daily')
        .select('client_id, platform, investment')
        .eq('agency_id', agencyId)
        .in('client_id', activeClientIds)
        .gte('report_date', startOfMonth)
        .lte('report_date', endOfMonth);

      const totalInvestmentByClient: Record<string, number> = {};
      (investmentsData || []).forEach((row: any) => {
        const cId = row.client_id;
        totalInvestmentByClient[cId] = (totalInvestmentByClient[cId] || 0) + (Number(row.investment) || 0);
      });

      const newAlerts: ClientBudgetAlert[] = [];
      const overBudgetSet = new Set<string>();

      Object.keys(budgetByClient).forEach((cId) => {
        const clientName = clientNameMap[cId] || 'Cliente';
        const budget = budgetByClient[cId] || 0;
        if (budget <= 0) return;

        const invested = totalInvestmentByClient[cId] || 0;
        const percentage = Math.round((invested / budget) * 100);

        if (invested > budget) {
          overBudgetSet.add(cId);
          newAlerts.push({
            clientId: cId,
            clientName,
            platformKey: 'total',
            platformLabel: 'Verba de Mídia',
            type: 'over_budget',
            percentage,
            remainingDays: remainingDaysInMonth,
            budgetAmount: budget,
            investedAmount: invested,
            exceededAmount: invested - budget,
            remainingAmount: 0,
          });
        } else if (percentage >= 85 && remainingDaysInMonth > 5) {
          newAlerts.push({
            clientId: cId,
            clientName,
            platformKey: 'total',
            platformLabel: 'Verba de Mídia',
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

      setAlerts(newAlerts);
      setOverBudgetClientIds(overBudgetSet);
    } catch (e) {
      console.error('Erro ao calcular alertas de verba de mídia:', e);
    }
  }, [agencyId]);

  useEffect(() => {
    if (clientId) {
      fetchClientBudgets();
      fetchBudgetHistory();
    }
  }, [clientId, fetchClientBudgets, fetchBudgetHistory]);

  return {
    budgets,
    budgetHistory,
    consumptions,
    totalConsumption,
    alerts,
    overBudgetClientIds,
    loading,
    fetchClientBudgets,
    fetchBudgetHistory,
    fetchClientConsumption,
    fetchAgencyBudgetAlerts,
    saveBudget,
  };
}


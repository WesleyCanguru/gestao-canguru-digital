import { useState, useEffect, useCallback } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { 
  calculateAllClientsLtv, 
  calculateSingleClientLtv, 
  ClientLtvDetails, 
  calculateAgencyAvgRetentionMonths 
} from '../lib/clientLtv';

export function useAgencyClientsLtv() {
  const { agencyId } = useAuth();
  const [ltvList, setLtvList] = useState<ClientLtvDetails[]>([]);
  const [ltvMap, setLtvMap] = useState<Record<string, ClientLtvDetails>>({});
  const [loading, setLoading] = useState(true);

  const fetchLtvData = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);

    try {
      // 1. Clientes
      const { data: clientsData, error: clientsErr } = await supabase
        .from('clients')
        .select('id, name, logo_url, color, initials, base_value, created_at, client_status, cancelled_at, features_settings, is_internal')
        .eq('agency_id', agencyId);

      if (clientsErr) {
        console.warn('Erro ao buscar clientes para LTV:', clientsErr);
      }

      // 2. Contratos (para obter o contract_value e contract_start_date)
      const { data: contractsData } = await supabase
        .from('contract_forms')
        .select('id, client_id, contract_value, contract_start_date, form_data')
        .eq('agency_id', agencyId);

      const contractsMap = new Map<string, any>();
      (contractsData || []).forEach(c => {
        if (c.client_id) contractsMap.set(c.client_id, c);
      });

      // 3. Faturamentos pagos por cliente
      const { data: billingsData } = await supabase
        .from('agency_billing')
        .select('client_id, base_value, extra_value, status')
        .eq('agency_id', agencyId)
        .eq('status', 'paid');

      const paidBillingsMap: Record<string, number> = {};
      (billingsData || []).forEach(b => {
        if (b.client_id) {
          const val = (Number(b.base_value) || 0) + (Number(b.extra_value) || 0);
          paidBillingsMap[b.client_id] = (paidBillingsMap[b.client_id] || 0) + val;
        }
      });

      // Enriquecer objeto client com contract info
      const enrichedClients = (clientsData || [])
        .filter(c => !c.is_internal)
        .map(client => {
          const contract = contractsMap.get(client.id);
          return {
            ...client,
            contract
          };
        });

      // Calcular LTV de todos os clientes
      const computedLtvList = calculateAllClientsLtv(enrichedClients, paidBillingsMap);

      const map: Record<string, ClientLtvDetails> = {};
      computedLtvList.forEach(item => {
        map[item.clientId] = item;
      });

      setLtvList(computedLtvList);
      setLtvMap(map);
    } catch (err) {
      console.error('Erro ao calcular LTVs da agência:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    fetchLtvData();
  }, [fetchLtvData]);

  return {
    ltvList,
    ltvMap,
    loading,
    refetchLtv: fetchLtvData
  };
}

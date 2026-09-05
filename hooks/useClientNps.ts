import { useState, useCallback, useEffect } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import { ClientNps } from '../types';

export function getNpsPublicUrl(token: string): string {
  if (typeof window === 'undefined') {
    return `https://bolsa.cangurudigital.com.br/nps/${token}`;
  }
  const isCanguruHost = window.location.hostname.includes('cangurudigital.com.br');
  const base = isCanguruHost ? 'https://bolsa.cangurudigital.com.br' : window.location.origin;
  return `${base}/nps/${token}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText falhou, tentando fallback', err);
  }

  // Fallback para navegadores / iframes que restrinjam a API de clipboard
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Falha no fallback de cópia para o clipboard', err);
    return false;
  }
}

export function useClientNps(clientId?: string | null, agencyId?: number | null) {
  const [history, setHistory] = useState<ClientNps[]>([]);
  const [currentMonthNps, setCurrentMonthNps] = useState<ClientNps | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentMonthYear = dayjs().format('YYYY-MM');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 4000);
  };

  const fetchHistory = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_nps')
        .select('*')
        .eq('client_id', clientId)
        .order('month_year', { ascending: false })
        .limit(12);

      if (error) {
        console.error('Erro ao buscar histórico de NPS do cliente:', error);
      } else {
        const list = (data as ClientNps[]) || [];
        setHistory(list);
        const current = list.find(item => item.month_year === currentMonthYear) || null;
        setCurrentMonthNps(current);
      }
    } catch (err) {
      console.error('Erro fatal ao buscar NPS:', err);
    } finally {
      setLoading(false);
    }
  }, [clientId, currentMonthYear]);

  useEffect(() => {
    if (clientId) {
      fetchHistory();
    }
  }, [clientId, fetchHistory]);

  const sendSurvey = useCallback(async (targetClientId?: string, targetAgencyId?: number, monthYear?: string): Promise<{ success: boolean; url?: string; token?: string; error?: string }> => {
    const cId = targetClientId || clientId;
    const aId = targetAgencyId || agencyId || 1;
    const mYear = monthYear || currentMonthYear;

    if (!cId) {
      return { success: false, error: 'Cliente não informado.' };
    }

    setSending(true);
    try {
      // 1. Verificar se já existe um registro client_nps para esse cliente no month_year
      const { data: existing, error: findError } = await supabase
        .from('client_nps')
        .select('*')
        .eq('client_id', cId)
        .eq('month_year', mYear)
        .maybeSingle();

      if (findError) {
        console.error('Erro ao verificar NPS existente:', findError);
      }

      let record = existing as ClientNps | null;

      if (!record) {
        // 2. Se não existir: criar o registro com sent_at = now(), score = null, responded_at = null
        const token = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : ((r & 0x3) | 0x8);
          return v.toString(16);
        });

        const { data: inserted, error: insertError } = await supabase
          .from('client_nps')
          .insert({
            agency_id: aId,
            client_id: cId,
            month_year: mYear,
            token,
            sent_at: new Date().toISOString(),
            score: null,
            comment: null,
            responded_at: null
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }
        record = inserted as ClientNps;
      } else if (!record.sent_at) {
        // Se existia mas ainda não tinha sent_at gravado
        const { data: updated } = await supabase
          .from('client_nps')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', record.id)
          .select()
          .single();
        if (updated) record = updated as ClientNps;
      }

      // 3. Gerar e copiar para o clipboard o link público
      const publicUrl = getNpsPublicUrl(record.token);
      await copyToClipboard(publicUrl);

      // 4. Exibir toast: "Link copiado! Envie para o cliente."
      showToast('Link copiado! Envie para o cliente.');

      // Atualizar estado se for para o cliente atual
      if (cId === clientId) {
        await fetchHistory();
      }

      return { success: true, url: publicUrl, token: record.token };
    } catch (err: any) {
      console.error('Erro ao enviar pesquisa de NPS:', err);
      const msg = err.message || 'Erro ao gerar link de pesquisa.';
      showToast(msg);
      return { success: false, error: msg };
    } finally {
      setSending(false);
    }
  }, [clientId, agencyId, currentMonthYear, fetchHistory]);

  return {
    history,
    currentMonthNps,
    loading,
    sending,
    toastMessage,
    sendSurvey,
    fetchHistory,
    showToast
  };
}

// Hook para carregar o NPS do mês atual de múltiplos clientes (para listagens/cards)
export function useAllClientsCurrentMonthNps(agencyId?: number | null) {
  const [npsMap, setNpsMap] = useState<Record<string, ClientNps>>({});
  const [loading, setLoading] = useState(false);
  const currentMonthYear = dayjs().format('YYYY-MM');

  const fetchMonthNps = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('client_nps')
        .select('*')
        .eq('month_year', currentMonthYear);

      if (agencyId) {
        query = query.eq('agency_id', agencyId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Erro ao buscar NPS do mês dos clientes:', error);
      } else if (data) {
        const map: Record<string, ClientNps> = {};
        data.forEach((item: ClientNps) => {
          map[item.client_id] = item;
        });
        setNpsMap(map);
      }
    } catch (err) {
      console.error('Erro ao carregar mapa de NPS:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, currentMonthYear]);

  useEffect(() => {
    fetchMonthNps();
  }, [fetchMonthNps]);

  return {
    npsMap,
    loading,
    refresh: fetchMonthNps,
    currentMonthYear
  };
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { ClientRevenueEvent, RevenueEventType } from '../types';
import dayjs from 'dayjs';

export function useClientRevenueEvents(clientId?: string | null, targetYear?: number) {
  const { agencyId } = useAuth();
  const [events, setEvents] = useState<ClientRevenueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedYear = targetYear || dayjs().year();

  const fetchEvents = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('client_revenue_events')
        .select(`
          id,
          agency_id,
          client_id,
          event_type,
          previous_value,
          new_value,
          delta,
          note,
          occurred_at,
          created_at,
          clients (
            id,
            name,
            initials,
            color,
            logo_url
          )
        `)
        .eq('agency_id', agencyId)
        .order('occurred_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error: err } = await query;

      if (err) {
        console.warn('Erro ao buscar client_revenue_events:', err);
        // Se a tabela ainda não tiver dados ou houver erro de permissão, mantemos vazio de forma graciosa
        setEvents([]);
      } else if (data) {
        const formattedEvents: ClientRevenueEvent[] = data.map((item: any) => ({
          id: item.id,
          agency_id: item.agency_id,
          client_id: item.client_id,
          event_type: item.event_type as RevenueEventType,
          previous_value: Number(item.previous_value) || 0,
          new_value: Number(item.new_value) || 0,
          delta: Number(item.delta) || 0,
          note: item.note || null,
          occurred_at: item.occurred_at,
          created_at: item.created_at,
          client: item.clients ? {
            id: item.clients.id,
            name: item.clients.name,
            initials: item.clients.initials,
            color: item.clients.color,
            logo_url: item.clients.logo_url,
          } as any : undefined
        }));
        setEvents(formattedEvents);
      }
    } catch (e: any) {
      console.error('Falha ao buscar eventos de receita:', e);
      setError(e.message || 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [agencyId, clientId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const addRevenueEvent = async (event: {
    client_id: string;
    event_type: RevenueEventType;
    previous_value: number;
    new_value: number;
    delta?: number;
    note?: string | null;
    occurred_at?: string;
  }): Promise<{ success: boolean; data?: ClientRevenueEvent; error?: any }> => {
    if (!agencyId) return { success: false, error: 'Sem agencyId' };

    const calculatedDelta = event.delta !== undefined ? event.delta : (event.new_value - event.previous_value);
    const occurredAt = event.occurred_at || dayjs().format('YYYY-MM-DD');

    try {
      const payload = {
        agency_id: agencyId,
        client_id: event.client_id,
        event_type: event.event_type,
        previous_value: event.previous_value,
        new_value: event.new_value,
        delta: calculatedDelta,
        note: event.note?.trim() || null,
        occurred_at: occurredAt
      };

      const { data, error: insertError } = await supabase
        .from('client_revenue_events')
        .insert([payload])
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao inserir client_revenue_events:', insertError);
        throw insertError;
      }

      await fetchEvents();
      return { success: true, data };
    } catch (err: any) {
      console.error('Erro ao salvar evento de receita:', err);
      return { success: false, error: err };
    }
  };

  const deleteRevenueEvent = async (eventId: string): Promise<{ success: boolean; error?: any }> => {
    try {
      const { error: delError } = await supabase
        .from('client_revenue_events')
        .delete()
        .eq('id', eventId);

      if (delError) throw delError;

      setEvents(prev => prev.filter(e => e.id !== eventId));
      return { success: true };
    } catch (err) {
      console.error('Erro ao deletar evento de receita:', err);
      return { success: false, error: err };
    }
  };

  // Estatísticas de expansão do ano (Upsells / deltas positivos)
  const expansionStats = useMemo(() => {
    const yearEvents = events.filter(e => {
      const eventYear = dayjs(e.occurred_at).year();
      return eventYear === selectedYear;
    });

    const upsellEvents = yearEvents.filter(e => e.event_type === 'upsell' || (e.delta > 0 && e.event_type !== 'reactivation' && e.event_type !== 'new_client'));
    const totalUpsellDelta = upsellEvents.reduce((sum, e) => sum + Math.max(0, e.delta), 0);

    const downsellEvents = yearEvents.filter(e => e.event_type === 'downsell' || e.delta < 0);
    const totalDownsellDelta = downsellEvents.reduce((sum, e) => sum + Math.abs(Math.min(0, e.delta)), 0);

    const churnEvents = yearEvents.filter(e => e.event_type === 'churn');
    const reactivationEvents = yearEvents.filter(e => e.event_type === 'reactivation');

    return {
      year: selectedYear,
      upsellCount: upsellEvents.length,
      totalUpsellDelta,
      downsellCount: downsellEvents.length,
      totalDownsellDelta,
      churnCount: churnEvents.length,
      reactivationCount: reactivationEvents.length,
      netExpansion: totalUpsellDelta - totalDownsellDelta,
      totalEventsInYear: yearEvents.length
    };
  }, [events, selectedYear]);

  return {
    events,
    loading,
    error,
    refresh: fetchEvents,
    addRevenueEvent,
    deleteRevenueEvent,
    expansionStats
  };
}

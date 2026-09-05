import { useState, useCallback, useEffect } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import { ClientHealthScore } from '../types';

export function getHealthScoreCategory(score: number): {
  color: 'green' | 'yellow' | 'red';
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
} {
  if (score >= 80) {
    return {
      color: 'green',
      label: 'Cliente saudável',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-700',
      badgeBorder: 'border-emerald-200/80',
      dotColor: 'bg-emerald-500',
    };
  } else if (score >= 60) {
    return {
      color: 'yellow',
      label: 'Atenção necessária',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-700',
      badgeBorder: 'border-amber-200/80',
      dotColor: 'bg-amber-500',
    };
  } else {
    return {
      color: 'red',
      label: 'Risco de churn',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-700',
      badgeBorder: 'border-rose-200/80',
      dotColor: 'bg-rose-500',
    };
  }
}

/**
 * Calcula e persiste o Health Score de um cliente em determinado mês.
 */
export async function calculateClientHealthScore(
  clientId: string,
  agencyId: number,
  monthYear: string
): Promise<ClientHealthScore | null> {
  if (!clientId || !agencyId || !monthYear) return null;

  try {
    // 0. Buscar registro existente para preservar penalidade manual e notas
    const { data: existing } = await supabase
      .from('client_health_scores')
      .select('*')
      .eq('client_id', clientId)
      .eq('month_year', monthYear)
      .maybeSingle();

    const manualPenalty = existing?.manual_penalty ?? 0;
    const manualNotes = existing?.manual_notes ?? null;

    // 1. Velocidade de Aprovação (0-25 pts)
    // Buscar posts do cliente criados ou agendados no mês/ano
    const { data: posts } = await supabase
      .from('posts')
      .select('id, created_at, updated_at, status, date_key')
      .eq('client_id', clientId)
      .eq('is_deleted', false);

    const monthPosts = (posts || []).filter(p => {
      if (p.date_key && p.date_key.includes(monthYear)) return true;
      if (p.created_at && dayjs(p.created_at).format('YYYY-MM') === monthYear) return true;
      return false;
    });

    const postIds = monthPosts.map(p => p.id).filter(Boolean);

    let approvalSpeedScore = 10; // Padrão neutro (se nenhum post aprovado no mês)

    if (postIds.length > 0) {
      const { data: revisions } = await supabase
        .from('post_revisions')
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      const approvedPostsDiffs: number[] = [];

      monthPosts.forEach(post => {
        const postRevs = (revisions || []).filter(r => r.post_id === post.id);
        const reviewRev = postRevs.find(r => r.status_after === 'review' || r.status_after === 'aguardando_aprovacao' || r.action === 'created');
        const approvedRev = postRevs.find(r => r.status_after === 'approved' || r.status_after === 'aprovado' || r.action === 'approved');

        if (approvedRev) {
          const reviewTime = reviewRev?.created_at ? dayjs(reviewRev.created_at) : dayjs(post.created_at);
          const approvedTime = dayjs(approvedRev.created_at);
          const diffDays = Math.max(0, approvedTime.diff(reviewTime, 'day', true));
          approvedPostsDiffs.push(diffDays);
        } else if (post.status === 'approved' || post.status === 'aprovado') {
          // Fallback se aprovado sem revision explícita
          const reviewTime = dayjs(post.created_at);
          const approvedTime = dayjs(post.updated_at || post.created_at);
          const diffDays = Math.max(0, approvedTime.diff(reviewTime, 'day', true));
          approvedPostsDiffs.push(diffDays);
        }
      });

      if (approvedPostsDiffs.length > 0) {
        const avgDays = approvedPostsDiffs.reduce((a, b) => a + b, 0) / approvedPostsDiffs.length;
        if (avgDays <= 1) {
          approvalSpeedScore = 25;
        } else if (avgDays <= 2) {
          approvalSpeedScore = 20;
        } else if (avgDays <= 3) {
          approvalSpeedScore = 15;
        } else {
          approvalSpeedScore = 10;
        }
      }
    }

    // 2. Pagamento em dia (0-25 pts)
    const { data: billing } = await supabase
      .from('agency_billing')
      .select('*')
      .eq('client_id', clientId)
      .eq('month_year', monthYear)
      .maybeSingle();

    let paymentScore = 25; // Se não tem cobrança ou fatura criada, considera neutro/25

    if (billing) {
      if (billing.status === 'paid') {
        if (billing.paid_at && billing.due_date) {
          const daysLate = dayjs(billing.paid_at).diff(dayjs(billing.due_date), 'day');
          if (daysLate <= 0) {
            paymentScore = 25;
          } else if (daysLate <= 5) {
            paymentScore = 15;
          } else {
            paymentScore = 5;
          }
        } else {
          paymentScore = 25;
        }
      } else {
        // Fatura pendente / em aberto
        const today = dayjs().startOf('day');
        const dueDate = billing.due_date ? dayjs(billing.due_date) : today;
        
        if (today.isAfter(dueDate, 'day')) {
          const daysOverdue = today.diff(dueDate, 'day');
          if (daysOverdue <= 5) {
            paymentScore = 15;
          } else {
            paymentScore = 0; // Não paga / em aberto com mais de 5 dias
          }
        } else {
          paymentScore = 25; // Ainda dentro do prazo de vencimento
        }
      }
    }

    // 3. NPS do mês (0-25 pts)
    const { data: nps } = await supabase
      .from('client_nps')
      .select('*')
      .eq('client_id', clientId)
      .eq('month_year', monthYear)
      .maybeSingle();

    let npsScore = 15; // Neutro se não respondeu / sem registro

    if (nps && nps.score !== null && nps.score !== undefined && nps.responded_at) {
      const val = Number(nps.score);
      if (val >= 9) {
        npsScore = 25;
      } else if (val >= 7) {
        npsScore = 18;
      } else if (val >= 5) {
        npsScore = 10;
      } else {
        npsScore = 0;
      }
    }

    // 4. Ausência de rejeições múltiplas (0-25 pts)
    let rejectionScore = 25;

    if (postIds.length > 0) {
      const { data: revisions } = await supabase
        .from('post_revisions')
        .select('post_id, action, rejection_reason, status_after')
        .in('post_id', postIds);

      // Contar quantas rejeições cada post teve
      const rejectionCountByPost: Record<string, number> = {};

      (revisions || []).forEach(r => {
        if (r.rejection_reason || r.action === 'rejection_created' || r.status_after === 'rejected') {
          rejectionCountByPost[r.post_id] = (rejectionCountByPost[r.post_id] || 0) + 1;
        }
      });

      const multiRejectionPosts = Object.values(rejectionCountByPost).filter(count => count > 1).length;

      if (multiRejectionPosts === 0) {
        rejectionScore = 25;
      } else if (multiRejectionPosts === 1) {
        rejectionScore = 18;
      } else if (multiRejectionPosts === 2) {
        rejectionScore = 10;
      } else {
        rejectionScore = 0;
      }
    }

    // Score final com penalidade manual
    const subtotal = approvalSpeedScore + paymentScore + npsScore + rejectionScore;
    const finalScore = Math.max(0, Math.min(100, subtotal - manualPenalty));

    const record: ClientHealthScore = {
      agency_id: agencyId,
      client_id: clientId,
      month_year: monthYear,
      score: finalScore,
      approval_speed_score: approvalSpeedScore,
      payment_score: paymentScore,
      nps_score: npsScore,
      rejection_score: rejectionScore,
      manual_penalty: manualPenalty,
      manual_notes: manualNotes,
      calculated_at: new Date().toISOString()
    };

    const { data: savedData, error: saveErr } = await supabase
      .from('client_health_scores')
      .upsert(record, { onConflict: 'client_id,month_year' })
      .select('*')
      .single();

    if (saveErr) {
      console.error('Erro ao salvar client_health_scores:', saveErr);
      return record;
    }

    return savedData as ClientHealthScore;
  } catch (err) {
    console.error('Erro ao calcular health score:', err);
    return null;
  }
}

/**
 * Calcula e atualiza o health score de todos os clientes ativos da agência para o mês atual.
 */
export async function calculateAllActiveClientsHealthScore(
  agencyId: number,
  monthYear?: string
): Promise<Record<string, ClientHealthScore>> {
  const targetMY = monthYear || dayjs().format('YYYY-MM');
  const resultMap: Record<string, ClientHealthScore> = {};

  try {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, is_internal, client_status')
      .eq('agency_id', agencyId);

    const activeClients = (clients || []).filter(
      c => !c.is_internal && c.client_status !== 'cancelled' && c.client_status !== 'inactive'
    );

    await Promise.all(
      activeClients.map(async client => {
        const score = await calculateClientHealthScore(client.id, agencyId, targetMY);
        if (score) resultMap[client.id] = score;
      })
    );
  } catch (err) {
    console.error('Erro ao recalcular health scores em lote:', err);
  }

  return resultMap;
}

/**
 * Hook para obter o Health Score atual do mês e o histórico dos últimos 6 meses de um cliente.
 */
export function useClientHealthScore(clientId?: string | null, agencyId?: number | null, selectedMY?: string) {
  const currentMonthYear = selectedMY || dayjs().format('YYYY-MM');
  const [currentScore, setCurrentScore] = useState<ClientHealthScore | null>(null);
  const [history, setHistory] = useState<ClientHealthScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingPenalty, setSavingPenalty] = useState(false);

  const fetchScore = useCallback(async () => {
    if (!clientId || !agencyId) return;
    setLoading(true);

    try {
      // 1. Buscar do banco ou calcular se não existir
      let { data, error } = await supabase
        .from('client_health_scores')
        .select('*')
        .eq('client_id', clientId)
        .eq('month_year', currentMonthYear)
        .maybeSingle();

      if (!data) {
        // Calcular se não existir
        const calculated = await calculateClientHealthScore(clientId, agencyId, currentMonthYear);
        if (calculated) data = calculated;
      }

      if (data) setCurrentScore(data as ClientHealthScore);

      // 2. Buscar histórico dos últimos 6 meses
      const { data: historyData } = await supabase
        .from('client_health_scores')
        .select('*')
        .eq('client_id', clientId)
        .order('month_year', { ascending: false })
        .limit(6);

      if (historyData) {
        setHistory(historyData as ClientHealthScore[]);
      }
    } catch (err) {
      console.error('Erro ao buscar health score do cliente:', err);
    } finally {
      setLoading(false);
    }
  }, [clientId, agencyId, currentMonthYear]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  const recalculate = async () => {
    if (!clientId || !agencyId) return;
    setLoading(true);
    const updated = await calculateClientHealthScore(clientId, agencyId, currentMonthYear);
    if (updated) {
      setCurrentScore(updated);
      await fetchScore();
    }
    setLoading(false);
  };

  const updateManualPenalty = async (penalty: number, notes: string) => {
    if (!clientId || !agencyId) return;
    setSavingPenalty(true);

    try {
      const subtotal = (currentScore?.approval_speed_score ?? 25) +
        (currentScore?.payment_score ?? 25) +
        (currentScore?.nps_score ?? 15) +
        (currentScore?.rejection_score ?? 25);

      const finalScore = Math.max(0, Math.min(100, subtotal - penalty));

      const payload = {
        agency_id: agencyId,
        client_id: clientId,
        month_year: currentMonthYear,
        score: finalScore,
        approval_speed_score: currentScore?.approval_speed_score ?? 25,
        payment_score: currentScore?.payment_score ?? 25,
        nps_score: currentScore?.nps_score ?? 15,
        rejection_score: currentScore?.rejection_score ?? 25,
        manual_penalty: penalty,
        manual_notes: notes.trim() || null,
        calculated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('client_health_scores')
        .upsert(payload, { onConflict: 'client_id,month_year' })
        .select('*')
        .single();

      if (!error && data) {
        setCurrentScore(data as ClientHealthScore);
        await fetchScore();
      }
    } catch (err) {
      console.error('Erro ao atualizar penalidade manual do health score:', err);
    } finally {
      setSavingPenalty(false);
    }
  };

  return {
    currentScore,
    history,
    loading,
    savingPenalty,
    recalculate,
    updateManualPenalty,
    refetch: fetchScore
  };
}

/**
 * Hook para obter os Health Scores do mês atual para TODOS os clientes da agência.
 */
export function useAllClientsCurrentMonthHealthScores(agencyId?: number | null) {
  const currentMonthYear = dayjs().format('YYYY-MM');
  const [healthMap, setHealthMap] = useState<Record<string, ClientHealthScore>>({});
  const [loading, setLoading] = useState(false);

  const fetchAllScores = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('client_health_scores')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('month_year', currentMonthYear);

      if (!error && data) {
        const map: Record<string, ClientHealthScore> = {};
        data.forEach((item: any) => {
          map[item.client_id] = item as ClientHealthScore;
        });
        setHealthMap(map);
      } else {
        // Se a lista estiver vazia ou com erro, recalcula para clientes
        const map = await calculateAllActiveClientsHealthScore(agencyId, currentMonthYear);
        setHealthMap(map);
      }
    } catch (err) {
      console.error('Erro ao buscar todos os health scores:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, currentMonthYear]);

  useEffect(() => {
    fetchAllScores();
  }, [fetchAllScores]);

  const refreshAll = async () => {
    if (!agencyId) return;
    setLoading(true);
    const updated = await calculateAllActiveClientsHealthScore(agencyId, currentMonthYear);
    setHealthMap(updated);
    setLoading(false);
  };

  return {
    healthMap,
    loading,
    refreshAll
  };
}

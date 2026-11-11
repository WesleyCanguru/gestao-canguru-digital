import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Quantos clientes novos estão esperando alguma ação da equipe no onboarding:
// pediu ajuda nos acessos, mandou acesso para conferir, falta montar/ajustar a estratégia
// ou a estratégia foi aprovada e falta colocar a campanha no ar.
export async function countOnboardingPending(agencyId: number): Promise<number> {
  const { data: cl } = await supabase.from('clients')
    .select('id, onboarding_status, campaign_live_at, traffic_strategy_data')
    .eq('agency_id', agencyId).is('campaign_live_at', null);
  const clients = ((cl as any[]) || []).filter(c => c.traffic_strategy_data?.created_via === 'public_onboarding');
  if (!clients.length) return 0;
  const ids = clients.map(c => c.id);
  const [a, s] = await Promise.all([
    supabase.from('client_platform_access').select('client_id, status').in('client_id', ids),
    supabase.from('client_strategies').select('client_id, status, version').in('client_id', ids).order('version', { ascending: false }),
  ]);
  const latest: Record<string, string> = {};
  ((s.data as any[]) || []).forEach(r => { if (!(r.client_id in latest)) latest[r.client_id] = r.status; });
  const pending = new Set<string>();
  ((a.data as any[]) || []).forEach(r => { if (r.status === 'help' || r.status === 'client_done') pending.add(r.client_id); });
  clients.forEach(c => {
    if (c.onboarding_status !== 'concluido') return;
    const st = latest[c.id];
    if (!st || st === 'draft' || st === 'changes' || st === 'approved') pending.add(c.id);
  });
  return pending.size;
}

export function useOnboardingPending(agencyId: number | null | undefined, enabled = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!agencyId || !enabled) { setCount(0); return; }
    let alive = true;
    const run = () => countOnboardingPending(agencyId).then(n => { if (alive) setCount(n); }).catch(() => {});
    run();
    const timer = window.setInterval(run, 60_000);
    const onFocus = () => run();
    window.addEventListener('focus', onFocus);
    window.addEventListener('bolsa:onboarding-changed', onFocus);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', onFocus); window.removeEventListener('bolsa:onboarding-changed', onFocus); };
  }, [agencyId, enabled]);
  return count;
}

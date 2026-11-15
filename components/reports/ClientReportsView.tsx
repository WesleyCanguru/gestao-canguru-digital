import React, { useEffect, useState } from 'react';
import { FileBarChart, ChevronRight, Loader2 } from 'lucide-react';
import { supabase, useAuth } from '../../lib/supabase';
import { useT } from '../../lib/i18n';

/** Portal do cliente › Relatórios: os resumos semanais, mensais e trimestrais já gerados. */
export const ClientReportsView: React.FC = () => {
  const { activeClient } = useAuth();
  const { t, locale } = useT();
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => {
    if (!activeClient?.id) return;
    supabase.from('reports').select('id, period, period_start, period_end, token, summary').eq('client_id', activeClient.id).eq('audience', 'client').neq('status', 'hidden')
      .order('period_start', { ascending: false }).limit(60).then(({ data }) => setList((data as any[]) || []));
  }, [activeClient?.id]);
  const label: Record<string, string> = { weekly: t('Resumo da semana'), monthly: t('Relatório do mês'), quarterly: t('Relatório do trimestre') };
  const fmt = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-dark flex items-center gap-2"><FileBarChart size={22} /> {t('Relatórios')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('Toda segunda sai o resumo da semana e todo dia 1 o relatório do mês.')}</p>
      </div>
      {list === null ? <div className="py-16 text-center text-gray-400"><Loader2 className="animate-spin inline" /></div> : list.length === 0 ? (
        <p className="text-gray-400">{t('O primeiro relatório sai na próxima segunda-feira.')}</p>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {list.map(r => (
            <a key={r.id} href={`/r/${r.token}`} target="_blank" rel="noreferrer" className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900">{label[r.period] || r.period} · <span className="text-gray-500 font-medium">{fmt(r.period_start)} – {fmt(r.period_end)}</span></div>
                {r.summary?.headline && <div className="text-sm text-gray-500 truncate mt-0.5">{r.summary.headline}</div>}
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

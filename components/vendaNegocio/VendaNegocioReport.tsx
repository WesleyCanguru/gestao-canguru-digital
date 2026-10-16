import React, { useMemo } from 'react';
import { ClientLead, ClientLeadConfig } from '../../types';
import dayjs from 'dayjs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, Award, TrendingUp, CheckCircle2, Building2, Calendar } from 'lucide-react';

interface VendaNegocioReportProps {
  leads: ClientLead[];
  config: ClientLeadConfig;
  selectedMonth: string; // 'YYYY-MM'
  setSelectedMonth: (month: string) => void;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export const VendaNegocioReport: React.FC<VendaNegocioReportProps> = ({
  leads,
  config,
  selectedMonth,
  setSelectedMonth
}) => {
  const stages = useMemo(() => {
    return (config.kanban_stages || ['Novo Lead', 'Conversa inicial', 'Apresentação enviada', 'Visita agendada', 'Proposta e negociação', 'Vendido'])
      .filter(s => s !== 'Perdido');
  }, [config.kanban_stages]);

  const presIndex = stages.indexOf('Apresentação enviada');
  const visitaIndex = stages.indexOf('Visita agendada');
  const negociacaoIndex = stages.indexOf('Proposta e negociação');

  // Month leads
  const monthLeads = useMemo(() => {
    return leads.filter(l => (l.lead_date || l.created_at).startsWith(selectedMonth));
  }, [leads, selectedMonth]);

  const totalMonth = monthLeads.length;

  const qualifiedCount = monthLeads.filter(l => l.potential === 'alto').length;
  const qualifiedPercent = totalMonth > 0 ? Math.round((qualifiedCount / totalMonth) * 100) : 0;

  // Apresentações enviadas: leads do mês na etapa "Apresentação enviada" ou etapas posteriores, sem contar "Perdido"
  const presentationCount = monthLeads.filter(l => {
    if (l.kanban_stage === 'Perdido') return false;
    const idx = stages.indexOf(l.kanban_stage || '');
    return presIndex !== -1 && idx !== -1 && idx >= presIndex;
  }).length;

  // Visitas: leads do mês na etapa "Visita agendada" ou posteriores
  const visitsCount = monthLeads.filter(l => {
    if (l.kanban_stage === 'Perdido') return false;
    const idx = stages.indexOf(l.kanban_stage || '');
    return visitaIndex !== -1 && idx !== -1 && idx >= visitaIndex;
  }).length;

  // Status da venda
  const soldLead = leads.find(l => l.closed && (l.kanban_stage === 'Vendido' || l.kanban_stage === 'Fechado'));
  const negotiationCount = leads.filter(l => l.kanban_stage === 'Proposta e negociação' && !l.closed).length;

  // Funil da venda (all time counts per stage up to Vendido)
  const funnelData = useMemo(() => {
    return stages.map(stage => {
      const count = leads.filter(l => {
        if (l.kanban_stage === 'Perdido') return false;
        const leadIdx = stages.indexOf(l.kanban_stage || '');
        const targetIdx = stages.indexOf(stage);
        return leadIdx !== -1 && targetIdx !== -1 && leadIdx >= targetIdx;
      }).length;
      return { stage, count };
    });
  }, [leads, stages]);

  // Interessados por mês (últimos 6 meses), com "alto potencial" destacado
  const last6MonthsData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const m = dayjs().subtract(i, 'month');
      const prefix = m.format('YYYY-MM');
      const label = m.format('MMM/YY');
      
      const periodLeads = leads.filter(l => (l.lead_date || l.created_at).startsWith(prefix));
      const total = periodLeads.length;
      const high = periodLeads.filter(l => l.potential === 'alto').length;
      const normal = total - high;

      data.push({
        label,
        total,
        high,
        normal
      });
    }
    return data;
  }, [leads]);

  // Origem dos interessados
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    monthLeads.forEach(l => {
      const src = l.source || 'Outro';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthLeads]);

  // Perfil (form_data.perfil) e Capital disponível (form_data.capital)
  const perfilData = useMemo(() => {
    const counts: Record<string, number> = {};
    monthLeads.forEach(l => {
      const p = l.form_data?.perfil || 'Não informado';
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthLeads]);

  const capitalData = useMemo(() => {
    const counts: Record<string, number> = {};
    monthLeads.forEach(l => {
      const c = l.form_data?.capital || 'Não informado';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthLeads]);

  // Perdas do mês
  const lostLeads = useMemo(() => {
    return monthLeads.filter(l => l.kanban_stage === 'Perdido' && l.loss_reason);
  }, [monthLeads]);

  const lossReasonsCount = useMemo(() => {
    const counts: Record<string, number> = {};
    lostLeads.forEach(l => {
      const r = l.loss_reason || 'Outro';
      counts[r] = (counts[r] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [lostLeads]);

  return (
    <div className="space-y-6">
      {/* Header com filtro de mês */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-black/[0.03] shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Relatório & Métricas do Negócio</h2>
          <p className="text-xs text-gray-500">Acompanhamento detalhado do funil e conversão de interessados.</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-dark cursor-pointer"
          />
        </div>
      </div>

      {/* Top 5 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-black/[0.03] shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Interessados no mês</span>
          <span className="text-3xl font-black text-gray-900">{totalMonth}</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-black/[0.03] shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Qualificados</span>
          <span className="text-3xl font-black text-emerald-600">{qualifiedCount} <span className="text-sm font-bold text-gray-400">· {qualifiedPercent}%</span></span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-black/[0.03] shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Apresentações enviadas</span>
          <span className="text-3xl font-black text-blue-600">{presentationCount}</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-black/[0.03] shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Visitas</span>
          <span className="text-3xl font-black text-indigo-600">{visitsCount}</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-black/[0.03] shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Status da venda</span>
          <span className="text-lg font-black text-emerald-700 truncate block mt-1">
            {soldLead ? `Vendido em ${soldLead.closed_at ? dayjs(soldLead.closed_at).format('DD/MM/YY') : 'data reg.'}` : `À venda (${negotiationCount} em negoc.)`}
          </span>
        </div>
      </div>

      {/* Gráficos / Blocos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil da venda (All time horizontal bars) */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-black/[0.03] shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Funil da Venda (Todo o Período)</h3>
          <p className="text-xs text-gray-400 mb-6">Volume acumulado de interessados que alcançaram cada etapa.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#13284D" radius={[0, 4, 4, 0]} name="Interessados" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Interessados por mês (Últimos 6 meses) */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-black/[0.03] shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Interessados por Mês</h3>
          <p className="text-xs text-gray-400 mb-6">Comparativo dos últimos 6 meses com destaque para alto potencial.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last6MonthsData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="high" name="Alto potencial" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="normal" name="Demais" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Origem dos interessados */}
        <div className="bg-white p-6 rounded-[2rem] border border-black/[0.03] shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Origem dos Interessados</h3>
          <p className="text-xs text-gray-400 mb-4">Canais de captação no mês.</p>
          <div className="space-y-3">
            {sourceData.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">Nenhum registro no período.</p>
            ) : (
              sourceData.map((item, idx) => {
                const max = sourceData[0].value || 1;
                const pct = Math.round((item.value / max) * 100);
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="text-gray-900 font-bold">{item.value}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Perfil */}
        <div className="bg-white p-6 rounded-[2rem] border border-black/[0.03] shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Perfil do Interessado</h3>
          <p className="text-xs text-gray-400 mb-4">Distribuição por perfil no mês.</p>
          <div className="space-y-3">
            {perfilData.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">Nenhum registro no período.</p>
            ) : (
              perfilData.map((item, idx) => {
                const max = perfilData[0].value || 1;
                const pct = Math.round((item.value / max) * 100);
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="text-gray-900 font-bold">{item.value}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Capital Disponível */}
        <div className="bg-white p-6 rounded-[2rem] border border-black/[0.03] shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Capital Disponível</h3>
          <p className="text-xs text-gray-400 mb-4">Faixas de capital informadas no mês.</p>
          <div className="space-y-3">
            {capitalData.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">Nenhum registro no período.</p>
            ) : (
              capitalData.map((item, idx) => {
                const max = capitalData[0].value || 1;
                const pct = Math.round((item.value / max) * 100);
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="text-gray-900 font-bold">{item.value}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Perdas do Mês */}
      <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-black/[0.03] shadow-sm">
        <h3 className="text-base font-bold text-gray-900 mb-1">Motivos de Perda no Mês</h3>
        <p className="text-xs text-gray-400 mb-6">Análise dos interessados que não seguiram no funil.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {lossReasonsCount.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 col-span-full">Nenhuma perda registrada no período.</p>
          ) : (
            lossReasonsCount.map(item => (
              <div key={item.name} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">{item.name}</span>
                <span className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold">{item.value}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

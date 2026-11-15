import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileBarChart, Copy, Check, ExternalLink, Loader2, Eye, Sparkles, MapPin } from 'lucide-react';
import { supabase, useAuth, callFunction } from '../../lib/supabase';
import { getAppUrl } from '../../lib/appUrl';
import { geoLabel } from '../../lib/geo';

/**
 * Gestão › Relatórios: todos os relatórios em página (clientes e equipe), com link para copiar,
 * quantas vezes o cliente abriu e de onde, e o botão para gerar um relatório na hora (ex.: trimestral para reunião).
 */
const PERIOD: Record<string, string> = { daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral' };
const fmt = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const fmtTs = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const ReportsTab: React.FC = () => {
  const { agencyId } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [views, setViews] = useState<Record<string, any[]>>({});
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'client' | 'team'>('client');
  const [copied, setCopied] = useState<string | null>(null);
  const [gen, setGen] = useState<{ client_id: string; period: string }>({ client_id: '', period: 'quarterly' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from('reports').select('id, client_id, audience, period, period_start, period_end, token, status, sent_at, created_at, summary').eq('agency_id', agencyId).neq('status', 'hidden').order('period_start', { ascending: false }).limit(300),
      supabase.from('clients').select('id, name, logo_url, color, client_status').eq('agency_id', agencyId).eq('client_status', 'active').order('name'),
    ]);
    setReports((r as any[]) || []); setClients((c as any[]) || []);
    const ids = ((r as any[]) || []).map(x => x.id);
    if (ids.length) {
      const { data: v } = await supabase.from('report_views').select('report_id, viewed_at, city, region, country, seconds').in('report_id', ids).order('viewed_at', { ascending: false });
      const m: Record<string, any[]> = {};
      ((v as any[]) || []).forEach(x => { (m[x.report_id] ||= []).push(x); });
      setViews(m);
    }
    setLoading(false);
  }, [agencyId]);
  useEffect(() => { load(); }, [load]);

  const byClient = useMemo(() => {
    const m = new Map<string, any[]>();
    reports.filter(r => r.audience === 'client').forEach(r => { if (!m.has(r.client_id)) m.set(r.client_id, []); m.get(r.client_id)!.push(r); });
    return m;
  }, [reports]);
  const team = reports.filter(r => r.audience === 'team');
  const link = (t: string) => `${getAppUrl()}/r/${t}`;
  const copy = (t: string) => { navigator.clipboard.writeText(link(t)); setCopied(t); setTimeout(() => setCopied(null), 1800); };

  const generate = async () => {
    if (!gen.client_id) return;
    setBusy(true); setMsg('');
    const { data, error } = await callFunction<any>('reports-generate', { client_id: gen.client_id, period: gen.period });
    setBusy(false);
    if (error || !data?.ok) { setMsg(error || data?.error || 'Não foi possível gerar.'); return; }
    setMsg('Relatório pronto.'); load();
    if (data.report?.token) window.open(link(data.report.token), '_blank');
  };

  const Row: React.FC<{ r: any }> = ({ r }) => {
    const v = views[r.id] || [];
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-gray-100 text-gray-600">{PERIOD[r.period]}</span>
        <span className="text-sm text-gray-800 font-medium">{r.period_start === r.period_end ? fmt(r.period_start) : `${fmt(r.period_start)} – ${fmt(r.period_end)}`}</span>
        {r.sent_at && <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">enviado {fmtTs(r.sent_at)}</span>}
        <span className="text-[11px] text-gray-500 inline-flex items-center gap-1" title={v.map(x => `${fmtTs(x.viewed_at)} · ${geoLabel(x) || 'local desconhecido'}${x.seconds ? ` · ${Math.round(x.seconds / 60)} min` : ''}`).join('\n') || 'Ainda não aberto'}>
          <Eye size={12} /> {v.length ? `${v.length} abertura(s) · última ${fmtTs(v[0].viewed_at)}` : 'não aberto'}
          {v[0] && geoLabel(v[0]) && <><MapPin size={11} className="ml-1" />{geoLabel(v[0])}</>}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => copy(r.token)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            {copied === r.token ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />} {copied === r.token ? 'Copiado' : 'Copiar link'}
          </button>
          <a href={link(r.token) + '?notrack'} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" title="Abrir"><ExternalLink size={14} /></a>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark flex items-center gap-2"><FileBarChart size={22} /> Relatórios</h2>
          <p className="text-sm text-gray-500 mt-1">Semanal toda segunda, mensal todo dia 1. Resumo da equipe todo dia de manhã. Copie o link para mandar no WhatsApp.</p>
        </div>
        <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
          {(['client', 'team'] as const).map(f => <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-lg ${filter === f ? 'bg-white shadow-sm text-brand-dark' : 'text-gray-500'}`}>{f === 'client' ? 'Clientes' : 'Equipe'}</button>)}
        </div>
      </div>

      {filter === 'client' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-wrap items-center gap-3">
          <Sparkles size={16} className="text-amber-500" />
          <span className="text-sm font-semibold text-gray-700">Gerar agora</span>
          <select value={gen.client_id} onChange={e => setGen(g => ({ ...g, client_id: e.target.value }))} className="bolsa-select min-w-[200px]">
            <option value="">Escolha o cliente…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={gen.period} onChange={e => setGen(g => ({ ...g, period: e.target.value }))} className="bolsa-select">
            <option value="quarterly">Trimestral (últimos 3 meses)</option>
            <option value="monthly">Mensal (mês passado)</option>
            <option value="weekly">Semanal (semana passada)</option>
          </select>
          <button disabled={!gen.client_id || busy} onClick={generate} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-dark text-white text-sm font-bold disabled:opacity-40">
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} {busy ? 'Gerando (até 1 min)…' : 'Gerar'}
          </button>
          {msg && <span className="text-sm text-gray-600">{msg}</span>}
        </div>
      )}

      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="animate-spin inline" /></div> : filter === 'client' ? (
        clients.length === 0 ? <p className="text-gray-400">Nenhum cliente ativo.</p> : (
          <div className="space-y-4">
            {clients.map(c => (
              <div key={c.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-100 flex items-center gap-3">
                  {c.logo_url ? <img src={c.logo_url} alt="" className="w-7 h-7 rounded-lg object-cover" /> : <span className="w-7 h-7 rounded-lg" style={{ background: c.color || '#ccc' }} />}
                  <span className="font-bold text-brand-dark">{c.name}</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {(byClient.get(c.id) || []).slice(0, 8).map(r => <Row key={r.id} r={r} />)}
                  {!(byClient.get(c.id) || []).length && <p className="px-4 py-3 text-sm text-gray-400">Ainda sem relatório. O primeiro sai na próxima segunda.</p>}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
          {team.length ? team.slice(0, 40).map(r => <Row key={r.id} r={r} />) : <p className="px-4 py-3 text-sm text-gray-400">O primeiro resumo da equipe sai amanhã de manhã.</p>}
        </div>
      )}
    </div>
  );
};

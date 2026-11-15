import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';
import { getGeo } from '../../lib/geo';

/**
 * Relatório em página: /r/<token>. Sem login.
 * Cliente: semanal, mensal e trimestral (resumo escrito pelo Claude + números).
 * Equipe: diário, semanal e mensal (um cartão por cliente).
 * Registra quando e de onde abriram (equipe logada não conta).
 */
type Lang = 'pt' | 'en' | 'es';
const L: Record<Lang, Record<string, string>> = {
  pt: { weekly: 'Resumo da semana', monthly: 'Relatório do mês', quarterly: 'Relatório do trimestre', daily: 'Resumo de ontem', summary: 'Resumo', content: 'Conteúdo', ads: 'Anúncios', social: 'Redes sociais', crm: 'Contatos e vendas', highlights: 'Destaques', attention: 'Atenção', next: 'Próximos passos', published: 'Publicados', pending: 'Esperando a sua aprovação', changes: 'Em ajuste', upcoming: 'Próximos 7 dias', none: 'Nada por aqui.', invest: 'Investimento', results: 'Resultados', cpr: 'Custo por resultado', clicks: 'Cliques', impressions: 'Impressões', budget: 'Verba do mês', of: 'de', reach: 'Alcance', engagement: 'Engajamento', newFollowers: 'Novos seguidores', visits: 'Visitas ao perfil', leads: 'Contatos', closed: 'Vendas fechadas', revenue: 'Valor vendido', vsPrev: 'vs. período anterior', delivered: 'posts entregues', contracted: 'contratados no mês', open: 'Abrir', notFound: 'Relatório não encontrado.', loading: 'Carregando…', by: 'por', lastData: 'Último dado em', approve: 'Ver e aprovar' },
  en: { weekly: 'Weekly summary', monthly: 'Monthly report', quarterly: 'Quarterly report', daily: "Yesterday's summary", summary: 'Summary', content: 'Content', ads: 'Ads', social: 'Social media', crm: 'Leads and sales', highlights: 'Highlights', attention: 'Watch', next: 'Next steps', published: 'Published', pending: 'Waiting for your approval', changes: 'Being revised', upcoming: 'Next 7 days', none: 'Nothing here.', invest: 'Spend', results: 'Results', cpr: 'Cost per result', clicks: 'Clicks', impressions: 'Impressions', budget: "This month's budget", of: 'of', reach: 'Reach', engagement: 'Engagement', newFollowers: 'New followers', visits: 'Profile visits', leads: 'Leads', closed: 'Closed deals', revenue: 'Revenue', vsPrev: 'vs. previous period', delivered: 'posts delivered', contracted: 'contracted this month', open: 'Open', notFound: 'Report not found.', loading: 'Loading…', by: 'by', lastData: 'Last data on', approve: 'Review and approve' },
  es: { weekly: 'Resumen de la semana', monthly: 'Informe del mes', quarterly: 'Informe del trimestre', daily: 'Resumen de ayer', summary: 'Resumen', content: 'Contenido', ads: 'Anuncios', social: 'Redes sociales', crm: 'Contactos y ventas', highlights: 'Destacados', attention: 'Atención', next: 'Próximos pasos', published: 'Publicados', pending: 'Esperando tu aprobación', changes: 'En ajuste', upcoming: 'Próximos 7 días', none: 'Nada por aquí.', invest: 'Inversión', results: 'Resultados', cpr: 'Costo por resultado', clicks: 'Clics', impressions: 'Impresiones', budget: 'Presupuesto del mes', of: 'de', reach: 'Alcance', engagement: 'Interacción', newFollowers: 'Nuevos seguidores', visits: 'Visitas al perfil', leads: 'Contactos', closed: 'Ventas cerradas', revenue: 'Valor vendido', vsPrev: 'vs. período anterior', delivered: 'publicaciones entregadas', contracted: 'contratadas en el mes', open: 'Abrir', notFound: 'Informe no encontrado.', loading: 'Cargando…', by: 'por', lastData: 'Último dato el', approve: 'Ver y aprobar' },
};
const locOf = (l: Lang) => (l === 'en' ? 'en-US' : l === 'es' ? 'es-ES' : 'pt-BR');
const sid = () => { try { let s = sessionStorage.getItem('rep_sid'); if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('rep_sid', s); } return s; } catch { return 'x'; } };

const Delta: React.FC<{ now: number; prev?: number; invert?: boolean }> = ({ now, prev, invert }) => {
  if (!prev) return null;
  const pct = ((now - prev) / prev) * 100;
  if (!isFinite(pct) || Math.abs(pct) < 0.5) return <span className="text-xs text-gray-400">=</span>;
  const good = invert ? pct < 0 : pct > 0;
  return <span className={`text-xs font-semibold ${good ? 'text-emerald-600' : 'text-rose-600'}`}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%</span>;
};

const Stat: React.FC<{ label: string; value: string; delta?: React.ReactNode }> = ({ label, value, delta }) => (
  <div className="rounded-2xl bg-white border border-black/[0.06] p-4">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
    <div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-bold text-gray-900">{value}</span>{delta}</div>
  </div>
);

export const ReportPage: React.FC<{ token: string }> = ({ token }) => {
  const [rep, setRep] = useState<any>(null);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState('summary');

  useEffect(() => {
    supabase.rpc('get_report', { p_token: token }).then(({ data, error }) => { if (error || !data) setErr(true); else setRep(data); });
  }, [token]);

  // Registro de acesso: abertura + tempo de leitura (a cada 30s).
  useEffect(() => {
    if (!rep || /[?&]notrack/.test(window.location.search) || window.self !== window.top) return;
    let secs = 0; const s = sid();
    getGeo().then(g => supabase.rpc('track_report_view', { p_token: token, p_session: s, p_city: g.city, p_region: g.region, p_country: g.country, p_ua: navigator.userAgent, p_seconds: 0 }));
    const iv = setInterval(() => { if (!document.hidden) { secs += 30; supabase.rpc('track_report_view', { p_token: token, p_session: s, p_city: '', p_region: '', p_country: '', p_ua: '', p_seconds: secs }); } }, 30000);
    return () => clearInterval(iv);
  }, [rep, token]);

  const lang: Lang = (rep?.lang === 'en' || rep?.lang === 'es') ? rep.lang : 'pt';
  const t = L[lang];
  const color = rep?.agency?.primary_color || '#20364D';
  const cur = rep?.data?.currency || rep?.client?.currency || 'BRL';
  const money = (v: number) => new Intl.NumberFormat(locOf(lang), { style: 'currency', currency: cur, maximumFractionDigits: v >= 100 ? 0 : 2 }).format(v || 0);
  const n = (v: number) => new Intl.NumberFormat(locOf(lang)).format(Math.round(v || 0));
  const fmtDay = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(locOf(lang), { day: '2-digit', month: 'short', timeZone: 'UTC' });

  useEffect(() => { if (rep) document.title = `${t[rep.period] || ''} · ${rep.client?.name || rep.agency?.name || ''}`; }, [rep, t]);

  const d = rep?.data || {};
  const tabs = useMemo(() => {
    if (!rep || rep.audience === 'team') return [];
    const x = [{ id: 'summary', label: t.summary }, { id: 'content', label: t.content }];
    if (d.paid) x.push({ id: 'ads', label: t.ads });
    if (d.organic?.has) x.push({ id: 'social', label: t.social });
    if (d.crm?.has) x.push({ id: 'crm', label: t.crm });
    return x;
  }, [rep, d, t]);

  if (err) return <div className="min-h-screen grid place-items-center text-gray-500">{L.pt.notFound}</div>;
  if (!rep) return <div className="min-h-screen grid place-items-center text-gray-400">{L.pt.loading}</div>;

  const app = rep.agency?.id === 7 && lang === 'en' ? 'Pouch' : 'Bolsa';
  const appUrl = `https://${rep.agency?.domain || 'bolsa.cangurudigital.com.br'}`;
  const range = rep.period_start === rep.period_end ? fmtDay(rep.period_start) : `${fmtDay(rep.period_start)} – ${fmtDay(rep.period_end)}`;
  const s = rep.summary || {};
  const PostList: React.FC<{ items: any[]; link?: boolean }> = ({ items, link }) => items?.length ? (
    <ul className="divide-y divide-black/[0.05] rounded-2xl bg-white border border-black/[0.06]">
      {items.map((p, i) => (
        <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0"><div className="font-semibold text-gray-900 truncate">{p.title}</div><div className="text-xs text-gray-500">{fmtDay(p.date)}{p.time ? ` · ${p.time}` : ''}{p.type ? ` · ${p.type}` : ''}</div></div>
          {link && p.date_key && <a href={`${appUrl}/?mode=public&id=${encodeURIComponent(p.date_key)}`} className="shrink-0 text-sm font-semibold" style={{ color }}>{t.approve} →</a>}
        </li>
      ))}
    </ul>
  ) : <p className="text-sm text-gray-400">{t.none}</p>;

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <header className="text-white" style={{ background: `linear-gradient(135deg, ${color}, #0f1b2b)` }}>
        <div className="max-w-4xl mx-auto px-5 pt-8 pb-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {rep.client?.logo_url ? <img src={rep.client.logo_url} alt="" className="h-11 w-11 rounded-xl object-cover bg-white" /> : rep.agency?.logo_url ? <img src={rep.agency.logo_url} alt="" className="h-11 w-11 rounded-xl object-cover bg-white" /> : null}
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/60">{app} · {rep.agency?.name}</div>
                <div className="text-lg font-semibold">{rep.client?.name || rep.agency?.name}</div>
              </div>
            </div>
          </div>
          <h1 className="mt-8 text-3xl sm:text-4xl font-bold tracking-tight">{t[rep.period]}</h1>
          <div className="mt-1 text-white/70">{range}</div>
          {s.headline && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/90">{s.headline}</p>}
        </div>
      </header>

      {tabs.length > 1 && (
        <nav className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-black/[0.06]">
          <div className="max-w-4xl mx-auto px-5 flex gap-1 overflow-x-auto">
            {tabs.map(x => (
              <button key={x.id} onClick={() => setTab(x.id)} className={`px-4 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${tab === x.id ? 'text-gray-900' : 'text-gray-400 border-transparent hover:text-gray-700'}`} style={tab === x.id ? { borderColor: color } : undefined}>{x.label}</button>
            ))}
          </div>
        </nav>
      )}

      <main className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        {rep.audience === 'team' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat label="Tarefas concluídas" value={n(d.tasks?.done)} />
              <Stat label="Tarefas atrasadas" value={n(d.tasks?.overdue)} />
              <Stat label="Pesquisas sem resposta" value={n(d.npsPending)} />
            </div>
            {(d.clients || []).filter((c: any) => !c.is_demo).map((c: any) => (
              <div key={c.id} className="rounded-2xl bg-white border border-black/[0.06] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-gray-900">{c.name}</div>
                  {(d.client_reports || []).find((r: any) => r.client_id === c.id) && <a className="text-sm font-semibold" style={{ color }} href={`/r/${(d.client_reports || []).find((r: any) => r.client_id === c.id).token}`}>Relatório do cliente →</a>}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-lg bg-gray-100">{c.published} publicado(s) de {c.planned} planejado(s)</span>
                  {c.pending > 0 && <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700">{c.pending} esperando o cliente</span>}
                  {c.changes > 0 && <span className="px-2 py-1 rounded-lg bg-orange-50 text-orange-700">{c.changes} em ajuste</span>}
                  {c.approvedByClient > 0 && <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">{c.approvedByClient} aprovado(s) pelo cliente</span>}
                  {c.changesByClient > 0 && <span className="px-2 py-1 rounded-lg bg-orange-50 text-orange-700">{c.changesByClient} ajuste(s) pedido(s)</span>}
                  {c.rejectedByClient > 0 && <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700">{c.rejectedByClient} reprovado(s)</span>}
                  {c.helpRequests > 0 && <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700">pediu ajuda no onboarding</span>}
                  {c.paid && <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: c.currency || 'BRL', maximumFractionDigits: 0 }).format(c.paid.investment)} em anúncios · {c.paid.conversions} resultado(s)</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {tab === 'summary' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label={t.published} value={n(d.content?.published?.length)} />
                  <Stat label={t.pending} value={n(d.content?.pending?.length)} />
                  {d.paid && <Stat label={t.invest} value={money(d.paid.total.investment)} delta={<Delta now={d.paid.total.investment} prev={d.paid_prev?.total?.investment} />} />}
                  {d.paid && <Stat label={t.results} value={n(d.paid.total.conversions)} delta={<Delta now={d.paid.total.conversions} prev={d.paid_prev?.total?.conversions} />} />}
                  {!d.paid && d.organic?.has && <Stat label={t.reach} value={n(d.organic.total.reach)} delta={<Delta now={d.organic.total.reach} prev={d.organic_prev?.total?.reach} />} />}
                </div>
                {d.posts_per_month && (rep.period === 'monthly') && (
                  <div className="rounded-2xl bg-white border border-black/[0.06] p-4 text-sm text-gray-700">
                    <b className="text-gray-900">{n(d.content?.published?.length)}</b> {t.delivered} · <b>{n(d.posts_per_month)}</b> {t.contracted}
                  </div>
                )}
                {[['highlights', s.highlights, 'bg-emerald-50 text-emerald-900'], ['attention', s.attention, 'bg-amber-50 text-amber-900'], ['next', s.next_steps, 'bg-blue-50 text-blue-900']].map(([k, list, cls]: any) => list?.length ? (
                  <section key={k}>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{t[k]}</h2>
                    <ul className="space-y-2">{list.map((x: string, i: number) => <li key={i} className={`rounded-xl px-4 py-3 text-[15px] leading-relaxed ${cls}`}>{x}</li>)}</ul>
                  </section>
                ) : null)}
              </div>
            )}
            {tab === 'content' && (
              <div className="space-y-6">
                <section><h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{t.pending}</h2><PostList items={d.content?.pending} link /></section>
                <section><h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{t.published}</h2><PostList items={d.content?.published} /></section>
                {d.content?.changes?.length > 0 && <section><h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{t.changes}</h2><PostList items={d.content.changes} /></section>}
                <section><h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{t.upcoming}</h2><PostList items={d.content?.upcoming} /></section>
              </div>
            )}
            {tab === 'ads' && d.paid && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label={t.invest} value={money(d.paid.total.investment)} delta={<Delta now={d.paid.total.investment} prev={d.paid_prev?.total?.investment} />} />
                  <Stat label={t.results} value={n(d.paid.total.conversions)} delta={<Delta now={d.paid.total.conversions} prev={d.paid_prev?.total?.conversions} />} />
                  <Stat label={t.cpr} value={d.paid.total.conversions ? money(d.paid.total.investment / d.paid.total.conversions) : '—'} delta={d.paid.total.conversions && d.paid_prev?.total?.conversions ? <Delta now={d.paid.total.investment / d.paid.total.conversions} prev={d.paid_prev.total.investment / d.paid_prev.total.conversions} invert /> : null} />
                  <Stat label={t.clicks} value={n(d.paid.total.clicks)} delta={<Delta now={d.paid.total.clicks} prev={d.paid_prev?.total?.clicks} />} />
                </div>
                {d.budget && (
                  <div className="rounded-2xl bg-white border border-black/[0.06] p-4">
                    <div className="flex justify-between text-sm"><span className="font-semibold text-gray-700">{t.budget}</span><span className="text-gray-500">{money(d.budget.spent)} {t.of} {money(d.budget.budget)}</span></div>
                    <div className="mt-2 h-2.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (d.budget.spent / d.budget.budget) * 100)}%`, background: color }} /></div>
                  </div>
                )}
                {d.paid.daily?.length > 1 && (
                  <div className="rounded-2xl bg-white border border-black/[0.06] p-4 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={d.paid.daily}><XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11 }} /><Tooltip formatter={(v: any) => money(Number(v))} labelFormatter={(l: any) => fmtDay(String(l))} /><Bar dataKey="investment" name={t.invest} fill={color} radius={[4, 4, 0, 0]} /></BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  {Object.entries(d.paid.byPlatform || {}).map(([p, v]: any) => (
                    <div key={p} className="rounded-2xl bg-white border border-black/[0.06] p-4">
                      <div className="font-semibold text-gray-900 capitalize">{p === 'meta' ? 'Meta (Instagram/Facebook)' : p === 'google' ? 'Google' : p}</div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-sm"><div><div className="text-gray-400 text-xs">{t.invest}</div>{money(v.investment)}</div><div><div className="text-gray-400 text-xs">{t.results}</div>{n(v.conversions)}</div><div><div className="text-gray-400 text-xs">{t.cpr}</div>{v.conversions ? money(v.investment / v.conversions) : '—'}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab === 'social' && d.organic?.has && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label={t.reach} value={n(d.organic.total.reach)} delta={<Delta now={d.organic.total.reach} prev={d.organic_prev?.total?.reach} />} />
                  <Stat label={t.engagement} value={n(d.organic.total.engagement)} delta={<Delta now={d.organic.total.engagement} prev={d.organic_prev?.total?.engagement} />} />
                  <Stat label={t.newFollowers} value={n(d.organic.total.followers_gained)} delta={<Delta now={d.organic.total.followers_gained} prev={d.organic_prev?.total?.followers_gained} />} />
                  <Stat label={t.visits} value={n(d.organic.total.profile_visits)} delta={<Delta now={d.organic.total.profile_visits} prev={d.organic_prev?.total?.profile_visits} />} />
                </div>
                {d.organic.lastDate && <p className="text-xs text-gray-400">{t.lastData} {fmtDay(d.organic.lastDate)}.</p>}
              </div>
            )}
            {tab === 'crm' && d.crm?.has && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label={t.leads} value={n(d.crm.leads)} />
                <Stat label={t.closed} value={n(d.crm.closed)} />
                <Stat label={t.revenue} value={money(d.crm.revenue)} />
              </div>
            )}
          </>
        )}
        <footer className="pt-6 text-center text-xs text-gray-400">{app} {t.by} {rep.agency?.name}</footer>
      </main>
    </div>
  );
};

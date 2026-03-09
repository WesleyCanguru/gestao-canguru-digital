import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { Globe, BarChart2, CheckSquare, Plus, Edit2, Trash2, X, Save, ChevronLeft, ChevronRight, ExternalLink, Zap, TrendingUp, Users, Eye, Clock, Search, AlertCircle, CheckCircle, RotateCcw, XCircle } from 'lucide-react';

type ViewState = 'list' | 'report-form' | 'task-form';

interface WebsiteReport {
  id?: string;
  client_id: string;
  month: number;
  year: number;
  sessions: number;
  users: number;
  pageviews: number;
  bounce_rate: number;
  avg_session_duration: number;
  organic_sessions: number;
  direct_sessions: number;
  social_sessions: number;
  referral_sessions: number;
  paid_sessions: number;
  organic_keywords: number;
  top_3_keywords: string;
  avg_position: number;
  impressions: number;
  seo_clicks: number;
  pagespeed_mobile: number;
  pagespeed_desktop: number;
  goal_completions: number;
  conversion_rate: number;
  highlights: string;
  issues_found: string;
  actions_taken: string;
  next_month_plan: string;
}

interface WebsiteTask {
  id?: string;
  client_id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  requested_at: string;
  completed_at: string;
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function createEmptyReport(): WebsiteReport {
  return {
    client_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    sessions: 0, users: 0, pageviews: 0, bounce_rate: 0, avg_session_duration: 0,
    organic_sessions: 0, direct_sessions: 0, social_sessions: 0, referral_sessions: 0, paid_sessions: 0,
    organic_keywords: 0, top_3_keywords: '', avg_position: 0, impressions: 0, seo_clicks: 0,
    pagespeed_mobile: 0, pagespeed_desktop: 0, goal_completions: 0, conversion_rate: 0,
    highlights: '', issues_found: '', actions_taken: '', next_month_plan: ''
  };
}

function createEmptyTask(): WebsiteTask {
  return {
    client_id: '', title: '', description: '', priority: 'normal', status: 'pending',
    requested_at: new Date().toISOString().split('T')[0], completed_at: ''
  };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function PageSpeedBadge({ score }: { score: number }) {
  const color = score >= 90 ? 'text-green-600 bg-green-50' : score >= 50 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
  return <span className={`px-2 py-1 rounded text-sm font-bold ${color}`}>{score}</span>;
}

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
  high: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  low: { label: 'Baixa', color: 'bg-gray-100 text-gray-600' }
};

const STATUS_CONFIG = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700', icon: RotateCcw },
  done: { label: 'Concluída', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500', icon: XCircle }
};

export default function WebsiteView() {
  const { activeClient } = useAuth();
  const [view, setView] = useState<ViewState>('list');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<WebsiteReport | null>(null);
  const [tasks, setTasks] = useState<WebsiteTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTask, setEditingTask] = useState<WebsiteTask | null>(null);
  const [reportForm, setReportForm] = useState<WebsiteReport>(createEmptyReport());
  const [taskForm, setTaskForm] = useState<WebsiteTask>(createEmptyTask());

  async function loadData() {
    if (!activeClient) return;
    setLoading(true);
    const [reportRes, tasksRes] = await Promise.all([
      supabase.from('website_reports').select('*').eq('client_id', activeClient.id).eq('month', selectedMonth).eq('year', selectedYear).maybeSingle(),
      supabase.from('website_tasks').select('*').eq('client_id', activeClient.id).order('created_at', { ascending: false })
    ]);
    setReport(reportRes.data || null);
    setTasks(tasksRes.data || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [activeClient, selectedMonth, selectedYear]);

  async function saveReport() {
    if (!activeClient) return;
    setSaving(true);
    const data = { ...reportForm, client_id: activeClient.id, month: selectedMonth, year: selectedYear };
    await supabase.from('website_reports').upsert(data, { onConflict: 'client_id,month,year' });
    await loadData();
    setSaving(false);
    setView('list');
  }

  async function saveTask() {
    if (!activeClient) return;
    setSaving(true);
    const data = { ...taskForm, client_id: activeClient.id };
    if (editingTask?.id) {
      await supabase.from('website_tasks').update(data).eq('id', editingTask.id);
    } else {
      await supabase.from('website_tasks').insert(data);
    }
    await loadData();
    setSaving(false);
    setView('list');
    setEditingTask(null);
  }

  async function deleteTask(id: string) {
    if (!confirm('Excluir esta tarefa?')) return;
    await supabase.from('website_tasks').delete().eq('id', id);
    await loadData();
  }

  async function updateTaskStatus(id: string, status: WebsiteTask['status']) {
    await supabase.from('website_tasks').update({ status }).eq('id', id);
    await loadData();
  }

  function prevMonth() {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  }
  function nextMonth() {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  }

  if (view === 'report-form') {
    return (
      <div className="p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-700">← Voltar</button>
            <h2 className="text-xl font-bold">Relatório - {MONTHS[selectedMonth-1]} {selectedYear}</h2>
          </div>
        </div>
        <div className="space-y-6">
          <fieldset className="border border-gray-200 p-4 rounded-lg">
            <legend className="font-bold px-2">Tráfego Geral</legend>
            <div className="grid grid-cols-3 gap-4">
              {['sessions', 'users', 'pageviews', 'goal_completions'].map(f => (
                <div key={f}><label className="block text-sm mb-1">{f}</label><input type="number" value={(reportForm as any)[f]} onChange={e => setReportForm({...reportForm, [f]: Number(e.target.value)})} className="w-full border rounded p-2" /></div>
              ))}
              <div><label className="block text-sm mb-1">bounce_rate</label><input type="number" step="0.01" value={reportForm.bounce_rate} onChange={e => setReportForm({...reportForm, bounce_rate: Number(e.target.value)})} className="w-full border rounded p-2" /></div>
              <div><label className="block text-sm mb-1">Duração Média (segundos)</label><input type="number" value={reportForm.avg_session_duration} onChange={e => setReportForm({...reportForm, avg_session_duration: Number(e.target.value)})} className="w-full border rounded p-2" /></div>
              <div><label className="block text-sm mb-1">conversion_rate</label><input type="number" step="0.01" value={reportForm.conversion_rate} onChange={e => setReportForm({...reportForm, conversion_rate: Number(e.target.value)})} className="w-full border rounded p-2" /></div>
            </div>
          </fieldset>
          <fieldset className="border border-gray-200 p-4 rounded-lg">
            <legend className="font-bold px-2">Fontes de Tráfego</legend>
            <div className="grid grid-cols-3 gap-4">
              {['organic_sessions', 'direct_sessions', 'social_sessions', 'referral_sessions', 'paid_sessions'].map(f => (
                <div key={f}><label className="block text-sm mb-1">{f}</label><input type="number" value={(reportForm as any)[f]} onChange={e => setReportForm({...reportForm, [f]: Number(e.target.value)})} className="w-full border rounded p-2" /></div>
              ))}
            </div>
          </fieldset>
          <fieldset className="border border-gray-200 p-4 rounded-lg">
            <legend className="font-bold px-2">SEO</legend>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm mb-1">organic_keywords</label><input type="number" value={reportForm.organic_keywords} onChange={e => setReportForm({...reportForm, organic_keywords: Number(e.target.value)})} className="w-full border rounded p-2" /></div>
              <div><label className="block text-sm mb-1">avg_position</label><input type="number" step="0.01" value={reportForm.avg_position} onChange={e => setReportForm({...reportForm, avg_position: Number(e.target.value)})} className="w-full border rounded p-2" /></div>
              <div><label className="block text-sm mb-1">impressions</label><input type="number" value={reportForm.impressions} onChange={e => setReportForm({...reportForm, impressions: Number(e.target.value)})} className="w-full border rounded p-2" /></div>
              <div><label className="block text-sm mb-1">seo_clicks</label><input type="number" value={reportForm.seo_clicks} onChange={e => setReportForm({...reportForm, seo_clicks: Number(e.target.value)})} className="w-full border rounded p-2" /></div>
              <div className="col-span-3"><label className="block text-sm mb-1">top_3_keywords</label><input type="text" value={reportForm.top_3_keywords} onChange={e => setReportForm({...reportForm, top_3_keywords: e.target.value})} className="w-full border rounded p-2" /></div>
            </div>
          </fieldset>
          <fieldset className="border border-gray-200 p-4 rounded-lg">
            <legend className="font-bold px-2">Performance</legend>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm mb-1">pagespeed_mobile <PageSpeedBadge score={reportForm.pagespeed_mobile} /></label><input type="number" value={reportForm.pagespeed_mobile} onChange={e => setReportForm({...reportForm, pagespeed_mobile: Number(e.target.value)})} className="w-full border rounded p-2" /></div>
              <div><label className="block text-sm mb-1">pagespeed_desktop <PageSpeedBadge score={reportForm.pagespeed_desktop} /></label><input type="number" value={reportForm.pagespeed_desktop} onChange={e => setReportForm({...reportForm, pagespeed_desktop: Number(e.target.value)})} className="w-full border rounded p-2" /></div>
            </div>
          </fieldset>
          <fieldset className="border border-gray-200 p-4 rounded-lg">
            <legend className="font-bold px-2">Análise Textual</legend>
            <div className="grid grid-cols-2 gap-4">
              {['highlights', 'issues_found', 'actions_taken', 'next_month_plan'].map(f => (
                <div key={f}><label className="block text-sm mb-1">{f}</label><textarea rows={3} value={(reportForm as any)[f]} onChange={e => setReportForm({...reportForm, [f]: e.target.value})} className="w-full border rounded p-2" /></div>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2">
            <button onClick={() => setView('list')} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">Cancelar</button>
            <button onClick={saveReport} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"><Save size={16}/> Salvar Relatório</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'task-form') {
    return (
      <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-700">← Voltar</button>
          <h2 className="text-xl font-bold">{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</h2>
        </div>
        <div className="space-y-4">
          <div><label className="block text-sm mb-1">Título</label><input type="text" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} className="w-full border rounded p-2" required /></div>
          <div><label className="block text-sm mb-1">Descrição</label><textarea rows={3} value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} className="w-full border rounded p-2" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Prioridade</label>
              <select value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value as any})} className="w-full border rounded p-2">
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Status</label>
              <select value={taskForm.status} onChange={e => setTaskForm({...taskForm, status: e.target.value as any})} className="w-full border rounded p-2">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label className="block text-sm mb-1">Data Solicitada</label><input type="date" value={taskForm.requested_at} onChange={e => setTaskForm({...taskForm, requested_at: e.target.value})} className="w-full border rounded p-2" /></div>
            <div><label className="block text-sm mb-1">Data de Conclusão (opcional)</label><input type="date" value={taskForm.completed_at} onChange={e => setTaskForm({...taskForm, completed_at: e.target.value})} className="w-full border rounded p-2" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setView('list')} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">Cancelar</button>
            <button onClick={saveTask} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"><Save size={16}/> Salvar Tarefa</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 p-6">
      <div className="w-full md:w-[60%] space-y-6">
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2"><Globe className="text-blue-600" /><h2 className="text-xl font-bold">Relatório de Website</h2></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={20}/></button>
              <span className="font-medium w-32 text-center">{MONTHS[selectedMonth-1]} {selectedYear}</span>
              <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={20}/></button>
            </div>
            <button onClick={() => { setReportForm(report || createEmptyReport()); setView('report-form'); }} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm">
              {report ? <Edit2 size={16} /> : <Plus size={16} />} {report ? 'Editar' : 'Criar'} Relatório
            </button>
          </div>
        </div>

        {loading ? <div className="p-8 text-center">Carregando...</div> : !report ? (
          <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
            <Globe className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500 mb-4">Nenhum relatório para {MONTHS[selectedMonth-1]} {selectedYear}</p>
            <button onClick={() => { setReportForm(createEmptyReport()); setView('report-form'); }} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Criar Relatório</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-bold mb-4">Visão Geral de Tráfego</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded"><div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><BarChart2 size={16}/> Sessões</div><div className="text-xl font-bold">{report.sessions}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Users size={16}/> Usuários</div><div className="text-xl font-bold">{report.users}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Eye size={16}/> Pageviews</div><div className="text-xl font-bold">{report.pageviews}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-gray-500 text-sm mb-1">Taxa de Rejeição</div><div className="text-xl font-bold">{report.bounce_rate}%</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Clock size={16}/> Duração Média</div><div className="text-xl font-bold">{formatDuration(report.avg_session_duration)}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-gray-500 text-sm mb-1">Conversões</div><div className="text-xl font-bold">{report.goal_completions} · {report.conversion_rate}%</div></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-bold mb-4">Fontes de Tráfego</h3>
              {(() => {
                const total = report.organic_sessions + report.direct_sessions + report.social_sessions + report.referral_sessions + report.paid_sessions;
                const sources = [
                  { label: 'Orgânico', val: report.organic_sessions, color: 'bg-green-500' },
                  { label: 'Direto', val: report.direct_sessions, color: 'bg-blue-500' },
                  { label: 'Social', val: report.social_sessions, color: 'bg-purple-500' },
                  { label: 'Referral', val: report.referral_sessions, color: 'bg-orange-500' },
                  { label: 'Pago', val: report.paid_sessions, color: 'bg-red-500' }
                ];
                return (
                  <div className="space-y-3">
                    <div className="flex h-4 rounded overflow-hidden">
                      {sources.map(s => total > 0 && <div key={s.label} className={`h-full ${s.color}`} style={{ width: `${(s.val/total)*100}%` }} title={`${s.label}: ${s.val}`} />)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      {sources.map(s => (
                        <div key={s.label} className="flex flex-col">
                          <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${s.color}`}></span>{s.label}</span>
                          <span className="font-bold">{total > 0 ? ((s.val/total)*100).toFixed(1) : 0}% ({s.val})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-bold mb-4">SEO</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded"><div className="text-gray-500 text-sm mb-1">Palavras-chave</div><div className="text-xl font-bold">{report.organic_keywords}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-gray-500 text-sm mb-1">Posição Média</div><div className="text-xl font-bold">{report.avg_position}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-gray-500 text-sm mb-1">Impressões</div><div className="text-xl font-bold">{report.impressions}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-gray-500 text-sm mb-1">Cliques SEO</div><div className="text-xl font-bold">{report.seo_clicks}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-gray-500 text-sm mb-1">CTR</div><div className="text-xl font-bold">{report.impressions > 0 ? (report.seo_clicks/report.impressions*100).toFixed(1) : 0}%</div></div>
                <div className="col-span-2 md:col-span-3 p-3 bg-gray-50 rounded"><div className="text-gray-500 text-sm mb-1">Top 3 Keywords</div><div className="font-medium">{report.top_3_keywords || '-'}</div></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-bold mb-4">PageSpeed</h3>
              <div className="flex gap-4">
                <div className="flex-1 p-4 bg-gray-50 rounded flex justify-between items-center"><span>Mobile</span><PageSpeedBadge score={report.pagespeed_mobile} /></div>
                <div className="flex-1 p-4 bg-gray-50 rounded flex justify-between items-center"><span>Desktop</span><PageSpeedBadge score={report.pagespeed_desktop} /></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
              <h3 className="font-bold">Notas Textuais</h3>
              {['highlights', 'issues_found', 'actions_taken', 'next_month_plan'].map(f => (
                <div key={f}>
                  <h4 className="text-sm font-bold text-gray-700 mb-1 capitalize">{f.replace(/_/g, ' ')}</h4>
                  <div className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">{(report as any)[f] || '-'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-full md:w-[40%] space-y-4">
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2"><CheckSquare className="text-blue-600" /><h2 className="text-lg font-bold">Tarefas do Site</h2></div>
          <button onClick={() => { setTaskForm(createEmptyTask()); setEditingTask(null); setView('task-form'); }} className="flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-sm"><Plus size={16}/> Nova</button>
        </div>

        {['pending', 'in_progress', 'done', 'cancelled'].map(status => {
          const groupTasks = tasks.filter(t => t.status === status);
          if (groupTasks.length === 0) return null;
          const config = (STATUS_CONFIG as any)[status];
          const Icon = config.icon;
          return (
            <div key={status} className="space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2 text-gray-600"><Icon size={16}/> {config.label} ({groupTasks.length})</h3>
              {groupTasks.map(task => (
                <div key={task.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm">{task.title}</h4>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingTask(task); setTaskForm(task); setView('task-form'); }} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 size={14}/></button>
                      <button onClick={() => deleteTask(task.id!)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>
                    </div>
                  </div>
                  {task.description && <p className="text-xs text-gray-500 truncate mb-2">{task.description}</p>}
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded ${(PRIORITY_CONFIG as any)[task.priority].color}`}>{(PRIORITY_CONFIG as any)[task.priority].label}</span>
                    <select value={task.status} onChange={e => updateTaskStatus(task.id!, e.target.value as any)} className="border rounded px-1 py-0.5 bg-gray-50">
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <span className="text-gray-400 ml-auto">{new Date(task.requested_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {tasks.length === 0 && !loading && <div className="text-center p-8 bg-white rounded-lg border border-gray-200 text-gray-500">Nenhuma tarefa encontrada.</div>}
      </div>
    </div>
  );
}

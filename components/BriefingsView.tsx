import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/supabase';
import {
  ClipboardList,
  Plus,
  ChevronLeft,
  Send,
  Save,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  X
} from 'lucide-react';
import { useT } from '../lib/i18n';

interface Briefing {
  id: string;
  client_id: string;
  title: string;
  month: number;
  year: number;
  main_theme: string | null;
  key_dates: string | null;
  promotions: string | null;
  target_audience: string | null;
  tone: string;
  references_links: string | null;
  additional_notes: string | null;
  status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'revision_requested';
  submitted_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const STATUS_CONFIG = {
  draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-600', icon: FileText },
  submitted: { label: 'Enviado', color: 'bg-blue-100 text-blue-700', icon: Send },
  in_review: { label: 'Em revisão', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  revision_requested: { label: 'Revisão solicitada', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
};

const emptyForm = {
  title: '',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  main_theme: '',
  key_dates: '',
  promotions: '',
  target_audience: '',
  tone: 'informal',
  references_links: '',
  additional_notes: '',
};

export function BriefingsView({ onBack }: { onBack?: () => void }) {
  const { t } = useT();
  const { activeClient } = useAuth();
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selectedBriefing, setSelectedBriefing] = useState<Briefing | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeClient) fetchBriefings();
  }, [activeClient]);

  async function fetchBriefings() {
    if (!activeClient) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('briefings')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (!error && data) setBriefings(data);
    setLoading(false);
  }

  async function saveBriefing(submitAfter = false) {
    if (!activeClient) return;
    if (!form.title.trim()) { setError('O título é obrigatório.'); return; }
    setSaving(true);
    setError(null);

    const payload = {
      client_id: activeClient.id,
      title: form.title.trim(),
      month: form.month,
      year: form.year,
      main_theme: form.main_theme || null,
      key_dates: form.key_dates || null,
      promotions: form.promotions || null,
      target_audience: form.target_audience || null,
      tone: form.tone,
      references_links: form.references_links || null,
      additional_notes: form.additional_notes || null,
      status: submitAfter ? 'submitted' : 'draft',
      submitted_at: submitAfter ? new Date().toISOString() : null,
    };

    let result;
    if (selectedBriefing) {
      result = await supabase
        .from('briefings')
        .update(payload)
        .eq('id', selectedBriefing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('briefings')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      setError('Erro ao salvar briefing. Tente novamente.');
    } else {
      await fetchBriefings();
      setView('list');
      setSelectedBriefing(null);
      setForm(emptyForm);
    }
    setSaving(false);
  }

  function openNewForm() {
    setSelectedBriefing(null);
    setForm(emptyForm);
    setError(null);
    setView('form');
  }

  function openEditForm(b: Briefing) {
    setSelectedBriefing(b);
    setForm({
      title: b.title,
      month: b.month,
      year: b.year,
      main_theme: b.main_theme || '',
      key_dates: b.key_dates || '',
      promotions: b.promotions || '',
      target_audience: b.target_audience || '',
      tone: b.tone,
      references_links: b.references_links || '',
      additional_notes: b.additional_notes || '',
    });
    setError(null);
    setView('form');
  }

  function openDetail(b: Briefing) {
    setSelectedBriefing(b);
    setView('detail');
  }

  // ---- LIST VIEW ----
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <button 
                  onClick={onBack}
                  className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-brand-dark mr-1"
                  title={t('Voltar ao Dashboard')}
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{t('Briefings')}</h1>
                <p className="text-sm text-gray-500">{t('Formulários mensais de conteúdo')}</p>
              </div>
            </div>
            <button
              onClick={openNewForm}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t('Novo briefing')}
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : briefings.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('Nenhum briefing ainda')}</h3>
              <p className="text-gray-500 text-sm mb-6">{t('Crie seu primeiro briefing mensal para começar.')}</p>
              <button
                onClick={openNewForm}
                className="bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                {t('Criar primeiro briefing')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {briefings.map((b) => {
                const cfg = STATUS_CONFIG[b.status];
                const StatusIcon = cfg.icon;
                const canEdit = b.status === 'draft' || b.status === 'revision_requested';
                return (
                  <div
                    key={b.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">{b.title}</h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {t(cfg.label)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {MONTHS[b.month - 1]} de {b.year}
                          {b.main_theme && <> · {b.main_theme}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => openDetail(b)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title={t('Ver detalhes')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => openEditForm(b)}
                            className="px-3 py-1.5 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors font-medium"
                          >
                            {t('Editar')}
                          </button>
                        )}
                      </div>
                    </div>
                    {b.status === 'revision_requested' && b.reviewer_notes && (
                      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-xs font-medium text-orange-700 mb-1">{t('Notas do revisor:')}</p>
                        <p className="text-sm text-orange-600">{b.reviewer_notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- FORM VIEW ----
  if (view === 'form') {
    const isEdit = !!selectedBriefing;
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button
              onClick={() => { setView('list'); setSelectedBriefing(null); setForm(emptyForm); }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {isEdit ? t('Editar briefing') : t('Novo briefing')}
              </h1>
              <p className="text-sm text-gray-500">{t('Preencha as informações do mês')}</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Título */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">{t('Identificação')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Título do briefing *')}</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={t('Ex: Briefing Março 2026 - Lançamento Coleção')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Mês')}</label>
                <select
                  value={form.month}
                  onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Ano')}</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">{t('Conteúdo do mês')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Tema principal')}</label>
              <input
                type="text"
                value={form.main_theme}
                onChange={e => setForm(f => ({ ...f, main_theme: e.target.value }))}
                placeholder={t('Ex: Dia das Mães, Lançamento de produto...')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Datas importantes')}</label>
              <textarea
                value={form.key_dates}
                onChange={e => setForm(f => ({ ...f, key_dates: e.target.value }))}
                placeholder={t('Ex: 12/03 - Lançamento, 25/03 - Evento...')}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Promoções / Campanhas')}</label>
              <textarea
                value={form.promotions}
                onChange={e => setForm(f => ({ ...f, promotions: e.target.value }))}
                placeholder={t('Descreva promoções, descontos ou campanhas previstas...')}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              />
            </div>
          </div>

          {/* Diretrizes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">{t('Diretrizes de comunicação')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Público-alvo')}</label>
              <input
                type="text"
                value={form.target_audience}
                onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                placeholder={t('Ex: Mulheres 25-40 anos, interessadas em moda...')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Tom de voz')}</label>
              <select
                value={form.tone}
                onChange={e => setForm(f => ({ ...f, tone: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                <option value="informal">{t('Informal e descontraído')}</option>
                <option value="formal">{t('Formal e profissional')}</option>
                <option value="inspiracional">{t('Inspiracional')}</option>
                <option value="educativo">{t('Educativo')}</option>
                <option value="divertido">{t('Divertido e jovem')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Referências / Links')}</label>
              <textarea
                value={form.references_links}
                onChange={e => setForm(f => ({ ...f, references_links: e.target.value }))}
                placeholder={t('Links de inspiração, concorrentes, materiais...')}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Observações adicionais')}</label>
              <textarea
                value={form.additional_notes}
                onChange={e => setForm(f => ({ ...f, additional_notes: e.target.value }))}
                placeholder={t('Qualquer outra informação relevante para o mês...')}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pb-8">
            <button
              onClick={() => saveBriefing(false)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? t('Salvando...') : t('Salvar rascunho')}
            </button>
            <button
              onClick={() => saveBriefing(true)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {saving ? t('Enviando...') : t('Enviar para revisão')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- DETAIL VIEW ----
  if (view === 'detail' && selectedBriefing) {
    const b = selectedBriefing;
    const cfg = STATUS_CONFIG[b.status];
    const StatusIcon = cfg.icon;
    const canEdit = b.status === 'draft' || b.status === 'revision_requested';

    const fields = [
      { label: t('Tema principal'), value: b.main_theme },
      { label: t('Datas importantes'), value: b.key_dates },
      { label: 'Promoções / Campanhas', value: b.promotions },
      { label: t('Público-alvo'), value: b.target_audience },
      { label: t('Tom de voz'), value: b.tone },
      { label: 'Referências / Links', value: b.references_links },
      { label: t('Observações adicionais'), value: b.additional_notes },
    ];

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setView('list'); setSelectedBriefing(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{b.title}</h1>
                <p className="text-sm text-gray-500">{MONTHS[b.month - 1]} de {b.year}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {t(cfg.label)}
              </span>
              {canEdit && (
                <button
                  onClick={() => openEditForm(b)}
                  className="px-3 py-1.5 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors font-medium"
                >
                  {t('Editar')}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
          {b.status === 'revision_requested' && b.reviewer_notes && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <p className="text-sm font-semibold text-orange-700 mb-1">{t('Notas do revisor:')}</p>
              <p className="text-sm text-orange-600">{b.reviewer_notes}</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {fields.map(({ label, value }) =>
              value ? (
                <div key={label} className="px-5 py-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
                </div>
              ) : null
            )}
          </div>

          <p className="text-xs text-gray-400 text-center pb-8">
            Criado em {new Date(b.created_at).toLocaleDateString('pt-BR')}
            {b.submitted_at && <> · Enviado em {new Date(b.submitted_at).toLocaleDateString('pt-BR')}</>}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

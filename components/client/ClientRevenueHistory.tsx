import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  XCircle, 
  RotateCcw, 
  Sparkles, 
  Plus, 
  Trash2, 
  Calendar, 
  FileText, 
  DollarSign, 
  AlertCircle,
  X,
  Check,
  ArrowRight,
  Clock
} from 'lucide-react';
import { Client, ClientRevenueEvent, RevenueEventType } from '../../types';
import { useClientRevenueEvents } from '../../hooks/useClientRevenueEvents';
import { parseCurrencyInput } from '../../lib/currencyUtils';
import dayjs from 'dayjs';

interface ClientRevenueHistoryProps {
  client: Client;
  onEventAdded?: () => void;
}

const EVENT_CONFIGS: Record<RevenueEventType, {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  color: string;
  bgLight: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
}> = {
  upsell: {
    label: 'Upsell',
    icon: TrendingUp,
    color: '#16a34a',
    bgLight: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    badgeBg: 'bg-emerald-500/10 text-emerald-700',
    badgeText: 'text-emerald-600',
  },
  downsell: {
    label: 'Downsell',
    icon: TrendingDown,
    color: '#dc2626',
    bgLight: 'bg-rose-50',
    borderColor: 'border-rose-200',
    badgeBg: 'bg-rose-500/10 text-rose-700',
    badgeText: 'text-rose-600',
  },
  churn: {
    label: 'Churn (Cancelamento)',
    icon: XCircle,
    color: '#e11d48',
    bgLight: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeBg: 'bg-red-500/10 text-red-700',
    badgeText: 'text-red-600',
  },
  reactivation: {
    label: 'Reativação',
    icon: RotateCcw,
    color: '#059669',
    bgLight: 'bg-teal-50',
    borderColor: 'border-teal-200',
    badgeBg: 'bg-teal-500/10 text-teal-700',
    badgeText: 'text-teal-600',
  },
  new_client: {
    label: 'Início (Novo Cliente)',
    icon: Sparkles,
    color: '#2563eb',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-500/10 text-blue-700',
    badgeText: 'text-blue-600',
  },
};

export const ClientRevenueHistory: React.FC<ClientRevenueHistoryProps> = ({ client, onEventAdded }) => {
  const { events, loading, addRevenueEvent, deleteRevenueEvent, refresh } = useClientRevenueEvents(client.id);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states for manual registration
  const [eventType, setEventType] = useState<RevenueEventType>('upsell');
  const [prevValue, setPrevValue] = useState<string>(
    client.base_value !== undefined && client.base_value !== null ? String(client.base_value).replace('.', ',') : '0'
  );
  const [newValue, setNewValue] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [note, setNote] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const parsedPrev = parseCurrencyInput(prevValue) || 0;
  const parsedNew = parseCurrencyInput(newValue) || 0;
  const currentDelta = parsedNew - parsedPrev;

  const handleOpenModal = () => {
    setEventType('upsell');
    setPrevValue(client.base_value !== undefined && client.base_value !== null ? String(client.base_value).replace('.', ',') : '0');
    setNewValue('');
    setOccurredAt(dayjs().format('YYYY-MM-DD'));
    setNote('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (parsedNew < 0 || parsedPrev < 0) {
      setFormError('Os valores não podem ser negativos.');
      return;
    }

    if (eventType !== 'churn' && parsedNew === parsedPrev && !note.trim()) {
      setFormError('O novo valor deve ser diferente do anterior ou adicione uma justificativa na nota.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await addRevenueEvent({
        client_id: client.id,
        event_type: eventType,
        previous_value: parsedPrev,
        new_value: parsedNew,
        delta: currentDelta,
        note: note.trim() || null,
        occurred_at: occurredAt
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Erro ao registrar evento');
      }

      setIsModalOpen(false);
      if (onEventAdded) onEventAdded();
    } catch (err: any) {
      setFormError(err.message || 'Falha ao salvar evento.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este evento do histórico de receita?')) return;
    setDeletingId(id);
    try {
      await deleteRevenueEvent(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-black/[0.04] p-6 sm:p-7 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-brand-dark">Histórico de Receita & Expansão</h3>
            <p className="text-xs text-gray-400 mt-0.5">Linha do tempo de upsells, downsells e alterações de contrato</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-dark hover:bg-opacity-90 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
        >
          <Plus size={14} />
          <span>Registrar Evento</span>
        </button>
      </div>

      {/* Conteúdo: Loading / Vazio / Timeline */}
      <div className="mt-6">
        {loading ? (
          <div className="py-10 text-center text-xs text-gray-400 font-medium">
            <span className="inline-block animate-spin w-4 h-4 border-2 border-gray-300 border-t-brand-dark rounded-full mr-2" />
            Carregando histórico de receita...
          </div>
        ) : events.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-2xl bg-gray-50/60 border border-dashed border-gray-200">
            <Clock size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-bold text-gray-600">Nenhum evento registrado ainda</p>
            <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
              Mudanças no valor base mensal do cliente serão detectadas e salvas automaticamente aqui, ou você pode registrar eventos retroativos no botão acima.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:top-3 before:bottom-3 before:left-3 sm:before:left-4 before:w-0.5 before:bg-gradient-to-b before:from-emerald-400 before:via-gray-200 before:to-gray-100">
            {events.map((ev) => {
              const cfg = EVENT_CONFIGS[ev.event_type as RevenueEventType] || EVENT_CONFIGS.upsell;
              const IconComponent = cfg.icon;
              const formattedDate = dayjs(ev.occurred_at).format('MMM YYYY');
              const fullDate = dayjs(ev.occurred_at).format('DD/MM/YYYY');
              const isPositive = ev.delta > 0;
              const isNegative = ev.delta < 0;

              return (
                <div key={ev.id} className="relative group">
                  {/* Ponto na linha do tempo */}
                  <div 
                    className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full bg-white border-2 flex items-center justify-center shadow-xs transition-transform group-hover:scale-110"
                    style={{ borderColor: cfg.color }}
                  >
                    <IconComponent size={12} style={{ color: cfg.color }} />
                  </div>

                  {/* Card do evento */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/70 hover:bg-gray-50 border border-black/[0.03] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-gray-500 capitalize">
                          {formattedDate}
                        </span>
                        <span className="text-[10px] text-gray-400">({fullDate})</span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${cfg.badgeBg} ${cfg.borderColor}`}>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Transição de valores */}
                      <div className="flex items-center gap-2 text-sm font-bold flex-wrap">
                        <span className="text-gray-500 line-through text-xs font-normal">
                          {formatCurrency(ev.previous_value)}
                        </span>
                        <ArrowRight size={14} className="text-gray-400 shrink-0" />
                        <span className="text-brand-dark font-extrabold text-base">
                          {formatCurrency(ev.new_value)}
                        </span>
                        {ev.delta !== 0 && (
                          <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                            isPositive 
                              ? 'bg-emerald-100/80 text-emerald-700' 
                              : isNegative 
                              ? 'bg-rose-100/80 text-rose-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isPositive ? `+${formatCurrency(ev.delta)}` : formatCurrency(ev.delta)}
                          </span>
                        )}
                      </div>

                      {/* Nota descritiva */}
                      {ev.note && (
                        <p className="text-xs text-gray-600 italic bg-white/80 p-2.5 rounded-xl border border-black/[0.02] mt-1">
                          "{ev.note}"
                        </p>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 self-end sm:self-center opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleDelete(ev.id)}
                        disabled={deletingId === ev.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Excluir evento do histórico"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL PARA REGISTRO MANUAL DE EVENTO */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-lg w-full shadow-2xl relative text-left"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-brand-dark">Registrar Evento de Receita</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{client.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo de evento */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Tipo de Evento *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(['upsell', 'downsell', 'churn', 'reactivation', 'new_client'] as RevenueEventType[]).map((type) => {
                      const isSelected = eventType === type;
                      const cfg = EVENT_CONFIGS[type];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setEventType(type);
                            if (type === 'churn') {
                              setNewValue('0');
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${
                            isSelected 
                              ? 'border-brand-dark bg-brand-dark text-white shadow-sm' 
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <Icon size={14} className={isSelected ? 'text-white' : cfg.badgeText} />
                          <span className="truncate">{cfg.label.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Valores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Valor Anterior (R$) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={prevValue}
                      onChange={e => setPrevValue(e.target.value)}
                      placeholder="Ex: 1200,00"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Novo Valor (R$) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newValue}
                      onChange={e => setNewValue(e.target.value)}
                      placeholder="Ex: 1290,00"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Previsão do Delta */}
                <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Variação de Receita (Delta):</span>
                  <span className={`font-black ${currentDelta > 0 ? 'text-emerald-600' : currentDelta < 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                    {currentDelta > 0 ? `+${formatCurrency(currentDelta)}` : formatCurrency(currentDelta)}
                  </span>
                </div>

                {/* Data do evento */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Data da Alteração *
                  </label>
                  <input
                    type="date"
                    value={occurredAt}
                    onChange={e => setOccurredAt(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Nota / Justificativa */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Nota / Motivo (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Ex: Adição do serviço de Tráfego Pago, reajuste anual, etc."
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Botões */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                    className="flex-1 py-3 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 bg-brand-dark hover:bg-opacity-90 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Salvar Evento
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

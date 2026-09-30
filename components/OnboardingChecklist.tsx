import React, { useState, useEffect, useMemo } from 'react';
import { Client, AiOnboardingData, AiOnboardingCategory, AiOnboardingItem } from '../types';
import { 
  fetchClientAiOnboarding, 
  updateAiOnboardingDone, 
  generateOrRegenerateAiOnboarding 
} from '../lib/aiOnboardingService';
import { 
  Sparkles, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  Circle, 
  Check, 
  Loader2, 
  AlertCircle,
  Calendar,
  Layers,
  Flame,
  Target
} from 'lucide-react';

interface OnboardingChecklistProps {
  client: Client;
  agencyId?: number;
  isClientView?: boolean;
  onUpdate?: (updatedData: AiOnboardingData) => void;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  client,
  agencyId,
  isClientView = false,
  onUpdate,
}) => {
  const [data, setData] = useState<AiOnboardingData | null>(client.ai_onboarding || null);
  const [loading, setLoading] = useState<boolean>(!client.ai_onboarding);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const effectiveAgencyId = agencyId || client.agency_id;

  // Carregar dados se não estiverem presentes nas props
  useEffect(() => {
    if (client.ai_onboarding) {
      setData(client.ai_onboarding);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    fetchClientAiOnboarding(client.id, effectiveAgencyId)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [client.id, client.ai_onboarding, effectiveAgencyId]);

  // Contagem geral
  const { totalItems, completedItems, overallPercent } = useMemo(() => {
    if (!data?.checklist) return { totalItems: 0, completedItems: 0, overallPercent: 0 };
    let total = 0;
    let done = 0;
    data.checklist.forEach((cat) => {
      cat.items.forEach((item) => {
        total++;
        if (item.done) done++;
      });
    });
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { totalItems: total, completedItems: done, overallPercent: percent };
  }, [data]);

  // Handler para marcar/desmarcar item
  const handleToggleItem = async (categoryId: string, item: AiOnboardingItem) => {
    if (!data) return;
    const newDone = !item.done;

    // Atualização otimista local
    const previousData = data;
    const optimisticChecklist = data.checklist.map((cat) => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: cat.items.map((i) => (i.id === item.id ? { ...i, done: newDone } : i)),
      };
    });
    const optimisticData: AiOnboardingData = { ...data, checklist: optimisticChecklist };
    setData(optimisticData);
    setTogglingItemId(item.id);

    const { success, updatedData } = await updateAiOnboardingDone(
      client.id,
      categoryId,
      item.id,
      newDone,
      previousData,
      effectiveAgencyId
    );

    setTogglingItemId(null);

    if (!success) {
      setData(previousData);
      setErrorMsg('Nao foi possivel atualizar o item. Tente novamente.');
      setTimeout(() => setErrorMsg(null), 3000);
    } else {
      setData(updatedData);
      if (onUpdate) onUpdate(updatedData);
    }
  };

  // Handler para gerar ou regenerar Onboarding IA
  const handleGenerateOrRegenerate = async () => {
    setRegenerating(true);
    setErrorMsg(null);
    try {
      const generated = await generateOrRegenerateAiOnboarding(client, effectiveAgencyId);
      setData(generated);
      if (onUpdate) onUpdate(generated);
      setFeedbackMsg('Onboarding IA gerado com sucesso!');
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg('Erro ao gerar Onboarding IA. Tente novamente.');
      setTimeout(() => setErrorMsg(null), 3500);
    } finally {
      setRegenerating(false);
    }
  };

  const formattedDate = useMemo(() => {
    if (!data?.generated_at) return '';
    try {
      const parts = data.generated_at.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return data.generated_at;
    } catch {
      return data.generated_at;
    }
  }, [data?.generated_at]);

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 className="animate-spin text-brand-dark" size={32} />
        <span className="text-sm font-medium">Carregando Onboarding IA...</span>
      </div>
    );
  }

  // Estado Vazio (sem ai_onboarding)
  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm my-4">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
          <Sparkles size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum Onboarding IA gerado</h3>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Gere automaticamente um checklist inteligente de boas-vindas e estratégia inicial personalizado para {client.name}, contendo configuração de Business Manager, redes sociais, pixels, entrega de materiais e pilares de conteúdo.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          onClick={handleGenerateOrRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-dark hover:bg-black text-white rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {regenerating ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>Gerando Onboarding IA...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Gerar Onboarding</span>
            </>
          )}
        </button>
      </div>
    );
  }

  const clientDisplayName = data.business_name || client.name;

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      {/* Toast de feedback */}
      {feedbackMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl flex items-center gap-2 animate-fade-in font-medium">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2 animate-fade-in font-medium">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header do Onboarding */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🎯</span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                Onboarding - {clientDisplayName}
              </h2>
            </div>
            {formattedDate && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 font-medium">
                <Calendar size={13} />
                <span>Gerado em: {formattedDate}</span>
                {data.segment && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span>{data.segment}</span>
                  </>
                )}
              </p>
            )}
          </div>

          {!isClientView && (
            <button
              onClick={handleGenerateOrRegenerate}
              disabled={regenerating}
              title="Regenerar Onboarding IA para este cliente"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors shrink-0 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw size={14} className={regenerating ? 'animate-spin text-brand-dark' : 'text-gray-500'} />
              <span>{regenerating ? 'Regenerando...' : 'Regenerar'}</span>
            </button>
          )}
        </div>

        {/* Barra de Progresso Geral */}
        <div className="pt-5">
          <div className="flex items-center justify-between text-xs mb-2 font-medium">
            <span className="text-gray-500">Progresso geral de ativação</span>
            <span className="font-bold text-brand-dark">
              {completedItems} de {totalItems} concluídos ({overallPercent}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Categorias do Checklist */}
      <div className="flex flex-col gap-4">
        {data.checklist.map((category) => {
          const catTotal = category.items.length;
          const catDone = category.items.filter((i) => i.done).length;
          const isCatComplete = catTotal > 0 && catDone === catTotal;

          return (
            <div
              key={category.id}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm transition-all"
            >
              {/* Header da Categoria */}
              <div className="p-4 sm:p-5 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl shrink-0">{category.icon || '📌'}</span>
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                    {category.category}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      isCatComplete
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {catDone} / {catTotal}
                  </span>
                  {isCatComplete && (
                    <span className="text-sm font-semibold text-emerald-600" title="Categoria 100% concluída">
                      ✅
                    </span>
                  )}
                </div>
              </div>

              {/* Itens da Categoria */}
              <div className="divide-y divide-gray-50 p-2 sm:p-3">
                {category.items.map((item) => {
                  const isToggling = togglingItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => !isToggling && handleToggleItem(category.id, item)}
                      className={`flex items-start gap-3.5 p-3 rounded-xl transition-all cursor-pointer select-none ${
                        item.done
                          ? 'bg-emerald-50/30 text-gray-500'
                          : 'hover:bg-gray-50 text-gray-800'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isToggling) handleToggleItem(category.id, item);
                        }}
                        className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors border ${
                          item.done
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        {isToggling ? (
                          <Loader2 size={12} className="animate-spin text-gray-400" />
                        ) : item.done ? (
                          <Check size={13} strokeWidth={3} />
                        ) : null}
                      </button>

                      {/* Conteúdo do item */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm ${
                              item.done
                                ? 'line-through text-gray-400'
                                : 'font-medium text-gray-800'
                            }`}
                          >
                            {item.label}
                          </span>

                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition-colors"
                              title="Acessar link externo"
                            >
                              <span>Acessar</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>

                        {item.note && (
                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                            {item.note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Seção de Estratégia Inicial */}
      {data.strategy_summary && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-7 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <span className="text-xl">📊</span>
            <h3 className="font-bold text-gray-900 text-lg">Estratégia Inicial</h3>
          </div>

          <div className="mt-5 space-y-5 text-sm">
            {data.strategy_summary.positioning && (
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Posicionamento
                </span>
                <p className="text-gray-800 leading-relaxed font-medium">
                  {data.strategy_summary.positioning}
                </p>
              </div>
            )}

            {data.strategy_summary.posting_frequency && (
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Frequência de Postagem
                </span>
                <p className="text-gray-800 font-medium">
                  {data.strategy_summary.posting_frequency}
                </p>
              </div>
            )}

            {data.strategy_summary.content_pillars && data.strategy_summary.content_pillars.length > 0 && (
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                  Pilares de Conteúdo
                </span>
                <div className="flex flex-wrap gap-2">
                  {data.strategy_summary.content_pillars.map((pillar, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl border border-blue-100"
                    >
                      {pillar}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.strategy_summary.priority_30_days && data.strategy_summary.priority_30_days.length > 0 && (
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                  Prioridades dos Primeiros 30 Dias
                </span>
                <ul className="space-y-2">
                  {data.strategy_summary.priority_30_days.map((prio, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-gray-700">
                      <span className="text-blue-500 font-bold shrink-0 mt-0.5">•</span>
                      <span className="font-medium leading-relaxed">{prio}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

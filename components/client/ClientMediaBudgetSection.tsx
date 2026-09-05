import React, { useState, useEffect, useCallback } from 'react';
import { Client } from '../../types';
import { useMediaBudgets, getPlatformLabel, normalizePlatformKey } from '../../hooks/useMediaBudgets';
import { parseCurrencyInput, formatCurrency } from '../../lib/currencyUtils';
import { DollarSign, Save, Calendar, Check, Loader2, AlertCircle } from 'lucide-react';
import dayjs from 'dayjs';

interface ClientMediaBudgetSectionProps {
  client: Client;
  onSaved?: () => void;
}

const DEFAULT_PLATFORMS = ['Meta Ads', 'Google Ads'];

export const ClientMediaBudgetSection: React.FC<ClientMediaBudgetSectionProps> = ({ client, onSaved }) => {
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(dayjs().format('YYYY-MM'));
  const { budgets, saveBudget, fetchClientBudgets, loading } = useMediaBudgets(client.id, selectedMonthYear);

  // Local input state for formatted currency values
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [savedPlatform, setSavedPlatform] = useState<string | null>(null);

  // Active platforms to display
  const rawPlatforms = client.traffic_platforms && client.traffic_platforms.length > 0
    ? client.traffic_platforms
    : DEFAULT_PLATFORMS;

  // Deduplicated & normalized platforms
  const activePlatforms = Array.from(new Set(rawPlatforms.map(p => normalizePlatformKey(p)))).filter(Boolean);

  // Update inputs when budgets state changes
  useEffect(() => {
    const newInputs: Record<string, string> = {};
    activePlatforms.forEach((pKey) => {
      const budgetObj = budgets.find(b => normalizePlatformKey(b.platform) === pKey);
      const val = budgetObj ? budgetObj.budget_amount : 0;
      newInputs[pKey] = val > 0 ? formatCurrency(val) : '';
    });
    setInputs(newInputs);
  }, [budgets, selectedMonthYear, client.traffic_platforms]);

  const handleInputChange = (pKey: string, rawVal: string) => {
    const numeric = parseCurrencyInput(rawVal);
    setInputs(prev => ({
      ...prev,
      [pKey]: numeric > 0 ? formatCurrency(numeric) : rawVal
    }));
  };

  const handleSavePlatform = async (pKey: string) => {
    setSavingPlatform(pKey);
    setSavedPlatform(null);

    const valStr = inputs[pKey] || '0';
    const numericAmount = parseCurrencyInput(valStr);

    const res = await saveBudget(pKey, numericAmount);

    setSavingPlatform(null);
    if (res.success) {
      setSavedPlatform(pKey);
      setTimeout(() => setSavedPlatform(null), 2500);
      onSaved?.();
    }
  };

  const monthLabel = dayjs(selectedMonthYear, 'YYYY-MM').format('MMMM [de] YYYY');

  return (
    <div className="bg-stone-50/70 border border-stone-200/80 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/60 pb-3">
        <div>
          <h3 className="text-sm font-bold text-[#13284D] uppercase tracking-wider flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-600" />
            Verba de Mídia por Plataforma
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Defina a verba acordada com o cliente para cada canal em cada mês
          </p>
        </div>

        {/* Mês/Ano Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Calendar size={14} className="text-stone-400" />
          <input
            type="month"
            value={selectedMonthYear}
            onChange={(e) => setSelectedMonthYear(e.target.value)}
            className="px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-xs text-stone-400 gap-2">
          <Loader2 size={16} className="animate-spin text-emerald-600" />
          <span>Carregando verbas de mídia de {monthLabel}...</span>
        </div>
      ) : activePlatforms.length === 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-amber-600" />
          <span>Nenhuma plataforma de tráfego selecionada nas configurações de serviços do cliente.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {activePlatforms.map((pKey) => {
            const label = getPlatformLabel(pKey);
            const isSaving = savingPlatform === pKey;
            const isJustSaved = savedPlatform === pKey;

            return (
              <div
                key={pKey}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-stone-200/80 shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-[140px]">
                  <div className={`w-3 h-3 rounded-full ${
                    pKey === 'meta' ? 'bg-[#0081FB]' : pKey === 'google' ? 'bg-[#EA4335]' : 'bg-black'
                  }`} />
                  <span className="text-sm font-bold text-stone-800">{label}</span>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
                  <span className="text-xs font-semibold text-stone-500 whitespace-nowrap">Verba:</span>
                  <div className="relative flex-1 max-w-[200px]">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={inputs[pKey] || ''}
                      onChange={(e) => handleInputChange(pKey, e.target.value)}
                      placeholder="R$ 0,00"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold text-stone-800 font-mono text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSavePlatform(pKey)}
                    disabled={isSaving}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isJustSaved
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95'
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isJustSaved ? (
                      <>
                        <Check size={14} />
                        <span>Salvo!</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Salvar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Client } from '../../types';
import { useClientHealthScore, getHealthScoreCategory } from '../../hooks/useClientHealthScore';
import { Activity, RefreshCw, AlertTriangle, CheckCircle, Save, Clock, CreditCard, Heart, XCircle, FileText } from 'lucide-react';
import dayjs from 'dayjs';

interface ClientHealthPanelProps {
  client: Client;
}

export const ClientHealthPanel: React.FC<ClientHealthPanelProps> = ({ client }) => {
  const {
    currentScore,
    history,
    loading,
    savingPenalty,
    recalculate,
    updateManualPenalty
  } = useClientHealthScore(client.id, client.agency_id);

  const [penaltyInput, setPenaltyInput] = useState<number>(0);
  const [notesInput, setNotesInput] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (currentScore) {
      setPenaltyInput(currentScore.manual_penalty || 0);
      setNotesInput(currentScore.manual_notes || '');
    }
  }, [currentScore]);

  const handleSavePenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateManualPenalty(penaltyInput, notesInput);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const currentMonthName = dayjs().format('MMMM [de] YYYY');

  if (loading && !currentScore) {
    return (
      <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-gray-100 shadow-xs">
        <RefreshCw className="animate-spin text-brand-dark" size={24} />
        <span className="text-xs font-bold uppercase tracking-wider">Calculando Saúde do Cliente...</span>
      </div>
    );
  }

  const scoreVal = currentScore?.score ?? 0;
  const category = getHealthScoreCategory(scoreVal);

  const approvalScore = currentScore?.approval_speed_score ?? 0;
  const paymentScore = currentScore?.payment_score ?? 0;
  const npsScore = currentScore?.nps_score ?? 0;
  const rejectionScore = currentScore?.rejection_score ?? 0;
  const penaltyVal = currentScore?.manual_penalty ?? 0;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-6">
      {/* Header do Painel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <Activity size={16} className="text-brand-dark" />
            Saúde do Cliente • {currentMonthName}
          </div>
          <h3 className="text-xl font-bold text-brand-dark">Indicador de Churn & Retenção (Health Score)</h3>
        </div>

        <button
          onClick={recalculate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl text-xs font-bold uppercase tracking-wider border border-gray-200 transition-all hover:shadow-xs active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Recalculando...' : 'Atualizar Score'}
        </button>
      </div>

      {/* Grid Principal: Score Geral + Componentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card de Score Geral */}
        <div className={`p-6 rounded-3xl border ${category.badgeBg} ${category.badgeBorder} flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden`}>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Score Total do Mês
          </span>
          <div className="flex items-baseline gap-1">
            <span className={`text-6xl font-black ${category.badgeText} tracking-tight`}>
              {scoreVal}
            </span>
            <span className="text-lg font-bold text-gray-400">/100</span>
          </div>

          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${category.badgeBg} ${category.badgeText} ${category.badgeBorder} shadow-2xs`}>
            <span className={`w-2 h-2 rounded-full ${category.dotColor}`} />
            {category.label}
          </span>

          <p className="text-xs text-gray-500 font-medium max-w-xs mt-2">
            Calculado automaticamente com base em aprovações, adimplência financeira, pesquisas NPS e estabilidade de entregas.
          </p>
        </div>

        {/* Breakdown dos 4 Componentes (Barras de Progresso) */}
        <div className="lg:col-span-2 space-y-4 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Detalhamento dos Componentes (0 a 25 pontos cada)
          </h4>

          {/* 1. Velocidade de Aprovação */}
          <div className="space-y-1.5 bg-white p-3.5 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-gray-700">
                <Clock size={15} className="text-blue-500" />
                1. Velocidade de Aprovação de Conteúdo
              </span>
              <span className="text-blue-600 font-black">{approvalScore} / 25 pts</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${(approvalScore / 25) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Média de tempo até aprovar posts (≤1 dia: 25pts, 2d: 20pts, 3d: 15pts, &gt;3d: 10pts).
            </p>
          </div>

          {/* 2. Pagamento em Dia */}
          <div className="space-y-1.5 bg-white p-3.5 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-gray-700">
                <CreditCard size={15} className="text-emerald-500" />
                2. Pagamento em Dia (Adimplência)
              </span>
              <span className="text-emerald-600 font-black">{paymentScore} / 25 pts</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${(paymentScore / 25) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Pago na data: 25pts | até 5d de atraso: 15pts | &gt;5d: 5pts | em aberto/atrasado: 0pts.
            </p>
          </div>

          {/* 3. NPS do Mês */}
          <div className="space-y-1.5 bg-white p-3.5 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-gray-700">
                <Heart size={15} className="text-purple-500" />
                3. Satisfação NPS do Mês
              </span>
              <span className="text-purple-600 font-black">{npsScore} / 25 pts</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-purple-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${(npsScore / 25) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              NPS 9-10: 25pts | 7-8: 18pts | 5-6: 10pts | 0-4: 0pts | Não respondeu: 15pts (neutro).
            </p>
          </div>

          {/* 4. Ausência de Rejeições Múltiplas */}
          <div className="space-y-1.5 bg-white p-3.5 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-gray-700">
                <XCircle size={15} className="text-amber-500" />
                4. Estabilidade de Entregas (Sem Múltiplas Rejeições)
              </span>
              <span className="text-amber-600 font-black">{rejectionScore} / 25 pts</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${(rejectionScore / 25) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              0 posts refeitos 2+ vezes: 25pts | 1 post: 18pts | 2 posts: 10pts | 3+: 0pts.
            </p>
          </div>
        </div>
      </div>

      {/* Formulário de Penalidade Manual */}
      <form onSubmit={handleSavePenalty} className="bg-rose-50/40 rounded-3xl border border-rose-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-900 uppercase tracking-wider">
            <AlertTriangle size={16} className="text-rose-600" />
            Penalidade Manual do Gestor (0 a 30 pontos de desconto)
          </div>
          {penaltyVal > 0 && (
            <span className="text-xs font-black text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
              -{penaltyVal} pts aplicados
            </span>
          )}
        </div>

        <p className="text-xs text-rose-800/80">
          Utilize esta penalidade quando o cliente tiver algum atrito qualitativo ou reclamação fora da plataforma (ex: reclamação formal via WhatsApp ou atraso no alinhamento).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Desconto de Penalidade (0-30 pts)
            </label>
            <input
              type="number"
              min={0}
              max={30}
              value={penaltyInput}
              onChange={(e) => setPenaltyInput(Math.min(30, Math.max(0, Number(e.target.value) || 0)))}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Anotação / Justificativa da Penalidade
            </label>
            <input
              type="text"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="Ex: Cliente reclamou no WhatsApp dia 05/09 sobre atraso no envio das artes..."
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle size={14} /> Penalidade salva com sucesso!
            </span>
          )}
          <button
            type="submit"
            disabled={savingPenalty}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
          >
            <Save size={15} />
            {savingPenalty ? 'Salvando...' : 'Salvar Penalidade'}
          </button>
        </div>
      </form>

      {/* Histórico dos últimos 6 meses */}
      <div className="bg-gray-50/50 rounded-3xl border border-gray-100 p-6 space-y-4">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <FileText size={15} className="text-brand-dark" />
          Histórico de Saúde (Últimos Mêses)
        </h4>

        {history.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Nenhum histórico de saúde registrado anteriormente.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {history.map((item) => {
              const itemCat = getHealthScoreCategory(item.score);
              const formattedMY = dayjs(item.month_year + '-01').format('MMM/YY');

              return (
                <div
                  key={item.month_year}
                  className={`p-3.5 rounded-2xl border ${itemCat.badgeBg} ${itemCat.badgeBorder} flex flex-col items-center text-center space-y-1.5`}
                >
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {formattedMY}
                  </span>
                  <span className={`text-2xl font-black ${itemCat.badgeText}`}>
                    {item.score}
                  </span>
                  <span className={`text-[9px] font-bold uppercase ${itemCat.badgeText}`}>
                    {itemCat.label.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

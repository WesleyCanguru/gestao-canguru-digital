import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Heart, Send, AlertCircle, Sparkles, Building2, MessageSquare, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Logo } from '../Logo';
import { ClientNps } from '../../types';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

interface NpsPublicScreenProps {
  token: string;
}

export const NpsPublicScreen: React.FC<NpsPublicScreenProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [npsData, setNpsData] = useState<ClientNps | null>(null);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadSurvey() {
      if (!token) {
        setError('Token da pesquisa não fornecido.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Buscar o registro pelo token e os dados do cliente associado
        const { data, error: fetchErr } = await supabase
          .from('client_nps')
          .select('*, client:clients(id, name, logo_url, initials, color)')
          .eq('token', token)
          .maybeSingle();

        if (fetchErr) {
          console.error('Erro ao buscar pesquisa NPS:', fetchErr);
          setError('Não foi possível carregar a pesquisa. Tente novamente.');
          return;
        }

        if (!data) {
          setError('Pesquisa não encontrada ou o link informado é inválido.');
          return;
        }

        setNpsData(data as ClientNps);

        // Se já foi respondido anteriormente
        if (data.responded_at) {
          setSelectedScore(data.score);
          setComment(data.comment || '');
        }
      } catch (err: any) {
        console.error('Erro fatal:', err);
        setError('Ocorreu um erro ao carregar o formulário.');
      } finally {
        setLoading(false);
      }
    }

    loadSurvey();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedScore === null || selectedScore === undefined) return;
    if (!token) return;

    setSubmitting(true);
    try {
      const { data, error: updateErr } = await supabase
        .from('client_nps')
        .update({
          score: selectedScore,
          comment: comment.trim() || null,
          responded_at: new Date().toISOString()
        })
        .eq('token', token)
        .select('*, client:clients(id, name, logo_url, initials, color)')
        .single();

      if (updateErr) {
        throw updateErr;
      }

      setNpsData(data as ClientNps);
      setSubmitted(true);
    } catch (err: any) {
      console.error('Erro ao registrar resposta:', err);
      alert('Erro ao enviar sua resposta. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const clientName = npsData?.client?.name || 'Cliente';
  const clientLogo = npsData?.client?.logo_url;
  const clientColor = npsData?.client?.color || '#13284D';
  const clientInitials = npsData?.client?.initials || clientName.slice(0, 2).toUpperCase();

  // Formatar o mês da pesquisa (ex: "Setembro de 2026")
  const formattedMonth = npsData?.month_year 
    ? dayjs(npsData.month_year + '-01').format('MMMM [de] YYYY')
    : dayjs().format('MMMM [de] YYYY');

  // Determinar cor e texto descritivo do score
  const getScoreFeedback = (s: number) => {
    if (s >= 9) return { label: 'Promotor — Muito Satisfeito', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (s >= 7) return { label: 'Neutro — Satisfeito', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Detrator — Precisa Melhorar', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background decorativo sutil */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-orange-100/30 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-xl mx-auto">
        {/* Header com Branding Canguru */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3.5 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-stone-200/60 mb-3">
            <Logo size="small" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-stone-400 font-bold">
            Pesquisa de Satisfação Mensal
          </p>
        </div>

        {/* Card Principal */}
        <div className="bg-white rounded-3xl border border-stone-200/80 shadow-[0_20px_60px_rgba(0,0,0,0.04)] overflow-hidden transition-all">
          {loading ? (
            <div className="py-20 px-8 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#13284D] animate-spin" />
              <p className="text-sm font-medium text-stone-500">Carregando pesquisa...</p>
            </div>
          ) : error ? (
            <div className="py-16 px-8 text-center">
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-stone-900 mb-2">Ops! Link não disponível</h2>
              <p className="text-sm text-stone-600 max-w-md mx-auto mb-6">{error}</p>
              <div className="text-xs text-stone-400 font-medium">
                Se você recebeu este link recentemente, por favor solicite um novo link ao suporte da Canguru Digital.
              </div>
            </div>
          ) : submitted ? (
            /* Tela de Agradecimento Imediata após envio */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-16 px-6 sm:px-10 text-center"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-emerald-100 shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
                Feedback Enviado com Sucesso
              </span>
              <h2 className="text-2xl font-bold text-stone-900 mb-3 tracking-tight">
                Obrigado pelo seu feedback!
              </h2>
              <p className="text-sm text-stone-600 max-w-md mx-auto leading-relaxed mb-8">
                Ele nos ajuda a melhorar cada vez mais a nossa parceria e a qualidade das entregas para a <strong className="text-stone-800">{clientName}</strong>.
              </p>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/60 max-w-sm mx-auto text-left flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center font-extrabold text-[#13284D] text-lg shadow-sm shrink-0">
                  {selectedScore}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-stone-800 truncate">Sua avaliação registrada</p>
                  <p className="text-[11px] text-stone-500 capitalize">{formattedMonth}</p>
                </div>
              </div>
            </motion.div>
          ) : npsData?.responded_at ? (
            /* Tela quando o cliente já havia respondido anteriormente */
            <div className="py-16 px-6 sm:px-10 text-center">
              <div className="w-16 h-16 bg-stone-50 text-stone-500 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-stone-200 shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-stone-600" />
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
                Pesquisa Já Respondida
              </span>
              <h2 className="text-2xl font-bold text-stone-900 mb-3 tracking-tight">
                Você já respondeu esta pesquisa.
              </h2>
              <p className="text-sm text-stone-600 max-w-md mx-auto leading-relaxed mb-6">
                Obrigado pelo seu feedback! Ele nos ajuda a melhorar cada vez mais. Sua resposta para a referência de <span className="font-semibold capitalize text-stone-800">{formattedMonth}</span> já foi salva com sucesso.
              </p>

              <div className="p-5 bg-stone-50/80 rounded-2xl border border-stone-200 max-w-md mx-auto text-left mb-6">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Sua Nota:</span>
                  <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${
                    (npsData.score ?? 0) >= 9 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : (npsData.score ?? 0) >= 7 
                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {npsData.score} / 10
                  </span>
                </div>
                {npsData.comment && (
                  <div className="mt-3 pt-3 border-t border-stone-200/60">
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Seu Comentário:</span>
                    <p className="text-xs text-stone-700 italic bg-white p-3 rounded-xl border border-stone-200/60">
                      "{npsData.comment}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Formulário Ativo de Avaliação */
            <form onSubmit={handleSubmit} className="p-6 sm:p-10">
              {/* Identificação do Cliente */}
              <div className="flex items-center gap-3.5 pb-6 mb-6 border-b border-stone-100">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-sm overflow-hidden shrink-0"
                  style={{ backgroundColor: clientColor }}
                >
                  {clientLogo ? (
                    <img src={clientLogo} alt={clientName} className="w-full h-full object-contain mix-blend-multiply" />
                  ) : (
                    clientInitials
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-stone-900 truncate">
                    {clientName}
                  </h3>
                  <p className="text-xs text-stone-400 capitalize">
                    Avaliação referente a {formattedMonth}
                  </p>
                </div>
              </div>

              {/* Pergunta Principal */}
              <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-snug mb-3">
                  Como foi sua experiência este mês?
                </h1>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Em uma escala de <strong>0 a 10</strong>, o quanto você recomendaria os serviços e o time da Canguru Digital para um parceiro ou colega de negócios?
                </p>
              </div>

              {/* Escala 0 a 10 com Botoes */}
              <div className="mb-8">
                <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 sm:gap-2 mb-3">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                    const isSelected = selectedScore === num;
                    
                    // Definição de cores por faixa de NPS:
                    // 0-6: Detrator (vermelho/coral)
                    // 7-8: Neutro (amarelo/âmbar)
                    // 9-10: Promotor (verde)
                    let baseStyles = 'border-stone-200 hover:border-stone-300 text-stone-700 bg-white hover:bg-stone-50';
                    let selectedStyles = '';

                    if (num <= 6) {
                      selectedStyles = 'bg-rose-600 text-white border-rose-600 shadow-[0_4px_12px_rgba(225,29,72,0.3)] scale-105';
                    } else if (num <= 8) {
                      selectedStyles = 'bg-amber-500 text-white border-amber-500 shadow-[0_4px_12px_rgba(245,158,11,0.3)] scale-105';
                    } else {
                      selectedStyles = 'bg-emerald-600 text-white border-emerald-600 shadow-[0_4px_12px_rgba(16,185,129,0.3)] scale-105';
                    }

                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSelectedScore(num)}
                        className={`h-12 sm:h-13 rounded-2xl font-extrabold text-sm sm:text-base border transition-all duration-200 flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                          isSelected ? selectedStyles : baseStyles
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>

                {/* Legendas de 0 e 10 */}
                <div className="flex justify-between items-center text-[11px] font-bold text-stone-400 uppercase tracking-wider px-1">
                  <span>0 - Pouco provável</span>
                  <span>10 - Com certeza!</span>
                </div>

                {/* Feedback visual da nota selecionada */}
                {selectedScore !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 rounded-2xl flex items-center justify-between border bg-stone-50/80 border-stone-200"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-500">Nota escolhida:</span>
                      <strong className="text-base font-extrabold text-stone-900">{selectedScore}</strong>
                    </div>
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${getScoreFeedback(selectedScore).color}`}>
                      {getScoreFeedback(selectedScore).label}
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Campo de Comentário Opcional */}
              <div className="mb-8">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
                  Quer deixar algum comentário? <span className="text-stone-400 font-normal normal-case">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Conte-nos o que motivou sua nota, elogios, sugestões ou pontos que podemos melhorar..."
                  className="w-full px-4 py-3 bg-stone-50/50 border border-stone-200 rounded-2xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#13284D] focus:border-transparent transition-all resize-none"
                />
              </div>

              {/* Botão de Envio */}
              <button
                type="submit"
                disabled={selectedScore === null || submitting}
                className={`w-full py-4 px-6 rounded-2xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-md ${
                  selectedScore === null
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                    : submitting
                    ? 'bg-[#13284D]/80 text-white cursor-wait'
                    : 'bg-[#13284D] hover:bg-[#0e1d37] text-white hover:shadow-lg active:scale-[0.99]'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando resposta...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar resposta</span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-stone-400 mt-4">
                Sua resposta é confidencial e direcionada exclusivamente à diretoria da agência.
              </p>
            </form>
          )}
        </div>

        {/* Rodapé simples */}
        <div className="text-center mt-6 text-xs text-stone-400">
          Canguru Digital · Gestão Estratégica & Performance
        </div>
      </div>
    </div>
  );
};

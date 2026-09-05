import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HeartHandshake, 
  Send, 
  Copy, 
  Check, 
  ExternalLink, 
  Clock, 
  Star, 
  Calendar, 
  MessageSquareQuote, 
  ChevronRight, 
  Sparkles, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { useClientNps, getNpsPublicUrl } from '../../hooks/useClientNps';
import { NpsBadge } from './NpsBadge';
import { Client } from '../../types';

dayjs.locale('pt-br');

interface ClientNpsSectionProps {
  client: Client;
  className?: string;
}

export const ClientNpsSection: React.FC<ClientNpsSectionProps> = ({ client, className = '' }) => {
  const {
    history,
    currentMonthNps,
    loading,
    sending,
    toastMessage,
    sendSurvey
  } = useClientNps(client.id, client.agency_id);

  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const currentMonthYear = dayjs().format('YYYY-MM');
  const currentMonthName = dayjs().format('MMMM [de] YYYY');

  const handleSendOrCopy = async () => {
    const result = await sendSurvey();
    if (result.success && result.token) {
      setCopiedToken(result.token);
      setTimeout(() => setCopiedToken(null), 3000);
    }
  };

  const handleCopyExisting = async (token: string) => {
    const url = getNpsPublicUrl(token);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
    } catch (err) {
      console.warn('Clipboard writeText failed', err);
    }
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  // Gerar lista dos últimos 6 meses para garantir que meses sem pesquisa também apareçam com estado "Não enviada"
  const last6Months = React.useMemo(() => {
    const months = [];
    for (let i = 0; i < 6; i++) {
      const m = dayjs().subtract(i, 'month');
      const mKey = m.format('YYYY-MM');
      const found = history.find(h => h.month_year === mKey);
      months.push({
        monthYear: mKey,
        label: m.format('MMMM [de] YYYY'),
        shortLabel: m.format('MMM/YY'),
        record: found || null,
        isCurrent: i === 0
      });
    }
    return months;
  }, [history]);

  return (
    <div className={`bg-white rounded-3xl border border-stone-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.03)] overflow-hidden ${className}`}>
      {/* Toast flutuante */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-[#13284D] text-white rounded-2xl shadow-xl border border-white/10 text-sm font-medium"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header da Seção */}
      <div className="p-6 sm:p-8 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 shadow-sm">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                Pesquisa de Satisfação (NPS)
              </h3>
              {currentMonthNps && (
                <NpsBadge nps={currentMonthNps} size="sm" />
              )}
            </div>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Avalie o nível de recomendação mensal de {client.name} e acompanhe o histórico.
            </p>
          </div>
        </div>

        {/* Botão de Ação Principal */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSendOrCopy}
            disabled={sending}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#13284D] hover:bg-[#0e1d37] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
            title="Gera ou recupera o link da pesquisa deste mês e copia para o WhatsApp/Email"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando...</span>
              </>
            ) : copiedToken ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Link Copiado!</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>
                  {currentMonthNps ? 'Copiar link da pesquisa' : 'Enviar pesquisa de satisfação'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Card de Destaque do Mês Atual */}
      <div className="p-6 sm:p-8 bg-stone-50/50 border-b border-stone-100">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-stone-200/70 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center font-bold text-sm shrink-0">
              <Calendar className="w-5 h-5 text-stone-500" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
                Pesquisa do Mês Atual
              </span>
              <p className="text-sm font-bold text-stone-800 capitalize">
                {currentMonthName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap w-full md:w-auto justify-between md:justify-end">
            {currentMonthNps ? (
              <div className="flex items-center gap-3 flex-wrap">
                <NpsBadge nps={currentMonthNps} size="md" />

                {currentMonthNps.token && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyExisting(currentMonthNps.token)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors"
                      title="Copiar link público"
                    >
                      {copiedToken === currentMonthNps.token ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-stone-500" />
                          <span>Copiar link</span>
                        </>
                      )}
                    </button>
                    <a
                      href={getNpsPublicUrl(currentMonthNps.token)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-stone-400 hover:text-[#13284D] transition-colors"
                      title="Abrir página pública"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-stone-400 text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>Nenhuma pesquisa enviada em {currentMonthName}.</span>
              </div>
            )}
          </div>
        </div>

        {/* Comentário do mês atual, se houver */}
        {currentMonthNps?.comment && (
          <div className="mt-3 p-4 bg-white rounded-2xl border border-stone-200/70 text-xs text-stone-700">
            <div className="flex items-center gap-1.5 text-stone-400 font-bold uppercase tracking-wider text-[10px] mb-1">
              <MessageSquareQuote className="w-3.5 h-3.5 text-stone-400" />
              <span>Feedback do Cliente</span>
            </div>
            <p className="italic text-stone-800">
              "{currentMonthNps.comment}"
            </p>
          </div>
        )}
      </div>

      {/* Histórico de Satisfação (Linha do Tempo dos Últimos 6 Meses) */}
      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-2">
            <Clock className="w-4 h-4 text-stone-400" />
            Histórico de Satisfação (Últimos 6 meses)
          </h4>
          <span className="text-[11px] text-stone-400">
            {history.filter(h => h.score !== null).length} avaliações registradas
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-stone-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Carregando histórico de satisfação...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {last6Months.map((item) => {
              const rec = item.record;
              const hasResponse = rec && rec.score !== null && rec.score !== undefined;
              const isWaiting = rec && !hasResponse && !!rec.sent_at;

              return (
                <div
                  key={item.monthYear}
                  className={`p-4 rounded-2xl border transition-all ${
                    item.isCurrent
                      ? 'bg-amber-50/20 border-amber-200/60'
                      : 'bg-white border-stone-100 hover:border-stone-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        hasResponse 
                          ? (rec.score ?? 0) >= 9 ? 'bg-emerald-100 text-emerald-800' : (rec.score ?? 0) >= 7 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          : isWaiting
                          ? 'bg-stone-100 text-stone-600'
                          : 'bg-stone-50 text-stone-400 border border-stone-200/60'
                      }`}>
                        {hasResponse ? rec.score : isWaiting ? '...' : '—'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-bold text-stone-800 capitalize">
                            {item.label}
                          </p>
                          {item.isCurrent && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[9px] font-black uppercase tracking-wider">
                              Atual
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-400">
                          {hasResponse && rec.responded_at
                            ? `Respondido em ${dayjs(rec.responded_at).format('DD/MM/YYYY [às] HH:mm')}`
                            : isWaiting && rec.sent_at
                            ? `Enviado em ${dayjs(rec.sent_at).format('DD/MM/YYYY')}`
                            : 'Pesquisa não enviada'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
                      {rec ? (
                        <>
                          <NpsBadge nps={rec} size="sm" />
                          <button
                            type="button"
                            onClick={() => handleCopyExisting(rec.token)}
                            className="p-1.5 text-stone-400 hover:text-stone-700 transition-colors"
                            title="Copiar link"
                          >
                            {copiedToken === rec.token ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">
                          Sem registro
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Comentário do histórico, se existir */}
                  {rec?.comment && (
                    <div className="mt-3 pl-11">
                      <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/50 text-xs text-stone-600 italic">
                        "{rec.comment}"
                      </div>
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
};

import React from 'react';
import { Star, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { ClientNps } from '../../types';

interface NpsBadgeProps {
  nps?: ClientNps | null;
  score?: number | null;
  sentAt?: string | null;
  respondedAt?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const NpsBadge: React.FC<NpsBadgeProps> = ({
  nps,
  score: propScore,
  sentAt: propSentAt,
  respondedAt: propRespondedAt,
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  const score = propScore !== undefined ? propScore : nps?.score;
  const sentAt = propSentAt !== undefined ? propSentAt : nps?.sent_at;
  const respondedAt = propRespondedAt !== undefined ? propRespondedAt : nps?.responded_at;

  // Sem badge se a pesquisa não foi enviada no mês
  if (!sentAt && score === null && score === undefined) {
    return null;
  }

  const isResponded = score !== null && score !== undefined;
  const isWaiting = !isResponded && !!sentAt && !respondedAt;

  // Se não foi respondida e não está aguardando (ex: registro sem sent_at nem score)
  if (!isResponded && !isWaiting) {
    return null;
  }

  // 1. Badge cinza "Aguardando" se sent_at IS NOT NULL mas responded_at IS NULL
  if (isWaiting) {
    if (size === 'sm') {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200/80 ${className}`}
          title="Pesquisa de satisfação enviada, aguardando resposta do cliente"
        >
          <Clock className="w-3 h-3 text-stone-400 animate-pulse" />
          <span>Aguardando</span>
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-stone-100/90 text-stone-600 border border-stone-200 ${className}`}
        title="Pesquisa de satisfação enviada, aguardando resposta do cliente"
      >
        <Clock className="w-3.5 h-3.5 text-stone-400 animate-pulse" />
        <span>Aguardando NPS</span>
      </span>
    );
  }

  const numericScore = Number(score);

  // 2. Badge verde com estrela/número se score >= 9 (Promotor)
  if (numericScore >= 9) {
    const isSmall = size === 'sm';
    return (
      <span
        className={`inline-flex items-center gap-1 font-bold rounded-xl border tracking-tight ${
          isSmall
            ? 'px-2 py-0.5 text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200'
            : size === 'lg'
            ? 'px-3.5 py-1.5 text-sm bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm'
            : 'px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200'
        } ${className}`}
        title={`NPS: ${numericScore}/10 (Promotor)`}
      >
        <Star className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill-emerald-500 text-emerald-500 shrink-0`} />
        <span>{numericScore}</span>
        {showLabel && <span className="text-[10px] font-semibold text-emerald-600/90 uppercase tracking-wider">Promotor</span>}
      </span>
    );
  }

  // 3. Badge amarelo se score 7-8 (Neutro)
  if (numericScore >= 7 && numericScore <= 8) {
    const isSmall = size === 'sm';
    return (
      <span
        className={`inline-flex items-center gap-1 font-bold rounded-xl border tracking-tight ${
          isSmall
            ? 'px-2 py-0.5 text-[11px] bg-amber-50 text-amber-700 border-amber-200'
            : size === 'lg'
            ? 'px-3.5 py-1.5 text-sm bg-amber-50 text-amber-800 border-amber-300 shadow-sm'
            : 'px-2.5 py-1 text-xs bg-amber-50 text-amber-700 border-amber-200'
        } ${className}`}
        title={`NPS: ${numericScore}/10 (Neutro)`}
      >
        <span className="font-extrabold">{numericScore}</span>
        {showLabel && <span className="text-[10px] font-semibold text-amber-600/90 uppercase tracking-wider">Neutro</span>}
      </span>
    );
  }

  // 4. Badge vermelho se score <= 6 (Detrator)
  const isSmall = size === 'sm';
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-xl border tracking-tight ${
        isSmall
          ? 'px-2 py-0.5 text-[11px] bg-rose-50 text-rose-700 border-rose-200'
          : size === 'lg'
          ? 'px-3.5 py-1.5 text-sm bg-rose-50 text-rose-800 border-rose-300 shadow-sm'
          : 'px-2.5 py-1 text-xs bg-rose-50 text-rose-700 border-rose-200'
      } ${className}`}
      title={`NPS: ${numericScore}/10 (Detrator)`}
    >
      <AlertCircle className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-rose-500 shrink-0`} />
      <span>{numericScore}</span>
      {showLabel && <span className="text-[10px] font-semibold text-rose-600/90 uppercase tracking-wider">Detrator</span>}
    </span>
  );
};

import React, { useState } from 'react';
import { ClientHealthScore } from '../../types';
import { getHealthScoreCategory } from '../../hooks/useClientHealthScore';
import { Activity } from 'lucide-react';

interface HealthScoreBadgeProps {
  healthScore?: ClientHealthScore | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const HealthScoreBadge: React.FC<HealthScoreBadgeProps> = ({
  healthScore,
  size = 'md',
  showLabel = false
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!healthScore || healthScore.score === undefined || healthScore.score === null) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider border border-gray-200" title="Score de Saúde não calculado">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Health --
      </span>
    );
  }

  const { score, approval_speed_score, payment_score, nps_score, rejection_score, manual_penalty } = healthScore;
  const category = getHealthScoreCategory(score);

  const tooltipText = `Aprovação: ${approval_speed_score ?? '--'} | Pagamento: ${payment_score ?? '--'} | NPS: ${nps_score ?? '--'} | Rejeições: ${rejection_score ?? '--'} | Penalidade: ${manual_penalty || 0}`;

  if (size === 'sm') {
    return (
      <div 
        className="relative inline-flex items-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-tight border ${category.badgeBg} ${category.badgeText} ${category.badgeBorder} cursor-pointer transition-all hover:scale-105 shadow-2xs`}>
          <span className={`w-2 h-2 rounded-full ${category.dotColor} shrink-0 animate-pulse`} />
          {score}
          {showLabel && <span className="text-[9px] font-bold uppercase ml-0.5">{category.label}</span>}
        </span>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-2.5 bg-gray-900/95 text-stone-100 text-[11px] font-medium leading-tight rounded-xl shadow-2xl backdrop-blur-md border border-gray-800 z-50 pointer-events-none text-center">
            <div className="font-bold text-white mb-1 flex items-center justify-center gap-1">
              <Activity size={12} className={category.badgeText} />
              Health Score: {score}/100 ({category.label})
            </div>
            <div className="text-[10px] text-gray-300">
              {tooltipText}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-2xl border ${category.badgeBg} ${category.badgeText} ${category.badgeBorder} cursor-pointer transition-all hover:shadow-md`}>
        <span className={`w-2.5 h-2.5 rounded-full ${category.dotColor} shrink-0`} />
        <div className="flex flex-col text-left leading-none">
          <span className="text-xs font-black">{score}/100</span>
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">{category.label}</span>
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-gray-900 text-stone-100 text-xs font-medium leading-relaxed rounded-2xl shadow-2xl border border-gray-800 z-50 pointer-events-none text-center">
          <div className="font-bold text-white mb-1 flex items-center justify-center gap-1.5">
            <Activity size={14} className="text-emerald-400" />
            Saúde do Cliente: {score}/100
          </div>
          <p className="text-[11px] text-gray-300">
            {tooltipText}
          </p>
        </div>
      )}
    </div>
  );
};

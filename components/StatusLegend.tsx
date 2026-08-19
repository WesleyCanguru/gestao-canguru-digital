
import React from 'react';
import { Target } from 'lucide-react';
import { STATUS_CONFIG } from '../constants';
import { PostStatus } from '../types';

export const StatusLegend: React.FC = () => {
  const contentStatuses: PostStatus[] = [
    'draft', 'pending_approval', 'changes_requested', 'rejected', 'approved', 'scheduled', 'published'
  ];

  const renderBadge = (s: PostStatus) => {
    const config = STATUS_CONFIG[s];
    if (!config) return null;
    return (
      <div 
        key={s} 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all shadow-2xs whitespace-nowrap"
        style={{ backgroundColor: config.bg, color: config.color, borderColor: config.dot + '30' }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: config.dot }}></span>
        <span>{config.label}</span>
      </div>
    );
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm border border-stone-200/70 rounded-2xl p-3 sm:p-3.5 mb-5 shadow-2xs flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 justify-between">
      <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest shrink-0">
        <Target size={12} className="text-stone-400" />
        <span>Status:</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {contentStatuses.map(renderBadge)}
      </div>
    </div>
  );
};


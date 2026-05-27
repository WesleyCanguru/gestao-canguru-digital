
import React from 'react';
import { Target } from 'lucide-react';
import { motion } from 'motion/react';
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
      <motion.div 
        key={s} 
        whileHover={{ scale: 1.05 }}
        className="flex items-center gap-3 px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
        style={{ backgroundColor: config.bg, color: config.color, borderColor: config.dot + '40' }}
      >
        <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: config.dot }}></div>
        {config.label}
      </motion.div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 backdrop-blur-md border border-black/[0.03] rounded-3xl p-6 mb-10 shadow-[0_10px_30px_rgba(0,0,0,0.02)] flex flex-col gap-6"
    >
      <div>
        <div className="flex items-center gap-3 mb-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">
          <div className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center border border-black/[0.02]">
            <Target size={12} />
          </div>
          Status de Conteúdo
        </div>
        <div className="flex flex-wrap gap-3">
          {contentStatuses.map(renderBadge)}
        </div>
      </div>
    </motion.div>
  );
};


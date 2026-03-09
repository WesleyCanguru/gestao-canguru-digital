
import React from 'react';
import { Info, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export const StatusLegend: React.FC = () => {
  const statuses = [
    { label: 'Em Produção', color: 'bg-gray-100 border-gray-200 text-gray-600' },
    { label: 'Em Aprovação', color: 'bg-orange-100 border-orange-200 text-orange-700' },
    { label: 'Ajustes Solicitados', color: 'bg-red-100 border-red-200 text-red-700' },
    { label: 'Pronto / Aprovado', color: 'bg-blue-100 border-blue-200 text-blue-700' },
    { label: 'Programado', color: 'bg-purple-100 border-purple-200 text-purple-700' },
    { label: 'Publicado', color: 'bg-green-100 border-green-200 text-green-700' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 backdrop-blur-md border border-black/[0.03] rounded-3xl p-6 mb-10 shadow-[0_10px_30px_rgba(0,0,0,0.02)]"
    >
      <div className="flex items-center gap-3 mb-5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">
        <div className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center border border-black/[0.02]">
          <Info size={12} />
        </div>
        Legenda de Status
      </div>
      <div className="flex flex-wrap gap-3">
        {statuses.map((s, idx) => (
          <motion.div 
            key={idx} 
            whileHover={{ scale: 1.05 }}
            className={`flex items-center gap-3 px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm ${s.color}`}
          >
            <div className="w-2 h-2 rounded-full bg-current opacity-40 shadow-[0_0_8px_currentColor]"></div>
            {s.label}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

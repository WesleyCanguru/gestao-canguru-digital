
import React from 'react';
import { motion } from 'motion/react';
import { Instagram, AlertCircle, Clock } from 'lucide-react';
import { Lead } from '../../types';
import dayjs from 'dayjs';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onClick }) => {
  const isOverdue = lead.next_followup_date && dayjs(lead.next_followup_date).isBefore(dayjs().add(1, 'day'), 'day');
  const isToday = lead.next_followup_date && dayjs(lead.next_followup_date).isSame(dayjs(), 'day');

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full bg-white p-5 rounded-2xl border border-black/[0.03] shadow-sm text-left group transition-all"
    >
      <div className="flex justify-between items-start mb-3">
        <span className="px-2 py-0.5 bg-gray-50 text-gray-400 text-[8px] font-bold uppercase tracking-widest rounded-full">
          {lead.niche}
        </span>
        {(isOverdue || isToday) && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>
            <Clock size={10} />
            {isOverdue ? 'Atrasado' : 'Hoje'}
          </div>
        )}
      </div>

      <h4 className="font-bold text-brand-dark mb-2 group-hover:text-blue-600 transition-colors">{lead.name}</h4>
      
      <div className="flex items-center gap-2 text-gray-400">
        <Instagram size={12} />
        <span className="text-[10px] font-medium truncate">@{lead.instagram_url.split('/').pop()}</span>
      </div>

      {lead.next_followup_date && (
        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
          <span className="text-[8px] uppercase tracking-widest font-bold text-gray-300">Próximo Contato</span>
          <span className={`text-[10px] font-bold ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
            {dayjs(lead.next_followup_date).format('DD/MM')}
          </span>
        </div>
      )}
    </motion.button>
  );
};

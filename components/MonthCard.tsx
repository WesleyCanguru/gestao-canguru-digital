
import React from 'react';
import { MonthPlan, MonthColor } from '../types';
import { CalendarDays, MapPin, Target, Pin, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface MonthCardProps {
  data: MonthPlan;
  onClick?: () => void;
  postCount?: number;
}

const colorStyles: Record<MonthColor, { border: string; bg: string; text: string; badge: string; gradient: string }> = {
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800',
    gradient: 'from-blue-500/20 to-transparent'
  },
  yellow: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-800',
    gradient: 'from-yellow-500/20 to-transparent'
  },
  red: {
    border: 'border-red-600',
    bg: 'bg-red-50',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-800',
    gradient: 'from-red-600/20 to-transparent'
  },
  green: {
    border: 'border-brand-green',
    bg: 'bg-green-50',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-800',
    gradient: 'from-brand-green/20 to-transparent'
  }
};

export const MonthCard: React.FC<MonthCardProps> = ({ data, onClick, postCount = 0 }) => {
  const style = colorStyles[data.color];

  return (
    <motion.div 
      whileHover={{ y: -8, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="premium-card flex flex-col h-full relative cursor-pointer group overflow-hidden bg-white rounded-[2.5rem] border border-black/[0.03] shadow-[0_10px_30px_rgba(0,0,0,0.02)] transition-all duration-500"
    >
      {/* Decorative gradient background */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${style.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-bl-[100px] pointer-events-none`}></div>
      
      {/* Top Border Indicator - Subtle */}
      <div className={`h-1.5 w-full opacity-10 ${style.bg.replace('bg-', 'bg-opacity-100 bg-')}`}></div>
      
      <div className="p-10 flex-grow flex flex-col relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-400">
                {data.month}
              </span>
              {postCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-black/[0.02] text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  <div className={`w-1 h-1 rounded-full ${style.bg.replace('bg-', 'bg-opacity-100 bg-')}`}></div>
                  {postCount} Posts
                </div>
              )}
            </div>
            <h3 className="text-2xl font-bold text-brand-dark leading-tight group-hover:text-gray-600 transition-colors tracking-tight">
              {data.title}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-brand-dark group-hover:text-white transition-all duration-500 shadow-sm border border-black/[0.02]">
            <ArrowRight size={20} />
          </div>
        </div>

        {/* Function */}
        <div className="flex items-start gap-4 mb-10 text-[14px] text-gray-500 font-medium leading-relaxed bg-gray-50/50 p-5 rounded-3xl border border-black/[0.01]">
          <div className={`w-10 h-10 rounded-2xl bg-white shadow-sm border border-black/[0.03] flex items-center justify-center flex-shrink-0 ${style.text}`}>
            <Target size={18} />
          </div>
          <div className="pt-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">Objetivo Principal</p>
            <p className="text-brand-dark font-bold">{data.function}</p>
          </div>
        </div>

        {/* Events Section */}
        {data.events && data.events.length > 0 && (
          <div className="mb-10 space-y-4">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
              <CalendarDays size={14} className="text-gray-300" /> Eventos Chave
            </h4>
            <div className="space-y-4 pl-1">
              {data.events.map((event, idx) => (
                <div key={idx} className="flex items-start gap-4 text-[14px] group/event">
                  <div className="w-1.5 h-1.5 rounded-full mt-2 bg-gray-200 group-hover/event:bg-brand-dark transition-colors"></div>
                  <div className="flex flex-col">
                    <span className="font-bold text-brand-dark group-hover/event:translate-x-1 transition-transform duration-300">{event.name}</span>
                    {event.date && (
                      <span className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mt-1">
                        {event.date}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deliverables List */}
        <div className="space-y-4 mb-10 flex-grow">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
            <Pin size={14} className="text-gray-300" /> Campanhas
          </h4>
          <div className="space-y-4 pl-1">
            {data.deliverables.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 opacity-20 ${style.bg.replace('bg-', 'bg-opacity-100 bg-')}`}></div>
                <p className="text-[14px] text-gray-500 leading-snug font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Takeaways Footer */}
        <div className="mt-auto pt-8 border-t border-black/[0.03]">
          <div className="flex flex-wrap gap-3">
            {data.takeaways.map((takeaway, idx) => (
              <span key={idx} className="inline-flex items-center gap-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/80 px-4 py-2 rounded-xl border border-black/[0.02] hover:bg-white hover:shadow-md transition-all duration-300">
                <div className={`w-1 h-1 rounded-full ${style.bg.replace('bg-', 'bg-opacity-100 bg-')}`}></div>
                {takeaway}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

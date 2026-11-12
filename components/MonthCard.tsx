
import React from 'react';
import { MonthPlan, MonthColor } from '../types';
import { Target, ArrowRight, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { useT } from '../lib/i18n';

interface MonthCardProps {
  data: MonthPlan;
  onClick?: () => void;
  postCount?: number;
  isLocked?: boolean;
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

export const MonthCard: React.FC<MonthCardProps> = ({ data, onClick, postCount = 0, isLocked = false }) => {
  const { t } = useT();
  const style = colorStyles[data.color];

  return (
    <motion.div 
      whileHover={isLocked ? {} : { y: -8, scale: 1.01 }}
      whileTap={isLocked ? {} : { scale: 0.98 }}
      onClick={isLocked ? undefined : onClick}
      className={`premium-card flex flex-col h-full relative overflow-hidden bg-white rounded-[2.5rem] border border-black/[0.03] shadow-[0_10px_30px_rgba(0,0,0,0.02)] transition-all duration-500 ${isLocked ? 'opacity-70 grayscale-[0.3]' : 'cursor-pointer group'}`}
    >
      {/* Decorative gradient background */}
      {!isLocked && (
        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${style.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-bl-[100px] pointer-events-none`}></div>
      )}
      
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
              {postCount > 0 && !isLocked && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-black/[0.02] text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  <div className={`w-1 h-1 rounded-full ${style.bg.replace('bg-', 'bg-opacity-100 bg-')}`}></div>
                  {postCount} Posts
                </div>
              )}
            </div>
            <h3 className={`text-2xl font-bold leading-tight tracking-tight ${isLocked ? 'text-gray-400' : 'text-brand-dark group-hover:text-gray-600 transition-colors'}`}>
              {isLocked ? t('Sendo desenvolvido...') : data.title}
            </h3>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-black/[0.02] ${isLocked ? 'bg-gray-50 text-gray-300' : 'bg-gray-50 text-gray-300 group-hover:bg-brand-dark group-hover:text-white transition-all duration-500'}`}>
            {isLocked ? <Lock size={18} /> : <ArrowRight size={20} />}
          </div>
        </div>

      </div>
    </motion.div>
  );
};

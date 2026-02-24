
import React from 'react';
import { ANNUAL_PLAN } from '../constants';
import { MonthCard } from './MonthCard';
import { DistributionAnalysis } from './DistributionAnalysis';
import { Compass, CheckCircle2 } from 'lucide-react';

interface AnnualOverviewProps {
  onSelectMonth: (month: string) => void;
}

export const AnnualOverview: React.FC<AnnualOverviewProps> = ({ onSelectMonth }) => {
  return (
    <div className="animate-in fade-in duration-500">
      
      {/* North Star Section - Compact Version */}
      <div className="bg-gradient-to-r from-gray-900 to-brand-dark rounded-xl p-5 mb-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-4 -bottom-10 opacity-5 transform rotate-12 pointer-events-none">
          <Compass size={140} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
          {/* Left: Title */}
          <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 md:pr-6">
            <div className="flex items-center gap-2 mb-2">
              <Compass className="text-brand-green" size={18} />
              <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-brand-green">Estratégia Macro</h2>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight leading-tight">
              {ANNUAL_PLAN.northStar.title}
            </h1>
          </div>

          {/* Right: Content */}
          <div className="md:w-2/3">
            <p className="text-sm md:text-base text-gray-300 font-light leading-relaxed mb-4">
              {ANNUAL_PLAN.northStar.description}
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {ANNUAL_PLAN.benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-[10px] md:text-xs font-medium text-gray-400 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                  <CheckCircle2 size={12} className="text-brand-green" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Distribution Analysis (Moved from separate tab) */}
      <DistributionAnalysis />

      {/* Quarters / Grid Grid */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-dark"></span>
          Calendário 2026
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ANNUAL_PLAN.months.map((monthData, index) => (
            <MonthCard 
              key={index} 
              data={monthData} 
              onClick={() => onSelectMonth(monthData.month)}
            />
          ))}
        </div>
      </div>
      
      <div className="mt-12 text-center">
        <p className="text-gray-400 text-sm">
          Planejamento estratégico sujeito a adaptações táticas conforme feedback de mercado.
        </p>
      </div>
    </div>
  );
};


import React from 'react';
import { SOCIAL_STRATEGY } from '../constants';
import { Instagram, Facebook, Linkedin, CalendarCheck, Lightbulb, Check } from 'lucide-react';

export const DistributionAnalysis: React.FC = () => {
  return (
    <div className="animate-in fade-in duration-500 mt-8">
      
      {/* Introduction */}
      <div className="mb-6 text-center md:text-left flex items-center gap-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
           <span className="w-1.5 h-1.5 rounded-full bg-brand-dark"></span>
           Análise de Distribuição
        </h2>
        <span className="hidden md:inline text-gray-300">|</span>
        <p className="text-gray-500 text-xs md:text-sm">Definição estratégica dos dias de postagem para maximizar o alcance B2B.</p>
      </div>

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {SOCIAL_STRATEGY.map((platform) => {
          const isMeta = platform.id === 'meta';
          
          return (
            <div 
              key={platform.id} 
              className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col ${isMeta ? 'border-purple-100' : 'border-blue-100'}`}
            >
              {/* Header */}
              <div className={`p-4 ${isMeta ? 'bg-gradient-to-br from-purple-50 to-pink-50' : 'bg-gradient-to-br from-blue-50 to-indigo-50'} flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg shadow-sm bg-white text-gray-800`}>
                    {isMeta ? (
                      <div className="flex gap-1">
                        <Instagram size={16} className="text-pink-600" />
                        <Facebook size={16} className="text-blue-600" />
                      </div>
                    ) : (
                      <Linkedin size={16} className="text-[#0077B5]" />
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{platform.name}</h3>
                </div>
                
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white/60 px-2 py-1 rounded-md border border-white/50">
                  <CalendarCheck size={14} className="text-gray-500" />
                  <span>{platform.schedule}</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 flex-grow flex flex-col">
                <p className="text-gray-600 text-xs font-medium mb-5 italic border-l-2 pl-3 py-0.5 border-gray-200">
                  "{platform.description}"
                </p>

                <div className="space-y-4">
                  {platform.bestDays.map((dayData, idx) => (
                    <div key={idx} className="relative pl-4">
                       {/* Timeline-like line */}
                      <div className={`absolute left-0 top-0 bottom-0 w-px ${idx === platform.bestDays.length -1 ? 'h-2' : 'h-full'} bg-gray-100`}></div>
                      <div className={`absolute left-[-1.5px] top-1.5 w-1 h-1 rounded-full ${isMeta ? 'bg-purple-400' : 'bg-blue-400'}`}></div>

                      <h4 className="font-bold text-gray-900 text-xs mb-1">{dayData.day}</h4>
                      <div className="space-y-0.5">
                        {dayData.reason.map((r, rIdx) => (
                          <div key={rIdx} className="flex items-start gap-1.5 text-[11px] text-gray-500 leading-tight">
                             <Check size={10} className={`mt-0.5 flex-shrink-0 ${isMeta ? 'text-purple-500' : 'text-blue-500'}`} />
                             <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tip Section (mostly for LinkedIn) */}
                {platform.tip && (
                  <div className="mt-5 bg-amber-50 rounded-lg p-3 border border-amber-100 flex gap-2 items-start">
                    <Lightbulb className="text-amber-500 flex-shrink-0 mt-0.5" size={14} />
                    <p className="text-[10px] text-amber-800 font-medium leading-snug">
                      <span className="font-bold text-amber-600 uppercase tracking-wide mr-1">Dica:</span>
                      {platform.tip}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { DETAILED_MONTHLY_PLANS } from '../constants';
import { MonthlyDetailedPlan, DailyContent } from '../types';
import { Instagram, Linkedin, CalendarDays, Target, BarChart3, Repeat, FileCheck, CheckCircle2, ArrowLeft, Lock, MessageCircle } from 'lucide-react';
import { PostModal } from './PostModal';
import { useAuth } from '../lib/supabase';

interface MonthDetailProps {
  monthName: string;
  onBack: () => void;
}

export const MonthDetail: React.FC<MonthDetailProps> = ({ monthName, onBack }) => {
  const { userRole } = useAuth();
  const [selectedDay, setSelectedDay] = useState<{content: DailyContent, key: string} | null>(null);

  const plan = DETAILED_MONTHLY_PLANS.find(p => p.month.toLowerCase().includes(monthName.toLowerCase()));

  if (!plan) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Planejamento em desenvolvimento</h2>
        <button onClick={onBack} className="px-6 py-2 bg-gray-100 rounded-lg">Voltar</button>
      </div>
    );
  }

  // Helper para gerar a chave única do post
  const getDateKey = (day: string) => {
     // Ex: "02/02 – Segunda-feira" -> "02-02-2026" (simplificado para demo)
     return `${day.split(' ')[0]}-2026`;
  };

  // Helper de Cor baseado em um status fake (aleatório para demo, mas seria do banco)
  const getCardStyle = (day: string) => {
    // EM PRODUÇÃO: Aqui buscaríamos o status real do post no array de posts carregado do Supabase
    // Para demo visual:
    // Se for Admin: vê azul se tiver img, vê laranja se tiver comentario
    // Se for Equipe: vê azul se tiver img, vê roxo se tiver comentario interno
    
    // Default (Cinza/Branco)
    return 'bg-white border-gray-200 hover:border-gray-300';
    
    // Exemplo visual (descomentar para testar cores):
    // return 'bg-blue-50 border-blue-200 hover:border-blue-300';
    // return 'bg-purple-50 border-purple-200 hover:border-purple-300';
    // return 'bg-green-50 border-green-200 hover:border-green-300';
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {selectedDay && (
        <PostModal 
          dayContent={selectedDay.content} 
          dateKey={selectedDay.key} 
          onClose={() => setSelectedDay(null)} 
        />
      )}

      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-brand-dark transition-colors mb-6 font-medium"
      >
        <ArrowLeft size={20} />
        Voltar para Visão Geral
      </button>

      <div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden">
        
        {/* Header (Mantido igual) */}
        <div className="bg-brand-dark text-white p-8 md:p-10 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10">
            <CalendarDays size={200} />
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight mb-2">{plan.month}</h2>
            <div className="inline-block bg-white/10 backdrop-blur-sm px-3 py-1 rounded border border-white/20 text-blue-200 text-xs font-bold uppercase tracking-[0.2em] mb-6">
              Tema: {plan.theme}
            </div>
            {/* ... Resto do Header ... */}
          </div>
        </div>

        {/* Weeks Container */}
        <div className="p-6 md:p-10 bg-gray-50/50">
           <div className="grid grid-cols-1 gap-8">
              {plan.weeks.map((week, wIdx) => (
                <div key={wIdx} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gray-100 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">{week.title}</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {week.days.map((day, dIdx) => {
                      const dateKey = getDateKey(day.day);
                      
                      return (
                        <div 
                          key={dIdx} 
                          onClick={() => setSelectedDay({content: day, key: dateKey})}
                          className={`p-5 flex flex-col sm:flex-row gap-4 sm:items-start group transition-all cursor-pointer border-l-4 border-transparent hover:bg-gray-50 ${getCardStyle(day.day)}`}
                        >
                          {/* Day Badge */}
                          <div className="sm:w-48 flex-shrink-0">
                             <div className="inline-flex flex-wrap items-center gap-2 mb-1">
                                <span className="font-bold text-gray-900 text-sm">{day.day}</span>
                                {day.exclusive && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Exclusivo</span>}
                                {day.repurposed && <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-0.5"><Repeat size={10} /> Adaptado</span>}
                             </div>
                             <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                                {day.platform === 'linkedin' ? (
                                  <Linkedin size={14} className="text-[#0077B5]" /> 
                                ) : (
                                  <Instagram size={14} className="text-purple-600" />
                                )}
                                <span className="capitalize">{day.platform === 'meta' ? 'Insta/Face' : 'LinkedIn'}</span>
                             </div>
                          </div>

                          {/* Content Details */}
                          <div className="flex-grow">
                             <div className="flex justify-between items-start">
                               <div className="flex items-start gap-2 mb-2">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${day.platform === 'linkedin' ? 'bg-blue-50 text-blue-800 border-blue-100' : 'bg-purple-50 text-purple-800 border-purple-100'}`}>
                                    📌 {day.type}
                                  </span>
                               </div>
                               {/* Status Icon Placeholder */}
                               <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="flex items-center gap-1 text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-full">
                                     <MessageCircle size={12} /> Ver Detalhes
                                  </div>
                               </div>
                             </div>

                             <h4 className="text-gray-900 font-semibold mb-2">{day.theme}</h4>
                             
                             {day.bullets && (
                               <ul className="space-y-1">
                                  {day.bullets.map((b, bIdx) => (
                                    <li key={bIdx} className="flex items-start gap-2 text-sm text-gray-600">
                                      <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                                      {b}
                                    </li>
                                  ))}
                               </ul>
                             )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
};

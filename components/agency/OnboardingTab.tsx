import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Client, ContractForm, ClientBriefing } from '../../types';
import { CheckCircle, Clock, FileText, Target, ChevronRight, Check } from 'lucide-react';
import { motion } from 'motion/react';
import dayjs from 'dayjs';

import { ClientOnboarding } from '../ClientOnboarding';
import { BRIEFING_QUESTIONS } from '../BriefingOnboarding';
import { X } from 'lucide-react';

const SERVICE_TO_BRIEFINGS: Record<string, string[]> = {
  'Social Media': ['persona', 'publico_alvo', 'tom_voz', 'posicionamento'],
  'Tráfego Pago': ['trafego_pago'],
  'Website': ['site'],
  'Identidade Visual': ['persona', 'posicionamento'],
  'E-mail Marketing': ['publico_alvo', 'tom_voz'],
  'Fotos com IA': ['persona', 'publico_alvo']
};

interface OnboardingData extends Client {
  contract?: ContractForm;
  briefings?: ClientBriefing[];
  onboarding?: {
    id: string;
    is_completed: boolean;
    steps: {
      id: string;
      title: string;
      completed: boolean;
    }[];
  };
}

export const OnboardingTab: React.FC<{ onNavigateToClients: (client: Client) => void }> = ({ onNavigateToClients }) => {
  const [clients, setClients] = useState<OnboardingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [viewingBriefingsClient, setViewingBriefingsClient] = useState<OnboardingData | null>(null);

  useEffect(() => {
    fetchOnboardingData();
  }, []);

  const fetchOnboardingData = async () => {
    setLoading(true);
    try {
      // Fetch clients, contracts, briefings, and onboarding checklist
      const { data: clientsData } = await supabase
        .from('clients')
        .select(`
          *,
          contract:contract_forms(*),
          briefings:client_briefings(*),
          onboarding:client_onboarding(*)
        `)
        .eq('is_active', true)
        .order('name');

      if (clientsData) {
        // Map data to handle 1:N relations gracefully
        const mappedClients = clientsData.map((client: any) => {
          // Handle cases where foreign relations might be returned as objects or arrays
          const contract = Array.isArray(client.contract) 
            ? (client.contract.length > 0 ? client.contract[0] : null)
            : client.contract;
          
          let onboarding = Array.isArray(client.onboarding)
            ? (client.onboarding.length > 0 ? client.onboarding[0] : null)
            : client.onboarding;

          return {
            ...client,
            contract,
            briefings: client.briefings || [],
            onboarding,
          };
        });
        setClients(mappedClients);
      }
    } catch (error) {
      console.error('Error fetching onboarding data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10 h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-dark"></div>
      </div>
    );
  }

  if (selectedClientId) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col gap-8 pb-32">
        <button 
          onClick={() => {
            setSelectedClientId(null);
            fetchOnboardingData();
          }}
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-brand-dark transition-colors w-fit"
        >
          <ChevronRight className="rotate-180" size={16} /> Voltar
        </button>
        <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100">
           <ClientOnboarding clientId={selectedClientId} />
        </div>
      </div>
    );
  }

  const activeClientsCount = clients.length;
  
  const pendingBriefingsCount = clients.filter(c => {
    if (c.briefings_waived) return false;
    if (!c.services || c.services.length === 0) return false;
    
    const requiredTypes = new Set<string>();
    c.services.forEach(service => {
      const types = SERVICE_TO_BRIEFINGS[service] || [];
      types.forEach(t => requiredTypes.add(t));
    });
    
    const completedBriefings = c.briefings?.filter(b => requiredTypes.has(b.briefing_type) && b.is_completed).length || 0;
    return completedBriefings < requiredTypes.size;
  }).length;

  const completedOnboardingCount = clients.filter(c => {
    const hasSignedContract = c.contract?.status === 'signed';
    
    if (c.briefings_waived) return hasSignedContract;

    const requiredTypes = new Set<string>();
    (c.services || []).forEach(service => {
      const types = SERVICE_TO_BRIEFINGS[service] || [];
      types.forEach(t => requiredTypes.add(t));
    });

    const completedBriefings = c.briefings?.filter(b => requiredTypes.has(b.briefing_type) && b.is_completed).length || 0;
    const hasAllBriefings = requiredTypes.size > 0 ? (completedBriefings === requiredTypes.size) : true;
    
    // Check internal onboarding as well
    const internalOnboardingCompleted = c.onboarding?.is_completed || false;
    
    return hasSignedContract && hasAllBriefings && internalOnboardingCompleted;
  }).length;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col gap-8 pb-32">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-black text-brand-dark tracking-tight flex items-center gap-3">
            <Target className="w-8 h-8 text-[#00E5FF]" /> Onboarding
          </h2>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-2">Visão geral do embarque de clientes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Total de Clientes Ativos</p>
            <p className="text-4xl font-black text-brand-dark">{activeClientsCount}</p>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] text-gray-50 opacity-50 z-0">
            <Target size={120} strokeWidth={1} />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Briefings Pendentes</p>
            <p className="text-4xl font-black text-brand-dark">{pendingBriefingsCount}</p>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] text-yellow-50 opacity-50 z-0">
            <Clock size={120} strokeWidth={1} />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Onboarding Completo</p>
            <p className="text-4xl font-black text-green-600">{completedOnboardingCount}</p>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] text-green-50 opacity-50 z-0">
            <CheckCircle size={120} strokeWidth={1} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-gray-400">Cliente</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-gray-400">Serviços</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-gray-400">Contrato</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-gray-400">Briefings</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-gray-400">Checklist Interno</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-gray-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((client) => {
                const contractStatus = client.contract?.status || 'none';
                
                const requiredTypes = new Set<string>();
                (client.services || []).forEach(service => {
                  const types = SERVICE_TO_BRIEFINGS[service] || [];
                  types.forEach(t => requiredTypes.add(t));
                });
                
                const expectedBriefings = requiredTypes.size;
                const completedBriefings = client.briefings?.filter(b => requiredTypes.has(b.briefing_type) && b.is_completed).length || 0;
                
                // Checklist Logic (Internal Onboarding)
                let totalChecklist = 0;
                let completedChecklist = 0;

                if (client.onboarding && client.onboarding.steps) {
                  totalChecklist = client.onboarding.steps.length;
                  completedChecklist = client.onboarding.steps.filter((s: any) => s.completed).length;
                } else {
                  // Fallback: If no onboarding record exists, calculate potential steps
                  // We import this dynamically if possible, or just mock the length for UI
                  // Based on hooks/useClientOnboarding.ts, universal(5) + final(2) = 7 steps base
                  const serviceExtraSteps = (client.services || []).reduce((acc: number, s: string) => {
                    if (s === 'Social Media') return acc + 4;
                    if (s === 'Tráfego Pago') return acc + 6;
                    if (s.includes('Site')) return acc + 4;
                    if (s === 'Identidade Visual') return acc + 3;
                    if (s === 'Papelaria') return acc + 3;
                    if (s === 'Email Marketing') return acc + 3;
                    return acc;
                  }, 0);
                  totalChecklist = 7 + serviceExtraSteps;
                  completedChecklist = 0;
                }

                const checklistPercentage = totalChecklist > 0 ? (completedChecklist / totalChecklist) * 100 : 0;

                return (
                  <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                          style={{ backgroundColor: client.color }}
                        >
                          {client.initials}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{client.name}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest">{client.segment || 'Sem segmento'}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-6">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {client.services?.map(service => (
                          <span key={service} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                            {service}
                          </span>
                        ))}
                        {(!client.services || client.services.length === 0) && (
                          <span className="text-[10px] text-gray-400 italic">Nenhum</span>
                        )}
                      </div>
                    </td>

                    <td className="p-6">
                      {contractStatus === 'signed' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                          <Check size={12} /> Assinado
                        </div>
                      ) : contractStatus === 'submitted' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                          <FileText size={12} /> Dados Receb.
                        </div>
                      ) : contractStatus === 'pending' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 text-yellow-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                          <Clock size={12} /> Aguardando
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                          Sem Contrato
                        </div>
                      )}
                    </td>

                    <td className="p-6">
                      <button 
                        onClick={() => setViewingBriefingsClient(client)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${
                          expectedBriefings === 0 ? 'bg-gray-50 text-gray-500' :
                          completedBriefings === expectedBriefings ? 'bg-green-50 text-green-600 hover:bg-green-100' :
                          completedBriefings > 0 ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {completedBriefings} / {expectedBriefings}
                      </button>
                    </td>

                    <td className="p-6">
                      <div className="flex flex-col gap-2 min-w-[120px]">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          <span>{completedChecklist} / {totalChecklist}</span>
                          <span>{Math.round(checklistPercentage)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-brand-dark rounded-full transition-all duration-500 delay-100"
                            style={{ width: `${checklistPercentage}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="p-6">
                      <button 
                        onClick={() => setSelectedClientId(client.id)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-brand-dark"
                        title="Ver Checklist"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500 font-medium">
                    Nenhum cliente encomendado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Briefing Viewer Modal */}
      {viewingBriefingsClient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-2xl font-black text-brand-dark tracking-tight">Briefings Estratégicos</h3>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Cliente: {viewingBriefingsClient.name}</p>
              </div>
              <button 
                onClick={() => setViewingBriefingsClient(null)}
                className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm group"
              >
                <X size={24} className="text-gray-400 group-hover:text-red-500 transition-colors" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-12 hide-scrollbar">
              {viewingBriefingsClient.briefings && viewingBriefingsClient.briefings.length > 0 ? (
                viewingBriefingsClient.briefings.map(b => {
                  const spec = BRIEFING_QUESTIONS[b.briefing_type];
                  if (!spec) return null;
                  
                  return (
                    <div key={b.id} className="space-y-6">
                      <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                        <div className="w-10 h-10 bg-brand-dark/5 rounded-xl flex items-center justify-center text-brand-dark">
                          <FileText size={20} />
                        </div>
                        <h4 className="text-xl font-bold text-gray-900">{spec.title}</h4>
                      </div>

                      <div className="grid gap-6">
                        {spec.questions.map(q => (
                          <div key={q.key} className="bg-gray-50/50 rounded-2xl p-6 border border-black/[0.02]">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{q.label}</p>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {!b.responses[q.key] ? (
                                <span className="text-gray-300 italic">Não respondido</span>
                              ) : typeof b.responses[q.key] === 'object' ? (
                                Array.isArray(b.responses[q.key]) 
                                  ? (b.responses[q.key] as string[]).join(', ') 
                                  : Object.entries(b.responses[q.key] as Record<string, any>)
                                      .filter(([_, v]) => v)
                                      .map(([k]) => k)
                                      .join(', ')
                              ) : (
                                String(b.responses[q.key])
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-20">
                  <FileText size={48} className="text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Nenhum briefing preenchido por este cliente ainda.</p>
                </div>
              )}
            </div>

            <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setViewingBriefingsClient(null)}
                className="px-8 py-4 bg-brand-dark text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:opacity-90 transition-all shadow-lg"
              >
                Fechar Visualização
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

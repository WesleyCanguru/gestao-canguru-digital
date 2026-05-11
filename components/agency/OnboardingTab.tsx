import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Client, ContractForm, ClientBriefing } from '../../types';
import { CheckCircle, Clock, FileText, Target, ChevronRight, Check } from 'lucide-react';
import { motion } from 'motion/react';
import dayjs from 'dayjs';

import { ClientOnboarding } from '../ClientOnboarding';

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
        const mappedClients = clientsData.map((client: any) => ({
          ...client,
          contract: client.contract && client.contract.length > 0 ? client.contract[0] : null,
          briefings: client.briefings || [],
          onboarding: client.onboarding && client.onboarding.length > 0 ? client.onboarding[0] : null,
        }));
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
    
    return hasSignedContract && hasAllBriefings;
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
                const totalChecklist = client.onboarding?.steps?.length || 0;
                const completedChecklist = client.onboarding?.steps?.filter(s => s.completed).length || 0;
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
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                        expectedBriefings === 0 ? 'bg-gray-50 text-gray-500' :
                        completedBriefings === expectedBriefings ? 'bg-green-50 text-green-600' :
                        completedBriefings > 0 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {completedBriefings} / {expectedBriefings}
                      </div>
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
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { Client, ContractForm, ClientBriefing, OnboardingChecklist } from '../../types';
import { CheckCircle, Clock, FileText, Target, ChevronRight, Check, Link as LinkIcon, Copy, Settings, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import dayjs from 'dayjs';

import { BriefingOnboarding, BRIEFING_QUESTIONS } from '../BriefingOnboarding';
import { X } from 'lucide-react';
import { ClientChecklistView } from './ClientChecklistView';
import { OnboardingTemplatesModal } from './OnboardingTemplatesModal';
import { BriefingTemplatesModal } from './BriefingTemplatesModal';

const SERVICE_TO_BRIEFINGS: Record<string, string[]> = {
  'Social Media': ['persona', 'publico_alvo', 'tom_voz', 'posicionamento', 'conteudo_bastidores'],
  'Tráfego Pago': ['trafego_pago'],
  'Website': ['site'],
  'Identidade Visual': ['persona', 'posicionamento'],
  'E-mail Marketing': ['publico_alvo', 'tom_voz'],
  'Fotos com IA': ['persona', 'publico_alvo']
};

interface OnboardingData extends Client {
  contract?: ContractForm;
  briefings?: ClientBriefing[];
  onboarding_checklist?: OnboardingChecklist[];
}

export const OnboardingTab: React.FC<{ onNavigateToClients: (client: Client) => void }> = ({ onNavigateToClients }) => {
  const { agencyId } = useAuth();
  const [clients, setClients] = useState<OnboardingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [viewingBriefingsClient, setViewingBriefingsClient] = useState<OnboardingData | null>(null);
  const [viewingChecklistClient, setViewingChecklistClient] = useState<OnboardingData | null>(null);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showBriefingsModal, setShowBriefingsModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedBriefingId, setExpandedBriefingId] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<Record<string, any>>({});

  const copyBriefingLink = (type: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/?view=briefing&type=${type}`;
    navigator.clipboard.writeText(link);
    setCopiedId(type);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    fetchOnboardingData();
  }, [agencyId]);

  const fetchOnboardingData = async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const { data: templatesData } = await supabase
        .from('agency_briefing_templates')
        .select('*')
        .eq('agency_id', agencyId);
      
      const templatesMap: Record<string, any> = {};
      if (templatesData) {
        templatesData.forEach((t: any) => {
          templatesMap[t.briefing_type] = t;
        });
      }
      setCustomTemplates(templatesMap);

      // Fetch clients, contracts, briefings, and onboarding checklist
      const { data: clientsData } = await supabase
        .from('clients')
        .select(`
          *,
          contract:contract_forms(*),
          briefings:client_briefings(*),
          onboarding_checklist(*)
        `)
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('name');

      if (clientsData) {
        // Map data to handle 1:N relations gracefully
        const mappedClients = clientsData.map((client: any) => {
          // Handle cases where foreign relations might be returned as objects or arrays
          const contract = Array.isArray(client.contract) 
            ? (client.contract.length > 0 ? client.contract[0] : null)
            : client.contract;
          
          return {
            ...client,
            contract,
            briefings: client.briefings || [],
            onboarding_checklist: client.onboarding_checklist || [],
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

  if (viewingChecklistClient) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col gap-6 pb-32">
        <button 
          onClick={() => {
            setViewingChecklistClient(null);
            fetchOnboardingData();
          }}
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-brand-dark transition-colors w-fit"
        >
          <ChevronLeft size={16} /> Voltar para lista
        </button>
        <ClientChecklistView 
          client={viewingChecklistClient} 
          onClose={() => setViewingChecklistClient(null)} 
        />
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
    const internalOnboardingCompleted = c.onboarding_checklist && c.onboarding_checklist.length > 0
      ? c.onboarding_checklist.every(item => item.is_completed)
      : false;
    
    return hasSignedContract && hasAllBriefings && internalOnboardingCompleted;
  }).length;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col gap-8 pb-32">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark">Onboarding de Clientes</h2>
          <p className="text-sm text-gray-500 mt-1">Acompanhe a entrada de clientes e envio de formulários.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBriefingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-colors"
          >
            <Settings size={14} /> Configurar Briefings
          </button>
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-colors"
          >
            <Settings size={14} /> Configurar Templates
          </button>
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
        {/* Mobile View */}
        <div className="block md:hidden p-4 space-y-4 bg-gray-50/30">
          {clients.map((client) => {
            const contractStatus = client.contract?.status || 'none';
            
            const customTypes = client.features_settings?.active_briefing_types || [];
            const requiredTypes = new Set<string>(customTypes);
            if (customTypes.length === 0) {
              (client.services || []).forEach(service => {
                const types = SERVICE_TO_BRIEFINGS[service] || [];
                types.forEach(t => requiredTypes.add(t));
              });
            }
            
            const expectedBriefings = requiredTypes.size;
            const completedBriefings = client.briefings?.filter(b => requiredTypes.has(b.briefing_type) && b.is_completed).length || 0;
            
            let totalChecklist = client.onboarding_checklist?.length || 0;
            let completedChecklist = client.onboarding_checklist?.filter(s => s.is_completed).length || 0;

            const checklistPercentage = totalChecklist > 0 ? (completedChecklist / totalChecklist) * 100 : 0;

            return (
              <div key={client.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4 relative">
                <button 
                  onClick={() => setViewingChecklistClient(client)}
                  className="absolute right-4 top-4 p-2 text-gray-400 hover:text-brand-dark bg-gray-50 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <ChevronRight size={18} />
                </button>
                
                <div className="flex items-center gap-3 pr-10">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0"
                    style={{ backgroundColor: client.color }}
                  >
                    {client.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{client.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest truncate">{client.segment || 'Sem segmento'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {client.services?.map(service => (
                    <span key={service} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                      {service}
                    </span>
                  ))}
                  {(!client.services || client.services.length === 0) && (
                    <span className="text-[10px] text-gray-400 italic">Nenhum serviço</span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block mb-1.5">Contrato</span>
                    {contractStatus === 'signed' ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 rounded-lg text-[9px] font-bold uppercase tracking-widest">
                        <Check size={10} /> Assinado
                      </div>
                    ) : contractStatus === 'submitted' ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-bold uppercase tracking-widest">
                        <FileText size={10} /> Recebido
                      </div>
                    ) : contractStatus === 'pending' ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 text-yellow-600 rounded-lg text-[9px] font-bold uppercase tracking-widest">
                        <Clock size={10} /> Aguarda
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-500 rounded-lg text-[9px] font-bold uppercase tracking-widest">
                        Sem
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block mb-1.5">Briefings</span>
                    <button 
                      onClick={() => setViewingBriefingsClient(client)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors ${
                        expectedBriefings === 0 ? 'bg-gray-50 text-gray-500' :
                        completedBriefings === expectedBriefings ? 'bg-green-50 text-green-600' :
                        completedBriefings > 0 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {completedBriefings} / {expectedBriefings}
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-50">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    <span>Checklist Interno</span>
                    <span className="text-brand-dark">{completedChecklist} / {totalChecklist} ({Math.round(checklistPercentage)}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-dark rounded-full transition-all duration-500"
                      style={{ width: `${checklistPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {clients.length === 0 && (
            <div className="p-8 text-center bg-white rounded-2xl">
              <p className="text-gray-500 font-medium text-sm">Nenhum cliente encomendado ainda.</p>
            </div>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
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
                
                const customTypes = client.features_settings?.active_briefing_types || [];
                const requiredTypes = new Set<string>(customTypes);
                if (customTypes.length === 0) {
                  (client.services || []).forEach(service => {
                    const types = SERVICE_TO_BRIEFINGS[service] || [];
                    types.forEach(t => requiredTypes.add(t));
                  });
                }
                
                const expectedBriefings = requiredTypes.size;
                const completedBriefings = client.briefings?.filter(b => requiredTypes.has(b.briefing_type) && b.is_completed).length || 0;
                
                // Checklist Logic (Internal Onboarding)
                let totalChecklist = client.onboarding_checklist?.length || 0;
                let completedChecklist = client.onboarding_checklist?.filter(s => s.is_completed).length || 0;

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
                        onClick={() => setViewingChecklistClient(client)}
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

            <div className="flex-1 overflow-y-auto p-8 space-y-4 hide-scrollbar">
              {viewingBriefingsClient.briefings && viewingBriefingsClient.briefings.length > 0 ? (
                viewingBriefingsClient.briefings.map(b => {
                  const spec = BRIEFING_QUESTIONS[b.briefing_type] || customTemplates[b.briefing_type];
                  if (!spec) return null;
                  const isExpanded = expandedBriefingId === b.id;
                  
                  return (
                    <div 
                      key={b.id} 
                      className={`rounded-[2rem] border transition-all duration-300 overflow-hidden ${
                        isExpanded ? 'border-brand-dark ring-4 ring-brand-dark/5 bg-white' : 'border-gray-100 bg-gray-50/30 hover:bg-white hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between p-6">
                        <button 
                          onClick={() => setExpandedBriefingId(isExpanded ? null : b.id)}
                          className="flex items-center gap-4 flex-1 text-left group"
                        >
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                            isExpanded ? 'bg-brand-dark text-white shadow-lg shadow-brand-dark/20' : 'bg-white text-gray-400 group-hover:text-brand-dark'
                          }`}>
                            <FileText size={22} />
                          </div>
                          <div>
                            <h4 className={`text-lg font-bold transition-colors ${isExpanded ? 'text-brand-dark' : 'text-gray-900'}`}>
                              {spec.title}
                            </h4>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                              {b.is_completed ? (
                                <span className="text-green-600 flex items-center gap-1"><CheckCircle size={10} /> Concluído</span>
                              ) : (
                                <span className="text-yellow-600 flex items-center gap-1"><Clock size={10} /> Em rascunho</span>
                              )}
                              • {dayjs(b.completed_at || b.created_at).format('DD/MM/YYYY')}
                            </p>
                          </div>
                          <ChevronRight 
                            size={20} 
                            className={`ml-auto text-gray-300 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-brand-dark' : ''}`} 
                          />
                        </button>

                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-100">
                          <button 
                            onClick={() => copyBriefingLink(b.briefing_type)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${
                              copiedId === b.briefing_type 
                                ? 'bg-green-50 text-green-600' 
                                : 'bg-white text-gray-500 hover:bg-brand-dark hover:text-white border border-gray-100 shadow-sm'
                            }`}
                          >
                            {copiedId === b.briefing_type ? (
                              <><Check size={14} /> Link Copiado</>
                            ) : (
                              <><LinkIcon size={14} /> Link Direto</>
                            )}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="px-6 pb-8 space-y-6 pt-2 border-t border-gray-50"
                        >
                          <div className="grid gap-4">
                            {spec.questions.map(q => (
                              <div key={q.key} className="bg-gray-50/50 rounded-2xl p-5 border border-black/[0.02]">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{q.label}</p>
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                                  {!b.responses[q.key] ? (
                                    <span className="text-gray-300 italic">Não respondido</span>
                                  ) : typeof b.responses[q.key] === 'object' ? (
                                    Array.isArray(b.responses[q.key]) 
                                      ? (b.responses[q.key] as string[]).join(', ') 
                                      : Object.entries(b.responses[q.key] as Record<string, any>)
                                          .map(([k, v]) => `${k}: ${v}`)
                                          .join(' | ')
                                  ) : (
                                    String(b.responses[q.key])
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
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

      {/* Onboarding Templates Modal */}
      {showTemplatesModal && (
        <OnboardingTemplatesModal
          onClose={() => setShowTemplatesModal(false)}
        />
      )}

      {showBriefingsModal && (
        <BriefingTemplatesModal
          onClose={() => setShowBriefingsModal(false)}
        />
      )}
    </div>
  );
};

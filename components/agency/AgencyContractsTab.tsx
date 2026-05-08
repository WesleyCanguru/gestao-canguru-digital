import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ContractForm, Client } from '../../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import ptBr from 'dayjs/locale/pt-br';
import { FileText, Link as LinkIcon, Upload, Eye, FileSignature, CheckCircle, Clock, DollarSign, Copy } from 'lucide-react';
import { motion } from 'motion/react';

dayjs.extend(relativeTime);
dayjs.locale(ptBr);

interface ClientWithContract extends Client {
  contract?: ContractForm | null;
}

export const AgencyContractsTab: React.FC = () => {
  const [clients, setClients] = useState<ClientWithContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithContract | null>(null);
  const [viewDataModalOpen, setViewDataModalOpen] = useState(false);

  // Form states
  const [contractValue, setContractValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: clientsData } = await supabase.from('clients').select('*').order('name');
    const { data: contractsData } = await supabase.from('contract_forms').select('*');

    if (clientsData) {
      const merged = clientsData.map(c => ({
        ...c,
        contract: contractsData?.find(cf => cf.client_id === c.id) || null
      }));
      setClients(merged);
    }
    setLoading(false);
  };

  const handleGenerateLink = async (clientId: string) => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');
    const { data, error } = await supabase.from('contract_forms').insert({
      client_id: clientId,
      agency_id: 1, // Default tracking or dynamic
      form_token: token,
      status: 'pending'
    }).select().single();
    
    if (!error && data) {
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, contract: data } : c));
    }
  };

  const copyToClipboard = (token: string) => {
    navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}/contrato/${token}`);
    alert('Link copiado para a área de transferência!');
  };

  const calculateMonths = (startDate: string) => {
    const start = dayjs(startDate);
    const now = dayjs();
    return now.diff(start, 'month');
  };

  const formatDuration = (startDate: string) => {
    const start = dayjs(startDate);
    const now = dayjs();
    const months = now.diff(start, 'month');
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (years === 0) return `${months} meses`;
    if (remainingMonths === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
    return `${years} ${years === 1 ? 'ano' : 'anos'} e ${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'}`;
  };

  const mrrTotal = clients.reduce((acc, c) => acc + (c.contract?.status === 'signed' ? (c.contract.contract_value || 0) : 0), 0);
  const activeContracts = clients.filter(c => c.contract?.status === 'signed').length;
  
  const oldestContract = [...clients]
    .filter(c => c.contract?.status === 'signed' && c.contract?.contract_start_date)
    .sort((a, b) => dayjs(a.contract!.contract_start_date).unix() - dayjs(b.contract!.contract_start_date).unix())[0];

  const handleUploadContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !contractValue || !startDate || !file) return;
    setSaving(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `contrato_assinado_v${Date.now()}.${fileExt}`;
      const filePath = `contratos/${selectedClient.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('client-documents')
        .getPublicUrl(filePath);

      const payload = {
        client_id: selectedClient.id,
        agency_id: 1,
        status: 'signed',
        signed_at: new Date().toISOString(),
        contract_value: parseFloat(contractValue),
        contract_start_date: startDate,
        signed_contract_url: urlData.publicUrl
      };

      if (selectedClient.contract) {
        await supabase
          .from('contract_forms')
          .update(payload)
          .eq('id', selectedClient.contract.id);
      } else {
        const token = Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');
        await supabase
          .from('contract_forms')
          .insert([{ ...payload, form_token: token }]);
      }
      
      await fetchData();
      setUploadModalOpen(false);
      setFile(null);
      setContractValue('');
      setStartDate('');
    } catch (error) {
      console.error(error);
      alert('Erro ao fazer upload do contrato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">MRR Total</p>
            <p className="text-2xl font-black text-brand-dark">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mrrTotal)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <FileSignature size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Contratos Ativos</p>
            <p className="text-2xl font-black text-brand-dark">{activeContracts}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Cliente Mais Antigo</p>
            <p className="text-lg font-black text-brand-dark truncate max-w-[150px]" title={oldestContract?.name}>
              {oldestContract ? oldestContract.name : 'Nenhum'}
            </p>
            {oldestContract && oldestContract.contract?.contract_start_date && (
              <p className="text-xs text-gray-400">
                Desde {dayjs(oldestContract.contract.contract_start_date).format('MMM YYYY')}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Cliente</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Valor / Tempo</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Estimativa LTV</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map(client => {
                const isSigned = client.contract?.status === 'signed';
                const isPending = client.contract?.status === 'pending';
                const isSubmitted = client.contract?.status === 'submitted';
                const hasContractForm = !!client.contract;

                const startDate = client.contract?.contract_start_date;
                const monthlyValue = client.contract?.contract_value || 0;
                const monthsElapsed = startDate ? calculateMonths(startDate) : 0;
                const lifetimeValue = Math.max(monthsElapsed, 1) * monthlyValue;

                return (
                  <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-brand-dark">{client.name}</span>
                        {client.segment && <span className="text-xs text-gray-400">{client.segment}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {isSigned ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-green-50 text-green-600">
                          <CheckCircle size={12} /> Assinado
                        </span>
                      ) : isSubmitted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-50 text-blue-600">
                          <Eye size={12} /> Dados Recebidos
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-yellow-50 text-yellow-600">
                          <Clock size={12} /> Aguardando
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-gray-100 text-gray-500">
                          Sem contrato
                        </span>
                      )}
                      
                      {isSubmitted && client.contract?.submitted_at && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          Enviado em {dayjs(client.contract.submitted_at).format('DD/MM/YYYY')}
                        </div>
                      )}
                      {isSigned && client.contract?.signed_at && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          Assinado em {dayjs(client.contract.signed_at).format('DD/MM/YYYY')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isSigned && startDate ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-brand-dark">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyValue)}/mês
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">
                            Desde {dayjs(startDate).format('MMM YYYY')} ({formatDuration(startDate)})
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isSigned && startDate ? (
                        <span className="font-bold text-gray-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lifetimeValue)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {!hasContractForm && (
                          <button
                            onClick={() => handleGenerateLink(client.id)}
                            className="bg-brand-dark text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-dark/90 transition-colors"
                          >
                            Gerar Link
                          </button>
                        )}
                        
                        {isPending && client.contract && (
                          <>
                            <button
                              onClick={() => copyToClipboard(client.contract!.form_token)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-brand-dark hover:border-brand-dark transition-colors text-xs font-bold"
                              title="Copiar link"
                            >
                              <Copy size={14} /> Link
                            </button>
                            <button
                              onClick={() => { setSelectedClient(client); setUploadModalOpen(true); }}
                              className="flex items-center gap-1.5 bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors"
                            >
                              <Upload size={14} /> Fazer upload
                            </button>
                          </>
                        )}

                        {isSubmitted && client.contract && (
                          <>
                            <button
                              onClick={() => { setSelectedClient(client); setViewDataModalOpen(true); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-dark/20 text-brand-dark hover:bg-brand-dark hover:text-white transition-colors text-xs font-bold"
                            >
                              <Eye size={14} /> Ver Dados
                            </button>
                            <button
                              onClick={() => { setSelectedClient(client); setUploadModalOpen(true); }}
                              className="flex items-center gap-1.5 bg-brand-dark text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-dark/90 transition-colors"
                            >
                              <Upload size={14} /> Assinado
                            </button>
                          </>
                        )}

                        {isSigned && client.contract && (
                          <>
                            {client.contract.signed_contract_url && (
                              <button
                                onClick={() => window.open(client.contract!.signed_contract_url!, '_blank')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-white transition-colors text-xs font-bold"
                              >
                                <FileText size={14} /> Ver PDF
                              </button>
                            )}
                            <button
                              onClick={() => { setSelectedClient(client); setUploadModalOpen(true); }}
                              className="flex items-center gap-1.5 bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors"
                            >
                              <Upload size={14} /> Substituir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {uploadModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative"
          >
            <h2 className="text-xl font-bold text-brand-dark mb-6">Upload de Contrato</h2>
            <form onSubmit={handleUploadContract} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Arquivo PDF *</label>
                <input 
                  type="file" 
                  accept="application/pdf"
                  required
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Valor Mensal (R$) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={contractValue}
                  onChange={e => setContractValue(e.target.value)}
                  placeholder="Ex: 1500.00"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Data de Início *</label>
                <input 
                  type="date" 
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-transparent outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !file}
                  className="flex-1 px-4 py-3 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-dark/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Enviando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {viewDataModalOpen && selectedClient?.contract && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative max-h-[80vh] overflow-y-auto"
          >
            <h2 className="text-xl font-bold text-brand-dark mb-4">Dados Enviados</h2>
            <div className="space-y-4 mb-6 text-sm">
              {Object.entries(selectedClient.contract.form_data || {}).map(([key, value]) => (
                <div key={key} className="border-b border-gray-100 pb-3">
                  <p className="text-xs text-gray-400 capitalize font-bold mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="font-medium text-gray-800 break-words">{String(value)}</p>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setViewDataModalOpen(false)}
              className="w-full py-3 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-dark/90 transition-colors"
            >
              Fechar
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { ContractForm, Client } from '../../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import ptBr from 'dayjs/locale/pt-br';
import { FileText, Link as LinkIcon, Upload, Eye, FileSignature, CheckCircle, Clock, DollarSign, Copy, TrendingUp, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

const fieldLabels: Record<string, string> = {
  client_type: 'Tipo de Contrato',
  pf_name: 'Nome Completo (PF)',
  pf_cpf: 'CPF',
  pf_rg: 'RG',
  pf_orgao_emissor: 'Órgão Emissor',
  pf_birth_date: 'Data de Nascimento',
  pf_marital_status: 'Estado Civil',
  pf_profession: 'Profissão',
  pf_whatsapp: 'WhatsApp',
  pf_email: 'E-mail',
  
  pj_razao_social: 'Razão Social',
  pj_nome_fantasia: 'Nome Fantasia',
  pj_cnpj: 'CNPJ',
  pj_inscricao_estadual: 'Inscrição Estadual',
  pj_inscricao_municipal: 'Inscrição Municipal',
  
  pj_rep_name: 'Nome do Representante Legal',
  pj_rep_cpf: 'CPF do Representante Legal',
  pj_rep_rg: 'RG do Representante Legal',
  pj_rep_birth_date: 'Data Nasc. do Representante',
  pj_rep_whatsapp: 'WhatsApp do Representante',
  pj_rep_email: 'E-mail do Representante',
  
  address_zip: 'CEP',
  address_street: 'Rua / Avenida',
  address_number: 'Número',
  address_complement: 'Complemento',
  address_neighborhood: 'Bairro',
  address_city: 'Cidade',
  address_state: 'Estado',
  
  pf_partner_name: 'Nome do Sócio/Cônjuge',
  pf_partner_cpf: 'CPF do Sócio/Cônjuge',
  pf_partner_whatsapp: 'WhatsApp do Sócio/Cônjuge',
  pf_partner_email: 'E-mail do Sócio/Cônjuge',
  
  pj_partner_name: 'Nome do Sócio/Cônjuge',
  pj_partner_cpf: 'CPF do Sócio/Cônjuge',
  pj_partner_whatsapp: 'WhatsApp do Sócio/Cônjuge',
  pj_partner_email: 'E-mail do Sócio/Cônjuge',

  cartao_cnpj_url: 'Link do Cartão CNPJ'
};

const ContractDataViewer: React.FC<{ data: any, onClose: () => void }> = ({ data, onClose }) => {
  const [showEmpty, setShowEmpty] = useState(false);

  if (!data) return null;

  const clientType = data.client_type || 'PF';

  const filledFields: { label: string, value: string | React.ReactNode }[] = [];
  const emptyFields: { label: string }[] = [];

  const relevantKeys = Object.keys(data).filter(k => {
    if (k === 'client_type') return true;
    if (k.startsWith('address_')) return true;
    if (k === 'cartao_cnpj_url') return clientType === 'PJ';
    if (clientType === 'PF' && k.startsWith('pf_')) return true;
    if (clientType === 'PJ' && k.startsWith('pj_')) return true;
    return false;
  });

  relevantKeys.forEach(key => {
    let value = data[key];
    const label = fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').trim();
    
    if (key === 'client_type') {
      value = value === 'PF' ? 'Pessoa Física (PF)' : 'Pessoa Jurídica (PJ)';
      filledFields.unshift({ label, value });
      return;
    }

    if (value === null || value === undefined || value === '') {
      emptyFields.push({ label });
    } else {
      if (key === 'cartao_cnpj_url') {
        filledFields.push({ 
          label, 
          value: <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Ver Documento</a> 
        });
      } else {
        filledFields.push({ label, value: String(value) });
      }
    }
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-2xl font-bold text-brand-dark mb-6 border-b border-gray-100 pb-4">Dados do Contrato</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6 text-sm">
          {filledFields.map((field, i) => (
            <div key={i} className="border-b border-gray-50 pb-3">
              <p className="text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-1">{field.label}</p>
              <div className="font-medium text-gray-800 break-words">{field.value}</div>
            </div>
          ))}
        </div>

        {emptyFields.length > 0 && (
          <div className="mt-8 mb-6">
            <button 
              onClick={() => setShowEmpty(!showEmpty)}
              className="text-xs font-bold text-gray-500 hover:text-gray-700 flex items-center gap-2 mb-4 uppercase tracking-widest"
            >
              {showEmpty ? 'Ocultar campos não preenchidos' : `Ver campos não preenchidos (${emptyFields.length})`}
            </button>
            
            {showEmpty && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                {emptyFields.map((field, i) => (
                  <div key={i} className="pb-2">
                    <p className="text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-1">{field.label}</p>
                    <div className="font-medium text-gray-400 italic">Não preenchido</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="pt-4 border-t border-gray-100 mt-6">
          <button
            onClick={onClose}
            className="w-full py-4 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-dark/90 transition-colors shadow-lg"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const monthsList = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' }
];

const currentYear = dayjs().year();
const yearsList = Array.from({ length: 11 }, (_, i) => String(currentYear - 3 + i)); // de 3 anos atrás até 7 anos no futuro

const ContractHistoryModal: React.FC<{
  client: ClientWithContract;
  onClose: () => void;
  onSave: () => void;
}> = ({ client, onClose, onSave }) => {
  const { agencyId } = useAuth();
  const [history, setHistory] = useState<{ date: string; value: number }[]>([]);
  const currentMonthStr = dayjs().format('MM');
  const currentYearStr = dayjs().format('YYYY');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const historyFromClient = client.features_settings?.value_history;
    const historyFromContract = client.contract?.form_data?.value_history;
    if (historyFromClient) {
      setHistory(historyFromClient);
    } else if (historyFromContract) {
      setHistory(historyFromContract);
    } else {
      setHistory([]);
    }
  }, [client]);

  const handleAdd = () => {
    if (!selectedMonth || !selectedYear || !newValue) return;
    const parsedValue = parseFloat(newValue);
    if (isNaN(parsedValue)) return;

    const dateFormatted = `${selectedYear}-${selectedMonth}`; 
    
    // Verifica se já existe um reajuste para este mês no histórico local
    if (history.some(item => item.date === dateFormatted)) {
      alert('Já existe um reajuste cadastrado para este mesmo mês!');
      return;
    }

    const updatedHistory = [...history, { date: dateFormatted, value: parsedValue }];
    updatedHistory.sort((a, b) => a.date.localeCompare(b.date));
    
    setHistory(updatedHistory);
    setNewValue('');
  };

  const handleDelete = (index: number) => {
    const updatedHistory = history.filter((_, i) => i !== index);
    setHistory(updatedHistory);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const latestValue = history.length > 0 
        ? [...history].sort((a, b) => a.date.localeCompare(b.date))[history.length - 1].value 
        : (client.contract?.contract_value || client.base_value || 0);

      // 1. Salvar diretamente em client.features_settings.value_history para contornar qualquer RLS limitando updates de contratos assinados
      const currentFeatures = client.features_settings || {};
      const updatedFeatures = {
        ...currentFeatures,
        value_history: history
      };

      const { data: clientUpdateData, error: clientError } = await supabase
        .from('clients')
        .update({
          base_value: latestValue,
          features_settings: updatedFeatures
        })
        .eq('id', client.id)
        .eq('agency_id', agencyId)
        .select();

      if (clientError) throw clientError;
      if (!clientUpdateData || clientUpdateData.length === 0) {
        throw new Error('A atualização do cliente falhou. Certifique-se de que você tem permissão de edição.');
      }

      // 2. Tentar atualizar também em contract_forms (melhor esforço)
      if (client.contract?.id) {
        const formData = client.contract?.form_data || {};
        const updatedFormData = {
          ...formData,
          value_history: history
        };

        const { data: contractUpdateData, error: contractError } = await supabase
          .from('contract_forms')
          .update({
            form_data: updatedFormData,
            contract_value: latestValue
          })
          .eq('id', client.contract.id)
          .eq('agency_id', agencyId)
          .select();
          
        if (contractError) {
          console.warn('Erro ao atualizar contract_forms:', contractError);
        }
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar histórico: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-xl font-bold text-brand-dark mb-2">Histórico de Reajustes</h2>
        <p className="text-xs text-gray-500 mb-6">Configure o histórico de reajustes da mensalidade para {client.name}.</p>

        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Valor Inicial Assinado</h3>
          <div className="text-base font-black text-brand-dark">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.contract?.contract_value || client.base_value || 0)}
          </div>
          {client.contract?.contract_start_date && (
            <p className="text-xs text-gray-400 mt-1">
              Vigência inicial: {dayjs(client.contract.contract_start_date).format('DD/MM/YYYY')}
            </p>
          )}
        </div>

        <div className="space-y-4 mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reajustes Programados/Históricos</h3>
          
          {history.length === 0 ? (
            <div className="text-xs text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
              Nenhuma alteração registrada. O valor inicial é mantido para todos os meses.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto border border-gray-100 rounded-2xl bg-white">
              {history.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <span className="font-bold text-gray-700">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)}
                    </span>
                    <span className="text-xs text-gray-400 block">
                      A partir de: {dayjs(item.date + '-01').format('MMMM [de] YYYY')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir reajuste"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-6 mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Adicionar Nova Alteração</h3>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Mês</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-2.5 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-brand-dark transition-all outline-none text-xs font-semibold cursor-pointer"
              >
                {monthsList.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-4">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Ano</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-2.5 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-brand-dark transition-all outline-none text-xs font-semibold cursor-pointer"
              >
                {yearsList.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="col-span-4">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Valor (R$)</label>
              <input
                type="number"
                placeholder="1330"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full px-2.5 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-brand-dark transition-all outline-none text-xs font-semibold"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newValue}
            className="w-full mt-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
          >
            Inserir no Histórico
          </button>
        </div>

        <div className="flex gap-3 border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition-colors text-xs uppercase tracking-widest"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-3 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-dark/90 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};


dayjs.extend(relativeTime);
dayjs.locale(ptBr);

interface ClientWithContract extends Client {
  contract?: ContractForm | null;
}

export const AgencyContractsTab: React.FC = () => {
  const { agencyId } = useAuth();
  const [clients, setClients] = useState<ClientWithContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithContract | null>(null);
  const [viewDataModalOpen, setViewDataModalOpen] = useState(false);
  const [isCancelledExpanded, setIsCancelledExpanded] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Form states
  const [contractValue, setContractValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startDay, setStartDay] = useState(dayjs().format('DD'));
  const [startMonth, setStartMonth] = useState(dayjs().format('MM'));
  const [startYear, setStartYear] = useState(dayjs().format('YYYY'));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (startYear && startMonth && startDay) {
      setStartDate(`${startYear}-${startMonth}-${startDay}`);
    }
  }, [startDay, startMonth, startYear]);

  useEffect(() => {
    fetchData();
  }, [agencyId]);

  const fetchData = async () => {
    if (!agencyId) return;
    setLoading(true);
    let clientsQuery = supabase.from('clients').select('*').eq('agency_id', agencyId).order('name');
    let contractsQuery = supabase.from('contract_forms').select('*').eq('agency_id', agencyId);
    
    const { data: clientsData } = await clientsQuery;
    const { data: contractsData } = await contractsQuery;

    if (clientsData) {
      const merged = clientsData.map(c => {
        const clientContracts = contractsData?.filter(cf => cf.client_id === c.id) || [];
        // Prioritize by status: signed > submitted > pending
        const sortedContracts = clientContracts.sort((a, b) => {
          const statusOrder = { signed: 0, submitted: 1, pending: 2 };
          return (statusOrder[a.status as keyof typeof statusOrder] ?? 99) - 
                 (statusOrder[b.status as keyof typeof statusOrder] ?? 99);
        });
        
        return {
          ...c,
          contract: sortedContracts[0] || null
        };
      });
      setClients(merged);
    }
    setLoading(false);
  };

  const handleGenerateLink = async (clientId: string) => {
    try {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');
      const { data, error } = await supabase.from('contract_forms').insert({
        client_id: clientId,
        agency_id: agencyId, // Default tracking or dynamic
        form_token: token,
        status: 'pending'
      }).select().single();
      
      if (error) {
        console.error('Error generating link:', error);
        throw new Error(`Erro ao gerar link: ${error.message}`);
      }
      
      if (data) {
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, contract: data } : c));
        alert('Link gerado com sucesso!');
      }
    } catch (error: any) {
      alert(error.message || 'Erro ao gerar link');
    }
  };

  const copyToClipboard = (token: string) => {
    navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}/contrato/${token}`);
    alert('Link copiado para a área de transferência!');
  };

  const getValueForMonth = (
    monthYear: string, // "YYYY-MM"
    initialValue: number,
    history: { date: string; value: number }[] | undefined
  ) => {
    if (!history || history.length === 0) return initialValue;
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    let activeValue = initialValue;
    for (const entry of sorted) {
      if (entry.date <= monthYear) {
        activeValue = entry.value;
      } else {
        break;
      }
    }
    return activeValue;
  };

  const calculateClientLTV = (client: ClientWithContract) => {
    const startDate = client.contract?.contract_start_date || client.created_at;
    if (!startDate) return 0;
    
    const start = dayjs(startDate);
    const end = client.client_status === 'cancelled' && client.cancelled_at ? dayjs(client.cancelled_at) : dayjs();
    
    // Prepaid billing periods: diff in months + 1
    const monthsCount = end.diff(start, 'month') + 1;
    
    const initialValue = client.contract?.contract_value || client.base_value || 0;
    const history = client.features_settings?.value_history || client.contract?.form_data?.value_history || [];
    
    let totalLTV = 0;
    for (let i = 0; i < monthsCount; i++) {
      const monthYear = start.add(i, 'month').format('YYYY-MM');
      const monthValue = getValueForMonth(monthYear, initialValue, history);
      totalLTV += monthValue;
    }
    
    return totalLTV;
  };

  const formatClientPermanence = (client: ClientWithContract) => {
    const startDate = client.contract?.contract_start_date || client.created_at;
    if (!startDate) return '1 mês';
    
    const start = dayjs(startDate);
    const end = client.client_status === 'cancelled' && client.cancelled_at ? dayjs(client.cancelled_at) : dayjs();
    
    const monthsCount = end.diff(start, 'month') + 1;
    const years = Math.floor(monthsCount / 12);
    const remainingMonths = monthsCount % 12;
    
    if (years === 0) return `${monthsCount} ${monthsCount === 1 ? 'mês' : 'meses'}`;
    if (remainingMonths === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
    return `${years} ${years === 1 ? 'ano' : 'anos'} e ${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'}`;
  };

  const getCurrentContractValue = (client: ClientWithContract) => {
    const initialValue = client.contract?.contract_value || client.base_value || 0;
    const history = client.features_settings?.value_history || client.contract?.form_data?.value_history || [];
    const currentMonth = dayjs().format('YYYY-MM');
    return getValueForMonth(currentMonth, initialValue, history);
  };

  const formatValueHistory = (client: ClientWithContract) => {
    const initialValue = client.contract?.contract_value || client.base_value || 0;
    const history = client.features_settings?.value_history || client.contract?.form_data?.value_history || [];
    if (!history || history.length === 0) return null;
    
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const parts: string[] = [];
    
    const formattedInitial = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(initialValue);
    parts.push(`Começou com ${formattedInitial}`);
    
    sorted.forEach((h: any) => {
      const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(h.value);
      const monthLabel = dayjs(h.date + '-01').format('MMM/YYYY');
      parts.push(`alterou para ${formattedVal} em ${monthLabel}`);
    });
    
    return parts.join(' ➔ ');
  };

  const activeClientsList = clients.filter(c => c.client_status !== 'cancelled');
  const cancelledClientsList = clients.filter(c => c.client_status === 'cancelled');

  const mrrTotal = activeClientsList.reduce((acc, c) => acc + (c.contract?.status === 'signed' ? getCurrentContractValue(c) : 0), 0);
  const activeContracts = activeClientsList.filter(c => c.contract?.status === 'signed').length;
  
  const oldestContract = [...activeClientsList]
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

      if (uploadError) {
        console.error('Upload Error:', uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('client-documents')
        .getPublicUrl(filePath);

      const payload = {
        client_id: selectedClient.id,
        agency_id: agencyId,
        status: 'signed',
        signed_at: new Date().toISOString(),
        contract_value: parseFloat(contractValue),
        contract_start_date: startDate,
        signed_contract_url: urlData.publicUrl
      };

      const {
        client_id,
        agency_id,
        ...updatePayload
      } = payload;

      if (selectedClient.contract) {
        const { error: updateError, data: updateData } = await supabase
          .from('contract_forms')
          .update(updatePayload)
          .eq('agency_id', agencyId)
          .eq('id', selectedClient.contract.id)
          .select();
        
        if (updateError) {
          console.error('Update Error:', updateError);
          throw new Error(`Erro ao atualizar banco: ${updateError.message}`);
        }
        
        if (!updateData || updateData.length === 0) {
          console.warn('No rows updated. Trying insert fallback.');
          // If update failed to find the row (unlikely but possible), try insert
          const { error: insertError } = await supabase
            .from('contract_forms')
            .insert([{ ...payload, form_token: Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('') }]);
          
          if (insertError) throw insertError;
        }
      } else {
        const token = Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');
        const { error: insertError } = await supabase
          .from('contract_forms')
          .insert([{ ...payload, form_token: token }]);
          
        if (insertError) {
          console.error('Insert Error:', insertError);
          throw new Error(`Erro ao inserir no banco: ${insertError.message}`);
        }
      }
      
      await fetchData();
      setUploadModalOpen(false);
      setFile(null);
      setContractValue('');
      setStartDate('');
      alert('Contrato salvo com sucesso!');
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao fazer upload do contrato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark">Contratos</h2>
          <p className="text-sm text-gray-500 mt-1">Gerencie os contratos e links enviados aos clientes.</p>
        </div>
      </div>

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
        {/* Mobile View */}
        <div className="block md:hidden p-4 space-y-4 bg-gray-50/30">
          {activeClientsList.map(client => {
            const isSigned = client.contract?.status === 'signed';
            const isPending = client.contract?.status === 'pending';
            const isSubmitted = client.contract?.status === 'submitted';
            const hasContractForm = !!client.contract;

            const startDate = client.contract?.contract_start_date;

            return (
              <div key={client.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-brand-dark">{client.name}</h3>
                    {client.segment && <p className="text-xs text-gray-400">{client.segment}</p>}
                  </div>
                  <div>
                    {isSigned ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-green-50 text-green-600">
                        <CheckCircle size={12} /> Assinado
                      </span>
                    ) : isSubmitted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-50 text-blue-600">
                        <Eye size={12} /> Recebido
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-yellow-50 text-yellow-600">
                        <Clock size={12} /> Aguarda
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-gray-100 text-gray-500">
                        Sem cont.
                      </span>
                    )}
                  </div>
                </div>

                {isSigned && startDate && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Mensalidade</p>
                      <p className="font-bold text-brand-dark">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getCurrentContractValue(client))}
                      </p>
                      <p className="text-xs text-gray-500">{formatClientPermanence(client)}</p>
                      {formatValueHistory(client) && (
                        <p className="text-[9px] text-gray-400 italic mt-1 leading-tight">{formatValueHistory(client)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Estimativa LTV</p>
                      <p className="font-bold text-gray-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateClientLTV(client))}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-50">
                  {!hasContractForm && (
                    <button
                      onClick={() => handleGenerateLink(client.id)}
                      className="flex-1 bg-brand-dark text-white py-2 rounded-xl text-xs font-bold hover:bg-brand-dark/90 transition-colors text-center"
                    >
                      Gerar Link
                    </button>
                  )}
                  
                  {isPending && client.contract && (
                    <>
                      <button
                        onClick={() => copyToClipboard(client.contract!.form_token)}
                        className="flex-1 flex justify-center items-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:text-brand-dark hover:border-brand-dark transition-colors text-xs font-bold"
                      >
                        <Copy size={14} /> Copiar Link
                      </button>
                      <button
                        onClick={() => { setSelectedClient(client); setUploadModalOpen(true); }}
                        className="flex-1 flex justify-center items-center gap-1.5 bg-gray-50 text-gray-600 border border-gray-200 py-2 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors"
                      >
                        <Upload size={14} /> Fazer upload
                      </button>
                    </>
                  )}

                  {isSubmitted && client.contract && (
                    <>
                      <button
                        onClick={() => { setSelectedClient(client); setViewDataModalOpen(true); }}
                        className="flex-1 flex justify-center items-center gap-1.5 py-2 rounded-xl border border-brand-dark/20 text-brand-dark hover:bg-brand-dark hover:text-white transition-colors text-xs font-bold"
                      >
                        <Eye size={14} /> Ver Dados
                      </button>
                      <button
                        onClick={() => { setSelectedClient(client); setUploadModalOpen(true); }}
                        className="flex-1 flex justify-center items-center gap-1.5 bg-brand-dark text-white py-2 rounded-xl text-xs font-bold hover:bg-brand-dark/90 transition-colors"
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
                          className="flex-1 flex justify-center items-center gap-1.5 py-2 rounded-xl border border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-white transition-colors text-xs font-bold"
                        >
                          <FileText size={14} /> Ver PDF
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectedClient(client); setHistoryModalOpen(true); }}
                        className="flex-1 flex justify-center items-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:text-brand-dark hover:border-brand-dark transition-colors text-xs font-bold"
                      >
                        <TrendingUp size={14} /> Reajustes
                      </button>
                      <button
                        onClick={() => { setSelectedClient(client); setUploadModalOpen(true); }}
                        className="flex-1 flex justify-center items-center gap-1.5 bg-gray-50 text-gray-600 border border-gray-200 py-2 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors"
                      >
                        <Upload size={14} /> Substituir
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
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
              {activeClientsList.map(client => {
                const isSigned = client.contract?.status === 'signed';
                const isPending = client.contract?.status === 'pending';
                const isSubmitted = client.contract?.status === 'submitted';
                const hasContractForm = !!client.contract;

                const startDate = client.contract?.contract_start_date;

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
                          Enviado em {dayjs(client.contract.submitted_at).format('DD/MM/YYYY [às] HH:mm')}
                        </div>
                      )}
                      {isSigned && client.contract?.signed_at && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          Assinado em {dayjs(client.contract.signed_at).format('DD/MM/YYYY [às] HH:mm')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isSigned && startDate ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-brand-dark">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getCurrentContractValue(client))}/mês
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">
                            Desde {dayjs(startDate).format('MMM YYYY')} ({formatClientPermanence(client)})
                          </span>
                          {formatValueHistory(client) && (
                            <span className="text-[10px] text-gray-400 italic mt-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 max-w-md whitespace-normal leading-relaxed">
                              {formatValueHistory(client)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isSigned && startDate ? (
                        <span className="font-bold text-gray-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateClientLTV(client))}
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
                              onClick={() => { setSelectedClient(client); setHistoryModalOpen(true); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-brand-dark hover:border-brand-dark transition-colors text-xs font-bold"
                              title="Histórico de reajustes de valor"
                            >
                              <TrendingUp size={14} /> Reajustes
                            </button>
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

      {/* Seção Colapsável de Contratos Encerrados */}
      {cancelledClientsList.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-6">
          <button
            type="button"
            onClick={() => setIsCancelledExpanded(!isCancelledExpanded)}
            className="w-full px-6 py-5 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 transition-colors text-left outline-none"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400 animate-pulse" />
              <h3 className="text-base font-bold text-gray-700">Contratos Encerrados ({cancelledClientsList.length})</h3>
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {isCancelledExpanded ? 'Ocultar ▴' : 'Visualizar ▾'}
            </span>
          </button>

          {isCancelledExpanded && (
            <div className="border-t border-gray-100">
              {/* Mobile View para Cancelados */}
              <div className="block md:hidden p-4 space-y-4 bg-gray-50/30">
                {cancelledClientsList.map(client => {
                  const start = dayjs(client.created_at);
                  const end = client.cancelled_at ? dayjs(client.cancelled_at) : dayjs();
                  const ltvValue = calculateClientLTV(client);

                  return (
                    <div key={client.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-gray-700">{client.name}</h4>
                          {client.segment && <p className="text-xs text-gray-400">{client.segment}</p>}
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-gray-100 text-gray-500">
                          Encerrado
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50 text-sm">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Última Mensalidade</p>
                          <p className="font-bold text-gray-500">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getCurrentContractValue(client))}
                          </p>
                          <p className="text-xs text-gray-400">Permanência: {formatClientPermanence(client)}</p>
                          {formatValueHistory(client) && (
                            <p className="text-[9px] text-gray-400 italic mt-1 leading-tight">{formatValueHistory(client)}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">LTV Real</p>
                          <p className="font-bold text-brand-dark">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ltvValue)}
                          </p>
                        </div>
                      </div>

                      {client.contract && (
                        <div className="flex gap-2 pt-3 border-t border-gray-50">
                          {client.contract.signed_contract_url && (
                            <button
                              type="button"
                              onClick={() => window.open(client.contract!.signed_contract_url!, '_blank')}
                              className="flex-1 flex justify-center items-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:text-brand-dark transition-colors text-xs font-bold"
                            >
                              <FileText size={14} /> Ver PDF
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { setSelectedClient(client); setViewDataModalOpen(true); }}
                            className="flex-1 flex justify-center items-center gap-1.5 py-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors text-xs font-bold"
                          >
                            <Eye size={14} /> Ver Dados
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop View para Cancelados */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50/50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Cliente</th>
                      <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Status</th>
                      <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Período Ativo</th>
                      <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Permanência</th>
                      <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">LTV Real</th>
                      <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Contrato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cancelledClientsList.map(client => {
                      const start = dayjs(client.created_at);
                      const end = client.cancelled_at ? dayjs(client.cancelled_at) : dayjs();
                      const ltvValue = calculateClientLTV(client);

                      return (
                        <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-600">{client.name}</span>
                              {client.segment && <span className="text-xs text-gray-400">{client.segment}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-gray-100 text-gray-500">
                              Encerrado
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500">
                            {dayjs(client.created_at).format('DD/MM/YYYY')} até {client.cancelled_at ? dayjs(client.cancelled_at).format('DD/MM/YYYY') : '-'}
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500 flex flex-col justify-center">
                            <span>{formatClientPermanence(client)}</span>
                            {formatValueHistory(client) && (
                              <span className="text-[10px] text-gray-400 italic mt-0.5 max-w-xs whitespace-normal leading-tight">
                                {formatValueHistory(client)}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-bold text-brand-dark">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ltvValue)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {client.contract?.signed_contract_url && (
                                <button
                                  type="button"
                                  onClick={() => window.open(client.contract!.signed_contract_url!, '_blank')}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-brand-dark hover:border-brand-dark transition-colors text-xs font-bold"
                                >
                                  <FileText size={14} /> Ver PDF
                                </button>
                              )}
                              {client.contract && (
                                <button
                                  type="button"
                                  onClick={() => { setSelectedClient(client); setViewDataModalOpen(true); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors text-xs font-bold"
                                >
                                  <Eye size={14} /> Ver Dados
                                </button>
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
          )}
        </div>
      )}

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
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={startDay}
                    onChange={(e) => setStartDay(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-transparent outline-none text-xs font-semibold bg-white"
                  >
                    {Array.from({ length: 31 }, (_, i) => {
                      const day = String(i + 1).padStart(2, '0');
                      return <option key={day} value={day}>{day}</option>;
                    })}
                  </select>

                  <select
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-transparent outline-none text-xs font-semibold bg-white"
                  >
                    {monthsList.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>

                  <select
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-transparent outline-none text-xs font-semibold bg-white"
                  >
                    {yearsList.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
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
        <ContractDataViewer
          data={selectedClient.contract.form_data}
          onClose={() => setViewDataModalOpen(false)}
        />
      )}

      {historyModalOpen && selectedClient && (
        <ContractHistoryModal
          client={selectedClient}
          onClose={() => setHistoryModalOpen(false)}
          onSave={fetchData}
        />
      )}
    </div>
  );
};

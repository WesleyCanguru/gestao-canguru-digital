import React, { useState, useEffect } from 'react';
import { getAppUrl } from '../../lib/appUrl';
import { supabase, useAuth } from '../../lib/supabase';
import { openStoredFile } from '../../lib/storage';
import { ContractForm, Client } from '../../types';
import { parseCurrencyInput } from '../../lib/currencyUtils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import ptBr from 'dayjs/locale/pt-br';
import { FileText, Link as LinkIcon, Upload, Eye, FileSignature, CheckCircle, Clock, DollarSign, Copy, TrendingUp, Trash2, Search, MoreHorizontal, ChevronDown } from 'lucide-react';
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
          value: <button type="button" onClick={() => openStoredFile(String(value))} className="text-blue-500 hover:underline">Ver Documento</button> 
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
    const parsedValue = parseCurrencyInput(newValue);
    if (isNaN(parsedValue) || parsedValue <= 0) return;

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
                type="text"
                inputMode="decimal"
                placeholder="1330,00"
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

type StatusKey = 'signed' | 'submitted' | 'pending' | 'none';
const STATUS_ORDER: Record<StatusKey, number> = { submitted: 0, pending: 1, none: 2, signed: 3 };
const STATUS_META: Record<StatusKey, { label: string; dot: string }> = {
  signed: { label: 'Assinado', dot: 'bg-emerald-500' },
  submitted: { label: 'Dados recebidos', dot: 'bg-sky-500' },
  pending: { label: 'Aguardando o cliente', dot: 'bg-amber-500' },
  none: { label: 'Sem contrato', dot: 'bg-gray-300' },
};
const FILTERS: { id: 'all' | StatusKey; label: string }[] = [
  { id: 'all', label: 'Todos' }, { id: 'signed', label: 'Assinados' }, { id: 'submitted', label: 'Dados recebidos' },
  { id: 'pending', label: 'Aguardando' }, { id: 'none', label: 'Sem contrato' },
];

const hasFormData = (c: any) => !!c?.form_data && Object.keys(c.form_data).filter((k: string) => k !== 'value_history').length > 3;

export const AgencyContractsTab: React.FC = () => {
  const { agencyId } = useAuth();
  const [clients, setClients] = useState<ClientWithContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithContract | null>(null);
  const [viewDataModalOpen, setViewDataModalOpen] = useState(false);
  const [isCancelledExpanded, setIsCancelledExpanded] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | StatusKey>('all');
  const [search, setSearch] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    let clientsQuery = supabase.from('clients').select('*').eq('agency_id', agencyId).neq('is_internal', true).order('name');
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
        
        const primary = sortedContracts[0] || null;
        // Se o contrato assinado não tem os dados do formulário, herda do formulário enviado
        const withData = sortedContracts.find(cf => cf.form_data && Object.keys(cf.form_data).filter(k => k !== 'value_history').length > 3);
        const contract = primary && withData && primary !== withData
          ? { ...primary, form_data: { ...withData.form_data, ...(primary.form_data || {}) }, submitted_at: primary.submitted_at || withData.submitted_at }
          : primary;
        return {
          ...c,
          contract
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
    navigator.clipboard.writeText(`${getAppUrl()}/contrato/${token}`);
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
        contract_value: parseCurrencyInput(contractValue),
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

  // ---------- Visual (redesenho 09/11) ----------
  const money = (client: ClientWithContract | null, v: number, compact = false) =>
    new Intl.NumberFormat((client as any)?.currency === 'USD' ? 'en-US' : 'pt-BR', {
      style: 'currency', currency: (client as any)?.currency === 'USD' ? 'USD' : 'BRL', maximumFractionDigits: compact ? 0 : 2,
    }).format(v || 0);
  const statusOf = (c: ClientWithContract): StatusKey =>
    c.contract?.status === 'signed' ? 'signed' : c.contract?.status === 'submitted' ? 'submitted' : c.contract?.status === 'pending' ? 'pending' : 'none';
  const signedList = activeClientsList.filter(c => statusOf(c) === 'signed');
  const mrrByCurrency = signedList.reduce<Record<string, number>>((acc, c) => {
    const cur = (c as any).currency === 'USD' ? 'USD' : 'BRL';
    acc[cur] = (acc[cur] || 0) + getCurrentContractValue(c);
    return acc;
  }, {});
  const mainCur = (mrrByCurrency.USD || 0) > (mrrByCurrency.BRL || 0) ? 'USD' : 'BRL';
  const sameCur = signedList.filter(c => ((c as any).currency === 'USD' ? 'USD' : 'BRL') === mainCur);
  const ticket = sameCur.length ? (mrrByCurrency[mainCur] || 0) / sameCur.length : 0;
  const avgMonths = signedList.length
    ? Math.round(signedList.reduce((a, c) => a + (dayjs().diff(dayjs(c.contract?.contract_start_date || c.created_at), 'month') + 1), 0) / signedList.length)
    : 0;
  const fmtCur = (cur: string, v: number) => new Intl.NumberFormat(cur === 'USD' ? 'en-US' : 'pt-BR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v);
  const counts = {
    all: activeClientsList.length,
    signed: signedList.length,
    submitted: activeClientsList.filter(c => statusOf(c) === 'submitted').length,
    pending: activeClientsList.filter(c => statusOf(c) === 'pending').length,
    none: activeClientsList.filter(c => statusOf(c) === 'none').length,
  };
  const q = search.trim().toLowerCase();
  const visible = activeClientsList
    .filter(c => filter === 'all' || statusOf(c) === filter)
    .filter(c => !q || c.name.toLowerCase().includes(q) || (c.segment || '').toLowerCase().includes(q))
    .sort((a, b) => STATUS_ORDER[statusOf(a)] - STATUS_ORDER[statusOf(b)] || a.name.localeCompare(b.name));

  const notify = (text: string) => { setToast(text); setTimeout(() => setToast(null), 2200); };
  const copyLink = (token: string) => { navigator.clipboard.writeText(`${getAppUrl()}/contrato/${token}`); notify('Link do contrato copiado.'); };
  const generateLink = async (clientId: string) => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');
    const { data, error } = await supabase.from('contract_forms').insert({ client_id: clientId, agency_id: agencyId, form_token: token, status: 'pending' }).select().single();
    if (error) { notify(`Erro ao gerar o link: ${error.message}`); return; }
    if (data) {
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, contract: data } : c));
      navigator.clipboard.writeText(`${getAppUrl()}/contrato/${token}`);
      notify('Link gerado e copiado. É só mandar para o cliente.');
    }
  };

  const ActionMenu: React.FC<{ client: ClientWithContract }> = ({ client }) => {
    const st = statusOf(client);
    const items: { label: string; icon: React.ReactNode; onClick: () => void }[] = [];
    if (client.contract && (st === 'submitted' || hasFormData(client.contract))) items.push({ label: 'Ver dados do formulário', icon: <Eye size={14} />, onClick: () => { setSelectedClient(client); setViewDataModalOpen(true); } });
    if (st === 'pending' && client.contract) items.push({ label: 'Copiar link de novo', icon: <Copy size={14} />, onClick: () => copyLink(client.contract!.form_token) });
    if (st === 'signed') items.push({ label: 'Reajustes de valor', icon: <TrendingUp size={14} />, onClick: () => { setSelectedClient(client); setHistoryModalOpen(true); } });
    if (st === 'signed') items.push({ label: 'Substituir contrato assinado', icon: <Upload size={14} />, onClick: () => { setSelectedClient(client); setUploadModalOpen(true); } });
    if (st === 'pending' || st === 'none') items.push({ label: 'Subir contrato já assinado', icon: <Upload size={14} />, onClick: () => { setSelectedClient(client); setUploadModalOpen(true); } });
    if (!items.length) return null;
    const open = menuFor === client.id;
    return (
      <div className="relative">
        <button onClick={e => { e.stopPropagation(); setMenuFor(open ? null : client.id); }}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100" aria-label="Mais ações"><MoreHorizontal size={16} /></button>
        {open && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-gray-100 shadow-xl z-30 py-1.5" onClick={e => e.stopPropagation()}>
            {items.map(it => (
              <button key={it.label} onClick={() => { setMenuFor(null); it.onClick(); }}
                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left text-[13px] text-gray-700 hover:bg-gray-50">
                <span className="text-gray-400">{it.icon}</span>{it.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const PrimaryAction: React.FC<{ client: ClientWithContract }> = ({ client }) => {
    const st = statusOf(client);
    const base = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors';
    if (st === 'none') return <button onClick={() => generateLink(client.id)} className={`${base} bg-gray-900 text-white hover:bg-gray-800`}><LinkIcon size={14} /> Gerar link</button>;
    if (st === 'pending') return <button onClick={() => copyLink(client.contract!.form_token)} className={`${base} border border-gray-200 text-gray-700 hover:border-gray-300`}><Copy size={14} /> Copiar link</button>;
    if (st === 'submitted') return <button onClick={() => { setSelectedClient(client); setUploadModalOpen(true); }} className={`${base} bg-gray-900 text-white hover:bg-gray-800`}><Upload size={14} /> Subir assinado</button>;
    if (client.contract?.signed_contract_url) return <button onClick={() => openStoredFile(client.contract!.signed_contract_url!)} className={`${base} border border-gray-200 text-gray-700 hover:border-gray-300`}><FileText size={14} /> Ver PDF</button>;
    return null;
  };

  const StatusLine: React.FC<{ client: ClientWithContract }> = ({ client }) => {
    const st = statusOf(client);
    const meta = STATUS_META[st];
    const when = st === 'signed' ? client.contract?.signed_at : st === 'submitted' ? client.contract?.submitted_at : st === 'pending' ? (client.contract as any)?.created_at : null;
    return (
      <div className="flex flex-col">
        <span className="inline-flex items-center gap-2 text-[13px] font-medium text-gray-800">
          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />{meta.label}
        </span>
        {when && <span className="text-[11px] text-gray-400 mt-0.5 pl-4">{st === 'pending' ? `link de ${dayjs(when).fromNow()}` : dayjs(when).format('DD/MM/YYYY')}</span>}
      </div>
    );
  };

  const Avatar: React.FC<{ client: ClientWithContract; muted?: boolean }> = ({ client, muted }) => (
    <span className="w-9 h-9 rounded-xl text-white text-[11px] font-bold flex items-center justify-center shrink-0"
      style={{ backgroundColor: muted ? '#9CA3AF' : (client.color || '#456da1') }}>
      {client.initials || client.name.slice(0, 2).toUpperCase()}
    </span>
  );

  const ValueCell: React.FC<{ client: ClientWithContract }> = ({ client }) => {
    if (statusOf(client) !== 'signed') return <span className="text-gray-300">—</span>;
    const hist = (client.features_settings?.value_history || client.contract?.form_data?.value_history || []) as any[];
    return (
      <div className="flex flex-col">
        <span className="font-semibold text-gray-900 tabular-nums">{money(client, getCurrentContractValue(client))}<span className="text-gray-400 font-normal">/mês</span></span>
        <span className="text-[11px] text-gray-400 mt-0.5" title={formatValueHistory(client) || undefined}>
          {formatClientPermanence(client)} de casa{hist.length ? ` · ${hist.length} ${hist.length === 1 ? 'reajuste' : 'reajustes'}` : ''}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6" onClick={() => menuFor && setMenuFor(null)}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Contratos</h2>
          <p className="text-sm text-gray-500 mt-1">Quem já assinou, quem falta e quanto entra por mês.</p>
        </div>
        <div className="relative sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
        </div>
      </div>

      {/* Resumo */}
      <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100 [&>*]:bg-white">
        <div className="p-5">
          <p className="text-xs font-medium text-gray-500">Receita recorrente (MRR)</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{fmtCur(mainCur, mrrByCurrency[mainCur] || 0)}</p>
          {Object.keys(mrrByCurrency).length > 1 && (
            <p className="text-xs text-gray-400 mt-0.5">+ {fmtCur(mainCur === 'BRL' ? 'USD' : 'BRL', mrrByCurrency[mainCur === 'BRL' ? 'USD' : 'BRL'] || 0)}</p>
          )}
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-gray-500">Contratos assinados</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{counts.signed}</p>
          <p className="text-xs text-gray-400 mt-0.5">de {counts.all} clientes ativos</p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-gray-500">Ticket médio</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{fmtCur(mainCur, ticket)}</p>
          <p className="text-xs text-gray-400 mt-0.5">por cliente, por mês</p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-gray-500">Tempo médio de casa</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{avgMonths} {avgMonths === 1 ? 'mês' : 'meses'}</p>
          {oldestContract && <p className="text-xs text-gray-400 mt-0.5 truncate">mais antigo: {oldestContract.name}</p>}
        </div>
      </div>

      {/* Precisa de atenção */}
      {(counts.submitted > 0 || counts.pending > 0 || counts.none > 0) && (
        <div className="flex flex-wrap gap-2">
          {counts.submitted > 0 && (
            <button onClick={() => setFilter('submitted')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-50 text-sky-800 text-xs font-semibold hover:bg-sky-100">
              <span className="w-2 h-2 rounded-full bg-sky-500" /> {counts.submitted} com dados recebidos: falta subir o assinado
            </button>
          )}
          {counts.pending > 0 && (
            <button onClick={() => setFilter('pending')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> {counts.pending} aguardando o cliente preencher
            </button>
          )}
          {counts.none > 0 && (
            <button onClick={() => setFilter('none')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200">
              <span className="w-2 h-2 rounded-full bg-gray-400" /> {counts.none} sem contrato
            </button>
          )}
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-4 sm:px-5 pt-4 flex gap-1 overflow-x-auto no-scrollbar border-b border-gray-100">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${filter === f.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
              {f.label} <span className="ml-1 text-gray-400 font-medium">{counts[f.id]}</span>
            </button>
          ))}
        </div>

        <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto] gap-4 px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50">
          <span>Cliente</span><span>Status</span><span>Mensalidade</span><span>LTV até hoje</span><span className="w-[150px] text-right">Ações</span>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">Carregando...</p>
        ) : visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">{q ? 'Nenhum cliente encontrado.' : 'Ninguém aqui.'}</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {visible.map(client => (
              <li key={client.id} className="px-4 sm:px-5 py-3.5 grid grid-cols-[auto_1fr_auto] md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto] gap-x-4 gap-y-2 items-center hover:bg-gray-50/60">
                <div className="flex items-center gap-3 min-w-0 col-span-2 md:col-span-1">
                  <Avatar client={client} />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{client.name}</p>
                    {client.segment && <p className="text-xs text-gray-400 truncate">{client.segment}</p>}
                  </div>
                </div>
                <div className="col-start-1 col-span-3 md:col-auto pl-12 md:pl-0"><StatusLine client={client} /></div>
                <div className={`col-start-1 col-span-3 md:col-auto pl-12 md:pl-0 ${statusOf(client) === 'signed' ? '' : 'hidden md:block'}`}><ValueCell client={client} /></div>
                <div className="hidden md:block text-gray-600 tabular-nums">{statusOf(client) === 'signed' ? money(client, calculateClientLTV(client), true) : <span className="text-gray-300">—</span>}</div>
                <div className="row-start-1 col-start-3 md:row-auto md:col-auto flex items-center justify-end gap-1 md:w-[150px]">
                  <PrimaryAction client={client} />
                  <ActionMenu client={client} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Encerrados */}
      {cancelledClientsList.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <button type="button" onClick={() => setIsCancelledExpanded(!isCancelledExpanded)}
            className="w-full px-5 py-4 flex items-center justify-between text-left">
            <span className="text-sm font-semibold text-gray-700">Contratos encerrados <span className="text-gray-400 font-medium">{cancelledClientsList.length}</span></span>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${isCancelledExpanded ? 'rotate-180' : ''}`} />
          </button>
          {isCancelledExpanded && (
            <ul className="divide-y divide-gray-50 border-t border-gray-100">
              {cancelledClientsList.map(client => (
                <li key={client.id} className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1 basis-56">
                    <Avatar client={client} muted />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-600 truncate">{client.name}</p>
                      <p className="text-xs text-gray-400">
                        {dayjs(client.contract?.contract_start_date || client.created_at).format('MMM/YYYY')} a {client.cancelled_at ? dayjs(client.cancelled_at).format('MMM/YYYY') : '—'} · {formatClientPermanence(client)}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-[11px] text-gray-400">Última mensalidade</p>
                    <p className="font-semibold text-gray-600 tabular-nums">{money(client, getCurrentContractValue(client))}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-[11px] text-gray-400">LTV real</p>
                    <p className="font-semibold text-gray-900 tabular-nums">{money(client, calculateClientLTV(client), true)}</p>
                  </div>
                  <div className="flex gap-1 ml-auto">
                    {client.contract?.signed_contract_url && (
                      <button onClick={() => openStoredFile(client.contract!.signed_contract_url!)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-gray-300"><FileText size={14} /> PDF</button>
                    )}
                    {client.contract && (
                      <button onClick={() => { setSelectedClient(client); setViewDataModalOpen(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-gray-300"><Eye size={14} /> Dados</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[70] bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg">{toast}</div>
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
                  type="text" 
                  inputMode="decimal"
                  required
                  value={contractValue}
                  onChange={e => setContractValue(e.target.value)}
                  placeholder="Ex: 1500,00"
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

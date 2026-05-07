import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { ContractForm, AgencyCRM } from '../types';
import { Building2, UploadCloud, CheckCircle, AlertCircle, Loader2, ArrowLeft, Home, FileText } from 'lucide-react';
import { Logo } from './Logo';

interface ContractFormScreenProps {
  formToken: string;
}

export const ContractFormScreen: React.FC<ContractFormScreenProps> = ({ formToken }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [contractData, setContractData] = useState<ContractForm | null>(null);
  const [agencyData, setAgencyData] = useState<any | null>(null);
  
  const [clientType, setClientType] = useState<'PF' | 'PJ'>('PF');
  const [includePartner, setIncludePartner] = useState(false);
  const [cnpjFile, setCnpjFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    // PF Fields
    pf_name: '',
    pf_cpf: '',
    pf_rg: '',
    pf_orgao_emissor: '',
    pf_birth_date: '',
    pf_marital_status: 'solteiro',
    pf_profession: '',
    pf_email: '',
    pf_whatsapp: '',
    
    // PF Partner
    pf_partner_name: '',
    pf_partner_cpf: '',
    pf_partner_email: '',
    pf_partner_whatsapp: '',

    // PJ Fields
    pj_razao_social: '',
    pj_nome_fantasia: '',
    pj_cnpj: '',
    pj_inscricao_estadual: '',
    pj_inscricao_municipal: '',

    // PJ Legal Representative
    pj_rep_name: '',
    pj_rep_cpf: '',
    pj_rep_rg: '',
    pj_rep_birth_date: '',
    pj_rep_email: '',
    pj_rep_whatsapp: '',

    // PJ Partner
    pj_partner_name: '',
    pj_partner_cpf: '',
    pj_partner_email: '',
    pj_partner_whatsapp: '',

    // Common Address
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    address_zip: ''
  });

  useEffect(() => {
    fetchContractDetails();
  }, [formToken]);

  const fetchContractDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_forms')
        .select(`
          *,
          agencies:agency_id (
            name,
            logo_url
          )
        `)
        .eq('form_token', formToken)
        .single();

      if (error) throw error;
      
      setContractData(data as any);
      if (data?.agencies) {
          setAgencyData(data.agencies);
      }
    } catch (err: any) {
      console.error('Error fetching contract:', err);
      setError('Link inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractData) return;
    
    setSubmitting(true);
    let cartao_cnpj_url = null;

    try {
      if (clientType === 'PJ' && cnpjFile) {
        const fileExt = cnpjFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `contratos/${contractData.client_id}/cartao_cnpj_${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('client-documents')
          .upload(filePath, cnpjFile);

        if (uploadError) throw new Error('Erro ao fazer upload do Cartão CNPJ.');

        const { data: { publicUrl } } = supabase.storage
          .from('client-documents')
          .getPublicUrl(filePath);

        cartao_cnpj_url = publicUrl;
      }

      const finalData = {
        client_type: clientType,
        ...formData,
        cartao_cnpj_url
      };

      const { error } = await supabase
        .from('contract_forms')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          form_data: finalData
        })
        .eq('id', contractData.id);

      if (error) throw error;

      setContractData({ ...contractData, status: 'submitted' });
      setSuccess(true);
      window.scrollTo(0, 0);
    } catch (err: any) {
      console.error(err);
      alert('Houve um erro ao enviar seu formulário. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-brand-dark animate-spin" />
      </div>
    );
  }

  if (error || !contractData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Inválido</h2>
        <p className="text-gray-500 text-center max-w-md">Não conseguimos encontrar este formulário de contrato. Verifique se o link está correto.</p>
      </div>
    );
  }

  if (contractData.status === 'submitted' || success) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center p-6 justify-center">
        <motion.div
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-white p-8 sm:p-12 rounded-[2.5rem] border border-black/[0.03] shadow-md max-w-lg w-full text-center"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Tudo Certo!</h2>
          <p className="text-gray-500 leading-relaxed mb-8">
            Seus dados foram enviados com sucesso. Em breve a nossa equipe entrará em contato para os próximos passos.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center mb-10">
          {agencyData?.logo_url ? (
            <img src={agencyData.logo_url} alt={agencyData.name} className="h-16 object-contain mb-8 mix-blend-multiply" />
          ) : (
            <div className="mb-8 scale-150">
                <Logo size="medium" />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 text-center">Ficha Cadastral para Contrato</h1>
          <p className="text-gray-500 mt-2 text-center max-w-xl">Preencha os dados abaixo com atenção. Estas informações serão utilizadas para redigir ou validar o seu contrato de prestação de serviços.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-10 border border-black/[0.04] shadow-sm rounded-[2.5rem] space-y-10">
          
          {/* Client Type Toggle */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-4">Tipo de Cadastro *</label>
            <div className="flex bg-gray-50 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setClientType('PF')}
                className={`flex-1 py-3 text-sm font-bold rounded-xl outline-none transition-all ${clientType === 'PF' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Pessoa Física (PF)
              </button>
              <button
                type="button"
                onClick={() => setClientType('PJ')}
                className={`flex-1 py-3 text-sm font-bold rounded-xl outline-none transition-all ${clientType === 'PJ' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Pessoa Jurídica (PJ)
              </button>
            </div>
          </div>

          <div className="h-px bg-gray-100 my-6" />

          {/* ------------- CAMPOS PF ------------- */}
          {clientType === 'PF' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Building2 size={20} className="text-brand-dark" /> Dados Pessoais</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Nome Completo *</label>
                  <input required name="pf_name" value={formData.pf_name} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">CPF *</label>
                  <input required name="pf_cpf" value={formData.pf_cpf} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">RG *</label>
                        <input required name="pf_rg" value={formData.pf_rg} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Órgão Emissor</label>
                        <input name="pf_orgao_emissor" value={formData.pf_orgao_emissor} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                    </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Data de Nascimento *</label>
                  <input required name="pf_birth_date" value={formData.pf_birth_date} onChange={handleInputChange} type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Estado Civil *</label>
                  <select required name="pf_marital_status" value={formData.pf_marital_status} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium appearance-none">
                    <option value="solteiro">Solteiro(a)</option>
                    <option value="casado">Casado(a)</option>
                    <option value="divorciado">Divorciado(a)</option>
                    <option value="viuvo">Viúvo(a)</option>
                    <option value="uniao_estavel">União Estável</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Profissão *</label>
                  <input required name="pf_profession" value={formData.pf_profession} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">WhatsApp *</label>
                  <input required name="pf_whatsapp" value={formData.pf_whatsapp} onChange={handleInputChange} type="tel" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">E-mail *</label>
                  <input required name="pf_email" value={formData.pf_email} onChange={handleInputChange} type="email" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                </div>
              </div>
            </div>
          )}

          {/* ------------- CAMPOS PJ ------------- */}
          {clientType === 'PJ' && (
            <>
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Building2 size={20} className="text-brand-dark" /> Dados da Empresa</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Razão Social *</label>
                    <input required name="pj_razao_social" value={formData.pj_razao_social} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Nome Fantasia *</label>
                    <input required name="pj_nome_fantasia" value={formData.pj_nome_fantasia} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">CNPJ *</label>
                    <input required name="pj_cnpj" value={formData.pj_cnpj} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Comprovante de CNPJ</label>
                    <div className="relative">
                        <input 
                            type="file" 
                            accept=".pdf,image/*"
                            onChange={(e) => setCnpjFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        />
                        <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 border-dashed rounded-xl flex items-center justify-center gap-2 text-gray-500 text-sm font-medium hover:bg-gray-100 transition-colors">
                            <UploadCloud size={18} />
                            {cnpjFile ? cnpjFile.name : 'Anexar Cartão CNPJ'}
                        </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Inscrição Estadual</label>
                    <input name="pj_inscricao_estadual" value={formData.pj_inscricao_estadual} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Inscrição Municipal</label>
                    <input name="pj_inscricao_municipal" value={formData.pj_inscricao_municipal} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-100 my-6" />

              <div className="space-y-6">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><FileText size={20} className="text-brand-dark" /> Representante Legal</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Nome Completo *</label>
                    <input required name="pj_rep_name" value={formData.pj_rep_name} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">CPF *</label>
                    <input required name="pj_rep_cpf" value={formData.pj_rep_cpf} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">RG *</label>
                    <input required name="pj_rep_rg" value={formData.pj_rep_rg} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Data de Nascimento *</label>
                    <input required name="pj_rep_birth_date" value={formData.pj_rep_birth_date} onChange={handleInputChange} type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">WhatsApp *</label>
                    <input required name="pj_rep_whatsapp" value={formData.pj_rep_whatsapp} onChange={handleInputChange} type="tel" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">E-mail *</label>
                    <input required name="pj_rep_email" value={formData.pj_rep_email} onChange={handleInputChange} type="email" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="h-px bg-gray-100 my-6" />

          {/* ------------- ENDEREÇO COMUM ------------- */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Home size={20} className="text-brand-dark" /> Endereço</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">CEP *</label>
                <input required name="address_zip" value={formData.address_zip} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
              </div>
              <div className="sm:col-span-8">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Rua / Avenida *</label>
                <input required name="address_street" value={formData.address_street} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Número *</label>
                <input required name="address_number" value={formData.address_number} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
              </div>
              <div className="sm:col-span-8">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Complemento</label>
                <input name="address_complement" value={formData.address_complement} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
              </div>
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bairro *</label>
                <input required name="address_neighborhood" value={formData.address_neighborhood} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
              </div>
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cidade *</label>
                <input required name="address_city" value={formData.address_city} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">UF *</label>
                <input required name="address_state" value={formData.address_state} onChange={handleInputChange} type="text" maxLength={2} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium uppercase" />
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100 my-6" />

          {/* ------------- SÓCIOS (OPCIONAL) ------------- */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="includePartner" 
                checked={includePartner} 
                onChange={(e) => setIncludePartner(e.target.checked)}
                className="w-5 h-5 text-brand-dark border-gray-300 rounded focus:ring-brand-dark"
              />
              <label htmlFor="includePartner" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                Incluir Sócio (Opcional)
              </label>
            </div>

            {includePartner && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Nome Completo do Sócio *</label>
                  <input required name={`${clientType === 'PF' ? 'pf' : 'pj'}_partner_name`} value={clientType === 'PF' ? formData.pf_partner_name : formData.pj_partner_name} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">CPF do Sócio *</label>
                  <input required name={`${clientType === 'PF' ? 'pf' : 'pj'}_partner_cpf`} value={clientType === 'PF' ? formData.pf_partner_cpf : formData.pj_partner_cpf} onChange={handleInputChange} type="text" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">WhatsApp do Sócio *</label>
                  <input required name={`${clientType === 'PF' ? 'pf' : 'pj'}_partner_whatsapp`} value={clientType === 'PF' ? formData.pf_partner_whatsapp : formData.pj_partner_whatsapp} onChange={handleInputChange} type="tel" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">E-mail do Sócio *</label>
                  <input required name={`${clientType === 'PF' ? 'pf' : 'pj'}_partner_email`} value={clientType === 'PF' ? formData.pf_partner_email : formData.pj_partner_email} onChange={handleInputChange} type="email" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-dark/20 transition-all font-medium" />
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-xs text-gray-400 font-medium text-center sm:text-left max-w-sm">
              Ao enviar este formulário, você atesta que os dados fornecidos são verdadeiros e autênticos.
            </p>

            <button 
              type="submit" 
              disabled={submitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-brand-dark text-white rounded-2xl font-bold uppercase tracking-widest text-sm hover:shadow-[0_15px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <><Loader2 size={18} className="animate-spin" /> Processando...</>
              ) : (
                <>Enviar Dados <CheckCircle size={18} /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

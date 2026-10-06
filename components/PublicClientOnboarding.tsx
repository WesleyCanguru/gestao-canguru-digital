import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  FileText,
  Sparkles,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Globe,
  Phone,
  Mail,
  User,
  AlertCircle,
  Loader2,
  Lock,
  ShieldCheck,
  Check
} from 'lucide-react';

interface PublicClientOnboardingProps {
  agencySlug: string | null;
}

interface AgencyData {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  is_active: boolean;
  plan: string | null;
  domain: string | null;
}

// SHA-256 via SubtleCrypto (browser nativo)
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const AGE_RANGE_OPTIONS = [
  'Under 18',
  '18 - 24',
  '25 - 34',
  '35 - 44',
  '45 - 54',
  '55 - 64',
  '65+'
];

export const PublicClientOnboarding: React.FC<PublicClientOnboardingProps> = ({ agencySlug }) => {
  const [loadingAgency, setLoadingAgency] = useState(true);
  const [agency, setAgency] = useState<AgencyData | null>(null);
  const [agencyNotFound, setAgencyNotFound] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);

  // Stepper state: 1 = Dados, 2 = Contrato, 3 = Briefing, 4 = Chave, 5 = Concluído
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Dados da Empresa + Links de Redes Sociais (opcionais)
  const [formData, setFormData] = useState({
    responsible: '',
    companyName: '',
    website: '',
    phone: '',
    email: '',
    instagram_url: '',
    linkedin_url: '',
    tiktok_url: '',
    google_business_url: ''
  });
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});

  // Step 2: Contrato
  const [contractAccepted, setContractAccepted] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [submittingStep2, setSubmittingStep2] = useState(false);

  // Step 3: Briefing
  const [briefingData, setBriefingData] = useState({
    niche: '',
    objective: 'Geração de Leads',
    targetAgeRanges: [] as string[],
    targetLocation: '',
    targetInterests: '',
    competitors: '',
    differentiator: '',
    notes: ''
  });
  const [submittingStep3, setSubmittingStep3] = useState(false);

  // Step 4: Chave de acesso
  const [accessKey, setAccessKey] = useState('');
  const [confirmKey, setConfirmKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const [submittingStep4, setSubmittingStep4] = useState(false);

  // Carregar agência pelo slug
  useEffect(() => {
    const fetchAgency = async () => {
      const cleanSlug = (agencySlug || '').trim().toLowerCase();
      if (!cleanSlug) {
        setAgencyNotFound(true);
        setLoadingAgency(false);
        return;
      }

      try {
        setLoadingAgency(true);
        const { data, error } = await supabase
          .from('agencies')
          .select('*')
          .eq('slug', cleanSlug)
          .eq('is_active', true)
          .maybeSingle();

        if (error || !data) {
          console.error('Agency not found for slug:', cleanSlug, error);
          setAgencyNotFound(true);
        } else {
          setAgency(data as AgencyData);
          if (data.id === 7) {
            setBriefingData(b => ({ ...b, objective: 'Lead Generation' }));
          }
        }
      } catch (err) {
        console.error('Error fetching agency:', err);
        setAgencyNotFound(true);
      } finally {
        setLoadingAgency(false);
      }
    };

    fetchAgency();
  }, [agencySlug]);

  const isEnglish = agency?.id === 7;
  const brandColor = agency?.primary_color || (isEnglish ? '#1A3A5C' : '#456da1');

  // Validação Etapa 1
  const handleContinueStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.responsible.trim()) {
      errors.responsible = isEnglish ? 'Full name is required' : 'Nome completo é obrigatório';
    }
    if (!formData.companyName.trim()) {
      errors.companyName = isEnglish ? 'Company name is required' : 'Nome da empresa é obrigatório';
    }
    if (!formData.website.trim()) {
      errors.website = isEnglish ? 'Website URL is required' : 'Site da empresa é obrigatório';
    }
    if (!formData.phone.trim()) {
      errors.phone = isEnglish ? 'Phone / WhatsApp is required' : 'WhatsApp / Telefone é obrigatório';
    }
    if (!formData.email.trim()) {
      errors.email = isEnglish ? 'Email is required' : 'E-mail é obrigatório';
    } else if (!formData.email.includes('@') || !formData.email.includes('.')) {
      errors.email = isEnglish ? 'Please enter a valid email' : 'Informe um e-mail válido';
    }

    if (Object.keys(errors).length > 0) {
      setStep1Errors(errors);
      return;
    }

    setStep1Errors({});
    setStep(2);
  };

  // Aceitar contrato (Etapa 2) e inserir em `clients`
  const handleAcceptContract = async () => {
    if (!contractAccepted || !agency) return;

    try {
      setSubmittingStep2(true);

      // Gerar iniciais automáticas
      const cleanCompany = formData.companyName.trim();
      const initials = cleanCompany
        .split(/\s+/)
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'CL';

      const currency = agency.id === 7 ? 'USD' : 'BRL';

      const baseTrafficStrategyData = {
        website_url: formData.website.trim(),
        phone: formData.phone.trim(),
        instagram_url: formData.instagram_url.trim() || null,
        linkedin_url: formData.linkedin_url.trim() || null,
        tiktok_url: formData.tiktok_url.trim() || null,
        google_business_url: formData.google_business_url.trim() || null,
        created_via: 'public_onboarding',
        agency_slug: agency.slug
      };

      const baseClientPayload: any = {
        name: cleanCompany,
        responsible: formData.responsible.trim(),
        email: formData.email.trim(),
        instagram: formData.instagram_url.trim() || null,
        linkedin: formData.linkedin_url.trim() || null,
        tiktok: formData.tiktok_url.trim() || null,
        agency_id: agency.id,
        client_status: 'prospect',
        onboarding_status: 'em_andamento',
        services: ['Tráfego Pago'],
        traffic_platforms: ['meta', 'google'],
        currency,
        is_active: false,
        initials,
        color: brandColor,
        traffic_strategy_data: baseTrafficStrategyData
      };

      const fullClientPayload: any = {
        ...baseClientPayload,
        instagram_url: formData.instagram_url.trim() || null,
        linkedin_url: formData.linkedin_url.trim() || null,
        tiktok_url: formData.tiktok_url.trim() || null,
        google_business_url: formData.google_business_url.trim() || null
      };

      let { data, error } = await supabase
        .from('clients')
        .insert(fullClientPayload)
        .select('id')
        .single();

      if (error) {
        console.warn('Insert with new social URL columns returned warning, retrying with base schema:', error.message);
        const retryRes = await supabase
          .from('clients')
          .insert(baseClientPayload)
          .select('id')
          .single();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (error || !data) {
        console.error('Error creating client during onboarding:', error);
        alert(isEnglish ? 'Could not create registration. Please try again.' : 'Não foi possível salvar os dados. Tente novamente.');
        return;
      }

      setCreatedClientId(data.id);
      setStep(3);
    } catch (err) {
      console.error('Unexpected error in step 2:', err);
      alert(isEnglish ? 'An unexpected error occurred.' : 'Ocorreu um erro inesperado.');
    } finally {
      setSubmittingStep2(false);
    }
  };

  const toggleAgeRange = (range: string) => {
    setBriefingData(prev => {
      const exists = prev.targetAgeRanges.includes(range);
      return {
        ...prev,
        targetAgeRanges: exists
          ? prev.targetAgeRanges.filter(r => r !== range)
          : [...prev.targetAgeRanges, range]
      };
    });
  };

  // Salvar Briefing (Etapa 3)
  const handleSaveBriefing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdClientId || !agency) return;

    try {
      setSubmittingStep3(true);

      const onboarding_briefing = {
        nicho: briefingData.niche.trim(),
        objetivo: briefingData.objective.trim(),
        target_age_ranges: briefingData.targetAgeRanges,
        target_location: briefingData.targetLocation.trim(),
        target_interests: briefingData.targetInterests.trim(),
        concorrentes: briefingData.competitors.trim(),
        diferencial: briefingData.differentiator.trim(),
        observacoes: briefingData.notes.trim()
      };

      const updatedStrategyData = {
        website_url: formData.website.trim(),
        phone: formData.phone.trim(),
        instagram_url: formData.instagram_url.trim() || null,
        linkedin_url: formData.linkedin_url.trim() || null,
        tiktok_url: formData.tiktok_url.trim() || null,
        google_business_url: formData.google_business_url.trim() || null,
        target_age_ranges: briefingData.targetAgeRanges,
        target_location: briefingData.targetLocation.trim() || null,
        target_interests: briefingData.targetInterests.trim() || null,
        created_via: 'public_onboarding',
        agency_slug: agency.slug,
        onboarding_briefing
      };

      // Atualizar clients com as novas colunas + fallback
      const { error: updateErr } = await supabase
        .from('clients')
        .update({
          segment: briefingData.niche.trim() || undefined,
          target_age_ranges: briefingData.targetAgeRanges,
          target_location: briefingData.targetLocation.trim() || null,
          target_interests: briefingData.targetInterests.trim() || null,
          traffic_strategy_data: updatedStrategyData
        })
        .eq('id', createdClientId);

      if (updateErr) {
        await supabase
          .from('clients')
          .update({
            segment: briefingData.niche.trim() || undefined,
            traffic_strategy_data: updatedStrategyData
          })
          .eq('id', createdClientId);
      }

      // Inserir opcionalmente em client_briefings
      try {
        await supabase.from('client_briefings').insert({
          client_id: createdClientId,
          agency_id: agency.id,
          briefing_type: 'onboarding',
          responses: onboarding_briefing,
          is_completed: true,
          completed_at: new Date().toISOString()
        });
      } catch (briefingErr) {
        console.warn('client_briefings table optional insert warning:', briefingErr);
      }

      setStep(4);
    } catch (err) {
      console.error('Error saving briefing:', err);
      alert(isEnglish ? 'Could not save briefing. Please try again.' : 'Erro ao salvar briefing. Tente novamente.');
    } finally {
      setSubmittingStep3(false);
    }
  };

  // Finalizar Cadastro (Etapa 4)
  const handleFinishRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError('');

    if (accessKey.length < 6) {
      setKeyError(isEnglish ? 'Access key must be at least 6 characters' : 'A chave de acesso deve ter no mínimo 6 caracteres');
      return;
    }

    if (accessKey !== confirmKey) {
      setKeyError(isEnglish ? 'Access keys do not match' : 'As chaves de acesso não coincidem');
      return;
    }

    if (!createdClientId || !agency) return;

    try {
      setSubmittingStep4(true);

      // 1. Calcular SHA-256 da chave informada usando SubtleCrypto nativo
      const passwordHash = await sha256(accessKey);

      // 2. Inserir na tabela client_users
      const userPayloadWithColumns: any = {
        client_id: createdClientId,
        agency_id: agency.id,
        name: formData.responsible.trim(),
        email: formData.email.trim(),
        access_key: accessKey.trim(),
        password_hash: passwordHash,
        role: 'client',
        is_active: true
      };

      const { error: userError } = await supabase.from('client_users').insert(userPayloadWithColumns);

      if (userError) {
        console.warn('Direct insert into client_users with name/email/access_key error, using fallback:', userError);
        // Fallback para schema legado com username caso as colunas name/email/access_key não estejam cacheadas
        const fallbackUser: any = {
          client_id: createdClientId,
          agency_id: agency.id,
          username: formData.email.trim() || formData.responsible.trim(),
          password_hash: passwordHash,
          role: 'client',
          is_active: true
        };
        await supabase.from('client_users').insert(fallbackUser);
      }

      // Salvar também em client_credentials para garantia de acesso e suporte
      try {
        await supabase.from('client_credentials').insert({
          client_id: createdClientId,
          agency_id: agency.id,
          platform: 'portal',
          label: 'Chave de Acesso Bolsa',
          username: formData.email.trim(),
          password_encrypted: accessKey.trim(),
          notes: 'Chave de acesso gerada no auto-cadastro'
        });
      } catch (credErr) {
        console.warn('client_credentials save note:', credErr);
      }

      // 3. Atualizar clients onde id = client_id
      const nowIso = new Date().toISOString();
      const finalStrategyData = {
        website_url: formData.website.trim(),
        phone: formData.phone.trim(),
        instagram_url: formData.instagram_url.trim() || null,
        linkedin_url: formData.linkedin_url.trim() || null,
        tiktok_url: formData.tiktok_url.trim() || null,
        google_business_url: formData.google_business_url.trim() || null,
        target_age_ranges: briefingData.targetAgeRanges,
        target_location: briefingData.targetLocation.trim() || null,
        target_interests: briefingData.targetInterests.trim() || null,
        client_access_key: accessKey.trim(),
        created_via: 'public_onboarding',
        agency_slug: agency.slug,
        onboarding_briefing: {
          nicho: briefingData.niche.trim(),
          objetivo: briefingData.objective.trim(),
          target_age_ranges: briefingData.targetAgeRanges,
          target_location: briefingData.targetLocation.trim(),
          target_interests: briefingData.targetInterests.trim(),
          concorrentes: briefingData.competitors.trim(),
          diferencial: briefingData.differentiator.trim(),
          observacoes: briefingData.notes.trim()
        }
      };

      const { error: finalErr } = await supabase
        .from('clients')
        .update({
          onboarding_status: 'concluido',
          onboarding_completed_at: nowIso,
          target_age_ranges: briefingData.targetAgeRanges,
          target_location: briefingData.targetLocation.trim() || null,
          target_interests: briefingData.targetInterests.trim() || null,
          instagram_url: formData.instagram_url.trim() || null,
          linkedin_url: formData.linkedin_url.trim() || null,
          tiktok_url: formData.tiktok_url.trim() || null,
          google_business_url: formData.google_business_url.trim() || null,
          traffic_strategy_data: finalStrategyData
        })
        .eq('id', createdClientId);

      if (finalErr) {
        await supabase
          .from('clients')
          .update({
            onboarding_status: 'concluido',
            onboarding_completed_at: nowIso,
            traffic_strategy_data: finalStrategyData
          })
          .eq('id', createdClientId);
      }

      // Ir para a tela de confirmação
      setStep(5);
    } catch (err) {
      console.error('Error finalizing registration:', err);
      setKeyError(isEnglish ? 'Failed to finalize registration. Please try again.' : 'Falha ao finalizar o cadastro. Tente novamente.');
    } finally {
      setSubmittingStep4(false);
    }
  };

  // Carregamento inicial
  if (loadingAgency) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-stone-600">
        <Loader2 className="w-10 h-10 animate-spin text-stone-400 mb-4" />
        <p className="text-sm font-medium animate-pulse">Carregando formulário...</p>
      </div>
    );
  }

  // Agência não encontrada / link inválido
  if (agencyNotFound || !agency) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.06)] text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Link inválido
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Não foi possível localizar a agência informada ou o link de cadastro expirou. Por favor, solicite um novo link diretamente à sua agência.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
          >
            Ir para página inicial
          </a>
        </div>
      </div>
    );
  }

  const stepsList = [
    { num: 1, label: isEnglish ? 'Company Info' : 'Dados' },
    { num: 2, label: isEnglish ? 'Agreement' : 'Contrato' },
    { num: 3, label: isEnglish ? 'Briefing' : 'Briefing' },
    { num: 4, label: isEnglish ? 'Access Key' : 'Chave de Acesso' }
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col justify-between text-gray-800 relative overflow-hidden font-sans">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[140px] opacity-20"
          style={{ backgroundColor: brandColor }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-[140px] opacity-15"
          style={{ backgroundColor: brandColor }}
        />
      </div>

      {/* Header com logo da agência */}
      <header className="relative z-10 w-full max-w-4xl mx-auto pt-8 px-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {agency.logo_url && !logoLoadError ? (
            <img
              src={agency.logo_url}
              alt={agency.name}
              className="max-h-[40px] h-10 w-auto object-contain"
              onError={() => setLogoLoadError(true)}
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm"
              style={{ backgroundColor: brandColor }}
            >
              {agency.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-base font-bold text-gray-900 tracking-tight leading-tight">{agency.name}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              {isEnglish ? 'Client Onboarding' : 'Auto-cadastro de Cliente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-white/80 px-3 py-1.5 rounded-full border border-black/[0.04] shadow-2xs">
            {isEnglish ? 'Paid Media Portal' : 'Tráfego Pago'}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-3xl mx-auto px-6 py-6 flex-1 flex flex-col justify-center">
        {step < 5 && (
          <div className="mb-8 bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-black/[0.03] shadow-2xs">
            <div className="flex items-center justify-between relative">
              <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-0.5 bg-gray-200 z-0" />
              <div
                className="absolute top-1/2 left-6 -translate-y-1/2 h-0.5 transition-all duration-500 z-0"
                style={{
                  backgroundColor: brandColor,
                  width: `${((step - 1) / (stepsList.length - 1)) * 90}%`
                }}
              />

              {stepsList.map(s => {
                const isPassed = step > s.num;
                const isCurrent = step === s.num;
                return (
                  <div key={s.num} className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 shadow-sm ${
                        isPassed
                          ? 'text-white'
                          : isCurrent
                          ? 'text-white ring-4 ring-black/5'
                          : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                      style={{
                        backgroundColor: isPassed || isCurrent ? brandColor : undefined
                      }}
                    >
                      {isPassed ? <Check size={16} /> : s.num}
                    </div>
                    <span
                      className={`text-[10px] mt-1.5 font-bold uppercase tracking-wider ${
                        isCurrent ? 'text-gray-900' : isPassed ? 'text-gray-600' : 'text-gray-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Card do formulário */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-black/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
          <AnimatePresence mode="wait">
            {/* ETAPA 1: Dados da Empresa */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <Building2 size={13} />
                    {isEnglish ? 'Step 1 of 4' : 'Etapa 1 de 4'}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {isEnglish ? 'Company Information' : 'Dados da Empresa'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {isEnglish
                      ? 'Please provide your basic contact and company details to get started.'
                      : 'Preencha as informações básicas para iniciar sua jornada conosco.'}
                  </p>
                </div>

                <form onSubmit={handleContinueStep1} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      {isEnglish ? 'Full Name (Account Manager / Contact) *' : 'Nome completo (responsável) *'}
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.responsible}
                        onChange={e => setFormData({ ...formData, responsible: e.target.value })}
                        placeholder={isEnglish ? 'e.g. John Doe' : 'Ex: João Silva'}
                        className={`w-full pl-10 pr-4 py-3 bg-gray-50/60 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                          step1Errors.responsible ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200 focus:border-brand-dark'
                        }`}
                      />
                    </div>
                    {step1Errors.responsible && (
                      <p className="text-xs text-red-500 font-medium mt-1">{step1Errors.responsible}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      {isEnglish ? 'Company Name *' : 'Nome da empresa *'}
                    </label>
                    <div className="relative">
                      <Building2 size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder={isEnglish ? 'e.g. Acme Corporation' : 'Ex: Minha Empresa Ltda'}
                        className={`w-full pl-10 pr-4 py-3 bg-gray-50/60 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                          step1Errors.companyName ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200 focus:border-brand-dark'
                        }`}
                      />
                    </div>
                    {step1Errors.companyName && (
                      <p className="text-xs text-red-500 font-medium mt-1">{step1Errors.companyName}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                        {isEnglish ? 'Company Website (URL) *' : 'Site da empresa (URL) *'}
                      </label>
                      <div className="relative">
                        <Globe size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                        <input
                          type="text"
                          value={formData.website}
                          onChange={e => setFormData({ ...formData, website: e.target.value })}
                          placeholder={isEnglish ? 'https://mycompany.com' : 'https://minhaempresa.com.br'}
                          className={`w-full pl-10 pr-4 py-3 bg-gray-50/60 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                            step1Errors.website ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200 focus:border-brand-dark'
                          }`}
                        />
                      </div>
                      {step1Errors.website && (
                        <p className="text-xs text-red-500 font-medium mt-1">{step1Errors.website}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                        {isEnglish ? 'Phone / WhatsApp *' : 'WhatsApp / Telefone *'}
                      </label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                        <input
                          type="text"
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                          placeholder={isEnglish ? '+1 (555) 000-0000' : '(11) 98765-4321'}
                          className={`w-full pl-10 pr-4 py-3 bg-gray-50/60 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                            step1Errors.phone ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200 focus:border-brand-dark'
                          }`}
                        />
                      </div>
                      {step1Errors.phone && (
                        <p className="text-xs text-red-500 font-medium mt-1">{step1Errors.phone}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      {isEnglish ? 'Email Address *' : 'E-mail corporativo *'}
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder={isEnglish ? 'contact@mycompany.com' : 'contato@minhaempresa.com.br'}
                        className={`w-full pl-10 pr-4 py-3 bg-gray-50/60 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                          step1Errors.email ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200 focus:border-brand-dark'
                        }`}
                      />
                    </div>
                    {step1Errors.email && (
                      <p className="text-xs text-red-500 font-medium mt-1">{step1Errors.email}</p>
                    )}
                  </div>

                  {/* Social Media & Online Presence (optional) */}
                  <div className="pt-4 mt-4 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                      {isEnglish ? 'Social Media & Online Presence (optional)' : 'Redes Sociais & Presença Online (opcional)'}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                          Instagram URL
                        </label>
                        <input
                          type="text"
                          value={formData.instagram_url}
                          onChange={e => setFormData({ ...formData, instagram_url: e.target.value })}
                          placeholder="https://instagram.com/yourhandle"
                          className="w-full px-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                          LinkedIn URL
                        </label>
                        <input
                          type="text"
                          value={formData.linkedin_url}
                          onChange={e => setFormData({ ...formData, linkedin_url: e.target.value })}
                          placeholder="https://linkedin.com/company/yourcompany"
                          className="w-full px-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                          TikTok URL
                        </label>
                        <input
                          type="text"
                          value={formData.tiktok_url}
                          onChange={e => setFormData({ ...formData, tiktok_url: e.target.value })}
                          placeholder="https://tiktok.com/@yourhandle"
                          className="w-full px-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                          Google Business Profile
                        </label>
                        <input
                          type="text"
                          value={formData.google_business_url}
                          onChange={e => setFormData({ ...formData, google_business_url: e.target.value })}
                          placeholder="https://maps.google.com/..."
                          className="w-full px-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                      style={{ backgroundColor: brandColor }}
                    >
                      <span>{isEnglish ? 'Continue' : 'Continuar'}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* ETAPA 2: Contrato */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <FileText size={13} />
                    {isEnglish ? 'Step 2 of 4' : 'Etapa 2 de 4'}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {isEnglish ? 'Service Agreement' : 'Termos de Prestação de Serviços'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {isEnglish
                      ? 'Please review the standard terms of service for Paid Media Management.'
                      : 'Exibição dos termos contratuais para prestação de serviços de tráfego pago.'}
                  </p>
                </div>

                {/* Box de texto em scroll */}
                <div className="p-5 bg-gray-50/70 border border-gray-200 rounded-2xl h-64 overflow-y-auto text-xs text-gray-600 leading-relaxed space-y-4 mb-6 scrollbar-thin">
                  {isEnglish ? (
                    <>
                      <h4 className="font-bold text-gray-900 uppercase tracking-wide">
                        DIGITAL MARKETING & PAID TRAFFIC MANAGEMENT AGREEMENT
                      </h4>
                      <p>
                        This Service Agreement is entered into between <strong>{formData.companyName}</strong> (the "Client") and{' '}
                        <strong>{agency.name}</strong> (the "Agency").
                      </p>
                      <h5 className="font-bold text-gray-800 uppercase text-[11px]">1. Scope of Services</h5>
                      <p>
                        The Agency will provide professional digital advertising management services, specifically targeting paid media acquisition through platforms such as Meta Ads (Facebook & Instagram) and Google Ads. Services encompass campaign architecture, audience segmentation, keyword & creative research, bid management, performance optimization, and regular conversion reporting.
                      </p>
                      <h5 className="font-bold text-gray-800 uppercase text-[11px]">2. Responsibilities of the Client</h5>
                      <p>
                        The Client agrees to grant necessary administrative access to ad managers, business managers, analytics tools, and conversion pixels. All direct media ad spend is paid directly by the Client to the ad networks (Meta/Google).
                      </p>
                      <h5 className="font-bold text-gray-800 uppercase text-[11px]">3. Confidentiality & Intellectual Property</h5>
                      <p>
                        Both parties agree to protect and maintain strictly confidential all proprietary business information, strategy frameworks, trade secrets, and internal data exchanged during the engagement.
                      </p>
                      <h5 className="font-bold text-gray-800 uppercase text-[11px]">4. Term & Termination</h5>
                      <p>
                        Services commence upon completion of technical onboarding and account verification. Either party may terminate or modify this agreement according to standard notice terms agreed upon between the parties.
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="font-bold text-gray-900 uppercase tracking-wide">
                        CONTRATO PADRÃO DE PRESTAÇÃO DE SERVIÇOS DE GESTÃO DE TRÁFEGO PAGO
                      </h4>
                      <p>
                        Pelo presente instrumento particular, de um lado <strong>{formData.companyName}</strong> (doravante denominada "CONTRATANTE"), representada por <strong>{formData.responsible}</strong>, e de outro lado <strong>{agency.name}</strong> (doravante denominada "CONTRATADA"):
                      </p>
                      <h5 className="font-bold text-gray-800 uppercase text-[11px]">CLÁUSULA 1ª — DO OBJETO</h5>
                      <p>
                        O presente contrato tem por objeto a prestação de serviços especializados de gestão, planejamento, execução e otimização de campanhas de tráfego pago nas principais plataformas de mídia digital (Meta Ads — Facebook e Instagram, e Google Ads).
                      </p>
                      <h5 className="font-bold text-gray-800 uppercase text-[11px]">CLÁUSULA 2ª — DAS OBRIGAÇÕES DA CONTRATADA</h5>
                      <p>
                        A CONTRATADA compromete-se a: (a) planejar e configurar as campanhas de tráfego pago com base no briefing técnico; (b) realizar acompanhamento periódico das métricas de desempenho; (c) otimizar lances, públicos e anúncios para maximizar o retorno dos investimentos.
                      </p>
                      <h5 className="font-bold text-gray-800 uppercase text-[11px]">CLÁUSULA 3ª — DAS OBRIGAÇÕES DA CONTRATANTE</h5>
                      <p>
                        A CONTRATANTE compromete-se a: (a) conceder os acessos necessários aos gerenciadores de anúncios e ativos digitais; (b) arcar integralmente com os valores de investimento direto nas plataformas de mídia (Meta/Google); (c) aprovar peças e direcionamentos em tempo hábil.
                      </p>
                      <h5 className="font-bold text-gray-800 uppercase text-[11px]">CLÁUSULA 4ª — CONFIDENCIALIDADE E SIGILO</h5>
                      <p>
                        As partes obrigam-se a manter em absoluto sigilo todas as informações comerciais, estratégicas e financeiras compartilhadas em decorrência deste contrato.
                      </p>
                    </>
                  )}
                </div>

                {/* Checkbox de aceite */}
                <div className="mb-8">
                  <label className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-100/60 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={contractAccepted}
                      onChange={e => setContractAccepted(e.target.checked)}
                      className="mt-0.5 w-5 h-5 rounded text-brand-dark focus:ring-brand-dark border-gray-300 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-gray-800 leading-snug">
                      {isEnglish
                        ? 'I have read and agree to the terms of service'
                        : 'Li e aceito os termos de prestação de serviços'}
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={submittingStep2}
                    className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-600 hover:text-gray-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    <ArrowLeft size={16} />
                    <span>{isEnglish ? 'Back' : 'Voltar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAcceptContract}
                    disabled={!contractAccepted || submittingStep2}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 cursor-pointer"
                    style={{ backgroundColor: brandColor }}
                  >
                    {submittingStep2 ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>{isEnglish ? 'Processing...' : 'Processando...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{isEnglish ? 'Accept & Continue' : 'Aceitar e continuar'}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ETAPA 3: Briefing */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <Sparkles size={13} />
                    {isEnglish ? 'Step 3 of 4' : 'Etapa 3 de 4'}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {isEnglish ? 'Campaign Briefing' : 'Briefing da Campanha'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {isEnglish
                      ? 'Tell us about your business goals and audience so we can plan the right strategy.'
                      : 'Conte-nos sobre seus objetivos para que possamos estruturar campanhas precisas.'}
                  </p>
                </div>

                <form onSubmit={handleSaveBriefing} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                        {isEnglish ? 'Niche / Industry *' : 'Nicho / segmento do negócio *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={briefingData.niche}
                        onChange={e => setBriefingData({ ...briefingData, niche: e.target.value })}
                        placeholder={isEnglish ? 'e.g. Healthcare, E-commerce, Real Estate' : 'Ex: Odontologia, E-commerce, Imóveis'}
                        className="w-full px-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                        {isEnglish ? 'Main Campaign Objective *' : 'Objetivo principal da campanha *'}
                      </label>
                      <select
                        value={briefingData.objective}
                        onChange={e => setBriefingData({ ...briefingData, objective: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all cursor-pointer"
                      >
                        {isEnglish ? (
                          <>
                            <option value="Lead Generation">Lead Generation</option>
                            <option value="Online Sales">Online Sales / E-commerce</option>
                            <option value="Brand Awareness">Brand Awareness</option>
                            <option value="Other">Other</option>
                          </>
                        ) : (
                          <>
                            <option value="Geração de Leads">Geração de Leads</option>
                            <option value="Vendas Online">Vendas Online</option>
                            <option value="Reconhecimento de Marca">Reconhecimento de Marca</option>
                            <option value="Outro">Outro</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      TARGET AGE RANGE
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {AGE_RANGE_OPTIONS.map(range => {
                        const isSelected = briefingData.targetAgeRanges.includes(range);
                        return (
                          <label
                            key={range}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-all select-none ${
                              isSelected
                                ? 'bg-slate-900/5 border-slate-800 text-gray-900 shadow-2xs'
                                : 'bg-gray-50/60 border-gray-200 text-gray-700 hover:bg-gray-100/60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAgeRange(range)}
                              className="w-4 h-4 rounded border-gray-300 text-brand-dark focus:ring-brand-dark cursor-pointer"
                            />
                            <span>{range}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      TARGET LOCATION
                    </label>
                    <input
                      type="text"
                      value={briefingData.targetLocation}
                      onChange={e => setBriefingData({ ...briefingData, targetLocation: e.target.value })}
                      placeholder="e.g. Miami, FL / United States / Southeast USA"
                      className="w-full px-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      TARGET INTERESTS
                    </label>
                    <input
                      type="text"
                      value={briefingData.targetInterests}
                      onChange={e => setBriefingData({ ...briefingData, targetInterests: e.target.value })}
                      placeholder="e.g. Fitness, healthy eating, active lifestyle"
                      className="w-full px-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      {isEnglish ? 'Main Competitors' : 'Principais concorrentes'}
                    </label>
                    <input
                      type="text"
                      value={briefingData.competitors}
                      onChange={e => setBriefingData({ ...briefingData, competitors: e.target.value })}
                      placeholder={isEnglish ? 'List your top 2-3 competitors or references' : 'Cite 2 ou 3 principais concorrentes ou referências de mercado'}
                      className="w-full px-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      {isEnglish ? 'Company Differentiators' : 'Diferencial da empresa'}
                    </label>
                    <input
                      type="text"
                      value={briefingData.differentiator}
                      onChange={e => setBriefingData({ ...briefingData, differentiator: e.target.value })}
                      placeholder={isEnglish ? 'What makes your company unique or better?' : 'O que faz sua empresa se destacar da concorrência?'}
                      className="w-full px-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      {isEnglish ? 'Additional Notes / Requests' : 'Observações adicionais'}
                    </label>
                    <textarea
                      rows={3}
                      value={briefingData.notes}
                      onChange={e => setBriefingData({ ...briefingData, notes: e.target.value })}
                      placeholder={isEnglish ? 'Any extra details, past advertising experiences, or guidelines...' : 'Detalhes adicionais, histórico de campanhas anteriores ou dúvidas...'}
                      className="w-full px-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all resize-none"
                    />
                  </div>

                  <div className="pt-4 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={submittingStep3}
                      className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-600 hover:text-gray-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      <ArrowLeft size={16} />
                      <span>{isEnglish ? 'Back' : 'Voltar'}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={submittingStep3}
                      className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 hover:-translate-y-0.5 cursor-pointer"
                      style={{ backgroundColor: brandColor }}
                    >
                      {submittingStep3 ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>{isEnglish ? 'Saving...' : 'Salvando...'}</span>
                        </>
                      ) : (
                        <>
                          <span>{isEnglish ? 'Continue' : 'Continuar'}</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* ETAPA 4: Criar chave de acesso */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <KeyRound size={13} />
                    {isEnglish ? 'Step 4 of 4' : 'Etapa 4 de 4'}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {isEnglish ? 'Create Your Access Key' : 'Criar Chave de Acesso'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {isEnglish
                      ? 'Create a secure key to access your client portal once activated.'
                      : 'Defina sua chave de acesso para consultar seu portal de cliente.'}
                  </p>
                </div>

                <form onSubmit={handleFinishRegistration} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      {isEnglish ? 'Create your access key *' : 'Crie sua chave de acesso *'}
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={accessKey}
                        onChange={e => setAccessKey(e.target.value)}
                        placeholder={isEnglish ? 'Minimum 6 characters' : 'Mínimo 6 caracteres'}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {isEnglish ? 'Minimum 6 characters.' : 'Mínimo de 6 caracteres.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      {isEnglish ? 'Confirm your access key *' : 'Confirme sua chave de acesso *'}
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={confirmKey}
                        onChange={e => setConfirmKey(e.target.value)}
                        placeholder={isEnglish ? 'Repeat your access key' : 'Repita a chave de acesso'}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {keyError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600 font-medium">
                      <AlertCircle size={15} className="flex-shrink-0" />
                      <span>{keyError}</span>
                    </div>
                  )}

                  <div className="pt-4 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={submittingStep4}
                      className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-600 hover:text-gray-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      <ArrowLeft size={16} />
                      <span>{isEnglish ? 'Back' : 'Voltar'}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={submittingStep4}
                      className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 hover:-translate-y-0.5 cursor-pointer"
                      style={{ backgroundColor: brandColor }}
                    >
                      {submittingStep4 ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>{isEnglish ? 'Finalizing...' : 'Finalizando...'}</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={16} />
                          <span>{isEnglish ? 'Finish Registration' : 'Finalizar cadastro'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* ETAPA 5: Tela de Confirmação */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-6"
              >
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-emerald-500/20"
                  style={{ backgroundColor: '#10b981' }}
                >
                  <CheckCircle2 size={44} />
                </div>

                <span className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full mb-3">
                  {isEnglish ? 'Registration Completed' : 'Cadastro Realizado com Sucesso'}
                </span>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
                  {isEnglish
                    ? 'Registration completed!'
                    : 'Cadastro concluído!'}
                </h2>

                <p className="text-base text-gray-600 max-w-lg mx-auto leading-relaxed mb-8">
                  {isEnglish
                    ? 'Registration completed! Our team will contact you shortly to begin your campaign.'
                    : 'Cadastro concluído! Em breve nossa equipe entrará em contato para dar início à sua campanha.'}
                </p>

                <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-5 text-left max-w-md mx-auto space-y-2.5 text-xs">
                  <div className="flex justify-between pb-2 border-b border-gray-200/60">
                    <span className="text-gray-400 font-semibold">{isEnglish ? 'Company' : 'Empresa'}:</span>
                    <span className="font-bold text-gray-800">{formData.companyName}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-gray-200/60">
                    <span className="text-gray-400 font-semibold">{isEnglish ? 'Responsible' : 'Responsável'}:</span>
                    <span className="font-bold text-gray-800">{formData.responsible}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-gray-200/60">
                    <span className="text-gray-400 font-semibold">{isEnglish ? 'Email' : 'E-mail'}:</span>
                    <span className="font-bold text-gray-800">{formData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-semibold">{isEnglish ? 'Agency' : 'Agência'}:</span>
                    <span className="font-bold text-gray-800">{agency.name}</span>
                  </div>
                </div>

                <div className="mt-8 text-xs text-gray-400">
                  {isEnglish
                    ? 'You may now close this page. No further action is required from you at this time.'
                    : 'Você já pode fechar esta página. Sua conta passará pela ativação interna de nossa equipe.'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-6 text-center text-xs text-gray-400">
        <p>&copy; {new Date().getFullYear()} {agency.name} &bull; Powered by Bolsa</p>
      </footer>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { callFunction } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, FileText, Target, KeyRound, CheckCircle2, ArrowRight, ArrowLeft, AlertCircle, Loader2,
  Check, Copy, LifeBuoy, Clock, Sparkles, ExternalLink, Megaphone, Search,
} from 'lucide-react';

interface PublicClientOnboardingProps { agencySlug: string | null }

interface AgencyData {
  id: number; name: string; slug: string; logo_url: string | null; primary_color: string | null; access_email: string | null;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type Platform = 'meta' | 'google';
type AccessChoice = { situation: 'has_account' | 'needs_account' | null; status: 'pending' | 'client_done' | 'help' | 'agency_creating'; account_ref: string };

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

const emptyAccess = (): AccessChoice => ({ situation: null, status: 'pending', account_ref: '' });

const fieldCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400 transition';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5';

export const PublicClientOnboarding: React.FC<PublicClientOnboardingProps> = ({ agencySlug }) => {
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState<AgencyData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null;
  const storageKey = `bolsa-cadastro-${(agencySlug || '').toLowerCase()}`;

  const [clientId, setClientId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [company, setCompany] = useState({
    responsible: '', companyName: '', website: '', phone: '', email: '', instagram_url: '', google_business_url: '',
  });
  const [business, setBusiness] = useState({
    offer: '', ticket: '', objective: '', region: '', audience: '', ageRanges: [] as string[],
    differentiator: '', competitors: '', budget: '', advertisedBefore: '', history: '', salesChannel: '', notes: '',
  });
  const [access, setAccess] = useState<Record<Platform, AccessChoice>>({ meta: emptyAccess(), google: emptyAccess() });
  const [contractAccepted, setContractAccepted] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  const en = agency?.id === 7;
  const t = (pt: string, eng: string) => (en ? eng : pt);
  const brand = agency?.primary_color || (en ? '#1A3A5C' : '#456da1');
  const accessEmail = agency?.access_email || 'contato@cangurudigital.com.br';

  // Carrega agência
  useEffect(() => {
    (async () => {
      const slug = (agencySlug || '').trim().toLowerCase();
      if (!slug) { setNotFound(true); setLoading(false); return; }
      const { data, error: err } = await callFunction<{ agency: AgencyData }>('public-onboarding', { action: 'agency', agency_slug: slug });
      if (err || !data?.agency) setNotFound(true); else setAgency(data.agency);
      setLoading(false);
    })();
  }, [agencySlug]);

  // Retoma cadastro salvo neste aparelho
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.clientId && s.token) {
        setClientId(s.clientId); setToken(s.token);
        if (s.company) setCompany(s.company);
        if (s.business) setBusiness(s.business);
        if (s.access) setAccess(s.access);
        if (s.step && s.step < 6) setStep(s.step);
      }
    } catch { /* sem armazenamento: começa do zero */ }
  }, [storageKey]);

  const persist = (patch: Record<string, unknown>) => {
    try {
      const prev = JSON.parse(localStorage.getItem(storageKey) || '{}');
      localStorage.setItem(storageKey, JSON.stringify({ ...prev, ...patch }));
    } catch { /* ignora */ }
  };
  const clearPersist = () => { try { localStorage.removeItem(storageKey); } catch { /* ignora */ } };

  const go = (s: Step) => { setError(''); setStep(s); persist({ step: s }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // ---------- Passo 1: dados ----------
  const submitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.responsible.trim() || !company.companyName.trim() || !company.phone.trim()) {
      setError(t('Preencha nome, empresa e WhatsApp.', 'Please fill in name, company and phone.')); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email.trim())) { setError(t('Informe um e-mail válido.', 'Please enter a valid email.')); return; }
    setBusy(true);
    if (clientId && token) {
      const { error: err } = await callFunction('public-onboarding', { action: 'update', client_id: clientId, token, step: 1, company });
      setBusy(false);
      if (err) { setError(err); return; }
    } else {
      const { data, error: err } = await callFunction<{ client_id: string; token: string }>('public-onboarding', {
        action: 'start', agency_slug: agency?.slug, ref: refCode, data: company,
      });
      setBusy(false);
      if (err || !data) { setError(t('Não foi possível salvar. Tente novamente.', 'Could not save. Please try again.')); return; }
      setClientId(data.client_id); setToken(data.token);
      persist({ clientId: data.client_id, token: data.token });
    }
    persist({ company });
    go(2);
  };

  // ---------- Passo 2: negócio ----------
  const submitBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business.offer.trim() || !business.objective || !business.region.trim()) {
      setError(t('Conte o que você vende, o objetivo e onde estão seus clientes.', 'Tell us what you sell, your goal and where your customers are.')); return;
    }
    setBusy(true);
    const { error: err } = await callFunction('public-onboarding', { action: 'update', client_id: clientId, token, step: 2, business });
    setBusy(false);
    if (err) { setError(err); return; }
    persist({ business });
    go(3);
  };

  // ---------- Passo 3: acessos ----------
  const setPlat = (p: Platform, patch: Partial<AccessChoice>) => setAccess(a => ({ ...a, [p]: { ...a[p], ...patch } }));
  const submitAccess = async () => {
    setBusy(true);
    const { error: err } = await callFunction('public-onboarding', { action: 'update', client_id: clientId, token, step: 3, access });
    setBusy(false);
    if (err) { setError(err); return; }
    persist({ access });
    go(4);
  };

  // ---------- Passo 4: contrato ----------
  const submitContract = async () => {
    setBusy(true);
    const { error: err } = await callFunction('public-onboarding', { action: 'update', client_id: clientId, token, step: 4, contract_accepted: true });
    setBusy(false);
    if (err) { setError(err); return; }
    go(5);
  };

  // ---------- Passo 5: senha ----------
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError(t('A senha precisa ter pelo menos 8 caracteres.', 'Password must be at least 8 characters.')); return; }
    if (password !== password2) { setError(t('As senhas não coincidem.', 'Passwords do not match.')); return; }
    setBusy(true);
    const { error: err } = await callFunction('public-onboarding', { action: 'finish', client_id: clientId, token, password });
    setBusy(false);
    if (err) { setError(err); return; }
    clearPersist();
    setStep(6);
  };

  const steps = useMemo(() => [
    { n: 1, label: t('Dados', 'Company') },
    { n: 2, label: t('Negócio', 'Business') },
    { n: 3, label: t('Acessos', 'Access') },
    { n: 4, label: t('Contrato', 'Agreement') },
    { n: 5, label: t('Senha', 'Password') },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [en]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (notFound || !agency) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center">
          <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4"><AlertCircle size={28} /></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h2>
          <p className="text-sm text-gray-500">Não encontramos este link de cadastro. Peça um novo link para a sua agência.</p>
        </div>
      </div>
    );
  }

  const PrimaryBtn: React.FC<{ children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean }> = ({ children, onClick, type = 'button', disabled }) => (
    <button
      type={type} onClick={onClick} disabled={busy || disabled}
      className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition"
      style={{ backgroundColor: brand }}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
  const BackBtn: React.FC<{ to: Step }> = ({ to }) => (
    <button type="button" onClick={() => go(to)} disabled={busy}
      className="inline-flex items-center gap-2 px-5 py-3 border border-gray-200 text-gray-600 hover:text-gray-900 rounded-xl text-sm font-medium transition">
      <ArrowLeft size={16} /> {t('Voltar', 'Back')}
    </button>
  );
  const Header: React.FC<{ icon: React.ReactNode; title: string; sub: string }> = ({ icon, title, sub }) => (
    <div className="mb-6">
      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-gray-500 text-[11px] font-semibold mb-2">
        {icon} {t(`Etapa ${step} de 5`, `Step ${step} of 5`)}
      </div>
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
      <p className="text-sm text-gray-500 mt-1">{sub}</p>
    </div>
  );
  const ErrorBox = () => error ? (
    <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>
  ) : null;

  const copyEmail = () => { navigator.clipboard?.writeText(accessEmail).catch(() => {}); };

  const platformInfo: Record<Platform, { name: string; icon: React.ReactNode; link: string; stepsHas: string[]; refLabel: string; refPlaceholder: string }> = {
    meta: {
      name: 'Meta (Facebook e Instagram)',
      icon: <Megaphone size={18} />,
      link: 'https://business.facebook.com/settings/people',
      stepsHas: [
        t('Abra o Meta Business Suite pelo botão abaixo (Configurações do negócio > Pessoas).', 'Open Meta Business Suite with the button below (Business settings > People).'),
        t('Clique em "Convidar pessoas" e cole o e-mail da agência.', 'Click "Invite people" and paste the agency email.'),
        t('Em "Ativos", marque a conta de anúncios, a Página e o Instagram, com controle total.', 'Under "Assets", select the ad account, Page and Instagram, with full control.'),
        t('Envie o convite. Pronto!', 'Send the invite. Done!'),
      ],
      refLabel: t('ID da conta de anúncios (opcional)', 'Ad account ID (optional)'),
      refPlaceholder: 'act_123456789',
    },
    google: {
      name: 'Google Ads',
      icon: <Search size={18} />,
      link: 'https://ads.google.com/aw/accountaccess/users',
      stepsHas: [
        t('Abra o Google Ads pelo botão abaixo (Administrador > Acesso e segurança).', 'Open Google Ads with the button below (Admin > Access and security).'),
        t('Clique no botão "+" e cole o e-mail da agência.', 'Click the "+" button and paste the agency email.'),
        t('Escolha o nível de acesso "Administrador".', 'Choose the "Admin" access level.'),
        t('Envie o convite. Pronto!', 'Send the invite. Done!'),
      ],
      refLabel: t('ID da conta (opcional)', 'Customer ID (optional)'),
      refPlaceholder: '123-456-7890',
    },
  };

  const renderAccessCard = (p: Platform) => {
    const info = platformInfo[p];
    const a = access[p];
    return (
      <div key={p} className="rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: brand }}>{info.icon}</span>
          <h3 className="font-semibold text-gray-900">{info.name}</h3>
          {a.status === 'client_done' && <span className="ml-auto text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">{t('Acesso enviado', 'Access sent')}</span>}
          {a.status === 'agency_creating' && <span className="ml-auto text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-1 rounded-full">{t('Nós criamos', 'We will create it')}</span>}
          {a.status === 'help' && <span className="ml-auto text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">{t('Vamos te ajudar', "We'll help you")}</span>}
        </div>

        <p className="text-sm text-gray-700 mb-2">{t('Você já tem uma conta de anúncios?', 'Do you already have an ad account?')}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button type="button" onClick={() => setPlat(p, { situation: 'has_account', status: a.status === 'agency_creating' ? 'pending' : a.status })}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition ${a.situation === 'has_account' ? 'text-white border-transparent' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
            style={a.situation === 'has_account' ? { backgroundColor: brand } : undefined}>
            {t('Sim, já tenho', 'Yes, I do')}
          </button>
          <button type="button" onClick={() => setPlat(p, { situation: 'needs_account', status: 'agency_creating' })}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition ${a.situation === 'needs_account' ? 'text-white border-transparent' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
            style={a.situation === 'needs_account' ? { backgroundColor: brand } : undefined}>
            {t('Não tenho / não sei', "No / I'm not sure")}
          </button>
        </div>

        {a.situation === 'needs_account' && (
          <div className="p-4 rounded-xl bg-sky-50 text-sky-900 text-sm">
            {t('Sem problema. Nós criamos e configuramos a conta para você e combinamos os detalhes na conversa de início.', "No problem. We'll create and set up the account for you and go over the details in our kickoff call.")}
          </div>
        )}

        {a.situation === 'has_account' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs text-gray-500">{t('E-mail da agência', 'Agency email')}</span>
              <span className="font-mono text-sm text-gray-900 truncate">{accessEmail}</span>
              <button type="button" onClick={copyEmail} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"><Copy size={14} />{t('Copiar', 'Copy')}</button>
            </div>
            <ol className="space-y-2">
              {info.stepsHas.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            <a href={info.link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 hover:border-gray-300">
              {t('Abrir', 'Open')} {p === 'meta' ? 'Meta Business' : 'Google Ads'} <ExternalLink size={14} />
            </a>
            <div>
              <label className={labelCls}>{info.refLabel}</label>
              <input className={fieldCls} value={a.account_ref} placeholder={info.refPlaceholder}
                onChange={e => setPlat(p, { account_ref: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              {([
                ['client_done', t('Já enviei o convite', 'I sent the invite'), <Check size={15} key="i" />],
                ['pending', t('Faço depois', "I'll do it later"), <Clock size={15} key="i" />],
                ['help', t('Preciso de ajuda', 'I need help'), <LifeBuoy size={15} key="i" />],
              ] as const).map(([val, label, icon]) => (
                <button key={val} type="button" onClick={() => setPlat(p, { status: val })}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${a.status === val ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const objectives = [
    t('Receber contatos no WhatsApp', 'Get leads on WhatsApp'),
    t('Vender pelo site', 'Sell on my website'),
    t('Agendamentos / orçamentos', 'Bookings / quotes'),
    t('Visitas à loja física', 'Store visits'),
    t('Fortalecer a marca', 'Brand awareness'),
  ];
  const budgets = en
    ? ['Up to $500/mo', '$500 to $1,500/mo', '$1,500 to $5,000/mo', 'Over $5,000/mo', 'Not sure yet']
    : ['Até R$ 1.000/mês', 'R$ 1.000 a R$ 3.000/mês', 'R$ 3.000 a R$ 10.000/mês', 'Acima de R$ 10.000/mês', 'Ainda não sei'];

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-gray-800 font-sans flex flex-col">
      <header className="w-full max-w-3xl mx-auto pt-8 px-4 sm:px-6 pb-2 flex items-center gap-3">
        {agency.logo_url && !logoError ? (
          <img src={agency.logo_url} alt={agency.name} className="h-10 w-auto object-contain" onError={() => setLogoError(true)} />
        ) : (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: brand }}>{agency.name.slice(0, 2).toUpperCase()}</div>
        )}
        <div>
          <p className="font-bold text-gray-900 leading-tight">{agency.name}</p>
          <p className="text-xs text-gray-500">{t('Cadastro de cliente', 'Client onboarding')}</p>
        </div>
      </header>

      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 flex-1">
        {step < 6 && (
          <ol className="mb-6 grid grid-cols-5 gap-1.5">
            {steps.map(s => (
              <li key={s.n} className="flex flex-col gap-1.5">
                <span className="h-1.5 rounded-full transition-colors" style={{ backgroundColor: step >= s.n ? brand : '#E5E7EB' }} />
                <span className={`text-[11px] font-semibold ${step === s.n ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="bg-white rounded-3xl p-5 sm:p-9 border border-black/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>

              {step === 1 && (
                <form onSubmit={submitCompany}>
                  <Header icon={<Building2 size={13} />} title={t('Sobre você e a empresa', 'About you and your company')}
                    sub={t('Leva menos de um minuto. Seus dados ficam salvos a cada etapa.', 'Takes less than a minute. Your progress is saved at every step.')} />
                  <ErrorBox />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><label className={labelCls}>{t('Seu nome completo *', 'Full name *')}</label><input className={fieldCls} value={company.responsible} onChange={e => setCompany({ ...company, responsible: e.target.value })} /></div>
                    <div><label className={labelCls}>{t('Nome da empresa *', 'Company name *')}</label><input className={fieldCls} value={company.companyName} onChange={e => setCompany({ ...company, companyName: e.target.value })} /></div>
                    <div><label className={labelCls}>{t('E-mail *', 'Email *')}</label><input type="email" className={fieldCls} value={company.email} onChange={e => setCompany({ ...company, email: e.target.value })} /></div>
                    <div><label className={labelCls}>{t('WhatsApp *', 'Phone / WhatsApp *')}</label><input className={fieldCls} value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} /></div>
                    <div><label className={labelCls}>{t('Site (se tiver)', 'Website (if any)')}</label><input className={fieldCls} value={company.website} placeholder="www.suaempresa.com" onChange={e => setCompany({ ...company, website: e.target.value })} /></div>
                    <div><label className={labelCls}>Instagram</label><input className={fieldCls} value={company.instagram_url} placeholder="@suaempresa" onChange={e => setCompany({ ...company, instagram_url: e.target.value })} /></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">{t('Com este e-mail você vai entrar no seu portal.', "You'll use this email to sign in to your portal.")}</p>
                  <div className="mt-8 flex justify-end"><PrimaryBtn type="submit">{t('Continuar', 'Continue')} <ArrowRight size={16} /></PrimaryBtn></div>
                </form>
              )}

              {step === 2 && (
                <form onSubmit={submitBusiness}>
                  <Header icon={<Target size={13} />} title={t('Seu negócio', 'Your business')}
                    sub={t('É daqui que sai a sua estratégia de anúncios. Quanto mais detalhe, melhor.', 'This is what your ad strategy is built on. The more detail, the better.')} />
                  <ErrorBox />
                  <div className="space-y-4">
                    <div><label className={labelCls}>{t('O que você vende? Qual o produto ou serviço principal? *', 'What do you sell? Main product or service? *')}</label>
                      <textarea rows={3} className={fieldCls} value={business.offer} onChange={e => setBusiness({ ...business, offer: e.target.value })} /></div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div><label className={labelCls}>{t('Ticket médio (valor de uma venda)', 'Average sale value')}</label>
                        <input className={fieldCls} value={business.ticket} placeholder={t('Ex.: R$ 450', 'e.g. $450')} onChange={e => setBusiness({ ...business, ticket: e.target.value })} /></div>
                      <div><label className={labelCls}>{t('Onde estão seus clientes? *', 'Where are your customers? *')}</label>
                        <input className={fieldCls} value={business.region} placeholder={t('Cidade, região ou país', 'City, region or country')} onChange={e => setBusiness({ ...business, region: e.target.value })} /></div>
                    </div>
                    <div>
                      <label className={labelCls}>{t('Principal objetivo com os anúncios *', 'Main goal with ads *')}</label>
                      <div className="flex flex-wrap gap-2">
                        {objectives.map(o => (
                          <button key={o} type="button" onClick={() => setBusiness({ ...business, objective: o })}
                            className={`px-3.5 py-2 rounded-full border text-sm transition ${business.objective === o ? 'text-white border-transparent' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                            style={business.objective === o ? { backgroundColor: brand } : undefined}>{o}</button>
                        ))}
                      </div>
                    </div>
                    <div><label className={labelCls}>{t('Quem é o seu cliente ideal?', 'Who is your ideal customer?')}</label>
                      <textarea rows={2} className={fieldCls} value={business.audience} placeholder={t('Ex.: mulheres que moram na zona sul, que já compraram...', 'e.g. women living downtown who...')} onChange={e => setBusiness({ ...business, audience: e.target.value })} /></div>
                    <div>
                      <label className={labelCls}>{t('Faixa de idade', 'Age range')}</label>
                      <div className="flex flex-wrap gap-2">
                        {AGE_RANGES.map(r => {
                          const on = business.ageRanges.includes(r);
                          return (
                            <button key={r} type="button"
                              onClick={() => setBusiness({ ...business, ageRanges: on ? business.ageRanges.filter(x => x !== r) : [...business.ageRanges, r] })}
                              className={`px-3 py-1.5 rounded-full border text-sm transition ${on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700'}`}>{r}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div><label className={labelCls}>{t('Seu diferencial', 'What makes you different')}</label>
                        <textarea rows={2} className={fieldCls} value={business.differentiator} onChange={e => setBusiness({ ...business, differentiator: e.target.value })} /></div>
                      <div><label className={labelCls}>{t('Concorrentes que você observa', 'Competitors you watch')}</label>
                        <textarea rows={2} className={fieldCls} value={business.competitors} onChange={e => setBusiness({ ...business, competitors: e.target.value })} /></div>
                    </div>
                    <div>
                      <label className={labelCls}>{t('Quanto pretende investir por mês em anúncios? (pago direto às plataformas)', 'Monthly ad budget? (paid directly to the platforms)')}</label>
                      <select className={`${fieldCls} bolsa-select`} value={business.budget} onChange={e => setBusiness({ ...business, budget: e.target.value })}>
                        <option value="">{t('Selecione', 'Select')}</option>
                        {budgets.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>{t('Já anunciou antes?', 'Have you run ads before?')}</label>
                        <select className={`${fieldCls} bolsa-select`} value={business.advertisedBefore} onChange={e => setBusiness({ ...business, advertisedBefore: e.target.value })}>
                          <option value="">{t('Selecione', 'Select')}</option>
                          <option value={t('Nunca', 'Never')}>{t('Nunca', 'Never')}</option>
                          <option value={t('Sim, por conta própria', 'Yes, on my own')}>{t('Sim, por conta própria', 'Yes, on my own')}</option>
                          <option value={t('Sim, com agência ou gestor', 'Yes, with an agency')}>{t('Sim, com agência ou gestor', 'Yes, with an agency')}</option>
                        </select>
                      </div>
                      <div><label className={labelCls}>{t('Como o cliente compra de você?', 'How do customers buy from you?')}</label>
                        <input className={fieldCls} value={business.salesChannel} placeholder={t('WhatsApp, site, loja, telefone...', 'WhatsApp, website, store, phone...')} onChange={e => setBusiness({ ...business, salesChannel: e.target.value })} /></div>
                    </div>
                    {business.advertisedBefore && business.advertisedBefore !== t('Nunca', 'Never') && (
                      <div><label className={labelCls}>{t('O que funcionou e o que não funcionou?', "What worked and what didn't?")}</label>
                        <textarea rows={2} className={fieldCls} value={business.history} onChange={e => setBusiness({ ...business, history: e.target.value })} /></div>
                    )}
                    <div><label className={labelCls}>{t('Algo mais que devemos saber?', 'Anything else we should know?')}</label>
                      <textarea rows={2} className={fieldCls} value={business.notes} onChange={e => setBusiness({ ...business, notes: e.target.value })} /></div>
                  </div>
                  <div className="mt-8 flex items-center justify-between gap-3"><BackBtn to={1} /><PrimaryBtn type="submit">{t('Continuar', 'Continue')} <ArrowRight size={16} /></PrimaryBtn></div>
                </form>
              )}

              {step === 3 && (
                <div>
                  <Header icon={<KeyRound size={13} />} title={t('Acesso às contas de anúncio', 'Access to your ad accounts')}
                    sub={t('Para gerenciar seus anúncios, precisamos de acesso às contas. Você continua dono de tudo.', 'To manage your ads we need access to your accounts. You remain the owner of everything.')} />
                  <ErrorBox />
                  <div className="space-y-4">
                    {renderAccessCard('meta')}
                    {renderAccessCard('google')}
                  </div>
                  <p className="text-xs text-gray-400 mt-4">{t('Se preferir fazer depois, tudo bem: o passo a passo também fica no seu portal.', 'Prefer to do it later? No problem: the step-by-step will also be in your portal.')}</p>
                  <div className="mt-8 flex items-center justify-between gap-3"><BackBtn to={2} /><PrimaryBtn onClick={submitAccess}>{t('Continuar', 'Continue')} <ArrowRight size={16} /></PrimaryBtn></div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <Header icon={<FileText size={13} />} title={t('Termos do serviço', 'Service agreement')}
                    sub={t('Os termos gerais da gestão de tráfego. Valores e prazos seguem a proposta combinada.', 'General terms of paid media management. Prices and terms follow the agreed proposal.')} />
                  <ErrorBox />
                  <div className="p-5 bg-gray-50 border border-gray-200 rounded-2xl h-64 overflow-y-auto text-sm text-gray-600 leading-relaxed space-y-3 mb-5">
                    {en ? (
                      <>
                        <p className="font-semibold text-gray-900">Paid Media Management Agreement</p>
                        <p>Between <strong>{company.companyName}</strong> (the "Client") and <strong>{agency.name}</strong> (the "Agency").</p>
                        <p><strong>1. Scope.</strong> The Agency plans, runs and optimizes paid campaigns on Meta Ads and Google Ads, with regular performance reporting.</p>
                        <p><strong>2. Client.</strong> Grants the access needed to ad accounts and assets, pays ad spend directly to the platforms, and reviews approvals in a timely manner.</p>
                        <p><strong>3. Confidentiality.</strong> Both parties keep all business information exchanged strictly confidential.</p>
                        <p><strong>4. Term.</strong> Services start after onboarding is complete. Either party may end the agreement according to the notice terms agreed between the parties.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-gray-900">Contrato de prestação de serviços de gestão de tráfego pago</p>
                        <p>Entre <strong>{company.companyName}</strong>, representada por <strong>{company.responsible}</strong> (CONTRATANTE), e <strong>{agency.name}</strong> (CONTRATADA).</p>
                        <p><strong>1. Objeto.</strong> Planejamento, execução e otimização de campanhas de tráfego pago no Meta Ads (Facebook e Instagram) e no Google Ads, com acompanhamento periódico dos resultados.</p>
                        <p><strong>2. Da contratada.</strong> Configurar as campanhas a partir do briefing, acompanhar as métricas e otimizar públicos, lances e anúncios.</p>
                        <p><strong>3. Da contratante.</strong> Conceder os acessos necessários, pagar o investimento em mídia direto às plataformas e aprovar peças e direcionamentos em tempo hábil.</p>
                        <p><strong>4. Sigilo.</strong> As partes mantêm em sigilo as informações comerciais e estratégicas compartilhadas.</p>
                      </>
                    )}
                  </div>
                  <label className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl cursor-pointer select-none">
                    <input type="checkbox" checked={contractAccepted} onChange={e => setContractAccepted(e.target.checked)} className="mt-0.5 w-5 h-5 rounded border-gray-300" />
                    <span className="text-sm font-medium text-gray-800">{t('Li e aceito os termos do serviço', 'I have read and agree to the terms')}</span>
                  </label>
                  <div className="mt-8 flex items-center justify-between gap-3"><BackBtn to={3} /><PrimaryBtn onClick={submitContract} disabled={!contractAccepted}>{t('Aceitar e continuar', 'Accept and continue')} <ArrowRight size={16} /></PrimaryBtn></div>
                </div>
              )}

              {step === 5 && (
                <form onSubmit={submitPassword}>
                  <Header icon={<KeyRound size={13} />} title={t('Crie sua senha', 'Create your password')}
                    sub={t(`Você vai entrar no portal com ${company.email} e esta senha.`, `You'll sign in to the portal with ${company.email} and this password.`)} />
                  <ErrorBox />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><label className={labelCls}>{t('Senha (mínimo 8 caracteres)', 'Password (min. 8 characters)')}</label><input type="password" autoComplete="new-password" className={fieldCls} value={password} onChange={e => setPassword(e.target.value)} /></div>
                    <div><label className={labelCls}>{t('Repita a senha', 'Repeat password')}</label><input type="password" autoComplete="new-password" className={fieldCls} value={password2} onChange={e => setPassword2(e.target.value)} /></div>
                  </div>
                  <div className="mt-8 flex items-center justify-between gap-3"><BackBtn to={4} /><PrimaryBtn type="submit">{t('Concluir cadastro', 'Finish')} <Check size={16} /></PrimaryBtn></div>
                </form>
              )}

              {step === 6 && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-5"><CheckCircle2 size={36} /></div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('Cadastro concluído!', "You're all set!")}</h2>
                  <p className="text-gray-600 max-w-md mx-auto mb-8">{t('A partir daqui é com a gente. Veja o que acontece agora:', "From here, it's on us. Here's what happens next:")}</p>
                  <ol className="text-left max-w-md mx-auto space-y-3 mb-8">
                    {[
                      [t('Conferimos os acessos', 'We check the access'), t('Se algo faltar, avisamos e ajudamos.', "If anything is missing, we'll help.")],
                      [t('Montamos sua estratégia', 'We build your strategy'), t('Públicos, campanhas e investimento, a partir do que você contou.', 'Audiences, campaigns and budget, based on what you told us.')],
                      [t('Você aprova no portal', 'You approve it in the portal'), t('Pode aprovar ou pedir ajustes.', 'Approve or ask for changes.')],
                      [t('Campanhas no ar', 'Campaigns go live'), t('Você acompanha os resultados ao vivo no portal.', 'You follow the results live in the portal.')],
                    ].map(([title, sub], i) => (
                      <li key={i} className="flex gap-3">
                        <span className="w-7 h-7 shrink-0 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: brand }}>{i + 1}</span>
                        <div><p className="font-semibold text-gray-900 text-sm">{title}</p><p className="text-sm text-gray-500">{sub}</p></div>
                      </li>
                    ))}
                  </ol>
                  <a href="/" className="inline-flex items-center gap-2 px-7 py-3.5 text-white font-semibold text-sm rounded-xl" style={{ backgroundColor: brand }}>
                    <Sparkles size={16} /> {t('Entrar no meu portal', 'Go to my portal')}
                  </a>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">&copy; {new Date().getFullYear()} {agency.name}</footer>
    </div>
  );
};

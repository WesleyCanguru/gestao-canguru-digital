import React, { useEffect, useState } from 'react';
import { callFunction, supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, FileText, Target, KeyRound, CheckCircle2, ArrowRight, ArrowLeft, AlertCircle, Loader2,
  Check, Sparkles, MessageCircle, Globe,
} from 'lucide-react';
import { Lang, LANGS, Platform, browserLang, pickLang, tr } from '../lib/accessGuides';
import { AccessChoice, AccessGuideCard, emptyAccess } from './strategy/AccessGuideCard';

interface PublicClientOnboardingProps { agencySlug: string | null }

interface AgencyData {
  id: number; name: string; slug: string; logo_url: string | null; primary_color: string | null;
  access_email: string | null; contact_whatsapp: string | null;
}

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

const fieldCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400 transition';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5';

export const PublicClientOnboarding: React.FC<PublicClientOnboardingProps> = ({ agencySlug }) => {
  const [loading, setLoading] = useState(true);
  const [referrer, setReferrer] = useState<{ name: string | null; whatsapp: string | null } | null>(null);
  const [agency, setAgency] = useState<AgencyData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLang] = useState<Lang>(() => {
    const l = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null;
    return l === 'pt' || l === 'en' || l === 'es' ? l : browserLang();
  });

  const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const refCode = qs.get('ref');
  // Veio do botão "Quero começar" da proposta: já traz a empresa, o idioma e a proposta
  const proposalSlug = qs.get('proposta');
  const storageKey = `bolsa-cadastro-${(agencySlug || '').toLowerCase()}`;

  const [clientId, setClientId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [company, setCompany] = useState({
    responsible: '', companyName: (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('empresa')?.slice(0, 120)) || '', website: '', phone: '', email: '', instagram_url: '', google_business_url: '',
  });
  const [business, setBusiness] = useState({
    services: [] as string[],
    offer: '', ticket: '', objective: '', region: '', audience: '', ageRanges: [] as string[],
    differentiator: '', competitors: '', budget: '', advertisedBefore: '', history: '', salesChannel: '', notes: '',
  });
  const [access, setAccess] = useState<Record<Platform, AccessChoice>>({ meta: emptyAccess(), google: emptyAccess() });
  const [contractAccepted, setContractAccepted] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [entering, setEntering] = useState(false);

  const t = tr(lang);
  const brand = agency?.primary_color || '#456da1';
  const accessEmail = agency?.access_email || 'contato@cangurudigital.com.br';

  // Carrega agência
  useEffect(() => {
    (async () => {
      const slug = (agencySlug || '').trim().toLowerCase();
      if (!slug) { setNotFound(true); setLoading(false); return; }
      const ref = new URLSearchParams(window.location.search).get('ref');
      const { data, error: err } = await callFunction<{ agency: AgencyData; referrer_info?: { name: string | null; whatsapp: string | null } }>('public-onboarding', { action: 'agency', agency_slug: slug, ref });
      if (err || !data?.agency) setNotFound(true); else { setAgency(data.agency); setReferrer(data.referrer_info ?? null); }
      setLoading(false);
    })();
  }, [agencySlug]);

  // Retoma cadastro salvo neste aparelho
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.lang) setLang(pickLang(s.lang));
      if (s.clientId && s.token) {
        setClientId(s.clientId); setToken(s.token);
        if (s.company) setCompany(s.company);
        if (s.business) setBusiness(b => ({ ...b, ...s.business }));
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

  const chooseLang = (l: Lang) => { setLang(l); persist({ lang: l }); };

  // ---------- Passo 1: dados ----------
  const submitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.responsible.trim() || !company.companyName.trim() || !company.phone.trim()) {
      setError(t('Preencha nome, empresa e WhatsApp.', 'Please fill in name, company and phone.', 'Completa nombre, empresa y WhatsApp.')); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email.trim())) {
      setError(t('Informe um e-mail válido.', 'Please enter a valid email.', 'Ingresa un correo válido.')); return;
    }
    setBusy(true);
    if (clientId && token) {
      const { error: err } = await callFunction('public-onboarding', { action: 'update', client_id: clientId, token, step: 1, company, lang });
      setBusy(false);
      if (err) { setError(err); return; }
    } else {
      const { data, error: err } = await callFunction<{ client_id: string; token: string }>('public-onboarding', {
        action: 'start', agency_slug: agency?.slug, ref: refCode, proposal: proposalSlug, data: company, lang,
      });
      setBusy(false);
      if (err || !data) { setError(t('Não foi possível salvar. Tente novamente.', 'Could not save. Please try again.', 'No se pudo guardar. Inténtalo de nuevo.')); return; }
      setClientId(data.client_id); setToken(data.token);
      persist({ clientId: data.client_id, token: data.token });
    }
    persist({ company });
    go(2);
  };

  // ---------- Passo 2: negócio ----------
  const submitBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (business.services.length === 0) {
      setError(t('Marque os serviços que você contratou (ou "Não sei").', 'Select the services you hired (or "Not sure").', 'Marca los servicios que contrataste (o "No sé").')); return;
    }
    if (!business.offer.trim() || !business.objective || !business.region.trim()) {
      setError(t('Conte o que você vende, o objetivo e onde estão seus clientes.', 'Tell us what you sell, your goal and where your customers are.', 'Cuéntanos qué vendes, tu objetivo y dónde están tus clientes.')); return;
    }
    setBusy(true);
    const { error: err } = await callFunction('public-onboarding', { action: 'update', client_id: clientId, token, step: 2, business, lang });
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
    if (password.length < 8) { setError(t('A senha precisa ter pelo menos 8 caracteres.', 'Password must be at least 8 characters.', 'La contraseña debe tener al menos 8 caracteres.')); return; }
    if (password !== password2) { setError(t('As senhas não coincidem.', 'Passwords do not match.', 'Las contraseñas no coinciden.')); return; }
    setBusy(true);
    const { error: err } = await callFunction('public-onboarding', { action: 'finish', client_id: clientId, token, password });
    setBusy(false);
    if (err) { setError(err); return; }
    clearPersist();
    setStep(6);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Entra direto no portal com a senha que acabou de criar
  const enterPortal = async () => {
    setEntering(true);
    try { await supabase.auth.signInWithPassword({ email: company.email.trim().toLowerCase(), password }); } catch { /* cai no login normal */ }
    window.location.href = '/';
  };

  const stepLabels = [
    t('Dados', 'Company', 'Datos'),
    t('Negócio', 'Business', 'Negocio'),
    t('Acessos', 'Access', 'Accesos'),
    t('Contrato', 'Agreement', 'Contrato'),
    t('Senha', 'Password', 'Contraseña'),
  ];

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
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('Link inválido', 'Invalid link', 'Enlace inválido')}</h2>
          <p className="text-sm text-gray-500">{t('Não encontramos este link de cadastro. Peça um novo link para a sua agência.', 'We could not find this sign-up link. Ask your agency for a new one.', 'No encontramos este enlace. Pide uno nuevo a tu agencia.')}</p>
        </div>
      </div>
    );
  }

  // Funções de renderização (não componentes): assim os botões não são recriados a cada letra digitada
  const primaryBtn = (children: React.ReactNode, { onClick, type = 'button', disabled }: { onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean } = {}) => (
    <button
      type={type} onClick={onClick} disabled={busy || disabled}
      className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition"
      style={{ backgroundColor: brand }}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
  const backBtn = (to: Step) => (
    <button type="button" onClick={() => go(to)} disabled={busy}
      className="inline-flex items-center gap-2 px-5 py-3 border border-gray-200 text-gray-600 hover:text-gray-900 rounded-xl text-sm font-medium transition">
      <ArrowLeft size={16} /> {t('Voltar', 'Back', 'Volver')}
    </button>
  );
  const header = (icon: React.ReactNode, title: string, sub: string) => (
    <div className="mb-6">
      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-gray-500 text-[11px] font-semibold mb-2">
        {icon} {t(`Etapa ${step} de 5`, `Step ${step} of 5`, `Paso ${step} de 5`)}
      </div>
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
      <p className="text-sm text-gray-500 mt-1">{sub}</p>
    </div>
  );
  const errorBox = () => error ? (
    <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>
  ) : null;
  const chip = (on: boolean, label: string, onClick: () => void, dark = false) => (
    <button key={label} type="button" onClick={onClick}
      className={`px-3.5 py-2 rounded-full border text-sm transition ${on ? (dark ? 'border-gray-900 bg-gray-900 text-white' : 'text-white border-transparent') : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
      style={on && !dark ? { backgroundColor: brand } : undefined}>{label}</button>
  );

  const services: [string, string][] = [
    ['Tráfego Pago', t('Tráfego pago (anúncios)', 'Paid ads', 'Anuncios pagados')],
    ['Social Media', t('Redes sociais', 'Social media', 'Redes sociales')],
    ['Website', t('Site / landing page', 'Website / landing page', 'Sitio web / landing page')],
    ['Identidade Visual', t('Identidade visual', 'Branding', 'Identidad visual')],
    ['Automações', t('Automações e CRM', 'Automations and CRM', 'Automatizaciones y CRM')],
    ['Não sei', t('Não sei, quero confirmar com a equipe', "Not sure, I'll confirm with the team", 'No sé, quiero confirmarlo con el equipo')],
  ];
  const objectives = [
    t('Receber contatos no WhatsApp', 'Get leads on WhatsApp', 'Recibir contactos por WhatsApp'),
    t('Vender pelo site', 'Sell on my website', 'Vender en mi sitio web'),
    t('Agendamentos / orçamentos', 'Bookings / quotes', 'Citas / cotizaciones'),
    t('Visitas à loja física', 'Store visits', 'Visitas a la tienda'),
    t('Fortalecer a marca', 'Brand awareness', 'Reconocimiento de marca'),
  ];
  const budgets = lang === 'pt' && agency.id !== 7
    ? ['Até R$ 1.000/mês', 'R$ 1.000 a R$ 3.000/mês', 'R$ 3.000 a R$ 10.000/mês', 'Acima de R$ 10.000/mês', 'Ainda não sei']
    : [
      t('Até US$ 500/mês', 'Up to $500/mo', 'Hasta US$ 500/mes'),
      t('US$ 500 a US$ 1.500/mês', '$500 to $1,500/mo', 'US$ 500 a US$ 1.500/mes'),
      t('US$ 1.500 a US$ 5.000/mês', '$1,500 to $5,000/mo', 'US$ 1.500 a US$ 5.000/mes'),
      t('Acima de US$ 5.000/mês', 'Over $5,000/mo', 'Más de US$ 5.000/mes'),
      t('Ainda não sei', 'Not sure yet', 'Aún no sé'),
    ];
  const advertisedOptions = [
    t('Nunca', 'Never', 'Nunca'),
    t('Sim, por conta própria', 'Yes, on my own', 'Sí, por mi cuenta'),
    t('Sim, com agência ou gestor', 'Yes, with an agency', 'Sí, con agencia o gestor'),
  ];
  const showsTraffic = business.services.includes('Tráfego Pago') || business.services.includes('Não sei');

  const pendingAccess = (['meta', 'google'] as Platform[]).filter(p => access[p].status === 'pending' || access[p].situation === null);
  // Quem mandou o link recebe o contato; sem indicação, vai para o WhatsApp da agência
  const waNumber = referrer?.whatsapp || agency.contact_whatsapp;
  const waLink = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(t(`Olá! Acabei de fazer o cadastro da ${company.companyName}.`, `Hi! I just signed up ${company.companyName}.`, `¡Hola! Acabo de registrar ${company.companyName}.`))}`
    : null;

  const langPicker = (compact = false) => (
    <div className={`inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-gray-200 ${compact ? '' : 'shadow-sm'}`}>
      {!compact && <Globe size={14} className="mx-1.5 text-gray-400" />}
      {LANGS.map(l => (
        <button key={l.id} type="button" onClick={() => chooseLang(l.id)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${lang === l.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          {compact ? l.id.toUpperCase() : l.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-gray-800 font-sans flex flex-col">
      <header className="w-full max-w-3xl mx-auto pt-8 px-4 sm:px-6 pb-2 flex items-center gap-3">
        {agency.logo_url && !logoError ? (
          <img src={agency.logo_url} alt={agency.name} className="h-10 w-auto object-contain" onError={() => setLogoError(true)} />
        ) : (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: brand }}>{agency.name.slice(0, 2).toUpperCase()}</div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-gray-900 leading-tight truncate">{agency.name}</p>
          <p className="text-xs text-gray-500">{t('Cadastro de cliente', 'Client onboarding', 'Registro de cliente')}</p>
        </div>
        {step > 0 && step < 6 && <div className="ml-auto">{langPicker(true)}</div>}
      </header>

      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 flex-1">
        {step >= 1 && step < 6 && (
          <ol className="mb-6 grid grid-cols-5 gap-1.5">
            {stepLabels.map((label, i) => (
              <li key={i} className="flex flex-col gap-1.5">
                <span className="h-1.5 rounded-full transition-colors" style={{ backgroundColor: step >= i + 1 ? brand : '#E5E7EB' }} />
                <span className={`text-[11px] font-semibold truncate ${step === i + 1 ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="bg-white rounded-3xl p-5 sm:p-9 border border-black/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>

              {step === 0 && (
                <div className="text-center py-4">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                    {t('Bem-vindo! Vamos começar.', "Welcome! Let's get started.", '¡Bienvenido! Empecemos.')}
                  </h1>
                  <p className="text-gray-500 mt-2 mb-8">
                    {t('Em qual idioma você prefere fazer o cadastro?', 'Which language would you like to use?', '¿En qué idioma prefieres hacer el registro?')}
                  </p>
                  <div className="grid sm:grid-cols-3 gap-3 max-w-xl mx-auto">
                    {LANGS.map(l => (
                      <button key={l.id} type="button" onClick={() => { chooseLang(l.id); go(1); }}
                        className={`py-5 px-4 rounded-2xl border-2 text-center transition hover:shadow-sm ${lang === l.id ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'}`}>
                        <p className="font-semibold text-gray-900">{l.label}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-6">
                    {t('Leva uns 5 minutos. Seus dados ficam salvos a cada etapa.', 'Takes about 5 minutes. Your progress is saved at every step.', 'Toma unos 5 minutos. Tus datos se guardan en cada paso.')}
                  </p>
                </div>
              )}

              {step === 1 && (
                <form onSubmit={submitCompany}>
                  {header(<Building2 size={13} />, t('Sobre você e a empresa', 'About you and your company', 'Sobre ti y tu empresa'),
                    t('Leva menos de um minuto. Seus dados ficam salvos a cada etapa.', 'Takes less than a minute. Your progress is saved at every step.', 'Toma menos de un minuto. Tus datos se guardan en cada paso.'))}
                  {errorBox()}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><label className={labelCls}>{t('Seu nome completo *', 'Full name *', 'Tu nombre completo *')}</label><input className={fieldCls} value={company.responsible} onChange={e => setCompany({ ...company, responsible: e.target.value })} /></div>
                    <div><label className={labelCls}>{t('Nome da empresa *', 'Company name *', 'Nombre de la empresa *')}</label><input className={fieldCls} value={company.companyName} onChange={e => setCompany({ ...company, companyName: e.target.value })} /></div>
                    <div>
                      <label className={labelCls}>{t('E-mail *', 'Email *', 'Correo *')}</label>
                      <input type="email" className={fieldCls} value={company.email} onChange={e => setCompany({ ...company, email: e.target.value })} />
                      <p className="text-[11px] text-gray-400 mt-1">{t('Com este e-mail você vai entrar no seu portal.', "You'll use this email to sign in to your portal.", 'Con este correo entrarás a tu portal.')}</p>
                    </div>
                    <div><label className={labelCls}>{t('WhatsApp *', 'Phone / WhatsApp *', 'WhatsApp *')}</label><input className={fieldCls} value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} /></div>
                    <div><label className={labelCls}>{t('Site (se tiver)', 'Website (if any)', 'Sitio web (si tienes)')}</label><input className={fieldCls} value={company.website} placeholder={t('www.suaempresa.com', 'www.yourcompany.com', 'www.tuempresa.com')} onChange={e => setCompany({ ...company, website: e.target.value })} /></div>
                    <div><label className={labelCls}>Instagram</label><input className={fieldCls} value={company.instagram_url} placeholder={t('@suaempresa', '@yourcompany', '@tuempresa')} onChange={e => setCompany({ ...company, instagram_url: e.target.value })} /></div>
                  </div>
                  <div className="mt-8 flex items-center justify-between gap-3">{backBtn(0)}{primaryBtn(<>{t('Continuar', 'Continue', 'Continuar')} <ArrowRight size={16} /></>, { type: 'submit' })}</div>
                </form>
              )}

              {step === 2 && (
                <form onSubmit={submitBusiness}>
                  {header(<Target size={13} />, t('Seu negócio', 'Your business', 'Tu negocio'),
                    t('É daqui que sai a sua estratégia. Quanto mais detalhe, melhor.', 'Your strategy is built on this. The more detail, the better.', 'De aquí sale tu estrategia. Cuanto más detalle, mejor.'))}
                  {errorBox()}
                  <div className="space-y-5">
                    <div>
                      <label className={labelCls}>{t('Quais serviços você contratou? *', 'Which services did you hire? *', '¿Qué servicios contrataste? *')}</label>
                      <div className="flex flex-wrap gap-2">
                        {services.map(([key, label]) => {
                          const on = business.services.includes(key);
                          return chip(on, label, () => setBusiness({ ...business, services: on ? business.services.filter(x => x !== key) : [...business.services, key] }));
                        })}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5">{t('Na dúvida, marque "Não sei" que a equipe confirma com você.', 'If unsure, pick "Not sure" and the team will confirm with you.', 'Si tienes dudas, marca "No sé" y el equipo lo confirma contigo.')}</p>
                    </div>
                    <div><label className={labelCls}>{t('O que você vende? Qual o produto ou serviço principal? *', 'What do you sell? Main product or service? *', '¿Qué vendes? ¿Cuál es tu producto o servicio principal? *')}</label>
                      <textarea rows={3} className={fieldCls} value={business.offer} onChange={e => setBusiness({ ...business, offer: e.target.value })} /></div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div><label className={labelCls}>{t('Ticket médio (valor de uma venda)', 'Average sale value', 'Ticket promedio (valor de una venta)')}</label>
                        <input className={fieldCls} value={business.ticket} placeholder={t('Ex.: R$ 450', 'e.g. $450', 'Ej.: US$ 450')} onChange={e => setBusiness({ ...business, ticket: e.target.value })} /></div>
                      <div><label className={labelCls}>{t('Onde estão seus clientes? *', 'Where are your customers? *', '¿Dónde están tus clientes? *')}</label>
                        <input className={fieldCls} value={business.region} placeholder={t('Cidade, região ou país', 'City, region or country', 'Ciudad, región o país')} onChange={e => setBusiness({ ...business, region: e.target.value })} /></div>
                    </div>
                    <div>
                      <label className={labelCls}>{t('Principal objetivo *', 'Main goal *', 'Objetivo principal *')}</label>
                      <div className="flex flex-wrap gap-2">{objectives.map(o => chip(business.objective === o, o, () => setBusiness({ ...business, objective: o })))}</div>
                    </div>
                    <div><label className={labelCls}>{t('Quem é o seu cliente ideal?', 'Who is your ideal customer?', '¿Quién es tu cliente ideal?')}</label>
                      <textarea rows={2} className={fieldCls} value={business.audience} placeholder={t('Ex.: mulheres que moram na zona sul, que já compraram...', 'e.g. women living downtown who...', 'Ej.: mujeres que viven en el centro, que ya compraron...')} onChange={e => setBusiness({ ...business, audience: e.target.value })} /></div>
                    <div>
                      <label className={labelCls}>{t('Faixa de idade', 'Age range', 'Rango de edad')}</label>
                      <div className="flex flex-wrap gap-2">
                        {AGE_RANGES.map(r => {
                          const on = business.ageRanges.includes(r);
                          return chip(on, r, () => setBusiness({ ...business, ageRanges: on ? business.ageRanges.filter(x => x !== r) : [...business.ageRanges, r] }), true);
                        })}
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div><label className={labelCls}>{t('Seu diferencial', 'What makes you different', 'Tu diferencial')}</label>
                        <textarea rows={2} className={fieldCls} value={business.differentiator} onChange={e => setBusiness({ ...business, differentiator: e.target.value })} /></div>
                      <div><label className={labelCls}>{t('Concorrentes que você observa', 'Competitors you watch', 'Competidores que observas')}</label>
                        <textarea rows={2} className={fieldCls} value={business.competitors} onChange={e => setBusiness({ ...business, competitors: e.target.value })} /></div>
                    </div>
                    {showsTraffic && (
                      <>
                        <div>
                          <label className={labelCls}>{t('Quanto pretende investir por mês em anúncios? (pago direto às plataformas)', 'Monthly ad budget? (paid directly to the platforms)', '¿Cuánto piensas invertir al mes en anuncios? (pagado directo a las plataformas)')}</label>
                          <select className={`${fieldCls} bolsa-select`} value={business.budget} onChange={e => setBusiness({ ...business, budget: e.target.value })}>
                            <option value="">{t('Selecione', 'Select', 'Selecciona')}</option>
                            {budgets.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>{t('Já anunciou antes?', 'Have you run ads before?', '¿Ya anunciaste antes?')}</label>
                            <select className={`${fieldCls} bolsa-select`} value={business.advertisedBefore} onChange={e => setBusiness({ ...business, advertisedBefore: e.target.value })}>
                              <option value="">{t('Selecione', 'Select', 'Selecciona')}</option>
                              {advertisedOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          <div><label className={labelCls}>{t('Como o cliente compra de você?', 'How do customers buy from you?', '¿Cómo te compran tus clientes?')}</label>
                            <input className={fieldCls} value={business.salesChannel} placeholder={t('WhatsApp, site, loja, telefone...', 'WhatsApp, website, store, phone...', 'WhatsApp, sitio, tienda, teléfono...')} onChange={e => setBusiness({ ...business, salesChannel: e.target.value })} /></div>
                        </div>
                        {business.advertisedBefore && business.advertisedBefore !== advertisedOptions[0] && (
                          <div><label className={labelCls}>{t('O que funcionou e o que não funcionou?', "What worked and what didn't?", '¿Qué funcionó y qué no?')}</label>
                            <textarea rows={2} className={fieldCls} value={business.history} onChange={e => setBusiness({ ...business, history: e.target.value })} /></div>
                        )}
                      </>
                    )}
                    <div><label className={labelCls}>{t('Algo mais que devemos saber?', 'Anything else we should know?', '¿Algo más que debamos saber?')}</label>
                      <textarea rows={2} className={fieldCls} value={business.notes} onChange={e => setBusiness({ ...business, notes: e.target.value })} /></div>
                  </div>
                  <div className="mt-8 flex items-center justify-between gap-3">{backBtn(1)}{primaryBtn(<>{t('Continuar', 'Continue', 'Continuar')} <ArrowRight size={16} /></>, { type: 'submit' })}</div>
                </form>
              )}

              {step === 3 && (
                <div>
                  {header(<KeyRound size={13} />, t('Acesso às contas de anúncio', 'Access to your ad accounts', 'Acceso a tus cuentas publicitarias'),
                    t('Para gerenciar seus anúncios, precisamos de acesso às contas. Você continua dono de tudo.', 'To manage your ads we need access to your accounts. You remain the owner of everything.', 'Para gestionar tus anuncios necesitamos acceso a las cuentas. Tú sigues siendo el dueño de todo.'))}
                  {errorBox()}
                  <div className="space-y-4">
                    {(['meta', 'google'] as Platform[]).map(p => (
                      <AccessGuideCard key={p} platform={p} lang={lang} accessEmail={accessEmail} brand={brand}
                        signupEmail={company.email}
                        value={access[p]} onChange={patch => setPlat(p, patch)} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-4">{t('Se preferir fazer depois, tudo bem: este passo a passo também fica no seu portal.', 'Prefer to do it later? No problem: these steps will also be in your portal.', '¿Prefieres hacerlo después? Sin problema: estos pasos también quedan en tu portal.')}</p>
                  <div className="mt-8 flex items-center justify-between gap-3">{backBtn(2)}{primaryBtn(<>{t('Continuar', 'Continue', 'Continuar')} <ArrowRight size={16} /></>, { onClick: submitAccess })}</div>
                </div>
              )}

              {step === 4 && (
                <div>
                  {header(<FileText size={13} />, t('Termos do serviço', 'Service agreement', 'Términos del servicio'),
                    t('Os termos gerais do serviço. Valores e prazos seguem a proposta combinada.', 'General terms of the service. Prices and terms follow the agreed proposal.', 'Términos generales del servicio. Valores y plazos siguen la propuesta acordada.'))}
                  {errorBox()}
                  <div className="p-5 bg-gray-50 border border-gray-200 rounded-2xl h-64 overflow-y-auto text-sm text-gray-600 leading-relaxed space-y-3 mb-5">
                    {lang === 'en' ? (
                      <>
                        <p className="font-semibold text-gray-900">Digital Marketing Services Agreement</p>
                        <p>Between <strong>{company.companyName}</strong> (the "Client") and <strong>{agency.name}</strong> (the "Agency").</p>
                        <p><strong>1. Scope.</strong> The Agency provides the services agreed in the proposal, such as planning, running and optimizing paid campaigns on Meta Ads and Google Ads, with regular reporting.</p>
                        <p><strong>2. Client.</strong> Grants the access needed to accounts and assets, pays ad spend directly to the platforms, and reviews approvals in a timely manner.</p>
                        <p><strong>3. Confidentiality.</strong> Both parties keep all business information exchanged strictly confidential.</p>
                        <p><strong>4. Term.</strong> Services start after onboarding is complete. Either party may end the agreement according to the notice terms agreed between the parties.</p>
                      </>
                    ) : lang === 'es' ? (
                      <>
                        <p className="font-semibold text-gray-900">Contrato de prestación de servicios de marketing digital</p>
                        <p>Entre <strong>{company.companyName}</strong>, representada por <strong>{company.responsible}</strong> (CONTRATANTE), y <strong>{agency.name}</strong> (CONTRATADA).</p>
                        <p><strong>1. Objeto.</strong> Los servicios acordados en la propuesta, como planificación, ejecución y optimización de campañas en Meta Ads y Google Ads, con seguimiento periódico de resultados.</p>
                        <p><strong>2. De la contratada.</strong> Configurar las campañas a partir del registro, seguir las métricas y optimizar públicos, pujas y anuncios.</p>
                        <p><strong>3. De la contratante.</strong> Dar los accesos necesarios, pagar la inversión en medios directo a las plataformas y aprobar piezas y direcciones a tiempo.</p>
                        <p><strong>4. Confidencialidad.</strong> Las partes mantienen en secreto la información comercial y estratégica compartida.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-gray-900">Contrato de prestação de serviços de marketing digital</p>
                        <p>Entre <strong>{company.companyName}</strong>, representada por <strong>{company.responsible}</strong> (CONTRATANTE), e <strong>{agency.name}</strong> (CONTRATADA).</p>
                        <p><strong>1. Objeto.</strong> Os serviços combinados na proposta, como planejamento, execução e otimização de campanhas no Meta Ads (Facebook e Instagram) e no Google Ads, com acompanhamento periódico dos resultados.</p>
                        <p><strong>2. Da contratada.</strong> Configurar as campanhas a partir do cadastro, acompanhar as métricas e otimizar públicos, lances e anúncios.</p>
                        <p><strong>3. Da contratante.</strong> Conceder os acessos necessários, pagar o investimento em mídia direto às plataformas e aprovar peças e direcionamentos em tempo hábil.</p>
                        <p><strong>4. Sigilo.</strong> As partes mantêm em sigilo as informações comerciais e estratégicas compartilhadas.</p>
                      </>
                    )}
                  </div>
                  <label className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl cursor-pointer select-none">
                    <input type="checkbox" checked={contractAccepted} onChange={e => setContractAccepted(e.target.checked)} className="mt-0.5 w-5 h-5 rounded border-gray-300" />
                    <span className="text-sm font-medium text-gray-800">{t('Li e aceito os termos do serviço', 'I have read and agree to the terms', 'Leí y acepto los términos del servicio')}</span>
                  </label>
                  <div className="mt-8 flex items-center justify-between gap-3">{backBtn(3)}{primaryBtn(<>{t('Aceitar e continuar', 'Accept and continue', 'Aceptar y continuar')} <ArrowRight size={16} /></>, { onClick: submitContract, disabled: !contractAccepted })}</div>
                </div>
              )}

              {step === 5 && (
                <form onSubmit={submitPassword}>
                  {header(<KeyRound size={13} />, t('Crie sua senha', 'Create your password', 'Crea tu contraseña'),
                    t(`Você vai entrar no portal com ${company.email} e esta senha.`, `You'll sign in to the portal with ${company.email} and this password.`, `Entrarás al portal con ${company.email} y esta contraseña.`))}
                  {errorBox()}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><label className={labelCls}>{t('Senha (mínimo 8 caracteres)', 'Password (min. 8 characters)', 'Contraseña (mínimo 8 caracteres)')}</label><input type="password" autoComplete="new-password" className={fieldCls} value={password} onChange={e => setPassword(e.target.value)} /></div>
                    <div><label className={labelCls}>{t('Repita a senha', 'Repeat password', 'Repite la contraseña')}</label><input type="password" autoComplete="new-password" className={fieldCls} value={password2} onChange={e => setPassword2(e.target.value)} /></div>
                  </div>
                  <div className="mt-8 flex items-center justify-between gap-3">{backBtn(4)}{primaryBtn(<>{t('Concluir cadastro', 'Finish', 'Finalizar registro')} <Check size={16} /></>, { type: 'submit' })}</div>
                </form>
              )}

              {step === 6 && (
                <div className="py-2">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-5"><CheckCircle2 size={36} /></div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('Cadastro concluído!', "You're all set!", '¡Registro completado!')}</h2>
                    <p className="text-gray-600 max-w-md mx-auto">{t('A partir daqui é com a gente. Veja o que acontece agora:', "From here, it's on us. Here's what happens next:", 'Desde aquí nos encargamos. Esto es lo que sigue:')}</p>
                  </div>

                  {pendingAccess.length > 0 && (
                    <div className="mt-6 max-w-md mx-auto p-4 rounded-2xl bg-amber-50 border border-amber-100 text-sm text-amber-900">
                      <p className="font-semibold">{t('Falta só uma coisa da sua parte', 'Just one thing left on your side', 'Solo falta una cosa de tu parte')}</p>
                      <p className="mt-1">{t(
                        `Dar acesso ao ${pendingAccess.map(p => (p === 'meta' ? 'Meta' : 'Google Ads')).join(' e ao ')}. O passo a passo está no seu portal, logo na primeira tela.`,
                        `Give us access to ${pendingAccess.map(p => (p === 'meta' ? 'Meta' : 'Google Ads')).join(' and ')}. The steps are on the first screen of your portal.`,
                        `Darnos acceso a ${pendingAccess.map(p => (p === 'meta' ? 'Meta' : 'Google Ads')).join(' y ')}. Los pasos están en la primera pantalla de tu portal.`)}</p>
                    </div>
                  )}

                  <ol className="text-left max-w-md mx-auto space-y-3 my-8">
                    {[
                      [t('Conferimos os acessos', 'We check the access', 'Revisamos los accesos'), t('Se algo faltar, avisamos e ajudamos.', "If anything is missing, we'll help.", 'Si falta algo, te avisamos y ayudamos.')],
                      [t('Montamos sua estratégia', 'We build your strategy', 'Armamos tu estrategia'), t('Públicos, campanhas e investimento, a partir do que você contou.', 'Audiences, campaigns and budget, based on what you told us.', 'Públicos, campañas e inversión, a partir de lo que nos contaste.')],
                      [t('Você aprova no portal', 'You approve it in the portal', 'Tú la apruebas en el portal'), t('Pode aprovar ou pedir ajustes. Avisamos no WhatsApp quando estiver pronta.', "Approve or ask for changes. We'll let you know on WhatsApp when it's ready.", 'Puedes aprobar o pedir ajustes. Te avisamos por WhatsApp cuando esté lista.')],
                      [t('Campanhas no ar', 'Campaigns go live', 'Campañas al aire'), t('Você acompanha os resultados ao vivo no portal.', 'You follow the results live in the portal.', 'Sigues los resultados en vivo en el portal.')],
                    ].map(([title, sub], i) => (
                      <li key={i} className="flex gap-3">
                        <span className="w-7 h-7 shrink-0 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: brand }}>{i + 1}</span>
                        <div><p className="font-semibold text-gray-900 text-sm">{title}</p><p className="text-sm text-gray-500">{sub}</p></div>
                      </li>
                    ))}
                  </ol>

                  <div className="flex flex-col items-center gap-3">
                    <button type="button" onClick={enterPortal} disabled={entering}
                      className="inline-flex items-center gap-2 px-7 py-3.5 text-white font-semibold text-sm rounded-xl disabled:opacity-60" style={{ backgroundColor: brand }}>
                      {entering ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {t('Entrar no meu portal', 'Go to my portal', 'Entrar a mi portal')}
                    </button>
                    <p className="text-xs text-gray-500">{t(`Nas próximas vezes, entre com ${company.email} e a senha que você criou.`, `Next time, sign in with ${company.email} and the password you created.`, `Las próximas veces, entra con ${company.email} y la contraseña que creaste.`)}</p>
                    {waLink && (
                      <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline">
                        <MessageCircle size={15} /> {t('Ficou alguma dúvida? Fale com a equipe', 'Any questions? Talk to the team', '¿Alguna duda? Habla con el equipo')}
                      </a>
                    )}
                  </div>
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

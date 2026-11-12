import React, { useState } from 'react';
import { AgencyLogo } from './AgencyLogo';
import { useAuth } from '../lib/supabase';
import { Lock, Mail, ArrowRight, ShieldCheck, Eye, EyeOff, Sparkles, KeyRound, User, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BRAND, BRAND_ID, TAGLINE, useBrandAgencyLogo, useLoginLang, type LoginLang } from '../lib/brand';

/** Moldura visual compartilhada pelas telas de acesso. */
const FLAGS: { id: LoginLang; flag: string; label: string }[] = [
  { id: 'en', flag: '🇺🇸', label: 'English' }, { id: 'pt', flag: '🇧🇷', label: 'Português' }, { id: 'es', flag: '🇪🇸', label: 'Español' },
];

export const AuthShell: React.FC<{ children: React.ReactNode; lang?: LoginLang; onLang?: (l: LoginLang) => void }> = ({ children, lang = 'pt', onLang }) => {
  const brandLogo = useBrandAgencyLogo(true);
  return (
  <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-4 relative overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-blue-50 rounded-full blur-[120px] opacity-40" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-indigo-50 rounded-full blur-[120px] opacity-30" />
    </div>
    <div className="relative z-10 w-full max-w-lg">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 text-center flex flex-col items-center justify-center">
        {BRAND_ID === 'pouch'
          ? (brandLogo ? <img src={brandLogo} alt={BRAND.by} className="h-24 w-auto object-contain relative mix-blend-multiply mb-5" /> : <div className="h-24 mb-5" />)
          : <AgencyLogo className="h-24 relative mix-blend-multiply mb-5" />}
        <h1 className="text-brand-dark font-bold text-5xl tracking-tighter serif italic">{BRAND.app}</h1>
        <div className="h-0.5 w-10 bg-brand-dark mx-auto opacity-20 my-2" />
        <p className="text-gray-400 text-[10px] uppercase tracking-[0.4em] font-bold">{TAGLINE[lang]}</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-black/[0.02] p-8 sm:p-12 relative overflow-hidden">
        <div className="relative z-10">{children}</div>
      </motion.div>
      <p className="mt-8 text-center text-[10px] text-gray-300 uppercase tracking-[0.4em] font-bold">{lang === 'en' ? 'Secure environment' : lang === 'es' ? 'Ambiente seguro' : 'Ambiente seguro'}</p>
      {onLang && BRAND_ID === 'pouch' && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {FLAGS.map(f => (
            <button key={f.id} type="button" onClick={() => onLang(f.id)} aria-label={f.label} title={f.label}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition ${lang === f.id ? 'bg-white shadow ring-1 ring-black/5' : 'opacity-50 hover:opacity-100'}`}>
              <span aria-hidden="true">{f.flag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
  );
};

const TXT = {
  pt: { exclusive: 'Acesso exclusivo', first: 'Primeiro acesso', recover: 'Recuperar senha',
    firstHelp: 'Use a chave de acesso que você já tinha para criar o seu login com e-mail e senha. Você só faz isso uma vez.',
    forgotHelp: 'Informe o e-mail do seu login. Enviaremos um link para você criar uma nova senha.',
    oldKey: 'Chave de acesso antiga', oldKeyPh: 'A chave que você usava', name: 'Seu nome', namePh: 'Como quer ser chamado',
    email: 'E-mail', emailPh: 'voce@empresa.com', createPw: 'Crie uma senha', pw: 'Senha', min8: 'Mínimo de 8 caracteres', yourPw: 'Sua senha', repeat: 'Repita a senha',
    enter: `Entrar na ${BRAND.app}`, createLogin: 'Criar meu login', sendLink: 'Enviar link', forgot: 'Esqueci minha senha',
    firstLink: 'Primeiro acesso? Tenho uma chave de acesso antiga', back: 'Voltar para o login',
    errLen: 'A senha precisa ter pelo menos 8 caracteres.', errMatch: 'As senhas não coincidem.', errLogin: 'Não foi possível entrar.',
    sent: 'Se este e-mail tiver acesso, você vai receber um link para criar uma nova senha.' },
  en: { exclusive: 'Exclusive access', first: 'First access', recover: 'Reset password',
    firstHelp: 'Use the access key you already had to create your login with email and password. You only do this once.',
    forgotHelp: 'Enter the email of your login. We will send you a link to create a new password.',
    oldKey: 'Old access key', oldKeyPh: 'The key you used before', name: 'Your name', namePh: 'What should we call you',
    email: 'Email', emailPh: 'you@company.com', createPw: 'Create a password', pw: 'Password', min8: 'At least 8 characters', yourPw: 'Your password', repeat: 'Repeat the password',
    enter: `Sign in to ${BRAND.app}`, createLogin: 'Create my login', sendLink: 'Send link', forgot: 'Forgot my password',
    firstLink: 'First access? I have an old access key', back: 'Back to sign in',
    errLen: 'The password must have at least 8 characters.', errMatch: 'The passwords do not match.', errLogin: 'Could not sign in.',
    sent: 'If this email has access, you will receive a link to create a new password.' },
  es: { exclusive: 'Acceso exclusivo', first: 'Primer acceso', recover: 'Recuperar contraseña',
    firstHelp: 'Usa la clave de acceso que ya tenías para crear tu login con correo y contraseña. Solo lo haces una vez.',
    forgotHelp: 'Escribe el correo de tu login. Te enviaremos un enlace para crear una nueva contraseña.',
    oldKey: 'Clave de acceso antigua', oldKeyPh: 'La clave que usabas', name: 'Tu nombre', namePh: 'Cómo quieres que te llamemos',
    email: 'Correo', emailPh: 'tu@empresa.com', createPw: 'Crea una contraseña', pw: 'Contraseña', min8: 'Mínimo 8 caracteres', yourPw: 'Tu contraseña', repeat: 'Repite la contraseña',
    enter: `Entrar en ${BRAND.app}`, createLogin: 'Crear mi login', sendLink: 'Enviar enlace', forgot: 'Olvidé mi contraseña',
    firstLink: '¿Primer acceso? Tengo una clave de acceso antigua', back: 'Volver al login',
    errLen: 'La contraseña debe tener al menos 8 caracteres.', errMatch: 'Las contraseñas no coinciden.', errLogin: 'No fue posible entrar.',
    sent: 'Si este correo tiene acceso, recibirás un enlace para crear una nueva contraseña.' },
};

const inputCls = 'w-full pl-12 pr-12 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark focus:bg-white outline-none transition-all placeholder-gray-300 text-gray-900 font-medium';

const Field: React.FC<{
  icon: React.ReactNode; label: string; type: string; value: string; onChange: (v: string) => void;
  placeholder: string; autoComplete?: string; toggle?: boolean;
}> = ({ icon, label, type, value, onChange, placeholder, autoComplete, toggle }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 ml-1">{label}</label>
      <div className="relative group">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-brand-dark transition-colors">{icon}</span>
        <input type={toggle ? (show ? 'text' : 'password') : type} value={value} onChange={(e) => onChange(e.target.value)}
          className={inputCls} placeholder={placeholder} autoComplete={autoComplete} required />
        {toggle && (
          <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 p-1">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
};

type Mode = 'login' | 'first' | 'forgot';

export const LoginScreen: React.FC = () => {
  const { signIn, claimLegacyKey, requestPasswordReset } = useAuth();
  const [lang, setLang] = useLoginLang();
  const T = TXT[lang];
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [legacyKey, setLegacyKey] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (m: Mode) => { setMode(m); setError(''); setInfo(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (mode === 'first') {
      if (password.length < 8) return setError(T.errLen);
      if (password !== confirm) return setError(T.errMatch);
    }
    setLoading(true);
    let r: { success: boolean; error?: string };
    if (mode === 'login') r = await signIn(email, password);
    else if (mode === 'first') r = await claimLegacyKey(legacyKey.trim(), email, password, name.trim() || undefined);
    else {
      r = await requestPasswordReset(email);
      if (r.success) setInfo(T.sent);
    }
    setLoading(false);
    if (!r.success) setError(r.error || T.errLogin);
  };

  return (
    <AuthShell lang={lang} onLang={setLang}>
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-widest mb-3">
          {mode === 'first' ? <KeyRound size={10} /> : <Sparkles size={10} />}
          <span>{mode === 'login' ? T.exclusive : mode === 'first' ? T.first : T.recover}</span>
        </div>
        {mode === 'first' && (
          <p className="text-[13px] text-gray-500 leading-relaxed max-w-sm mx-auto">
            {T.firstHelp}
          </p>
        )}
        {mode === 'forgot' && (
          <p className="text-[13px] text-gray-500 leading-relaxed max-w-sm mx-auto">
            {T.forgotHelp}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === 'first' && (
          <>
            <Field icon={<KeyRound size={18} />} label={T.oldKey} type="password" toggle value={legacyKey} onChange={setLegacyKey} placeholder={T.oldKeyPh} autoComplete="off" />
            <Field icon={<User size={18} />} label={T.name} type="text" value={name} onChange={setName} placeholder={T.namePh} autoComplete="name" />
          </>
        )}
        <Field icon={<Mail size={18} />} label={T.email} type="email" value={email} onChange={setEmail} placeholder={T.emailPh} autoComplete="email" />
        {mode !== 'forgot' && (
          <Field icon={<Lock size={18} />} label={mode === 'first' ? T.createPw : T.pw} type="password" toggle value={password} onChange={setPassword}
            placeholder={mode === 'first' ? T.min8 : T.yourPw} autoComplete={mode === 'first' ? 'new-password' : 'current-password'} />
        )}
        {mode === 'first' && (
          <Field icon={<Lock size={18} />} label={T.repeat} type="password" toggle value={confirm} onChange={setConfirm} placeholder={T.repeat} autoComplete="new-password" />
        )}

        <AnimatePresence mode="wait">
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-red-50 text-red-600 text-[11px] font-bold rounded-xl flex items-center justify-center gap-2 border border-red-100 text-center">
              <ShieldCheck size={14} className="shrink-0" /> {error}
            </motion.div>
          )}
          {info && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-xl flex items-center justify-center gap-2 border border-emerald-100 text-center">
              <CheckCircle2 size={14} className="shrink-0" /> {info}
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" disabled={loading}
          className={`w-full bg-brand-dark text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-xl shadow-brand-dark/10 flex items-center justify-center gap-3 group ${loading ? 'opacity-80 cursor-wait' : ''}`}>
          {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
            <>
              {mode === 'login' ? T.enter : mode === 'first' ? T.createLogin : T.sendLink}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="mt-7 pt-5 border-t border-gray-50 flex flex-col items-center gap-3 text-[11px] font-bold">
        {mode === 'login' ? (
          <>
            <button type="button" onClick={() => switchMode('forgot')} className="text-gray-400 hover:text-brand-dark transition-colors">{T.forgot}</button>
            <button type="button" onClick={() => switchMode('first')} className="text-brand-dark/70 hover:text-brand-dark transition-colors">
              {T.firstLink}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => switchMode('login')} className="text-gray-400 hover:text-brand-dark transition-colors inline-flex items-center gap-1">
            <ArrowLeft size={12} /> {T.back}
          </button>
        )}
      </div>
    </AuthShell>
  );
};

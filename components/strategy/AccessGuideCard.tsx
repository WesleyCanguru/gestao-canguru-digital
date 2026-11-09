import React from 'react';
import { Check, Copy, LifeBuoy, Clock, ExternalLink, Megaphone, Search, Video } from 'lucide-react';
import { GuideStep, Lang, Platform, platformGuide, tr } from '../../lib/accessGuides';

export type AccessSituation = 'has_account' | 'needs_account' | null;
export type AccessStatus = 'pending' | 'client_done' | 'help' | 'agency_creating' | 'verified';
export interface AccessChoice {
  situation: AccessSituation;
  status: AccessStatus;
  account_ref: string;
  contact_email?: string;
  later_clicked?: boolean;
}

export const emptyAccess = (): AccessChoice => ({
  situation: null,
  status: 'pending',
  account_ref: '',
  contact_email: '',
  later_clicked: false,
});

const fieldCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400 transition';

/**
 * Bloco de acesso de uma plataforma (Meta ou Google): pergunta se já tem conta,
 * mostra o passo a passo certo e deixa o cliente dizer em que pé está.
 * Usado no cadastro e no portal.
 */
export const AccessGuideCard: React.FC<{
  platform: Platform;
  lang: Lang;
  accessEmail: string;
  brand: string;
  value: AccessChoice;
  onChange: (patch: Partial<AccessChoice>) => void;
  disabled?: boolean;
  signupEmail?: string;
}> = ({ platform, lang, accessEmail, brand, value: a, onChange, disabled, signupEmail }) => {
  const t = tr(lang);
  const g = platformGuide(platform, lang);
  const [copied, setCopied] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [confirmingSend, setConfirmingSend] = React.useState(false);
  const [googleEmailMode, setGoogleEmailMode] = React.useState<'same' | 'other' | null>(() => {
    if (a.contact_email && signupEmail && a.contact_email === signupEmail) return 'same';
    if (a.contact_email) return 'other';
    return null;
  });
  const [laterClicked, setLaterClicked] = React.useState(!!a.later_clicked);

  const copy = () => {
    navigator.clipboard?.writeText(accessEmail).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const effectiveEmailMode = googleEmailMode ?? (
    a.contact_email && signupEmail && a.contact_email === signupEmail ? 'same'
    : a.contact_email ? 'other'
    : null
  );

  if (a.status === 'verified') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-600 text-white"><Check size={18} /></span>
        <div><p className="font-semibold text-gray-900">{g.name}</p><p className="text-sm text-emerald-800">{t('Acesso conferido pela equipe.', 'Access confirmed by the team.', 'Acceso confirmado por el equipo.')}</p></div>
      </div>
    );
  }

  const isDoneOrCreating = a.status === 'client_done' || a.status === 'agency_creating';

  const badge = {
    client_done: [t('Acesso enviado', 'Access sent', 'Acceso enviado'), 'text-emerald-700 bg-emerald-50 border border-emerald-200'],
    agency_creating: [t('Nós criamos', 'We create it', 'Nosotros la creamos'), 'text-sky-700 bg-sky-50 border border-sky-200'],
    help: [t('Vamos te ajudar', "We'll help you", 'Te ayudamos'), 'text-amber-700 bg-amber-50 border border-amber-200'],
    pending: null,
  }[a.status as 'client_done' | 'agency_creating' | 'help' | 'pending'];

  if (isDoneOrCreating && !expanded) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: brand }}>
            {platform === 'meta' ? <Megaphone size={18} /> : <Search size={18} />}
          </span>
          <div>
            <h3 className="font-semibold text-gray-900">{g.name}</h3>
            {badge && (
              <span className={`inline-block sm:hidden mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${badge[1]}`}>
                {badge[0]}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-center">
          {badge && (
            <span className={`hidden sm:inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${badge[1]}`}>
              {badge[0]}
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs font-semibold text-gray-600 hover:text-gray-900 underline underline-offset-2 transition cursor-pointer"
          >
            {t('Ver passo a passo de novo', 'View step by step again', 'Ver paso a paso de nuevo')}
          </button>
        </div>
      </div>
    );
  }

  const steps = (items: GuideStep[]) => (
    <ol className="space-y-3">
      {items.map((step, i) => {
        const stepNum = i + 1;
        return (
          <li key={i} className="space-y-2">
            <div className="flex gap-3 text-sm text-gray-700">
              <span className="w-6 h-6 shrink-0 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">
                {stepNum}
              </span>
              <span className="pt-0.5">{step.text}</span>
            </div>
            {step.sub && step.sub.length > 0 && (
              <ol className="space-y-2 pl-[36px]">
                {step.sub.map((subText, subIdx) => (
                  <li key={subIdx} className="flex items-start gap-2.5 text-xs text-gray-600">
                    <span className="min-w-[24px] h-5 px-1 shrink-0 rounded-full bg-gray-100 text-gray-700 text-[10px] font-bold flex items-center justify-center border border-gray-200">
                      {`${stepNum}.${subIdx + 1}`}
                    </span>
                    <span className="pt-0.5">{subText}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
    </ol>
  );

  const handleChoiceClick = (val: AccessStatus) => {
    if (disabled) return;
    if (val === 'client_done') {
      setConfirmingSend(true);
      return;
    }
    setConfirmingSend(false);
    if (val === 'pending') {
      setLaterClicked(true);
      onChange({ status: 'pending', later_clicked: true });
    } else {
      setLaterClicked(false);
      onChange({ status: val, later_clicked: false });
    }
  };

  const choice = (val: AccessStatus, label: string, icon: React.ReactNode) => {
    const isSelected = val === 'pending'
      ? (a.later_clicked || laterClicked) && a.status === 'pending'
      : a.status === val;

    return (
      <button
        key={val}
        type="button"
        disabled={disabled}
        onClick={() => handleChoiceClick(val)}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition disabled:opacity-50 cursor-pointer ${
          isSelected
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  const confirmationBox = confirmingSend && (
    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-3">
      <p className="text-sm font-medium text-emerald-950">
        {t(
          `Confirma que você já enviou o convite para ${accessEmail}?`,
          `Do you confirm that you already sent the invite to ${accessEmail}?`,
          `¿Confirmas que ya enviaste la invitación a ${accessEmail}?`
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setConfirmingSend(false);
            setLaterClicked(false);
            setExpanded(false);
            onChange({ status: 'client_done', later_clicked: false });
          }}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
        >
          {t('Sim, já enviei', 'Yes, I already sent it', 'Sí, ya la envié')}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setConfirmingSend(false)}
          className="px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition cursor-pointer"
        >
          {t('Ainda não', 'Not yet', 'Todavía no')}
        </button>
      </div>
    </div>
  );

  const emailBox = (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 min-w-0">
      <span className="text-xs text-gray-500 shrink-0">{t('E-mail da agência', 'Agency email', 'Correo de la agencia')}</span>
      <span className="font-mono text-sm text-gray-900 truncate">{accessEmail}</span>
      <button type="button" onClick={copy} className="ml-auto shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900">
        {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t('Copiado', 'Copied', 'Copiado') : t('Copiar', 'Copy', 'Copiar')}
      </button>
    </div>
  );

  const openBtn = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 hover:border-gray-300">
      {label} <ExternalLink size={14} />
    </a>
  );

  const renderGoogleEmailQuestion = () => {
    const isSameSelected = effectiveEmailMode === 'same' || (!!signupEmail && a.contact_email === signupEmail && effectiveEmailMode !== 'other');
    const isOtherSelected = effectiveEmailMode === 'other';

    return (
      <div className="space-y-2 pt-1">
        <label className="block text-xs font-semibold text-gray-700">
          {t('Qual e-mail você usa na conta Google da empresa?', 'Which email do you use for your company Google account?', '¿Qué correo usas en la cuenta de Google de la empresa?')}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setGoogleEmailMode('same');
              onChange({ contact_email: signupEmail || '' });
            }}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition text-left disabled:opacity-50 cursor-pointer ${
              isSameSelected
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
            }`}
          >
            {signupEmail
              ? t(`É o mesmo do cadastro (${signupEmail})`, `Same as registration (${signupEmail})`, `Es el mismo del registro (${signupEmail})`)
              : t('É o mesmo do cadastro', 'Same as registration', 'Es el mismo del registro')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setGoogleEmailMode('other');
              if (a.contact_email === signupEmail) {
                onChange({ contact_email: '' });
              }
            }}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition text-left disabled:opacity-50 cursor-pointer ${
              isOtherSelected
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
            }`}
          >
            {t('É outro e-mail', 'It is a different email', 'Es otro correo')}
          </button>
        </div>
        {isOtherSelected && (
          <div className="pt-1">
            <input
              type="email"
              className={fieldCls}
              value={a.contact_email === signupEmail ? '' : (a.contact_email || '')}
              placeholder={t('Digite o e-mail da conta Google', 'Enter the Google account email', 'Ingresa el correo de la cuenta de Google')}
              disabled={disabled}
              onChange={e => onChange({ contact_email: e.target.value })}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-gray-200 p-5 bg-white">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: brand }}>
          {platform === 'meta' ? <Megaphone size={18} /> : <Search size={18} />}
        </span>
        <h3 className="font-semibold text-gray-900">{g.name}</h3>
        {badge && <span className={`ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full ${badge[1]}`}>{badge[0]}</span>}
        {isDoneOrCreating && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs font-medium text-gray-400 hover:text-gray-700 underline cursor-pointer"
          >
            {t('Recolher', 'Collapse', 'Plegar')}
          </button>
        )}
      </div>

      <p className="text-sm text-gray-700 mb-2">{t('Você já tem uma conta de anúncios?', 'Do you already have an ad account?', '¿Ya tienes una cuenta publicitaria?')}</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {([['has_account', t('Sim, já tenho', 'Yes, I do', 'Sí, ya tengo')], ['needs_account', t('Não tenho / não sei', "No / I'm not sure", 'No tengo / no sé')]] as const).map(([sit, label]) => (
          <button key={sit} type="button" disabled={disabled}
            onClick={() => {
              setConfirmingSend(false);
              onChange({ situation: sit, status: 'pending', later_clicked: false });
            }}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition disabled:opacity-50 cursor-pointer ${a.situation === sit ? 'text-white border-transparent' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
            style={a.situation === sit ? { backgroundColor: brand } : undefined}>
            {label}
          </button>
        ))}
      </div>

      {a.situation === 'has_account' && (
        <div className="space-y-4">
          {emailBox}
          {steps(g.hasAccount)}
          {openBtn(g.link, g.linkLabel)}
          {platform === 'google' && renderGoogleEmailQuestion()}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{g.refLabel}</label>
            <input className={fieldCls} value={a.account_ref} placeholder={g.refPlaceholder} disabled={disabled}
              onChange={e => onChange({ account_ref: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            {choice('client_done', t('Já enviei o convite', 'I sent the invite', 'Ya envié la invitación'), <Check size={15} />)}
            {choice('pending', t('Faço depois', "I'll do it later", 'Lo hago después'), <Clock size={15} />)}
            {choice('help', t('Preciso de ajuda', 'I need help', 'Necesito ayuda'), <LifeBuoy size={15} />)}
          </div>
          {confirmationBox}
          {a.status === 'help' && (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">{t('Combinado: a equipe vai te chamar no WhatsApp para fazer isso junto, por vídeo.', "Got it: our team will reach out on WhatsApp to do it together over a video call.", 'Perfecto: el equipo te contactará por WhatsApp para hacerlo juntos por videollamada.')}</p>
          )}
        </div>
      )}

      {a.situation === 'needs_account' && platform === 'meta' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">{g.noAccountIntro}</p>
          {steps(g.noAccount)}
          {g.noAccountLink && openBtn(g.noAccountLink, g.noAccountLinkLabel || '')}
          {emailBox}
          <div className="grid sm:grid-cols-3 gap-2">
            {choice('client_done', t('Criei e enviei o convite', 'Created it and sent the invite', 'La creé y envié la invitación'), <Check size={15} />)}
            {choice('pending', t('Faço depois', "I'll do it later", 'Lo hago depois'), <Clock size={15} />)}
            {choice('help', t('Prefiro fazer numa chamada', "I'd rather do it on a call", 'Prefiero hacerlo en una llamada'), <Video size={15} />)}
          </div>
          {confirmationBox}
          {a.status === 'help' && (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">{t('Combinado: a equipe vai te chamar no WhatsApp e fazemos juntos por vídeo.', "Got it: our team will reach out on WhatsApp and we'll do it together over video.", 'Perfecto: el equipo te contactará por WhatsApp y lo hacemos juntos por video.')}</p>
          )}
        </div>
      )}

      {a.situation === 'needs_account' && platform === 'google' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-sky-50 text-sky-900 text-sm">{g.noAccountIntro}</div>
          {renderGoogleEmailQuestion()}
          <div className="grid sm:grid-cols-2 gap-2">
            {choice('agency_creating', t('Ok, podem criar', 'OK, go ahead', 'Ok, pueden crearla'), <Check size={15} />)}
            {choice('help', t('Prefiro fazer numa chamada', "I'd rather do it on a call", 'Prefiero hacerlo en una llamada'), <Video size={15} />)}
          </div>
          {confirmationBox}
        </div>
      )}
    </div>
  );
};

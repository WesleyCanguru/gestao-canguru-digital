import React from 'react';
import { Check, Copy, LifeBuoy, Clock, ExternalLink, Megaphone, Search, Video } from 'lucide-react';
import { Lang, Platform, platformGuide, tr } from '../../lib/accessGuides';

export type AccessSituation = 'has_account' | 'needs_account' | null;
export type AccessStatus = 'pending' | 'client_done' | 'help' | 'agency_creating' | 'verified';
export interface AccessChoice { situation: AccessSituation; status: AccessStatus; account_ref: string }

export const emptyAccess = (): AccessChoice => ({ situation: null, status: 'pending', account_ref: '' });

const fieldCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400 transition';

/**
 * Bloco de acesso de uma plataforma (Meta ou Google): pergunta se já tem conta,
 * mostra o passo a passo certo e deixa o cliente dizer em que pé está.
 * Usado no cadastro e no portal.
 */
export const AccessGuideCard: React.FC<{
  platform: Platform; lang: Lang; accessEmail: string; brand: string;
  value: AccessChoice; onChange: (patch: Partial<AccessChoice>) => void; disabled?: boolean;
}> = ({ platform, lang, accessEmail, brand, value: a, onChange, disabled }) => {
  const t = tr(lang);
  const g = platformGuide(platform, lang);
  const [copied, setCopied] = React.useState(false);
  const copy = () => { navigator.clipboard?.writeText(accessEmail).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (a.status === 'verified') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-600 text-white"><Check size={18} /></span>
        <div><p className="font-semibold text-gray-900">{g.name}</p><p className="text-sm text-emerald-800">{t('Acesso conferido pela equipe.', 'Access confirmed by the team.', 'Acceso confirmado por el equipo.')}</p></div>
      </div>
    );
  }

  const badge = {
    client_done: [t('Acesso enviado', 'Access sent', 'Acceso enviado'), 'text-emerald-700 bg-emerald-50'],
    agency_creating: [t('Nós criamos', 'We create it', 'Nosotros la creamos'), 'text-sky-700 bg-sky-50'],
    help: [t('Vamos te ajudar', "We'll help you", 'Te ayudamos'), 'text-amber-700 bg-amber-50'],
    pending: null,
  }[a.status as 'client_done' | 'agency_creating' | 'help' | 'pending'];

  const steps = (items: string[]) => (
    <ol className="space-y-2">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm text-gray-700">
          <span className="w-6 h-6 shrink-0 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );

  const choice = (val: AccessStatus, label: string, icon: React.ReactNode) => (
    <button key={val} type="button" disabled={disabled} onClick={() => onChange({ status: val })}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition disabled:opacity-50 ${a.status === val ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
      {icon}{label}
    </button>
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

  return (
    <div className="rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: brand }}>
          {platform === 'meta' ? <Megaphone size={18} /> : <Search size={18} />}
        </span>
        <h3 className="font-semibold text-gray-900">{g.name}</h3>
        {badge && <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full ${badge[1]}`}>{badge[0]}</span>}
      </div>

      <p className="text-sm text-gray-700 mb-2">{t('Você já tem uma conta de anúncios?', 'Do you already have an ad account?', '¿Ya tienes una cuenta publicitaria?')}</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {([['has_account', t('Sim, já tenho', 'Yes, I do', 'Sí, ya tengo')], ['needs_account', t('Não tenho / não sei', "No / I'm not sure", 'No tengo / no sé')]] as const).map(([sit, label]) => (
          <button key={sit} type="button" disabled={disabled}
            onClick={() => onChange({ situation: sit, status: sit === 'needs_account' && platform === 'google' ? 'agency_creating' : 'pending' })}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition disabled:opacity-50 ${a.situation === sit ? 'text-white border-transparent' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
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
            {choice('pending', t('Faço depois', "I'll do it later", 'Lo hago después'), <Clock size={15} />)}
            {choice('help', t('Prefiro fazer numa chamada', "I'd rather do it on a call", 'Prefiero hacerlo en una llamada'), <Video size={15} />)}
          </div>
          {a.status === 'help' && (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">{t('Combinado: a equipe vai te chamar no WhatsApp e fazemos juntos por vídeo.', "Got it: our team will reach out on WhatsApp and we'll do it together over video.", 'Perfecto: el equipo te contactará por WhatsApp y lo hacemos juntos por video.')}</p>
          )}
        </div>
      )}

      {a.situation === 'needs_account' && platform === 'google' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-sky-50 text-sky-900 text-sm">{g.noAccountIntro}</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {choice('agency_creating', t('Ok, podem criar', 'OK, go ahead', 'Ok, pueden crearla'), <Check size={15} />)}
            {choice('help', t('Prefiro fazer numa chamada', "I'd rather do it on a call", 'Prefiero hacerlo en una llamada'), <Video size={15} />)}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { BarChart3, Check, Clock, Copy, ExternalLink, LifeBuoy, Tags } from 'lucide-react';
import { Lang, tr, DEFAULT_ACCESS_EMAIL } from '../../lib/accessGuides';
import { accessShots } from '../../lib/accessShots';
import { ShotGallery } from './ShotGallery';

/**
 * Acesso às ferramentas de medição (Google Analytics 4 e Google Tag Manager).
 * Já tem: passo a passo com prints para convidar a agência.
 * Não tem / não sabe: a agência cria (é o caminho recomendado para leigo); os prints de criar ficam como opção.
 * A resposta vai para traffic_strategy_data.acessos_rastreamento (sem tabela própria).
 */

export type TrackingTool = 'ga4' | 'gtm';
export type TrackingChoice = {
  situation: 'has_account' | 'needs_account' | null;
  status: 'pending' | 'client_done' | 'help' | 'agency_creating';
};
export const emptyTracking = (): TrackingChoice => ({ situation: null, status: 'pending' });

export const TrackingAccessCard: React.FC<{
  tool: TrackingTool; lang: Lang; brand: string; accessEmail?: string | null;
  value: TrackingChoice; onChange: (v: TrackingChoice) => void; disabled?: boolean;
}> = ({ tool, lang, brand, accessEmail, value: v, onChange, disabled }) => {
  const t = tr(lang);
  const email = accessEmail || DEFAULT_ACCESS_EMAIL;
  const [copied, setCopied] = useState(false);
  const isGa = tool === 'ga4';
  const name = isGa ? 'Google Analytics 4' : 'Google Tag Manager';
  const link = isGa ? 'https://analytics.google.com/' : 'https://tagmanager.google.com/';
  const what = isGa
    ? t('Mede as visitas do site e de onde vêm os contatos.', 'Measures your website visits and where your leads come from.', 'Mide las visitas del sitio y de dónde vienen los contactos.')
    : t('Onde instalamos as medições do site sem mexer no código.', 'Where we install website tracking without touching your code.', 'Donde instalamos las mediciones del sitio sin tocar el código.');

  const choice = (status: TrackingChoice['status'], label: string, icon: React.ReactNode) => (
    <button type="button" disabled={disabled} onClick={() => onChange({ ...v, status })}
      className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition disabled:opacity-50 ${v.status === status ? 'text-white border-transparent' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
      style={v.status === status ? { backgroundColor: brand } : undefined}>
      {icon}{label}
    </button>
  );

  return (
    <div className="p-5 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: brand }}>
          {isGa ? <BarChart3 size={18} /> : <Tags size={18} />}
        </span>
        <h3 className="font-semibold text-gray-900">{name}</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">{what}</p>

      <p className="text-sm text-gray-700 mb-2">{t(`Você já tem ${name}?`, `Do you already have ${name}?`, `¿Ya tienes ${name}?`)}</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {([['has_account', t('Sim, já tenho', 'Yes, I do', 'Sí, ya tengo')], ['needs_account', t('Não tenho / não sei', "No / I'm not sure", 'No tengo / no sé')]] as const).map(([sit, label]) => (
          <button key={sit} type="button" disabled={disabled}
            onClick={() => onChange({ situation: sit, status: sit === 'needs_account' ? 'agency_creating' : 'pending' })}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition disabled:opacity-50 ${v.situation === sit ? 'text-white border-transparent' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
            style={v.situation === sit ? { backgroundColor: brand } : undefined}>
            {label}
          </button>
        ))}
      </div>

      {v.situation === 'has_account' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
            <span className="text-xs text-gray-500">{t('E-mail da agência', 'Agency email', 'Correo de la agencia')}</span>
            <code className="text-sm text-gray-900 flex-1 truncate">{email}</code>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(email); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? t('Copiado', 'Copied', 'Copiado') : t('Copiar', 'Copy', 'Copiar')}
            </button>
          </div>
          <ShotGallery shots={accessShots(tool, 'a', lang)} lang={lang} defaultOpen />
          <a href={link} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 hover:border-gray-300">
            {t(`Abrir ${name}`, `Open ${name}`, `Abrir ${name}`)} <ExternalLink size={14} />
          </a>
          <div className="grid sm:grid-cols-3 gap-2">
            {choice('client_done', t('Já enviei o convite', 'I sent the invite', 'Ya envié la invitación'), <Check size={15} />)}
            {choice('pending', t('Faço depois', "I'll do it later", 'Lo hago después'), <Clock size={15} />)}
            {choice('help', t('Preciso de ajuda', 'I need help', 'Necesito ayuda'), <LifeBuoy size={15} />)}
          </div>
          {v.status === 'help' && (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">{t('Combinado: a equipe vai te chamar no WhatsApp para fazer isso junto, por vídeo.', 'Got it: our team will reach out on WhatsApp to do it together over a video call.', 'Perfecto: el equipo te contactará por WhatsApp para hacerlo juntos por videollamada.')}</p>
          )}
        </div>
      )}

      {v.situation === 'needs_account' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-sky-50 text-sky-900 text-sm">
            {t(`Sem problema: a gente cria o ${name} no nome da sua empresa e ele fica seu. Você não precisa fazer nada agora.`,
              `No problem: we will create ${name} under your business name and you will own it. You don't need to do anything now.`,
              `Sin problema: creamos ${name} a nombre de tu empresa y queda tuyo. No necesitas hacer nada ahora.`)}
          </div>
          <ShotGallery shots={accessShots(tool, 'b', lang)} lang={lang}
            label={t('Prefere criar você mesmo? Veja como', 'Prefer to create it yourself? See how', '¿Prefieres crearlo tú? Mira cómo')} />
        </div>
      )}
    </div>
  );
};

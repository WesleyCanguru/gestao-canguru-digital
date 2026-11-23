import React, { useMemo } from 'react';

/** Países mais comuns primeiro (EUA e Brasil), depois o resto em ordem alfabética. */
export const COUNTRIES: { iso: string; dial: string; flag: string; pt: string; en: string; es: string }[] = [
  { iso: 'US', dial: '1', flag: '🇺🇸', pt: 'Estados Unidos', en: 'United States', es: 'Estados Unidos' },
  { iso: 'BR', dial: '55', flag: '🇧🇷', pt: 'Brasil', en: 'Brazil', es: 'Brasil' },
  { iso: 'MX', dial: '52', flag: '🇲🇽', pt: 'México', en: 'Mexico', es: 'México' },
  { iso: 'CA', dial: '1', flag: '🇨🇦', pt: 'Canadá', en: 'Canada', es: 'Canadá' },
  { iso: 'PT', dial: '351', flag: '🇵🇹', pt: 'Portugal', en: 'Portugal', es: 'Portugal' },
  { iso: 'ES', dial: '34', flag: '🇪🇸', pt: 'Espanha', en: 'Spain', es: 'España' },
  { iso: 'AR', dial: '54', flag: '🇦🇷', pt: 'Argentina', en: 'Argentina', es: 'Argentina' },
  { iso: 'BO', dial: '591', flag: '🇧🇴', pt: 'Bolívia', en: 'Bolivia', es: 'Bolivia' },
  { iso: 'CL', dial: '56', flag: '🇨🇱', pt: 'Chile', en: 'Chile', es: 'Chile' },
  { iso: 'CO', dial: '57', flag: '🇨🇴', pt: 'Colômbia', en: 'Colombia', es: 'Colombia' },
  { iso: 'CR', dial: '506', flag: '🇨🇷', pt: 'Costa Rica', en: 'Costa Rica', es: 'Costa Rica' },
  { iso: 'CU', dial: '53', flag: '🇨🇺', pt: 'Cuba', en: 'Cuba', es: 'Cuba' },
  { iso: 'DO', dial: '1', flag: '🇩🇴', pt: 'República Dominicana', en: 'Dominican Republic', es: 'República Dominicana' },
  { iso: 'EC', dial: '593', flag: '🇪🇨', pt: 'Equador', en: 'Ecuador', es: 'Ecuador' },
  { iso: 'SV', dial: '503', flag: '🇸🇻', pt: 'El Salvador', en: 'El Salvador', es: 'El Salvador' },
  { iso: 'FR', dial: '33', flag: '🇫🇷', pt: 'França', en: 'France', es: 'Francia' },
  { iso: 'DE', dial: '49', flag: '🇩🇪', pt: 'Alemanha', en: 'Germany', es: 'Alemania' },
  { iso: 'GT', dial: '502', flag: '🇬🇹', pt: 'Guatemala', en: 'Guatemala', es: 'Guatemala' },
  { iso: 'HN', dial: '504', flag: '🇭🇳', pt: 'Honduras', en: 'Honduras', es: 'Honduras' },
  { iso: 'IT', dial: '39', flag: '🇮🇹', pt: 'Itália', en: 'Italy', es: 'Italia' },
  { iso: 'JP', dial: '81', flag: '🇯🇵', pt: 'Japão', en: 'Japan', es: 'Japón' },
  { iso: 'NI', dial: '505', flag: '🇳🇮', pt: 'Nicarágua', en: 'Nicaragua', es: 'Nicaragua' },
  { iso: 'PA', dial: '507', flag: '🇵🇦', pt: 'Panamá', en: 'Panama', es: 'Panamá' },
  { iso: 'PY', dial: '595', flag: '🇵🇾', pt: 'Paraguai', en: 'Paraguay', es: 'Paraguay' },
  { iso: 'PE', dial: '51', flag: '🇵🇪', pt: 'Peru', en: 'Peru', es: 'Perú' },
  { iso: 'PR', dial: '1', flag: '🇵🇷', pt: 'Porto Rico', en: 'Puerto Rico', es: 'Puerto Rico' },
  { iso: 'GB', dial: '44', flag: '🇬🇧', pt: 'Reino Unido', en: 'United Kingdom', es: 'Reino Unido' },
  { iso: 'UY', dial: '598', flag: '🇺🇾', pt: 'Uruguai', en: 'Uruguay', es: 'Uruguay' },
  { iso: 'VE', dial: '58', flag: '🇻🇪', pt: 'Venezuela', en: 'Venezuela', es: 'Venezuela' },
];

/** Separa "+55 11 98367-0018" em país e número. Sem "+": usa o país padrão. */
export const splitPhone = (full: string, fallbackIso: string): { iso: string; number: string } => {
  const s = (full || '').trim();
  if (s.startsWith('+')) {
    const digits = s.slice(1).replace(/\D/g, '');
    // Códigos mais longos primeiro (ex.: 351 antes de 3)
    const byLen = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    const hit = byLen.find(c => digits.startsWith(c.dial));
    if (hit) {
      const iso = hit.dial === '1' ? (['US', 'CA', 'DO', 'PR'].includes(fallbackIso) ? fallbackIso : 'US') : hit.iso;
      const rest = s.slice(1).replace(/^\s*/, '');
      // Tira o código do começo mantendo a formatação que a pessoa digitou
      let i = 0, matched = 0;
      while (i < rest.length && matched < hit.dial.length) { if (/\d/.test(rest[i])) matched++; i++; }
      return { iso, number: rest.slice(i).trim() };
    }
  }
  return { iso: fallbackIso, number: s };
};

export const joinPhone = (iso: string, number: string) => {
  const c = COUNTRIES.find(x => x.iso === iso) || COUNTRIES[0];
  const n = number.trim().replace(/^\+/, '');
  return n ? `+${c.dial} ${n}` : '';
};

/** Campo de telefone com o país (bandeira + código) separado do número, para o WhatsApp sempre funcionar. */
export const PhoneField: React.FC<{
  value: string; onChange: (v: string) => void; defaultIso: string; lang: 'pt' | 'en' | 'es'; className: string; placeholder?: string;
}> = ({ value, onChange, defaultIso, lang, className, placeholder }) => {
  const { iso, number } = useMemo(() => splitPhone(value, defaultIso), [value, defaultIso]);
  const c = COUNTRIES.find(x => x.iso === iso) || COUNTRIES[0];
  return (
    <div className="flex gap-2">
      <div className="relative shrink-0">
        <select
          aria-label={lang === 'en' ? 'Country' : lang === 'es' ? 'País' : 'País'}
          value={iso}
          onChange={e => onChange(joinPhone(e.target.value, number))}
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
        >
          {COUNTRIES.map(x => <option key={x.iso} value={x.iso}>{x.flag} {x[lang]} (+{x.dial})</option>)}
        </select>
        <div className={`${className} !w-auto flex items-center gap-1.5 pointer-events-none whitespace-nowrap`}>
          <span className="text-base leading-none">{c.flag}</span>
          <span className="font-semibold text-gray-700">+{c.dial}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-400"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
        </div>
      </div>
      <input
        type="tel" inputMode="tel" autoComplete="tel-national" className={className}
        value={number} placeholder={placeholder ?? (iso === 'BR' ? '11 98765-4321' : iso === 'US' ? '(813) 555-0123' : '')}
        onChange={e => {
          const v = e.target.value;
          // Colou com "+"? Respeita o país que veio junto
          if (v.trim().startsWith('+')) { const p = splitPhone(v, iso); onChange(joinPhone(p.iso, p.number)); }
          else onChange(joinPhone(iso, v));
        }}
      />
    </div>
  );
};

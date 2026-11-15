// Idiomas, fusos e padrões usados no cadastro do cliente.
export const CLIENT_LANGS = [
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'Inglês' },
  { code: 'es', label: 'Espanhol' },
] as const;

export const TIMEZONES: { tz: string; label: string }[] = [
  { tz: 'America/Sao_Paulo', label: 'Brasília (São Paulo, Rio, BH, Sul)' },
  { tz: 'America/Manaus', label: 'Manaus (Amazonas)' },
  { tz: 'America/Cuiaba', label: 'Cuiabá (MT, MS)' },
  { tz: 'America/Fortaleza', label: 'Fortaleza (Nordeste)' },
  { tz: 'America/Belem', label: 'Belém (Pará, Amapá)' },
  { tz: 'America/Rio_Branco', label: 'Rio Branco (Acre)' },
  { tz: 'America/Noronha', label: 'Fernando de Noronha' },
  { tz: 'America/New_York', label: 'EUA Leste (Nova York, Miami, Orlando, Tampa)' },
  { tz: 'America/Chicago', label: 'EUA Centro (Chicago, Houston, Dallas)' },
  { tz: 'America/Denver', label: 'EUA Montanha (Denver)' },
  { tz: 'America/Phoenix', label: 'EUA Arizona (Phoenix)' },
  { tz: 'America/Los_Angeles', label: 'EUA Pacífico (Los Angeles, San Diego, Seattle)' },
  { tz: 'Europe/Lisbon', label: 'Lisboa / Porto' },
  { tz: 'Europe/London', label: 'Londres' },
  { tz: 'Europe/Madrid', label: 'Madri / Barcelona' },
  { tz: 'Europe/Paris', label: 'Paris' },
  { tz: 'America/Mexico_City', label: 'Cidade do México' },
  { tz: 'America/Bogota', label: 'Bogotá' },
  { tz: 'America/Buenos_Aires', label: 'Buenos Aires' },
  { tz: 'America/Santiago', label: 'Santiago' },
];

/** Moeda e fuso sugeridos quando o idioma é escolhido (só sugestão: dá para trocar). */
export const LANG_DEFAULTS: Record<string, { currency: string; timezone: string }> = {
  pt: { currency: 'BRL', timezone: 'America/Sao_Paulo' },
  en: { currency: 'USD', timezone: 'America/New_York' },
  es: { currency: 'EUR', timezone: 'Europe/Madrid' },
};

export const TEAM_FRONTS = [
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'social', label: 'Social media' },
  { key: 'trafego', label: 'Tráfego' },
  { key: 'design', label: 'Design' },
] as const;

export const viewerTimezone = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'; } catch { return 'America/Sao_Paulo'; }
};

const offsetMinutes = (tz: string, at: Date): number => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at);
  const g = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'));
  return Math.round((asUtc - at.getTime()) / 60000);
};

/**
 * Converte "HH:mm" do dia (DD-MM-YYYY do date_key) no fuso do cliente para o fuso de quem está vendo.
 * Retorna null quando os fusos são iguais naquele dia ou quando falta dado.
 */
export const timeInViewerTz = (dateKey: string | null | undefined, hhmm: string | null | undefined, clientTz: string | null | undefined, viewerTz = viewerTimezone()): { time: string; dayShift: number } | null => {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(dateKey || '');
  const t = /^(\d{1,2}):(\d{2})/.exec((hhmm || '').trim());
  if (!m || !t || !clientTz || clientTz === viewerTz) return null;
  const [d, mo, y] = [parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)];
  const naive = Date.UTC(y, mo, d, parseInt(t[1], 10), parseInt(t[2], 10));
  const instant = new Date(naive - offsetMinutes(clientTz, new Date(naive)) * 60000);
  const diff = offsetMinutes(viewerTz, instant) - offsetMinutes(clientTz, instant);
  if (diff === 0) return null;
  const local = new Date(naive + diff * 60000);
  const hh = String(local.getUTCHours()).padStart(2, '0'); const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return { time: `${hh}:${mm}`, dayShift: local.getUTCDate() !== d ? (local.getTime() > naive ? 1 : -1) : 0 };
};

/** Nome curto da cidade do fuso, para rótulos ("Paris", "Brasília"). */
export const tzShort = (tz: string): string => {
  if (tz === 'America/Sao_Paulo') return 'Brasília';
  return (tz.split('/').pop() || tz).replace(/_/g, ' ');
};

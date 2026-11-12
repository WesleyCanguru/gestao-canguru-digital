/** Primeiro nome para saudação, pulando títulos como Dr., Dra., Sr., Mr. */
const TITLES = new Set(['dr', 'dra', 'sr', 'sra', 'srta', 'prof', 'profa', 'mr', 'mrs', 'ms', 'miss', 'don', 'doña', 'dona', 'eng']);

export function firstNameOf(full?: string | null): string {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  const first = parts.find(p => !TITLES.has(p.replace(/\.$/, '').toLowerCase()));
  return first || parts[0] || '';
}

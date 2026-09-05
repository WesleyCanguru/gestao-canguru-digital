/**
 * Utilitários robustos para tratamento de inputs de valores monetários (R$).
 * Suporta formatos brasileiros com vírgula (ex: 150,50 ou 1.500,50),
 * formato com ponto (ex: 150.50 ou 1500) e limpeza de caracteres não numéricos.
 */

export function parseCurrencyInput(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  let clean = String(value).trim();
  if (!clean) return 0;

  // Remove símbolos de moeda ou espaços se houver (R$, $, etc)
  clean = clean.replace(/[R$\s]/g, '');

  // Se tiver tanto ponto quanto vírgula (ex: 1.500,50 ou 1,500.50)
  if (clean.includes('.') && clean.includes(',')) {
    const lastDotIndex = clean.lastIndexOf('.');
    const lastCommaIndex = clean.lastIndexOf(',');

    if (lastCommaIndex > lastDotIndex) {
      // Padrão brasileiro: 1.500,50 -> 1500.50
      const normalized = clean.replace(/\./g, '').replace(',', '.');
      const val = parseFloat(normalized);
      return isNaN(val) ? 0 : val;
    } else {
      // Padrão americano: 1,500.50 -> 1500.50
      const normalized = clean.replace(/,/g, '');
      const val = parseFloat(normalized);
      return isNaN(val) ? 0 : val;
    }
  }

  // Se tiver apenas vírgula (ex: "150,50" -> 150.5)
  if (clean.includes(',')) {
    const normalized = clean.replace(',', '.');
    const val = parseFloat(normalized);
    return isNaN(val) ? 0 : val;
  }

  // Se tiver apenas ponto ou dígitos normais (ex: "150.50" -> 150.5)
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

/**
 * Formata um valor numérico para string com vírgula amigável para edição se necessário.
 */
export function formatValueForInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  if (isNaN(value) || value === 0) return '';
  // Se for número inteiro, retorna direto; se tiver decimais, formata com vírgula
  return value.toString().replace('.', ',');
}

export function formatCurrency(value: number | string | null | undefined): string {
  const num = parseCurrencyInput(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

import dayjs from 'dayjs';
import { Client } from '../types';

export interface ClientLtvDetails {
  clientId: string;
  clientName: string;
  monthlyTicket: number;
  monthsActive: number;
  realDaysActive: number;
  realMonthsActive: number;
  timeWithAgencyLabel: string;
  projectedMonths: number;
  ltvEstimated: number;
  isCancelled: boolean;
  explanation: string;
}

/**
 * Formata o tempo real de casa do cliente de forma amigável e legível.
 */
export function formatTimeWithAgency(startDateStr?: string | null, endDateStr?: string | null): string {
  if (!startDateStr) return 'Novo cliente';
  const start = dayjs(startDateStr);
  if (!start.isValid()) return 'Novo cliente';

  const end = endDateStr ? dayjs(endDateStr) : dayjs();
  const diffDays = Math.max(0, end.diff(start, 'day'));

  if (diffDays === 0) return 'Novo cliente (hoje)';
  if (diffDays === 1) return 'Novo cliente (1 dia)';
  if (diffDays < 30) return `Novo cliente (${diffDays} dias)`;

  const diffMonths = Math.max(1, Math.floor(diffDays / 30.4375));
  if (diffMonths === 1) return '1 mês';
  return `${diffMonths} meses`;
}

/**
 * Calcula o tempo ativo em meses de um cliente.
 */
export function getClientMonthsActive(client: any): number {
  const startDateStr = client.contract?.contract_start_date || client.created_at;
  if (!startDateStr) return 1;

  const start = dayjs(startDateStr);
  const isCancelled = client.client_status === 'cancelled' || client.client_status === 'inactive';
  const end = (isCancelled && client.cancelled_at) ? dayjs(client.cancelled_at) : dayjs();

  const diffMonths = end.diff(start, 'month') + 1;
  return Math.max(1, diffMonths);
}

/**
 * Calcula a média de permanência dos clientes da agência (em meses).
 * Se houver clientes com >12 meses, usa a média deles. Caso contrário, usa o padrão de 29 meses.
 */
export function calculateAgencyAvgRetentionMonths(clients: any[]): number {
  if (!clients || clients.length === 0) return 29;

  const matureClients = clients.filter(c => getClientMonthsActive(c) > 12);

  if (matureClients.length === 0) return 29;

  const totalMonths = matureClients.reduce((acc, c) => acc + getClientMonthsActive(c), 0);
  const avg = Math.round(totalMonths / matureClients.length);
  return Math.max(12, avg);
}

/**
 * Retorna o valor mensal atual (ticket) do cliente.
 */
export function getClientMonthlyTicket(client: any): number {
  if (client.contract?.contract_value !== undefined && client.contract?.contract_value !== null) {
    return Number(client.contract.contract_value) || 0;
  }
  return Number(client.base_value) || 0;
}

/**
 * Calcula o LTV de um cliente individual.
 */
export function calculateSingleClientLtv(
  client: any,
  avgRetentionMonths: number = 29,
  paidBillingsSum?: number
): ClientLtvDetails {
  const monthlyTicket = getClientMonthlyTicket(client);
  const monthsActive = getClientMonthsActive(client);
  const startDateStr = client.contract?.contract_start_date || client.created_at;
  const isCancelled = client.client_status === 'cancelled' || client.client_status === 'inactive';
  const endDateStr = (isCancelled && client.cancelled_at) ? client.cancelled_at : undefined;
  
  const timeWithAgencyLabel = formatTimeWithAgency(startDateStr, endDateStr);
  const start = startDateStr ? dayjs(startDateStr) : dayjs();
  const end = endDateStr ? dayjs(endDateStr) : dayjs();
  const realDaysActive = Math.max(0, end.diff(start, 'day'));
  const realMonthsActive = Math.max(0, Math.floor(realDaysActive / 30.4375));

  if (isCancelled) {
    // Para clientes cancelados: usar o valor real faturado (paidBillingsSum) se disponível, senão ticket x meses ativos
    const ltvReal = (paidBillingsSum !== undefined && paidBillingsSum > 0)
      ? paidBillingsSum
      : (monthlyTicket * monthsActive);

    const formattedTicket = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(monthlyTicket);

    return {
      clientId: client.id,
      clientName: client.name || 'Cliente',
      monthlyTicket,
      monthsActive,
      realDaysActive,
      realMonthsActive,
      timeWithAgencyLabel,
      projectedMonths: monthsActive,
      ltvEstimated: ltvReal,
      isCancelled: true,
      explanation: `LTV Real: ticket ${formattedTicket} × ${monthsActive} ${monthsActive === 1 ? 'mês' : 'meses'} de permanência`
    };
  }

  // Para clientes ativos:
  // Se tem mais de 12 meses, usa o tempo real. Se for novo (<12 meses), usa a média estimada da agência (ex: 29 meses).
  const projectedMonths = monthsActive > 12 ? monthsActive : avgRetentionMonths;
  const ltvEstimated = monthlyTicket * projectedMonths;

  const formattedTicket = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(monthlyTicket);

  return {
    clientId: client.id,
    clientName: client.name || 'Cliente',
    monthlyTicket,
    monthsActive,
    realDaysActive,
    realMonthsActive,
    timeWithAgencyLabel,
    projectedMonths,
    ltvEstimated,
    isCancelled: false,
    explanation: `ticket ${formattedTicket} × projeção de ${projectedMonths} meses (${timeWithAgencyLabel})`
  };
}

/**
 * Calcula e ordena o LTV de todos os clientes da agência.
 */
export function calculateAllClientsLtv(
  clients: any[],
  paidBillingsMap?: Record<string, number>
): ClientLtvDetails[] {
  const activeAndMature = clients.filter(c => !c.is_internal);
  const avgRetention = calculateAgencyAvgRetentionMonths(activeAndMature);

  const results = activeAndMature.map(client => {
    const paidSum = paidBillingsMap ? paidBillingsMap[client.id] : undefined;
    return calculateSingleClientLtv(client, avgRetention, paidSum);
  });

  // Ordenar do maior LTV para o menor
  return results.sort((a, b) => b.ltvEstimated - a.ltvEstimated);
}

/**
 * Formata um valor de LTV de forma compacta (ex: R$ 38k ou R$ 120.000).
 */
export function formatCompactLtv(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1).replace('.', ',')}M`;
  }
  if (value >= 1000) {
    // Se for múltiplo limpo de 1000 ou curto, ex: R$ 38k ou formato R$ 38.000
    if (value % 1000 === 0) {
      return `R$ ${new Intl.NumberFormat('pt-BR').format(value)}`;
    }
    return `R$ ${(value / 1000).toFixed(1).replace('.', ',')}k`;
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

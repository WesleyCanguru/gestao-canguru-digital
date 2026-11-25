import type { AgencyCRM } from '../types';

// Motivos de perda padrão de qualquer CRM da agência.
export const DEFAULT_LOSS_REASONS = ['Não respondeu', 'Achou caro', 'Não era o momento', 'Escolheu concorrente'];

// Um CRM pode ter a própria lista: campo `loss_reasons` na etapa de perda (id "perdido")
// dentro de agency_crms.kanban_stages. Sem esse campo, vale a lista padrão.
export const getLossReasons = (crm?: AgencyCRM | null): string[] => {
  const lost = crm?.kanban_stages?.find(s => s.id === 'perdido');
  const custom = lost?.loss_reasons?.filter(r => typeof r === 'string' && r.trim() && r !== 'Outro');
  return custom && custom.length ? custom : DEFAULT_LOSS_REASONS;
};

// Opções exibidas: a lista do CRM + "Outro" (abre campo livre).
export const getLossReasonOptions = (crm?: AgencyCRM | null): string[] => [...getLossReasons(crm), 'Outro'];

export const isPredefinedLossReason = (crm: AgencyCRM | null | undefined, reason?: string | null): boolean =>
  !!reason && getLossReasons(crm).includes(reason);

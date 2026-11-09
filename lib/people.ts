// Pessoas e prazos: etapas da entrega, mensagens de cobrança e helpers.
import dayjs from 'dayjs';

export type TaskStage = 'a_fazer' | 'fazendo' | 'entregue' | 'alteracao' | 'aprovado';

export const TASK_STAGES: { id: TaskStage; label: string; short: string; cls: string }[] = [
  { id: 'a_fazer', label: 'A fazer', short: 'A fazer', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  { id: 'fazendo', label: 'Fazendo', short: 'Fazendo', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'entregue', label: 'Entregue, em revisão', short: 'Em revisão', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: 'alteracao', label: 'Em alteração', short: 'Em alteração', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'aprovado', label: 'Aprovado', short: 'Aprovado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];
export const stageInfo = (s?: string | null) => TASK_STAGES.find(x => x.id === s) || null;

/** Só números, com DDI. Sem DDI e com 10-11 dígitos, assume Brasil. */
export const waNumber = (raw?: string | null) => {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  return d.length <= 11 ? '55' + d : d;
};

export const firstName = (n?: string | null) => String(n || '').trim().split(/\s+/)[0] || '';

/** Mensagem de cobrança pronta, conforme o prazo e a etapa. */
export function nudgeMessage(t: { title: string; due_date?: string | null; stage?: string | null; client?: { name?: string } | null }, person: string) {
  const who = firstName(person);
  const what = `"${t.title}"${t.client?.name ? ` (${t.client.name})` : ''}`;
  const due = t.due_date ? dayjs(t.due_date) : null;
  const today = dayjs().startOf('day');
  if (t.stage === 'alteracao') return `Oi ${who}, tudo bem? Como estão as alterações de ${what}? Consegue me mandar hoje?`;
  if (due && due.isBefore(today)) return `Oi ${who}, tudo bem? ${what} era para ${due.format('DD/MM')}. Consegue me mandar hoje? Se tiver algum problema, me avisa.`;
  if (due && due.isSame(today)) return `Oi ${who}, tudo bem? Passando para lembrar que ${what} é para hoje. Está tudo certo?`;
  if (due) return `Oi ${who}, tudo bem? Como está ${what}? A entrega é ${due.format('DD/MM')}.`;
  return `Oi ${who}, tudo bem? Como está ${what}?`;
}

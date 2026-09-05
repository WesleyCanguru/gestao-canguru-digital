import dayjs from 'dayjs';
import { supabase } from './supabase';
import { AgencyTask, ProcessTemplate } from '../types';

export interface ProcessTypeInfo {
  id: string;
  name: string;
  iconName: string;
  color: string;
  keywords: string[];
}

export const PROCESS_TYPES_CONFIG: ProcessTypeInfo[] = [
  {
    id: 'reels',
    name: 'Publicação de Reels',
    iconName: 'Video',
    color: 'text-pink-500 bg-pink-50 border-pink-100',
    keywords: ['reels', 'reel', 'vídeo reels', 'video reels', 'video curto', 'tiktok']
  },
  {
    id: 'carrossel',
    name: 'Publicação / Carrossel',
    iconName: 'ImageIcon',
    color: 'text-purple-500 bg-purple-50 border-purple-100',
    keywords: ['publicação', 'publicacao', 'carrossel', 'arte feed', 'post feed', 'post carrossel', 'arte carrossel']
  },
  {
    id: 'campanha_meta',
    name: 'Campanha Meta Ads',
    iconName: 'Megaphone',
    color: 'text-blue-500 bg-blue-50 border-blue-100',
    keywords: ['meta ads', 'campanha meta', 'facebook ads', 'face ads', 'anúncios meta', 'anuncios meta', 'trafego meta']
  },
  {
    id: 'campanha_google',
    name: 'Campanha Google Ads',
    iconName: 'Search',
    color: 'text-green-500 bg-green-50 border-green-100',
    keywords: ['google ads', 'campanha google', 'anúncios google', 'anuncios google', 'adwords', 'trafego google']
  },
  {
    id: 'relatorio_mensal',
    name: 'Relatório Mensal',
    iconName: 'BarChart3',
    color: 'text-orange-500 bg-orange-50 border-orange-100',
    keywords: ['relatório mensal', 'relatorio mensal', 'relatório', 'relatorio', 'report mensal', 'apresentação de métricas', 'metricas mensais']
  }
];

export interface DefaultProcessStep {
  title: string;
  sla_days: number;
  description?: string;
  responsible: 'wesley' | 'sarah' | 'client';
}

export const DEFAULT_TEMPLATE_STEPS: Record<string, DefaultProcessStep[]> = {
  reels: [
    { title: 'Definir tema e escrever roteiro', sla_days: 1, responsible: 'wesley' },
    { title: 'Enviar roteiro para o cliente gravar', sla_days: 1, responsible: 'wesley' },
    { title: 'Receber vídeo gravado do cliente', sla_days: 2, responsible: 'client' },
    { title: 'Enviar vídeo para a Sarah editar', sla_days: 1, responsible: 'wesley' },
    { title: 'Receber vídeo editado da Sarah', sla_days: 2, responsible: 'sarah' },
    { title: 'Revisar e aprovar edição', sla_days: 1, responsible: 'wesley' },
    { title: 'Escrever legenda + hashtags', sla_days: 1, responsible: 'wesley' },
    { title: 'Agendar ou publicar', sla_days: 1, responsible: 'wesley' }
  ],
  carrossel: [
    { title: 'Definir tema e pauta da publicação', sla_days: 1, responsible: 'wesley' },
    { title: 'Escrever copy', sla_days: 1, responsible: 'wesley' },
    { title: 'Enviar brief para a Designer', sla_days: 1, responsible: 'wesley' },
    { title: 'Receber artes da Designer', sla_days: 2, responsible: 'sarah' },
    { title: 'Revisar e aprovar artes', sla_days: 1, responsible: 'wesley' },
    { title: 'Escrever legenda + hashtags', sla_days: 1, responsible: 'wesley' },
    { title: 'Agendar no mapa editorial da Bolsa', sla_days: 1, responsible: 'wesley' }
  ],
  campanha_meta: [
    { title: 'Desenhar estratégia', sla_days: 1, responsible: 'wesley' },
    { title: 'Solicitar criativos para Designer', sla_days: 1, responsible: 'wesley' },
    { title: 'Receber e aprovar criativos', sla_days: 2, responsible: 'wesley' },
    { title: 'Escrever copies dos anúncios', sla_days: 1, responsible: 'wesley' },
    { title: 'Criar campanha no Gerenciador de Anúncios', sla_days: 1, responsible: 'wesley' },
    { title: 'Configurar conjunto de anúncios', sla_days: 1, responsible: 'wesley' },
    { title: 'Subir anúncios e copys', sla_days: 1, responsible: 'wesley' },
    { title: 'Revisão final antes de publicar', sla_days: 1, responsible: 'wesley' },
    { title: 'Publicar e monitorar aprovação e primeiras 24h', sla_days: 1, responsible: 'wesley' }
  ],
  campanha_google: [
    { title: 'Desenhar estratégia', sla_days: 1, responsible: 'wesley' },
    { title: 'Escrever copies dos anúncios', sla_days: 1, responsible: 'wesley' },
    { title: 'Configurar campanha no Google Ads', sla_days: 1, responsible: 'wesley' },
    { title: 'Subir anúncios e extensões', sla_days: 1, responsible: 'wesley' },
    { title: 'Revisão final antes de publicar', sla_days: 1, responsible: 'wesley' },
    { title: 'Publicar e monitorar aprovação e primeiras 24h', sla_days: 1, responsible: 'wesley' }
  ],
  relatorio_mensal: [
    { title: 'Definir período e coletar dados do Meta Ads', sla_days: 1, responsible: 'wesley' },
    { title: 'Coletar dados do Google Ads', sla_days: 1, responsible: 'wesley' },
    { title: 'Coletar dados do Instagram Insights', sla_days: 1, responsible: 'wesley' },
    { title: 'Analisar resultados vs metas', sla_days: 1, responsible: 'wesley' },
    { title: 'Escrever análise e recomendações', sla_days: 1, responsible: 'wesley' },
    { title: 'Montar apresentação visual do relatório', sla_days: 2, responsible: 'wesley' },
    { title: 'Enviar relatório para o cliente', sla_days: 1, responsible: 'wesley' },
    { title: 'Agendar call de apresentação (se necessário)', sla_days: 1, responsible: 'client' }
  ]
};

/**
 * Adiciona dias úteis a uma data (pula sábados e domingos).
 */
export function addBusinessDays(startDate: dayjs.Dayjs | Date | string, days: number): dayjs.Dayjs {
  let current = dayjs(startDate);
  
  // Se começar em final de semana, pula para segunda-feira
  if (current.day() === 6) current = current.add(2, 'day');
  else if (current.day() === 0) current = current.add(1, 'day');

  let remaining = Math.max(0, days);
  while (remaining > 0) {
    current = current.add(1, 'day');
    // Se for sábado (6) ou domingo (0), não consome o dia útil
    if (current.day() !== 0 && current.day() !== 6) {
      remaining--;
    }
  }

  return current;
}

/**
 * Detecta se o título ou tipo de tarefa corresponde a algum template de processo.
 */
export function matchProcessTemplate(title: string, selectedType?: string): ProcessTypeInfo | null {
  if (selectedType) {
    const found = PROCESS_TYPES_CONFIG.find(p => p.id === selectedType);
    if (found) return found;
  }

  if (!title || !title.trim()) return null;
  const clean = title.toLowerCase().trim();

  for (const config of PROCESS_TYPES_CONFIG) {
    for (const kw of config.keywords) {
      if (clean.includes(kw)) {
        return config;
      }
    }
  }

  return null;
}

const META_PREFIX = '<!--process_meta:';
const META_SUFFIX = '-->';

/**
 * Extrai metadados de processo armazenados na descrição (para resiliência retrocompatível).
 */
export function parseTaskProcessMeta(task: { description?: string | null; parent_task_id?: string | null; sla_days?: number | null; task_type?: string | null }): {
  parent_task_id: string | null;
  sla_days: number | null;
  task_type: string | null;
} {
  let parent_task_id = task.parent_task_id || null;
  let sla_days = task.sla_days ?? null;
  let task_type = task.task_type || null;

  if (task.description && task.description.includes(META_PREFIX)) {
    try {
      const start = task.description.indexOf(META_PREFIX) + META_PREFIX.length;
      const end = task.description.indexOf(META_SUFFIX, start);
      if (end > start) {
        const jsonStr = task.description.substring(start, end);
        const parsed = JSON.parse(jsonStr);
        if (parsed.parent_task_id && !parent_task_id) parent_task_id = parsed.parent_task_id;
        if (parsed.sla_days !== undefined && sla_days === null) sla_days = parsed.sla_days;
        if (parsed.task_type && !task_type) task_type = parsed.task_type;
      }
    } catch {
      // Ignora erro de parse de metadados
    }
  }

  return { parent_task_id, sla_days, task_type };
}

/**
 * Codifica metadados no final da descrição.
 */
export function appendProcessMetaToDescription(
  desc: string | undefined | null,
  meta: { parent_task_id?: string | null; sla_days?: number | null; task_type?: string | null }
): string {
  const baseDesc = cleanDescriptionFromMeta(desc);
  const jsonStr = JSON.stringify(meta);
  const tag = `\n${META_PREFIX}${jsonStr}${META_SUFFIX}`;
  return baseDesc ? `${baseDesc}${tag}` : tag.trim();
}

/**
 * Limpa a tag interna de metadados para exibição limpa ao usuário.
 */
export function cleanDescriptionFromMeta(desc?: string | null): string {
  if (!desc) return '';
  if (!desc.includes(META_PREFIX)) return desc;
  const regex = new RegExp(`${META_PREFIX}.*?${META_SUFFIX}`, 'gs');
  return desc.replace(regex, '').trim();
}

/**
 * Calcula os dias de atraso de uma data limite vencida.
 */
export function getOverdueDays(dueDateStr?: string | null): number {
  if (!dueDateStr) return 0;
  const due = dayjs(dueDateStr);
  const today = dayjs().startOf('day');
  if (due.isBefore(today, 'day')) {
    return today.diff(due, 'day');
  }
  return 0;
}

/**
 * Análise de SLA de um conjunto de sub-tarefas de uma tarefa principal.
 */
export function getTaskSlaAnalysis(subtasks: AgencyTask[]) {
  if (!subtasks || subtasks.length === 0) {
    return {
      hasProcess: false,
      totalSteps: 0,
      completedSteps: 0,
      hasOverdue: false,
      overdueCount: 0,
      maxOverdueDays: 0,
      currentStep: null as AgencyTask | null,
      progressPercent: 0
    };
  }

  const totalSteps = subtasks.length;
  const completedSteps = subtasks.filter(s => s.status === 'completed').length;
  const pendingSteps = subtasks.filter(s => s.status !== 'completed');

  let overdueCount = 0;
  let maxOverdueDays = 0;

  pendingSteps.forEach(step => {
    const overdueDays = getOverdueDays(step.due_date);
    if (overdueDays > 0) {
      overdueCount++;
      if (overdueDays > maxOverdueDays) {
        maxOverdueDays = overdueDays;
      }
    }
  });

  const currentStep = pendingSteps[0] || null;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return {
    hasProcess: true,
    totalSteps,
    completedSteps,
    hasOverdue: overdueCount > 0,
    overdueCount,
    maxOverdueDays,
    currentStep,
    progressPercent
  };
}

/**
 * Cria a tarefa principal e gera automaticamente as sub-tarefas (steps) com SLA calculado.
 */
export async function createProcessTaskWithSteps(params: {
  agencyId: number;
  title: string;
  clientId?: string | null;
  priority: string;
  description?: string;
  processType: string;
  startDate?: string | Date;
}): Promise<{ mainTask: any; subtasks: any[] }> {
  const { agencyId, title, clientId, priority, description, processType, startDate } = params;
  const baseDate = startDate ? dayjs(startDate) : dayjs();

  // 1. Buscar templates do banco para este tipo de processo
  let stepsToUse: { title: string; sla_days: number; description?: string; responsible?: string }[] = [];
  
  try {
    const { data: dbTemplates } = await supabase
      .from('process_templates')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('process_type', processType)
      .is('parent_id', null)
      .order('position');

    if (dbTemplates && dbTemplates.length > 0) {
      stepsToUse = dbTemplates.map(t => {
        // Tenta ler sla_days da coluna ou dos metadados da descrição
        let sla = t.sla_days ?? null;
        if (sla === null && t.description && t.description.includes('[sla:')) {
          const match = t.description.match(/\[sla:(\d+)\]/);
          if (match) sla = parseInt(match[1], 10);
        }
        return {
          title: t.title,
          sla_days: sla !== null && !isNaN(sla) && sla > 0 ? sla : 1,
          description: t.description || undefined,
          responsible: t.responsible || 'agency'
        };
      });
    }
  } catch (err) {
    console.warn('Erro ao carregar templates do processo:', err);
  }

  // Se não encontrou no banco para esta agência, usa templates padrão do sistema
  if (stepsToUse.length === 0) {
    const defaults = DEFAULT_TEMPLATE_STEPS[processType] || DEFAULT_TEMPLATE_STEPS['reels'];
    stepsToUse = defaults.map(d => ({
      title: d.title,
      sla_days: d.sla_days || 1,
      description: d.description,
      responsible: d.responsible
    }));
  }

  // 2. Calcular prazo final da tarefa principal (soma total de dias úteis)
  const totalBusinessDays = stepsToUse.reduce((acc, step) => acc + (step.sla_days || 1), 0);
  const mainDueDate = addBusinessDays(baseDate, totalBusinessDays).format('YYYY-MM-DD');

  // 3. Criar tarefa principal com tentativa com colunas nativas e fallback com metadados
  const mainPayloadWithCols: any = {
    title,
    client_id: clientId || null,
    priority,
    due_date: mainDueDate,
    description: description || '',
    recurrence_type: 'none',
    agency_id: agencyId,
    task_type: processType,
    sla_days: totalBusinessDays
  };

  let mainTaskResult: any = null;

  try {
    const { data, error } = await supabase
      .from('agency_tasks')
      .insert([mainPayloadWithCols])
      .select()
      .single();

    if (error) {
      // Falha se colunas não existirem: fallback com metadados na descrição
      console.warn('Fallback para inserção de tarefa sem colunas nativas:', error.message);
      const fallbackDesc = appendProcessMetaToDescription(description, { task_type: processType, sla_days: totalBusinessDays });
      const { data: fallbackData, error: fbErr } = await supabase
        .from('agency_tasks')
        .insert([{
          title,
          client_id: clientId || null,
          priority,
          due_date: mainDueDate,
          description: fallbackDesc,
          recurrence_type: 'none',
          agency_id: agencyId
        }])
        .select()
        .single();

      if (fbErr) throw fbErr;
      mainTaskResult = fallbackData;
    } else {
      mainTaskResult = data;
    }
  } catch (e: any) {
    throw new Error(`Erro ao criar tarefa principal: ${e.message}`);
  }

  // 4. Gerar as sub-tarefas com prazos acumulados
  let accumulatedDays = 0;
  const subtasksCreated: any[] = [];

  for (let i = 0; i < stepsToUse.length; i++) {
    const step = stepsToUse[i];
    accumulatedDays += (step.sla_days || 1);
    const stepDueDate = addBusinessDays(baseDate, accumulatedDays).format('YYYY-MM-DD');
    const stepTitle = `${step.title}`;
    const initialStatus = 'pending';

    const subtaskPayload: any = {
      title: stepTitle,
      client_id: clientId || null,
      priority: priority || 'normal',
      status: initialStatus,
      due_date: stepDueDate,
      description: step.description ? cleanDescriptionFromMeta(step.description) : '',
      recurrence_type: 'none',
      agency_id: agencyId,
      parent_task_id: mainTaskResult.id,
      task_type: processType,
      sla_days: step.sla_days || 1,
      sort_order: i + 1
    };

    try {
      const { data: subData, error: subErr } = await supabase
        .from('agency_tasks')
        .insert([subtaskPayload])
        .select()
        .single();

      if (subErr) {
        // Fallback sem parent_task_id
        const fbSubDesc = appendProcessMetaToDescription(subtaskPayload.description, {
          parent_task_id: mainTaskResult.id,
          sla_days: step.sla_days || 1,
          task_type: processType
        });

        const { data: fbSubData } = await supabase
          .from('agency_tasks')
          .insert([{
            title: stepTitle,
            client_id: clientId || null,
            priority: priority || 'normal',
            status: initialStatus,
            due_date: stepDueDate,
            description: fbSubDesc,
            recurrence_type: 'none',
            agency_id: agencyId,
            sort_order: i + 1
          }])
          .select()
          .single();

        if (fbSubData) subtasksCreated.push(fbSubData);
      } else if (subData) {
        subtasksCreated.push(subData);
      }
    } catch (err) {
      console.error(`Erro ao criar sub-tarefa ${step.title}:`, err);
    }
  }

  return {
    mainTask: mainTaskResult,
    subtasks: subtasksCreated
  };
}

// Regras de ciclo das tarefas recorrentes (diária, semanal, mensal).
// Tarefa recorrente fica sempre com status 'pending'; o ciclo é decidido por completed_at.
type AgencyTask = { status?: string | null; completed_at?: string | null; recurrence_type?: string | null; recurrence_days?: any[] | null };

// --- FUNÇÕES DE RECORRÊNCIA DAS TAREFAS ---

// Retorna o estado de pendência ou agendamento de uma tarefa mensal
export function getMonthlyTaskState(task: AgencyTask, now = new Date()): 'pending' | 'completed' | 'not_started' {
  const diaConfigurado = task.recurrence_days?.[0] ? parseInt(task.recurrence_days[0], 10) : null;
  if (!diaConfigurado) return 'pending';

  const inicioCicloAtual = new Date(now.getFullYear(), now.getMonth(), diaConfigurado);

  if (task.completed_at) {
    const lastDone = new Date(task.completed_at);
    // Se a última conclusão foi depois ou igual ao início do ciclo do mês atual, ela está concluída
    if (lastDone >= inicioCicloAtual && now >= inicioCicloAtual) {
      return 'completed';
    }
    // Caso de cantinho: o mês começou, mas ainda não chegou o dia do mês configurado, e a tarefa foi concluída no ciclo do mês anterior
    if (now < inicioCicloAtual) {
      const inicioCicloMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, diaConfigurado);
      if (lastDone >= inicioCicloMesAnterior) {
        return 'completed';
      }
    }
  }

  // Se hoje ainda não chegou o dia do mês configurado, o ciclo do mês atual ainda não abriu
  if (now < inicioCicloAtual) {
    return 'not_started';
  }

  return 'pending';
}

// Retorna a data/hora do início do ciclo semanal atual (última ocorrência passada do dia configurado)
export function getLastWeeklyOccurrence(recurrenceDays: number[], from: Date): Date | null {
  if (!recurrenceDays || recurrenceDays.length === 0) return null;
  
  let mostRecent: Date | null = null;
  for (const dayOfWeek of recurrenceDays) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    const currentDay = d.getDay(); // 0-6
    const diff = (currentDay - dayOfWeek + 7) % 7;
    d.setDate(d.getDate() - diff);
    
    if (!mostRecent || d > mostRecent) {
      mostRecent = d;
    }
  }
  return mostRecent;
}

// Retorna true se a tarefa precisa ser feita no ciclo atual (está pendente)
export function isTaskPendingInCurrentCycle(task: AgencyTask): boolean {
  if (task.recurrence_type === 'none' || !task.recurrence_type) {
    return task.status !== 'completed';
  }

  if (!task.completed_at) return true;

  const lastDone = new Date(task.completed_at);
  const now = new Date();

  if (task.recurrence_type === 'daily') {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return lastDone < todayStart;
  }

  if (task.recurrence_type === 'weekly') {
    const days = (task.recurrence_days || []).map((d: any) => parseInt(d, 10)).filter((d: any) => !isNaN(d));
    let cycleStart = getLastWeeklyOccurrence(days, now);
    if (!cycleStart) {
      // Fallback: início da semana atual (segunda-feira passada)
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // ajusta para segunda-feira
      cycleStart = new Date(d.setDate(diff));
    }
    return lastDone < cycleStart;
  }

  if (task.recurrence_type === 'monthly') {
    return getMonthlyTaskState(task, now) === 'pending';
  }

  return task.status !== 'completed';
}


import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  Filter, 
  Briefcase, 
  Sparkles,
  Flame,
  Timer,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { supabase, useAuth } from '../../lib/supabase';
import { AgencyTask, TaskSession } from '../../types';
import dayjs from 'dayjs';

type PeriodFilter = 'today' | 'week' | 'month';

interface AggregatedTaskPomodoro {
  taskId: string;
  taskTitle: string;
  clientName: string;
  clientColor?: string;
  isCompleted: boolean;
  completedAt?: string | null;
  totalDurationSeconds: number;
  sessionCount: number;
  lastSessionAt: string;
}

export const TaskVisualizerTab: React.FC<{ clients: any[] }> = ({ clients }) => {
  const { agencyId } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [loading, setLoading] = useState(true);
  const [pomodoroTasks, setPomodoroTasks] = useState<AggregatedTaskPomodoro[]>([]);
  const [completedWithoutPomodoro, setCompletedWithoutPomodoro] = useState<AgencyTask[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalCompletedTasksCount, setTotalCompletedTasksCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, [agencyId, period]);

  const fetchData = async () => {
    if (!agencyId) return;
    try {
      setLoading(true);

      // Calculate period date boundaries
      const now = dayjs();
      let startDateStr = '';

      if (period === 'today') {
        startDateStr = now.startOf('day').toISOString();
      } else if (period === 'week') {
        startDateStr = now.startOf('week').toISOString();
      } else if (period === 'month') {
        startDateStr = now.startOf('month').toISOString();
      }

      // 1. Fetch task sessions in period
      let sessionsData: TaskSession[] = [];
      try {
        const { data: sData, error: sErr } = await supabase
          .from('task_sessions')
          .select('*, task:agency_tasks(id, title, client_id, status, completed_at, client:clients(id, name, color, initials))')
          .eq('agency_id', agencyId)
          .gte('started_at', startDateStr)
          .order('started_at', { ascending: false });

        if (!sErr && sData) {
          sessionsData = sData as any[];
        }
      } catch (err) {
        console.warn('Erro ao consultar task_sessions:', err);
      }

      // 2. Fetch all completed tasks in period
      const { data: allCompletedTasks, error: tErr } = await supabase
        .from('agency_tasks')
        .select('*, client:clients(id, name, color, initials)')
        .eq('agency_id', agencyId)
        .eq('status', 'completed')
        .gte('completed_at', startDateStr)
        .order('completed_at', { ascending: false });

      const completedInPeriod: AgencyTask[] = allCompletedTasks || [];

      // 3. Aggregate sessions by task
      const taskMap: Record<string, AggregatedTaskPomodoro> = {};
      let totalDuration = 0;
      let totalSessionCount = 0;

      sessionsData.forEach(session => {
        totalDuration += session.duration_seconds || 0;
        totalSessionCount += 1;

        const taskId = session.task_id;
        const taskObj = session.task;
        const title = taskObj?.title || 'Tarefa sem título';
        const clientName = taskObj?.client?.name || 'Canguru Digital';
        const clientColor = taskObj?.client?.color;
        const isCompleted = taskObj?.status === 'completed';
        const completedAt = taskObj?.completed_at;

        if (!taskMap[taskId]) {
          taskMap[taskId] = {
            taskId,
            taskTitle: title,
            clientName,
            clientColor,
            isCompleted,
            completedAt,
            totalDurationSeconds: 0,
            sessionCount: 0,
            lastSessionAt: session.started_at
          };
        }

        taskMap[taskId].totalDurationSeconds += (session.duration_seconds || 0);
        taskMap[taskId].sessionCount += 1;
        if (new Date(session.started_at) > new Date(taskMap[taskId].lastSessionAt)) {
          taskMap[taskId].lastSessionAt = session.started_at;
        }
      });

      const aggregatedList = Object.values(taskMap).sort((a, b) => b.totalDurationSeconds - a.totalDurationSeconds);
      setPomodoroTasks(aggregatedList);
      setTotalSeconds(totalDuration);
      setTotalSessions(totalSessionCount);

      // 4. Tasks completed in period WITHOUT any pomodoro sessions in this period
      const pomodoroTaskIds = new Set(Object.keys(taskMap));
      const withoutPomodoro = completedInPeriod.filter(t => !pomodoroTaskIds.has(t.id));
      setCompletedWithoutPomodoro(withoutPomodoro);

      // 5. Total completed tasks (unique set of completed tasks with or without pomodoro in this period)
      const completedWithPomodoroCount = aggregatedList.filter(t => t.isCompleted).length;
      setTotalCompletedTasksCount(completedWithPomodoroCount + withoutPomodoro.length);

    } catch (err) {
      console.error('Erro ao carregar dados do visualizador:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper formatting total time: e.g. "4h 23m" or "38 min"
  const formatDurationFriendly = (totalSec: number) => {
    if (totalSec < 60) return `${totalSec}s`;
    const totalMinutes = Math.floor(totalSec / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim();
    }
    return `${minutes} min`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* HEADER & PERIOD FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-brand-dark tracking-tight flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={22} />
            Visualizador de Produtividade & Tempo
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Acompanhe o tempo investido em cada tarefa através do Modo Foco (Pomodoro).
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center bg-gray-100/80 p-1.5 rounded-2xl border border-black/[0.03] self-start sm:self-auto">
          <button
            onClick={() => setPeriod('today')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              period === 'today'
                ? 'bg-white text-brand-dark shadow-sm'
                : 'text-gray-500 hover:text-brand-dark'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              period === 'week'
                ? 'bg-white text-brand-dark shadow-sm'
                : 'text-gray-500 hover:text-brand-dark'
            }`}
          >
            Esta Semana
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              period === 'month'
                ? 'bg-white text-brand-dark shadow-sm'
                : 'text-gray-500 hover:text-brand-dark'
            }`}
          >
            Este Mês
          </button>
        </div>
      </div>

      {/* SUMMARY STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Tarefas Concluídas */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 size={26} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Tarefas Concluídas
            </span>
            <div className="text-3xl font-black text-brand-dark tracking-tight mt-0.5">
              {totalCompletedTasksCount}
            </div>
          </div>
        </div>

        {/* Card 2: Tempo Total */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Clock size={26} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Tempo Total em Foco
            </span>
            <div className="text-3xl font-black text-brand-dark tracking-tight mt-0.5">
              {formatDurationFriendly(totalSeconds)}
            </div>
          </div>
        </div>

        {/* Card 3: Sessões Pomodoro */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Flame size={26} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Sessões Pomodoro
            </span>
            <div className="text-3xl font-black text-brand-dark tracking-tight mt-0.5">
              {totalSessions}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: TAREFAS COM TEMPO REGISTRADO (POMODORO) */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0D1E3D]/5 text-[#0D1E3D] flex items-center justify-center font-bold">
              🍅
            </div>
            <div>
              <h4 className="text-base font-black text-brand-dark tracking-tight">
                Tarefas com Tempo Registrado
              </h4>
              <p className="text-xs text-gray-400">
                {pomodoroTasks.length} {pomodoroTasks.length === 1 ? 'tarefa com foco monitorado' : 'tarefas com foco monitorado'} no período
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Carregando dados de tempo...</div>
        ) : pomodoroTasks.length === 0 ? (
          <div className="text-center py-12 px-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm space-y-2">
            <Timer className="mx-auto text-gray-300" size={32} />
            <p className="font-semibold text-gray-600">Nenhuma sessão Pomodoro registrada neste período.</p>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Utilize o botão <strong className="text-brand-dark">Modo Foco</strong> na aba "Hoje" para registrar o tempo das suas tarefas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pomodoroTasks.map(item => {
              const minutes = Math.round(item.totalDurationSeconds / 60);
              const isOverStandard = item.totalDurationSeconds > 1500; // > 25min standard
              // Calculate percentage relative to 25min benchmark (1500s)
              const standardBenchmarkSeconds = 1500;
              const fillPercentage = Math.min(100, Math.round((item.totalDurationSeconds / standardBenchmarkSeconds) * 100));
              const relativeExcess = isOverStandard ? Math.min(100, Math.round(((item.totalDurationSeconds - standardBenchmarkSeconds) / standardBenchmarkSeconds) * 100)) : 0;

              return (
                <div 
                  key={item.taskId}
                  className="p-5 rounded-2xl border border-gray-100 hover:border-gray-200 bg-white hover:bg-gray-50/40 transition-all space-y-3.5 shadow-xs"
                >
                  {/* Row 1: Title, Client Tag, Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">📋</span>
                      <h5 className="font-bold text-sm text-brand-dark tracking-tight truncate">
                        {item.taskTitle}
                      </h5>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-[11px] font-semibold text-gray-700">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: item.clientColor || '#0D1E3D' }} 
                        />
                        <span className="truncate max-w-[120px]">{item.clientName}</span>
                      </div>

                      {item.isCompleted ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle2 size={12} /> Concluída
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100">
                          Em Andamento
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Metadata (Time, Sessions, Completed At) */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="font-bold text-brand-dark flex items-center gap-1.5">
                      <Clock size={13} className="text-blue-500" />
                      Tempo total: <span className="text-blue-600">{formatDurationFriendly(item.totalDurationSeconds)}</span>
                    </span>

                    <span className="text-gray-300">•</span>

                    <span className="font-medium flex items-center gap-1">
                      🍅 {item.sessionCount} {item.sessionCount === 1 ? 'sessão' : 'sessões'}
                    </span>

                    {item.completedAt && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-400 flex items-center gap-1">
                          <Calendar size={12} /> Concluída em: {dayjs(item.completedAt).format('DD/MM/YYYY [às] HH:mm')}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Row 3: Visual Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                      {/* Standard 25min benchmark indicator line */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-gray-400/40 z-10" 
                        style={{ left: isOverStandard ? '50%' : '100%' }}
                        title="Marca padrão de 25 min"
                      />

                      {/* Bar Fill */}
                      {!isOverStandard ? (
                        // Standard green progress up to 25m
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, fillPercentage)}%` }}
                        />
                      ) : (
                        // Over standard (> 25m) with distinct color
                        <div className="h-full flex w-full">
                          <div className="h-full bg-emerald-500 w-1/2" title="Primeiros 25 min" />
                          <div 
                            className="h-full bg-blue-600 rounded-r-full transition-all duration-500" 
                            style={{ width: `${Math.min(50, (relativeExcess / 100) * 50)}%` }}
                            title={`Tempo extra: +${formatDurationFriendly(item.totalDurationSeconds - 1500)}`}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold">
                      <span>0m</span>
                      <span className="text-gray-500">Padrão: 25m</span>
                      <span>
                        {isOverStandard ? `> 25min (${formatDurationFriendly(item.totalDurationSeconds)})` : `${minutes}min`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: TAREFAS CONCLUÍDAS SEM POMODORO */}
      {completedWithoutPomodoro.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-gray-400" />
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Tarefas concluídas sem Pomodoro ({completedWithoutPomodoro.length})
            </h4>
          </div>

          <div className="divide-y divide-gray-50 border border-gray-100 rounded-2xl overflow-hidden">
            {completedWithoutPomodoro.map(task => {
              const clientName = task.client?.name || 'Canguru Digital (Interno)';
              const clientColor = task.client?.color;

              return (
                <div 
                  key={task.id} 
                  className="px-4 py-3 flex items-center justify-between gap-3 text-xs bg-gray-50/30 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-gray-400 font-bold">•</span>
                    <span className="font-semibold text-gray-800 truncate">{task.title}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-gray-400 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: clientColor || '#9CA3AF' }} 
                      />
                      <span className="text-gray-600 font-medium">{clientName}</span>
                    </div>

                    {task.completed_at && (
                      <span className="hidden sm:inline">
                        {dayjs(task.completed_at).format('DD/MM/YYYY')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

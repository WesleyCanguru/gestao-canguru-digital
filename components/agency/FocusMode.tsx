import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  X, 
  Target, 
  Sparkles,
  AlertTriangle,
  Flame,
  Coffee,
  Clock,
  ArrowRight,
  Plus,
  Zap,
  Minimize2,
  ChevronLeft
} from 'lucide-react';
import { AgencyTask } from '../../types';
import { useFocus, FOCUS_TIME, SHORT_BREAK_TIME, LONG_BREAK_TIME, READY_CHECK_TIME } from '../../lib/FocusContext';

interface FocusModeProps {
  tasks?: AgencyTask[];
  onOpenNewTask?: () => void;
}

export const FocusMode: React.FC<FocusModeProps> = ({ tasks, onOpenNewTask }) => {
  const {
    focusSession,
    isOpen,
    todayTasks,
    startFocus,
    pauseTimer,
    resumeTimer,
    resetPhase,
    skipBreak,
    readyReturn,
    minimizeFocus,
    closeFocus,
    finishTask,
    exitSession,
    formatTime,
    formatTotalTime,
    isFinishing
  } = useFocus();

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // If not open or if minimized, do not render fullscreen modal
  if (!isOpen || (focusSession && focusSession.isMinimized)) {
    return null;
  }

  // Combined tasks list
  const availableTasks = (tasks && tasks.length > 0) ? tasks : todayTasks;
  const pendingTasks = availableTasks.filter(t => t.status !== 'completed');

  // ====================================================
  // SCREEN 1: SELECTION MODAL ("Qual tarefa você deseja fazer agora?")
  // ====================================================
  if (!focusSession) {
    return (
      <div 
        id="focus-task-selector-overlay"
        className="fixed inset-0 z-[9999] bg-[#0D1E3D]/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200"
      >
        <div 
          className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-[#0D1E3D] px-6 py-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-amber-300 border border-white/10">
                <Target size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-[#FAF6EF]">Modo Foco (Pomodoro)</h3>
                <p className="text-xs text-white/60">Ciclos de 25 min com pausas automáticas de 5 min</p>
              </div>
            </div>
            <button 
              onClick={closeFocus}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body: Question & Task List */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-brand-dark">
                Qual tarefa você deseja fazer agora?
              </h4>
              <p className="text-xs text-gray-500">
                Selecione uma tarefa para iniciar o cronômetro Pomodoro de 25 minutos.
              </p>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="text-center py-10 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h5 className="font-bold text-gray-800 text-sm">Nenhuma tarefa pendente para hoje!</h5>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    Você já concluiu todas as tarefas programadas para hoje ou ainda não adicionou novas tarefas.
                  </p>
                </div>
                {onOpenNewTask && (
                  <button
                    onClick={() => {
                      closeFocus();
                      onOpenNewTask();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-dark text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-brand-dark/90 transition-colors"
                  >
                    <Plus size={14} /> Criar Nova Tarefa
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {pendingTasks.map(task => {
                  const clientColor = task.client?.color || '#0D1E3D';
                  const clientName = task.client?.name || 'Canguru Digital (Interno)';

                  return (
                    <button
                      key={task.id}
                      onClick={() => startFocus(task, availableTasks)}
                      className="w-full text-left p-4 rounded-2xl border border-gray-100 hover:border-[#0D1E3D]/40 bg-white hover:bg-amber-50/40 transition-all flex items-center justify-between gap-3 group shadow-xs hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div 
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10" 
                          style={{ backgroundColor: clientColor }} 
                        />
                        <div className="min-w-0">
                          <h5 className="font-bold text-sm text-brand-dark group-hover:text-[#0D1E3D] transition-colors truncate">
                            {task.title}
                          </h5>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                            <span className="truncate">{clientName}</span>
                            {task.priority === 'urgente' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-600 border border-red-100 shrink-0">
                                Urgente
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-[#0D1E3D] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          Iniciar <Play size={12} fill="currentColor" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ====================================================
  // SCREEN 2: FULLSCREEN IMMERSIVE POMODORO (Canguru Navy #0D1E3D)
  // ====================================================
  const {
    taskTitle,
    clientName,
    clientColor,
    phase,
    currentCycle,
    timeRemaining,
    totalAccumulatedSeconds,
    isRunning
  } = focusSession;

  // Maximum time for current phase (for calculating circular progress)
  const getCurrentPhaseTotal = () => {
    if (phase === 'focus') return FOCUS_TIME;
    if (phase === 'break') return currentCycle % 4 === 0 ? LONG_BREAK_TIME : SHORT_BREAK_TIME;
    return READY_CHECK_TIME;
  };

  // Progress for SVG circle
  const phaseTotal = getCurrentPhaseTotal();
  const progressPercent = Math.min(1, Math.max(0, (phaseTotal - timeRemaining) / phaseTotal));
  const circleRadius = 140;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - progressPercent * circumference;

  // Visual Theme Colors by Phase
  const getPhaseTheme = () => {
    if (phase === 'focus') {
      return {
        bgGlow: 'bg-[radial-gradient(ellipse_at_center,_rgba(27,52,97,0.45)_0%,_rgba(13,30,61,1)_70%)]',
        strokeColor: '#F5F0E8',
        tagText: 'Foco Ativo',
        tagBg: 'bg-amber-400/20 text-amber-300 border-amber-400/30',
        textColor: 'text-[#FAF6EF]'
      };
    }
    if (phase === 'break') {
      return {
        bgGlow: 'bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.25)_0%,_rgba(13,30,61,1)_70%)]',
        strokeColor: '#34D399',
        tagText: currentCycle % 4 === 0 ? 'Descanso Longo (30m)' : 'Descanso Curto (5m)',
        tagBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        textColor: 'text-emerald-300'
      };
    }
    return {
      bgGlow: 'bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.25)_0%,_rgba(13,30,61,1)_70%)]',
      strokeColor: '#FBBF24',
      tagText: 'Pronto para voltar?',
      tagBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      textColor: 'text-amber-300'
    };
  };

  const currentTheme = getPhaseTheme();

  return (
    <div 
      id="focus-mode-fullscreen"
      className="fixed inset-0 z-[9999] bg-[#0D1E3D] text-[#F5F0E8] flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden font-sans"
    >
      {/* Subtle glowing ambient gradient behind circle */}
      <div className={`absolute inset-0 pointer-events-none transition-all duration-700 ${currentTheme.bgGlow}`} />

      {/* TOP BAR: Left Cycle & Right Minimize & Actions */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between">
        
        {/* Left: Pomodoro Cycle and Minimize button */}
        <div className="flex items-center gap-4">
          {/* Button "Minimizar" */}
          <button
            onClick={minimizeFocus}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider border border-white/15 transition-all shadow-md active:scale-95 cursor-pointer"
            title="Minimizar para o canto inferior da tela"
          >
            <ChevronLeft size={16} />
            <Minimize2 size={13} />
            <span>Minimizar</span>
          </button>

          <div className="hidden sm:flex items-center gap-3 pl-2 border-l border-white/10">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 border border-white/10 shadow-xs">
              <Flame size={16} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/50">
                Pomodoro Canguru
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-bold text-white/90">
                  Ciclo {currentCycle}/4
                </span>
                <div className="flex items-center gap-1 ml-1">
                  {[1, 2, 3, 4].map(step => (
                    <span
                      key={step}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        step < currentCycle 
                          ? 'bg-emerald-400' 
                          : step === currentCycle 
                          ? phase === 'focus' ? 'bg-amber-400 ring-2 ring-amber-400/40' : 'bg-emerald-400 ring-2 ring-emerald-400/40'
                          : 'bg-white/20'
                      }`}
                      title={`Bloco ${step} de 25m`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Right: Total Time Spent & Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Total Accumulated Time Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white/70">
            <Clock size={13} className="text-amber-400" />
            <span className="text-[10px] uppercase font-sans text-white/40">Total:</span>
            <span className="font-bold text-white/90">{formatTotalTime(totalAccumulatedSeconds)}</span>
          </div>

          <button
            onClick={() => {
              if (isRunning) pauseTimer();
              // Reset session to choose another task
              startFocus(null);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-semibold uppercase tracking-wider transition-all"
            title="Escolher outra tarefa"
          >
            <Target size={13} className="text-amber-400" />
            <span className="hidden sm:inline">Trocar Tarefa</span>
          </button>

          {/* Exit Button */}
          <button
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 text-xs font-semibold uppercase tracking-wider transition-all"
          >
            <X size={14} />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* CENTER: Task name, Circular Timer, and Controls */}
      <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center justify-center text-center my-auto space-y-6 sm:space-y-8">
        
        {/* Task Name & Client Badge */}
        <div className="space-y-2 px-4 max-w-xl">
          {clientName && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-white/80 font-medium">
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: clientColor || '#F5F0E8' }} 
              />
              <span>{clientName}</span>
            </div>
          )}

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#FAF6EF] leading-tight drop-shadow-sm">
            {taskTitle}
          </h2>
        </div>

        {/* Phase State Badge */}
        <div className="flex items-center justify-center">
          <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm transition-all ${currentTheme.tagBg}`}>
            {phase === 'focus' && <Flame size={14} className={isRunning ? 'animate-pulse' : ''} />}
            {phase === 'break' && <Coffee size={14} />}
            {phase === 'ready_check' && <Zap size={14} className="animate-bounce text-amber-300" />}
            <span>{currentTheme.tagText}</span>
          </span>
        </div>

        {/* Circular Progress Timer */}
        <div className="relative flex items-center justify-center">
          <svg className="w-[290px] h-[290px] sm:w-[320px] sm:h-[320px] -rotate-90 transform">
            {/* Background Track */}
            <circle
              cx="50%"
              cy="50%"
              r={circleRadius}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="6"
              fill="transparent"
            />
            {/* Progress Stroke */}
            <circle
              cx="50%"
              cy="50%"
              r={circleRadius}
              stroke={currentTheme.strokeColor}
              strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          {/* Center Digital Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-1">
            <span className={`text-5xl sm:text-7xl font-extralight font-mono tracking-widest ${currentTheme.textColor} drop-shadow-md`}>
              {formatTime(timeRemaining)}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">
              {phase === 'focus' 
                ? (isRunning ? 'Foco em Andamento' : 'Foco Pausado')
                : phase === 'break' 
                ? 'Descansando' 
                : 'Aguardando Retorno'}
            </span>
          </div>
        </div>

        {/* DYNAMIC PROMPTS & INSTRUCTIONS PER PHASE */}
        <AnimatePresence mode="wait">
          {phase === 'break' && (
            <motion.div 
              key="break-banner"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 px-6 py-3 rounded-2xl text-sm font-medium flex items-center gap-3 shadow-lg max-w-md"
            >
              <Coffee size={20} className="text-emerald-400 shrink-0" />
              <div className="text-left text-xs leading-relaxed">
                <span className="font-bold text-emerald-300">Hora de descansar!</span> Levante, beba água, respire e se estique longe da tela.
              </div>
            </motion.div>
          )}

          {phase === 'ready_check' && (
            <motion.div 
              key="ready-banner"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-amber-500/20 border border-amber-500/40 text-amber-200 px-6 py-4 rounded-3xl text-sm font-medium space-y-3 shadow-xl max-w-md text-center"
            >
              <div className="flex items-center justify-center gap-2 text-amber-300 font-extrabold text-sm uppercase tracking-wider">
                <Zap size={18} />
                <span>Você está pronto para voltar?</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Tolerância de <span className="font-mono font-bold text-white">{formatTime(timeRemaining)}</span> para o próximo bloco de 25 minutos começar automaticamente.
              </p>
              <button
                onClick={readyReturn}
                className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-[#0D1E3D] rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Estou Pronto!</span>
                <ArrowRight size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TIMER CONTROLS */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          {phase === 'ready_check' ? null : !isRunning ? (
            <button
              onClick={resumeTimer}
              className="flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-[#FAF6EF] text-[#0D1E3D] hover:bg-white font-bold text-sm uppercase tracking-widest transition-all shadow-2xl hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Play size={18} fill="currentColor" />
              <span>Retomar</span>
            </button>
          ) : (
            <button
              onClick={pauseTimer}
              className="flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-[#FAF6EF] border border-white/20 font-bold text-sm uppercase tracking-widest transition-all backdrop-blur-sm cursor-pointer"
            >
              <Pause size={18} />
              <span>Pausar</span>
            </button>
          )}

          {/* Skip Break Button during Break Phase */}
          {phase === 'break' && (
            <button
              onClick={skipBreak}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              title="Pular descanso e voltar ao foco agora"
            >
              <Zap size={14} className="text-amber-400" />
              <span>Pular Descanso</span>
            </button>
          )}

          {/* Reset Current Phase Timer */}
          {phase !== 'ready_check' && (
            <button
              onClick={resetPhase}
              title="Reiniciar tempo da fase atual"
              className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors cursor-pointer"
            >
              <RotateCcw size={18} />
            </button>
          )}
        </div>

        {/* PRIMARY ACTION: TAREFA TERMINADA (Soma os tempos e salva) */}
        <div className="pt-2">
          <button
            onClick={() => finishTask(true)}
            disabled={isFinishing}
            className="flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 hover:text-white border border-emerald-500/40 hover:border-emerald-500/70 font-black text-xs uppercase tracking-widest transition-all shadow-xl hover:shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span>{isFinishing ? 'Salvando tempos...' : 'Tarefa Terminada'}</span>
          </button>
          <p className="text-[11px] text-white/40 mt-1.5">
            Tempo total registrado até agora: <span className="font-mono text-white/70 font-semibold">{formatTotalTime(totalAccumulatedSeconds)}</span>
          </p>
        </div>
      </div>

      {/* FOOTER: Minimalist tips */}
      <div className="relative z-10 text-center text-[11px] text-white/30 tracking-wider">
        Método Pomodoro: 25 min de foco total, 5 min de descanso e pausas maiores após 4 blocos.
      </div>

      {/* MODAL: Confirmation on Exit */}
      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f172a] text-white p-6 sm:p-8 rounded-3xl border border-white/10 max-w-md w-full shadow-2xl space-y-6 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-bold text-[#FAF6EF]">Deseja sair do Modo Foco?</h4>
                <p className="text-xs text-white/60 leading-relaxed">
                  O tempo trabalhado de <span className="font-bold text-white">{formatTotalTime(totalAccumulatedSeconds)}</span> será registrado, mas a tarefa continuará pendente na sua lista.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    minimizeFocus();
                  }}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-[#0D1E3D] rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Minimize2 size={14} />
                  <span>Minimizar e continuar navegando</span>
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowExitConfirm(false)}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Voltar ao Foco
                  </button>
                  <button
                    onClick={async () => {
                      await exitSession(true);
                      setShowExitConfirm(false);
                    }}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
                  >
                    Encerrar Sessão
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

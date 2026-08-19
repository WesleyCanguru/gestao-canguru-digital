import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Square, 
  Maximize2, 
  Target, 
  Flame, 
  Coffee, 
  Zap, 
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';
import { useFocus } from '../../lib/FocusContext';

export const FocusMiniPlayer: React.FC = () => {
  const {
    focusSession,
    pauseTimer,
    resumeTimer,
    expandFocus,
    finishTask,
    exitSession,
    formatTime,
    formatTotalTime,
    isFinishing
  } = useFocus();

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Render only if session is active and currently minimized
  if (!focusSession || !focusSession.isMinimized) {
    return null;
  }

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

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      pauseTimer();
    } else {
      resumeTimer();
    }
  };

  const handleOpenConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmModal(true);
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    expandFocus();
  };

  // Phase Theme Helpers
  const getPhaseBadge = () => {
    if (phase === 'focus') {
      return {
        label: `Foco ${currentCycle}/4`,
        color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
        icon: <Flame size={10} className={isRunning ? 'animate-pulse text-amber-400' : 'text-amber-400'} />
      };
    }
    if (phase === 'break') {
      return {
        label: currentCycle % 4 === 0 ? 'Pausa Longa' : 'Descanso 5m',
        color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
        icon: <Coffee size={10} className="text-emerald-400" />
      };
    }
    return {
      label: 'Pronto?',
      color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      icon: <Zap size={10} className="text-yellow-400 animate-bounce" />
    };
  };

  const badge = getPhaseBadge();

  return (
    <>
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        id="focus-mini-player"
        onClick={handleExpand}
        className={`fixed bottom-6 right-6 z-[9999] w-[calc(100vw-32px)] sm:w-[380px] max-w-[400px] cursor-pointer select-none rounded-2xl border bg-[#0D1E3D]/95 backdrop-blur-xl text-[#F5F0E8] p-3.5 shadow-2xl transition-all duration-300 hover:shadow-amber-500/10 hover:border-white/25 ${
          !isRunning 
            ? 'border-amber-400/40 shadow-amber-950/30' 
            : phase === 'break' 
            ? 'border-emerald-500/40 shadow-emerald-950/30' 
            : 'border-white/15 shadow-black/50'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          
          {/* Left Info: Icon + Title + Timer */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Status Icon */}
            <div 
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                !isRunning
                  ? 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                  : phase === 'break'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-white/10 border-white/15 text-amber-300'
              }`}
            >
              {phase === 'break' ? (
                <Coffee size={18} className="text-emerald-400" />
              ) : !isRunning ? (
                <Target size={18} className="text-amber-400" />
              ) : (
                <Target size={18} className="text-amber-400 animate-pulse" />
              )}
            </div>

            {/* Texts */}
            <div className="min-w-0 flex-1 space-y-0.5">
              {/* Task Title & Client */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-xs sm:text-sm text-[#FAF6EF] truncate">
                  {taskTitle}
                </span>
              </div>

              {/* Sub-line: Timer + Phase Badge */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1 font-mono font-bold text-white/95 tracking-wide">
                  <span className="text-xs">⏱</span>
                  <span>{formatTime(timeRemaining)}</span>
                </div>

                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badge.color}`}>
                  {badge.icon}
                  <span>{badge.label}</span>
                </span>

                {!isRunning && (
                  <span className="text-[9px] font-bold text-amber-300/90 uppercase tracking-widest bg-amber-400/10 px-1 rounded">
                    Pausado
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            {/* Play / Pause Button */}
            <button
              onClick={handleTogglePlay}
              title={isRunning ? 'Pausar Timer' : 'Retomar Timer'}
              className={`p-2 rounded-xl text-white transition-all active:scale-95 ${
                isRunning 
                  ? 'bg-white/10 hover:bg-white/20 text-white/90' 
                  : 'bg-amber-400 hover:bg-amber-300 text-[#0D1E3D] font-bold'
              }`}
            >
              {isRunning ? (
                <Pause size={14} />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
            </button>

            {/* Stop / End Button */}
            <button
              onClick={handleOpenConfirm}
              title="Encerrar sessão de foco"
              className="p-2 rounded-xl bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-300 border border-transparent hover:border-red-500/30 transition-all active:scale-95"
            >
              <Square size={14} />
            </button>

            {/* Expand / Maximize Button */}
            <button
              onClick={handleExpand}
              title="Expandir para tela cheia"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-all active:scale-95"
            >
              <Maximize2 size={14} />
            </button>
          </div>

        </div>
      </motion.div>

      {/* Confirmation Modal when clicking Stop (⏹) */}
      <AnimatePresence>
        {showConfirmModal && (
          <div 
            className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={(e) => {
              e.stopPropagation();
              setShowConfirmModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0D1E3D] text-white p-6 rounded-3xl border border-white/15 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-bold text-[#FAF6EF]">Encerrar sessão de foco?</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Tempo trabalhado acumulado:{' '}
                  <span className="font-mono font-bold text-amber-300">
                    {formatTotalTime(totalAccumulatedSeconds)}
                  </span>
                  . O que deseja fazer com esta tarefa?
                </p>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white/90 font-medium">
                  🎯 <span className="font-bold">{taskTitle}</span>
                  {clientName && <span className="text-white/50 text-[11px] block mt-0.5">{clientName}</span>}
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                {/* Concluir Tarefa */}
                <button
                  onClick={async () => {
                    await finishTask(true);
                    setShowConfirmModal(false);
                  }}
                  disabled={isFinishing}
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  <span>{isFinishing ? 'Concluindo...' : 'Concluir Tarefa & Salvar'}</span>
                </button>

                {/* Salvar tempo e deixar pendente */}
                <button
                  onClick={async () => {
                    await exitSession(true);
                    setShowConfirmModal(false);
                  }}
                  className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 text-white/90 hover:text-white border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <span>Salvar Tempo e Sair (Deixar Pendente)</span>
                </button>

                {/* Cancelar */}
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-2.5 text-white/50 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  Cancelar & Continuar Focado
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

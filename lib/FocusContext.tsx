import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AgencyTask } from '../types';
import { supabase, useAuth } from './supabase';

export type PomodoroPhase = 'focus' | 'break' | 'ready_check';

export interface FocusSession {
  taskId: string;
  taskTitle: string;
  clientName?: string;
  clientColor?: string;
  startedAt: string; // ISO string
  pausedAt: string | null; // ISO string when paused
  totalPausedSeconds: number;
  phase: PomodoroPhase;
  currentCycle: number; // 1 to 4
  timeRemaining: number; // in seconds
  totalAccumulatedSeconds: number;
  isRunning: boolean;
  isMinimized: boolean;
  lastTickTimestamp: number; // Date.now()
}

interface FocusContextType {
  focusSession: FocusSession | null;
  isOpen: boolean; // Is fullscreen modal open
  todayTasks: AgencyTask[];
  setTodayTasks: (tasks: AgencyTask[]) => void;
  startFocus: (task?: AgencyTask | null, tasksList?: AgencyTask[]) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetPhase: () => void;
  skipBreak: () => void;
  readyReturn: () => void;
  minimizeFocus: () => void;
  expandFocus: () => void;
  openTaskSelector: (tasksList?: AgencyTask[]) => void;
  closeFocus: () => void;
  finishTask: (completed?: boolean) => Promise<void>;
  exitSession: (savePartial?: boolean) => Promise<void>;
  showExitConfirm: boolean;
  setShowExitConfirm: (show: boolean) => void;
  isFinishing: boolean;
  formatTime: (seconds: number) => string;
  formatTotalTime: (seconds: number) => string;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'focus_session_active';

// Pomodoro Constants in seconds
export const FOCUS_TIME = 25 * 60;        // 25 minutes
export const SHORT_BREAK_TIME = 5 * 60;   // 5 minutes
export const LONG_BREAK_TIME = 30 * 60;   // 30 minutes
export const READY_CHECK_TIME = 2 * 60;   // 2 minutes window to return

// Web Audio API custom sounds
export function playFocusChime(type: 'focus_end' | 'break_end' | 'task_completed') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (type === 'focus_end') {
      // Gentle chime signaling break time (C5 -> G5 -> C6)
      const freqs = [523.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.18;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.6);
      });
    } else if (type === 'break_end') {
      // Double attention chime (A5 -> D6)
      const freqs = [880.00, 1174.66];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.22;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.5);
      });
    } else {
      // Victory Arpeggio (C5 -> E5 -> G5 -> B5 -> C6)
      const freqs = [523.25, 659.25, 783.99, 987.77, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.12;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.28, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.7);
      });
    }
  } catch (e) {
    console.warn('Audio playback error:', e);
  }
}

export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { agencyId } = useAuth();
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [todayTasks, setTodayTasks] = useState<AgencyTask[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const isInitialMount = useRef(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedRaw) {
        const parsed: FocusSession = JSON.parse(savedRaw);
        if (parsed && parsed.taskId) {
          const now = Date.now();
          const lastTick = parsed.lastTickTimestamp || now;
          const elapsedSecs = Math.max(0, Math.floor((now - lastTick) / 1000));

          let newTimeRemaining = parsed.timeRemaining;
          let newAccumulated = parsed.totalAccumulatedSeconds;
          let newPhase = parsed.phase;
          let newCycle = parsed.currentCycle;

          // If session was running when page reloaded
          if (parsed.isRunning && elapsedSecs > 0) {
            // Cap elapsed seconds to max 4 hours to avoid extreme drifts if computer slept
            const cappedElapsed = Math.min(elapsedSecs, 4 * 3600);
            newAccumulated += cappedElapsed;

            if (newTimeRemaining > cappedElapsed) {
              newTimeRemaining -= cappedElapsed;
            } else {
              // Transition phase
              if (parsed.phase === 'focus') {
                newPhase = 'break';
                const isLong = parsed.currentCycle % 4 === 0;
                newTimeRemaining = isLong ? LONG_BREAK_TIME : SHORT_BREAK_TIME;
              } else {
                newPhase = 'focus';
                newCycle = parsed.currentCycle >= 4 ? 1 : parsed.currentCycle + 1;
                newTimeRemaining = FOCUS_TIME;
              }
            }
          }

          const restoredSession: FocusSession = {
            ...parsed,
            timeRemaining: newTimeRemaining,
            totalAccumulatedSeconds: newAccumulated,
            phase: newPhase,
            currentCycle: newCycle,
            lastTickTimestamp: now
          };

          setFocusSession(restoredSession);
          // If session was not minimized, open it; otherwise keep minimized
          if (!restoredSession.isMinimized) {
            setIsOpen(true);
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao restaurar sessão de foco do localStorage:', e);
    }
  }, []);

  // Save to localStorage whenever focusSession changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (focusSession) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(focusSession));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [focusSession]);

  // Main Timer Interval
  useEffect(() => {
    let interval: any = null;

    if (focusSession && focusSession.isRunning) {
      interval = setInterval(() => {
        setFocusSession(prev => {
          if (!prev || !prev.isRunning) return prev;

          const now = Date.now();
          const nextAccumulated = prev.totalAccumulatedSeconds + 1;
          const nextRemaining = prev.timeRemaining - 1;

          if (nextRemaining <= 0) {
            // Phase transition
            if (prev.phase === 'focus') {
              playFocusChime('focus_end');
              const isLongBreak = prev.currentCycle % 4 === 0;
              const breakDuration = isLongBreak ? LONG_BREAK_TIME : SHORT_BREAK_TIME;
              return {
                ...prev,
                phase: 'break',
                timeRemaining: breakDuration,
                totalAccumulatedSeconds: nextAccumulated,
                lastTickTimestamp: now
              };
            } else if (prev.phase === 'break') {
              playFocusChime('break_end');
              return {
                ...prev,
                phase: 'ready_check',
                timeRemaining: READY_CHECK_TIME,
                totalAccumulatedSeconds: nextAccumulated,
                lastTickTimestamp: now
              };
            } else {
              // ready_check expired -> automatically start next focus block
              const nextCycle = prev.currentCycle >= 4 ? 1 : prev.currentCycle + 1;
              return {
                ...prev,
                phase: 'focus',
                currentCycle: nextCycle,
                timeRemaining: FOCUS_TIME,
                totalAccumulatedSeconds: nextAccumulated,
                lastTickTimestamp: now
              };
            }
          }

          return {
            ...prev,
            timeRemaining: nextRemaining,
            totalAccumulatedSeconds: nextAccumulated,
            lastTickTimestamp: now
          };
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [focusSession?.isRunning]);

  // Start Focus Session
  const startFocus = useCallback((task?: AgencyTask | null, tasksList?: AgencyTask[]) => {
    if (tasksList && tasksList.length > 0) {
      setTodayTasks(tasksList);
    }

    if (task) {
      const now = new Date();
      const newSession: FocusSession = {
        taskId: task.id,
        taskTitle: task.title,
        clientName: task.client?.name || 'Interno',
        clientColor: task.client?.color || '#0D1E3D',
        startedAt: now.toISOString(),
        pausedAt: null,
        totalPausedSeconds: 0,
        phase: 'focus',
        currentCycle: 1,
        timeRemaining: FOCUS_TIME,
        totalAccumulatedSeconds: 0,
        isRunning: true,
        isMinimized: false,
        lastTickTimestamp: Date.now()
      };

      setFocusSession(newSession);
      setIsOpen(true);
    } else {
      // Open selector modal
      setIsOpen(true);
    }
  }, []);

  // Pause Timer
  const pauseTimer = useCallback(() => {
    setFocusSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        isRunning: false,
        pausedAt: new Date().toISOString(),
        lastTickTimestamp: Date.now()
      };
    });
  }, []);

  // Resume Timer
  const resumeTimer = useCallback(() => {
    setFocusSession(prev => {
      if (!prev) return null;
      let additionalPaused = 0;
      if (prev.pausedAt) {
        const diffSecs = Math.floor((Date.now() - new Date(prev.pausedAt).getTime()) / 1000);
        additionalPaused = Math.max(0, diffSecs);
      }
      return {
        ...prev,
        isRunning: true,
        pausedAt: null,
        totalPausedSeconds: prev.totalPausedSeconds + additionalPaused,
        lastTickTimestamp: Date.now()
      };
    });
  }, []);

  // Reset Phase Timer
  const resetPhase = useCallback(() => {
    setFocusSession(prev => {
      if (!prev) return null;
      let duration = FOCUS_TIME;
      if (prev.phase === 'break') {
        duration = prev.currentCycle % 4 === 0 ? LONG_BREAK_TIME : SHORT_BREAK_TIME;
      } else if (prev.phase === 'ready_check') {
        duration = READY_CHECK_TIME;
      }
      return {
        ...prev,
        timeRemaining: duration,
        isRunning: false,
        lastTickTimestamp: Date.now()
      };
    });
  }, []);

  // Skip break to next focus cycle
  const skipBreak = useCallback(() => {
    setFocusSession(prev => {
      if (!prev) return null;
      const nextCycle = prev.currentCycle >= 4 ? 1 : prev.currentCycle + 1;
      return {
        ...prev,
        phase: 'focus',
        currentCycle: nextCycle,
        timeRemaining: FOCUS_TIME,
        isRunning: true,
        lastTickTimestamp: Date.now()
      };
    });
  }, []);

  // Ready return button
  const readyReturn = useCallback(() => {
    setFocusSession(prev => {
      if (!prev) return null;
      const nextCycle = prev.currentCycle >= 4 ? 1 : prev.currentCycle + 1;
      return {
        ...prev,
        phase: 'focus',
        currentCycle: nextCycle,
        timeRemaining: FOCUS_TIME,
        isRunning: true,
        lastTickTimestamp: Date.now()
      };
    });
  }, []);

  // Minimize fullscreen focus mode
  const minimizeFocus = useCallback(() => {
    setFocusSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        isMinimized: true
      };
    });
    setIsOpen(false);
  }, []);

  // Expand mini-player to fullscreen
  const expandFocus = useCallback(() => {
    setFocusSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        isMinimized: false
      };
    });
    setIsOpen(true);
  }, []);

  // Open task selector modal
  const openTaskSelector = useCallback((tasksList?: AgencyTask[]) => {
    if (tasksList) setTodayTasks(tasksList);
    setIsOpen(true);
  }, []);

  // Close focus mode
  const closeFocus = useCallback(() => {
    if (focusSession) {
      minimizeFocus();
    } else {
      setIsOpen(false);
    }
  }, [focusSession, minimizeFocus]);

  // Finish Task (Mark as completed & save session)
  const finishTask = useCallback(async (completed: boolean = true) => {
    if (!focusSession) return;
    setIsFinishing(true);

    try {
      if (completed) {
        playFocusChime('task_completed');
      }

      const now = new Date();
      const startedAt = new Date(focusSession.startedAt);
      const finalDuration = Math.max(1, focusSession.totalAccumulatedSeconds);
      const curAgencyId = agencyId || 1;

      // 1. Insert session record
      try {
        await supabase.from('task_sessions').insert([{
          task_id: focusSession.taskId,
          agency_id: curAgencyId,
          user_id: null,
          started_at: startedAt.toISOString(),
          ended_at: now.toISOString(),
          duration_seconds: finalDuration,
          completed_task: completed
        }]);
      } catch (sessErr) {
        console.warn('Erro ao registrar task_sessions:', sessErr);
      }

      // 2. Update task status if completed
      if (completed) {
        await supabase.from('agency_tasks').update({
          status: 'completed',
          completed_at: now.toISOString()
        })
        .eq('id', focusSession.taskId);
      }

      // 3. Clear session
      setFocusSession(null);
      setIsOpen(false);
      setShowExitConfirm(false);
      localStorage.removeItem(LOCAL_STORAGE_KEY);

      // Dispatch custom window event so tasks views update their counts/lists immediately
      window.dispatchEvent(new CustomEvent('focus_task_completed', { detail: { taskId: focusSession.taskId } }));
    } catch (err) {
      console.error('Erro ao finalizar sessão de foco:', err);
    } finally {
      setIsFinishing(false);
    }
  }, [focusSession, agencyId]);

  // Exit Session without marking as completed
  const exitSession = useCallback(async (savePartial: boolean = true) => {
    if (!focusSession) {
      setIsOpen(false);
      setShowExitConfirm(false);
      return;
    }

    try {
      if (savePartial && focusSession.totalAccumulatedSeconds >= 10) {
        const now = new Date();
        const startedAt = new Date(focusSession.startedAt);
        const curAgencyId = agencyId || 1;

        try {
          await supabase.from('task_sessions').insert([{
            task_id: focusSession.taskId,
            agency_id: curAgencyId,
            user_id: null,
            started_at: startedAt.toISOString(),
            ended_at: now.toISOString(),
            duration_seconds: focusSession.totalAccumulatedSeconds,
            completed_task: false
          }]);
        } catch (e) {
          console.warn('Erro ao salvar sessão parcial:', e);
        }
      }

      setFocusSession(null);
      setIsOpen(false);
      setShowExitConfirm(false);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('focus_session_ended'));
    } catch (err) {
      console.error('Erro ao sair da sessão de foco:', err);
    }
  }, [focusSession, agencyId]);

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format Total Time (e.g. 1h 15m 30s or 25m 10s)
  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hours}h ${remainMins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  return (
    <FocusContext.Provider
      value={{
        focusSession,
        isOpen,
        todayTasks,
        setTodayTasks,
        startFocus,
        pauseTimer,
        resumeTimer,
        resetPhase,
        skipBreak,
        readyReturn,
        minimizeFocus,
        expandFocus,
        openTaskSelector,
        closeFocus,
        finishTask,
        exitSession,
        showExitConfirm,
        setShowExitConfirm,
        isFinishing,
        formatTime,
        formatTotalTime
      }}
    >
      {children}
    </FocusContext.Provider>
  );
};

export const useFocus = () => {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus deve ser usado dentro de um FocusProvider');
  }
  return context;
};

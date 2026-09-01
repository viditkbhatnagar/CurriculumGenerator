'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface GenerationState {
  step: number;
  workflowId: string;
  startTime: number;
  estimatedDuration: number; // in seconds
  status: 'generating' | 'completed' | 'error';
  error?: string;
}

interface GenerationContextType {
  // Current generations in progress
  generations: Record<string, GenerationState>; // key: `${workflowId}-${step}`

  // Start tracking a generation
  startGeneration: (workflowId: string, step: number, estimatedDuration?: number) => void;

  // Mark generation as completed
  completeGeneration: (workflowId: string, step: number) => void;

  // Mark generation as failed
  failGeneration: (workflowId: string, step: number, error: string) => void;

  // Check if a step is generating
  isGenerating: (workflowId: string, step: number) => boolean;

  // Get generation state for a step
  getGenerationState: (workflowId: string, step: number) => GenerationState | null;

  // Get elapsed time in seconds
  getElapsedTime: (workflowId: string, step: number) => number;

  // Get progress percentage (0-100)
  getProgress: (workflowId: string, step: number) => number;
}

/**
 * Estimated generation time per step, in seconds.
 *
 * These are median observed durations from production, not guesses. The previous
 * values were 3-5x optimistic — Step 4 was set to 90s against a real median of
 * 285s, so the bar hit its 95% cap after ~107s and sat there for four more
 * minutes while the copy still promised 90 seconds. That reads as a hung job.
 *
 * To re-measure: for each step take completedAt - startedAt from
 * stepProgress across workflows, discard spans over 30 minutes (those are the
 * author leaving the step rather than the model working), and take the median.
 */
export const STEP_ESTIMATED_DURATIONS: Record<number, number> = {
  1: 180, // Program Foundation
  2: 420, // KSC Framework
  3: 240, // PLOs
  4: 300, // Course Framework & MLOs — one large structured call
  5: 360, // Topic-Level Sources — needs research
  6: 450, // Reading Lists
  7: 1800, // Assessments — streams, many questions
  // Case studies are two model calls per module, each producing a full narrative plus
  // exhibits, key facts, misconceptions, terminology and a teaching note. 360s was the
  // figure from when the step covered four modules regardless of programme size; a
  // 46-module programme took ninety minutes and the author watched a six-minute estimate
  // the whole time. ~20 minutes reflects the step now covering every module, ten at a time.
  8: 1200, // Case Studies
  9: 210, // Glossary
  10: 240, // Lesson Plans — per module, chains across modules
  11: 120, // PPT Decks — per module
  12: 1200, // Assignment Packs — 3 variants per module
  13: 480, // Summative Exam
  14: 30, // Syllabus — lightweight aggregation + LLM polish
};

/** Human-readable form of a step's estimate, for the "this may take …" copy. */
export function formatStepEstimate(step: number): string {
  const seconds = STEP_ESTIMATED_DURATIONS[step] || 60;
  if (seconds < 90) return `about ${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return `around ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

const GenerationContext = createContext<GenerationContextType | null>(null);

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const [generations, setGenerations] = useState<Record<string, GenerationState>>({});
  const [, forceUpdate] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Persist to localStorage
  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('generationStates');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Filter out old generations (older than 15 minutes)
        const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
        const filtered: Record<string, GenerationState> = {};
        Object.entries(parsed).forEach(([key, state]) => {
          const genState = state as GenerationState;
          if (genState.startTime > fifteenMinutesAgo && genState.status === 'generating') {
            filtered[key] = genState;
          }
        });
        setGenerations(filtered);
      } catch (e) {
        console.error('Failed to parse generation states:', e);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('generationStates', JSON.stringify(generations));
  }, [generations]);

  // Update timer for progress tracking
  useEffect(() => {
    const hasActiveGenerations = Object.values(generations).some((g) => g?.status === 'generating');

    if (hasActiveGenerations && !timerRef.current) {
      timerRef.current = setInterval(() => {
        forceUpdate((n) => n + 1);
      }, 1000);
    } else if (!hasActiveGenerations && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [generations]);

  const getKey = (workflowId: string, step: number) => `${workflowId}-${step}`;

  const startGeneration = useCallback(
    (workflowId: string, step: number, estimatedDuration?: number) => {
      const key = getKey(workflowId, step);
      setGenerations((prev) => ({
        ...prev,
        [key]: {
          step,
          workflowId,
          startTime: Date.now(),
          estimatedDuration: estimatedDuration || STEP_ESTIMATED_DURATIONS[step] || 60,
          status: 'generating',
        },
      }));
    },
    []
  );

  const completeGeneration = useCallback((workflowId: string, step: number) => {
    const key = getKey(workflowId, step);
    setGenerations((prev) => {
      const newState = { ...prev };
      if (newState[key]) {
        newState[key] = { ...newState[key], status: 'completed' };
      }
      // Remove after a short delay
      setTimeout(() => {
        setGenerations((current) => {
          const updated = { ...current };
          delete updated[key];
          return updated;
        });
      }, 2000);
      return newState;
    });
  }, []);

  const failGeneration = useCallback((workflowId: string, step: number, error: string) => {
    const key = getKey(workflowId, step);
    setGenerations((prev) => {
      if (!prev[key]) return prev; // Don't create entries for non-existent keys
      return {
        ...prev,
        [key]: { ...prev[key], status: 'error' as const, error },
      };
    });
  }, []);

  const isGenerating = useCallback(
    (workflowId: string, step: number) => {
      const key = getKey(workflowId, step);
      return generations[key]?.status === 'generating';
    },
    [generations]
  );

  const getGenerationState = useCallback(
    (workflowId: string, step: number) => {
      const key = getKey(workflowId, step);
      return generations[key] || null;
    },
    [generations]
  );

  const getElapsedTime = useCallback(
    (workflowId: string, step: number) => {
      const key = getKey(workflowId, step);
      const state = generations[key];
      if (!state) return 0;
      return Math.floor((Date.now() - state.startTime) / 1000);
    },
    [generations]
  );

  const getProgress = useCallback(
    (workflowId: string, step: number) => {
      const key = getKey(workflowId, step);
      const state = generations[key];
      if (!state) return 0;
      if (state.status === 'completed') return 100;

      const elapsed = (Date.now() - state.startTime) / 1000;
      const fraction = elapsed / state.estimatedDuration;

      // Up to the estimate, advance steadily to 80%. Past it, keep creeping
      // towards 99% instead of clamping — a bar that stops moving is read as a
      // job that has died, and generation regularly runs beyond the estimate.
      if (fraction <= 1) return Math.floor(fraction * 80);
      const overrun = elapsed - state.estimatedDuration;
      const creep = 19 * (1 - Math.exp(-overrun / state.estimatedDuration));
      return Math.min(99, Math.floor(80 + creep));
    },
    [generations]
  );

  return (
    <GenerationContext.Provider
      value={{
        generations,
        startGeneration,
        completeGeneration,
        failGeneration,
        isGenerating,
        getGenerationState,
        getElapsedTime,
        getProgress,
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  const context = useContext(GenerationContext);
  if (!context) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }
  return context;
}

// Queue status label mapping
function getQueueStatusLabel(queueStatus?: string | null): { label: string; color: string } | null {
  if (!queueStatus) return null;
  switch (queueStatus) {
    case 'queued':
    case 'waiting':
      return { label: 'Queued', color: 'text-amber-500' };
    case 'processing':
    case 'active':
      return { label: 'Processing', color: 'text-cyan-500' };
    case 'completed':
      return { label: 'Completed', color: 'text-emerald-500' };
    case 'failed':
      return { label: 'Failed', color: 'text-red-500' };
    default:
      return null;
  }
}

// Progress Bar Component
export function GenerationProgressBar({
  workflowId,
  step,
  showTimeEstimate = true,
  queueStatus,
}: {
  workflowId: string;
  step: number;
  showTimeEstimate?: boolean;
  /** Real-time queue status from useStepStatus hook (e.g. 'queued', 'processing', 'completed') */
  queueStatus?: string | null;
}) {
  const { isGenerating, getElapsedTime, getProgress, getGenerationState } = useGeneration();

  if (!isGenerating(workflowId, step)) {
    return null;
  }

  const elapsed = getElapsedTime(workflowId, step);
  const progress = getProgress(workflowId, step);
  const state = getGenerationState(workflowId, step);
  const estimated = state?.estimatedDuration || 60;
  const statusInfo = getQueueStatusLabel(queueStatus);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="w-full space-y-2">
      {/* Queue status badge */}
      {statusInfo && (
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusInfo.color}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
            </span>
            {statusInfo.label}
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        {/* Animated shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
      </div>

      {/* Time info. Past the estimate, say so rather than showing "~0s
          remaining" indefinitely — the run is still going, and pretending it is
          about to finish is what makes it look stuck. */}
      {showTimeEstimate && (
        <div className="flex justify-between text-xs text-slate-400">
          <span>Elapsed: {formatTime(elapsed)}</span>
          {elapsed < estimated ? (
            <span>~{formatTime(estimated - elapsed)} remaining</span>
          ) : (
            <span className="text-amber-400">
              Longer than the usual {formatTime(estimated)} — still running
            </span>
          )}
        </div>
      )}
    </div>
  );
}

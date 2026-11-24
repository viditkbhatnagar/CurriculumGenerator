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
 * How long each step usually takes, as a range in minutes, for a programme of a few modules
 * (larger programmes take longer in the module-by-module steps).
 *
 * One table for every place that states a time. Logan Pacey, 23 November 2026: during Step 5
 * the page said "around 15 minutes" and "usually takes about 2m" at once, because the view
 * started its timer with its own hard-coded 120 seconds; Steps 6, 8, 9 and 13 had their own
 * figures too. Views no longer pass a duration.
 *
 * Measured from stepProgress runStartedAt/runEndedAt and analyticsmetrics, October-November
 * 2026 (four-module programmes): Step 5 6-18 min, Step 7 17-23, Step 8 3-4, Step 13 4.
 * Steps 10-12 run module by module, so their figures are per module and the view multiplies them
 * by the modules still to do.
 */
export const PER_MODULE_STEPS = new Set([10, 11, 12]);
export const STEP_ESTIMATE_MINUTES: Record<number, [number, number]> = {
  1: [1, 3], // Program Foundation
  2: [3, 7], // KSC Framework
  3: [1, 4], // PLOs
  4: [2, 5], // Course Framework & MLOs
  5: [6, 18], // Topic-Level Sources: per-module calls plus the journal lookups
  6: [1, 8], // Reading Lists
  7: [15, 40], // Assessments
  8: [3, 20], // Case Studies: two calls per module, ten modules at a time
  9: [1, 4], // Glossary
  10: [10, 13], // Lesson Plans, per module (45-49 min for four modules)
  11: [8, 11], // PPT Decks, per module (35-40 min for four modules)
  12: [2, 5], // Assignment Packs, per module (5-18 min for four modules)
  13: [4, 10], // Summative Exam
  14: [1, 1], // Syllabus
};

/**
 * A step's usual upper bound in seconds (per module for Steps 10-12): the point after which the
 * page says it is running long.
 */
export const STEP_ESTIMATED_DURATIONS: Record<number, number> = Object.fromEntries(
  Object.entries(STEP_ESTIMATE_MINUTES).map(([step, [, high]]) => [step, high * 60])
);

/** The usual range as words: "6–18 minutes", or "about a minute". */
export function stepEstimateRange(step: number): string {
  const [low, high] = STEP_ESTIMATE_MINUTES[step] || [1, 2];
  const range = high <= 1 ? 'about a minute' : `${low}–${high} minutes`;
  return PER_MODULE_STEPS.has(step) ? `${range} per module` : range;
}

/** Human-readable form of a step's estimate, for the "this may take …" copy. */
export function formatStepEstimate(step: number): string {
  const range = stepEstimateRange(step);
  return range.startsWith('about') ? range : `about ${range}`;
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
  const { isGenerating, getElapsedTime, getGenerationState } = useGeneration();

  if (!isGenerating(workflowId, step)) {
    return null;
  }

  const elapsed = getElapsedTime(workflowId, step);
  const state = getGenerationState(workflowId, step);
  // The table, not the stored figure: entries saved before 24 November 2026 carry old per-view numbers.
  // Steps 10-12 store the per-module figure times the modules still to do.
  const estimated = PER_MODULE_STEPS.has(step)
    ? state?.estimatedDuration || STEP_ESTIMATED_DURATIONS[step] || 60
    : STEP_ESTIMATED_DURATIONS[step] || state?.estimatedDuration || 60;
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

      {/* A running indicator, not a percentage. The bar used to fill towards 95% on a guess
          from elapsed time, whatever the job was doing: the 21 September review found it
          suggesting completion for a step that had failed. The backend's own state is the
          badge above; a failure is shown on the step itself. */}
      <div
        className="relative h-3 bg-slate-700 rounded-full overflow-hidden"
        role="progressbar"
        aria-label="Generating"
        aria-valuetext={`Running for ${formatTime(elapsed)}`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/40 to-blue-500/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
      </div>

      {/* Time info. Past the estimate, say so rather than showing "~0s
          remaining" indefinitely — the run is still going, and pretending it is
          about to finish is what makes it look stuck. */}
      {showTimeEstimate && (
        <div className="flex justify-between text-xs text-slate-400">
          <span>Running for {formatTime(elapsed)}</span>
          {elapsed < estimated ? (
            <span>This step usually takes {stepEstimateRange(step)}</span>
          ) : (
            <span className="text-amber-400">
              Longer than the usual {stepEstimateRange(step)} — still running
            </span>
          )}
        </div>
      )}
    </div>
  );
}

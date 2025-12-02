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

// Estimated durations per step (in seconds)
export const STEP_ESTIMATED_DURATIONS: Record<number, number> = {
  1: 30, // Program Foundation - quick AI generation
  2: 60, // KSC Framework - moderate
  3: 45, // PLOs - moderate
  4: 90, // Course Framework & MLOs - complex
  5: 120, // Topic-Level Sources - needs research
  6: 60, // Reading Lists - moderate
  7: 120, // Assessments - complex MCQ generation
  8: 180, // Case Studies - very complex
  9: 45, // Glossary - moderate
};

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
        // Filter out old generations (older than 30 minutes)
        const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
        const filtered: Record<string, GenerationState> = {};
        Object.entries(parsed).forEach(([key, state]: [string, any]) => {
          if (state.startTime > thirtyMinutesAgo && state.status === 'generating') {
            filtered[key] = state;
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
    const hasActiveGenerations = Object.values(generations).some((g) => g.status === 'generating');

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
    setGenerations((prev) => ({
      ...prev,
      [key]: prev[key] ? { ...prev[key], status: 'error', error } : prev[key],
    }));
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
      // Use logarithmic progress that approaches but never reaches 100%
      // This gives a better UX than linear progress for uncertain durations
      const progress = Math.min(95, (elapsed / state.estimatedDuration) * 80);
      return Math.floor(progress);
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

// Progress Bar Component
export function GenerationProgressBar({
  workflowId,
  step,
  showTimeEstimate = true,
}: {
  workflowId: string;
  step: number;
  showTimeEstimate?: boolean;
}) {
  const { isGenerating, getElapsedTime, getProgress, getGenerationState } = useGeneration();

  if (!isGenerating(workflowId, step)) {
    return null;
  }

  const elapsed = getElapsedTime(workflowId, step);
  const progress = getProgress(workflowId, step);
  const state = getGenerationState(workflowId, step);
  const estimated = state?.estimatedDuration || 60;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="w-full space-y-2">
      {/* Progress bar */}
      <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        {/* Animated shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
      </div>

      {/* Time info */}
      {showTimeEstimate && (
        <div className="flex justify-between text-xs text-slate-400">
          <span>Elapsed: {formatTime(elapsed)}</span>
          <span>~{formatTime(Math.max(0, estimated - elapsed))} remaining</span>
        </div>
      )}
    </div>
  );
}

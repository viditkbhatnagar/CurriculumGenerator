/**
 * Hook to monitor Step 10 background job status
 * Polls the status endpoint and provides real-time updates
 * Includes retry logic with exponential backoff
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

export interface Step10JobDetail {
  jobId: string;
  moduleIndex: number;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  attemptsMade: number;
  failedReason?: string;
  processedOn?: number;
  finishedOn?: number;
}

export interface Step10Status {
  workflowId: string;
  modulesGenerated: number;
  totalModules: number;
  allComplete: boolean;
  totalLessons: number;
  totalContactHours: number;
  jobs: {
    total: number;
    active: number;
    completed: number;
    failed: number;
    details: Step10JobDetail[];
  };
  status: 'complete' | 'in_progress' | 'failed' | 'pending';
}

interface UseStep10StatusOptions {
  /** Polling interval in milliseconds (default: 10000 - 10 seconds) */
  pollInterval?: number;
  /** Maximum retry attempts before showing error (default: 3) */
  maxRetries?: number;
  /** Whether to start polling immediately (default: true) */
  autoStart?: boolean;
  /** Callback when ALL modules complete */
  onComplete?: () => void;
  /** Callback when a single module completes (modulesGenerated increased) */
  onModuleComplete?: () => void;
  /** Callback when generation fails */
  onFailed?: (error: string) => void;
}

export function useStep10Status(workflowId: string, options: UseStep10StatusOptions = {}) {
  const { pollInterval = 10000, maxRetries = 3, autoStart = true } = options;

  const [status, setStatus] = useState<Step10Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [isGenerationActive, setIsGenerationActive] = useState(false);

  // Stable refs for callbacks — prevents dependency chain instability
  const onCompleteRef = useRef(options.onComplete);
  const onModuleCompleteRef = useRef(options.onModuleComplete);
  const onFailedRef = useRef(options.onFailed);

  // Keep refs up to date
  useEffect(() => {
    onCompleteRef.current = options.onComplete;
    onModuleCompleteRef.current = options.onModuleComplete;
    onFailedRef.current = options.onFailed;
  });

  // Refs for cleanup and tracking
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  const hasNotifiedCompleteRef = useRef(false);
  const prevModulesGeneratedRef = useRef<number | null>(null);
  const statusRef = useRef<Step10Status | null>(null);
  const retryCountRef = useRef(0);

  // Keep retryCountRef in sync
  useEffect(() => {
    retryCountRef.current = retryCount;
  }, [retryCount]);

  // Fetch status from backend — stable deps (no callbacks in the array)
  const fetchStatus = useCallback(
    async (isRetry = false): Promise<Step10Status | null> => {
      if (!workflowId) return null;

      try {
        setLoading(true);
        if (!isRetry) {
          setError(null);
        }

        const response = await api.get(`/api/v3/workflow/${workflowId}/step10/status`);

        if (response.data.success) {
          const newStatus = response.data.data as Step10Status;
          setStatus(newStatus);
          statusRef.current = newStatus;
          setRetryCount(0);
          retryCountRef.current = 0;
          setError(null);

          // Check if generation is active
          const isActive =
            newStatus.status === 'in_progress' ||
            newStatus.jobs?.active > 0 ||
            (newStatus.modulesGenerated < newStatus.totalModules && newStatus.jobs?.total > 0);
          setIsGenerationActive(isActive);

          // Detect per-module completion
          const prevModules = prevModulesGeneratedRef.current;
          prevModulesGeneratedRef.current = newStatus.modulesGenerated;
          if (prevModules !== null && newStatus.modulesGenerated > prevModules) {
            onModuleCompleteRef.current?.();
          }

          // Check for overall status transitions
          const prevStatus = previousStatusRef.current;
          previousStatusRef.current = newStatus.status;

          // Notify on all-complete (only once per generation cycle)
          if (
            newStatus.status === 'complete' &&
            prevStatus === 'in_progress' &&
            !hasNotifiedCompleteRef.current
          ) {
            hasNotifiedCompleteRef.current = true;
            onCompleteRef.current?.();
          }

          // Notify on failure
          if (newStatus.status === 'failed' && prevStatus !== 'failed') {
            const failedJob = newStatus.jobs?.details?.find((j) => j.state === 'failed');
            onFailedRef.current?.(failedJob?.failedReason || 'Generation failed');
          }

          return newStatus;
        } else {
          throw new Error(response.data.error || 'Failed to fetch status');
        }
      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch status';

        if (retryCountRef.current < maxRetries) {
          const nextRetryCount = retryCountRef.current + 1;
          setRetryCount(nextRetryCount);
          retryCountRef.current = nextRetryCount;

          const backoffDelay = Math.pow(2, nextRetryCount) * 1000;
          console.log(`[Step10Status] Retry ${nextRetryCount}/${maxRetries} in ${backoffDelay}ms`);

          retryTimeoutRef.current = setTimeout(() => {
            fetchStatus(true);
          }, backoffDelay);

          return null;
        } else {
          setError(errorMessage);
          setIsPolling(false);
          return null;
        }
      } finally {
        setLoading(false);
      }
    },
    [workflowId, maxRetries]
  );

  // Start polling — stable since fetchStatus is now stable
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setIsPolling(true);
    hasNotifiedCompleteRef.current = false;

    // Fetch immediately
    fetchStatus();

    // Set up interval
    intervalRef.current = setInterval(() => {
      fetchStatus();
    }, pollInterval);
  }, [fetchStatus, pollInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Manual retry after max retries exceeded
  const retry = useCallback(() => {
    setRetryCount(0);
    retryCountRef.current = 0;
    setError(null);
    startPolling();
  }, [startPolling]);

  // Auto-start: detect ongoing generation on mount
  useEffect(() => {
    if (!workflowId || !autoStart) return;

    // Single initial fetch — use returned data directly (not stale closure)
    fetchStatus().then((fetchedStatus) => {
      if (fetchedStatus) {
        const isActive =
          fetchedStatus.status === 'in_progress' || (fetchedStatus.jobs?.active ?? 0) > 0;
        if (isActive) {
          startPolling();
        }
      }
    });

    return () => {
      stopPolling();
    };
  }, [workflowId, autoStart, fetchStatus, startPolling, stopPolling]);

  // Stop polling when generation completes or fails
  useEffect(() => {
    if (status?.status === 'complete' || status?.status === 'failed') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
    }
  }, [status?.status]);

  // Calculate derived values
  const progressPercentage = status
    ? status.totalModules > 0
      ? Math.round((status.modulesGenerated / status.totalModules) * 100)
      : 0
    : 0;

  const estimatedTimeRemaining = status ? (status.totalModules - status.modulesGenerated) * 5 : 0;

  const activeModuleIndex = status?.jobs?.details?.find(
    (j) => j.state === 'active' || j.state === 'waiting'
  )?.moduleIndex;

  return {
    status,
    loading,
    error,
    isPolling,
    isGenerationActive,
    progressPercentage,
    estimatedTimeRemaining,
    activeModuleIndex,
    retryCount,
    maxRetries,
    refresh: () => fetchStatus(),
    startPolling,
    stopPolling,
    retry,
  };
}

/**
 * Check if there's an ongoing Step 10 generation for a workflow
 * Useful for detecting generation on component mount
 */
export async function checkOngoingGeneration(workflowId: string): Promise<{
  isGenerating: boolean;
  modulesGenerated: number;
  totalModules: number;
  status: Step10Status | null;
}> {
  try {
    const response = await api.get(`/api/v3/workflow/${workflowId}/step10/status`);

    if (response.data.success) {
      const status = response.data.data as Step10Status;
      const isGenerating =
        status.status === 'in_progress' ||
        status.jobs?.active > 0 ||
        status.jobs?.details?.some((j) => j.state === 'waiting' || j.state === 'active');

      return {
        isGenerating,
        modulesGenerated: status.modulesGenerated,
        totalModules: status.totalModules,
        status,
      };
    }
  } catch (error) {
    console.error('[checkOngoingGeneration] Error:', error);
  }

  return {
    isGenerating: false,
    modulesGenerated: 0,
    totalModules: 0,
    status: null,
  };
}

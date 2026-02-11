/**
 * Generic hook to monitor background job status for Steps 1-9
 * Polls the status endpoint and provides real-time updates
 * Includes retry logic with exponential backoff
 *
 * Generalized from useStep10Status.ts to work with any step number.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

export interface StepJobDetail {
  jobId: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  attemptsMade: number;
  failedReason?: string;
  processedOn?: number;
  finishedOn?: number;
}

export interface StepGenerationStatus {
  workflowId: string;
  stepNumber: number;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  hasData: boolean;
  job: StepJobDetail | null;
  stepData?: {
    currentStep: number;
    workflowStatus: string;
  };
}

interface UseStepStatusOptions {
  /** Polling interval in milliseconds (default: 10000 - 10 seconds) */
  pollInterval?: number;
  /** Maximum retry attempts before showing error (default: 3) */
  maxRetries?: number;
  /** Whether to auto-detect ongoing generation on mount (default: false) */
  autoStart?: boolean;
  /** Callback when generation completes */
  onComplete?: () => void;
  /** Callback when generation fails */
  onFailed?: (error: string) => void;
}

export function useStepStatus(
  workflowId: string,
  stepNumber: number,
  options: UseStepStatusOptions = {}
) {
  const { pollInterval = 10000, maxRetries = 3, autoStart = false, onComplete, onFailed } = options;

  const [status, setStatus] = useState<StepGenerationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [isGenerationActive, setIsGenerationActive] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  const hasNotifiedCompleteRef = useRef(false);

  // Stable refs for callbacks to avoid re-creating fetchStatus
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  onCompleteRef.current = onComplete;
  onFailedRef.current = onFailed;

  const fetchStatus = useCallback(
    async (isRetry = false): Promise<boolean> => {
      if (!workflowId || !stepNumber) return false;

      try {
        setLoading(true);
        if (!isRetry) {
          setError(null);
        }

        const response = await api.get(`/api/v3/workflow/${workflowId}/step/${stepNumber}/status`);

        if (response.data.success) {
          const newStatus = response.data.data as StepGenerationStatus;
          setStatus(newStatus);
          setRetryCount(0);
          setError(null);

          const isActive = newStatus.status === 'queued' || newStatus.status === 'processing';
          setIsGenerationActive(isActive);

          // Detect status transitions
          const prevStatus = previousStatusRef.current;
          previousStatusRef.current = newStatus.status;

          // Notify on completion (only once)
          if (
            newStatus.status === 'completed' &&
            prevStatus &&
            prevStatus !== 'completed' &&
            !hasNotifiedCompleteRef.current
          ) {
            hasNotifiedCompleteRef.current = true;
            onCompleteRef.current?.();
          }

          // Notify on failure
          if (newStatus.status === 'failed' && prevStatus !== 'failed') {
            onFailedRef.current?.(newStatus.job?.failedReason || 'Generation failed');
          }

          return true;
        } else {
          throw new Error(response.data.error || 'Failed to fetch status');
        }
      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch status';

        if (retryCount < maxRetries) {
          const nextRetryCount = retryCount + 1;
          setRetryCount(nextRetryCount);

          const backoffDelay = Math.pow(2, nextRetryCount) * 1000;

          retryTimeoutRef.current = setTimeout(() => {
            fetchStatus(true);
          }, backoffDelay);

          return false;
        } else {
          setError(errorMessage);
          setIsPolling(false);
          return false;
        }
      } finally {
        setLoading(false);
      }
    },
    [workflowId, stepNumber, retryCount, maxRetries]
  );

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setIsPolling(true);
    hasNotifiedCompleteRef.current = false;

    fetchStatus();

    intervalRef.current = setInterval(() => {
      fetchStatus();
    }, pollInterval);
  }, [fetchStatus, pollInterval]);

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

  const retry = useCallback(() => {
    setRetryCount(0);
    setError(null);
    startPolling();
  }, [startPolling]);

  // Auto-start: detect ongoing generation on mount
  useEffect(() => {
    if (!workflowId || !stepNumber || !autoStart) return;

    fetchStatus().then((success) => {
      if (success) {
        // Status will be set by fetchStatus, check it on next render
      }
    });

    return () => {
      stopPolling();
    };
    // eslint-disable-next-line
  }, [workflowId, stepNumber, autoStart]);

  // Start polling if we detect an active generation after autoStart fetch
  useEffect(() => {
    if (
      autoStart &&
      status &&
      (status.status === 'queued' || status.status === 'processing') &&
      !isPolling
    ) {
      startPolling();
    }
  }, [autoStart, status, isPolling, startPolling]);

  // Stop polling when generation completes or fails
  useEffect(() => {
    if (status?.status === 'completed' || status?.status === 'failed') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
    }
  }, [status?.status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    status,
    loading,
    error,
    isPolling,
    isGenerationActive,
    retryCount,
    maxRetries,

    // Actions
    refresh: () => fetchStatus(),
    startPolling,
    stopPolling,
    retry,
  };
}

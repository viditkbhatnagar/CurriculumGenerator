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
  /** Callback when generation completes */
  onComplete?: () => void;
  /** Callback when generation fails */
  onFailed?: (error: string) => void;
}

export function useStep10Status(workflowId: string, options: UseStep10StatusOptions = {}) {
  const {
    pollInterval = 10000, // 10 seconds default
    maxRetries = 3,
    autoStart = true,
    onComplete,
    onFailed,
  } = options;

  const [status, setStatus] = useState<Step10Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);

  // Track if generation is actively in progress
  const [isGenerationActive, setIsGenerationActive] = useState(false);

  // Refs for cleanup and tracking
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  const hasNotifiedCompleteRef = useRef(false);

  // Fetch status from backend
  const fetchStatus = useCallback(async (isRetry = false): Promise<boolean> => {
    if (!workflowId) return false;

    try {
      setLoading(true);
      if (!isRetry) {
        setError(null);
      }

      const response = await api.get(`/api/v3/workflow/${workflowId}/step10/status`);

      if (response.data.success) {
        const newStatus = response.data.data as Step10Status;
        setStatus(newStatus);
        setRetryCount(0); // Reset retry count on success
        setError(null);

        // Check if generation is active
        const isActive = newStatus.status === 'in_progress' || 
                        (newStatus.jobs?.active > 0) ||
                        (newStatus.modulesGenerated < newStatus.totalModules && newStatus.jobs?.total > 0);
        setIsGenerationActive(isActive);

        // Check for status changes
        const prevStatus = previousStatusRef.current;
        previousStatusRef.current = newStatus.status;

        // Notify on completion (only once)
        if (newStatus.status === 'complete' && prevStatus === 'in_progress' && !hasNotifiedCompleteRef.current) {
          hasNotifiedCompleteRef.current = true;
          onComplete?.();
        }

        // Notify on failure
        if (newStatus.status === 'failed' && prevStatus !== 'failed') {
          const failedJob = newStatus.jobs?.details?.find(j => j.state === 'failed');
          onFailed?.(failedJob?.failedReason || 'Generation failed');
        }

        return true;
      } else {
        throw new Error(response.data.error || 'Failed to fetch status');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch status';
      
      // Handle retry logic
      if (retryCount < maxRetries) {
        const nextRetryCount = retryCount + 1;
        setRetryCount(nextRetryCount);
        
        // Exponential backoff: 2s, 4s, 8s
        const backoffDelay = Math.pow(2, nextRetryCount) * 1000;
        
        console.log(`[Step10Status] Retry ${nextRetryCount}/${maxRetries} in ${backoffDelay}ms`);
        
        retryTimeoutRef.current = setTimeout(() => {
          fetchStatus(true);
        }, backoffDelay);
        
        return false;
      } else {
        // Max retries exceeded
        setError(errorMessage);
        setIsPolling(false);
        return false;
      }
    } finally {
      setLoading(false);
    }
  }, [workflowId, retryCount, maxRetries, onComplete, onFailed]);

  // Start polling
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
    setError(null);
    startPolling();
  }, [startPolling]);

  // Auto-start polling and detect ongoing generation
  useEffect(() => {
    if (!workflowId || !autoStart) return;

    // Initial fetch to detect if generation is already in progress
    fetchStatus().then((success) => {
      if (success && status) {
        // If generation is in progress, start polling
        if (status.status === 'in_progress' || (status.jobs?.active > 0)) {
          startPolling();
        }
      }
    });

    return () => {
      stopPolling();
    };
  }, [workflowId, autoStart, startPolling, stopPolling]);

  // Stop polling when generation completes or fails
  useEffect(() => {
    if (status?.status === 'complete' || status?.status === 'failed') {
      // Stop polling but keep the status
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

  // Estimate 5 minutes per remaining module
  const estimatedTimeRemaining = status
    ? (status.totalModules - status.modulesGenerated) * 5
    : 0;

  // Get current active module index
  const activeModuleIndex = status?.jobs?.details?.find(
    j => j.state === 'active' || j.state === 'waiting'
  )?.moduleIndex;

  return {
    // Status data
    status,
    loading,
    error,
    
    // Derived state
    isPolling,
    isGenerationActive,
    progressPercentage,
    estimatedTimeRemaining,
    activeModuleIndex,
    retryCount,
    maxRetries,
    
    // Actions
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
      const isGenerating = status.status === 'in_progress' || 
                          (status.jobs?.active > 0) ||
                          (status.jobs?.details?.some(j => j.state === 'waiting' || j.state === 'active'));
      
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

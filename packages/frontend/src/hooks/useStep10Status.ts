/**
 * Hook to monitor Step 10 background job status
 * Polls the status endpoint and provides real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

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
    details: Array<{
      jobId: string;
      moduleIndex: number;
      state: string;
      progress: number;
      attemptsMade: number;
      failedReason?: string;
    }>;
  };
  status: 'complete' | 'in_progress' | 'failed' | 'pending';
}

export function useStep10Status(workflowId: string, pollInterval: number = 5000) {
  const [status, setStatus] = useState<Step10Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!workflowId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/workflow/${workflowId}/step10/status`);

      if (response.data.success) {
        setStatus(response.data.data);
      } else {
        setError(response.data.error || 'Failed to fetch status');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  // Poll for status updates
  useEffect(() => {
    if (!workflowId) return;

    // Fetch immediately
    fetchStatus();

    // Set up polling
    const interval = setInterval(fetchStatus, pollInterval);

    // Stop polling if complete or failed
    if (status?.allComplete || status?.status === 'failed') {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [workflowId, pollInterval, fetchStatus, status?.allComplete, status?.status]);

  const progressPercentage = status
    ? Math.round((status.modulesGenerated / status.totalModules) * 100)
    : 0;

  const estimatedTimeRemaining = status
    ? (status.totalModules - status.modulesGenerated) * 15 // 15 minutes per module
    : 0;

  return {
    status,
    loading,
    error,
    progressPercentage,
    estimatedTimeRemaining,
    refresh: fetchStatus,
  };
}

/**
 * useStep7Streaming Hook
 * Handles Server-Sent Events (SSE) for real-time Step 7 assessment generation
 */
import { useState, useCallback, useRef } from 'react';
import { AssessmentUserPreferences } from '@/types/workflow';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Progress {
  stage?: string;
  currentModule?: string;
  currentType?: string;
  totalSteps?: number;
  completedSteps?: number;
  estimatedTimeRemaining?: number;
}

interface StreamData {
  type: 'formative_batch' | 'summative_batch' | 'sample_batch' | 'lms_batch';
  formatives?: any[];
  summatives?: any[];
  samples?: any[];
  sampleType?: string;
  lmsPackages?: any;
  moduleId?: string;
  totalCount?: number;
}

interface StreamState {
  isStreaming: boolean;
  progress: Progress | null;
  error: string | null;
  formativeCount: number;
  summativeCount: number;
  sampleCounts: {
    mcq: number;
    sjt: number;
    case: number;
    essay: number;
    practical: number;
  };
}

export function useStep7Streaming() {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    progress: null,
    error: null,
    formativeCount: 0,
    summativeCount: 0,
    sampleCounts: {
      mcq: 0,
      sjt: 0,
      case: 0,
      essay: 0,
      practical: 0,
    },
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const startStreaming = useCallback(
    (workflowId: string, userPreferences: AssessmentUserPreferences) => {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setState({
        isStreaming: true,
        progress: null,
        error: null,
        formativeCount: 0,
        summativeCount: 0,
        sampleCounts: {
          mcq: 0,
          sjt: 0,
          case: 0,
          essay: 0,
          practical: 0,
        },
      });

      // Get auth token
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      // Create EventSource connection
      const url = `${API_BASE_URL}/api/v3/workflow/${workflowId}/step7/stream`;

      // Use fetch to POST data, then establish SSE
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(userPreferences),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to start streaming');
          }

          // Read the response as a stream
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No reader available');
          }

          const decoder = new TextDecoder();

          function readStream() {
            // reader is guaranteed to exist due to check above
            reader!
              .read()
              .then(({ done, value }) => {
                if (done) {
                  setState((prev) => ({ ...prev, isStreaming: false }));
                  return;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                lines.forEach((line) => {
                  if (line.startsWith('data:')) {
                    try {
                      const data = JSON.parse(line.slice(5).trim());
                      handleMessage(data);
                    } catch (err) {
                      console.error('Failed to parse SSE data:', err);
                    }
                  }
                });

                readStream();
              })
              .catch((err) => {
                console.error('Stream reading error:', err);
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  error: err.message || 'Stream error',
                }));
              });
          }

          readStream();
        })
        .catch((err) => {
          console.error('Failed to start streaming:', err);
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: err.message || 'Failed to start streaming',
          }));
        });

      function handleMessage(event: any) {
        console.log('[SSE] Received:', event);

        if (event.type === 'connected') {
          console.log('[SSE] Connected');
        } else if (event.type === 'progress') {
          setState((prev) => ({ ...prev, progress: event.progress }));
        } else if (event.type === 'data') {
          // Incremental data update
          const streamData: StreamData = event.data;

          setState((prev) => {
            const newState = { ...prev };

            if (streamData.type === 'formative_batch' && streamData.formatives) {
              newState.formativeCount =
                streamData.totalCount || prev.formativeCount + streamData.formatives.length;
            } else if (streamData.type === 'summative_batch' && streamData.summatives) {
              newState.summativeCount =
                streamData.totalCount || prev.summativeCount + streamData.summatives.length;
            } else if (streamData.type === 'sample_batch' && streamData.samples) {
              const sampleType = streamData.sampleType;
              if (sampleType === 'mcq') {
                newState.sampleCounts.mcq = streamData.samples.length;
              } else if (sampleType === 'sjt') {
                newState.sampleCounts.sjt = streamData.samples.length;
              } else if (sampleType === 'case' || sampleType === 'caseQuestions') {
                newState.sampleCounts.case = streamData.samples.length;
              } else if (sampleType === 'essay' || sampleType === 'essayPrompts') {
                newState.sampleCounts.essay = streamData.samples.length;
              } else if (sampleType === 'practical' || sampleType === 'practicalTasks') {
                newState.sampleCounts.practical = streamData.samples.length;
              }
            }

            return newState;
          });
        } else if (event.type === 'complete') {
          console.log('[SSE] Complete', event);
          setState((prev) => ({ ...prev, isStreaming: false }));
        } else if (event.type === 'error') {
          console.error('[SSE] Error:', event.error);
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: event.error,
          }));
        }
      }
    },
    []
  );

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  return {
    ...state,
    startStreaming,
    stopStreaming,
  };
}

'use client';

import { useState, useEffect, useRef } from 'react';

interface GenerationStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  estimatedCompletion?: string;
}

interface CurriculumGenerationInterfaceProps {
  programId: string;
  onGenerationComplete?: () => void;
}

export function CurriculumGenerationInterface({ 
  programId, 
  onGenerationComplete 
}: CurriculumGenerationInterfaceProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startGeneration = async () => {
    setIsGenerating(true);
    setError(null);
    setGenerationStatus(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/curriculum/generate/${programId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to start generation');
      }

      const result = await response.json();
      const jobId = result.data.jobId;

      setGenerationStatus({
        jobId,
        status: 'queued',
        progress: 0,
        estimatedCompletion: result.data.estimatedCompletion,
      });

      // Use polling for now (WebSocket with Socket.IO requires different client setup)
      // connectWebSocket(jobId);
      startPolling(jobId);
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to start curriculum generation');
      setIsGenerating(false);
    }
  };

  const connectWebSocket = (jobId: string) => {
    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
      const ws = new WebSocket(`${wsUrl}/ws/generation/${jobId}`);

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          updateGenerationStatus(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Polling will continue as fallback
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
      // Polling will handle updates
    }
  };

  const startPolling = (jobId: string) => {
    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/curriculum/status/${jobId}`
        );

        if (response.ok) {
          const result = await response.json();
          updateGenerationStatus(result.data);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  };

  const updateGenerationStatus = (data: Partial<GenerationStatus>) => {
    setGenerationStatus(prev => ({
      ...prev!,
      ...data,
    }));

    if (data.status === 'completed') {
      setIsGenerating(false);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (onGenerationComplete) {
        onGenerationComplete();
      }
    } else if (data.status === 'failed') {
      setIsGenerating(false);
      setError(data.error || 'Generation failed');
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued':
        return 'bg-gray-100 text-gray-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return (
          <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'completed':
        return (
          <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const formatEstimatedTime = (estimatedCompletion?: string) => {
    if (!estimatedCompletion) return 'Calculating...';
    
    const completionTime = new Date(estimatedCompletion);
    const now = new Date();
    const diffMs = completionTime.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / 60000);

    if (diffMins <= 0) return 'Almost done...';
    if (diffMins === 1) return '1 minute';
    return `${diffMins} minutes`;
  };

  return (
    <div className="space-y-6">
      {/* Generation Trigger */}
      {!isGenerating && !generationStatus && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-medium text-gray-900">Ready to Generate Curriculum</h3>
              <p className="mt-2 text-sm text-gray-600">
                The system will analyze your uploaded data and generate a complete curriculum including:
              </p>
              <ul className="mt-3 text-sm text-gray-600 space-y-1">
                <li className="flex items-center">
                  <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Program Specification Document
                </li>
                <li className="flex items-center">
                  <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Unit Specifications for Each Module
                </li>
                <li className="flex items-center">
                  <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Assessment Package with Questions and Rubrics
                </li>
                <li className="flex items-center">
                  <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Skill Mappings and KPIs
                </li>
              </ul>
              <p className="mt-4 text-sm text-gray-500">
                Estimated time: 3-5 minutes for a 120-hour program
              </p>
            </div>
          </div>
          <div className="mt-6">
            <button
              onClick={startGeneration}
              className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Curriculum
            </button>
          </div>
        </div>
      )}

      {/* Generation Progress */}
      {generationStatus && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {getStatusIcon(generationStatus.status)}
              <span className={`ml-3 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(generationStatus.status)}`}>
                {generationStatus.status.charAt(0).toUpperCase() + generationStatus.status.slice(1)}
              </span>
            </div>
            {generationStatus.status === 'processing' && (
              <span className="text-sm text-gray-600">
                Est. {formatEstimatedTime(generationStatus.estimatedCompletion)} remaining
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {(generationStatus.status === 'queued' || generationStatus.status === 'processing') && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Progress</span>
                <span className="text-gray-900 font-medium">{generationStatus.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${generationStatus.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {generationStatus.status === 'queued' && (
            <p className="text-sm text-gray-600">
              Your curriculum generation request is queued. It will start processing shortly...
            </p>
          )}

          {generationStatus.status === 'processing' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Generating your curriculum. This includes:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                <li>• Retrieving relevant knowledge from sources</li>
                <li>• Generating program and unit specifications</li>
                <li>• Creating assessment materials</li>
                <li>• Running quality assurance checks</li>
                <li>• Benchmarking against competitors</li>
              </ul>
            </div>
          )}

          {generationStatus.status === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Curriculum Generated Successfully!
                  </h3>
                  <p className="mt-1 text-sm text-green-700">
                    Your curriculum is ready for review. You can now view the generated content, quality assurance report, and benchmarking results.
                  </p>
                </div>
              </div>
            </div>
          )}

          {generationStatus.status === 'failed' && error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Generation Failed</h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Job ID */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Job ID: <span className="font-mono">{generationStatus.jobId}</span>
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && !generationStatus && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="ml-3 text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

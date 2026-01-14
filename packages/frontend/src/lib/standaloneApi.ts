import { api } from './api';

// Types for standalone step execution
export interface StandaloneExecuteRequest {
  stepNumber: number;
  description: string;
}

export interface StandaloneExecuteResponse {
  success: boolean;
  stepNumber: number;
  stepName: string;
  output: any;
  metadata: {
    executedAt: string;
    duration?: number;
  };
}

export interface StandaloneErrorResponse {
  success: false;
  error: string;
  details?: string[];
}

export interface StandaloneExportRequest {
  stepNumber: number;
  stepName: string;
  description: string;
  content: any;
}

/**
 * Execute a standalone step with the provided description
 * @param stepNumber - Step number (2-10)
 * @param description - Description/context for the step
 * @returns Step execution result
 */
export async function executeStep(
  stepNumber: number,
  description: string
): Promise<StandaloneExecuteResponse> {
  try {
    const response = await api.post<{ success: boolean; data: any; error?: string }>(`/api/v3/standalone/step/${stepNumber}`, {
      description,
    });
    
    // Transform backend response to match frontend interface
    return {
      success: response.data.success,
      stepNumber: response.data.data.stepNumber,
      stepName: response.data.data.stepName,
      output: response.data.data.content,
      metadata: {
        executedAt: response.data.data.generatedAt,
      },
    };
  } catch (error: any) {
    // Extract error message from axios error response
    const errorMessage = error.response?.data?.error || error.message || 'Generation failed. Please try again.';
    throw new Error(errorMessage);
  }
}

/**
 * Get metadata for all available standalone steps
 * @returns Array of step metadata
 */
export async function getStepMetadata(): Promise<{
  steps: Array<{
    stepNumber: number;
    name: string;
    description: string;
    estimatedTime: string;
  }>;
}> {
  const response = await api.get('/api/v3/standalone/steps');
  return response.data;
}

/**
 * Export standalone step output as Word document
 * Requirements: 6.2, 6.3, 6.4, 6.5
 * 
 * @param data - Export data including step info and content
 * @returns Downloads the Word document
 */
export async function exportStepAsWord(data: StandaloneExportRequest): Promise<void> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  
  const response = await fetch(`${API_BASE_URL}/api/v3/standalone/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Export failed' }));
    throw new Error(errorData.error || 'Failed to export Word document');
  }

  // Get the blob from response
  const blob = await response.blob();
  
  // Create download link
  const filename = `${data.stepName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.docx`;
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

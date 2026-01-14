/**
 * 9-Step Curriculum Workflow Hooks
 * React Query hooks for workflow API interactions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import {
  CurriculumWorkflow,
  WorkflowResponse,
  WorkflowProgressResponse,
  Step1FormData,
  Step2FormData,
  Step3FormData,
  Step7FormData,
} from '@/types/workflow';

const WORKFLOW_BASE = '/api/v3/workflow';

// =============================================================================
// WORKFLOW QUERIES
// =============================================================================

/**
 * Fetch all workflows for the current user
 */
export function useWorkflows(filters?: { status?: string; step?: number }) {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.set('status', filters.status);
  if (filters?.step) queryParams.set('step', filters.step.toString());
  const queryString = queryParams.toString();

  return useQuery<CurriculumWorkflow[]>({
    queryKey: ['workflows', filters],
    queryFn: async () => {
      const response = await fetchAPI(`${WORKFLOW_BASE}${queryString ? `?${queryString}` : ''}`);
      return response.data || [];
    },
  });
}

/**
 * Fetch a single workflow by ID
 */
export function useWorkflow(id: string) {
  return useQuery<CurriculumWorkflow>({
    queryKey: ['workflow', id],
    queryFn: async () => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Fetch workflow progress summary
 */
export function useWorkflowProgress(id: string) {
  return useQuery({
    queryKey: ['workflow', id, 'progress'],
    queryFn: async () => {
      const response: WorkflowProgressResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/progress`);
      return response.data;
    },
    enabled: !!id,
    refetchInterval: 5000, // Poll every 5 seconds for progress updates
  });
}

// =============================================================================
// WORKFLOW MUTATIONS
// =============================================================================

/**
 * Create a new workflow
 */
export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectName: string) => {
      const response: WorkflowResponse = await fetchAPI(WORKFLOW_BASE, {
        method: 'POST',
        body: JSON.stringify({ projectName }),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

/**
 * Delete a workflow
 */
export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}`, {
        method: 'DELETE',
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

// =============================================================================
// STEP 1: PROGRAM FOUNDATION
// =============================================================================

export function useSubmitStep1() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Step1FormData }) => {
      const response: WorkflowResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/step1`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', variables.id] });
    },
  });
}

export function useApproveStep1() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step1/approve`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

// =============================================================================
// STEP 2: COMPETENCY FRAMEWORK (KSA)
// =============================================================================

export function useSubmitStep2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Step2FormData }) => {
      const response: WorkflowResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/step2`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', variables.id] });
    },
  });
}

export function useUpdateKSAItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workflowId,
      ksaId,
      data,
    }: {
      workflowId: string;
      ksaId: string;
      data: { statement?: string; description?: string; importance?: string };
    }) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${workflowId}/step2/ksa/${ksaId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['workflow', variables.workflowId],
      });
    },
  });
}

export function useApproveStep2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step2/approve`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

// =============================================================================
// STEP 3: PROGRAM LEARNING OUTCOMES (PLOs)
// =============================================================================

export function useSubmitStep3() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Step3FormData }) => {
      const response: WorkflowResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/step3`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', variables.id] });
    },
  });
}

export function useApproveStep3() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step3/approve`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

// =============================================================================
// STEP 4: COURSE FRAMEWORK & MLOs
// =============================================================================

export function useSubmitStep4() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response: WorkflowResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/step4`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useUpdateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workflowId,
      moduleId,
      data,
    }: {
      workflowId: string;
      moduleId: string;
      data: Partial<{
        title: string;
        description: string;
        totalHours: number;
        contactHours: number;
      }>;
    }) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${workflowId}/step4/module/${moduleId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['workflow', variables.workflowId],
      });
    },
  });
}

export function useApproveStep4() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step4/approve`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

// =============================================================================
// STEP 5: TOPIC-LEVEL SOURCES
// =============================================================================

export function useSubmitStep5() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response: WorkflowResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/step5`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useApproveStep5() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step5/approve`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

// =============================================================================
// STEP 6: READING LISTS
// =============================================================================

export function useSubmitStep6() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response: WorkflowResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/step6`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useApproveStep6() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step6/approve`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

// =============================================================================
// STEP 7: AUTO-GRADABLE ASSESSMENTS
// =============================================================================

export function useSubmitStep7() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data?: Step7FormData }) => {
      const response: WorkflowResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/step7`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', variables.id] });
    },
  });
}

export function useApproveStep7() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step7/approve`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useClearStep7() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step7`, {
        method: 'DELETE',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

// =============================================================================
// STEP 8: CASE STUDIES
// =============================================================================

export function useSubmitStep8() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response: WorkflowResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/step8`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useApproveStep8() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step8/approve`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

// =============================================================================
// STEP 9: GLOSSARY (AUTO-GENERATED)
// =============================================================================

export function useSubmitStep9() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response: WorkflowResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/step9`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useApproveStep9() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step9/approve`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

// =============================================================================
// STEP 10: LESSON PLANS (Separated from PPT for timeout prevention)
// =============================================================================

export function useSubmitStep10() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response: WorkflowResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/step10`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useApproveStep10() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step10/approve`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

// =============================================================================
// STEP 11: PPT GENERATION (Separated from Lesson Plans for timeout prevention)
// =============================================================================

export function useSubmitStep11() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response: WorkflowResponse = await fetchAPI(`${WORKFLOW_BASE}/${id}/step11`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useApproveStep11() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step11/approve`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useStep11Status(id: string) {
  return useQuery({
    queryKey: ['workflow', id, 'step11-status'],
    queryFn: async () => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/step11/status`);
      return response.data;
    },
    enabled: !!id,
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

// =============================================================================
// WORKFLOW COMPLETION & EXPORT
// =============================================================================

export function useCompleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/complete`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useExportWorkflow(id: string) {
  return useQuery({
    queryKey: ['workflow', id, 'export'],
    queryFn: async () => {
      const response = await fetchAPI(`${WORKFLOW_BASE}/${id}/export`);
      return response.data;
    },
    enabled: false, // Only fetch on demand
  });
}

// =============================================================================
// HELPER HOOKS
// =============================================================================

/**
 * Get the next available action for a workflow
 */
export function useNextWorkflowAction(workflow?: CurriculumWorkflow) {
  if (!workflow) return null;

  const step = workflow.currentStep;
  const stepData = workflow[`step${step}` as keyof CurriculumWorkflow];

  if (!stepData) {
    return { type: 'generate', step };
  }

  // Check if step is approved
  const stepProgress = workflow.stepProgress.find((p) => p.step === step);
  if (stepProgress?.status === 'approved') {
    if (step < 11) {
      return { type: 'generate', step: step + 1 };
    }
    return { type: 'complete' };
  }

  return { type: 'approve', step };
}

/**
 * Calculate total estimated time for remaining steps
 */
export function useRemainingTime(currentStep: number): string {
  const stepTimes: Record<number, number> = {
    1: 20,
    2: 15,
    3: 20,
    4: 30,
    5: 10,
    6: 8,
    7: 20,
    8: 15,
    9: 5,
    10: 15,
    11: 15,
  };

  let remaining = 0;
  for (let i = currentStep; i <= 11; i++) {
    remaining += stepTimes[i] || 0;
  }

  if (remaining <= 60) {
    return `~${remaining} minutes`;
  }
  return `~${Math.round((remaining / 60) * 10) / 10} hours`;
}

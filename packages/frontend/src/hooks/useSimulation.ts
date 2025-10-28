import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Scenario,
  ScenarioState,
  PerformanceReport,
  CreateScenarioRequest,
} from '@/types/simulation';

export function useSimulation(studentId: string) {
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [currentState, setCurrentState] = useState<ScenarioState | null>(null);

  // Create new scenario
  const createScenarioMutation = useMutation({
    mutationFn: async (request: CreateScenarioRequest) => {
      const response = await api.post('/api/simulations/create', request);
      return response.data as Scenario;
    },
    onSuccess: (data) => {
      setCurrentScenario(data);
      setCurrentState(data.initialState);
    },
  });

  // Process action
  const processActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      if (!currentScenario) throw new Error('No active scenario');
      const response = await api.post(`/api/simulations/${currentScenario.scenarioId}/action`, {
        studentId,
        actionId,
      });
      return response.data as ScenarioState;
    },
    onSuccess: (data) => {
      setCurrentState(data);
    },
  });

  // Get performance report
  const { data: performanceReport, refetch: fetchPerformanceReport } = useQuery({
    queryKey: ['simulation-report', currentScenario?.scenarioId, studentId],
    queryFn: async () => {
      if (!currentScenario) return null;
      const response = await api.get(
        `/api/simulations/${currentScenario.scenarioId}/evaluate`,
        {
          params: { studentId },
        }
      );
      return response.data as PerformanceReport;
    },
    enabled: false, // Only fetch when explicitly called
  });

  // Reset scenario
  const resetScenarioMutation = useMutation({
    mutationFn: async () => {
      if (!currentScenario) throw new Error('No active scenario');
      const response = await api.post(`/api/simulations/${currentScenario.scenarioId}/reset`, {
        studentId,
      });
      return response.data as ScenarioState;
    },
    onSuccess: (data) => {
      setCurrentState(data);
    },
  });

  const createScenario = useCallback(
    (request: CreateScenarioRequest) => {
      createScenarioMutation.mutate(request);
    },
    [createScenarioMutation]
  );

  const processAction = useCallback(
    (actionId: string) => {
      processActionMutation.mutate(actionId);
    },
    [processActionMutation]
  );

  const resetScenario = useCallback(() => {
    resetScenarioMutation.mutate();
  }, [resetScenarioMutation]);

  const getPerformanceReport = useCallback(() => {
    return fetchPerformanceReport();
  }, [fetchPerformanceReport]);

  return {
    currentScenario,
    currentState,
    performanceReport,
    createScenario,
    processAction,
    resetScenario,
    getPerformanceReport,
    isCreating: createScenarioMutation.isPending,
    isProcessing: processActionMutation.isPending,
    isResetting: resetScenarioMutation.isPending,
  };
}

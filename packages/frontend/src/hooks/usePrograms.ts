import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { Program, ProgramDetail, ProgramFeedback } from '@/types/program';

export function usePrograms() {
  return useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => {
      const response = await fetchAPI('/api/programs');
      // Backend returns { data: [...], pagination: {...} }
      return response.data || response || [];
    },
  });
}

export function useProgram(id: string) {
  return useQuery<ProgramDetail>({
    queryKey: ['programs', id],
    queryFn: () => fetchAPI(`/api/programs/${id}`),
    enabled: !!id,
  });
}

export function useUpdateProgramStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchAPI(`/api/programs/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedback: Omit<ProgramFeedback, 'id' | 'created_at'>) =>
      fetchAPI('/api/programs/feedback', {
        method: 'POST',
        body: JSON.stringify(feedback),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['programs', variables.program_id] });
    },
  });
}

export function useCreateProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      program_name: string;
      qualification_level: string;
      qualification_type: string;
      total_credits: number;
      industry_sector: string;
    }) =>
      fetchAPI('/api/programs/create', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });
}

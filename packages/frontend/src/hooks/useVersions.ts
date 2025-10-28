import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { CurriculumVersion, VersionDiff } from '@/types/version';

export function useVersionHistory(programId: string) {
  return useQuery<CurriculumVersion[]>({
    queryKey: ['versions', programId],
    queryFn: () => fetchAPI(`/api/programs/${programId}/versions`),
    enabled: !!programId,
  });
}

export function useVersionComparison(programId: string, version1: number, version2: number) {
  return useQuery<VersionDiff[]>({
    queryKey: ['versions', 'compare', programId, version1, version2],
    queryFn: () =>
      fetchAPI(`/api/programs/${programId}/versions/compare?v1=${version1}&v2=${version2}`),
    enabled: !!programId && version1 > 0 && version2 > 0,
  });
}

export function useRestoreVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ programId, versionId }: { programId: string; versionId: string }) =>
      fetchAPI(`/api/programs/${programId}/versions/${versionId}/restore`, {
        method: 'POST',
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['programs', variables.programId] });
      queryClient.invalidateQueries({ queryKey: ['versions', variables.programId] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { KnowledgeBaseSource, SearchFilters } from '@/types/knowledgeBase';

export function useKnowledgeBaseSources(filters?: SearchFilters) {
  const queryParams = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });
  }

  return useQuery<KnowledgeBaseSource[]>({
    queryKey: ['knowledge-base', 'sources', filters],
    queryFn: () => fetchAPI(`/api/knowledge-base/sources?${queryParams.toString()}`),
  });
}

export function useSearchKnowledgeBase(query: string, filters?: SearchFilters) {
  return useQuery<KnowledgeBaseSource[]>({
    queryKey: ['knowledge-base', 'search', query, filters],
    queryFn: () =>
      fetchAPI('/api/knowledge-base/search', {
        method: 'POST',
        body: JSON.stringify({ query, filters }),
      }),
    enabled: query.length > 0,
  });
}

export function useDeleteSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchAPI(`/api/knowledge-base/sources/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    },
  });
}

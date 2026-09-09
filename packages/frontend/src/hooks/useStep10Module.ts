/**
 * One module's lesson plans, fetched when the reader opens that module.
 *
 * The workflow response carries per-module stubs — code, title, hours, lesson count — and not
 * the lessons themselves. A 46-module programme holds around 26MB of teaching content, which
 * is more than the workflow document could store and far more than this screen needs to show
 * one module's lessons.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import type { ModuleLessonPlan } from '@/types/workflow';

export function useStep10Module(workflowId: string, moduleId: string | null) {
  return useQuery<ModuleLessonPlan | null>({
    queryKey: ['workflow', workflowId, 'step10', 'module', moduleId],
    queryFn: async () => {
      if (!moduleId) return null;
      const response = await fetchAPI(`/api/v3/workflow/${workflowId}/step10/module/${moduleId}`);
      return (response as any)?.data ?? null;
    },
    enabled: !!workflowId && !!moduleId,
    // Lesson plans change only when someone regenerates or edits them, and both paths
    // invalidate this key, so re-fetching on every focus would just re-download the module.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** One lesson, reduced to what a list needs to show and reference it. */
export interface Step10LessonIndexEntry {
  moduleId: string;
  moduleCode: string;
  lessonId: string;
  lessonNumber: number;
  lessonTitle: string;
}

/**
 * Every lesson's number and title across the programme.
 *
 * For panels that list the whole programme rather than read one module. A few hundred short
 * strings, against the 26MB of teaching content behind them.
 */
export function useStep10LessonIndex(workflowId: string, enabled = true) {
  return useQuery<Step10LessonIndexEntry[]>({
    queryKey: ['workflow', workflowId, 'step10', 'lesson-index'],
    queryFn: async () => {
      const response = await fetchAPI(`/api/v3/workflow/${workflowId}/step10/lesson-index`);
      return ((response as any)?.data as Step10LessonIndexEntry[]) ?? [];
    },
    enabled: !!workflowId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

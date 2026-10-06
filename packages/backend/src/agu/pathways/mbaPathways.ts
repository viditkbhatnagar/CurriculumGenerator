/**
 * The three AGU MBA pathways, assembled from the courses built in the generator.
 *
 * AGU's first need after single courses (Logan Pacey, 3 October 2026): "Combining approved
 * courses into the three MBA pathways". The catalogue defines the MBA as the 12-course core
 * plus one specialization of 4 courses, named on the award. Each AGU course is built as a
 * generator programme named exactly as in the catalogue, so a course is matched to its
 * programme by title, and a pathway is ready when every one of its 16 courses is published
 * (approved by the super admin).
 *
 * Pure, so it can be tested.
 */
import type { CatalogueCourse } from '../catalogue/types';

export const PATHWAYS = [
  { id: 'fintech', name: 'MBA with a specialization in FinTech', track: 'fintech' },
  { id: 'finance', name: 'MBA with a specialization in Finance', track: 'finance' },
  {
    id: 'supply_chain_operations',
    name: 'MBA with a specialization in Supply Chain & Operations',
    track: 'supply_chain_operations',
  },
] as const;

export type PathwayId = (typeof PATHWAYS)[number]['id'];
export type CourseState = 'not_started' | 'in_progress' | 'submitted' | 'published';

export interface ProgrammeSummary {
  _id: unknown;
  projectName?: string;
  step1?: { programTitle?: string };
  currentStep?: number;
  status?: string;
  publication?: { publishedAt?: Date | string };
}

export interface PathwayCourse {
  code: string;
  title: string;
  role: string;
  credits: number;
  hours: number;
  deliveryWindow: string;
  gateway?: string;
  state: CourseState;
  programmeId?: string;
  currentStep?: number;
  publishedAt?: string;
}

export interface PathwayStatus {
  id: PathwayId;
  name: string;
  courses: PathwayCourse[];
  totals: { courses: number; credits: number; hours: number; published: number };
  ready: boolean;
}

const normalise = (t: string | undefined) =>
  (t || '')
    .replace(/&amp;/g, '&')
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim();

export function courseState(p?: ProgrammeSummary): CourseState {
  if (!p) return 'not_started';
  if (p.status === 'published') return 'published';
  if (p.status === 'review_pending') return 'submitted';
  return 'in_progress';
}

const rank = (p: ProgrammeSummary) =>
  ({ published: 3000, submitted: 2000, in_progress: 1000, not_started: 0 })[courseState(p)] +
  (p.currentStep || 0);

/** Each catalogue course's programme: the furthest-on programme with its exact title. */
export function matchProgrammes(
  courses: CatalogueCourse[],
  programmes: ProgrammeSummary[]
): Map<string, ProgrammeSummary | undefined> {
  const out = new Map<string, ProgrammeSummary | undefined>();
  for (const course of courses) {
    const title = normalise(course.title);
    const candidates = programmes.filter(
      (p) => normalise(p.projectName) === title || normalise(p.step1?.programTitle) === title
    );
    out.set(course.code, candidates.sort((a, b) => rank(b) - rank(a))[0]);
  }
  return out;
}

export function pathwayStatuses(
  courses: CatalogueCourse[],
  programmes: ProgrammeSummary[]
): PathwayStatus[] {
  const matched = matchProgrammes(courses, programmes);
  return PATHWAYS.map((pathway) => {
    const members = [
      ...courses.filter((c) => c.track === 'core'),
      ...courses.filter((c) => c.track === pathway.track),
    ];
    const list: PathwayCourse[] = members.map((c) => {
      const p = matched.get(c.code);
      const published = p?.publication?.publishedAt;
      return {
        code: c.code,
        title: c.title,
        role: c.roleLabel || c.role,
        credits: c.semesterCredits,
        hours: c.hours.total,
        deliveryWindow: c.deliveryWindow,
        gateway: c.mbaGateway,
        state: courseState(p),
        programmeId: p ? String(p._id) : undefined,
        currentStep: p?.currentStep,
        publishedAt: published ? new Date(published).toISOString() : undefined,
      };
    });
    const published = list.filter((c) => c.state === 'published').length;
    return {
      id: pathway.id,
      name: pathway.name,
      courses: list,
      totals: {
        courses: list.length,
        credits: list.reduce((n, c) => n + c.credits, 0),
        hours: list.reduce((n, c) => n + c.hours, 0),
        published,
      },
      ready: list.length > 0 && published === list.length,
    };
  });
}

export interface SharedTopic {
  first: { course: string; module: string; topic: string };
  second: { course: string; module: string; topic: string };
}

/**
 * Weekly topics that two different courses of a pathway both teach, in nearly the same words.
 * AGU's default (3 October 2026): overlaps are flagged for the super admin, who decides which
 * course keeps the topic. Uses the same comparison as a single programme's repeated topics.
 */
export function sharedTopics(
  courses: { code: string; modules: { code?: string; topics?: unknown[] }[] }[],
  compare: (
    modules: { code?: string; topics?: unknown[] }[]
  ) => { first: { module: string; topic: string }; second: { module: string; topic: string } }[]
): SharedTopic[] {
  const SEP = '::';
  const modules = courses.flatMap((c) =>
    (c.modules || []).map((m) => ({ code: `${c.code}${SEP}${m.code || ''}`, topics: m.topics }))
  );
  return compare(modules)
    .map(({ first, second }) => {
      const [fc, fm] = first.module.split(SEP);
      const [sc, sm] = second.module.split(SEP);
      return {
        first: { course: fc, module: fm, topic: first.topic },
        second: { course: sc, module: sm, topic: second.topic },
      };
    })
    .filter((s) => s.first.course !== s.second.course);
}

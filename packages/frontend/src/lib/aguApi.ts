/**
 * Client for the AGU module engine (/api/agu): catalogue courses developed into module packages.
 * Types mirror packages/backend/src/agu; only the fields the screens read are declared.
 */
import { fetchAPI } from './api';

export interface AguCourse {
  code: string;
  title: string;
  track: 'core' | 'fintech' | 'finance' | 'supply_chain_operations';
  sequence: number;
  role: string;
  roleLabel: string;
  semesterCredits: number;
  hours: { total: number; contact: number; independent: number };
  description: string;
  descriptionMissing: boolean;
  mbaGateway?: string;
  deliveryWindow: string;
  catalogueFaculty: string;
  rplEligible: 'designated_only' | 'not_eligible';
  source: string;
}

export interface AguCatalogue {
  institution: {
    legalName: string;
    registration: { value: string; source: string };
    accreditation: { value: string; source: string };
  };
  edition: {
    version: string;
    published: string;
    effective: string;
    approvalStatus: string;
    approvalNote: string;
  };
  courses: AguCourse[];
  courseShape: Record<string, { value: unknown; source: string }>;
}

export interface AguFinding {
  code: string;
  severity: 'blocking' | 'warning';
  message: string;
  path?: string;
  source?: string;
}

export interface AguWeek {
  number: number;
  theme: string;
  outcomeIds: string[];
  liveLecture: {
    title: string;
    topics: string[];
    hours: number;
    runSheet: {
      startMinute: number;
      endMinute: number;
      segment: string;
      activity: string;
      materials?: string;
    }[];
  };
  monitoredStudy: {
    id: string;
    activity: string;
    facultyRole: string;
    evidenceLogged: string;
    hours: number;
  }[];
  independentStudy: { id: string; activity: string; hours: number }[];
  gradedItemsDue: string[];
}

export interface AguDraftContent {
  courseCode: string;
  outcomes: { id: string; statement: string; bloomLevel: string; origin: string }[];
  weeks: AguWeek[];
  assessments: {
    id: string;
    component: string;
    title: string;
    weight: number;
    weekDue: number;
    outcomeIds: string[];
    proctored: boolean;
    aiUse: string;
    brief?: string;
  }[];
  readings: {
    id: string;
    citation: string;
    week: number;
    required: boolean;
    access: string;
    link?: string;
  }[];
  cases: { id: string; title: string; week: number; source: string; outcomeIds: string[] }[];
}

/** T07-T11 as the screens read them; the full shape is in backend agu/draft/artefactTypes. */
export interface AguArtefacts {
  rubrics: {
    assessmentId: string;
    rows: { outcomeId: string; criterion: string; weight: number }[];
  }[];
  quizBank: {
    plan: {
      week: number;
      items: number;
      timeLimitMinutes: number;
      attempts: number;
      weight: number;
    }[];
    items: { id: string; week: number; outcomeId: string; type: string; question: string }[];
    practice: { id: string; week: number; outcomeId: string; question: string }[];
  };
  finalExam: {
    durationMinutes: number;
    totalMarks: number;
    paper: { number: number; outcomeId: string; type: string; question: string; marks: number }[];
  } | null;
  discussions: {
    week: number;
    prompt: string;
    outcomeIds: string[];
    graded: boolean;
    weight: number;
    contactHours: number;
  }[];
  tutorPack: {
    glossary: { term: string }[];
    faqs: { question: string }[];
    workedExamples: { problem: string }[];
    misconceptions: { misconception: string }[];
    guardrails: { doNot: string; instead: string }[];
  };
  generatedAt: string;
}

export type AguArtefactStatus =
  | 'not_started'
  | 'generating'
  | 'failed'
  | 'needs_faculty'
  | 'ready_for_review'
  | 'faculty_accepted';

export interface AguStageRun {
  stage: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  model?: string;
  sourcesOffered?: number;
  guidancePassages?: number;
  readingsDropped?: number;
  blockingFindings?: number;
  error?: string;
}

export interface AguDraft {
  _id: string;
  courseCode: string;
  version: number;
  status:
    | 'created'
    | 'generating'
    | 'failed'
    | 'needs_faculty'
    | 'ready_for_review'
    | 'faculty_accepted';
  facultyInputs: Record<string, string>;
  draft?: AguDraftContent;
  findings: AguFinding[];
  stageRuns: AguStageRun[];
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  /** T07-T11, drafted in a second stage with its own status. */
  artefacts?: AguArtefacts;
  artefactFindings?: AguFinding[];
  artefactStatus?: AguArtefactStatus;
  artefactsAcceptedAt?: string;
}

export interface AguFacultyInputs {
  emphasis?: string;
  learners?: string;
  tools?: string;
  context?: string;
  notes?: string;
}

export async function getAguCatalogue(): Promise<AguCatalogue> {
  return (await fetchAPI('/api/agu/catalogue')).data;
}

export async function getAguCourse(code: string): Promise<{
  course: AguCourse;
  drafts: Pick<AguDraft, '_id' | 'version' | 'status' | 'createdAt' | 'acceptedAt'>[];
}> {
  return (await fetchAPI(`/api/agu/courses/${encodeURIComponent(code)}`)).data;
}

export async function createAguDraft(
  code: string,
  facultyInputs: AguFacultyInputs
): Promise<{ draftId: string }> {
  return (
    await fetchAPI(`/api/agu/courses/${encodeURIComponent(code)}/drafts`, {
      method: 'POST',
      body: JSON.stringify({ facultyInputs }),
    })
  ).data;
}

export async function getAguDraft(id: string): Promise<AguDraft> {
  return (await fetchAPI(`/api/agu/drafts/${id}`)).data;
}

export async function regenerateAguDraft(id: string): Promise<void> {
  await fetchAPI(`/api/agu/drafts/${id}/regenerate`, { method: 'POST', body: '{}' });
}

export async function acceptAguDraft(id: string): Promise<AguDraft> {
  return (await fetchAPI(`/api/agu/drafts/${id}/accept`, { method: 'POST', body: '{}' })).data;
}

/** Start drafting T07-T11 from the outline. The run continues in the background. */
export async function draftAguArtefacts(id: string): Promise<void> {
  await fetchAPI(`/api/agu/drafts/${id}/artefacts`, { method: 'POST', body: '{}' });
}

export async function acceptAguArtefacts(id: string): Promise<void> {
  await fetchAPI(`/api/agu/drafts/${id}/artefacts/accept`, { method: 'POST', body: '{}' });
}

/** Save faculty edits to the outline. The server re-checks them and derives the status. */
export async function saveAguDraft(id: string, draft: AguDraftContent): Promise<void> {
  await fetchAPI(`/api/agu/drafts/${id}`, { method: 'PATCH', body: JSON.stringify({ draft }) });
}

export type PathwayCourseState = 'not_started' | 'in_progress' | 'submitted' | 'published';

export interface AguPathway {
  id: string;
  name: string;
  courses: {
    code: string;
    title: string;
    role: string;
    credits: number;
    hours: number;
    deliveryWindow: string;
    gateway?: string;
    state: PathwayCourseState;
    programmeId?: string;
    currentStep?: number;
    publishedAt?: string;
  }[];
  totals: { courses: number; credits: number; hours: number; published: number };
  ready: boolean;
}

/** The three MBA pathways and the state of each course (backend agu/pathways). */
export async function getAguPathways(): Promise<AguPathway[]> {
  return (await fetchAPI('/api/agu/pathways')).data;
}

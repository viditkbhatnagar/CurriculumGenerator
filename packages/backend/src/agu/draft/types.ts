/**
 * A course draft: one AGU catalogue course being developed into the module package faculty
 * deliver (templates T01-T11, T13 for capstones).
 *
 * The draft is structured data first and prose second, so the checks can run on stored
 * objects rather than on generated text: every outcome, week, activity, assessment and
 * reading has an id, and the links between them are ids, not sentences. Each generated item
 * records where it came from (origin) and which evidence supports it, so faculty can see what
 * is sourced, what is a proposal and what is still missing.
 */

export type Origin =
  /** Locked fact copied from the approved catalogue. */
  | 'catalogue'
  /** Entered or edited by faculty. */
  | 'faculty'
  /** Supported by a retrieved source passage (see evidence). */
  | 'sourced'
  /** Generated as a design proposal for faculty to accept or change. */
  | 'proposal'
  /** An invented teaching scenario, labelled as such. */
  | 'hypothetical';

export interface EvidenceRef {
  sourceId: string;
  /** Section, page or chunk locator inside the source. */
  locator?: string;
  quote?: string;
}

export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyse' | 'evaluate' | 'create';

export interface CourseOutcome {
  id: string;
  statement: string;
  bloomLevel: BloomLevel;
  origin: Origin;
  evidence?: EvidenceRef[];
}

export interface RunSheetSegment {
  startMinute: number;
  endMinute: number;
  segment: string;
  activity: string;
  materials?: string;
  outcomeIds?: string[];
}

export interface MonitoredActivity {
  id: string;
  activity: string;
  /** What faculty do: the part that makes it contact rather than engagement. */
  facultyRole: string;
  /** What the platform logs as evidence the hour happened. */
  evidenceLogged: string;
  hours: number;
}

export interface IndependentActivity {
  id: string;
  activity: string;
  hours: number;
}

export interface CourseWeek {
  number: number;
  theme: string;
  outcomeIds: string[];
  liveLecture: {
    title: string;
    topics: string[];
    hours: number;
    runSheet: RunSheetSegment[];
  };
  monitoredStudy: MonitoredActivity[];
  independentStudy: IndependentActivity[];
  gradedItemsDue: string[];
}

export type AssessmentComponent =
  | 'applied_assignment'
  | 'weekly_quiz_discussion'
  | 'final_exam'
  | 'capstone_component';

export interface RubricCriterion {
  outcomeId: string;
  criterion: string;
  weight: number;
  excellent: string;
  good: string;
  belowStandard: string;
}

export interface Assessment {
  id: string;
  component: AssessmentComponent;
  title: string;
  weight: number;
  weekDue: number;
  outcomeIds: string[];
  proctored: boolean;
  /** What use of AI tools is and is not permitted. Required by the integrity policy. */
  aiUse: string;
  brief?: string;
  rubric?: RubricCriterion[];
}

export type AccessStatus = 'open' | 'original' | 'licensed' | 'unknown' | 'paywalled';

export interface Reading {
  id: string;
  citation: string;
  week: number;
  required: boolean;
  access: AccessStatus;
  link?: string;
  sourceId?: string;
}

export interface CaseStudy {
  id: string;
  title: string;
  week: number;
  source: 'original' | 'licensed' | 'open' | 'hypothetical';
  outcomeIds: string[];
  rights: string;
}

export interface CourseDraft {
  courseCode: string;
  catalogueVersion: string;
  /** Locked catalogue fields, copied in at creation so a later edit can be detected. */
  locked: {
    title: string;
    semesterCredits: number;
    hours: { total: number; contact: number; independent: number };
    description: string;
  };
  outcomes: CourseOutcome[];
  weeks: CourseWeek[];
  assessments: Assessment[];
  readings: Reading[];
  cases: CaseStudy[];
  /** Free text written into the package (descriptions, briefs, guides) that must not carry prohibited claims. */
  narrative: { field: string; text: string }[];
}

export type Severity = 'blocking' | 'warning';

export interface Finding {
  code: string;
  severity: Severity;
  message: string;
  /** The object the finding is about, e.g. "weeks[2].liveLecture". */
  path?: string;
  /** Rule or template the check comes from. */
  source?: string;
}

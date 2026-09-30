/**
 * The institutional record a module is built against.
 *
 * These are facts faculty may not change inside a module draft: codes, titles, credits,
 * hours, credential membership and gateways come from the approved catalogue, and a draft
 * that contradicts them fails validation. Each carries the section it came from so a
 * reviewer can check it against the source.
 */

export type ApprovalStatus = 'approved' | 'pending_confirmation' | 'superseded';

export interface SourcedFact<T> {
  value: T;
  /** Where the fact is stated, e.g. "Catalog v1.4 §4.2" or "AGU template T01". */
  source: string;
}

export type CourseRole =
  | 'foundation'
  | 'gateway'
  | 'analytics_spine'
  | 'entry'
  | 'concentration'
  | 'capstone';

export type Track = 'core' | 'fintech' | 'finance' | 'supply_chain_operations';

export interface CatalogueCourse {
  code: string;
  title: string;
  track: Track;
  /** Position inside the track or core table, 1-based. */
  sequence: number;
  role: CourseRole;
  roleLabel: string;
  semesterCredits: number;
  hours: { total: number; contact: number; independent: number };
  /** Verbatim catalogue description; empty where the catalogue gives none. */
  description: string;
  /** True when the catalogue gives only a role, with no topical scope. */
  descriptionMissing: boolean;
  /** Courses an MBA candidate must complete first. Applies to the MBA only. */
  mbaGateway?: string;
  deliveryWindow: string;
  catalogueFaculty: string;
  rplEligible: 'designated_only' | 'not_eligible';
  source: string;
}

export interface Credential {
  id: 'course_certificate' | 'specialized_diploma' | 'mba';
  name: string;
  composition: string;
  courses: number;
  semesterCredits: number;
  learningHours: number;
  source: string;
}

export interface CatalogueEdition {
  institution: {
    legalName: string;
    shortName: string;
    registration: SourcedFact<string>;
    accreditation: SourcedFact<string>;
  };
  edition: {
    version: string;
    published: string;
    effective: string;
    approvalStatus: ApprovalStatus;
    approvalNote: string;
  };
  credentials: Credential[];
  courses: CatalogueCourse[];
  /** Rules every course in this catalogue shares. */
  courseShape: {
    weeks: SourcedFact<number>;
    liveLecturesPerWeek: SourcedFact<number>;
    liveLectureHours: SourcedFact<number>;
    contactHours: SourcedFact<number>;
    independentHours: SourcedFact<number>;
    contactHourDefinition: SourcedFact<string>;
    outcomeCount: SourcedFact<{ min: number; max: number }>;
    assessment: SourcedFact<{ component: string; weight: number }[]>;
    capstoneAssessment: SourcedFact<string>;
  };
  policies: { id: string; statement: string; source: string }[];
}

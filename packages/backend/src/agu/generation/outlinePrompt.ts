/**
 * Builds the course-outline request and turns the model's answer into a CourseDraft.
 *
 * The model proposes; this module decides what is kept. Locked catalogue facts are copied from
 * the catalogue, never from the model. Readings may only be chosen from the list of verified
 * open-access sources the model was given; anything else it cites is dropped and reported,
 * because a model-written bibliography was 90% wrong the last time it was checked. Outcome and
 * source references are numbers in the request and ids in the draft, so a reference the model
 * invents cannot survive the mapping.
 *
 * Pure, no I/O, so it can be tested.
 */
import { CatalogueCourse, CatalogueEdition } from '../catalogue/types';
import { DISCLOSURES } from '../rules/usUtahRules';
import {
  Assessment,
  AssessmentComponent,
  BloomLevel,
  CaseStudy,
  CourseDraft,
  CourseWeek,
  Finding,
  Reading,
} from '../draft/types';

export interface FacultyInputs {
  emphasis?: string;
  learners?: string;
  tools?: string;
  context?: string;
  notes?: string;
}

/** A verified source offered to the model, by number. */
export interface OfferedSource {
  sourceId: string;
  citation: string;
  year?: number | null;
  openAccess: boolean;
  link?: string | null;
}

const BLOOM: BloomLevel[] = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'];
const COMPONENTS: AssessmentComponent[] = [
  'applied_assignment',
  'weekly_quiz_discussion',
  'final_exam',
  'capstone_component',
];

export function buildOutlinePrompt(
  course: CatalogueCourse,
  catalogue: CatalogueEdition,
  inputs: FacultyInputs,
  sources: OfferedSource[],
  guidance: string[] = []
): { system: string; user: string } {
  const shape = catalogue.courseShape;
  const scheme = shape.assessment.value.map((a) => `${a.component} ${a.weight}%`).join(', ');
  const capstone = course.role === 'capstone';

  const system = `You design graduate business courses for American Global University (AGU), a Utah-registered online institution. You write a faculty-review draft: a proposal that a named faculty member will accept, change or reject. You never state institutional facts beyond those given, never claim accreditation, state approval, credit transfer, licensure, placement or earnings, and never use UK frameworks (UK GDPR, Ofqual, RQF, FHEQ, UK levels). Frame regulation and examples for a US and international audience. Return ONLY valid JSON.`;

  const user = `COURSE (locked catalogue facts; do not change them)
Code: ${course.code}
Title: ${course.title}
Role: ${course.roleLabel}
Credits: ${course.semesterCredits} US semester credit hours
Planned hours: ${course.hours.total} (${course.hours.contact} contact, ${course.hours.independent} independent)
Catalogue description: ${course.description || '(none: this course has only a role in the catalogue; design its scope from its role and title and say so in the rationale)'}

COURSE SHAPE (fixed)
- ${shape.weeks.value} weeks; one ${shape.liveLectureHours.value}-hour live lecture per week (${shape.weeks.value * shape.liveLectureHours.value} live hours in total).
- The remaining ${shape.contactHours.value - shape.weeks.value * shape.liveLectureHours.value} contact hours are faculty-monitored study on the learning platform. ${shape.contactHourDefinition.value}
- ${shape.independentHours.value} independent-study hours across the four weeks.
- ${shape.outcomeCount.value.min}-${shape.outcomeCount.value.max} course learning outcomes, each one observable behaviour starting with a measurable verb, at graduate level.
- Assessment: ${capstone ? shape.capstoneAssessment.value : `${scheme}. The final exam is proctored.`} Every outcome must be taught in at least one week and assessed by at least one assessment. Every assessment states what use of AI tools is permitted.
- AGU has no library. Choose readings ONLY from the numbered sources below, by number. Do not cite anything else.

FACULTY INPUTS
Emphasis: ${inputs.emphasis || 'not given'}
Learners: ${inputs.learners || 'working professionals studying online'}
Tools: ${inputs.tools || 'not given'}
Context: ${inputs.context || 'not given'}
Notes: ${inputs.notes || 'none'}
${guidance.length ? `\nDESIGN GUIDANCE (from the knowledge base)\n${guidance.map((g) => `- ${g}`).join('\n')}\n` : ''}
VERIFIED OPEN-ACCESS SOURCES (choose readings from these numbers only)
${sources.length ? sources.map((s, i) => `${i + 1}. ${s.citation}`).join('\n') : '(none available: return an empty readings list and say so in the rationale)'}

RETURN JSON:
{
  "outcomes": [{"statement": "Evaluate ...", "bloomLevel": "remember|understand|apply|analyse|evaluate|create"}],
  "weeks": [{
    "number": 1,
    "theme": "...",
    "outcomeNumbers": [1, 2],
    "lecture": {
      "title": "...",
      "topics": ["named topic", "..."],
      "runSheet": [{"start": 0, "end": 15, "segment": "Opening / recap", "activity": "...", "materials": "..."}, {"start": 165, "end": 180, "segment": "Wrap-up & next steps", "activity": "..."}]
    },
    "monitoredStudy": [{"activity": "...", "facultyRole": "what faculty do", "evidenceLogged": "what the platform records", "hours": 8.25}],
    "independentStudy": [{"activity": "...", "hours": 22.5}],
    "gradedItemsDue": ["..."]
  }],
  "assessments": [{"component": "applied_assignment|weekly_quiz_discussion|final_exam|capstone_component", "title": "...", "weight": 40, "weekDue": 4, "outcomeNumbers": [1, 2], "aiUse": "what is and is not permitted", "brief": "..."}],
  "readings": [{"sourceNumber": 1, "week": 1, "required": true}],
  "cases": [{"title": "...", "week": 2, "outcomeNumbers": [2]}],
  "rationale": "how the design meets the course shape, and anything faculty must decide"
}
Run sheets cover minute 0 to 180 without gaps. Monitored hours add up to ${shape.contactHours.value - shape.weeks.value * shape.liveLectureHours.value} and independent hours to ${shape.independentHours.value}. Cases are invented teaching scenarios unless a source above describes them.`;

  return { system, user };
}

/** The topics the catalogue description names, as search phrases. */
export function topicsFromDescription(description: string): string[] {
  const covers = /Covers\s+([^.]+)\./i.exec(description || '')?.[1] || description || '';
  return covers
    .split(/,|;|\band\b/)
    .map((t) => t.replace(/^\s*(the|a|an)\s+/i, '').trim())
    .filter((t) => t.length > 3)
    .slice(0, 8);
}

const num = (v: unknown, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** Turn the model's JSON into a draft, keeping only what can be traced. */
export function draftFromOutline(
  raw: any,
  course: CatalogueCourse,
  catalogue: CatalogueEdition,
  sources: OfferedSource[]
): { draft: CourseDraft; findings: Finding[] } {
  const findings: Finding[] = [];
  const outcomes = list(raw?.outcomes)
    .map((o, i) => ({
      id: `CLO${i + 1}`,
      statement: text(o?.statement),
      bloomLevel: (BLOOM.includes(o?.bloomLevel) ? o.bloomLevel : 'apply') as BloomLevel,
      origin: 'proposal' as const,
    }))
    .filter((o) => o.statement);
  const outcomeId = (n: unknown) => {
    const i = num(n, -1) - 1;
    return i >= 0 && i < outcomes.length ? outcomes[i].id : null;
  };
  const outcomeIds = (v: unknown) =>
    list(v)
      .map(outcomeId)
      .filter((id): id is string => !!id);

  const weeks: CourseWeek[] = list(raw?.weeks).map((w, i) => ({
    number: num(w?.number, i + 1),
    theme: text(w?.theme),
    outcomeIds: outcomeIds(w?.outcomeNumbers),
    liveLecture: {
      title: text(w?.lecture?.title),
      topics: list(w?.lecture?.topics).map(text).filter(Boolean),
      hours: catalogue.courseShape.liveLectureHours.value,
      runSheet: list(w?.lecture?.runSheet).map((s) => ({
        startMinute: num(s?.start),
        endMinute: num(s?.end),
        segment: text(s?.segment),
        activity: text(s?.activity),
        materials: text(s?.materials) || undefined,
      })),
    },
    monitoredStudy: list(w?.monitoredStudy).map((m, k) => ({
      id: `w${i + 1}-m${k + 1}`,
      activity: text(m?.activity),
      facultyRole: text(m?.facultyRole),
      evidenceLogged: text(m?.evidenceLogged),
      hours: num(m?.hours),
    })),
    independentStudy: list(w?.independentStudy).map((m, k) => ({
      id: `w${i + 1}-i${k + 1}`,
      activity: text(m?.activity),
      hours: num(m?.hours),
    })),
    gradedItemsDue: list(w?.gradedItemsDue).map(text).filter(Boolean),
  }));

  const assessments: Assessment[] = list(raw?.assessments).map((a, i) => {
    const component = (
      COMPONENTS.includes(a?.component) ? a.component : 'applied_assignment'
    ) as AssessmentComponent;
    return {
      id: `A${i + 1}`,
      component,
      title: text(a?.title) || component.replace(/_/g, ' '),
      weight: num(a?.weight),
      weekDue: num(a?.weekDue, 4),
      outcomeIds: outcomeIds(a?.outcomeNumbers),
      proctored: component === 'final_exam',
      aiUse: text(a?.aiUse),
      brief: text(a?.brief) || undefined,
    };
  });

  const readings: Reading[] = [];
  list(raw?.readings).forEach((r, i) => {
    const index = num(r?.sourceNumber, -1) - 1;
    const source = sources[index];
    if (!source) {
      findings.push({
        code: 'READING_NOT_OFFERED',
        severity: 'warning',
        message: `A proposed reading (entry ${i + 1}) did not refer to one of the verified sources and was dropped.`,
      });
      return;
    }
    readings.push({
      id: `R${readings.length + 1}`,
      citation: source.citation,
      week: num(r?.week, 1),
      required: r?.required !== false,
      access: source.openAccess ? 'open' : 'unknown',
      link: source.link || undefined,
      sourceId: source.sourceId,
    });
  });

  const cases: CaseStudy[] = list(raw?.cases).map((c, i) => ({
    id: `C${i + 1}`,
    title: text(c?.title),
    week: num(c?.week, 1),
    // Invented unless proven otherwise: a generated case must never read as a real event.
    source: 'hypothetical',
    outcomeIds: outcomeIds(c?.outcomeNumbers),
    rights: 'Original hypothetical teaching case written for AGU',
  }));

  const rationale = text(raw?.rationale);
  const draft: CourseDraft = {
    courseCode: course.code,
    catalogueVersion: catalogue.edition.version,
    locked: {
      title: course.title,
      semesterCredits: course.semesterCredits,
      hours: { ...course.hours },
      description: course.description,
    },
    outcomes,
    weeks,
    assessments,
    readings,
    cases,
    narrative: [
      ...(rationale ? [{ field: 'rationale', text: rationale }] : []),
      ...assessments
        .filter((a) => a.brief)
        .map((a) => ({ field: `assessments.${a.id}.brief`, text: a.brief as string })),
      ...weeks.map((w) => ({
        field: `weeks.${w.number}.theme`,
        text: `${w.theme}. ${w.liveLecture.title}.`,
      })),
      { field: 'disclosure.registration', text: DISCLOSURES[0].text },
    ],
  };
  return { draft, findings };
}

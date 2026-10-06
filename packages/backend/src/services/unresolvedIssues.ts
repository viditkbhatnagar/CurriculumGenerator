/**
 * Everything the automated checks could not pass, gathered for the front of the curriculum
 * export.
 *
 * The 21 September review (5.11, acceptance criterion 12) found that the export "concealed
 * unresolved defects behind a polished structure": failures were scattered across step
 * tables, some steps had none, and a missing step left only a gap in the section numbering.
 * This lists, in one place:
 * - every check that failed;
 * - every check that could not be run;
 * - every step with no content;
 * - every AI proposal still awaiting institutional approval.
 *
 * Each check is recomputed from the stored content, the same way the screens compute it, so
 * the list cannot disagree with them. Pure, so it can be tested.
 */
import { repeatedTopics, step4ValidationReport } from './step4Validation';
import { scopeIssue } from './capabilityScope';
import { step5ValidationReport } from './step5Validation';
import { step6ReportOf } from './step6Validation';
import { step7ValidationOf } from './step7Validation';
import { step13Validation } from './step13Validation';
import { programmeLessonsHeld, validationFromStubs } from './step10Completion';
import { step11ValidationFromDecks, step12ValidationFromPacks } from './deliverableValidation';

export type IssueKind = 'fail' | 'not_checked' | 'missing' | 'proposal' | 'review';

export interface UnresolvedIssue {
  step: number;
  stepName: string;
  kind: IssueKind;
  issue: string;
}

export const STEP_NAMES: Record<number, string> = {
  1: 'Programme Foundation',
  2: 'Competency Framework',
  3: 'Programme Learning Outcomes',
  4: 'Course Framework & MLOs',
  5: 'Topic-Level Sources',
  6: 'Reading Lists',
  7: 'Assessments',
  8: 'Case Studies',
  9: 'Glossary',
  10: 'Lesson Plans',
  11: 'PowerPoint Decks',
  12: 'Assignment Packs',
  13: 'Summative Exam',
};

/** What each check means, in the words an academic reviewer would use. */
const CHECK_LABELS: Record<number, Record<string, string>> = {
  4: {
    hoursMatch: "Module hours add up to the programme's declared hours",
    contactHoursMatch: 'Contact hours add up to the declared contact hours',
    allPLOsCovered: 'Every programme outcome is taught by a module',
    progressionValid: 'Every prerequisite is a module that comes earlier',
    noCircularDeps: 'No module depends on itself through its prerequisites',
    minMLOsPerModule: 'Every module has at least two learning outcomes',
  },
  5: {
    allSourcesApproved: 'Every source is from an approved category',
    recencyCompliance: 'Sources are from the last five years, or are justified seminal works',
    minimumSourcesPerTopic: 'Every weekly topic has at least two sources',
    academicAppliedBalance: 'Sources mix academic and applied material',
    peerReviewRatio: 'At least 30% of sources are peer-reviewed',
    completeCitations: 'Every citation names its authors, year and title',
    apaAccuracy: 'Citations follow APA style',
    verifiedAccess: 'Every source can be opened',
    noPaywalled: 'No source is behind a paywall',
    everyMLOSupported: 'Every module outcome has a source',
    traceabilityComplete: 'Every source serves an outcome, and every outcome has a source',
    freeAccessRatio: 'At least 70% of sources are free to read',
  },
  6: {
    coreCountValid: 'Every module has 3 to 6 core readings',
    supplementaryCountValid: 'Every module has 4 to 8 supplementary readings',
    allCoreMapToMLO: 'Every module has core readings, each mapped to an outcome',
    allAGICompliant: 'Every reading cites a source that meets the source rules',
    academicAppliedMix: 'Every module has both academic and applied readings',
    readingTimeWithinBudget: "Reading time fits within each module's independent study hours",
    allAccessible: 'Every reading can be opened',
  },
  7: {
    allFormativesMapped: 'Every assessment states the outcome it assesses',
    allSummativesMapped: 'Every summative assessment is mapped to outcomes',
    weightsSum100: "Each module's assessment weightings add up to 100%",
    sufficientSampleQuestions: 'There are at least 20 sample questions',
    plosCovered: 'Every programme outcome is assessed',
    allModulesCovered: 'Every module has at least one assessment',
    bloomFloorMet: 'Every assessment reaches the Bloom level of its outcomes',
    formativeCountMet: 'Every module has the configured number of formative activities',
  },
  8: {
    hasCaseStudies: 'Case studies were generated',
    allModulesCovered: 'Every module that needs a case study has one',
    noUkLawOutsideUk: 'No UK law is cited for a programme outside the UK',
    allModulesHaveBothCases: 'Every module has both of its case studies',
    allMappedToModule: 'Every case study belongs to a module',
    allMappedToMLO: 'Every case study is mapped to an outcome',
    wordCountValid: 'Every case study is 400 to 800 words',
    ethicsCompliant: 'Every case study meets the ethics rules',
    hooksComplete: 'Every assessment-ready case has its assessment hooks',
    noAssessmentQuestions: 'Case studies do not carry assessment questions',
  },
  9: {
    hasTerms: 'Glossary terms were generated',
    allAssessmentTermsIncluded: 'Every term used in assessments is defined',
    definitionLengthValid: 'Every definition is 20 to 40 words',
    noCircularDefinitions: 'No term is defined by itself',
    allCrossReferencesValid: 'Every cross-reference points to a defined term',
    ukEnglishConsistent: 'Spelling is consistently UK English',
    allTermsMappedToModule: 'Every term belongs to a module',
    noDuplicateEntries: 'No term appears twice',
  },
  10: {
    allModulesHaveLessonPlans: 'Every module has its full set of lesson plans',
    allLessonDurationsValid: 'Every lesson has a valid duration',
    totalHoursMatch: "Lesson time adds up to each module's contact hours",
    allMLOsCovered: 'Every module outcome is taught in a lesson',
    caseStudiesIntegrated: 'Case studies are used in lessons',
    assessmentsIntegrated: 'Assessments are linked to lessons',
  },
  11: {
    allLessonsHavePPTs: 'Every lesson has a slide deck',
    allSlideCountsValid: 'Every deck has a valid number of slides',
    allMLOsCovered: 'Every module outcome appears in the slides',
    allCitationsValid: "Every slide citation is one of the programme's sources",
  },
  12: {
    allModulesHaveAssignments: 'Every module has an assignment pack',
    allVariantsGenerated: 'Every delivery variant of every pack was generated',
    allMLOsCovered: "Every module outcome is assessed by its module's pack",
    allRubricsComplete: 'Every rubric is complete',
  },
  13: {
    marksAddUp: 'The total, section marks and counts agree with the questions',
    allSectionsPresent: 'Every exam section is present',
    allPLOsCovered: 'Every programme outcome is examined',
    markingSchemeComplete: 'The marking scheme covers every question',
    modelAnswersComplete: 'Every question has a model answer',
  },
};

const fromWords = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

function fromReport(
  step: number,
  report: Record<string, unknown> | null | undefined
): UnresolvedIssue[] {
  if (!report) return [];
  const labels = CHECK_LABELS[step] || {};
  return Object.entries(report)
    .filter(([key, value]) => key in labels && (value === false || value === null))
    .map(([key, value]) => ({
      step,
      stepName: STEP_NAMES[step],
      kind: value === false ? ('fail' as const) : ('not_checked' as const),
      issue: labels[key] || fromWords(key),
    }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Workflowish = any;

export function unresolvedIssues(workflow: Workflowish, currentYear: number): UnresolvedIssue[] {
  const w = workflow || {};
  const modules = w.step4?.modules || [];
  const outcomes = w.step3?.outcomes || [];
  const issues: UnresolvedIssue[] = [];
  const add = (step: number, kind: IssueKind, issue: string) =>
    issues.push({ step, stepName: STEP_NAMES[step], kind, issue });

  for (let step = 1; step <= 13; step++) {
    if (!w[`step${step}`]) add(step, 'missing', 'This step has not been generated');
  }

  const scope = w.step1 ? scopeIssue(w.step1) : null;
  if (scope) add(1, scope.kind, scope.issue);
  if (w.step1?.entryRequirements && w.step1?.entryRequirementsOrigin !== 'institution') {
    add(
      1,
      'proposal',
      'Entry, language and RPL requirements were proposed by the AI and need institutional approval'
    );
  }
  if (w.step4) {
    issues.push(
      ...fromReport(
        4,
        step4ValidationReport({
          modules,
          ploIds: outcomes.map((o: Workflowish) => o.code || o.id),
          declaredHours: w.step1?.creditFramework?.totalHours || 0,
          declaredContactHours: w.step1?.creditFramework?.contactHours,
        }) as unknown as Record<string, unknown>
      )
    );
  }
  for (const { first, second } of repeatedTopics(modules)) {
    add(
      4,
      'review',
      `"${first.topic}" (${first.module}) and "${second.topic}" (${second.module}) look alike: confirm the second builds on the first rather than repeating it`
    );
  }
  if (w.step5) {
    issues.push(
      ...fromReport(
        5,
        step5ValidationReport(w.step5.sources || [], modules, currentYear) as unknown as Record<
          string,
          unknown
        >
      )
    );
  }
  issues.push(
    ...fromReport(
      6,
      step6ReportOf(w, currentYear)?.validationReport as unknown as Record<string, unknown>
    )
  );
  issues.push(...fromReport(7, step7ValidationOf(w) as unknown as Record<string, unknown> | null));
  // A programme recorded as needing no case studies is not short of them.
  if (w.step8 && !w.step8.notRequired) issues.push(...fromReport(8, w.step8.validationReport));
  if (w.step9) issues.push(...fromReport(9, w.step9.validationReport));
  if (w.step10) {
    issues.push(
      ...fromReport(
        10,
        validationFromStubs(modules, w.step10) as unknown as Record<string, unknown>
      )
    );
  }
  if (w.step11) {
    const decks = (w.step11.modulePPTDecks || []).flatMap((m: Workflowish) => m?.pptDecks || []);
    issues.push(
      ...fromReport(
        11,
        step11ValidationFromDecks(decks, programmeLessonsHeld(w.step10)) as unknown as Record<
          string,
          unknown
        >
      )
    );
  }
  if (w.step12) {
    issues.push(
      ...fromReport(
        12,
        step12ValidationFromPacks(
          w.step12.moduleAssignmentPacks || [],
          modules
        ) as unknown as Record<string, unknown>
      )
    );
  }
  if (w.step13?.sectionA) {
    issues.push(
      ...fromReport(13, step13Validation(w.step13, outcomes) as unknown as Record<string, unknown>)
    );
  }
  return issues;
}

/**
 * A complete CR08 course draft that passes every validator with no blocking finding. Shared by
 * the AGU suites so each one starts from the same known-good draft and breaks one thing.
 */
import { catalogueCourse } from '../../agu/catalogue/catalogueV1_4';
import { DISCLOSURES } from '../../agu/rules/usUtahRules';
import { CourseDraft } from '../../agu/draft/types';

const cr08 = catalogueCourse('CR08')!;

function week(n: number): CourseDraft['weeks'][number] {
  return {
    number: n,
    theme: `Week ${n} theme`,
    outcomeIds: [`CLO${n}`],
    liveLecture: {
      title: `Lecture ${n}`,
      topics: [`Topic ${n}`],
      hours: 3,
      runSheet: [
        { startMinute: 0, endMinute: 15, segment: 'Opening / recap', activity: 'Recap' },
        { startMinute: 15, endMinute: 165, segment: 'Core', activity: 'Teach' },
        { startMinute: 165, endMinute: 180, segment: 'Wrap-up & next steps', activity: 'Close' },
      ],
    },
    // 33 monitored hours over four weeks: 8.25 each.
    monitoredStudy: [
      {
        id: `m${n}`,
        activity: 'Guided lab',
        facultyRole: 'Reviews checkpoints',
        evidenceLogged: 'Checkpoint log',
        hours: 8.25,
      },
    ],
    independentStudy: [{ id: `i${n}`, activity: 'Reading and practice', hours: 22.5 }],
    gradedItemsDue: [],
  };
}

export function validDraft(): CourseDraft {
  return {
    courseCode: 'CR08',
    catalogueVersion: '1.4',
    locked: {
      title: cr08.title,
      semesterCredits: 3,
      hours: { ...cr08.hours },
      description: cr08.description,
    },
    outcomes: [1, 2, 3, 4].map((n) => ({
      id: `CLO${n}`,
      statement: `Evaluate business data problem ${n} with a suitable analytic method.`,
      bloomLevel: 'evaluate' as const,
      origin: 'proposal' as const,
    })),
    weeks: [1, 2, 3, 4].map(week),
    assessments: [
      {
        id: 'a1',
        component: 'applied_assignment',
        title: 'Applied analytics brief',
        weight: 40,
        weekDue: 4,
        outcomeIds: ['CLO1', 'CLO2'],
        proctored: false,
        aiUse: 'AI may be used to draft code; disclose prompts.',
      },
      {
        id: 'a2',
        component: 'weekly_quiz_discussion',
        title: 'Weekly quizzes',
        weight: 20,
        weekDue: 1,
        outcomeIds: ['CLO1', 'CLO2', 'CLO3', 'CLO4'],
        proctored: false,
        aiUse: 'No AI use during quizzes.',
      },
      {
        id: 'a3',
        component: 'final_exam',
        title: 'Final exam',
        weight: 40,
        weekDue: 4,
        outcomeIds: ['CLO3', 'CLO4'],
        proctored: true,
        aiUse: 'No AI use.',
      },
    ],
    readings: [1, 2, 3, 4].map((n) => ({
      id: `r${n}`,
      citation: `Open text chapter ${n}`,
      week: n,
      required: true,
      access: 'open' as const,
    })),
    cases: [
      {
        id: 'c1',
        title: 'Retail demand case',
        week: 2,
        source: 'hypothetical',
        outcomeIds: ['CLO2'],
        rights: '',
      },
    ],
    narrative: [{ field: 'syllabus.description', text: DISCLOSURES[0].text }],
  };
}

/**
 * A model answer in the shape the outline prompt asks for, and the verified sources it was
 * offered. Shared by the AGU suites that turn an answer into a draft.
 */
import { OfferedSource } from '../../agu/generation/outlinePrompt';

export const sources: OfferedSource[] = [1, 2, 3, 4, 5].map((n) => ({
  sourceId: `W${n}`,
  citation: `Author ${n} (2024). Open paper ${n}. Journal.`,
  openAccess: true,
  link: `https://example.org/${n}.pdf`,
}));

const week = (n: number) => ({
  number: n,
  theme: `Theme ${n}`,
  outcomeNumbers: [n],
  lecture: {
    title: `Lecture ${n}`,
    topics: [`Topic ${n}`],
    runSheet: [
      { start: 0, end: 15, segment: 'Opening / recap', activity: 'Recap' },
      { start: 15, end: 165, segment: 'Core', activity: 'Teach' },
      { start: 165, end: 180, segment: 'Wrap-up & next steps', activity: 'Close' },
    ],
  },
  monitoredStudy: [
    {
      activity: 'Guided lab',
      facultyRole: 'Reviews checkpoints',
      evidenceLogged: 'Checkpoint log',
      hours: 8.25,
    },
  ],
  independentStudy: [{ activity: 'Reading', hours: 22.5 }],
  gradedItemsDue: [],
});

export const modelAnswer = {
  title: 'A different title the model tried',
  outcomes: [1, 2, 3, 4].map((n) => ({
    statement: `Evaluate decision problem ${n} using descriptive analytics.`,
    bloomLevel: 'evaluate',
  })),
  weeks: [1, 2, 3, 4].map(week),
  assessments: [
    {
      component: 'applied_assignment',
      title: 'Brief',
      weight: 40,
      weekDue: 4,
      outcomeNumbers: [1, 2],
      aiUse: 'Disclose prompts.',
    },
    {
      component: 'weekly_quiz_discussion',
      title: 'Quizzes',
      weight: 20,
      weekDue: 1,
      outcomeNumbers: [1, 2, 3, 4, 9],
      aiUse: 'No AI.',
    },
    {
      component: 'final_exam',
      title: 'Final',
      weight: 40,
      weekDue: 4,
      outcomeNumbers: [3, 4],
      aiUse: 'No AI.',
    },
  ],
  readings: [
    { sourceNumber: 1, week: 1 },
    { sourceNumber: 2, week: 2 },
    { sourceNumber: 3, week: 3 },
    { sourceNumber: 4, week: 4 },
    { sourceNumber: 17, week: 2 },
  ],
  cases: [{ title: 'Retailer demand forecast', week: 2, outcomeNumbers: [2] }],
  rationale: 'Applied, no-code emphasis as requested.',
};

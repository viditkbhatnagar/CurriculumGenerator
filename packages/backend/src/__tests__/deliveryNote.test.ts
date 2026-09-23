/**
 * A module-level delivery note must reach the lecturer.
 *
 * The reviewer anchored the M14/M43 data-protection curriculum to the Malta/EU framework but
 * asked that faculty delivering in Dubai be told, in the lesson plan itself, to compare it with
 * the local instrument. That instruction is not part of the module's scope, so it is rendered
 * as its own labelled block rather than folded into the Module Description — and it is read
 * live from Step 4, so adding or amending it never requires regenerating a lesson.
 */

import { wordExportService } from '../services/wordExportService';

const NOTE =
  'Faculty should contextualise the European Union and Malta data-protection framework by ' +
  'referring to the current data-protection requirements of the country of delivery.';

function textOf(children: unknown[]): string {
  return JSON.stringify(children);
}

describe('faculty delivery note in the Step 10 export', () => {
  const step4 = {
    modules: [
      {
        id: 'mod-m43',
        code: 'M43',
        title: 'Digital Marketing Strategy',
        description: 'Plan and govern a digital marketing strategy.',
        deliveryNote: NOTE,
        contactHours: 45,
        mlos: [{ id: 'M43-LO4', statement: 'Evaluate data-protection controls.' }],
      },
    ],
  };

  const step10 = {
    moduleLessonPlans: [
      {
        moduleId: 'mod-m43',
        moduleCode: 'M43',
        moduleTitle: 'Digital Marketing Strategy',
        totalContactHours: 45,
        lessons: [
          {
            lessonId: 'M43-L1',
            lessonNumber: 1,
            lessonTitle: 'Consent and lawful basis',
            duration: 90,
            linkedMLOs: ['M43-LO4'],
            objectives: ['Identify a lawful basis'],
            activities: [],
            materials: { pptDeckRef: 'M43-L1-PPT', caseFiles: [], readingReferences: [] },
            instructorNotes: {},
            independentStudy: {},
          },
        ],
      },
    ],
  };

  it('renders the note as its own labelled block', () => {
    const children: unknown[] = [];
    (
      wordExportService as never as {
        generateStep10Section: (a: unknown, b: unknown[], c: unknown) => void;
      }
    ).generateStep10Section(step10, children, step4);

    const rendered = textOf(children);
    expect(rendered).toContain('Delivery Note (for faculty)');
    expect(rendered).toContain('country of delivery');
  });

  it('omits the block entirely when no note is set', () => {
    const noNote = { modules: [{ ...step4.modules[0], deliveryNote: undefined }] };
    const children: unknown[] = [];
    (
      wordExportService as never as {
        generateStep10Section: (a: unknown, b: unknown[], c: unknown) => void;
      }
    ).generateStep10Section(step10, children, noNote);

    expect(textOf(children)).not.toContain('Delivery Note');
  });
});

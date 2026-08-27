/**
 * Step 7 as the authoritative assessment design.
 *
 * The programme's reviewer ruled on the duplication between steps: "Step 7 becomes the
 * authoritative assessment design, Step 12 should convert the approved Step 7 summative into
 * the learner-facing Assignment Pack, and Step 13 should generate an exam only where Step 7
 * specifies an exam."
 *
 * Both decisions are made by pure predicates on stored data, so they are tested against the
 * shapes the live Bachelor in Business Administration actually holds — including the legacy
 * records that predate `purpose` and cannot be told apart.
 */

import { step7SpecifiesExam, approvedSummativeFor } from '../services/step7Authority';

const wf = (step7: any): any => ({ step7 });

describe('step7SpecifiesExam', () => {
  it('allows the exam when the format enum says so', () => {
    expect(step7SpecifiesExam(wf({ userPreferences: { summativeFormat: 'mixed_format' } }))).toBe(
      true
    );
    expect(step7SpecifiesExam(wf({ userPreferences: { summativeFormat: 'mcq_exam' } }))).toBe(true);
  });

  it('allows the exam when a designed component is one — the live BBA case', () => {
    // summativeFormat is 'mixed_format' and the components include a practical exam and a
    // cross-module objective test, so Step 13 must stay available for this programme.
    expect(
      step7SpecifiesExam(
        wf({
          userPreferences: { summativeFormat: 'project_based' },
          summativeAssessments: [
            {
              components: [
                { componentType: 'case_report', name: 'Section C: Integrated Consulting Case' },
                {
                  componentType: 'mcq_short_answer',
                  name: 'Section E: Cross-Module Objective Test',
                },
              ],
            },
          ],
        })
      )
    ).toBe(true);
  });

  it('refuses when nothing in the design mentions an exam', () => {
    expect(
      step7SpecifiesExam(
        wf({
          userPreferences: { summativeFormat: 'project_based' },
          summativeAssessments: [
            { components: [{ componentType: 'portfolio', name: 'Reflective portfolio' }] },
          ],
        })
      )
    ).toBe(false);
  });

  it('is not opened by a word that merely contains "exam" or "test"', () => {
    // Without word boundaries "example", "latest" and "greatest" all counted as an exam, so
    // the author's own prose could open the gate by accident.
    for (const prose of [
      'For example, a consulting brief',
      'the latest industry data',
      'their greatest challenge',
      'a contested market position',
    ]) {
      expect(
        step7SpecifiesExam(
          wf({
            userPreferences: {
              summativeFormat: 'project_based',
              userDefinedSummativeDescription: prose,
            },
          })
        )
      ).toBe(false);
    }
  });

  it('is opened by a description that genuinely names one', () => {
    expect(
      step7SpecifiesExam(
        wf({
          userPreferences: {
            summativeFormat: 'project_based',
            userDefinedSummativeDescription: 'A closed-book final exam of two hours.',
          },
        })
      )
    ).toBe(true);
  });

  it('refuses when Step 7 has no design at all', () => {
    expect(step7SpecifiesExam({} as any)).toBe(false);
  });
});

describe('approvedSummativeFor', () => {
  const module = {
    id: 'M1',
    mlos: [{ id: 'LO1' }, { id: 'LO2' }, { id: 'LO3' }, { id: 'LO4' }],
  };

  it('takes the record marked as the module summative', () => {
    const workflow = wf({
      formativeAssessments: [
        { moduleId: 'M1', purpose: 'formative', graded: false, title: 'activity' },
        { moduleId: 'M1', purpose: 'module_summative', graded: true, title: 'the summative' },
      ],
    });
    expect(approvedSummativeFor(workflow, module)?.title).toBe('the summative');
  });

  it('never returns an ungraded formative activity', () => {
    const workflow = wf({
      formativeAssessments: [{ moduleId: 'M1', purpose: 'formative', graded: false }],
    });
    expect(approvedSummativeFor(workflow, module)).toBeUndefined();
  });

  it('prefers the legacy record covering the whole outcome set', () => {
    const workflow = wf({
      formativeAssessments: [
        { moduleId: 'M1', maxMarks: 12, alignedMLOs: ['LO1', 'LO2'], title: 'half' },
        {
          moduleId: 'M1',
          maxMarks: 12,
          alignedMLOs: ['LO1', 'LO2', 'LO3', 'LO4'],
          title: 'whole',
        },
      ],
    });
    expect(approvedSummativeFor(workflow, module)?.title).toBe('whole');
  });

  it('falls back to the record carrying the most marks', () => {
    const workflow = wf({
      formativeAssessments: [
        { moduleId: 'M1', maxMarks: 10, alignedMLOs: ['LO1'], title: 'lesser' },
        { moduleId: 'M1', maxMarks: 40, alignedMLOs: ['LO2'], title: 'greater' },
      ],
    });
    expect(approvedSummativeFor(workflow, module)?.title).toBe('greater');
  });

  it('declines to choose when two legacy records are genuinely indistinguishable', () => {
    // This is mod-m03 on the live programme: two records, both 15 marks, each covering half
    // the outcomes. Anointing either as "the approved summative" would hand Step 12 half a
    // module's assessment to convert, which is worse than not converting at all.
    const workflow = wf({
      formativeAssessments: [
        { moduleId: 'M1', maxMarks: 15, alignedMLOs: ['LO1', 'LO2'] },
        { moduleId: 'M1', maxMarks: 15, alignedMLOs: ['LO3', 'LO4'] },
      ],
    });
    expect(approvedSummativeFor(workflow, module)).toBeUndefined();
  });

  it('returns nothing for a module Step 7 never assessed', () => {
    expect(approvedSummativeFor(wf({ formativeAssessments: [] }), module)).toBeUndefined();
  });
});

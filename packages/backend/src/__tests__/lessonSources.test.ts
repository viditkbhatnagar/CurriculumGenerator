/**
 * Logan's next steps, Phase 1 (16 October 2026): lessons were written from the model's memory,
 * because Step 10 passed "READING MATERIALS: N sources available" and two citations. The writer
 * is now given the lesson's readings, what to read in them and why, and told to teach from them.
 */
import { lessonSourcesBlock, lessonSourcesFor } from '../services/lessonSources';
import { LessonPlanService, MLO, ModuleData } from '../services/lessonPlanService';
import { ungroundedCount } from '../services/contentAuditRunner';

const readingLists = [
  {
    moduleId: 'mod-m02',
    coreReadings: [
      {
        sourceId: 'src-1',
        citation: 'Mankiw, N. G. (2024). Principles of Economics.',
        mloIds: ['M02-LO1'],
        specificChapters: 'Chapter 4: The market forces of supply and demand',
        focusAreas: ['shifts versus movements', 'equilibrium'],
        whyThisReading: 'The standard treatment of market equilibrium.',
      },
      { sourceId: 'src-2', citation: 'Unrelated (2023).', mloIds: ['M02-LO4'] },
    ],
    supplementaryReadings: [
      { sourceId: 'src-3', citation: 'OECD (2024). Inflation outlook.', mloIds: ['M02-LO1'] },
      { sourceId: 'src-1', citation: 'Mankiw again', mloIds: ['M02-LO1'] },
    ],
  },
];
const sources = [{ id: 'src-1', abstract: 'Supply and demand determine prices in markets.' }];

describe('lesson sources', () => {
  it("chooses the lesson's own readings, core first, each once, with the abstract", () => {
    const chosen = lessonSourcesFor(['M02-LO1'], readingLists, sources);
    expect(chosen.map((s) => s.sourceId)).toEqual(['src-1', 'src-3']);
    expect(chosen[0]).toMatchObject({
      sections: 'Chapter 4: The market forces of supply and demand',
      focus: ['shifts versus movements', 'equilibrium'],
      abstract: 'Supply and demand determine prices in markets.',
    });
  });

  it('tells the writer to teach from them, cite them, and mark what goes beyond them', () => {
    const block = lessonSourcesBlock(lessonSourcesFor(['M02-LO1'], readingLists, sources), [
      { source: 'Open Textbook, ch. 4', content: 'Equilibrium is where quantity supplied equals…' },
    ]);
    expect(block).toContain('[S1] Mankiw, N. G. (2024). Principles of Economics.');
    expect(block).toContain('What to read: Chapter 4');
    expect(block).toContain('[B1] From Open Textbook, ch. 4');
    expect(block).toMatch(/Do not cite any other source/);
    expect(block).toMatch(/Beyond the readings:/);
  });

  it('says plainly when no reading covers the lesson', () => {
    expect(lessonSourcesBlock([])).toMatch(/No programme reading covers this lesson/);
  });

  it('counts lessons written without any source', () => {
    expect(
      ungroundedCount({
        lessons: [
          { groundedIn: { sourceIds: ['src-1'], bookPassages: 0 } },
          { groundedIn: { sourceIds: [], bookPassages: 2 } },
          { groundedIn: { sourceIds: [], bookPassages: 0 } },
          {},
        ],
      })
    ).toBe(2);
  });
});

describe('the lesson writer', () => {
  it('is given the sources, and the lesson records them', async () => {
    const answer = {
      objectives: ['Explain equilibrium'],
      activities: [{ type: 'mini_lecture', title: 'Equilibrium [S1]', duration: 90 }],
      pedagogicalGuidance: 'Teach from [S1].',
      pacingSuggestions: '',
      adaptationOptions: [],
      commonMisconceptions: [],
      discussionPrompts: [],
    };
    const generateContent = jest.fn().mockResolvedValue(JSON.stringify(answer));
    const service = new LessonPlanService({ generateContent } as never);
    const mlos = [
      { id: 'M02-LO1', statement: 'Explain market equilibrium', bloomLevel: 'understand' } as MLO,
    ];
    const module = {
      id: 'mod-m02',
      moduleCode: 'M02',
      title: 'Business Economics',
      contactHours: 45,
      mlos,
    } as unknown as ModuleData;
    const lesson = await service.generateLessonContent(
      { lessonNumber: 1, duration: 90, bloomLevel: 'understand', assignedMLOs: mlos } as never,
      module,
      {
        deliveryMode: 'in_person',
        caseStudies: [],
        moduleReadingLists: readingLists,
        topicSources: sources,
        competencyItems: [],
        programLearningOutcomes: [],
        formativeAssessments: [],
        glossaryEntries: [],
      } as never
    );
    const prompt = String(generateContent.mock.calls[0][0]);
    expect(prompt).toContain('SOURCES FOR THIS LESSON (teach from these)');
    expect(prompt).toContain('[S1] Mankiw');
    expect(prompt).not.toMatch(/READING MATERIALS: \d+ sources available/);
    expect(lesson.groundedIn).toMatchObject({ sourceIds: ['src-1', 'src-3'], bookPassages: 0 });
  });
});

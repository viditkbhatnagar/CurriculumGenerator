import JSZip from 'jszip';
import mammoth from 'mammoth';
import {
  GuideContext,
  guideContextFromWorkflow,
  guideModule,
} from '../services/facultyGuide/facultyGuideModel';
import { facultyGuideBuffer } from '../services/facultyGuide/facultyGuideDocx';
import { loadModulePlan } from '../services/step10Store';
import { facultyGuideForModule, generateFacultyGuideZip } from '../services/stepZipExportService';

// The store reads lesson bodies from MongoDB, so the export is run against plans supplied here
// and the suite never opens a connection. The archive needs neither the Word exporter nor a log.
jest.mock('../services/step10Store', () => ({ loadModulePlan: jest.fn() }));
jest.mock('../services/wordExportService', () => ({ wordExportService: {} }));
jest.mock('../services/loggingService', () => ({
  loggingService: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const context: GuideContext = {
  mloStatements: new Map(),
  glossary: new Map(),
  caseTitles: new Map(),
};

const lessons = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    lessonNumber: i + 1,
    lessonTitle: `Lesson ${i + 1}`,
    duration: 90,
  }));

const textOf = async (buffer: Buffer): Promise<string> =>
  (await mammoth.extractRawText({ buffer })).value;

describe('the Word document for a partly generated module', () => {
  const module = { code: 'M01', title: 'Introduction to Management', contactHours: 45 };

  it('says it is incomplete in the title, a notice and the session requirement', async () => {
    const guide = guideModule(module, lessons(7), context, 30);

    const text = await textOf(await facultyGuideBuffer(guide));

    expect(text).toContain('Faculty Delivery Guide: M01 Introduction to Management (incomplete)');
    expect(text).toContain(
      'This guide is incomplete: 7 of 30 planned sessions are generated; the rest are not yet available.'
    );
    expect(text).toContain(
      'Teach the 7 sessions below. A further 23 planned sessions are not yet available.'
    );
  });

  it('does not claim to cover the contact hours or to teach "all" of the sessions', async () => {
    const guide = guideModule(module, lessons(7), context, 30);

    const text = await textOf(await facultyGuideBuffer(guide));

    expect(text).not.toContain('Teach all');
    expect(text).not.toContain('45 contact hours');
  });

  it('still states a complete module as complete', async () => {
    const guide = guideModule(module, lessons(30), context, 30);

    const text = await textOf(await facultyGuideBuffer(guide));

    expect(text).toContain('Faculty Delivery Guide: M01 Introduction to Management');
    expect(text).not.toContain('(incomplete)');
    expect(text).not.toContain('This guide is incomplete');
    expect(text).toContain('Teach all 30 sessions below, 45 contact hours.');
  });

  it('reads correctly for a single session', async () => {
    const guide = guideModule({ code: 'M02', title: 'Short' }, lessons(1), context);

    const text = await textOf(await facultyGuideBuffer(guide));

    expect(text).toContain('Teach all 1 session below.');
  });
});

// Six Step 4 modules, each in a different state.
const step4Modules = [
  { id: 'm1', code: 'M01', title: 'Management', contactHours: 3 }, // expects 2 lessons; holds 2
  { id: 'm2', code: 'M02', title: 'Marketing', contactHours: 45 }, // expects 30 lessons; holds 7
  { id: 'm3', code: 'M03', title: 'Finance', contactHours: 3 }, // no Step 10 entry at all
  { id: 'm4', code: 'M04', title: 'Operations', contactHours: 3 }, // entry, but no stored lessons
  { id: 'm5', code: 'M05', title: 'Strategy', contactHours: 3 }, // entry, but loading it fails
  { id: 'm6', code: 'M06', title: 'Placement', contactHours: 0 }, // nothing to teach, no plan
];

const stub = (id: string) => {
  const m = step4Modules.find((x) => x.id === id) as (typeof step4Modules)[number];
  return { moduleId: id, moduleCode: m.code, moduleTitle: m.title };
};

const workflowWith = (stubIds: string[], step10: object = {}): any => ({
  projectName: 'BBA',
  step1: { programTitle: 'Bachelor in Business Administration' },
  step4: { modules: step4Modules },
  step10: { ...step10, moduleLessonPlans: stubIds.map(stub) },
});

function storePlans(plans: Record<string, object | null>) {
  (loadModulePlan as jest.Mock).mockImplementation(async (_workflowId: string, id: string) => {
    if (id === 'm5') throw new Error('store unavailable');
    return plans[id] ?? null;
  });
}

describe('facultyGuideForModule', () => {
  beforeEach(() => jest.resetAllMocks());

  it('names a module that holds all its lessons plainly', async () => {
    storePlans({ m1: { moduleId: 'm1', lessons: lessons(2) } });

    const doc = await facultyGuideForModule('wf', workflowWith(['m1']), stub('m1'));

    expect(doc?.name).toBe('Faculty-Guide-M01-Management.docx');
    expect(await textOf(doc!.buffer)).toContain('Teach all 2 sessions below, 3 contact hours.');
  });

  it('marks a module holding 7 of its 30 lessons as incomplete, in its file name and title', async () => {
    storePlans({ m2: { moduleId: 'm2', lessons: lessons(7) } });

    const doc = await facultyGuideForModule('wf', workflowWith(['m2']), stub('m2'));

    expect(doc?.name).toBe('Faculty-Guide-M02-Marketing-INCOMPLETE.docx');
    const text = await textOf(doc!.buffer);
    expect(text).toContain(
      'This guide is incomplete: 7 of 30 planned sessions are generated; the rest are not yet available.'
    );
    expect(text).not.toContain('Teach all');
  });

  it('treats an agreed lesson count as the target, as the rest of Step 10 does', async () => {
    storePlans({ m2: { moduleId: 'm2', lessons: lessons(7) } });
    const workflow = workflowWith(['m2'], { plannedLessonCounts: { m2: 7 } });

    const doc = await facultyGuideForModule('wf', workflow, stub('m2'));

    expect(doc?.name).toBe('Faculty-Guide-M02-Marketing.docx');
  });

  it('prefers the count recorded on the plan, and reports that same count', async () => {
    storePlans({ m2: { moduleId: 'm2', plannedLessonCount: 40, lessons: lessons(30) } });

    const doc = await facultyGuideForModule('wf', workflowWith(['m2']), stub('m2'));

    expect(doc?.name).toBe('Faculty-Guide-M02-Marketing-INCOMPLETE.docx');
    expect(await textOf(doc!.buffer)).toContain('30 of 40 planned sessions are generated');
  });

  it('returns nothing for a module with no stored lessons', async () => {
    storePlans({ m4: { moduleId: 'm4', lessons: [] } });

    expect(await facultyGuideForModule('wf', workflowWith(['m4']), stub('m4'))).toBeNull();
    expect(await facultyGuideForModule('wf', workflowWith(['m3']), stub('m3'))).toBeNull();
  });
});

describe('generateFacultyGuideZip', () => {
  beforeEach(() => jest.resetAllMocks());

  async function build(workflow: any) {
    const zip = await JSZip.loadAsync(await generateFacultyGuideZip('wf', workflow));
    const read = (name: string) => zip.file(name)!.async('string');
    return { names: Object.keys(zip.files).sort(), read };
  }

  const plans = {
    m1: { moduleId: 'm1', lessons: lessons(2) },
    m2: { moduleId: 'm2', lessons: lessons(7) },
  };

  it('holds a guide for each module with lessons, marking the partly generated one', async () => {
    storePlans(plans);

    const { names } = await build(workflowWith(['m1', 'm2', 'm4', 'm5']));

    expect(names).toEqual([
      'Faculty-Guide-M01-Management.docx',
      'Faculty-Guide-M02-Marketing-INCOMPLETE.docx',
      'MISSING-MODULES.txt',
    ]);
  });

  it('names every module that has no lesson plan, whether Step 10 lists it or not', async () => {
    storePlans(plans);

    const { read } = await build(workflowWith(['m1', 'm2', 'm4', 'm5']));
    const note = await read('MISSING-MODULES.txt');

    const noPlan = note.slice(0, note.indexOf('could not be built'));
    expect(noPlan).toContain('M03 Finance');
    expect(noPlan).toContain('M04 Operations');
    expect(note).toContain('M05 Strategy');
    expect(noPlan).not.toContain('M05 Strategy');
  });

  it('leaves out of the note a module with a guide and one with nothing to teach', async () => {
    storePlans(plans);

    const { read } = await build(workflowWith(['m1', 'm2', 'm4', 'm5']));
    const note = await read('MISSING-MODULES.txt');

    expect(note).not.toContain('M01');
    expect(note).not.toContain('M02');
    expect(note).not.toContain('M06');
  });

  it('writes no note when every module that has something to teach has a guide', async () => {
    storePlans({ ...plans, m3: { moduleId: 'm3', lessons: lessons(2) } });
    const workflow = workflowWith(['m1', 'm3'], { plannedLessonCounts: {} });
    workflow.step4.modules = step4Modules.filter((m) => ['m1', 'm3', 'm6'].includes(m.id));

    const { names } = await build(workflow);

    expect(names).toEqual(['Faculty-Guide-M01-Management.docx', 'Faculty-Guide-M03-Finance.docx']);
  });

  it('still refuses to build from a workflow Step 10 has produced nothing for', async () => {
    await expect(generateFacultyGuideZip('wf', workflowWith([]))).rejects.toThrow(
      'Step 10 has no module lesson plans'
    );
  });
});

describe('the formative checks appendix', () => {
  // A lesson's check stores only a Step 7 assessment's title and id; the task itself, with its
  // questions and model answers, is in Step 7. The guide sets each task out once and points to it.
  const workflow = {
    step7: {
      formativeAssessments: [
        {
          id: 'form-1',
          title: 'Manager-in-Action Worksheet',
          assessmentType: 'Worksheets / problem sets',
          description: 'Apply team models to short cases.',
          instructions: 'Setting: a junior manager.\nTime: 60 minutes.',
          questions: [
            {
              questionNumber: 1,
              questionText: 'Identify the Tuckman stage.\n- Heated debates\n- Unclear roles',
              questionType: 'scenario',
              correctAnswer: 'Storming: visible conflict and unclear ownership.',
              rationale: 'Conflict over priorities marks storming.',
            },
          ],
          assessmentCriteria: ['Applies Tuckman to case details.'],
          feedbackGuidance: 'Surfaces confusion between stages.',
          selfCheckCriteria: ['Did I cite evidence from the case?'],
        },
      ],
    },
  };
  const withCheck = (n: number) =>
    lessons(n).map((l) => ({
      ...l,
      formativeChecks: [
        { checkId: 'form-1', type: 'mcq', question: 'Manager-in-Action Worksheet', duration: 3 },
      ],
    }));
  const guideFor = (n: number) =>
    guideModule(
      { code: 'M01', title: 'Management' },
      withCheck(n),
      guideContextFromWorkflow(workflow, { mlos: [] })
    );

  it('numbers a check once, however many sessions use it', () => {
    const guide = guideFor(3);
    expect(guide.formatives.map((f) => f.ref)).toEqual(['F1']);
    expect(guide.sessions.map((s) => s.checks[0].ref)).toEqual(['F1', 'F1', 'F1']);
  });

  it('prints the task with its questions and model answers, and points sessions to it', async () => {
    const text = await textOf(await facultyGuideBuffer(guideFor(2)));
    expect(text).toContain('Appendix: Formative Checks Used in This Module');
    expect(text).toContain('F1. Manager-in-Action Worksheet');
    expect(text).toContain('Storming: visible conflict and unclear ownership.');
    expect(text).toContain('Did I cite evidence from the case?');
    expect(text).toContain('Appendix, F1');
  });

  it('leaves the appendix out when no check names a Step 7 task', async () => {
    const guide = guideModule({ code: 'M01', title: 'Management' }, lessons(2), context);
    expect(guide.formatives).toEqual([]);
    expect(await textOf(await facultyGuideBuffer(guide))).not.toContain('Appendix:');
  });
});

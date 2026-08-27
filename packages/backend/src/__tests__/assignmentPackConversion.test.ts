/**
 * Step 12 converts the approved Step 7 summative rather than inventing a second one.
 *
 * The programme's reviewer, on finding a graded assignment in Step 12 alongside a graded
 * assessment in Step 7 for the same module: "Step 7 becomes the authoritative assessment
 * design, Step 12 should convert the approved Step 7 summative into the learner-facing
 * Assignment Pack."
 *
 * The prompt is what carries that instruction, so it is asserted directly. An earlier
 * version of this change was wired into a method with no callers and would have passed any
 * test that only checked the lookup.
 */

// Both are only needed at generation time; importing them for a prompt-shape test pulls in
// the OpenAI client and the logger's transports, which hang the suite.
jest.mock('../services/openaiService', () => ({ openaiService: { generateContent: jest.fn() } }));
jest.mock('../services/loggingService', () => ({
  loggingService: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { AssignmentPackService } from '../services/assignmentPackService';

const svc = new AssignmentPackService() as any;

const context = {
  programTitle: 'Bachelor in Business Administration',
  programDescription: '',
  academicLevel: 'bachelor',
  deliveryMode: 'online',
  creditFramework: { credits: 180 },
  targetLearner: 'General',
  plos: [{ id: 'PLO1', statement: 'Analyse business problems', bloomLevel: 'analyse' }],
  assessmentStrategy: {},
  caseStudies: [],
  glossaryEntries: [],
};

const moduleBase = {
  moduleId: 'mod-m31',
  moduleCode: 'M31',
  moduleTitle: 'Business Intelligence & Data Visualisation',
  mlos: [
    {
      id: 'M31-LO1',
      statement: 'Create interactive KPI dashboards',
      bloomLevel: 'create',
      linkedPLOs: ['PLO1'],
    },
    {
      id: 'M31-LO2',
      statement: 'Analyse data quality issues',
      bloomLevel: 'analyse',
      linkedPLOs: ['PLO1'],
    },
  ],
  totalHours: 150,
  contactHours: 45,
  independentHours: 105,
};

const approvedSummative = {
  title: 'Executive KPI Room: Build and Review',
  assessmentType: 'Practice simulations',
  description: 'Build an executive-ready KPI dashboard and critique a flawed one.',
  maxMarks: 12,
  alignedMLOs: ['M31-LO1', 'M31-LO2'],
  studentBrief: { task: 'Build and submit an interactive KPI dashboard.' },
  markingGuide: { totalMarks: 12 },
  rubric: [{ criterion: 'Dashboard accuracy', maxMarks: 6 }],
};

describe('buildAssignmentPrompt with an approved Step 7 summative', () => {
  const prompt: string = svc.buildAssignmentPrompt(
    { ...moduleBase, approvedSummative },
    context,
    'in_person'
  );

  it('tells the model to convert the approved assessment, not invent one', () => {
    expect(prompt).toContain('convert THIS, do not invent a new one');
    expect(prompt).toContain('Executive KPI Room: Build and Review');
  });

  it('carries the approved marking apparatus into the prompt', () => {
    expect(prompt).toContain('Build and submit an interactive KPI dashboard.');
    expect(prompt).toContain('Dashboard accuracy');
  });

  it('binds the assessed outcomes to the approved ones', () => {
    // Left unbound, the model picked its own subset and the pack assessed something the
    // approved design did not.
    expect(prompt).toContain('M31-LO1, M31-LO2');
    expect(prompt).toMatch(/assessedOutcomes.*MUST be exactly these outcome ids/s);
  });

  it('fixes the weighting instead of letting the model invent a percentage', () => {
    // The module summative is the module's sole graded assessment, so it carries the whole
    // module grade; the schema invites a free-choice percentage that would contradict that.
    expect(prompt).toMatch(/weighting.*MUST be 100/s);
  });

  it('forbids re-weighting or dropping a rubric criterion', () => {
    expect(prompt).toMatch(/may not add, drop or\s+re-weight a criterion/s);
  });

  it('still adapts to the delivery variant', () => {
    const selfStudy: string = svc.buildAssignmentPrompt(
      { ...moduleBase, approvedSummative },
      context,
      'self_study'
    );
    expect(selfStudy).toContain('Self-Study');
    expect(selfStudy).toContain('convert THIS, do not invent a new one');
  });
});

describe('buildAssignmentPrompt without an approved summative', () => {
  it('omits the conversion block entirely rather than referring to nothing', () => {
    // Modules Step 7 never assessed, and legacy modules whose two records cannot be told
    // apart, generate as they did before.
    const prompt: string = svc.buildAssignmentPrompt(moduleBase, context, 'hybrid');
    expect(prompt).not.toContain('convert THIS, do not invent a new one');
    expect(prompt).not.toContain('MUST be exactly these outcome ids');
    expect(prompt).toContain('Business Intelligence & Data Visualisation');
  });
});

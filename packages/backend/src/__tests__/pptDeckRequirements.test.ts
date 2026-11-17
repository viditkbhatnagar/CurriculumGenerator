/**
 * Logan Pacey, 17 November 2026, Diploma in Logistics pilot (workflow 6af5a0a3b706bd9a5b7af54a):
 * one slide-count rule, outcome coverage computed in code, and case and formative slides in
 * every deck that should have them. The model is mocked; nothing is called.
 */
import JSZip from 'jszip';
import { openaiService } from '../services/openaiService';
import { pptGenerationService } from '../services/pptGenerationService';

const lesson: any = {
  lessonId: 'L1',
  lessonNumber: 1,
  lessonTitle: 'Routing under disruption',
  duration: 90,
  linkedMLOs: ['M3-LO2', 'M3-LO3'],
  objectives: ['Route deliveries'],
  activities: [],
  materials: { pptDeckRef: '', caseFiles: [], readingReferences: [] },
  independentStudy: { coreReadings: [], supplementaryReadings: [], estimatedEffort: 0 },
  caseStudyActivity: {
    caseStudyId: 'cs1',
    caseTitle: 'Port Delay',
    linkedMLOs: ['M3-LO2'],
    assessmentHooks: { keyFacts: [], misconceptions: [], decisionPoints: ['Reroute or wait?'] },
  },
  formativeChecks: [
    {
      checkId: 'a',
      type: 'mcq',
      question: 'Which route is shortest?',
      options: ['North', 'South'],
      correctAnswer: 'B',
      linkedMLO: 'M3-LO3',
      duration: 2,
    },
  ],
};
const context: any = {
  programTitle: 'Diploma in Logistics',
  moduleCode: 'M03',
  moduleTitle: 'Transport',
  deliveryMode: 'in_person',
  glossaryEntries: [],
  sources: [],
  mloStatements: {
    'M3-LO2': 'Evaluate warehouse layout strategies',
    'M3-LO3': 'Apply transport routing algorithms',
  },
  caseStudies: [{ id: 'cs1', title: 'Port Delay', scenario: 'A ship is late. The port is full.' }],
};

const raw = (n: number, mlos: string[] = []) => ({
  slides: Array.from({ length: n }, (_, i) => ({
    type: i === 0 ? 'title' : 'bullets',
    title: i === n - 1 ? 'Summary: key takeaways' : `Slide ${i}`,
    content: ['A point'],
    notes: 'n',
    ...(i > 0 && i <= mlos.length ? { mlos: [mlos[i - 1]] } : {}),
  })),
});

const wider = { ...lesson, linkedMLOs: [...lesson.linkedMLOs, 'M3-LO4'] };

afterEach(() => jest.restoreAllMocks());

describe('slides written for a lesson', () => {
  it('are asked for in one range, with the outcomes to tag', async () => {
    const llm = jest
      .spyOn(openaiService, 'generateContent')
      .mockResolvedValue(JSON.stringify(raw(14, ['M3-LO2', 'M3-LO3'])));
    await pptGenerationService.generateLessonPPT(lesson, context);
    const prompt = String(llm.mock.calls[0][0]);
    expect(prompt).toMatch(/of 11-17 slides/);
    expect(prompt).not.toMatch(/12-18/);
    expect(prompt).toMatch(/M3-LO2: Evaluate warehouse layout strategies/);
    expect(prompt).toMatch(/"mlos"/);
  });

  it('keep valid outcome tags, drop invented ones, and gain case and formative slides', async () => {
    jest
      .spyOn(openaiService, 'generateContent')
      .mockResolvedValue(JSON.stringify(raw(14, ['m3-lo2', 'M3-LO3', 'M7-LO7'])));
    const deck: any = await pptGenerationService.generateLessonPPT(lesson, context);
    const types = deck.slides.map((s: any) => s.slideType);
    expect(types.filter((t: string) => t === 'case_study')).toHaveLength(2);
    expect(types.filter((t: string) => t === 'formative_check')).toHaveLength(1);
    expect(deck.slides[deck.slides.length - 1].title).toMatch(/Summary/);
    expect(JSON.stringify(deck.slides)).not.toMatch(/M7-LO7/);
    expect(deck.slideCount).toBe(17);
    expect(deck.validation).toMatchObject({
      slideCountValid: true,
      mlosCovered: true,
      hasFormativeSlide: true,
      hasCaseSlide: true,
    });
    expect(deck.mloCoverage).toMatchObject({ checked: true, missing: [] });
  });

  it('are asked for once more, with the problem stated, when an outcome is untaught', async () => {
    const llm = jest
      .spyOn(openaiService, 'generateContent')
      .mockResolvedValueOnce(JSON.stringify(raw(13, [])))
      .mockResolvedValueOnce(JSON.stringify(raw(13, ['M3-LO4'])));
    const deck: any = await pptGenerationService.generateLessonPPT(wider, context);
    expect(llm).toHaveBeenCalledTimes(2);
    expect(String(llm.mock.calls[1][0])).toMatch(/CORRECTIONS TO YOUR PREVIOUS ATTEMPT/);
    expect(String(llm.mock.calls[1][0])).toMatch(/M3-LO4/);
    expect(deck.validation.mlosCovered).toBe(true);
  });

  it('are asked for only once more, and the better answer is kept', async () => {
    const llm = jest
      .spyOn(openaiService, 'generateContent')
      .mockResolvedValue(JSON.stringify(raw(13, [])));
    const deck: any = await pptGenerationService.generateLessonPPT(wider, context);
    expect(llm).toHaveBeenCalledTimes(2);
    expect(deck.validation.mlosCovered).toBe(false);
  });

  it('are not asked for again when the deck is sound', async () => {
    const llm = jest
      .spyOn(openaiService, 'generateContent')
      .mockResolvedValue(JSON.stringify(raw(14, ['M3-LO2', 'M3-LO3'])));
    await pptGenerationService.generateLessonPPT(lesson, context);
    expect(llm).toHaveBeenCalledTimes(1);
  });
});

describe('PPTX export of the added slides', () => {
  it('draws the case and formative slides with their text', async () => {
    jest
      .spyOn(openaiService, 'generateContent')
      .mockResolvedValue(JSON.stringify(raw(14, ['M3-LO2', 'M3-LO3'])));
    const deck: any = await pptGenerationService.generateLessonPPT(lesson, context);
    const zip = await JSZip.loadAsync(await pptGenerationService.exportPPTX(deck));
    const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    const text = (await Promise.all(names.map((n) => zip.file(n)!.async('string'))))
      .join(' ')
      .replace(/<[^>]+>/g, ' ');
    expect(text).toMatch(/Case: Port Delay/);
    expect(text).toMatch(/Reroute or wait\?/);
    expect(text).toMatch(/Which route is shortest\?/);
    expect(text).toMatch(/B\. South/);
  });
});

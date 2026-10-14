/**
 * Dr Sherin, 14 October 2026: decks cut off mid-lesson, blank two-column slides, "CIPD PESTLE",
 * and slides too brief to teach from.
 */
import JSZip from 'jszip';
import {
  deckComplete,
  deckProblems,
  replacesDeck,
  storedDeckFor,
  withoutCIPD,
} from '../services/pptLessonContent';
import { openaiService } from '../services/openaiService';
import { pptGenerationService } from '../services/pptGenerationService';

const slide = (type: string, title: string, extra: Record<string, unknown> = {}) => ({
  slideNumber: 1,
  slideType: 'content',
  title,
  content: { type, title, ...extra },
  speakerNotes: '',
});

const deckOf = (slides: any[]) => ({
  deckId: 'L1-PPT',
  lessonId: 'L1',
  moduleCode: 'M02',
  lessonNumber: 1,
  lessonTitle: 'Inflation',
  slides: slides.map((s, i) => ({ ...s, slideNumber: i + 1 })),
  slideCount: slides.length,
  deliveryMode: 'in_person',
  generatedAt: new Date(),
  validation: {
    slideCountValid: true,
    mlosCovered: true,
    citationsValid: true,
    glossaryTermsDefined: true,
  },
});

async function slideTexts(deck: any): Promise<string> {
  const zip = await JSZip.loadAsync(await pptGenerationService.exportPPTX(deck));
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const xml = await Promise.all(names.map((n) => zip.file(n)!.async('string')));
  return xml.join(' ').replace(/<[^>]+>/g, ' ');
}

describe('deck completeness and problems', () => {
  const body = Array.from({ length: 10 }, (_, i) =>
    slide('bullets', `Point ${i}`, { content: ['x'] })
  );

  it('is complete only with enough slides and a closing summary', () => {
    expect(deckComplete([...body, slide('bullets', 'Summary: key takeaways')])).toBe(true);
    expect(deckComplete([...body, slide('table', 'Worked example: 4-period forecast')])).toBe(
      false
    );
    expect(deckComplete(body.slice(0, 6).concat(slide('bullets', 'Summary')))).toBe(false);
  });

  it('names what is wrong with a stored deck', () => {
    const cipd = deckOf([
      ...body,
      slide('bullets', 'Apply CIPD PESTLE'),
      slide('bullets', 'Summary'),
    ]);
    expect(deckProblems(cipd)).toEqual(['names CIPD']);
    expect(deckProblems(deckOf(body.slice(0, 7)))).toContain('incomplete');
    expect(deckProblems({ ...deckOf(body), generatedBy: 'outline' })).toContain('outline');
  });

  it('replaces a stored deck only with an AI deck that is better and no worse', () => {
    const sound = { ...deckOf([...body, slide('bullets', 'Summary')]), generatedBy: 'ai' };
    const cipd = deckOf([...body, slide('bullets', 'CIPD PESTLE'), slide('bullets', 'Summary')]);
    const cutOff = { ...deckOf(body.slice(0, 7)), generatedBy: 'ai' };
    expect(replacesDeck(cipd, sound)).toBe(true);
    expect(replacesDeck(cipd, { ...sound, generatedBy: 'outline' })).toBe(false);
    expect(replacesDeck(cipd, cutOff)).toBe(false);
    expect(replacesDeck(sound, sound)).toBe(true);
    expect(replacesDeck(sound, cutOff)).toBe(false);
  });

  it('never serves an outline as teaching slides', () => {
    const outline = {
      ...deckOf([slide('bullets', 'x', { content: ['y'] })]),
      generatedBy: 'outline',
    };
    expect(storedDeckFor({ lessonId: 'L1', lessonTitle: 'Inflation' }, [outline])).toBeUndefined();
  });
});

describe('rendering', () => {
  it('draws both columns of a two-column slide that has no headings', async () => {
    const text = await slideTexts(
      deckOf([
        slide('two_column', 'Demand-pull vs cost-push', {
          leftColumn: ['Demand shifts right'],
          rightColumn: ['Supply shifts left'],
        }),
      ])
    );
    expect(text).toContain('Demand shifts right');
    expect(text).toContain('Supply shifts left');
    expect(text).not.toContain('Contact Activities');
  });

  it('draws concept, process and matrix slides', async () => {
    const text = await slideTexts(
      deckOf([
        slide('concept', 'Inflation', {
          definition: 'A sustained rise in prices.',
          explanation: 'It erodes purchasing power.',
          example: 'A retailer reprices weekly.',
        }),
        slide('process', 'PESTLE scan', {
          steps: [
            { title: 'Scan' },
            { title: 'Rate', text: 'Impact x likelihood' },
            { title: 'Act' },
          ],
        }),
        slide('matrix', 'Risk matrix', {
          quadrants: [
            { title: 'Monitor' },
            { title: 'Act now' },
            { title: 'Ignore' },
            { title: 'Plan' },
          ],
          xAxis: 'Likelihood',
          yAxis: 'Impact',
        }),
      ])
    );
    for (const t of [
      'Definition',
      'A sustained rise in prices.',
      'Business example',
      'Impact x likelihood',
      'Act now',
      'Likelihood',
    ]) {
      expect(text).toContain(t);
    }
  });

  it('shows concept, process and matrix content in the PDF preview, escaped', () => {
    const html = (s: any) =>
      (pptGenerationService as any).generateHTMLForSlide({ ...s, slideNumber: 1 });
    expect(
      html(slide('concept', 'Risk <appetite>', { definition: 'How much risk', example: 'A bank' }))
    ).toMatch(/&lt;appetite&gt;[\s\S]*Definition:[\s\S]*How much risk[\s\S]*Business example:/);
    expect(
      html(
        slide('process', 'Scan', { steps: [{ title: 'Scan', text: 'PESTLE' }], content: 'Weekly' })
      )
    ).toMatch(/<ol><li><strong>Scan<\/strong>: PESTLE<\/li><\/ol><p>Weekly<\/p>/);
    expect(
      html(
        slide('matrix', 'Grid', {
          quadrants: [{ title: 'Act now' }],
          xAxis: 'Likelihood',
          yAxis: 'Impact',
        })
      )
    ).toContain('Impact × Likelihood');
  });

  it('keeps explanatory bullets and the new fields when post-processing', () => {
    const long = 'A'.repeat(180);
    const [s] = (pptGenerationService as any).postProcessSlides(
      [
        {
          type: 'concept',
          title: 'Elasticity',
          definition: 'd',
          explanation: 'e',
          example: 'x',
          notes: '',
        },
        { type: 'bullets', title: 'b', content: [long] },
      ],
      {},
      {}
    );
    expect(s.content).toMatchObject({ type: 'concept', definition: 'd', example: 'x' });
    const [, b] = (pptGenerationService as any).postProcessSlides(
      [
        { type: 'title', title: 't' },
        { type: 'bullets', title: 'b', content: [long] },
      ],
      {},
      {}
    );
    expect(b.content.content[0]).toBe(long);
  });
});

describe('asking again for a cut-off deck', () => {
  const lesson: any = {
    lessonId: 'L23',
    lessonNumber: 23,
    lessonTitle: 'Inflation',
    duration: 90,
    linkedMLOs: [],
    objectives: ['Explain inflation'],
    activities: [],
    materials: { pptDeckRef: '', caseFiles: [], readingReferences: [] },
    instructorNotes: {
      pedagogicalGuidance: '',
      adaptationOptions: [],
      commonMisconceptions: [],
      discussionPrompts: [],
    },
    independentStudy: { coreReadings: [], supplementaryReadings: [], estimatedEffort: 0 },
  };
  const context: any = {
    programTitle: 'BBA',
    moduleCode: 'M02',
    moduleTitle: 'Economics',
    deliveryMode: 'in_person',
    glossaryEntries: [],
    sources: [],
  };
  const cut = Array.from({ length: 7 }, (_, i) => slide('bullets', `Point ${i}`));
  const whole = [
    ...Array.from({ length: 11 }, (_, i) => slide('bullets', `Point ${i}`)),
    slide('bullets', 'Summary'),
  ];

  afterEach(() => jest.restoreAllMocks());

  it('asks again with twice the room and keeps the whole deck', async () => {
    const llm = jest
      .spyOn(pptGenerationService as any, 'generateLessonSlidesWithLLM')
      .mockResolvedValueOnce(cut)
      .mockResolvedValueOnce(whole);
    const deck: any = await pptGenerationService.generateLessonPPT(lesson, context);
    expect(llm.mock.calls.map((c) => c[2])).toEqual([32000, 64000]);
    expect(deck).toMatchObject({ generatedBy: 'ai', complete: true, slideCount: 12 });
  });

  it('keeps the longer answer when the second is shorter, and marks it incomplete', async () => {
    jest
      .spyOn(pptGenerationService as any, 'generateLessonSlidesWithLLM')
      .mockResolvedValueOnce(cut)
      .mockResolvedValueOnce(cut.slice(0, 3));
    const deck: any = await pptGenerationService.generateLessonPPT(lesson, context);
    expect(deck).toMatchObject({ generatedBy: 'ai', complete: false, slideCount: 7 });
  });

  it('does not ask again after a failed call, and labels the result an outline', async () => {
    const llm = jest
      .spyOn(pptGenerationService as any, 'generateLessonSlidesWithLLM')
      .mockRejectedValue(new Error('401 Incorrect API key'));
    const deck: any = await pptGenerationService.generateLessonPPT(lesson, context);
    expect(llm).toHaveBeenCalledTimes(1);
    expect(deck.generatedBy).toBe('outline');
    expect(storedDeckFor(lesson, [deck])).toBeUndefined();
  });
});

describe('CIPD', () => {
  it('keeps the framework, drops the attribution and the citations', () => {
    expect(withoutCIPD('Apply the CIPD PESTLE framework to rank risks')).toBe(
      'Apply the PESTLE framework to rank risks'
    );
    expect(withoutCIPD('Formula sheet, CIPD PESTLE factsheet (link), dataset')).toBe(
      'Formula sheet, PESTLE factsheet (link), dataset'
    );
    expect(withoutCIPD('Scan widely (CIPD, 2024) before rating.')).toBe(
      'Scan widely before rating.'
    );
    expect(
      withoutCIPD('Readings:\n• CIPD. (2024). PESTLE analysis factsheet.\n• OECD (2023)')
    ).toBe('Readings:\n• OECD (2023)');
    const deck = withoutCIPD({
      at: new Date(0),
      content: ['CIPD. (2024). PESTLE analysis factsheet.', 'Use the CIPD PESTLE lens'],
    });
    expect(deck).toEqual({ at: new Date(0), content: ['Use the PESTLE lens'] });
    expect(deckProblems({ slides: deck as any })).not.toContain('names CIPD');
  });

  it('is not shown to the slide writer and not written on its slides', async () => {
    const llm = jest.spyOn(openaiService, 'generateContent').mockResolvedValue(
      JSON.stringify({
        slides: [{ type: 'bullets', title: 'CIPD PESTLE', content: ['the CIPD PESTLE lens'] }],
      })
    );
    const lesson: any = {
      lessonId: 'L4',
      lessonNumber: 4,
      lessonTitle: 'Macro risk radar',
      duration: 90,
      objectives: ['Apply the CIPD PESTLE framework'],
      activities: [],
    };
    const slides = await (pptGenerationService as any).generateLessonSlidesWithLLM(lesson, {
      programTitle: 'BBA',
      moduleCode: 'M02',
      moduleTitle: 'Economics',
      deliveryMode: 'in_person',
      glossaryEntries: [],
      sources: [],
    });
    const prompt = String(llm.mock.calls[0][0]);
    expect(prompt).not.toMatch(/CIPD/);
    expect(prompt).toMatch(/Apply the PESTLE framework/);
    expect(JSON.stringify(slides)).not.toMatch(/CIPD/);
    llm.mockRestore();
  });

  it('is not in a downloaded file of a deck stored before it was ruled out', async () => {
    const text = await slideTexts(
      deckOf([
        slide('bullets', 'Apply the CIPD PESTLE framework', { content: ['CIPD PESTLE scan'] }),
      ])
    );
    expect(text).not.toMatch(/CIPD/);
    expect(text).toContain('Apply the PESTLE framework');
  });
});

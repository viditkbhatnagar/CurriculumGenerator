/**
 * Dr Sherin, 14 October 2026: decks cut off mid-lesson, blank two-column slides, "CIPD PESTLE",
 * and slides too brief to teach from.
 */
import JSZip from 'jszip';
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
});

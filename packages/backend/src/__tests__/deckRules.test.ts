/**
 * Logan Pacey, 17 November 2026, Diploma in Logistics pilot: four slide-count rules disagreed
 * and the outcome check could never pass.
 */
import {
  DECK_MAX_SLIDES,
  DECK_MIN_SLIDES,
  MODEL_MAX_SLIDES,
  MODEL_MIN_SLIDES,
  deckMloCoverage,
  deckShapeIssues,
  mloCoverageOk,
  normaliseMloId,
  significantStems,
  slideCountValid,
} from '../services/deckRules';

const slide = (title: string, content: any = {}, slideType = 'content') => ({
  slideType,
  title,
  content: { type: 'bullets', title, ...content },
});

const statements = {
  'M3-LO2': 'Evaluate warehouse layout strategies for inventory efficiency',
  'M3-LO3': 'Apply transport routing algorithms to delivery networks',
};

describe('slide count rule', () => {
  it('has one range, and asks the model for room to add the code-built slides', () => {
    expect([DECK_MIN_SLIDES, DECK_MAX_SLIDES]).toEqual([12, 20]);
    expect(MODEL_MIN_SLIDES + 1).toBe(DECK_MIN_SLIDES);
    expect(MODEL_MAX_SLIDES + 3).toBe(DECK_MAX_SLIDES);
  });

  it('accepts the boundaries and nothing outside', () => {
    expect([11, 12, 20, 21].map(slideCountValid)).toEqual([false, true, true, false]);
    expect(slideCountValid(NaN)).toBe(false);
  });
});

describe('deckMloCoverage', () => {
  const lesson = { linkedMLOs: ['M3-LO2', 'M3-LO3'] };

  it('covers an outcome through a slide tag, ignoring case and punctuation', () => {
    const c = deckMloCoverage(lesson, [
      slide('Cover', {}, 'title'),
      slide('A', { mlos: ['m3 lo2'] }),
      slide('B', { mlos: ['M3_LO3'] }),
    ]);
    expect(c.missing).toEqual([]);
    expect(c.viaTags).toEqual(['M3-LO2', 'M3-LO3']);
    expect(mloCoverageOk(c)).toBe(true);
  });

  it('does not count a tag on the cover or a tag for an outcome the lesson is not linked to', () => {
    const c = deckMloCoverage(lesson, [
      slide('Cover', { mlos: ['M3-LO2'] }, 'title'),
      slide('A', { mlos: ['M9-LO9'] }),
    ]);
    expect(c.missing).toEqual(['M3-LO2', 'M3-LO3']);
    expect(mloCoverageOk(c)).toBe(false);
  });

  it('falls back to the statement words on a single slide', () => {
    const c = deckMloCoverage(
      lesson,
      [slide('Warehouse layout', { content: ['Layout strategies raise inventory efficiency'] })],
      statements
    );
    expect(c.viaText).toEqual(['M3-LO2']);
    expect(c.missing).toEqual(['M3-LO3']);
  });

  it('does not match words spread thinly over a deck, or words only in the notes', () => {
    const c = deckMloCoverage(
      lesson,
      [
        slide('Warehouse', { content: ['Stock'], notes: 'layout strategies inventory efficiency' }),
        slide('Layout', { content: ['Other'] }),
      ],
      statements
    );
    expect(c.covered).toEqual([]);
  });

  it('reports a lesson with no linked outcomes as unchecked, never as passing', () => {
    const c = deckMloCoverage({ linkedMLOs: [] }, [slide('A')], statements);
    expect(c.checked).toBe(false);
    expect(mloCoverageOk(c)).toBe(false);
  });

  it('does not need an objectives slide', () => {
    const c = deckMloCoverage(lesson, [slide('A', { mlos: ['M3-LO2', 'M3-LO3'] })]);
    expect(mloCoverageOk(c)).toBe(true);
  });
});

describe('helpers and shape issues', () => {
  it('normalises ids and takes stems of significant words only', () => {
    expect(normaliseMloId(' M3-LO2 ')).toBe('m3lo2');
    expect(significantStems('Evaluate logistics and logistical networks')).toEqual([
      'logis',
      'netwo',
    ]);
  });

  it('names each shape problem, and none for a sound deck', () => {
    const lesson = { linkedMLOs: ['M3-LO2'] };
    const issues = deckShapeIssues([slide('A')], lesson);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatch(/1 slides/);
    expect(issues[1]).toMatch(/M3-LO2/);
    const sound = Array.from({ length: 13 }, (_, i) => slide(`S${i}`, { mlos: ['M3-LO2'] }));
    expect(deckShapeIssues(sound, lesson)).toEqual([]);
  });
});

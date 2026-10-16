/**
 * Rejin's audit, 16 October 2026: "export should not rewrite already approved academic content".
 */
import { layoutProse, paragraphsOf } from '../utils/proseLayout';

const words = (texts: string[]) => texts.join(' ').split(/\s+/).filter(Boolean);

describe('layoutProse', () => {
  const approved =
    'Constructive alignment links outcomes, activities and assessment. Students first meet the ' +
    'model in a short lecture. They then apply it to a case. Each group presents its analysis. ' +
    'The tutor gives feedback against the rubric. Students revise their analysis. The revised ' +
    'analysis is submitted for marking. Constructive alignment links outcomes, activities and ' +
    'assessment.';

  it('keeps every word, in order, including a repeated sentence', () => {
    const out = layoutProse(approved);
    expect(out.bullets).toEqual([]);
    expect(words(out.paragraphs)).toEqual(words([approved]));
    expect(out.paragraphs.length).toBeGreaterThan(1);
  });

  it("keeps the author's own paragraph breaks", () => {
    expect(layoutProse('First paragraph here.\n\nSecond paragraph here.').paragraphs).toEqual([
      'First paragraph here.',
      'Second paragraph here.',
    ]);
  });

  it('turns a passage written as a list into bullets, without the markers', () => {
    const out = layoutProse('The module covers:\n- pricing\n• elasticity\n3. tax incidence');
    expect(out).toEqual({
      paragraphs: ['The module covers:'],
      bullets: ['pricing', 'elasticity', 'tax incidence'],
    });
  });

  it('leaves a sentence that happens to start with a dash-like word as prose', () => {
    const out = layoutProse('Ten-year bonds rose. Yields fell.\nA single line here.');
    expect(out.bullets).toEqual([]);
    expect(words(out.paragraphs)).toEqual(
      words(['Ten-year bonds rose. Yields fell. A single line here.'])
    );
  });

  it('returns nothing for empty text', () => {
    expect(layoutProse('  ')).toEqual({ paragraphs: [], bullets: [] });
    expect(paragraphsOf('')).toEqual([]);
  });
});

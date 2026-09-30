import {
  step11ValidationFromDecks,
  step12ValidationFromPacks,
} from '../services/deliverableValidation';

describe('step11ValidationFromDecks', () => {
  const deck = (extra: any = {}) => ({
    slideCount: 10,
    validation: { mlosCovered: true, citationsValid: true },
    ...extra,
  });

  it('passes nothing when there are no decks', () => {
    expect(Object.values(step11ValidationFromDecks([], 0))).toEqual(Array(4).fill(false));
  });

  it('reports each deck check from the decks, not as a constant', () => {
    const v = step11ValidationFromDecks(
      [deck(), deck({ validation: { mlosCovered: false, citationsValid: true } })],
      2
    );
    expect(v.allMLOsCovered).toBe(false);
    expect(v.allCitationsValid).toBe(true);
  });

  it('fails citations when a deck never recorded the check', () => {
    expect(step11ValidationFromDecks([deck({ validation: undefined })], 1).allCitationsValid).toBe(
      false
    );
  });

  it('fails slide counts outside 8-15 and missing decks', () => {
    const v = step11ValidationFromDecks([deck({ slideCount: 20 })], 2);
    expect(v.allSlideCountsValid).toBe(false);
    expect(v.allLessonsHavePPTs).toBe(false);
  });

  it('reports citations not checked, rather than valid, when decks had no sources', () => {
    const v = step11ValidationFromDecks(
      [deck({ validation: { mlosCovered: true, citationsValid: null } })],
      1
    );
    expect(v.allCitationsValid).toBeNull();
  });

  it('fails citations when any deck failed, even beside unchecked ones', () => {
    const v = step11ValidationFromDecks(
      [
        deck({ validation: { mlosCovered: true, citationsValid: null } }),
        deck({ validation: { mlosCovered: true, citationsValid: false } }),
      ],
      2
    );
    expect(v.allCitationsValid).toBe(false);
  });

  it('does not let two decks for one lesson stand in for a lesson with none', () => {
    const v = step11ValidationFromDecks([deck({ lessonId: 'L1' }), deck({ lessonId: 'L1' })], 2);
    expect(v.allLessonsHavePPTs).toBe(false);
  });
});

describe('step12ValidationFromPacks', () => {
  const modules = [{ id: 'm1', mlos: [{ id: 'a' }, { id: 'b' }] }];
  const variant = (linked: string[]) => ({ rubric: [{ linkedMLOs: linked }] });
  const pack = (linked: string[]) => ({
    moduleId: 'm1',
    variants: { in_person: variant(linked), self_study: variant(linked), hybrid: variant(linked) },
  });

  it('passes nothing when there are no packs', () => {
    expect(Object.values(step12ValidationFromPacks([], modules))).toEqual(Array(4).fill(false));
  });

  it('fails outcome coverage when an outcome is never assessed', () => {
    expect(step12ValidationFromPacks([pack(['a'])], modules).allMLOsCovered).toBe(false);
  });

  it('passes outcome coverage when every outcome is assessed', () => {
    expect(step12ValidationFromPacks([pack(['a', 'b'])], modules).allMLOsCovered).toBe(true);
  });

  it('fails rubric completeness when a variant has no criteria', () => {
    const p = pack(['a', 'b']);
    p.variants.hybrid = { rubric: [] };
    expect(step12ValidationFromPacks([p], modules).allRubricsComplete).toBe(false);
  });

  // A variant whose generation failed is stored as a placeholder listing every outcome as
  // assessed, with an empty rubric. It is not an assignment.
  const placeholder = () => ({
    assignmentId: 'M1-hybrid-placeholder',
    rubric: [],
    assessedOutcomes: [{ mloId: 'a' }, { mloId: 'b' }],
  });

  it('does not count placeholder variants from failed generations as assessing anything', () => {
    const p = {
      moduleId: 'm1',
      variants: { in_person: placeholder(), self_study: placeholder(), hybrid: placeholder() },
    };
    const v = step12ValidationFromPacks([p], modules);
    expect(v.allMLOsCovered).toBe(false);
    expect(v.allVariantsGenerated).toBe(false);
  });

  it('fails variants generated when one of three failed, even with the others real', () => {
    const p: any = pack(['a', 'b']);
    p.variants.hybrid = placeholder();
    const v = step12ValidationFromPacks([p], modules);
    expect(v.allVariantsGenerated).toBe(false);
    expect(v.allMLOsCovered).toBe(true);
  });

  it('fails every module having an assignment when one module has no pack', () => {
    const two = [...modules, { id: 'm2', mlos: [{ id: 'c' }] }];
    expect(step12ValidationFromPacks([pack(['a', 'b'])], two).allModulesHaveAssignments).toBe(
      false
    );
  });
});

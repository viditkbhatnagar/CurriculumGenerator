import { restrictedFrom, visibleConcept, visibleConcepts } from '../knowledge/bookAccess';

const OPEN = 'open-book';
const SSM = 'ssm-book';
const concept = (code: string, books: string[]) => ({
  code,
  evidence: books.map((bookId) => ({ bookId, chapter: { number: '1', title: 'One' } })),
});

describe('visibleConcept', () => {
  it('shows everything when no book is restricted or chosen', () => {
    const c = concept('K-1', [OPEN, SSM]);
    expect(visibleConcept({}, c)).toBe(c);
  });

  it("drops another programme's licensed book from a concept's evidence", () => {
    const seen = visibleConcept({ hiddenBookIds: [SSM] }, concept('K-1', [OPEN, SSM]));
    expect(seen?.evidence?.map((e) => e.bookId)).toEqual([OPEN]);
  });

  it('hides a concept that only a restricted book teaches', () => {
    expect(visibleConcept({ hiddenBookIds: [SSM] }, concept('K-2', [SSM]))).toBeNull();
  });

  it('keeps only the books a programme chose', () => {
    const seen = visibleConcept({ bookIds: [SSM] }, concept('K-1', [OPEN, SSM]));
    expect(seen?.evidence?.map((e) => e.bookId)).toEqual([SSM]);
  });

  it('does not change the concept it was given', () => {
    const c = concept('K-1', [OPEN, SSM]);
    visibleConcept({ hiddenBookIds: [SSM] }, c);
    expect(c.evidence).toHaveLength(2);
  });

  it('filters a list, dropping the hidden ones', () => {
    const list = [concept('K-1', [OPEN]), concept('K-2', [SSM]), concept('K-3', [SSM, OPEN])];
    expect(visibleConcepts({ hiddenBookIds: [SSM] }, list).map((c) => c.code)).toEqual([
      'K-1',
      'K-3',
    ]);
  });
});

describe('restrictedFrom', () => {
  const BBA = '6a619d817a037be307a8fa7c';
  const OTHER = '6ae24a8146277a0c7e20dcc2';

  it("keeps an institution's licensed book from other programmes", () => {
    const ssm = { licence: 'institution-licensed', programmes: [BBA] };
    expect(restrictedFrom(ssm, OTHER)).toBe(true);
    expect(restrictedFrom(ssm, BBA)).toBe(false);
  });

  it('never restricts an open-licence book, whatever its programmes field says', () => {
    expect(restrictedFrom({ licence: 'cc-by-nc-sa', programmes: ['MAIB'] }, OTHER)).toBe(false);
    expect(restrictedFrom({ licence: 'cc-by', programmes: [BBA] }, OTHER)).toBe(false);
  });

  it('leaves a licensed book with no programmes listed open to all', () => {
    expect(restrictedFrom({ licence: 'institution-licensed', programmes: [] }, OTHER)).toBe(false);
  });
});

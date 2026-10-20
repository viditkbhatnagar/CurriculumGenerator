import {
  assignRoles,
  classifyImportance,
  conceptKey,
  keysFor,
  matchConcept,
  tidyEvidence,
} from '../knowledge/clustering';

const unit = (v: number[]) => {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / n);
};

describe('conceptKey', () => {
  it('treats the usual spellings of one framework alike', () => {
    expect(conceptKey("Porter's Five Forces Model")).toBe('porter five force');
    expect(conceptKey('The Five Forces')).toBe('five force');
    expect(keysFor("Porter's Five Forces Model")).toContain('five force');
  });
  it('drops bracketed abbreviations and keeps distinct names distinct', () => {
    expect(conceptKey('Net Present Value (NPV)')).toBe('net present value');
    expect(conceptKey('Internal Rate of Return')).not.toBe(conceptKey('Net Present Value'));
  });
});

describe('matchConcept', () => {
  const existing = [
    {
      id: 'c1',
      key: 'five force',
      keys: ['five force'],
      area: 'Strategy',
      vector: unit([1, 0, 0]),
    },
    {
      id: 'c2',
      key: 'value chain',
      keys: ['value chain'],
      area: 'Strategy',
      vector: unit([0, 1, 0]),
    },
  ];

  it('merges on a shared name key', () => {
    const c = {
      key: 'porter five force',
      keys: keysFor("Porter's Five Forces"),
      area: 'Strategy',
      vector: unit([0, 0, 1]),
    };
    expect(matchConcept(c, existing)?.id).toBe('c1');
  });

  it('merges on very close meaning even with a different name', () => {
    const c = {
      key: 'industry competition',
      keys: ['industry competition'],
      area: 'Strategy',
      vector: unit([1, 0.05, 0]),
    };
    expect(matchConcept(c, existing)?.id).toBe('c1');
  });

  it('keeps a related but different concept separate', () => {
    const c = {
      key: 'generic strategy',
      keys: ['generic strategy'],
      area: 'Strategy',
      vector: unit([1, 0.6, 0]),
    };
    expect(matchConcept(c, existing)).toBeNull();
  });

  it('never merges across areas', () => {
    const c = {
      key: 'five force',
      keys: ['five force'],
      area: 'Marketing',
      vector: unit([1, 0, 0]),
    };
    expect(matchConcept(c, existing)).toBeNull();
  });
});

describe('assignRoles', () => {
  const ev = (bookId: string, treatment: any, start: string, end: string, critique = false) => ({
    bookId,
    treatment,
    critique,
    pageLabelStart: start,
    pageLabelEnd: end,
  });

  it('makes the deepest, longest treatment primary and one per other book supplementary', () => {
    const roles = assignRoles([
      ev('A', 'mention', '3', '3'),
      ev('B', 'extended', '112', '118'),
      ev('C', 'treatment', '40', '44'),
      ev('B', 'treatment', '200', '201'),
      ev('D', 'treatment', '9', '10', true),
    ]).map((e) => e.role);
    expect(roles).toEqual(['additional', 'primary', 'supplementary', 'additional', 'critical']);
  });
});

describe('classifyImportance', () => {
  it('calls a concept most books teach in depth core', () => {
    expect(
      classifyImportance({
        booksTreating: 8,
        domainBooks: 9,
        deepest: 'extended',
        level: 'intermediate',
      }).importance
    ).toBe('core');
  });
  it('does not equate a one-book niche framework with a core one', () => {
    expect(
      classifyImportance({
        booksTreating: 1,
        domainBooks: 9,
        deepest: 'treatment',
        level: 'intermediate',
      }).importance
    ).toBe('supporting');
    expect(
      classifyImportance({
        booksTreating: 1,
        domainBooks: 9,
        deepest: 'mention',
        level: 'intermediate',
      }).importance
    ).toBe('optional');
  });
  it('keeps advanced material apart', () => {
    expect(
      classifyImportance({
        booksTreating: 2,
        domainBooks: 9,
        deepest: 'extended',
        level: 'advanced',
      }).importance
    ).toBe('advanced');
  });
});

describe('tidyEvidence', () => {
  const e = (bookId: string, sectionKey: string, treatment: string) => ({
    bookId,
    sectionKey,
    treatment,
    pageLabelEnd: '1',
  });

  it('keeps one mention per book until the book treats the concept', () => {
    let ev: any[] = [];
    ev = tidyEvidence(ev, e('A', '1.1', 'mention'), '1.1');
    ev = tidyEvidence(ev, e('A', '1.2', 'mention'), '1.2');
    expect(ev).toHaveLength(1);
    ev = tidyEvidence(ev, e('A', '1.3', 'extended'), '1.3');
    expect(ev.map((x) => x.treatment)).toEqual(['extended']);
  });

  it('caps a book at its four deepest treatments and leaves other books alone', () => {
    let ev: any[] = [e('B', '2.1', 'treatment')];
    for (let i = 0; i < 7; i++)
      ev = tidyEvidence(ev, e('A', `1.${i}`, i === 6 ? 'extended' : 'treatment'), `1.${i}`);
    const mine = ev.filter((x) => x.bookId === 'A');
    expect(mine).toHaveLength(4);
    expect(mine[0].treatment).toBe('extended');
    expect(ev.filter((x) => x.bookId === 'B')).toHaveLength(1);
  });
});

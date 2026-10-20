import { pickAcrossAreas } from '../knowledge/selection';

const c = (area: string, name: string, importance = 'core', bookCount = 1) => ({
  area,
  name,
  importance,
  bookCount,
});

describe('pickAcrossAreas', () => {
  it('keeps every area when the budget is smaller than the library', () => {
    const lib = [
      ...Array.from({ length: 50 }, (_, i) => c('Accounting', `A${i}`)),
      ...Array.from({ length: 50 }, (_, i) => c('Statistics & Probability', `S${i}`)),
      c('Programming', 'Loops'),
    ];
    const picked = pickAcrossAreas(lib, 10);
    expect(new Set(picked.map((p) => p.area))).toEqual(
      new Set(['Accounting', 'Statistics & Probability', 'Programming'])
    );
    expect(picked).toHaveLength(10);
  });

  it('takes core and widely taught concepts of an area first', () => {
    const picked = pickAcrossAreas(
      [
        c('Finance', 'Rare', 'optional', 1),
        c('Finance', 'NPV', 'core', 5),
        c('Finance', 'IRR', 'core', 3),
      ],
      2
    );
    expect(picked.map((p) => p.name)).toEqual(['NPV', 'IRR']);
  });
});

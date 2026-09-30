import { briefItems } from '../agu/export/coursePackageDocx';

describe('briefItems', () => {
  it('turns an inline enumeration into a lead-in and a list', () => {
    const brief =
      'Using a provided dataset, deliver: (1) a one-page decision brief; (2) a data preparation log; and (3) a short reflection.';
    expect(briefItems(brief)).toEqual({
      lead: 'Using a provided dataset, deliver:',
      items: [
        '(1) a one-page decision brief',
        '(2) a data preparation log',
        '(3) a short reflection.',
      ],
    });
  });

  it('leaves a brief with no enumeration as written', () => {
    expect(briefItems('Write a 2,000-word report on the case.')).toEqual({
      lead: 'Write a 2,000-word report on the case.',
      items: [],
    });
  });

  it('does not split on a single parenthesised number', () => {
    expect(briefItems('Answer question (1) in full.').items).toEqual([]);
  });
});

import { citationsVerified, unmatchedCitations } from '../services/citationMatch';

const sources = [
  {
    title: 'Supply chain resilience: a systematic literature review',
    doi: '10.1016/j.ijpe.2020.107849',
    citation: 'Ponomarov, S. Y., & Holcomb, M. C. (2020). Supply chain resilience...',
  },
];

describe('citationsVerified', () => {
  it('is not checked, rather than passed, when no verified sources were supplied', () => {
    expect(citationsVerified(['Anything (2020).'], [])).toBeNull();
    expect(citationsVerified(['Anything (2020).'], undefined)).toBeNull();
  });

  it('fails a lesson that cites nothing although sources exist', () => {
    expect(citationsVerified([], sources)).toBe(false);
  });

  it('matches a citation by DOI, including a doi.org link', () => {
    expect(
      citationsVerified(['Ponomarov (2020). https://doi.org/10.1016/j.ijpe.2020.107849'], sources)
    ).toBe(true);
  });

  it('matches a citation by title', () => {
    expect(
      citationsVerified(
        ['Ponomarov & Holcomb. Supply Chain Resilience: A Systematic Literature Review.'],
        sources
      )
    ).toBe(true);
  });

  it('fails a citation that matches no verified source', () => {
    const cited = ['Smith, J. (2019). An invented handbook of logistics. Acme Press.'];
    expect(citationsVerified(cited, sources)).toBe(false);
    expect(unmatchedCitations(cited, sources)).toEqual(cited);
  });
});

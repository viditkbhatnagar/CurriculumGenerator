import { conceptReference, referencesForCodes, shortReference } from '../knowledge/references';
import { formatBodyOfKnowledge, formatConcept } from '../knowledge/retrieval';

const concept = {
  code: 'K-MKT-0440',
  aliasCodes: ['K-MKT-0099'],
  name: 'Segmentation',
  area: 'Marketing',
  conceptType: 'framework',
  importance: 'core',
  bookCount: 1,
  evidence: [
    {
      role: 'supplementary',
      bookTitle: 'Other Book',
      authors: ['A. One'],
      chapter: { number: '2' },
      pageLabelStart: '5',
      pageLabelEnd: '6',
    },
    {
      role: 'primary',
      bookTitle: 'Principles of Marketing',
      authors: ['Philip Kotler', 'Gary Armstrong', 'Someone Else'],
      chapter: { number: '6', title: 'Segmentation' },
      pageLabelStart: '235',
      pageLabelEnd: '235',
    },
  ],
};

describe('references', () => {
  it('shortens to first author et al., title and chapter', () => {
    expect(shortReference(concept.evidence[1])).toBe(
      'Kotler et al., Principles of Marketing, ch. 6'
    );
    expect(shortReference({ bookTitle: 'T', authors: ['A B', 'C D'], chapter: {} })).toBe(
      'B & D, T'
    );
  });

  it('resolves a concept by its primary treatment', () => {
    expect(conceptReference(concept)).toMatchObject({
      code: 'K-MKT-0440',
      bookTitle: 'Principles of Marketing',
      chapter: '6',
      pages: 'p. 235',
      reference: 'Kotler et al., Principles of Marketing, ch. 6, p. 235',
    });
    expect(conceptReference({ code: 'K', evidence: [] })).toBeNull();
  });

  it('resolves merged codes under the code asked for, dropping unknown ones', () => {
    const refs = referencesForCodes(
      ['K-MKT-0099', 'K-MKT-0440', 'K-NOPE-0001', 'K-MKT-0099'],
      [concept]
    );
    expect(refs.map((r) => r.code)).toEqual(['K-MKT-0099', 'K-MKT-0440']);
  });
});

describe('readable prompt format', () => {
  it('lists a concept without its code and with bracketed references', () => {
    const line = formatConcept(concept, { readable: true, sources: 1 });
    expect(line).not.toContain('K-MKT-0440');
    expect(line).toContain('[Kotler et al., Principles of Marketing, ch. 6]');
  });

  it('keeps the code format by default and asks for references only when readable', () => {
    expect(formatConcept(concept)).toContain('K-MKT-0440');
    expect(formatBodyOfKnowledge([concept])).toContain('refer to them by code');
    const readable = formatBodyOfKnowledge([concept], { readable: true });
    expect(readable).toContain('never write concept codes');
    expect(readable).not.toContain('refer to them by code');
  });
});

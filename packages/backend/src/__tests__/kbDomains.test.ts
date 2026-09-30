import { resolveKBDomains } from '../services/kbDomains';

describe('resolveKBDomains', () => {
  it('maps the names the workflow steps ask for onto the stored domains', () => {
    // Step 1's request. None of these names exists in the knowledge base as written.
    expect(
      resolveKBDomains(['curriculum-design', 'accreditation', 'competency-framework', 'standards'])
    ).toEqual([
      'curriculum_design',
      'accreditation_standards',
      'competency_frameworks',
      'education_standards',
    ]);
  });

  it('keeps stored names as they are', () => {
    expect(resolveKBDomains(['output_templates'])).toEqual(['output_templates']);
  });

  it('maps typeOfOutputs to the output templates', () => {
    expect(resolveKBDomains(['typeOfOutputs'])).toEqual(['output_templates']);
  });

  it('maps Subject Books to the domain its ingestion writes', () => {
    // Step 5's request. The ingestion script stores that folder as subject_knowledge.
    expect(resolveKBDomains(['standards', 'Subject Books'])).toEqual([
      'education_standards',
      'accreditation_standards',
      'subject_knowledge',
    ]);
  });

  it('drops names that match no stored domain', () => {
    expect(resolveKBDomains(['standards', 'Marketing Folklore'])).toEqual([
      'education_standards',
      'accreditation_standards',
    ]);
  });

  it('searches everything rather than nothing when no requested name exists', () => {
    expect(resolveKBDomains(['Marketing Folklore'])).toBeUndefined();
    expect(resolveKBDomains([])).toBeUndefined();
    expect(resolveKBDomains(undefined)).toBeUndefined();
  });

  it('ignores client input that is not a domain name instead of throwing', () => {
    // POST /api/rag/search passes its `domains` through; these used to throw and return 500.
    expect(resolveKBDomains(['constructor', 'toString'])).toBeUndefined();
    expect(resolveKBDomains([5 as unknown as string, null as unknown as string])).toBeUndefined();
  });
});

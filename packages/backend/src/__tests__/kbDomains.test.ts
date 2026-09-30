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

  it('drops names that match no stored domain', () => {
    expect(resolveKBDomains(['standards', 'Subject Books'])).toEqual([
      'education_standards',
      'accreditation_standards',
    ]);
  });

  it('searches everything rather than nothing when no requested name exists', () => {
    expect(resolveKBDomains(['Subject Books'])).toBeUndefined();
    expect(resolveKBDomains([])).toBeUndefined();
    expect(resolveKBDomains(undefined)).toBeUndefined();
  });
});

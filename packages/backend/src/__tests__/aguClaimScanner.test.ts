import { DISCLOSURES, findProhibitedClaims } from '../agu/rules/usUtahRules';

const ruleIds = (text: string) => findProhibitedClaims(text).map((m) => m.ruleId);

describe('findProhibitedClaims: what counts as a denial', () => {
  // A negation anywhere in the sentence used to excuse the claim. These sentences each make an
  // affirmative claim and carry an unrelated "no", "not" or "never" somewhere else.
  it.each<[string, string[]]>([
    [
      'AGU is accredited by DEAC, and there is no tuition surcharge.',
      ['accreditation', 'named_accreditor'],
    ],
    ['Our MBA is fully accredited; no prior experience is required.', ['accreditation']],
    [
      'We never hide the fact that every credit transfers automatically to any university.',
      ['transfer_guarantee'],
    ],
    ['No hidden fees, fully accredited, 100% online.', ['accreditation']],
    ['We have no hidden fees and are accredited by DEAC.', ['accreditation', 'named_accreditor']],
    ['Not only accredited but also affordable.', ['accreditation']],
    ['We do not cut corners. Our MBA is accredited.', ['accreditation']],
    ['No hidden fees\nFully accredited', ['accreditation']],
    // A negation inside a guarantee belongs to something else; the guarantee still stands.
    ['We guarantee that no graduate is left without a job.', ['placement_or_earnings']],
    ['We guarantee no hidden fees and a job after graduation.', ['placement_or_earnings']],
    // A denied promise does not swallow a second, affirmative one after it.
    ['We do not guarantee placement, and we guarantee a job.', ['placement_or_earnings']],
  ])('still finds the claim in: %s', (sentence, expected) => {
    expect(ruleIds(sentence)).toEqual(expected);
  });

  it('finds the claim when the negation comes after it, not before', () => {
    expect(ruleIds('Accredited by DEAC, not a diploma mill.')).toEqual([
      'accreditation',
      'named_accreditor',
    ]);
  });

  // The denial has to sit right before the claim term, in the same clause.
  it.each([
    'AGU is not accredited by an agency recognized by the US Department of Education.',
    'AGU has not yet been accredited.',
    "AGU isn't accredited.",
    'AGU isn\u2019t accredited.',
    'AGU cannot claim accreditation.',
    'AGU makes no claim of accreditation.',
    'AGU is a non-accredited institution.',
    'Neither AGU nor its programmes are accredited.',
    'AGU is not accredited by DEAC.',
    'AGU does not guarantee employment or salary outcomes.',
    'There is no guarantee that any graduate will find a job.',
    'Credits are not guaranteed to transfer to any other institution.',
    'Credits do not transfer automatically to other institutions.',
    'We do not promise that credits will transfer to any university.',
    'The certificate is not approved by the State of Utah.',
    'The course does not lead to licensure.',
  ])('lets a real denial through: %s', (sentence) => {
    expect(findProhibitedClaims(sentence)).toEqual([]);
  });

  it('does not let a denial of one thing excuse a claim in the next clause', () => {
    expect(ruleIds('AGU is not a university, but DEAC accredits every programme.')).toEqual([
      'accreditation',
      'named_accreditor',
    ]);
  });

  it('does not let a denial in one sentence excuse the next sentence', () => {
    expect(ruleIds('AGU has no campus. AGU is accredited.')).toEqual(['accreditation']);
  });

  it('reads every occurrence: one denied mention does not hide an affirmative one', () => {
    expect(ruleIds('AGU is not accredited, yet our accredited MBA is respected.')).toEqual([
      'accreditation',
    ]);
  });
});

describe('findProhibitedClaims: wording the old patterns missed', () => {
  it.each<[string, string[]]>([
    ['DEAC accredits our programmes.', ['accreditation', 'named_accreditor']],
    ['Our accreditor reviews every course.', ['accreditation']],
    ['AGU is an accrediting authority.', ['accreditation']],
    ['Every credit transfers automatically to any university.', ['transfer_guarantee']],
    ['We guarantee jobs for every graduate.', ['placement_or_earnings']],
    ['The degree is approved by the State of Utah.', ['state_approval']],
  ])('catches: %s', (sentence, expected) => {
    expect(ruleIds(sentence)).toEqual(expected);
  });

  it('keeps warning severity for UK framing, which has no denial', () => {
    const [match] = findProhibitedClaims('Apply UK GDPR principles. Not every case needs it.');
    expect(match.ruleId).toBe('uk_framing');
    expect(match.severity).toBe('warning');
  });
});

describe('the approved disclosure wording', () => {
  it('passes verbatim, sentence by sentence', () => {
    for (const d of DISCLOSURES) expect(findProhibitedClaims(d.text)).toEqual([]);
  });

  it('recognises an approved sentence after its spacing has been reflowed', () => {
    const text = DISCLOSURES.find((d) => d.id === 'programmatic_accreditation')!.text;
    expect(findProhibitedClaims(text.replace(/ /g, '  '))).toEqual([]);
  });

  it('does not excuse a claim that only borrows a disclosure sentence', () => {
    const borrowed = `${DISCLOSURES[1].text} AGU is accredited by DEAC.`;
    expect(ruleIds(borrowed)).toEqual(['accreditation', 'named_accreditor']);
  });

  it('holds paraphrased disclosure wording to the same test as any other text', () => {
    // Denial right before the claim term: fine without being the approved sentence.
    expect(findProhibitedClaims('This institution is not accredited by any agency.')).toEqual([]);
    // The same idea with the denial far from the term is flagged for faculty to reword.
    expect(
      ruleIds(
        'No programme that this institution offers to students in any country holds programmatic accreditation.'
      )
    ).toEqual(['accreditation']);
  });
});

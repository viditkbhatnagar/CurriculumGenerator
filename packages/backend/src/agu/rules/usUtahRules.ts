/**
 * The US / Utah rule pack for AGU course documents, version 1 (2026-09-30).
 *
 * What a generated AGU document may and may not say about the institution. AGU holds a Utah
 * Division of Consumer Protection registration, which is not accreditation or approval, and
 * the product owner's specification is explicit: "Do not call a state authorisation
 * accreditation or claim DEAC or another future accreditor already applies." A model writing
 * course material will produce these claims unprompted, so every free-text field of a draft is
 * scanned (validation/draftText.ts walks them) and a match blocks the draft until faculty
 * remove it.
 *
 * Sources: AGU Catalog v1.4 §2, §2.3, §4, Appendix A; the product owner's catalogue redline
 * and compliance red-flag register; the Phase One Roadmap §3.
 */

export const RULE_PACK_VERSION = 'us-utah-1';

export interface ProhibitedClaim {
  id: string;
  pattern: RegExp;
  /**
   * Whether a negation excuses a match, and where it may sit. Omitted: never ("UK GDPR" is not
   * denied by a "not"). 'before': in the few words before the claim ("is not accredited",
   * "does not guarantee"). 'within': also between the words of the claim, for a claim that a
   * denial splits ("credits do not transfer to any"). It is chosen per rule because a negation
   * inside "guarantee ... job" belongs to something else: "we guarantee that no graduate is left
   * without a job" is a promise. See isDenied.
   */
  denial?: 'before' | 'within';
  severity: 'blocking' | 'warning';
  message: string;
  source: string;
}

export const PROHIBITED_CLAIMS: ProhibitedClaim[] = [
  {
    id: 'accreditation',
    // The stem, so "accredits" and "accreditor" match as well as "accredited".
    pattern: /\baccredit\w*/i,
    denial: 'before',
    severity: 'blocking',
    message:
      'Claims or implies accreditation. AGU is registered in Utah, not accredited; only the disclosure wording may mention accreditation, and only to deny it.',
    source: 'Catalog v1.4 §2; Roadmap §3',
  },
  {
    id: 'named_accreditor',
    pattern: /\b(DEAC|WASC|HLC|MSCHE|NECHE|SACSCOC|NWCCU|AACSB|ACBSP|IACBE)\b/,
    denial: 'before',
    severity: 'blocking',
    message:
      'Names an accreditor. No accreditor applies to AGU; a future accreditor is not to be claimed.',
    source: 'Roadmap §3; KB Architecture',
  },
  {
    id: 'state_approval',
    pattern: /\b(approved|endorsed|recommended|licensed)\s+by\s+(the\s+)?(state|utah|division)/i,
    denial: 'before',
    severity: 'blocking',
    message: 'Presents the Utah registration as state approval or endorsement.',
    source: 'Catalog v1.4 Appendix A; DCP certificate',
  },
  {
    id: 'transfer_guarantee',
    // Inflected forms matter: "every credit transfers automatically" is the claim. The gaps are
    // lazy so the match ends at the nearest claim term and a second claim in the same sentence
    // is judged on its own.
    pattern:
      /\b(credits?|degrees?|certificates?)\b[^.]{0,60}?\b(transfer(?:s|red|ring)?|recogni[sz]ed)\b[^.]{0,40}?\b(guarantee[sd]?|automatic(?:ally)?|all|any)\b/i,
    denial: 'within',
    severity: 'blocking',
    message:
      'Promises credit transfer or recognition, which the catalogue leaves to the receiving institution.',
    source: 'Catalog v1.4 Appendix A',
  },
  {
    id: 'placement_or_earnings',
    pattern:
      /\b(guarantee(?:s|d|ing)?|assured)\b[^.]{0,50}?\b(jobs?|employment|placements?|promotions?|salary|salaries|earnings?)\b/i,
    denial: 'before',
    severity: 'blocking',
    message: 'Promises employment, placement or earnings outcomes.',
    source: 'Product owner compliance register; Catalog v1.4 §12',
  },
  {
    id: 'licensure',
    pattern:
      /\b(leads? to|qualif(y|ies) (you|students|graduates) for|prepares? (you|students) for)\b[^.]{0,40}?\blicen[cs](e|ure)\b/i,
    denial: 'before',
    severity: 'blocking',
    message:
      'Implies the course leads to professional licensure; the catalogue states no programme does.',
    source: 'Catalog v1.4 §4',
  },
  {
    id: 'vendor_certification',
    // "Prepare for the ... certification exam" implies it as much as "earn a certification".
    pattern:
      /\b(earn|obtain|awarded|receive|prepare[sd]?\s+(?:you\s+|students\s+)?for|preparation\s+for)\b[^.]{0,40}?\b(certification|certified)\b/i,
    denial: 'before',
    severity: 'warning',
    message:
      'May imply a vendor or professional certification. Name any external exam only with the vendor-certification disclaimer.',
    source: 'Catalog v1.4 §12',
  },
  // Found missing by the 2026-10-01 audit: the course-drafts review lists each family as one to
  // strip, and the catalogue's own policies (materials_included, no_library) forbid the last
  // three. Warnings: a faculty member judges each one.
  {
    id: 'career_outcome',
    pattern:
      /\b(graduates?|students?|learners?|you)\b[^.]{0,30}?\b(will|are|become)\b[^.]{0,25}?\b(well[-\s]placed|positioned|ready|eligible|qualified)\b[^.]{0,40}?\b(roles?|jobs?|positions?|careers?|promotions?|employment)\b/i,
    denial: 'before',
    severity: 'warning',
    message:
      'Implies a career or job outcome for graduates. The catalogue makes no placement, promotion or role claims.',
    source: 'Product owner compliance register; Catalog v1.4 §12',
  },
  {
    id: 'recognition',
    pattern:
      /\b(globally|internationally|universally|widely)\s+(recogni[sz]ed|respected|accepted|valued)\b|\b(employers?|industry)\b[^.]{0,30}?\b(value|values|recogni[sz]es?|accepts?|respects?)\b[^.]{0,40}?\b(credential|certificate|qualification|degree|mba|diploma|programme|program)\b/i,
    denial: 'before',
    severity: 'warning',
    message:
      'Claims employer or international recognition of the credential, which AGU cannot evidence.',
    source: 'Product owner compliance register; course-drafts review',
  },
  {
    id: 'credential_name',
    pattern: /\b(micro-?credentials?|nano-?degrees?)\b/i,
    severity: 'warning',
    message:
      "Uses a credential name AGU does not award. AGU's credentials are the Course Certificate, the Specialized Diploma and the MBA.",
    source: 'Catalog v1.4 credentials',
  },
  {
    id: 'purchase_required',
    pattern:
      /\b(must|need to|needs to|will need to|have to|required to|should)\s+(buy|purchase|rent)\b|^\s*(buy|purchase)\b[^.]{0,30}?\b(text\s?books?|books?|licen[cs]es?|subscriptions?|software)\b/i,
    denial: 'before',
    severity: 'warning',
    message: 'Asks students to buy material. Course materials are included in tuition.',
    source: 'Catalog v1.4 §4.4 (materials_included)',
  },
  {
    id: 'software_install',
    // An instruction only: "Install ..." or "must install ...", so "installing sensors" in a
    // supply-chain course and the catalogue's own "not required to ... install software" pass.
    pattern:
      /(?:^\s*|\b(?:must|need to|needs to|will need to|have to|required to|should|please)\s+)(?:download\s+and\s+)?install\b[^.]{0,40}?\b(python|r|rstudio|anaconda|jupyter|tableau|power ?bi|spss|stata|matlab|sas|excel|software|application|app|tools?)\b/i,
    denial: 'before',
    severity: 'warning',
    message:
      'Asks students to install software. Students are not required to install software; use browser-based tools.',
    source: 'Catalog v1.4 §4.4 (materials_included)',
  },
  {
    id: 'library_access',
    pattern:
      /\b(library|institutional)\s+(databases?|access|subscriptions?|portal|login|e-?resources?)\b/i,
    denial: 'before',
    severity: 'warning',
    message:
      'Relies on library or database access. AGU has no library; every required item must be openly accessible or supplied through the platform.',
    source: 'Catalog v1.4 (no_library); template T05',
  },
  {
    id: 'uk_framing',
    pattern:
      /\b(UK GDPR|Ofqual|RQF|FHEQ|QAA|UK Level [0-9]|Level [4-7] (diploma|qualification))\b/i,
    severity: 'warning',
    message:
      'Uses a UK framework. AGU is a Utah institution; use the US or international equivalent unless the comparison is deliberate.',
    source: 'Public course pages review; Catalog v1.4',
  },
];

export interface Disclosure {
  id: string;
  text: string;
  /** Which package documents must carry it. */
  requiredIn: string[];
  source: string;
}

export const DISCLOSURES: Disclosure[] = [
  {
    id: 'registration',
    text: 'This institution is registered under the Utah Postsecondary School and State Authorization Act (Title 13, Chapter 34, Utah Code). Registration with the Utah Division of Consumer Protection is not accreditation by the State of Utah and does not constitute an endorsement or approval of this institution by the Division or the State of Utah. This institution is not accredited by an accrediting agency recognized by the United States Department of Education. It is the student’s responsibility to determine whether credits, degrees, or certificates from this institution will transfer to other institutions or meet employers’ training requirements.',
    requiredIn: ['course_specification', 'syllabus'],
    source: 'Catalog v1.4 Appendix A',
  },
  {
    id: 'programmatic_accreditation',
    text: 'No program offered by this institution holds programmatic accreditation from a recognized accrediting body.',
    requiredIn: ['course_specification', 'syllabus'],
    source: 'Catalog v1.4 §2.3',
  },
  {
    id: 'credit_qualifier',
    text: 'Credit values are subject to confirmation by the Utah Division of Consumer Protection under § 13-34-103(9).',
    requiredIn: ['course_specification', 'contact_hour_map'],
    source: 'Catalog v1.4 §4.4-4.6',
  },
  {
    id: 'draft_status',
    text: 'This is a faculty-review draft prepared with AI assistance. It is not academically, institutionally or regulatorily approved until AGU records that approval.',
    requiredIn: ['all'],
    source: 'Roadmap §2.3',
  },
];

/** Split text into sentences (and lines, which end a clause too) so a denial is read in context. */
function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\s*\n\s*/).filter(Boolean);
}

/** One wording of a sentence for comparison: quotes straightened, spacing collapsed, lower case. */
const normalised = (sentence: string): string =>
  sentence
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * The disclosure sentences as approved. The rule pack's own message says only this wording may
 * mention accreditation, and only to deny it, so an approved sentence passes as written:
 * "No program offered by this institution holds programmatic accreditation ..." denies with a
 * negation seven words from the term, which no narrow reading of a denial could accept.
 */
const APPROVED_SENTENCES = new Set(DISCLOSURES.flatMap((d) => sentencesOf(d.text).map(normalised)));

/**
 * How far back from a claim a negation still denies it, in words outside the claim itself. A
 * denial reads "is not accredited", "does not guarantee", "no guarantee that credits transfer";
 * a negation further off belongs to something else ("there is no fee for our accredited MBA" is
 * a claim). The reach is deliberately short and lexical: wording this check cannot tell from a
 * claim is flagged for faculty to reword, never excused.
 */
const DENIAL_REACH_WORDS = 4;

const NEGATIONS = new Set([
  'not',
  'no',
  'never',
  'neither',
  'nor',
  'none',
  'nothing',
  'without',
  'cannot',
  'non',
]);

/**
 * Words that start a new clause, so a negation before them no longer applies after them. "Yet"
 * is left out: in "has not yet been accredited" it is an adverb, and as a conjunction it follows
 * a comma, which already ends the clause.
 */
const CLAUSE_BREAK_WORDS = new Set([
  'and',
  'but',
  'however',
  'although',
  'though',
  'whereas',
  'while',
]);
const CLAUSE_BREAK_MARKS = /^[,;:()\u2014\u2013\u2022|]$/;

interface Token {
  text: string;
  start: number;
}

/** The words and clause marks of a text, lower-cased, with where each one starts. */
function tokensOf(text: string): Token[] {
  return [...text.matchAll(/[a-z0-9]+(?:['\u2019][a-z]+)?|[,;:()\u2014\u2013\u2022|]/gi)].map(
    (m) => ({
      text: m[0].toLowerCase(),
      start: m.index ?? 0,
    })
  );
}

const isNegation = (word: string): boolean => NEGATIONS.has(word) || /n['\u2019]t$/.test(word);

/**
 * Whether a negation denies this match. Walking back from the claim, a negation counts when it
 * is within DENIAL_REACH_WORDS words before the claim, and, for a rule whose denial may sit
 * 'within' its claim, anywhere inside the claim phrase ("credits do not transfer to any"). A
 * clause break ends the search: "no hidden fees, fully accredited" and "no fees and accredited
 * by DEAC" are claims. "Not only accredited" is an emphasis, not a denial.
 */
function isDenied(sentence: string, match: RegExpMatchArray, where: 'before' | 'within'): boolean {
  const claimStart = match.index ?? 0;
  const reachedTo = where === 'within' ? claimStart + match[0].length : claimStart;
  const tokens = tokensOf(sentence.slice(0, reachedTo));
  let outside = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const { text, start } = tokens[i];
    if (CLAUSE_BREAK_WORDS.has(text) || CLAUSE_BREAK_MARKS.test(text)) return false;
    if (start < claimStart && ++outside > DENIAL_REACH_WORDS) return false;
    if (isNegation(text) && !(text === 'not' && tokens[i + 1]?.text === 'only')) return true;
  }
  return false;
}

/** Each rule's pattern made global once, so every occurrence in a sentence can be judged. */
const GLOBAL_PATTERNS = PROHIBITED_CLAIMS.map(
  (rule) => new RegExp(rule.pattern.source, `${rule.pattern.flags.replace('g', '')}g`)
);

export interface ClaimMatch {
  ruleId: string;
  severity: 'blocking' | 'warning';
  message: string;
  source: string;
  sentence: string;
}

/**
 * Every prohibited claim in a piece of text, sentence by sentence. A rule fires once per
 * sentence, and only if at least one of its occurrences is not denied.
 */
export function findProhibitedClaims(text: string): ClaimMatch[] {
  const matches: ClaimMatch[] = [];
  for (const sentence of sentencesOf(typeof text === 'string' ? text : '')) {
    if (APPROVED_SENTENCES.has(normalised(sentence))) continue;
    PROHIBITED_CLAIMS.forEach((rule, i) => {
      const claimed = [...sentence.matchAll(GLOBAL_PATTERNS[i])].some(
        (m) => !rule.denial || !isDenied(sentence, m, rule.denial)
      );
      if (!claimed) return;
      matches.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.message,
        source: rule.source,
        sentence: sentence.trim(),
      });
    });
  }
  return matches;
}

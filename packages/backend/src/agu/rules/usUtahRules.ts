/**
 * The US / Utah rule pack for AGU course documents, version 1 (2026-09-30).
 *
 * What a generated AGU document may and may not say about the institution. AGU holds a Utah
 * Division of Consumer Protection registration, which is not accreditation or approval, and
 * the product owner's specification is explicit: "Do not call a state authorisation
 * accreditation or claim DEAC or another future accreditor already applies." A model writing
 * course material will produce these claims unprompted, so every narrative field is scanned
 * and a match blocks the draft until faculty remove it.
 *
 * Sources: AGU Catalog v1.4 §2, §2.3, §4, Appendix A; the product owner's catalogue redline
 * and compliance red-flag register; the Phase One Roadmap §3.
 */

export const RULE_PACK_VERSION = 'us-utah-1';

export interface ProhibitedClaim {
  id: string;
  pattern: RegExp;
  /** A match is allowed when the surrounding sentence also matches this (e.g. a denial). */
  allowWhen?: RegExp;
  severity: 'blocking' | 'warning';
  message: string;
  source: string;
}

const NEGATION = /\b(not|no|never|neither|nor|isn't|is not|does not|doesn't|without)\b/i;

export const PROHIBITED_CLAIMS: ProhibitedClaim[] = [
  {
    id: 'accreditation',
    pattern: /\baccredit(ed|ation|ing)?\b/i,
    allowWhen: NEGATION,
    severity: 'blocking',
    message:
      'Claims or implies accreditation. AGU is registered in Utah, not accredited; only the disclosure wording may mention accreditation, and only to deny it.',
    source: 'Catalog v1.4 §2; Roadmap §3',
  },
  {
    id: 'named_accreditor',
    pattern: /\b(DEAC|WASC|HLC|MSCHE|NECHE|SACSCOC|NWCCU|AACSB|ACBSP|IACBE)\b/,
    allowWhen: NEGATION,
    severity: 'blocking',
    message:
      'Names an accreditor. No accreditor applies to AGU; a future accreditor is not to be claimed.',
    source: 'Roadmap §3; KB Architecture',
  },
  {
    id: 'state_approval',
    pattern: /\b(approved|endorsed|recommended|licensed)\s+by\s+(the\s+)?(state|utah|division)/i,
    allowWhen: NEGATION,
    severity: 'blocking',
    message: 'Presents the Utah registration as state approval or endorsement.',
    source: 'Catalog v1.4 Appendix A; DCP certificate',
  },
  {
    id: 'transfer_guarantee',
    pattern:
      /\b(credits?|degree|certificate)s?\b[^.]{0,60}\b(transfer|recogni[sz]ed)\b[^.]{0,40}\b(guarantee|automatic|all|any)\b/i,
    allowWhen: NEGATION,
    severity: 'blocking',
    message:
      'Promises credit transfer or recognition, which the catalogue leaves to the receiving institution.',
    source: 'Catalog v1.4 Appendix A',
  },
  {
    id: 'placement_or_earnings',
    pattern:
      /\b(guarantee[sd]?|assured)\b[^.]{0,50}\b(job|employment|placement|promotion|salary|earnings)\b/i,
    allowWhen: NEGATION,
    severity: 'blocking',
    message: 'Promises employment, placement or earnings outcomes.',
    source: 'Product owner compliance register; Catalog v1.4 §12',
  },
  {
    id: 'licensure',
    pattern:
      /\b(leads? to|qualif(y|ies) (you|students|graduates) for|prepares? (you|students) for)\b[^.]{0,40}\blicen[cs](e|ure)\b/i,
    allowWhen: NEGATION,
    severity: 'blocking',
    message:
      'Implies the course leads to professional licensure; the catalogue states no programme does.',
    source: 'Catalog v1.4 §4',
  },
  {
    id: 'vendor_certification',
    pattern: /\b(earn|obtain|awarded|receive)\b[^.]{0,40}\b(certification|certified)\b/i,
    allowWhen: NEGATION,
    severity: 'warning',
    message:
      'May imply a vendor or professional certification. Name any external exam only with the vendor-certification disclaimer.',
    source: 'Catalog v1.4 §12',
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

/** Split text into sentences so a denial can be read in context. */
function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

export interface ClaimMatch {
  ruleId: string;
  severity: 'blocking' | 'warning';
  message: string;
  source: string;
  sentence: string;
}

/** Every prohibited claim in a piece of text, sentence by sentence. */
export function findProhibitedClaims(text: string): ClaimMatch[] {
  const matches: ClaimMatch[] = [];
  for (const sentence of sentencesOf(text || '')) {
    for (const rule of PROHIBITED_CLAIMS) {
      if (!rule.pattern.test(sentence)) continue;
      if (rule.allowWhen && rule.allowWhen.test(sentence)) continue;
      matches.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.message,
        source: rule.source,
        sentence: sentence.trim(),
      });
    }
  }
  return matches;
}

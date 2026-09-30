/**
 * How an export heads Step 1's entry requirements.
 *
 * Step 1 generates admission, English-language, recognition-of-prior-learning and
 * credit-transfer text that no institution has supplied or approved. Under a plain "Entry
 * Requirements" heading it reads as the institution's policy, which the 21 Sep 2026 review
 * recorded as unauthorised claims. Every export therefore labels it a proposal unless the
 * stored origin says the institution supplied it. Nothing records that origin yet, so for now
 * every export labels it a proposal.
 *
 * One helper, because the main export was fixed and the course specification export kept
 * printing the same text as settled fact.
 */

export const ENTRY_REQUIREMENTS_PROPOSAL_NOTE =
  'Proposed for institutional approval. Entry, English-language, recognition of prior ' +
  'learning and credit-transfer rules are set by the institution; nothing in this section is ' +
  'institutional policy until it is approved.';

export interface EntryRequirementsLabel {
  heading: string;
  /** Printed beneath the heading; absent only for text the institution supplied. */
  note?: string;
}

export function entryRequirementsLabel(
  step1: { entryRequirementsOrigin?: string } | undefined | null
): EntryRequirementsLabel {
  if (step1?.entryRequirementsOrigin === 'institution') {
    return { heading: 'Entry Requirements' };
  }
  return { heading: 'Entry Requirements (Proposal)', note: ENTRY_REQUIREMENTS_PROPOSAL_NOTE };
}

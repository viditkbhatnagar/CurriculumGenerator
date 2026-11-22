/**
 * Logan Pacey's 21 November 2026 re-test of Step 5: the 2012 textbook, the Compliant badge
 * under the fast-moving flag, and the OpenAlex allowance.
 */
import { sourceCurrency, withRecencyNotes } from '../services/sourceRecency';
import { moduleVerdict } from '../services/moduleCompliance';
import { lookupCacheKey } from '../services/academicLookupCache';

const YEAR = 2026;
const book = (year: number, extra = {}) => ({
  id: 'lib-M1-1',
  moduleId: 'm1',
  category: 'academic_textbook',
  year,
  ...extra,
});
const journal = (year: number, extra = {}) => ({
  id: 'src-1',
  moduleId: 'm1',
  category: 'peer_reviewed_journal',
  year,
  ...extra,
});

describe('a latest-edition textbook over ten years old', () => {
  it('is not current and carries its own warning', () => {
    const verdict = sourceCurrency(book(2012), YEAR);
    expect(verdict.current).toBe(false);
    expect(verdict.warning).toBe('Over 10 years old (2012): give a reason to keep it');
  });
  it('shows the warning on the source, not a latest-edition note', () => {
    const [s] = withRecencyNotes([book(2012)], [{ id: 'm1' }], YEAR);
    expect(s.recencyWarning).toMatch(/Over 10 years old \(2012\)/);
    expect(s.recencyNote).toBeUndefined();
  });
  it('still counts a 2017 latest edition as current, with a note and no warning', () => {
    const verdict = sourceCurrency(book(2017), YEAR);
    expect(verdict).toEqual({ current: true, note: 'latest edition (2017)' });
  });
  it('gives no warning to a superseded edition or a justified seminal work', () => {
    expect(sourceCurrency(book(2012, { isLatestEdition: false }), YEAR).warning).toBeUndefined();
    const seminal = book(2012, {
      isSeminal: true,
      seminalJustification: 'foundational',
      pairedRecentSourceId: 'x',
    });
    expect(sourceCurrency(seminal, YEAR).current).toBe(true);
  });
});

describe('module card verdict', () => {
  const fast = { id: 'm1', title: 'Data analytics for logistics' };
  const slow = { id: 'm1', title: 'Warehousing' };
  const applied = { id: 'a', moduleId: 'm1', category: 'industry_report', year: 2025 };

  it('is not Compliant on a fast-moving module with a textbook older than five years', () => {
    const v = moduleVerdict({
      module: fast,
      sources: [book(2020), journal(2025), applied],
      currentYear: YEAR,
      mixOk: true,
    });
    expect(v.agiCompliant).toBe(false);
    expect(v.fastMovingRuleMet).toBe(false);
    expect(v.recencyIssues.join(' ')).toMatch(/fast-moving/);
  });
  it('is Compliant, and says the stricter rule was met, when every source is recent', () => {
    const v = moduleVerdict({
      module: fast,
      sources: [book(2025), journal(2024), applied],
      currentYear: YEAR,
      mixOk: true,
    });
    expect(v).toEqual({ agiCompliant: true, fastMovingRuleMet: true, recencyIssues: [] });
  });
  it('lets a slow module keep a 2020 latest-edition textbook', () => {
    const v = moduleVerdict({
      module: slow,
      sources: [book(2020), journal(2025)],
      currentYear: YEAR,
      mixOk: true,
    });
    expect(v.agiCompliant).toBe(true);
    expect(v.fastMovingRuleMet).toBe(false);
  });
  it('stays not Compliant when the mix test failed', () => {
    const v = moduleVerdict({
      module: slow,
      sources: [journal(2025)],
      currentYear: YEAR,
      mixOk: false,
    });
    expect(v.agiCompliant).toBe(false);
  });
});

describe('academic lookup cache key', () => {
  it('ignores the contact and the API key so changing them keeps the cache', () => {
    const a = 'https://api.openalex.org/works?search=x&per-page=50&mailto=a@b.c';
    const b = 'https://api.openalex.org/works?search=x&per-page=50&mailto=other@b.c&api_key=K';
    expect(lookupCacheKey(a)).toBe(lookupCacheKey(b));
    expect(lookupCacheKey(a)).toBe('https://api.openalex.org/works?search=x&per-page=50');
  });
  it('keeps different queries apart', () => {
    expect(lookupCacheKey('https://x/works?search=a&mailto=m')).not.toBe(
      lookupCacheKey('https://x/works?search=b&mailto=m')
    );
  });
});

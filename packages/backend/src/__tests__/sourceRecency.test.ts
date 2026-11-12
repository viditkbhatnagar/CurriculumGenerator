import {
  isFastMovingModule,
  moduleRecencyProblems,
  sourceCurrency,
  withRecencyNotes,
} from '../services/sourceRecency';
import { sourceCompliant, step5ValidationReport } from '../services/step5Validation';
import { booksWithNewerEdition } from '../knowledge/latestEdition';

const YEAR = 2026;
const book = (year: number, extra = {}) => ({
  id: 'lib-M1-1',
  moduleId: 'm1',
  category: 'academic_textbook',
  year,
  ...extra,
});

describe('isFastMovingModule', () => {
  it('counts data tools, analytics and AI', () => {
    expect(
      isFastMovingModule({ title: 'Business Analytics Foundations and Responsible Data Handling' })
    ).toBe(true);
    expect(isFastMovingModule({ title: 'Applied AI for Managers' })).toBe(true);
    expect(isFastMovingModule({ title: 'Ops', topics: [{ title: 'Regulatory change' }] })).toBe(
      true
    );
    expect(isFastMovingModule({ title: 'Digital Marketing' })).toBe(true);
  });
  it('does not count general business modules', () => {
    expect(isFastMovingModule({ title: 'Marketing Principles' })).toBe(false);
    expect(
      isFastMovingModule({ title: 'Entrepreneurship', description: 'Using data to test an idea' })
    ).toBe(false);
    expect(isFastMovingModule({ title: 'Maintain the plant' })).toBe(false);
  });
});

describe('sourceCurrency', () => {
  it('passes a 2020 textbook in a non-fast module with a note', () => {
    expect(sourceCurrency(book(2020), YEAR)).toEqual({
      current: true,
      note: 'latest edition (2020)',
    });
  });
  it('needs a reason for a 2014 textbook', () => {
    expect(sourceCurrency(book(2014), YEAR).current).toBe(false);
  });
  it('fails a 2019 journal', () => {
    expect(sourceCurrency({ category: 'peer_reviewed_journal', year: 2019 }, YEAR).current).toBe(
      false
    );
  });
  it('fails an older textbook when a newer edition is held', () => {
    expect(sourceCurrency(book(2020, { isLatestEdition: false }), YEAR).current).toBe(false);
  });
  it('does not establish a model-written textbook as the latest edition', () => {
    expect(
      sourceCurrency({ id: 'x', category: 'academic_textbook', year: 2020 }, YEAR).current
    ).toBe(false);
  });
  it('withholds the exception in a fast-moving module', () => {
    expect(sourceCurrency(book(2020), YEAR, { fastMoving: true }).current).toBe(false);
  });
  it('keeps the seminal exemption', () => {
    const s = {
      category: 'peer_reviewed_journal',
      year: 1990,
      isSeminal: true,
      seminalJustification: 'founding paper',
      pairedRecentSourceId: 'b',
    };
    expect(sourceCurrency(s, YEAR).current).toBe(true);
  });
});

describe('moduleRecencyProblems', () => {
  const mod = { id: 'm1', title: 'Marketing Principles' };
  it('flags a module with no source from the last five years', () => {
    const p = moduleRecencyProblems([book(2020)], [mod], YEAR);
    expect(p.map((x) => x.kind)).toEqual(['no_recent_source']);
  });
  it('lets an applied source from the last five years satisfy the module', () => {
    const s = [book(2020), { id: 'a', moduleId: 'm1', category: 'industry_report', year: 2024 }];
    expect(moduleRecencyProblems(s, [mod], YEAR)).toEqual([]);
  });
  it('flags a fast-moving module whose only textbook is 2020', () => {
    const fast = { id: 'm1', title: 'Business Analytics' };
    const s = [book(2020), { id: 'a', moduleId: 'm1', category: 'industry_report', year: 2025 }];
    expect(moduleRecencyProblems(s, [fast], YEAR).map((x) => x.kind)).toEqual([
      'fast_moving_no_recent_textbook',
    ]);
  });
});

describe('wiring', () => {
  it('sourceCompliant accepts a latest-edition textbook and Step 5 reports it', () => {
    const s = {
      ...book(2020),
      title: 'Entrepreneurship',
      authors: ['A'],
      citation: 'c',
      accessStatus: 'free_full_text',
    };
    expect(sourceCompliant(s, YEAR)).toBe(true);
    expect(sourceCompliant(s, YEAR, true)).toBe(false);
    expect(withRecencyNotes([s], [{ id: 'm1' }], YEAR)[0].recencyNote).toBe(
      'latest edition (2020)'
    );
    const report = step5ValidationReport([s], [{ id: 'm1', title: 'Entrepreneurship' }], YEAR);
    expect(report.recencyCompliance).toBe(true);
    expect(report.moduleRecency).toBe(false);
  });
  it('finds a superseded edition by work key', () => {
    const held = [
      { _id: 'a', workKey: 'k', year: 2018 },
      { _id: 'b', workKey: 'k', year: 2023 },
    ];
    expect([...booksWithNewerEdition([held[0], held[1]], held)]).toEqual(['a']);
  });
});

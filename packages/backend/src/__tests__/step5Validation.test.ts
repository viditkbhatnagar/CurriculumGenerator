import {
  step5ValidationReport,
  step5Compliant,
  topicsBelowSourceFloor,
  sourceCompliant,
} from '../services/step5Validation';

const YEAR = 2026;
const modules = [
  { id: 'm1', mlos: [{ id: 'm1-1' }, { id: 'm1-2' }], topics: ['Planning', { title: 'Control' }] },
  { id: 'm2', mlos: [{ id: 'm2-1' }], topics: ['Markets'] },
];
/** Sources matched to weekly topics, as linkSourcesToTopics leaves them. */
const onTopics = (s: any, topics: string[]) => ({
  ...s,
  linkedTopics: topics,
  topicScores: Object.fromEntries(topics.map((t) => [t, 0.6])),
});
const source = (moduleId: string, linkedMLOs: string[], extra: any = {}) => ({
  moduleId,
  linkedMLOs,
  category: 'peer_reviewed_journal',
  type: 'academic',
  year: 2024,
  citation: 'A. Author (2024). Title.',
  authors: ['A. Author'],
  title: 'Title',
  accessStatus: 'free_full_text',
  ...extra,
});
const wellSourced = [
  source('m1', ['m1-1', 'm1-2']),
  source('m1', ['m1-1', 'm1-2'], { type: 'applied', category: 'professional_body' }),
  source('m2', ['m2-1']),
  source('m2', ['m2-1'], { type: 'applied', category: 'professional_body' }),
];

describe('step5ValidationReport', () => {
  it('passes nothing when there are no sources', () => {
    const report = step5ValidationReport([], modules, YEAR);
    const passed = Object.entries(report).filter(([, v]) => v === true);
    expect(passed).toEqual([]);
  });

  it('does not check two sources per weekly topic until sources are matched to topics', () => {
    expect(step5ValidationReport(wellSourced, modules, YEAR).minimumSourcesPerTopic).toBeNull();
  });

  it('passes two sources per weekly topic, and fails a topic with fewer', () => {
    const covered = [
      onTopics(wellSourced[0], ['Planning', 'Control']),
      onTopics(wellSourced[1], ['Planning', 'Control']),
      onTopics(wellSourced[2], ['Markets']),
      onTopics(wellSourced[3], ['Markets']),
    ];
    expect(step5ValidationReport(covered, modules, YEAR).minimumSourcesPerTopic).toBe(true);
    const thin = [covered[0], covered[1], covered[2], onTopics(wellSourced[3], [])];
    expect(step5ValidationReport(thin, modules, YEAR).minimumSourcesPerTopic).toBe(false);
  });

  it('fails traceability when a source is linked to no outcome', () => {
    const orphan = [...wellSourced, source('m1', [])];
    expect(step5ValidationReport(orphan, modules, YEAR).traceabilityComplete).toBe(false);
  });

  it('fails traceability when an outcome has no source', () => {
    const missing = wellSourced.filter((s) => s.moduleId !== 'm2');
    expect(step5ValidationReport(missing, modules, YEAR).traceabilityComplete).toBe(false);
  });

  it('does not claim to have checked APA formatting', () => {
    expect(step5ValidationReport(wellSourced, modules, YEAR).apaAccuracy).toBeNull();
  });

  it('fails every-outcome-supported for a module that declares no outcomes', () => {
    const report = step5ValidationReport(wellSourced, [...modules, { id: 'm3', mlos: [] }], YEAR);
    expect(report.everyMLOSupported).toBe(false);
  });
});

describe('step5Compliant', () => {
  it('ignores checks that were not run but requires every other one to pass', () => {
    const report = step5ValidationReport(wellSourced, modules, YEAR);
    expect(step5Compliant(report)).toBe(true);
    expect(step5Compliant({ ...report, freeAccessRatio: false })).toBe(false);
  });
});

describe('topicsBelowSourceFloor', () => {
  it('names each weekly topic short of two sources, with its count', () => {
    const sources = [
      onTopics(source('m1', []), ['Planning']),
      onTopics(source('m1', []), ['Planning']),
      onTopics(source('m2', []), ['Markets']),
    ];
    expect(topicsBelowSourceFloor(sources, modules)).toEqual([
      { moduleId: 'm1', topic: 'Control', count: 0 },
      { moduleId: 'm2', topic: 'Markets', count: 1 },
    ]);
  });
});

describe('sourceCompliant', () => {
  it('passes a recent source from an approved category with a full citation', () => {
    expect(sourceCompliant(source('m1', []), YEAR)).toBe(true);
  });

  it('fails an old source unless it is a justified seminal work paired with a recent one', () => {
    expect(sourceCompliant(source('m1', [], { year: 2010 }), YEAR)).toBe(false);
    const seminal = { year: 2010, isSeminal: true, seminalJustification: 'Founding text' };
    expect(sourceCompliant(source('m1', [], seminal), YEAR)).toBe(false);
    expect(
      sourceCompliant(source('m1', [], { ...seminal, pairedRecentSourceId: 's2' }), YEAR)
    ).toBe(true);
  });

  it('fails an unapproved category, a missing author, and a rejected source', () => {
    expect(sourceCompliant(source('m1', [], { category: 'blog' }), YEAR)).toBe(false);
    expect(sourceCompliant(source('m1', [], { authors: [] }), YEAR)).toBe(false);
    expect(sourceCompliant(source('m1', [], { accessStatus: 'rejected' }), YEAR)).toBe(false);
  });

  it('does not pass a source an author added by hand until it is reviewed', () => {
    expect(sourceCompliant(source('m1', [], { userAdded: true }), YEAR)).toBe(false);
  });
});

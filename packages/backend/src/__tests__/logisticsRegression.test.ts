/**
 * Regression fixture: the Diploma in Logistics and Supply Chain Management that the product
 * owner tested end to end on 21 Sep 2026.
 *
 * That test found validation reporting success where the data showed absence: case studies and
 * assessments "integrated" above counts of zero, sources "traced" with an outcome that had
 * none, 79 topics printed as "Untitled topic", and Step 8 approved with no case studies. Each
 * assertion here is one of those findings, and must keep failing validation.
 */
import fixture from './fixtures/logistics-2026-09-21.json';
import { validationFromStubs, validationFromPlans } from '../services/step10Completion';
import { step5ValidationReport, step5Compliant } from '../services/step5Validation';
import { step8ApprovalBlocker } from '../services/step8Approval';
import { topicTitle } from '../utils/topicShape';

const modules = fixture.step4.modules as any[];

describe('Logistics regression (21 Sep 2026)', () => {
  it('stored six constant passes for Step 10, the defect this fixture preserves', () => {
    expect(Object.values(fixture.step10.validation as object)).toEqual(Array(6).fill(true));
  });

  it('reports no case studies or assessments integrated into its 120 lessons', () => {
    const lessons = fixture.moduleLessonPlans.reduce((n, p) => n + p.lessons.length, 0);
    expect(lessons).toBe(120);
    const v = validationFromPlans(modules, fixture.moduleLessonPlans as any);
    expect(v.caseStudiesIntegrated).toBe(false);
    expect(v.assessmentsIntegrated).toBe(false);
    expect(validationFromStubs(modules, fixture.step10 as any).caseStudiesIntegrated).toBe(false);
  });

  it('fails minimum sources and traceability for its 71 sources', () => {
    expect(fixture.step5.sources).toHaveLength(71);
    const report = step5ValidationReport(fixture.step5.sources as any, modules, 2026);
    expect(report.minimumSourcesPerTopic).toBe(false);
    expect(report.traceabilityComplete).toBe(false);
    expect(report.everyMLOSupported).toBe(false);
    expect(report.apaAccuracy).toBeNull();
    expect(step5Compliant(report)).toBe(false);
  });

  it('refuses to approve Step 8 with zero case studies', () => {
    expect(fixture.step8.caseStudies).toHaveLength(0);
    expect(step8ApprovalBlocker(fixture.step8, false)?.code).toBe('NO_CASE_STUDIES');
  });

  it('gives every one of its 79 topics a name', () => {
    const topics = modules.flatMap((m) => m.topics || []);
    expect(topics).toHaveLength(79);
    expect(topics.filter((t) => !topicTitle(t))).toHaveLength(0);
  });

  it('keeps its independent hours readable', () => {
    for (const m of modules) expect(m.selfStudyHours ?? m.independentHours).toBeGreaterThan(0);
  });
});

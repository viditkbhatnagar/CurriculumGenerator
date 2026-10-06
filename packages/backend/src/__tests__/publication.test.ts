import { publicationProblem } from '../services/publication';

const finished = (status = 'step13_complete') => ({
  status,
  currentStep: 13,
  stepProgress: [{ step: 12, status: 'approved' }],
  step12: { approvedAt: new Date(), moduleAssignmentPacks: [{ moduleId: 'm1' }] },
  step13: { sectionA: [] },
});

describe('publicationProblem', () => {
  it('lets the author submit a finished curriculum', () => {
    expect(publicationProblem(finished(), 'submit', 'faculty')).toBeNull();
  });

  it('refuses to submit an unfinished or already published curriculum', () => {
    const unfinished = { ...finished(), step13: undefined };
    expect(publicationProblem(unfinished, 'submit', 'faculty')).toMatch(/All 13 steps/);
    expect(publicationProblem(finished('published'), 'submit', 'administrator')).toMatch(/already/);
  });

  it('lets only the super admin publish or return, and only a submitted curriculum', () => {
    const submitted = finished('review_pending');
    expect(publicationProblem(submitted, 'publish', 'administrator')).toBeNull();
    expect(publicationProblem(submitted, 'return', 'administrator')).toBeNull();
    expect(publicationProblem(submitted, 'publish', 'faculty')).toMatch(/super admin/);
    expect(publicationProblem(finished(), 'publish', 'administrator')).toMatch(
      /not been submitted/
    );
  });
});

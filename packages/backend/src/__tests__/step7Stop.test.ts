/**
 * A stop ends a Step 7 run; it is not one module's failure to retry and record.
 *
 * The module pool retries a failed module once and then records it in `failedModules` and
 * carries on. A stop raised inside it must escape both, or the run would keep going and
 * report the stopped modules as failures.
 */
import { AssessmentGeneratorService } from '../services/assessmentGeneratorService';
import { StepStopped } from '../services/stepStop';

jest.mock('../services/openaiService', () => ({ openaiService: {} }));

const modules = ['M1', 'M2', 'M3'].map((id) => ({
  id,
  title: `Module ${id}`,
  learningOutcomes: [{ id: `${id}-LO1`, statement: 'Evaluate options', bloomLevel: 'evaluate' }],
}));

function harness(stopOnCall: number) {
  const service = new AssessmentGeneratorService();
  const generated = jest
    .spyOn(service as any, 'generateOneFormative')
    .mockImplementation(async () => [{ id: 'a', purpose: 'module_summative', graded: true }]);
  jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);
  let calls = 0;
  const checkpoint = async () => {
    calls += 1;
    if (calls >= stopOnCall) throw new StepStopped('Step 7 was stopped on request.');
  };
  const request = {
    modules,
    userPreferences: {
      formativePerModule: 2,
      formativeTypesPerUnit: ['Case analysis', 'Short quizzes'],
      assessmentStructure: 'both_formative_and_summative',
    },
    checkpoint,
  };
  const run = () => (service as any).generateFormativeAssessments(request);
  return { service, generated, run };
}

describe('stopping Step 7', () => {
  it('ends the formative stage with the stop, recording no module as failed', async () => {
    const { service, generated, run } = harness(2);
    await expect(run()).rejects.toThrow('stopped on request');
    expect(service.failedModules).toEqual([]);
    expect(generated.mock.calls.length).toBeLessThan(modules.length * 2);
  });

  it('runs every module when no stop comes', async () => {
    const { service, run } = harness(Number.POSITIVE_INFINITY);
    const formatives = await run();
    expect(formatives.length).toBeGreaterThanOrEqual(modules.length);
    expect(service.failedModules).toEqual([]);
  });
});

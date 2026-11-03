/**
 * MCQ samples are three calls of ten, each retried once, and a batch that still fails is
 * recorded on the service rather than swallowed (Logan Pacey, 2 November 2026: no MCQ sample).
 */
import { AssessmentGeneratorService } from '../services/assessmentGeneratorService';

jest.mock('../services/openaiService', () => ({ openaiService: {} }));

function harness(impl: (type: string, count: number, call: number) => any[]) {
  const service = new AssessmentGeneratorService();
  let call = 0;
  const spy = jest
    .spyOn(service as any, 'generateSampleQuestionsByType')
    .mockImplementation(async (_r: any, type: any, count: any) => impl(type, count, ++call));
  jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);
  const run = (type: string, count: number) =>
    (service as any).generateSampleBatches({}, type, count) as Promise<any[]>;
  return { service, spy, run };
}
const items = (n: number) => Array.from({ length: n }, (_, i) => ({ stem: `q${i}` }));

describe('sample batching', () => {
  it('asks for 30 MCQs as three batches of ten', async () => {
    const { spy, run, service } = harness((_t, n) => items(n));
    expect(await run('mcq', 30)).toHaveLength(30);
    expect(spy.mock.calls.map((c) => c[2])).toEqual([10, 10, 10]);
    expect(service.sampleFailures).toEqual([]);
  });

  it('retries a failed batch once and keeps the result', async () => {
    const { spy, run, service } = harness((_t, n, call) => {
      if (call === 2) throw new Error('timeout');
      return items(n);
    });
    expect(await run('mcq', 30)).toHaveLength(30);
    expect(spy).toHaveBeenCalledTimes(4);
    expect(service.sampleFailures).toEqual([]);
  });

  it('records a batch that fails twice and keeps the others', async () => {
    const { run, service } = harness((_t, n, call) => {
      if (call === 2 || call === 3) throw new Error('bad json');
      return items(n);
    });
    expect(await run('mcq', 30)).toHaveLength(20);
    expect(service.sampleFailures).toEqual([{ type: 'mcq', message: 'batch 2 of 3: bad json' }]);
  });

  it('runs other types as one call', async () => {
    const { spy, run } = harness((_t, n) => items(n));
    await run('sjt', 10);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

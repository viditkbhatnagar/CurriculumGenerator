/**
 * A cut-off exam section is asked for again with twice the budget, instead of failing the exam
 * (Applied Fashion Design's Section B, 8 October 2026).
 */
jest.mock('../services/openaiService', () => ({
  openaiService: { generateContent: jest.fn() },
}));

import { openaiService } from '../services/openaiService';
import { summativeExamService } from '../services/summativeExamService';

const generate = openaiService.generateContent as jest.Mock;
const section = (phase: string, maxTokens: number) =>
  (summativeExamService as any).generateSectionJSON(phase, 'prompt', 'system', maxTokens);

beforeEach(() => generate.mockReset());

describe('exam sections cut off at the token budget', () => {
  it('asks again with twice the budget when the answer is cut off mid-string', async () => {
    generate
      .mockResolvedValueOnce('{"sectionB": [{"scenarioId": "B1", "scenarioText": "A buyer at')
      .mockResolvedValueOnce('{"sectionB": [{"scenarioId": "B1"}]}');
    await expect(section('SectionB', 24000)).resolves.toEqual({
      sectionB: [{ scenarioId: 'B1' }],
    });
    expect(generate.mock.calls.map((c) => c[2].maxTokens)).toEqual([24000, 48000]);
  });

  it('asks again when reasoning used the whole budget and no answer came back', async () => {
    generate
      .mockRejectedValueOnce(new Error('No content generated from OpenAI'))
      .mockResolvedValueOnce('{"sectionC": []}');
    await expect(section('SectionC', 24000)).resolves.toEqual({ sectionC: [] });
  });

  it('asks only once more, and does not retry other failures', async () => {
    generate.mockResolvedValue('{"sectionB": [{"scenarioText": "cut');
    await expect(section('SectionB', 24000)).rejects.toThrow('invalid JSON');
    expect(generate).toHaveBeenCalledTimes(2);

    generate.mockReset();
    generate.mockRejectedValueOnce(new Error('Circuit breaker is OPEN'));
    await expect(section('SectionB', 24000)).rejects.toThrow('Circuit breaker');
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

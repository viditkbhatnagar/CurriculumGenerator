import { captureAndStop, capturePrompts, inPromptCapture } from '../services/promptCapture';

describe('promptCapture', () => {
  it('records what a step would send and stops it before it is sent', async () => {
    let sent = false;
    const { prompts, error } = await capturePrompts(async () => {
      captureAndStop({ label: 'step1', model: 'gpt-5', systemPrompt: 'sys', userPrompt: 'user' });
      sent = true;
    });
    expect(sent).toBe(false);
    expect(error).toBeUndefined();
    expect(prompts).toEqual([
      expect.objectContaining({
        label: 'step1',
        systemPrompt: 'sys',
        userPrompt: 'user',
        characters: 7,
      }),
    ]);
  });

  it('keeps calls that catch the stop and retry from recording past the limit', async () => {
    const { prompts } = await capturePrompts(async () => {
      for (let i = 0; i < 5; i++) {
        try {
          captureAndStop({ label: `try ${i}`, model: 'gpt-5', userPrompt: 'u' });
        } catch {
          // a step's own retry
        }
      }
    }, 2);
    expect(prompts.map((p) => p.label)).toEqual(['try 0', 'try 1']);
  });

  it('reports an error that stopped the step before its call', async () => {
    const result = await capturePrompts(async () => {
      throw new Error('Step 4 has no modules');
    });
    expect(result).toEqual({ prompts: [], error: 'Step 4 has no modules' });
  });

  it('is off outside a capture, so normal generation is untouched', async () => {
    expect(inPromptCapture()).toBe(false);
    let inside = false;
    await capturePrompts(async () => {
      inside = inPromptCapture();
    });
    expect(inside).toBe(true);
    expect(inPromptCapture()).toBe(false);
  });
});

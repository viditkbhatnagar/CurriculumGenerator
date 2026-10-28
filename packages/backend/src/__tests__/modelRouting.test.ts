import {
  azureBaseURL,
  deploymentFor,
  isReasoningModel,
  modelForStep,
} from '../services/modelRouting';

const azure = {
  chat: 'gpt-5.4',
  embedding: 'text-embedding-3-large',
  available: ['gpt-5.4', 'text-embedding-3-large', 'text-embedding-3-small'],
};

describe('deploymentFor', () => {
  it('passes names through when not on Azure', () => {
    expect(deploymentFor('gpt-4o', null)).toBe('gpt-4o');
  });

  it('keeps a request for a deployment the resource has', () => {
    expect(deploymentFor('gpt-5.4', azure)).toBe('gpt-5.4');
    expect(deploymentFor('text-embedding-3-small', azure)).toBe('text-embedding-3-small');
  });

  it('sends other chat models to the chat deployment', () => {
    expect(deploymentFor('gpt-4o', azure)).toBe('gpt-5.4');
    expect(deploymentFor('gpt-5', azure)).toBe('gpt-5.4');
  });

  it('sends a mini request to a mini deployment when there is one, else to the chat one', () => {
    expect(deploymentFor('gpt-5-mini', azure)).toBe('gpt-5.4');
    expect(
      deploymentFor('gpt-5-mini', { ...azure, available: [...azure.available, 'gpt-5.4-mini'] })
    ).toBe('gpt-5.4-mini');
  });

  it('sends an unknown embedding model to the embedding deployment', () => {
    expect(deploymentFor('text-embedding-ada-002', azure)).toBe('text-embedding-3-large');
  });
});

describe('azureBaseURL', () => {
  it('ends the endpoint in /openai/v1 whatever form it was given in', () => {
    expect(azureBaseURL('https://x.cognitiveservices.azure.com/openai/v1/')).toBe(
      'https://x.cognitiveservices.azure.com/openai/v1'
    );
    expect(azureBaseURL('https://x.openai.azure.com/')).toBe(
      'https://x.openai.azure.com/openai/v1'
    );
  });
});

describe('isReasoningModel', () => {
  it('knows GPT-5 and later, Sol and Luna included, and the o-series', () => {
    for (const m of [
      'gpt-5',
      'gpt-5.4',
      'gpt-5-mini',
      'gpt-6-sol',
      'gpt-6.1-sol',
      'gpt-6-luna',
      'o3',
    ]) {
      expect(isReasoningModel(m)).toBe(true);
    }
  });

  it('leaves gpt-4o and gpt-4 to max_tokens', () => {
    expect(isReasoningModel('gpt-4o')).toBe(false);
    expect(isReasoningModel('gpt-4-turbo')).toBe(false);
  });
});

describe('modelForStep', () => {
  const fast = { model: 'gpt-6-luna', steps: ['6', '9', '11', 'knowledge-library'] };

  it('sends a fast step to the fast model', () => {
    expect(modelForStep('gpt-5', 11, fast)).toBe('gpt-6-luna');
    expect(modelForStep('gpt-5-mini', 'knowledge-library', fast)).toBe('gpt-6-luna');
  });

  it('keeps design steps and lesson plans on the model asked for', () => {
    expect(modelForStep('gpt-6.1-sol', 4, fast)).toBe('gpt-6.1-sol');
    expect(modelForStep('gpt-6.1-sol', 10, fast)).toBe('gpt-6.1-sol');
  });

  it('changes nothing when no fast model is set or the call is outside a step', () => {
    expect(modelForStep('gpt-5', 11, { steps: fast.steps })).toBe('gpt-5');
    expect(modelForStep('gpt-5', undefined, fast)).toBe('gpt-5');
  });
});

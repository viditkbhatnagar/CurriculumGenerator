import { azureBaseURL, deploymentFor } from '../services/modelRouting';

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

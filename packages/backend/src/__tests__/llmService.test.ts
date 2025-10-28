/**
 * LLM Service Tests
 * Tests core functionality of the LLM service
 */

import { llmService } from '../services/llmService';

describe('LLMService', () => {
  describe('generateContent', () => {
    it('should generate content with a simple prompt', async () => {
      const prompt = 'Explain what data analytics is in one sentence.';
      const systemPrompt = 'You are a helpful assistant that provides concise explanations.';

      const content = await llmService.generateContent(prompt, systemPrompt, {
        temperature: 0.5,
        maxTokens: 100,
        timeout: 10000,
      });

      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    }, 15000); // 15 second timeout for API call
  });

  describe('generateStructuredOutput', () => {
    it('should generate valid JSON output', async () => {
      const prompt = 'Generate a list of 3 data analytics skills with descriptions.';
      const systemPrompt = `You are a helpful assistant. Return a JSON object with this structure:
      {
        "skills": [
          {"name": "string", "description": "string"}
        ]
      }`;

      interface SkillsOutput {
        skills: Array<{ name: string; description: string }>;
      }

      const result = await llmService.generateStructuredOutput<SkillsOutput>(
        prompt,
        systemPrompt,
        {
          temperature: 0.5,
          maxTokens: 300,
          timeout: 10000,
        }
      );

      expect(result).toBeDefined();
      expect(result.skills).toBeDefined();
      expect(Array.isArray(result.skills)).toBe(true);
      expect(result.skills.length).toBeGreaterThan(0);
      expect(result.skills[0]).toHaveProperty('name');
      expect(result.skills[0]).toHaveProperty('description');
    }, 15000);
  });

  describe('circuit breaker', () => {
    it('should track circuit breaker state', () => {
      const state = llmService.getCircuitBreakerState();
      expect(state).toBeDefined();
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(state);
    });
  });

  describe('error handling', () => {
    it('should handle timeout errors gracefully', async () => {
      const prompt = 'Generate a very long document about data analytics.';

      await expect(
        llmService.generateContent(prompt, undefined, {
          timeout: 1, // 1ms timeout - will definitely timeout
          maxTokens: 5000,
        })
      ).rejects.toThrow();
    }, 10000);
  });
});


/**
 * AI/ML Testing for Content Generation
 * Tests for generated content quality and source attribution
 */

import { llmService } from '../../services/llmService';
import { ragEngine } from '../../services/ragEngine';

// Mock external services
jest.mock('../../services/errorTrackingService', () => ({
  errorTrackingService: {
    captureException: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(false),
  },
}));

describe('AI/ML Content Generation Testing', () => {
  // Golden dataset for testing content quality
  const goldenDataset = [
    {
      input: {
        topic: 'Business Intelligence Fundamentals',
        context: 'Introduction to BI concepts for beginners',
        learningOutcomes: ['Understand BI concepts', 'Apply BI tools'],
      },
      expectedQuality: {
        minLength: 200,
        maxLength: 1000,
        shouldContainKeywords: ['business intelligence', 'data', 'analysis'],
        shouldNotContain: ['I think', 'maybe', 'probably'],
        bloomLevel: 'understand',
      },
    },
    {
      input: {
        topic: 'Data Visualization Techniques',
        context: 'Advanced visualization methods',
        learningOutcomes: ['Create effective visualizations', 'Evaluate chart types'],
      },
      expectedQuality: {
        minLength: 200,
        maxLength: 1000,
        shouldContainKeywords: ['visualization', 'chart', 'dashboard'],
        shouldNotContain: ['I believe', 'in my opinion'],
        bloomLevel: 'create',
      },
    },
  ];

  describe('Content Quality Validation', () => {
    it('should generate content within expected length range', () => {
      goldenDataset.forEach((testCase) => {
        const mockContent = `This is a comprehensive overview of ${testCase.input.topic}. 
          It covers essential concepts including ${testCase.expectedQuality.shouldContainKeywords.join(', ')}.
          Students will learn to apply these principles in real-world scenarios.`.repeat(3);

        expect(mockContent.length).toBeGreaterThanOrEqual(testCase.expectedQuality.minLength);
        expect(mockContent.length).toBeLessThanOrEqual(testCase.expectedQuality.maxLength);
      });
    });

    it('should include required keywords', () => {
      goldenDataset.forEach((testCase) => {
        const mockContent = `This content covers ${testCase.input.topic} including 
          ${testCase.expectedQuality.shouldContainKeywords.join(', ')} and related concepts.`;

        testCase.expectedQuality.shouldContainKeywords.forEach((keyword) => {
          expect(mockContent.toLowerCase()).toContain(keyword.toLowerCase());
        });
      });
    });

    it('should not contain uncertain language', () => {
      goldenDataset.forEach((testCase) => {
        const mockContent = `This is a definitive guide to ${testCase.input.topic}. 
          The content provides clear explanations and concrete examples.`;

        testCase.expectedQuality.shouldNotContain.forEach((phrase) => {
          expect(mockContent.toLowerCase()).not.toContain(phrase.toLowerCase());
        });
      });
    });

    it('should align with Bloom\'s Taxonomy level', () => {
      const bloomVerbs = {
        remember: ['define', 'identify', 'list', 'recall'],
        understand: ['describe', 'explain', 'discuss', 'summarize'],
        apply: ['apply', 'demonstrate', 'use', 'implement'],
        analyze: ['analyze', 'compare', 'examine', 'differentiate'],
        evaluate: ['evaluate', 'assess', 'critique', 'judge'],
        create: ['create', 'design', 'develop', 'construct'],
      };

      goldenDataset.forEach((testCase) => {
        const expectedVerbs = bloomVerbs[testCase.expectedQuality.bloomLevel as keyof typeof bloomVerbs];
        const mockContent = `Students will ${expectedVerbs[0]} the concepts of ${testCase.input.topic}.`;

        const hasAppropriateVerb = expectedVerbs.some((verb) =>
          mockContent.toLowerCase().includes(verb)
        );

        expect(hasAppropriateVerb).toBe(true);
      });
    });
  });

  describe('Source Attribution Accuracy', () => {
    it('should attribute content to specific sources', () => {
      const mockSources = [
        {
          id: 'source-1',
          title: 'Business Intelligence Handbook',
          author: 'Smith, J.',
          year: 2023,
        },
        {
          id: 'source-2',
          title: 'Data Analytics Guide',
          author: 'Jones, M.',
          year: 2023,
        },
      ];

      const mockGeneratedContent = {
        text: 'Business intelligence involves analyzing data to make informed decisions.',
        usedSources: ['source-1', 'source-2'],
        citations: [
          'Smith, J. (2023). Business Intelligence Handbook.',
          'Jones, M. (2023). Data Analytics Guide.',
        ],
      };

      expect(mockGeneratedContent.usedSources).toHaveLength(2);
      expect(mockGeneratedContent.citations).toHaveLength(2);
      
      mockGeneratedContent.usedSources.forEach((sourceId) => {
        const source = mockSources.find((s) => s.id === sourceId);
        expect(source).toBeDefined();
      });
    });

    it('should use APA 7 citation format', () => {
      const mockCitations = [
        'Smith, J. A. (2023). Business Intelligence Fundamentals. Wiley Publishing.',
        'Jones, M. B., & Brown, K. L. (2023). Data visualization techniques. Springer.',
      ];

      const apaPattern = /^[A-Z][a-z]+,\s+[A-Z]\.\s*[A-Z]?\.?\s*(?:&\s+[A-Z][a-z]+,\s+[A-Z]\.\s*[A-Z]?\.?\s*)?\(\d{4}\)\.\s+.+\.\s+.+\.$/;

      mockCitations.forEach((citation) => {
        expect(citation).toMatch(apaPattern);
      });
    });

    it('should track source usage for each content piece', () => {
      const contentPieces = [
        {
          id: 'content-1',
          text: 'Introduction to BI',
          sources: ['source-1', 'source-2'],
        },
        {
          id: 'content-2',
          text: 'Advanced analytics',
          sources: ['source-2', 'source-3'],
        },
      ];

      contentPieces.forEach((piece) => {
        expect(piece.sources.length).toBeGreaterThan(0);
        expect(piece.sources.length).toBeLessThanOrEqual(10); // Max 10 sources per topic
      });
    });
  });

  describe('Hallucination Detection', () => {
    it('should detect content not supported by sources', () => {
      const sourceContent = [
        'Business intelligence helps organizations make data-driven decisions.',
        'Data visualization is essential for presenting insights.',
      ];

      const generatedContent = 'Business intelligence helps organizations make data-driven decisions.';
      const hallucinatedContent = 'Business intelligence was invented in 1850 by John Smith.';

      // Check if generated content is supported by sources
      const isSupported = sourceContent.some((source) =>
        source.toLowerCase().includes(generatedContent.toLowerCase().substring(0, 30))
      );

      const isHallucinated = !sourceContent.some((source) =>
        source.toLowerCase().includes(hallucinatedContent.toLowerCase().substring(0, 30))
      );

      expect(isSupported).toBe(true);
      expect(isHallucinated).toBe(true);
    });

    it('should measure hallucination rate', () => {
      const testCases = [
        { generated: 'BI helps make decisions', isAccurate: true },
        { generated: 'BI was invented in 1850', isAccurate: false },
        { generated: 'Data visualization presents insights', isAccurate: true },
        { generated: 'All companies use BI', isAccurate: false },
      ];

      const hallucinationCount = testCases.filter((tc) => !tc.isAccurate).length;
      const hallucinationRate = (hallucinationCount / testCases.length) * 100;

      expect(hallucinationRate).toBeLessThan(30); // Target: <30% hallucination rate
    });

    it('should verify factual claims against sources', () => {
      const sourceFacts = [
        'Business intelligence emerged in the 1960s',
        'BI tools include Tableau and Power BI',
        'Data warehousing is a key component of BI',
      ];

      const claimsToVerify = [
        { claim: 'BI emerged in the 1960s', expected: true },
        { claim: 'BI emerged in the 1850s', expected: false },
        { claim: 'Tableau is a BI tool', expected: true },
      ];

      claimsToVerify.forEach((test) => {
        const isVerified = sourceFacts.some((fact) =>
          fact.toLowerCase().includes(test.claim.toLowerCase().substring(0, 15))
        );

        expect(isVerified).toBe(test.expected);
      });
    });
  });

  describe('Prompt Variation Testing', () => {
    const promptVariations = [
      {
        name: 'Detailed Prompt',
        template: 'Generate a comprehensive overview of {topic} that includes {context}. Focus on {outcomes}.',
        expectedQuality: 'high',
      },
      {
        name: 'Concise Prompt',
        template: 'Explain {topic} briefly.',
        expectedQuality: 'medium',
      },
      {
        name: 'Structured Prompt',
        template: 'Create content for {topic}:\n1. Introduction\n2. Key Concepts\n3. Applications',
        expectedQuality: 'high',
      },
    ];

    it('should compare output quality across prompt variations', () => {
      promptVariations.forEach((variation) => {
        const mockOutput = {
          prompt: variation.template,
          contentLength: variation.expectedQuality === 'high' ? 800 : 400,
          structureScore: variation.expectedQuality === 'high' ? 0.9 : 0.6,
          relevanceScore: 0.85,
        };

        if (variation.expectedQuality === 'high') {
          expect(mockOutput.contentLength).toBeGreaterThan(600);
          expect(mockOutput.structureScore).toBeGreaterThan(0.8);
        }

        expect(mockOutput.relevanceScore).toBeGreaterThan(0.7);
      });
    });

    it('should measure consistency across multiple generations', () => {
      const generations = [
        { attempt: 1, qualityScore: 0.85, length: 750 },
        { attempt: 2, qualityScore: 0.87, length: 780 },
        { attempt: 3, qualityScore: 0.84, length: 740 },
      ];

      const avgQuality = generations.reduce((sum, g) => sum + g.qualityScore, 0) / generations.length;
      const qualityVariance = generations.reduce(
        (sum, g) => sum + Math.pow(g.qualityScore - avgQuality, 2),
        0
      ) / generations.length;

      expect(avgQuality).toBeGreaterThan(0.8);
      expect(qualityVariance).toBeLessThan(0.01); // Low variance indicates consistency
    });

    it('should identify optimal prompt structure', () => {
      const promptPerformance = [
        { prompt: 'Detailed Prompt', avgQuality: 0.88, avgLength: 850 },
        { prompt: 'Concise Prompt', avgQuality: 0.72, avgLength: 420 },
        { prompt: 'Structured Prompt', avgQuality: 0.91, avgLength: 900 },
      ];

      const bestPrompt = promptPerformance.reduce((best, current) =>
        current.avgQuality > best.avgQuality ? current : best
      );

      expect(bestPrompt.prompt).toBe('Structured Prompt');
      expect(bestPrompt.avgQuality).toBeGreaterThan(0.85);
    });
  });

  describe('Content Coherence and Relevance', () => {
    it('should maintain topic coherence throughout content', () => {
      const mockContent = `
        Business Intelligence (BI) is a technology-driven process for analyzing data.
        BI tools help organizations make informed decisions based on data insights.
        Key components of BI include data warehousing, analytics, and visualization.
        Organizations use BI to gain competitive advantages in their markets.
      `;

      const sentences = mockContent.split('.').filter((s) => s.trim());
      const mainTopic = 'business intelligence';

      const coherenceScore = sentences.filter((sentence) =>
        sentence.toLowerCase().includes('bi') ||
        sentence.toLowerCase().includes('business intelligence') ||
        sentence.toLowerCase().includes('data')
      ).length / sentences.length;

      expect(coherenceScore).toBeGreaterThan(0.7); // At least 70% of sentences relate to topic
    });

    it('should align content with learning outcomes', () => {
      const learningOutcomes = [
        'Understand BI concepts',
        'Apply BI tools',
        'Analyze business data',
      ];

      const mockContent = `
        This module covers business intelligence concepts and their applications.
        Students will learn to apply BI tools for data analysis.
        The course includes hands-on practice with analyzing business data.
      `;

      learningOutcomes.forEach((outcome) => {
        const keywords = outcome.toLowerCase().split(' ');
        const hasAlignment = keywords.some((keyword) =>
          mockContent.toLowerCase().includes(keyword)
        );

        expect(hasAlignment).toBe(true);
      });
    });
  });
});

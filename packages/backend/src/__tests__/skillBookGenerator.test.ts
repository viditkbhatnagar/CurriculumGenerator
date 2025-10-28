import { skillBookGenerator } from '../services/skillBookGenerator';
import { SkillMapping } from '../types/skillBook';
import { embeddingService } from '../services/embeddingService';

// Mock the embedding service to avoid needing OpenAI API key in tests
jest.mock('../services/embeddingService', () => ({
  embeddingService: {
    generateQueryEmbedding: jest.fn(),
  },
}));

describe('SkillBookGenerator - Link Skills to Learning Outcomes', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock embedding generation to return deterministic vectors
    (embeddingService.generateQueryEmbedding as jest.Mock).mockImplementation(
      async (text: string) => {
        // Generate simple deterministic embeddings based on text content
        // This allows us to test similarity matching logic
        const words = text.toLowerCase().split(' ');
        const embedding = new Array(1536).fill(0);
        
        // Set specific dimensions based on keywords
        if (words.some(w => w.includes('data') || w.includes('analysis') || w.includes('analyze'))) {
          embedding[0] = 1.0;
          embedding[1] = 0.8;
        }
        if (words.some(w => w.includes('communication') || w.includes('present') || w.includes('stakeholder'))) {
          embedding[2] = 1.0;
          embedding[3] = 0.8;
        }
        if (words.some(w => w.includes('statistical') || w.includes('interpret'))) {
          embedding[0] = 0.9;
          embedding[1] = 0.7;
        }
        if (words.some(w => w.includes('technical') || w.includes('findings'))) {
          embedding[2] = 0.9;
          embedding[3] = 0.7;
        }
        if (words.some(w => w.includes('professional') || w.includes('workplace'))) {
          embedding[2] = 0.8;
          embedding[3] = 0.9;
        }
        
        return embedding;
      }
    );
  });
  describe('linkToLearningOutcomes', () => {
    it('should link skills to at least 2 learning outcomes using semantic similarity', async () => {
      // Arrange
      const skillMappings: SkillMapping[] = [
        {
          skillId: 'skill-1',
          skillName: 'Data Analysis',
          domain: 'Technical Skills',
          activities: [
            {
              name: 'Data Analysis Project',
              description: 'Analyze business data to identify trends and patterns using statistical methods',
              unitLink: 'Module 1: Data Analytics',
              durationHours: 8,
              assessmentType: 'Practical Project',
              resources: ['Excel', 'Python'],
            },
          ],
          kpis: [
            {
              name: 'Analysis Completion',
              description: 'Complete data analysis projects',
              measurementCriteria: 'Number of completed projects',
              threshold: 3,
              unit: 'projects',
            },
          ],
          linkedOutcomes: [],
          assessmentCriteria: ['Accurate analysis', 'Clear insights'],
        },
        {
          skillId: 'skill-2',
          skillName: 'Communication',
          domain: 'Soft Skills',
          activities: [
            {
              name: 'Presentation Skills',
              description: 'Deliver professional presentations to stakeholders',
              unitLink: 'Module 2: Professional Practice',
              durationHours: 4,
              assessmentType: 'Oral Presentation',
              resources: ['PowerPoint'],
            },
          ],
          kpis: [
            {
              name: 'Presentation Quality',
              description: 'Quality of presentations',
              measurementCriteria: 'Pass evaluation',
              completionCriteria: 'Satisfactory rating',
            },
          ],
          linkedOutcomes: [],
          assessmentCriteria: ['Clear delivery', 'Engaging content'],
        },
      ];

      const learningOutcomes = [
        {
          id: 'outcome-1',
          outcomeText: 'Analyze complex datasets to extract meaningful insights and trends',
          moduleId: 'module-1',
        },
        {
          id: 'outcome-2',
          outcomeText: 'Apply statistical methods to interpret business data',
          moduleId: 'module-1',
        },
        {
          id: 'outcome-3',
          outcomeText: 'Communicate technical findings to non-technical audiences',
          moduleId: 'module-2',
        },
        {
          id: 'outcome-4',
          outcomeText: 'Demonstrate professional presentation skills in workplace contexts',
          moduleId: 'module-2',
        },
      ];

      // Act
      const result = await skillBookGenerator.linkToLearningOutcomes(
        skillMappings,
        learningOutcomes
      );

      // Assert
      expect(result).toHaveLength(2);
      
      // Check that each skill has at least 2 linked outcomes
      result.forEach((skill) => {
        expect(skill.linkedOutcomes.length).toBeGreaterThanOrEqual(2);
        expect(skill.linkedOutcomes.every((id) => typeof id === 'string')).toBe(true);
      });

      // Data Analysis skill should be linked to data-related outcomes
      const dataAnalysisSkill = result.find((s) => s.skillName === 'Data Analysis');
      expect(dataAnalysisSkill).toBeDefined();
      expect(dataAnalysisSkill!.linkedOutcomes).toContain('outcome-1');

      // Communication skill should be linked to communication-related outcomes
      const communicationSkill = result.find((s) => s.skillName === 'Communication');
      expect(communicationSkill).toBeDefined();
      expect(communicationSkill!.linkedOutcomes).toContain('outcome-3');
    });

    it('should ensure minimum of 2 outcomes even if similarity is low', async () => {
      // Arrange
      const skillMappings: SkillMapping[] = [
        {
          skillId: 'skill-1',
          skillName: 'Unique Skill',
          domain: 'Technical',
          activities: [
            {
              name: 'Activity',
              description: 'Very specific activity with unique terminology',
              unitLink: 'Module 1',
              durationHours: 4,
              assessmentType: 'Project',
              resources: [],
            },
          ],
          kpis: [
            {
              name: 'KPI',
              description: 'Test KPI',
              measurementCriteria: 'Test',
              threshold: 1,
            },
          ],
          linkedOutcomes: [],
          assessmentCriteria: [],
        },
      ];

      const learningOutcomes = [
        {
          id: 'outcome-1',
          outcomeText: 'Completely unrelated outcome about history',
          moduleId: 'module-1',
        },
        {
          id: 'outcome-2',
          outcomeText: 'Another unrelated outcome about literature',
          moduleId: 'module-1',
        },
        {
          id: 'outcome-3',
          outcomeText: 'Third unrelated outcome about art',
          moduleId: 'module-1',
        },
      ];

      // Act
      const result = await skillBookGenerator.linkToLearningOutcomes(
        skillMappings,
        learningOutcomes
      );

      // Assert
      expect(result[0].linkedOutcomes.length).toBeGreaterThanOrEqual(2);
    });

    it('should throw error if skill has less than 1 activity', async () => {
      // Arrange
      const skillMappings: SkillMapping[] = [
        {
          skillId: 'skill-1',
          skillName: 'Invalid Skill',
          domain: 'Technical',
          activities: [], // No activities
          kpis: [
            {
              name: 'KPI',
              description: 'Test',
              measurementCriteria: 'Test',
              threshold: 1,
            },
          ],
          linkedOutcomes: [],
          assessmentCriteria: [],
        },
      ];

      const learningOutcomes = [
        {
          id: 'outcome-1',
          outcomeText: 'Test outcome',
          moduleId: 'module-1',
        },
        {
          id: 'outcome-2',
          outcomeText: 'Another test outcome',
          moduleId: 'module-1',
        },
      ];

      // Act & Assert
      await expect(
        skillBookGenerator.linkToLearningOutcomes(skillMappings, learningOutcomes)
      ).rejects.toThrow('must have at least 1 practical activity');
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate correct similarity for identical vectors', () => {
      // Access private method through type assertion for testing
      const generator = skillBookGenerator as any;
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3];
      
      const similarity = generator.cosineSimilarity(vec1, vec2);
      
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate correct similarity for orthogonal vectors', () => {
      const generator = skillBookGenerator as any;
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      
      const similarity = generator.cosineSimilarity(vec1, vec2);
      
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should calculate correct similarity for opposite vectors', () => {
      const generator = skillBookGenerator as any;
      const vec1 = [1, 2, 3];
      const vec2 = [-1, -2, -3];
      
      const similarity = generator.cosineSimilarity(vec1, vec2);
      
      expect(similarity).toBeCloseTo(-1.0, 5);
    });
  });
});

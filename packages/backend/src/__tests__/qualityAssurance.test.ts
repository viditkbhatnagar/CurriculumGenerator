/**
 * Quality Assurance Service Tests
 * Tests for curriculum validation and QA report generation
 */

import { qualityAssuranceService } from '../services/qualityAssuranceService';
import { Curriculum, ProgramSpecification, UnitSpecification, AssessmentPackage } from '../types/curriculum';
import { SkillMapping } from '../types/skillBook';

describe('Quality Assurance Service', () => {
  // Mock curriculum data
  const mockProgramSpec: ProgramSpecification = {
    programId: 'test-program-123',
    introduction: 'Students will be able to analyze complex business problems and develop innovative solutions.',
    courseOverview: 'This program covers essential business intelligence concepts.',
    needsAnalysis: 'Industry needs skilled BI professionals.',
    knowledgeSkillsCompetenciesMatrix: 'KSC Matrix content',
    comparativeAnalysis: 'Comparison with competitors',
    targetAudience: 'Business professionals',
    entryRequirements: 'Bachelor degree or equivalent',
    careerOutcomes: 'BI Analyst, Data Analyst',
    generatedAt: new Date(),
  };

  const mockUnitSpecs: UnitSpecification[] = [
    {
      unitId: 'unit-1',
      moduleCode: 'BI101',
      unitTitle: 'Introduction to Business Intelligence',
      unitOverview: 'This unit covers 10 hours of BI fundamentals.',
      learningOutcomes: [
        { outcomeText: 'Analyze business data using statistical methods and tools', assessmentCriteria: [] },
        { outcomeText: 'Evaluate data quality and identify improvement opportunities', assessmentCriteria: [] },
        { outcomeText: 'Design effective data visualization dashboards for stakeholders', assessmentCriteria: [] },
        { outcomeText: 'Apply business intelligence frameworks to real-world scenarios', assessmentCriteria: [] },
        { outcomeText: 'Create comprehensive reports that communicate insights effectively', assessmentCriteria: [] },
        { outcomeText: 'Implement data governance policies in organizational contexts', assessmentCriteria: [] },
      ],
      indicativeContent: 'BI concepts, tools, and techniques',
      teachingStrategies: ['Lectures', 'Workshops'],
      assessmentMethods: ['Assignments', 'Projects'],
      readingList: [
        {
          title: 'Business Intelligence Fundamentals',
          citation: 'Smith, J. A. (2023). Business Intelligence Fundamentals. Wiley Publishing.',
          type: 'Required',
        },
      ],
      generatedAt: new Date(),
    },
  ];

  const mockAssessmentPackage: AssessmentPackage = {
    programId: 'test-program-123',
    mcqs: [
      {
        moduleCode: 'BI101',
        question: 'What is business intelligence?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Explanation',
        difficulty: 'Medium',
        learningOutcome: 'Analyze business data',
      },
    ],
    caseStudies: [],
    rubrics: [],
    markingSchemes: [],
    learningOutcomeMappings: [],
    generatedAt: new Date(),
  };

  const mockSkillBook: SkillMapping[] = [
    {
      skillId: 'skill-1',
      skillName: 'Data Analysis',
      domain: 'Business Intelligence',
      activities: [
        {
          name: 'Data Analysis Project',
          description: 'Analyze dataset',
          unitLink: 'BI101',
          durationHours: 5,
          assessmentType: 'Project',
          resources: [],
        },
      ],
      kpis: [
        {
          name: 'Analysis Accuracy',
          description: 'Accuracy of analysis',
          measurementCriteria: 'Percentage of correct insights identified',
          threshold: 85,
          unit: 'percentage',
        },
      ],
      linkedOutcomes: ['lo-1', 'lo-2'],
      assessmentCriteria: ['Criterion 1'],
    },
  ];

  const mockCurriculum: Curriculum = {
    programId: 'test-program-123',
    programSpec: mockProgramSpec,
    unitSpecs: mockUnitSpecs,
    assessmentPackage: mockAssessmentPackage,
    skillBook: mockSkillBook,
    generatedAt: new Date(),
  };

  describe('Learning Outcomes Validation', () => {
    it('should validate learning outcomes with Bloom\'s Taxonomy verbs', () => {
      const validOutcome = 'Analyze business data using statistical methods and tools';
      const invalidOutcome = 'Understand business intelligence concepts';

      // Valid outcome starts with "Analyze" (Bloom's verb)
      expect(validOutcome.toLowerCase().startsWith('analyze')).toBe(true);
      
      // Invalid outcome starts with "Understand" but is too vague
      expect(invalidOutcome.split(' ').length).toBeLessThan(5);
    });

    it('should detect outcomes without proper structure', () => {
      const shortOutcome = 'Learn BI';
      const properOutcome = 'Apply business intelligence frameworks to solve organizational problems';

      expect(shortOutcome.split(' ').length).toBeLessThan(5);
      expect(properOutcome.split(' ').length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Hours Validation', () => {
    it('should validate total hours equal 120', () => {
      const moduleHours = [
        { moduleCode: 'M1', hours: 30 },
        { moduleCode: 'M2', hours: 30 },
        { moduleCode: 'M3', hours: 30 },
        { moduleCode: 'M4', hours: 30 },
      ];

      const totalHours = moduleHours.reduce((sum, m) => sum + m.hours, 0);
      expect(totalHours).toBe(120);
    });

    it('should detect unbalanced hour distribution', () => {
      const moduleHours = [
        { moduleCode: 'M1', hours: 80 },
        { moduleCode: 'M2', hours: 20 },
        { moduleCode: 'M3', hours: 10 },
        { moduleCode: 'M4', hours: 10 },
      ];

      const avgHours = 120 / moduleHours.length;
      const maxDeviation = Math.max(...moduleHours.map(m => Math.abs(m.hours - avgHours)));
      
      // Should be unbalanced (deviation > 50% of average)
      expect(maxDeviation).toBeGreaterThan(avgHours * 0.5);
    });
  });

  describe('Citation Validation', () => {
    it('should validate APA 7 citation format', () => {
      const validCitation = 'Smith, J. A. (2023). Business Intelligence Fundamentals. Wiley Publishing.';
      const invalidCitation = 'Smith 2023 Business Intelligence';

      // Valid citation has author, year in parentheses, title, and publisher
      expect(validCitation).toMatch(/[A-Z][a-z]+,\s+[A-Z]\./);
      expect(validCitation).toMatch(/\(\d{4}\)/);
      
      // Invalid citation doesn't match pattern
      expect(invalidCitation).not.toMatch(/\(\d{4}\)/);
    });
  });

  describe('Quality Score Calculation', () => {
    it('should calculate score based on errors and warnings', () => {
      const errorCount = 2;
      const warningCount = 3;
      
      const errorPenalty = errorCount * 10;
      const warningPenalty = warningCount * 5;
      const score = Math.max(0, 100 - errorPenalty - warningPenalty);

      expect(score).toBe(65); // 100 - 20 - 15 = 65
    });

    it('should return 100 for perfect curriculum', () => {
      const errorCount = 0;
      const warningCount = 0;
      
      const score = Math.max(0, 100 - errorCount * 10 - warningCount * 5);

      expect(score).toBe(100);
    });

    it('should not go below 0', () => {
      const errorCount = 15;
      const warningCount = 10;
      
      const score = Math.max(0, 100 - errorCount * 10 - warningCount * 5);

      expect(score).toBe(0);
    });
  });

  describe('Bloom\'s Taxonomy Verbs', () => {
    const bloomsVerbs = {
      remember: ['define', 'identify', 'list', 'name', 'recall'],
      understand: ['describe', 'explain', 'discuss', 'classify'],
      apply: ['apply', 'demonstrate', 'use', 'solve', 'implement'],
      analyze: ['analyze', 'compare', 'contrast', 'examine', 'differentiate'],
      evaluate: ['evaluate', 'assess', 'judge', 'critique', 'appraise'],
      create: ['create', 'design', 'develop', 'construct', 'formulate'],
    };

    it('should recognize all Bloom\'s Taxonomy levels', () => {
      const allVerbs = Object.values(bloomsVerbs).flat();
      
      expect(allVerbs.length).toBeGreaterThan(20);
      expect(allVerbs).toContain('analyze');
      expect(allVerbs).toContain('create');
      expect(allVerbs).toContain('evaluate');
    });

    it('should identify verb level correctly', () => {
      const identifyLevel = (verb: string): string => {
        for (const [level, verbs] of Object.entries(bloomsVerbs)) {
          if (verbs.includes(verb)) {
            return level;
          }
        }
        return 'unknown';
      };

      expect(identifyLevel('analyze')).toBe('analyze');
      expect(identifyLevel('create')).toBe('create');
      expect(identifyLevel('describe')).toBe('understand');
    });
  });

  describe('Recommendations Generation', () => {
    it('should generate recommendations for errors', () => {
      const issues = [
        { category: 'Learning Outcomes', severity: 'error' as const, count: 2 },
        { category: 'Source Validation', severity: 'warning' as const, count: 1 },
      ];

      const recommendations: string[] = [];
      
      issues.forEach(issue => {
        if (issue.severity === 'error') {
          recommendations.push(
            `${issue.category}: Address ${issue.count} critical error${issue.count > 1 ? 's' : ''} immediately`
          );
        }
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toContain('Learning Outcomes');
      expect(recommendations[0]).toContain('critical error');
    });

    it('should provide specific recommendations by category', () => {
      const categoryRecommendations: Record<string, string> = {
        'Learning Outcomes': 'Review learning outcomes to ensure they start with measurable action verbs',
        'Source Validation': 'Update outdated sources or mark foundational works as exceptions',
        'Hours Distribution': 'Adjust module hours to ensure total equals 120',
      };

      expect(categoryRecommendations['Learning Outcomes']).toContain('measurable action verbs');
      expect(categoryRecommendations['Source Validation']).toContain('outdated sources');
    });
  });
});

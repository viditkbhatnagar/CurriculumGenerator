/**
 * Benchmarking Service Tests
 * Tests for competitor program storage and curriculum comparison
 */

import { benchmarkingService } from '../services/benchmarkingService';
import { CompetitorProgramInput } from '../types/benchmark';
import { ProgramSpecification, UnitSpecification } from '../types/curriculum';

describe('Benchmarking Service', () => {
  // Mock competitor program data
  const mockCompetitorInput: CompetitorProgramInput = {
    institutionName: 'Test University',
    programName: 'Business Intelligence Certificate',
    level: 'Certificate',
    topics: [
      { name: 'Data Analysis', description: 'Statistical analysis techniques', hours: 20 },
      { name: 'Data Visualization', description: 'Creating dashboards', hours: 15 },
      { name: 'Business Intelligence Tools', description: 'BI software platforms', hours: 25 },
    ],
    structure: {
      totalHours: 120,
      modules: [
        { code: 'BI101', title: 'Introduction to BI', hours: 40, topics: ['Data Analysis', 'BI Concepts'] },
        { code: 'BI102', title: 'Advanced BI', hours: 40, topics: ['Data Visualization', 'Reporting'] },
        { code: 'BI103', title: 'BI Tools', hours: 40, topics: ['Tableau', 'Power BI'] },
      ],
      assessmentTypes: ['Assignment', 'Project', 'Exam'],
      deliveryMethods: ['Online', 'In-person'],
    },
  };

  // Mock generated curriculum
  const mockProgramSpec: ProgramSpecification = {
    programId: 'test-program-123',
    introduction: 'Comprehensive BI program',
    courseOverview: 'This program covers BI concepts',
    needsAnalysis: 'Industry needs',
    knowledgeSkillsCompetenciesMatrix: 'KSC Matrix',
    comparativeAnalysis: 'Comparison',
    targetAudience: 'Professionals',
    entryRequirements: 'Bachelor degree',
    careerOutcomes: 'BI Analyst',
    generatedAt: new Date(),
  };

  const mockUnitSpecs: UnitSpecification[] = [
    {
      unitId: 'unit-1',
      moduleCode: 'BI101',
      unitTitle: 'Data Analysis Fundamentals',
      unitOverview: 'Introduction to data analysis (40 hours)',
      learningOutcomes: [
        { outcomeText: 'Analyze business data', assessmentCriteria: [] },
        { outcomeText: 'Apply statistical methods', assessmentCriteria: [] },
      ],
      indicativeContent: 'Statistical analysis, data cleaning, exploratory data analysis',
      teachingStrategies: ['Lectures', 'Labs'],
      assessmentMethods: ['Assignment', 'Project'],
      readingList: [],
      generatedAt: new Date(),
    },
    {
      unitId: 'unit-2',
      moduleCode: 'BI102',
      unitTitle: 'Data Visualization',
      unitOverview: 'Creating effective visualizations (40 hours)',
      learningOutcomes: [
        { outcomeText: 'Design dashboards', assessmentCriteria: [] },
        { outcomeText: 'Create visual reports', assessmentCriteria: [] },
      ],
      indicativeContent: 'Dashboard design, chart types, visual storytelling',
      teachingStrategies: ['Workshops', 'Projects'],
      assessmentMethods: ['Project', 'Presentation'],
      readingList: [],
      generatedAt: new Date(),
    },
  ];

  describe('Competitor Program Storage', () => {
    test('should store competitor program successfully', async () => {
      const result = await benchmarkingService.storeCompetitorProgram(mockCompetitorInput);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.institutionName).toBe('Test University');
      expect(result.programName).toBe('Business Intelligence Certificate');
      expect(result.topics).toHaveLength(3);
      expect(result.structure.totalHours).toBe(120);
    });

    test('should retrieve stored competitor program', async () => {
      const stored = await benchmarkingService.storeCompetitorProgram(mockCompetitorInput);
      const retrieved = await benchmarkingService.getCompetitorProgramById(stored.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(stored.id);
      expect(retrieved?.institutionName).toBe('Test University');
    });

    test('should list all competitor programs', async () => {
      await benchmarkingService.storeCompetitorProgram(mockCompetitorInput);
      const programs = await benchmarkingService.getAllCompetitorPrograms();

      expect(programs).toBeDefined();
      expect(Array.isArray(programs)).toBe(true);
      expect(programs.length).toBeGreaterThan(0);
    });

    test('should import multiple competitor programs', async () => {
      const programs: CompetitorProgramInput[] = [
        { ...mockCompetitorInput, institutionName: 'University A' },
        { ...mockCompetitorInput, institutionName: 'University B' },
      ];

      const imported = await benchmarkingService.importCompetitorPrograms(programs);

      expect(imported).toHaveLength(2);
      expect(imported[0].institutionName).toBe('University A');
      expect(imported[1].institutionName).toBe('University B');
    });
  });

  describe('Curriculum Comparison', () => {
    test('should generate benchmark report', async () => {
      // Store a competitor program first
      await benchmarkingService.storeCompetitorProgram(mockCompetitorInput);

      const report = await benchmarkingService.compareCurriculum(
        'test-program-123',
        mockProgramSpec,
        mockUnitSpecs
      );

      expect(report).toBeDefined();
      expect(report.programId).toBe('test-program-123');
      expect(report.comparisons).toBeDefined();
      expect(Array.isArray(report.comparisons)).toBe(true);
      expect(report.overallSimilarity).toBeGreaterThanOrEqual(0);
      expect(report.overallSimilarity).toBeLessThanOrEqual(100);
      expect(report.gaps).toBeDefined();
      expect(report.strengths).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    test('should calculate similarity scores', async () => {
      await benchmarkingService.storeCompetitorProgram(mockCompetitorInput);

      const report = await benchmarkingService.compareCurriculum(
        'test-program-123',
        mockProgramSpec,
        mockUnitSpecs
      );

      expect(report.comparisons.length).toBeGreaterThan(0);
      
      const comparison = report.comparisons[0];
      expect(comparison.similarityScore).toBeGreaterThanOrEqual(0);
      expect(comparison.similarityScore).toBeLessThanOrEqual(100);
      expect(comparison.topicCoverage).toBeGreaterThanOrEqual(0);
      expect(comparison.topicCoverage).toBeLessThanOrEqual(100);
      expect(comparison.assessmentAlignment).toBeGreaterThanOrEqual(0);
      expect(comparison.assessmentAlignment).toBeLessThanOrEqual(100);
    });

    test('should identify gaps', async () => {
      const competitorWithUniqueTopics: CompetitorProgramInput = {
        ...mockCompetitorInput,
        topics: [
          ...mockCompetitorInput.topics,
          { name: 'Machine Learning for BI', description: 'ML applications', hours: 20 },
          { name: 'Cloud Data Warehousing', description: 'Cloud platforms', hours: 15 },
        ],
      };

      await benchmarkingService.storeCompetitorProgram(competitorWithUniqueTopics);

      const report = await benchmarkingService.compareCurriculum(
        'test-program-123',
        mockProgramSpec,
        mockUnitSpecs
      );

      expect(report.gaps).toBeDefined();
      expect(Array.isArray(report.gaps)).toBe(true);
      
      if (report.gaps.length > 0) {
        const gap = report.gaps[0];
        expect(gap.type).toBeDefined();
        expect(gap.description).toBeDefined();
        expect(gap.severity).toMatch(/high|medium|low/);
        expect(gap.recommendation).toBeDefined();
      }
    });

    test('should generate recommendations', async () => {
      await benchmarkingService.storeCompetitorProgram(mockCompetitorInput);

      const report = await benchmarkingService.compareCurriculum(
        'test-program-123',
        mockProgramSpec,
        mockUnitSpecs
      );

      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});

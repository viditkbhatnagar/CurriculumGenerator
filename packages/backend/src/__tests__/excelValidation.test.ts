import { excelValidationService } from '../services/excelValidationService';
import { ParsedProgramData } from '../types/excel';

describe('Excel Validation Service', () => {
  describe('Program Overview Validation', () => {
    it('should validate required fields in program overview', () => {
      const validData: ParsedProgramData = {
        programOverview: {
          programName: 'Test Program',
          qualificationLevel: 'Level 5',
          qualificationType: 'Certificate',
          totalCredits: 120,
          industrySector: 'Technology',
        },
        competencyFramework: [],
        learningOutcomes: [],
        courseFramework: [],
        topicSources: [],
        readingLists: [],
        assessments: [],
        glossary: [],
        caseStudies: [],
        deliverySpecs: {
          deliveryMode: 'Online',
          duration: '12 weeks',
        },
      };

      const result = excelValidationService.validate(validData);
      
      // Should have warnings but no critical errors for empty arrays
      expect(result.errors.length).toBeGreaterThan(0); // Will have error for missing learning outcomes
    });

    it('should detect missing program name', () => {
      const invalidData: ParsedProgramData = {
        programOverview: {
          programName: '',
          qualificationLevel: 'Level 5',
          qualificationType: 'Certificate',
          totalCredits: 120,
          industrySector: 'Technology',
        },
        competencyFramework: [],
        learningOutcomes: [],
        courseFramework: [],
        topicSources: [],
        readingLists: [],
        assessments: [],
        glossary: [],
        caseStudies: [],
        deliverySpecs: {
          deliveryMode: 'Online',
          duration: '12 weeks',
        },
      };

      const result = excelValidationService.validate(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'Program Name')).toBe(true);
    });

    it('should warn about non-standard total credits', () => {
      const data: ParsedProgramData = {
        programOverview: {
          programName: 'Test Program',
          qualificationLevel: 'Level 5',
          qualificationType: 'Certificate',
          totalCredits: 100,
          industrySector: 'Technology',
        },
        competencyFramework: [],
        learningOutcomes: [],
        courseFramework: [],
        topicSources: [],
        readingLists: [],
        assessments: [],
        glossary: [],
        caseStudies: [],
        deliverySpecs: {
          deliveryMode: 'Online',
          duration: '12 weeks',
        },
      };

      const result = excelValidationService.validate(data);
      
      expect(result.warnings.some(w => w.field === 'Total Credits')).toBe(true);
    });
  });

  describe('Course Framework Validation', () => {
    it('should detect missing modules', () => {
      const data: ParsedProgramData = {
        programOverview: {
          programName: 'Test Program',
          qualificationLevel: 'Level 5',
          qualificationType: 'Certificate',
          totalCredits: 120,
          industrySector: 'Technology',
        },
        competencyFramework: [],
        learningOutcomes: [],
        courseFramework: [],
        topicSources: [],
        readingLists: [],
        assessments: [],
        glossary: [],
        caseStudies: [],
        deliverySpecs: {
          deliveryMode: 'Online',
          duration: '12 weeks',
        },
      };

      const result = excelValidationService.validate(data);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.sheet === 'Course Framework')).toBe(true);
    });

    it('should detect duplicate module codes', () => {
      const data: ParsedProgramData = {
        programOverview: {
          programName: 'Test Program',
          qualificationLevel: 'Level 5',
          qualificationType: 'Certificate',
          totalCredits: 120,
          industrySector: 'Technology',
        },
        competencyFramework: [],
        learningOutcomes: [
          {
            outcomeText: 'Understand basic concepts',
            knowledgeSkillCompetency: 'K',
            bloomLevel: 'Understand',
          },
        ],
        courseFramework: [
          {
            moduleCode: 'MOD001',
            moduleTitle: 'Module 1',
            hours: 60,
            coreElective: 'Core',
            sequenceOrder: 1,
          },
          {
            moduleCode: 'MOD001',
            moduleTitle: 'Module 2',
            hours: 60,
            coreElective: 'Core',
            sequenceOrder: 2,
          },
        ],
        topicSources: [],
        readingLists: [],
        assessments: [],
        glossary: [],
        caseStudies: [],
        deliverySpecs: {
          deliveryMode: 'Online',
          duration: '12 weeks',
        },
      };

      const result = excelValidationService.validate(data);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Duplicate module code'))).toBe(true);
    });
  });

  describe('Learning Outcomes Validation', () => {
    it('should warn about non-Bloom verb usage', () => {
      const data: ParsedProgramData = {
        programOverview: {
          programName: 'Test Program',
          qualificationLevel: 'Level 5',
          qualificationType: 'Certificate',
          totalCredits: 120,
          industrySector: 'Technology',
        },
        competencyFramework: [],
        learningOutcomes: [
          {
            outcomeText: 'Learn about programming',
            knowledgeSkillCompetency: 'K',
            bloomLevel: 'Remember',
          },
        ],
        courseFramework: [
          {
            moduleCode: 'MOD001',
            moduleTitle: 'Module 1',
            hours: 120,
            coreElective: 'Core',
            sequenceOrder: 1,
          },
        ],
        topicSources: [],
        readingLists: [],
        assessments: [],
        glossary: [],
        caseStudies: [],
        deliverySpecs: {
          deliveryMode: 'Online',
          duration: '12 weeks',
        },
      };

      const result = excelValidationService.validate(data);
      
      expect(result.warnings.some(w => 
        w.sheet === 'Learning Outcomes' && 
        w.message.includes("Bloom's Taxonomy verb")
      )).toBe(true);
    });
  });
});

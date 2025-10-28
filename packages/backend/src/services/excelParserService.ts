import ExcelJS from 'exceljs';
import {
  ParsedProgramData,
  ValidationError,
  ValidationResult,
  ProgramOverview,
  CompetencyDomain,
  LearningOutcome,
  Module,
  TopicSource,
  ReadingItem,
  Assessment,
  GlossaryTerm,
  CaseStudy,
  DeliverySpecification,
} from '../types/excel';

export class ExcelParserService {
  private requiredSheets = [
    'Program Overview',
    'Competency Framework',
    'Learning Outcomes',
    'Course Framework',
    'Topic Sources',
    'Reading Lists',
    'Assessments',
    'Glossary',
    'Case Studies',
    'Delivery Specifications',
  ];

  /**
   * Parse Excel file and extract all data
   */
  async parseExcelFile(buffer: Buffer): Promise<ParsedProgramData> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    // Validate that all required sheets exist
    const validation = this.validateSheetStructure(workbook);
    if (!validation.isValid) {
      throw new Error(`Excel validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Parse each sheet
    const programOverview = this.parseProgramOverview(workbook);
    const competencyFramework = this.parseCompetencyFramework(workbook);
    const learningOutcomes = this.parseLearningOutcomes(workbook);
    const courseFramework = this.parseCourseFramework(workbook);
    const topicSources = this.parseTopicSources(workbook);
    const readingLists = this.parseReadingLists(workbook);
    const assessments = this.parseAssessments(workbook);
    const glossary = this.parseGlossary(workbook);
    const caseStudies = this.parseCaseStudies(workbook);
    const deliverySpecs = this.parseDeliverySpecifications(workbook);

    return {
      programOverview,
      competencyFramework,
      learningOutcomes,
      courseFramework,
      topicSources,
      readingLists,
      assessments,
      glossary,
      caseStudies,
      deliverySpecs,
    };
  }

  /**
   * Validate Excel structure
   */
  validateSheetStructure(workbook: ExcelJS.Workbook): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check for required sheets
    const existingSheets = workbook.worksheets.map(ws => ws.name);
    
    for (const requiredSheet of this.requiredSheets) {
      if (!existingSheets.includes(requiredSheet)) {
        errors.push({
          sheet: requiredSheet,
          message: `Required sheet "${requiredSheet}" is missing`,
          severity: 'error',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Parse Program Overview sheet
   */
  private parseProgramOverview(workbook: ExcelJS.Workbook): ProgramOverview {
    const sheet = workbook.getWorksheet('Program Overview');
    if (!sheet) throw new Error('Program Overview sheet not found');

    // Assuming key-value format: Column A = Field Name, Column B = Value
    const data: any = {};
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const key = row.getCell(1).value?.toString().trim();
        const value = row.getCell(2).value;
        if (key) {
          data[key] = value;
        }
      }
    });

    return {
      programName: data['Program Name'] || '',
      qualificationLevel: data['Qualification Level'] || '',
      qualificationType: data['Qualification Type'] || '',
      totalCredits: parseInt(data['Total Credits']) || 120,
      industrySector: data['Industry Sector'] || '',
      programAim: data['Program Aim'],
      targetAudience: data['Target Audience'],
      entryRequirements: data['Entry Requirements'],
      careerOutcomes: data['Career Outcomes'],
    };
  }

  /**
   * Parse Competency Framework sheet
   */
  private parseCompetencyFramework(workbook: ExcelJS.Workbook): CompetencyDomain[] {
    const sheet = workbook.getWorksheet('Competency Framework');
    if (!sheet) return [];

    const domains: CompetencyDomain[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const domain = row.getCell(1).value?.toString().trim();
        const description = row.getCell(2).value?.toString().trim();
        const skillsStr = row.getCell(3).value?.toString().trim();
        
        if (domain) {
          domains.push({
            domain,
            description: description || '',
            skills: skillsStr ? skillsStr.split(',').map(s => s.trim()) : [],
          });
        }
      }
    });

    return domains;
  }

  /**
   * Parse Learning Outcomes sheet
   */
  private parseLearningOutcomes(workbook: ExcelJS.Workbook): LearningOutcome[] {
    const sheet = workbook.getWorksheet('Learning Outcomes');
    if (!sheet) return [];

    const outcomes: LearningOutcome[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const outcomeText = row.getCell(1).value?.toString().trim();
        const ksc = row.getCell(2).value?.toString().trim() as 'K' | 'S' | 'C';
        const bloomLevel = row.getCell(3).value?.toString().trim();
        const criteriaStr = row.getCell(4).value?.toString().trim();
        
        if (outcomeText) {
          outcomes.push({
            outcomeText,
            knowledgeSkillCompetency: ksc || 'K',
            bloomLevel: bloomLevel || '',
            assessmentCriteria: criteriaStr ? criteriaStr.split(';').map(c => c.trim()) : [],
          });
        }
      }
    });

    return outcomes;
  }

  /**
   * Parse Course Framework sheet
   */
  private parseCourseFramework(workbook: ExcelJS.Workbook): Module[] {
    const sheet = workbook.getWorksheet('Course Framework');
    if (!sheet) return [];

    const modules: Module[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const moduleCode = row.getCell(1).value?.toString().trim();
        const moduleTitle = row.getCell(2).value?.toString().trim();
        const hours = parseInt(row.getCell(3).value?.toString() || '0');
        const moduleAim = row.getCell(4).value?.toString().trim();
        const coreElective = row.getCell(5).value?.toString().trim() as 'Core' | 'Elective';
        const sequenceOrder = parseInt(row.getCell(6).value?.toString() || '0');
        
        if (moduleCode && moduleTitle) {
          modules.push({
            moduleCode,
            moduleTitle,
            hours,
            moduleAim,
            coreElective: coreElective || 'Core',
            sequenceOrder,
          });
        }
      }
    });

    return modules;
  }

  /**
   * Parse Topic Sources sheet
   */
  private parseTopicSources(workbook: ExcelJS.Workbook): TopicSource[] {
    const sheet = workbook.getWorksheet('Topic Sources');
    if (!sheet) return [];

    const sources: TopicSource[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const topic = row.getCell(1).value?.toString().trim();
        const sourceUrl = row.getCell(2).value?.toString().trim();
        const sourceType = row.getCell(3).value?.toString().trim();
        const publicationDate = row.getCell(4).value?.toString().trim();
        const credibilityScore = parseInt(row.getCell(5).value?.toString() || '0');
        
        if (topic && sourceUrl) {
          sources.push({
            topic,
            sourceUrl,
            sourceType: sourceType || '',
            publicationDate,
            credibilityScore: credibilityScore || undefined,
          });
        }
      }
    });

    return sources;
  }

  /**
   * Parse Reading Lists sheet
   */
  private parseReadingLists(workbook: ExcelJS.Workbook): ReadingItem[] {
    const sheet = workbook.getWorksheet('Reading Lists');
    if (!sheet) return [];

    const readings: ReadingItem[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const title = row.getCell(1).value?.toString().trim();
        const author = row.getCell(2).value?.toString().trim();
        const publicationYear = parseInt(row.getCell(3).value?.toString() || '0');
        const url = row.getCell(4).value?.toString().trim();
        const type = row.getCell(5).value?.toString().trim() as 'Required' | 'Recommended';
        const moduleCode = row.getCell(6).value?.toString().trim();
        
        if (title) {
          readings.push({
            title,
            author,
            publicationYear: publicationYear || undefined,
            url,
            type: type || 'Recommended',
            moduleCode,
          });
        }
      }
    });

    return readings;
  }

  /**
   * Parse Assessments sheet
   */
  private parseAssessments(workbook: ExcelJS.Workbook): Assessment[] {
    const sheet = workbook.getWorksheet('Assessments');
    if (!sheet) return [];

    const assessments: Assessment[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const moduleCode = row.getCell(1).value?.toString().trim();
        const questionType = row.getCell(2).value?.toString().trim() as Assessment['questionType'];
        const questionText = row.getCell(3).value?.toString().trim();
        const optionsStr = row.getCell(4).value?.toString().trim();
        const correctAnswer = row.getCell(5).value?.toString().trim();
        const explanation = row.getCell(6).value?.toString().trim();
        const difficulty = row.getCell(7).value?.toString().trim() as 'Easy' | 'Medium' | 'Hard';
        const learningOutcome = row.getCell(8).value?.toString().trim();
        
        if (moduleCode && questionText) {
          assessments.push({
            moduleCode,
            questionType: questionType || 'MCQ',
            questionText,
            options: optionsStr ? optionsStr.split('|').map(o => o.trim()) : [],
            correctAnswer,
            explanation,
            difficulty: difficulty || 'Medium',
            learningOutcome,
          });
        }
      }
    });

    return assessments;
  }

  /**
   * Parse Glossary sheet
   */
  private parseGlossary(workbook: ExcelJS.Workbook): GlossaryTerm[] {
    const sheet = workbook.getWorksheet('Glossary');
    if (!sheet) return [];

    const terms: GlossaryTerm[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const term = row.getCell(1).value?.toString().trim();
        const definition = row.getCell(2).value?.toString().trim();
        const relatedTermsStr = row.getCell(3).value?.toString().trim();
        
        if (term && definition) {
          terms.push({
            term,
            definition,
            relatedTerms: relatedTermsStr ? relatedTermsStr.split(',').map(t => t.trim()) : [],
          });
        }
      }
    });

    return terms;
  }

  /**
   * Parse Case Studies sheet
   */
  private parseCaseStudies(workbook: ExcelJS.Workbook): CaseStudy[] {
    const sheet = workbook.getWorksheet('Case Studies');
    if (!sheet) return [];

    const caseStudies: CaseStudy[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const title = row.getCell(1).value?.toString().trim();
        const scenario = row.getCell(2).value?.toString().trim();
        const questionsStr = row.getCell(3).value?.toString().trim();
        const moduleCode = row.getCell(4).value?.toString().trim();
        const difficulty = row.getCell(5).value?.toString().trim() as 'Easy' | 'Medium' | 'Hard';
        
        if (title && scenario) {
          caseStudies.push({
            title,
            scenario,
            questions: questionsStr ? questionsStr.split(';').map(q => q.trim()) : [],
            moduleCode,
            difficulty: difficulty || 'Medium',
          });
        }
      }
    });

    return caseStudies;
  }

  /**
   * Parse Delivery Specifications sheet
   */
  private parseDeliverySpecifications(workbook: ExcelJS.Workbook): DeliverySpecification {
    const sheet = workbook.getWorksheet('Delivery Specifications');
    if (!sheet) {
      return {
        deliveryMode: 'Online',
        duration: '',
      };
    }

    const data: any = {};
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const key = row.getCell(1).value?.toString().trim();
        const value = row.getCell(2).value;
        if (key) {
          data[key] = value;
        }
      }
    });

    return {
      deliveryMode: (data['Delivery Mode'] as any) || 'Online',
      duration: data['Duration'] || '',
      assessmentStrategy: data['Assessment Strategy'],
      teachingMethods: data['Teaching Methods'] 
        ? data['Teaching Methods'].split(',').map((m: string) => m.trim()) 
        : [],
    };
  }

  /**
   * Validate parsed data
   */
  validateParsedData(data: ParsedProgramData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate Program Overview
    if (!data.programOverview.programName) {
      errors.push({
        sheet: 'Program Overview',
        field: 'Program Name',
        message: 'Program Name is required',
        severity: 'error',
      });
    }

    if (!data.programOverview.qualificationLevel) {
      errors.push({
        sheet: 'Program Overview',
        field: 'Qualification Level',
        message: 'Qualification Level is required',
        severity: 'error',
      });
    }

    if (data.programOverview.totalCredits <= 0) {
      errors.push({
        sheet: 'Program Overview',
        field: 'Total Credits',
        message: 'Total Credits must be greater than 0',
        severity: 'error',
      });
    }

    // Validate Course Framework
    if (data.courseFramework.length === 0) {
      errors.push({
        sheet: 'Course Framework',
        message: 'At least one module is required',
        severity: 'error',
      });
    }

    // Validate total hours
    const totalHours = data.courseFramework.reduce((sum, module) => sum + module.hours, 0);
    if (totalHours !== 120) {
      warnings.push({
        sheet: 'Course Framework',
        message: `Total hours (${totalHours}) should equal 120`,
        severity: 'warning',
      });
    }

    // Validate Learning Outcomes
    if (data.learningOutcomes.length === 0) {
      warnings.push({
        sheet: 'Learning Outcomes',
        message: 'No learning outcomes defined',
        severity: 'warning',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export const excelParserService = new ExcelParserService();

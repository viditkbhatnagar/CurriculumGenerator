import { ParsedProgramData, ValidationError, ValidationResult } from '../types/excel';

export class ExcelValidationService {
  /**
   * Comprehensive validation of parsed Excel data
   */
  validate(data: ParsedProgramData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate Program Overview
    this.validateProgramOverview(data, errors, warnings);

    // Validate Competency Framework
    this.validateCompetencyFramework(data, errors, warnings);

    // Validate Learning Outcomes
    this.validateLearningOutcomes(data, errors, warnings);

    // Validate Course Framework
    this.validateCourseFramework(data, errors, warnings);

    // Validate Topic Sources
    this.validateTopicSources(data, errors, warnings);

    // Validate Assessments
    this.validateAssessments(data, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateProgramOverview(
    data: ParsedProgramData,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    const overview = data.programOverview;

    if (!overview.programName || overview.programName.trim() === '') {
      errors.push({
        sheet: 'Program Overview',
        field: 'Program Name',
        message: 'Program Name is required and cannot be empty',
        severity: 'error',
      });
    }

    if (!overview.qualificationLevel || overview.qualificationLevel.trim() === '') {
      errors.push({
        sheet: 'Program Overview',
        field: 'Qualification Level',
        message: 'Qualification Level is required',
        severity: 'error',
      });
    }

    if (!overview.qualificationType || overview.qualificationType.trim() === '') {
      errors.push({
        sheet: 'Program Overview',
        field: 'Qualification Type',
        message: 'Qualification Type is required',
        severity: 'error',
      });
    }

    if (!overview.totalCredits || overview.totalCredits <= 0) {
      errors.push({
        sheet: 'Program Overview',
        field: 'Total Credits',
        message: 'Total Credits must be a positive number',
        severity: 'error',
      });
    }

    if (overview.totalCredits !== 120) {
      warnings.push({
        sheet: 'Program Overview',
        field: 'Total Credits',
        message: `Total Credits is ${overview.totalCredits}, expected 120`,
        severity: 'warning',
      });
    }
  }

  private validateCompetencyFramework(
    data: ParsedProgramData,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    if (data.competencyFramework.length === 0) {
      warnings.push({
        sheet: 'Competency Framework',
        message: 'No competency domains defined',
        severity: 'warning',
      });
      return;
    }

    data.competencyFramework.forEach((domain, index) => {
      if (!domain.domain || domain.domain.trim() === '') {
        errors.push({
          sheet: 'Competency Framework',
          row: index + 2,
          field: 'Domain',
          message: `Domain name is required at row ${index + 2}`,
          severity: 'error',
        });
      }

      if (!domain.skills || domain.skills.length === 0) {
        warnings.push({
          sheet: 'Competency Framework',
          row: index + 2,
          field: 'Skills',
          message: `No skills defined for domain "${domain.domain}" at row ${index + 2}`,
          severity: 'warning',
        });
      }
    });
  }

  private validateLearningOutcomes(
    data: ParsedProgramData,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    if (data.learningOutcomes.length === 0) {
      errors.push({
        sheet: 'Learning Outcomes',
        message: 'At least one learning outcome is required',
        severity: 'error',
      });
      return;
    }

    // Check for recommended range (5-8 outcomes)
    if (data.learningOutcomes.length < 5 || data.learningOutcomes.length > 8) {
      warnings.push({
        sheet: 'Learning Outcomes',
        message: `Program has ${data.learningOutcomes.length} learning outcomes. Recommended: 5-8`,
        severity: 'warning',
      });
    }

    const bloomVerbs = [
      'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create',
      'identify', 'describe', 'explain', 'demonstrate', 'implement', 'design',
      'assess', 'critique', 'develop', 'formulate', 'construct', 'plan',
    ];

    data.learningOutcomes.forEach((outcome, index) => {
      if (!outcome.outcomeText || outcome.outcomeText.trim() === '') {
        errors.push({
          sheet: 'Learning Outcomes',
          row: index + 2,
          field: 'Outcome Text',
          message: `Learning outcome text is required at row ${index + 2}`,
          severity: 'error',
        });
        return;
      }

      // Check if outcome starts with a Bloom's verb
      const firstWord = outcome.outcomeText.trim().split(' ')[0].toLowerCase();
      if (!bloomVerbs.includes(firstWord)) {
        warnings.push({
          sheet: 'Learning Outcomes',
          row: index + 2,
          field: 'Outcome Text',
          message: `Learning outcome at row ${index + 2} should start with a Bloom's Taxonomy verb`,
          severity: 'warning',
        });
      }

      // Validate K/S/C classification
      if (!['K', 'S', 'C'].includes(outcome.knowledgeSkillCompetency)) {
        warnings.push({
          sheet: 'Learning Outcomes',
          row: index + 2,
          field: 'K/S/C',
          message: `Invalid K/S/C value at row ${index + 2}. Must be K, S, or C`,
          severity: 'warning',
        });
      }
    });
  }

  private validateCourseFramework(
    data: ParsedProgramData,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    if (data.courseFramework.length === 0) {
      errors.push({
        sheet: 'Course Framework',
        message: 'At least one module is required',
        severity: 'error',
      });
      return;
    }

    let totalHours = 0;
    const moduleCodes = new Set<string>();

    data.courseFramework.forEach((module, index) => {
      if (!module.moduleCode || module.moduleCode.trim() === '') {
        errors.push({
          sheet: 'Course Framework',
          row: index + 2,
          field: 'Module Code',
          message: `Module code is required at row ${index + 2}`,
          severity: 'error',
        });
      } else {
        // Check for duplicate module codes
        if (moduleCodes.has(module.moduleCode)) {
          errors.push({
            sheet: 'Course Framework',
            row: index + 2,
            field: 'Module Code',
            message: `Duplicate module code "${module.moduleCode}" at row ${index + 2}`,
            severity: 'error',
          });
        }
        moduleCodes.add(module.moduleCode);
      }

      if (!module.moduleTitle || module.moduleTitle.trim() === '') {
        errors.push({
          sheet: 'Course Framework',
          row: index + 2,
          field: 'Module Title',
          message: `Module title is required at row ${index + 2}`,
          severity: 'error',
        });
      }

      if (!module.hours || module.hours <= 0) {
        errors.push({
          sheet: 'Course Framework',
          row: index + 2,
          field: 'Hours',
          message: `Module hours must be greater than 0 at row ${index + 2}`,
          severity: 'error',
        });
      } else {
        totalHours += module.hours;
      }

      if (!['Core', 'Elective'].includes(module.coreElective)) {
        warnings.push({
          sheet: 'Course Framework',
          row: index + 2,
          field: 'Core/Elective',
          message: `Core/Elective value should be "Core" or "Elective" at row ${index + 2}`,
          severity: 'warning',
        });
      }
    });

    // Validate total hours equals 120
    if (totalHours !== 120) {
      warnings.push({
        sheet: 'Course Framework',
        message: `Total module hours is ${totalHours}, expected 120`,
        severity: 'warning',
      });
    }
  }

  private validateTopicSources(
    data: ParsedProgramData,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    if (data.topicSources.length === 0) {
      warnings.push({
        sheet: 'Topic Sources',
        message: 'No topic sources defined',
        severity: 'warning',
      });
      return;
    }

    data.topicSources.forEach((source, index) => {
      if (!source.topic || source.topic.trim() === '') {
        errors.push({
          sheet: 'Topic Sources',
          row: index + 2,
          field: 'Topic',
          message: `Topic is required at row ${index + 2}`,
          severity: 'error',
        });
      }

      if (!source.sourceUrl || source.sourceUrl.trim() === '') {
        errors.push({
          sheet: 'Topic Sources',
          row: index + 2,
          field: 'Source URL',
          message: `Source URL is required at row ${index + 2}`,
          severity: 'error',
        });
      }

      // Validate URL format
      if (source.sourceUrl && !this.isValidUrl(source.sourceUrl)) {
        warnings.push({
          sheet: 'Topic Sources',
          row: index + 2,
          field: 'Source URL',
          message: `Invalid URL format at row ${index + 2}`,
          severity: 'warning',
        });
      }

      // Validate publication date if provided
      if (source.publicationDate) {
        const date = new Date(source.publicationDate);
        if (isNaN(date.getTime())) {
          warnings.push({
            sheet: 'Topic Sources',
            row: index + 2,
            field: 'Publication Date',
            message: `Invalid date format at row ${index + 2}`,
            severity: 'warning',
          });
        } else {
          // Check if source is older than 5 years
          const fiveYearsAgo = new Date();
          fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
          if (date < fiveYearsAgo) {
            warnings.push({
              sheet: 'Topic Sources',
              row: index + 2,
              field: 'Publication Date',
              message: `Source at row ${index + 2} is older than 5 years`,
              severity: 'warning',
            });
          }
        }
      }

      // Validate credibility score
      if (source.credibilityScore !== undefined) {
        if (source.credibilityScore < 0 || source.credibilityScore > 100) {
          errors.push({
            sheet: 'Topic Sources',
            row: index + 2,
            field: 'Credibility Score',
            message: `Credibility score must be between 0 and 100 at row ${index + 2}`,
            severity: 'error',
          });
        }
      }
    });
  }

  private validateAssessments(
    data: ParsedProgramData,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    if (data.assessments.length === 0) {
      warnings.push({
        sheet: 'Assessments',
        message: 'No assessments defined',
        severity: 'warning',
      });
      return;
    }

    const validModuleCodes = new Set(data.courseFramework.map(m => m.moduleCode));

    data.assessments.forEach((assessment, index) => {
      if (!assessment.moduleCode || assessment.moduleCode.trim() === '') {
        errors.push({
          sheet: 'Assessments',
          row: index + 2,
          field: 'Module Code',
          message: `Module code is required at row ${index + 2}`,
          severity: 'error',
        });
      } else if (!validModuleCodes.has(assessment.moduleCode)) {
        warnings.push({
          sheet: 'Assessments',
          row: index + 2,
          field: 'Module Code',
          message: `Module code "${assessment.moduleCode}" at row ${index + 2} not found in Course Framework`,
          severity: 'warning',
        });
      }

      if (!assessment.questionText || assessment.questionText.trim() === '') {
        errors.push({
          sheet: 'Assessments',
          row: index + 2,
          field: 'Question Text',
          message: `Question text is required at row ${index + 2}`,
          severity: 'error',
        });
      }

      // Validate MCQ has options
      if (assessment.questionType === 'MCQ') {
        if (!assessment.options || assessment.options.length < 2) {
          errors.push({
            sheet: 'Assessments',
            row: index + 2,
            field: 'Options',
            message: `MCQ at row ${index + 2} must have at least 2 options`,
            severity: 'error',
          });
        }
      }
    });
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

export const excelValidationService = new ExcelValidationService();

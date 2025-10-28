/**
 * Quality Assurance Service
 * Automated validation checks for curriculum compliance with AGCQ standards
 * Implements Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { Pool } from 'pg';
import { getPool } from '../db';
import { Curriculum, ProgramSpecification, UnitSpecification } from '../types/curriculum';
import { QAReport, ComplianceIssue, SourceValidation, OutcomeValidation, HoursValidation } from '../types/qa';

class QualityAssuranceService {
  private db: Pool;

  // Bloom's Taxonomy verbs for learning outcomes validation
  private readonly bloomsVerbs = {
    remember: ['define', 'identify', 'list', 'name', 'recall', 'recognize', 'state', 'describe'],
    understand: ['classify', 'describe', 'discuss', 'explain', 'express', 'identify', 'indicate', 'locate', 'recognize', 'report', 'restate', 'review', 'select', 'translate'],
    apply: ['apply', 'choose', 'demonstrate', 'dramatize', 'employ', 'illustrate', 'interpret', 'operate', 'practice', 'schedule', 'sketch', 'solve', 'use', 'write'],
    analyze: ['analyze', 'appraise', 'calculate', 'categorize', 'compare', 'contrast', 'criticize', 'differentiate', 'discriminate', 'distinguish', 'examine', 'experiment', 'question', 'test'],
    evaluate: ['appraise', 'argue', 'assess', 'attach', 'choose', 'compare', 'defend', 'estimate', 'evaluate', 'judge', 'predict', 'rate', 'select', 'support', 'value'],
    create: ['assemble', 'construct', 'create', 'design', 'develop', 'formulate', 'generate', 'integrate', 'invent', 'make', 'plan', 'produce', 'propose', 'synthesize'],
  };

  // APA 7 citation pattern (simplified)
  private readonly apaCitationPattern = /^[A-Z][a-z]+,\s+[A-Z]\.\s*(?:[A-Z]\.\s*)?\(\d{4}\)\.\s+.+\.\s+.+$/;

  constructor() {
    this.db = getPool();
  }

  /**
   * Validate complete curriculum against AGCQ standards
   * Requirement 6.5: Generate detailed report with compliance issues and recommendations
   */
  async validateCurriculum(curriculum: Curriculum): Promise<QAReport> {
    console.log(`Running QA checks for program ${curriculum.programId}`);

    const complianceIssues: ComplianceIssue[] = [];
    const passedChecks: string[] = [];

    // Run all validation checks
    const sourceValidations = await this.checkSources(curriculum);
    const outcomeValidations = this.validateLearningOutcomes(curriculum);
    const hoursValidation = this.validateHours(curriculum);
    const citationValidations = this.validateCitations(curriculum);
    const structureValidations = this.validateStructure(curriculum);

    // Collect issues and passed checks
    this.collectValidationResults(sourceValidations, complianceIssues, passedChecks, 'Source Validation');
    this.collectValidationResults(outcomeValidations, complianceIssues, passedChecks, 'Learning Outcomes');
    this.collectValidationResults([hoursValidation], complianceIssues, passedChecks, 'Hours Distribution');
    this.collectValidationResults(citationValidations, complianceIssues, passedChecks, 'Citations');
    this.collectValidationResults(structureValidations, complianceIssues, passedChecks, 'Structure');

    // Calculate overall quality score
    const overallScore = this.calculateQualityScore(complianceIssues, passedChecks);

    // Generate recommendations
    const recommendations = this.generateRecommendations(complianceIssues);

    const report: QAReport = {
      programId: curriculum.programId,
      overallScore,
      complianceIssues,
      recommendations,
      passedChecks,
      generatedAt: new Date(),
    };

    // Store report in database
    await this.storeQAReport(report);

    console.log(`QA report generated: Score ${overallScore}/100, ${complianceIssues.length} issues found`);

    return report;
  }

  /**
   * Check source publication dates and validity
   * Requirement 6.1: Validate sources are ≤5 years or marked exceptions
   */
  private async checkSources(curriculum: Curriculum): Promise<SourceValidation[]> {
    const validations: SourceValidation[] = [];
    const currentDate = new Date();
    const fiveYearsAgo = new Date(currentDate.getFullYear() - 5, currentDate.getMonth(), currentDate.getDate());

    try {
      // Get all sources used in the curriculum
      const client = await this.db.connect();
      
      try {
        const result = await client.query(
          `SELECT DISTINCT kb.id, kb.source_url, kb.publication_date, kb.metadata, kb.source_type
           FROM knowledge_base kb
           WHERE kb.id IN (
             SELECT DISTINCT jsonb_array_elements_text(used_sources::jsonb)
             FROM (
               SELECT jsonb_array_elements_text(metadata->'usedSources') as used_sources
               FROM program_specifications
               WHERE program_id = $1
               UNION
               SELECT jsonb_array_elements_text(metadata->'usedSources') as used_sources
               FROM unit_specifications
               WHERE program_id = $1
             ) sources
           )`,
          [curriculum.programId]
        );

        for (const row of result.rows) {
          const publicationDate = row.publication_date ? new Date(row.publication_date) : null;
          const isException = row.metadata?.isFoundationalException === true;
          
          if (!publicationDate) {
            validations.push({
              sourceId: row.id,
              sourceUrl: row.source_url,
              isValid: false,
              issue: 'Missing publication date',
              severity: 'warning',
            });
          } else if (publicationDate < fiveYearsAgo && !isException) {
            validations.push({
              sourceId: row.id,
              sourceUrl: row.source_url,
              publicationDate,
              isValid: false,
              issue: `Source is older than 5 years (${publicationDate.getFullYear()}) and not marked as foundational exception`,
              severity: 'error',
            });
          } else {
            validations.push({
              sourceId: row.id,
              sourceUrl: row.source_url,
              publicationDate,
              isValid: true,
              isException,
            });
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error checking sources:', error);
      validations.push({
        sourceId: 'unknown',
        sourceUrl: 'unknown',
        isValid: false,
        issue: 'Failed to retrieve source information',
        severity: 'error',
      });
    }

    return validations;
  }

  /**
   * Validate learning outcomes structure and Bloom's Taxonomy usage
   * Requirement 6.2: Verify outcomes use Bloom's verbs and follow Verb+Object+Context structure
   */
  private validateLearningOutcomes(curriculum: Curriculum): OutcomeValidation[] {
    const validations: OutcomeValidation[] = [];
    const allBloomsVerbs = Object.values(this.bloomsVerbs).flat();

    // Validate program-level learning outcomes count
    const programOutcomes = this.extractProgramLearningOutcomes(curriculum.programSpec);
    
    if (programOutcomes.length < 5 || programOutcomes.length > 8) {
      validations.push({
        outcomeText: 'Program Learning Outcomes',
        isValid: false,
        issue: `Program has ${programOutcomes.length} learning outcomes, but should have 5-8`,
        severity: 'error',
        location: 'Program Specification',
      });
    } else {
      validations.push({
        outcomeText: 'Program Learning Outcomes Count',
        isValid: true,
        location: 'Program Specification',
      });
    }

    // Validate each program learning outcome
    programOutcomes.forEach((outcome, index) => {
      const validation = this.validateSingleOutcome(outcome, `Program LO ${index + 1}`);
      validations.push(validation);
    });

    // Validate unit learning outcomes
    curriculum.unitSpecs.forEach((unitSpec) => {
      const unitOutcomes = unitSpec.learningOutcomes;

      if (unitOutcomes.length < 6 || unitOutcomes.length > 8) {
        validations.push({
          outcomeText: `${unitSpec.moduleCode} Learning Outcomes`,
          isValid: false,
          issue: `Module has ${unitOutcomes.length} learning outcomes, but should have 6-8`,
          severity: 'error',
          location: unitSpec.moduleCode,
        });
      } else {
        validations.push({
          outcomeText: `${unitSpec.moduleCode} Learning Outcomes Count`,
          isValid: true,
          location: unitSpec.moduleCode,
        });
      }

      unitOutcomes.forEach((outcome, index) => {
        const validation = this.validateSingleOutcome(
          outcome.outcomeText,
          `${unitSpec.moduleCode} LO ${index + 1}`
        );
        validations.push(validation);
      });
    });

    return validations;
  }

  /**
   * Validate a single learning outcome
   */
  private validateSingleOutcome(outcomeText: string, location: string): OutcomeValidation {
    const allBloomsVerbs = Object.values(this.bloomsVerbs).flat();
    const words = outcomeText.toLowerCase().split(/\s+/);
    
    // Check if first word is a Bloom's verb
    const firstWord = words[0]?.replace(/[^a-z]/g, '');
    const hasBloomsVerb = allBloomsVerbs.includes(firstWord);

    if (!hasBloomsVerb) {
      return {
        outcomeText,
        isValid: false,
        issue: `Learning outcome does not start with a measurable Bloom's Taxonomy verb. Found: "${firstWord}"`,
        severity: 'error',
        location,
        suggestion: `Start with a verb like: ${allBloomsVerbs.slice(0, 10).join(', ')}...`,
      };
    }

    // Check for Verb+Object+Context structure (at least 5 words)
    if (words.length < 5) {
      return {
        outcomeText,
        isValid: false,
        issue: 'Learning outcome is too short. Should follow Verb+Object+Context structure',
        severity: 'warning',
        location,
        suggestion: 'Expand to include what students will do (verb), what they will do it to (object), and under what conditions (context)',
      };
    }

    return {
      outcomeText,
      isValid: true,
      location,
      bloomsLevel: this.identifyBloomsLevel(firstWord),
    };
  }

  /**
   * Identify Bloom's Taxonomy level for a verb
   */
  private identifyBloomsLevel(verb: string): string {
    for (const [level, verbs] of Object.entries(this.bloomsVerbs)) {
      if (verbs.includes(verb)) {
        return level;
      }
    }
    return 'unknown';
  }

  /**
   * Extract program-level learning outcomes from program specification
   */
  private extractProgramLearningOutcomes(programSpec: ProgramSpecification): string[] {
    // Parse learning outcomes from the course overview or introduction
    const text = programSpec.courseOverview + ' ' + programSpec.introduction;
    
    // Look for patterns like "Students will be able to..." or numbered outcomes
    const outcomePatterns = [
      /(?:students will be able to|learners will|upon completion.*will)[\s:]+([^.]+)/gi,
      /(?:learning outcome|outcome)\s*\d+[\s:]+([^.]+)/gi,
      /^\d+\.\s+([A-Z][^.]+)/gm,
    ];

    const outcomes: string[] = [];
    
    for (const pattern of outcomePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 10) {
          outcomes.push(match[1].trim());
        }
      }
    }

    // If no outcomes found, return a default count for validation purposes
    return outcomes.length > 0 ? outcomes.slice(0, 10) : [];
  }

  /**
   * Validate total hours and distribution
   * Requirement 6.3: Ensure program has 5-8 outcomes, modules have 6-8 units
   * Requirement 6.4: Validate total hours sum to 120 with balanced distribution
   */
  private validateHours(curriculum: Curriculum): HoursValidation {
    const moduleHours = curriculum.unitSpecs.map(unit => ({
      moduleCode: unit.moduleCode,
      hours: this.extractHoursFromUnit(unit),
    }));

    const totalHours = moduleHours.reduce((sum, m) => sum + m.hours, 0);
    const avgHours = totalHours / moduleHours.length;
    const maxDeviation = Math.max(...moduleHours.map(m => Math.abs(m.hours - avgHours)));
    
    // Check if total is 120
    const isTotal120 = totalHours === 120;
    
    // Check if distribution is balanced (no module deviates more than 50% from average)
    const isBalanced = maxDeviation <= avgHours * 0.5;

    const issues: string[] = [];
    
    if (!isTotal120) {
      issues.push(`Total hours is ${totalHours}, but should be 120`);
    }
    
    if (!isBalanced) {
      issues.push(`Hours distribution is unbalanced. Maximum deviation from average (${avgHours.toFixed(1)}h) is ${maxDeviation.toFixed(1)}h`);
      
      // Identify problematic modules
      moduleHours.forEach(m => {
        const deviation = Math.abs(m.hours - avgHours);
        if (deviation > avgHours * 0.5) {
          issues.push(`Module ${m.moduleCode} has ${m.hours}h (${deviation > 0 ? '+' : ''}${(deviation).toFixed(1)}h from average)`);
        }
      });
    }

    return {
      totalHours,
      expectedHours: 120,
      moduleHours,
      isValid: isTotal120 && isBalanced,
      issues: issues.length > 0 ? issues : undefined,
      severity: !isTotal120 ? 'error' : !isBalanced ? 'warning' : undefined,
    };
  }

  /**
   * Extract hours from unit specification
   */
  private extractHoursFromUnit(unit: UnitSpecification): number {
    // Try to extract hours from unit overview
    const hourPattern = /(\d+)\s*(?:hours?|hrs?)/i;
    const match = unit.unitOverview.match(hourPattern);
    
    if (match) {
      return parseInt(match[1], 10);
    }

    // Default to average if not found
    return 10;
  }

  /**
   * Validate APA 7 citation format
   * Requirement 6.4: Check APA 7 citation format using regex patterns
   */
  private validateCitations(curriculum: Curriculum): Array<{
    isValid: boolean;
    issue?: string;
    severity?: 'error' | 'warning';
    location?: string;
  }> {
    const validations: Array<any> = [];

    // Check citations in reading lists
    curriculum.unitSpecs.forEach((unitSpec) => {
      unitSpec.readingList.forEach((item, index) => {
        if (!item.citation || item.citation.trim() === '') {
          validations.push({
            isValid: false,
            issue: `Missing citation for reading item: "${item.title}"`,
            severity: 'warning',
            location: `${unitSpec.moduleCode} - Reading List Item ${index + 1}`,
          });
        } else if (!this.validateAPACitation(item.citation)) {
          validations.push({
            isValid: false,
            issue: `Citation does not follow APA 7 format: "${item.citation.substring(0, 50)}..."`,
            severity: 'warning',
            location: `${unitSpec.moduleCode} - Reading List Item ${index + 1}`,
            suggestion: 'Use format: Author, A. B. (Year). Title. Publisher or Journal.',
          });
        } else {
          validations.push({
            isValid: true,
            location: `${unitSpec.moduleCode} - Reading List Item ${index + 1}`,
          });
        }
      });
    });

    // If no citations found, add a warning
    if (validations.length === 0) {
      validations.push({
        isValid: false,
        issue: 'No citations found in curriculum',
        severity: 'warning',
        location: 'Reading Lists',
      });
    }

    return validations;
  }

  /**
   * Validate APA citation format (simplified check)
   */
  private validateAPACitation(citation: string): boolean {
    // Basic APA 7 patterns
    const patterns = [
      // Author, A. B. (Year). Title. Publisher.
      /^[A-Z][a-z]+,\s+[A-Z]\.\s*(?:[A-Z]\.\s*)?\(\d{4}\)\.\s+.+\.\s+.+$/,
      // Author, A. B., & Author, C. D. (Year). Title. Journal, Volume(Issue), pages.
      /^[A-Z][a-z]+,\s+[A-Z]\.\s*.+\(\d{4}\)\.\s+.+\.\s+.+,\s+\d+/,
      // Author, A. B. (Year, Month Day). Title. URL
      /^[A-Z][a-z]+,\s+[A-Z]\.\s*.+\(\d{4}.*\)\.\s+.+\.\s+https?:\/\//,
    ];

    return patterns.some(pattern => pattern.test(citation.trim()));
  }

  /**
   * Validate curriculum structure
   * Requirement 6.3: Verify program has 5-8 learning outcomes and modules have 6-8 units
   */
  private validateStructure(curriculum: Curriculum): Array<{
    isValid: boolean;
    issue?: string;
    severity?: 'error' | 'warning';
    location?: string;
  }> {
    const validations: Array<any> = [];

    // Check number of modules
    const moduleCount = curriculum.unitSpecs.length;
    
    if (moduleCount < 3) {
      validations.push({
        isValid: false,
        issue: `Program has only ${moduleCount} modules, which may be insufficient`,
        severity: 'warning',
        location: 'Program Structure',
      });
    } else if (moduleCount > 12) {
      validations.push({
        isValid: false,
        issue: `Program has ${moduleCount} modules, which may be too many`,
        severity: 'warning',
        location: 'Program Structure',
      });
    } else {
      validations.push({
        isValid: true,
        location: 'Program Structure - Module Count',
      });
    }

    // Check assessment package completeness
    const hasAssessments = curriculum.assessmentPackage.mcqs.length > 0 ||
                          curriculum.assessmentPackage.caseStudies.length > 0;
    
    if (!hasAssessments) {
      validations.push({
        isValid: false,
        issue: 'Assessment package is empty',
        severity: 'error',
        location: 'Assessment Package',
      });
    } else {
      validations.push({
        isValid: true,
        location: 'Assessment Package',
      });
    }

    // Check skill book
    if (curriculum.skillBook.length === 0) {
      validations.push({
        isValid: false,
        issue: 'Skill book is empty',
        severity: 'warning',
        location: 'Skill Book',
      });
    } else {
      validations.push({
        isValid: true,
        location: 'Skill Book',
      });
    }

    return validations;
  }

  /**
   * Collect validation results into compliance issues and passed checks
   */
  private collectValidationResults(
    validations: Array<{ isValid: boolean; issue?: string; severity?: 'error' | 'warning'; location?: string; suggestion?: string }>,
    complianceIssues: ComplianceIssue[],
    passedChecks: string[],
    category: string
  ): void {
    validations.forEach((validation) => {
      if (!validation.isValid && validation.issue) {
        complianceIssues.push({
          category,
          severity: validation.severity || 'warning',
          description: validation.issue,
          location: validation.location || 'Unknown',
          suggestion: validation.suggestion || this.getDefaultSuggestion(category),
        });
      } else if (validation.isValid && validation.location) {
        passedChecks.push(`${category}: ${validation.location}`);
      }
    });
  }

  /**
   * Get default suggestion for a category
   */
  private getDefaultSuggestion(category: string): string {
    const suggestions: Record<string, string> = {
      'Source Validation': 'Ensure all sources are published within 5 years or mark as foundational exceptions',
      'Learning Outcomes': 'Use measurable Bloom\'s Taxonomy verbs and follow Verb+Object+Context structure',
      'Hours Distribution': 'Adjust module hours to sum to 120 with balanced distribution',
      'Citations': 'Format all citations according to APA 7th edition guidelines',
      'Structure': 'Review program structure to ensure completeness',
    };

    return suggestions[category] || 'Review and correct this issue';
  }

  /**
   * Calculate overall quality score
   * Requirement 6.5: Calculate overall quality score (0-100)
   */
  private calculateQualityScore(
    complianceIssues: ComplianceIssue[],
    passedChecks: string[]
  ): number {
    const totalChecks = complianceIssues.length + passedChecks.length;
    
    if (totalChecks === 0) {
      return 100;
    }

    // Weight errors more heavily than warnings
    const errorCount = complianceIssues.filter(i => i.severity === 'error').length;
    const warningCount = complianceIssues.filter(i => i.severity === 'warning').length;
    
    const errorPenalty = errorCount * 10;
    const warningPenalty = warningCount * 5;
    
    const score = Math.max(0, 100 - errorPenalty - warningPenalty);
    
    return Math.round(score);
  }

  /**
   * Generate recommendations based on compliance issues
   * Requirement 6.5: Generate specific recommendations for each compliance issue
   */
  private generateRecommendations(complianceIssues: ComplianceIssue[]): string[] {
    const recommendations: string[] = [];

    // Group issues by category
    const issuesByCategory = complianceIssues.reduce((acc, issue) => {
      if (!acc[issue.category]) {
        acc[issue.category] = [];
      }
      acc[issue.category].push(issue);
      return acc;
    }, {} as Record<string, ComplianceIssue[]>);

    // Generate recommendations for each category
    Object.entries(issuesByCategory).forEach(([category, issues]) => {
      const errorCount = issues.filter(i => i.severity === 'error').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;

      if (errorCount > 0) {
        recommendations.push(
          `${category}: Address ${errorCount} critical error${errorCount > 1 ? 's' : ''} immediately`
        );
      }

      if (warningCount > 0) {
        recommendations.push(
          `${category}: Review ${warningCount} warning${warningCount > 1 ? 's' : ''} for quality improvement`
        );
      }

      // Add specific recommendations for common issues
      if (category === 'Learning Outcomes') {
        const bloomsIssues = issues.filter(i => i.description.includes('Bloom'));
        if (bloomsIssues.length > 0) {
          recommendations.push(
            'Review learning outcomes to ensure they start with measurable action verbs from Bloom\'s Taxonomy'
          );
        }
      }

      if (category === 'Source Validation') {
        const dateIssues = issues.filter(i => i.description.includes('older than 5 years'));
        if (dateIssues.length > 0) {
          recommendations.push(
            'Update outdated sources or mark foundational works as exceptions in the knowledge base'
          );
        }
      }

      if (category === 'Hours Distribution') {
        recommendations.push(
          'Adjust module hours to ensure total equals 120 and distribution is balanced across modules'
        );
      }
    });

    // Add general recommendations
    if (complianceIssues.length === 0) {
      recommendations.push('Curriculum meets all AGCQ quality standards');
    } else if (complianceIssues.filter(i => i.severity === 'error').length === 0) {
      recommendations.push('Address remaining warnings to achieve excellent quality rating');
    }

    return recommendations;
  }

  /**
   * Store QA report in database
   */
  private async storeQAReport(report: QAReport): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query(
        `INSERT INTO qa_reports 
         (program_id, overall_score, compliance_issues, recommendations, passed_checks, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (program_id) 
         DO UPDATE SET 
           overall_score = $2,
           compliance_issues = $3,
           recommendations = $4,
           passed_checks = $5,
           generated_at = $6`,
        [
          report.programId,
          report.overallScore,
          JSON.stringify(report.complianceIssues),
          JSON.stringify(report.recommendations),
          JSON.stringify(report.passedChecks),
          report.generatedAt,
        ]
      );

      console.log(`QA report stored for program ${report.programId}`);
    } catch (error) {
      console.error('Failed to store QA report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get QA report for a program
   */
  async getQAReport(programId: string): Promise<QAReport | null> {
    const client = await this.db.connect();

    try {
      const result = await client.query(
        `SELECT * FROM qa_reports WHERE program_id = $1`,
        [programId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      
      return {
        programId: row.program_id,
        overallScore: row.overall_score,
        complianceIssues: row.compliance_issues,
        recommendations: row.recommendations,
        passedChecks: row.passed_checks,
        generatedAt: row.generated_at,
      };
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const qualityAssuranceService = new QualityAssuranceService();

import { SourceMetadata, SourceValidation } from '../types/knowledgeBase';

/**
 * Source Validation Service
 * Validates source credibility, publication dates, and content quality
 */
export class SourceValidationService {
  // Excluded domains (Wikipedia, blogs, AI-generated content)
  private readonly excludedDomains = [
    'wikipedia.org',
    'en.wikipedia.org',
    'medium.com',
    'blogger.com',
    'wordpress.com',
    'tumblr.com',
    'chatgpt.com',
    'bard.google.com',
    'claude.ai',
  ];

  // High credibility domains (peer-reviewed journals, professional associations)
  private readonly highCredibilityDomains = [
    'ieee.org',
    'acm.org',
    'springer.com',
    'sciencedirect.com',
    'nature.com',
    'science.org',
    'jstor.org',
    'wiley.com',
    'elsevier.com',
    'tandfonline.com',
    'sagepub.com',
    'apa.org',
    'aaai.org',
  ];

  // Professional association domains
  private readonly professionalAssociations = [
    'pmi.org',
    'shrm.org',
    'ama.org',
    'aicpa.org',
    'asme.org',
    'acs.org',
  ];

  // Maximum age for sources (5 years in milliseconds)
  private readonly maxSourceAge = 5 * 365 * 24 * 60 * 60 * 1000;

  /**
   * Validate a source against all criteria
   */
  validateSource(metadata: SourceMetadata): SourceValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate publication date
    const dateValidation = this.validatePublicationDate(metadata);
    errors.push(...dateValidation.errors);
    warnings.push(...dateValidation.warnings);

    // Validate source domain
    const domainValidation = this.validateDomain(metadata);
    errors.push(...domainValidation.errors);
    warnings.push(...domainValidation.warnings);

    // Calculate credibility score
    const credibilityScore = this.calculateCredibilityScore(metadata);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      credibilityScore,
    };
  }

  /**
   * Validate publication date (reject sources older than 5 years unless marked as foundational)
   */
  private validatePublicationDate(metadata: SourceMetadata): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const now = new Date();
    const publicationDate = new Date(metadata.publicationDate);
    const age = now.getTime() - publicationDate.getTime();

    if (age > this.maxSourceAge && !metadata.isFoundational) {
      errors.push(
        `Source is older than 5 years (published ${publicationDate.toISOString().split('T')[0]}). ` +
        'Mark as foundational if this is an exception.'
      );
    } else if (age > this.maxSourceAge && metadata.isFoundational) {
      warnings.push(
        `Source is older than 5 years but marked as foundational (published ${publicationDate.toISOString().split('T')[0]})`
      );
    }

    // Warn about future dates
    if (publicationDate > now) {
      warnings.push('Publication date is in the future');
    }

    return { errors, warnings };
  }

  /**
   * Validate source domain (exclude Wikipedia, blogs, AI-generated content)
   */
  private validateDomain(metadata: SourceMetadata): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const domain = metadata.domain.toLowerCase();

    // Check if domain is excluded
    for (const excludedDomain of this.excludedDomains) {
      if (domain.includes(excludedDomain)) {
        errors.push(
          `Source domain "${metadata.domain}" is excluded. ` +
          'Wikipedia, blogs, and AI-generated content are not allowed.'
        );
        break;
      }
    }

    // Check for blog indicators in domain
    if (domain.includes('blog') || domain.includes('personal')) {
      warnings.push('Domain appears to be a blog, which may have lower credibility');
    }

    return { errors, warnings };
  }

  /**
   * Calculate credibility score (0-100)
   * Based on source type, domain, and other factors
   */
  calculateCredibilityScore(metadata: SourceMetadata): number {
    let score = 50; // Base score

    const domain = metadata.domain.toLowerCase();

    // High credibility domains (peer-reviewed journals)
    if (this.isHighCredibilityDomain(domain)) {
      score += 40;
    }

    // Professional associations
    if (this.isProfessionalAssociation(domain)) {
      score += 30;
    }

    // Government and educational domains
    if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
      score += 25;
    }

    // Recency bonus (newer sources get higher scores)
    const recencyBonus = this.calculateRecencyBonus(metadata.publicationDate);
    score += recencyBonus;

    // Author presence bonus
    if (metadata.author && metadata.author.trim().length > 0) {
      score += 5;
    }

    // Penalty for excluded domains
    if (this.isExcludedDomain(domain)) {
      score = 0;
    }

    // Ensure score is within 0-100 range
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate recency bonus (0-10 points based on publication date)
   */
  private calculateRecencyBonus(publicationDate: Date): number {
    const now = new Date();
    const age = now.getTime() - new Date(publicationDate).getTime();
    const ageInYears = age / (365 * 24 * 60 * 60 * 1000);

    if (ageInYears < 1) return 10;
    if (ageInYears < 2) return 8;
    if (ageInYears < 3) return 6;
    if (ageInYears < 4) return 4;
    if (ageInYears < 5) return 2;
    return 0;
  }

  /**
   * Check if domain is high credibility (peer-reviewed journals)
   */
  private isHighCredibilityDomain(domain: string): boolean {
    return this.highCredibilityDomains.some(hcd => domain.includes(hcd));
  }

  /**
   * Check if domain is a professional association
   */
  private isProfessionalAssociation(domain: string): boolean {
    return this.professionalAssociations.some(pa => domain.includes(pa));
  }

  /**
   * Check if domain is excluded
   */
  private isExcludedDomain(domain: string): boolean {
    return this.excludedDomains.some(ed => domain.includes(ed));
  }

  /**
   * Batch validate multiple sources
   */
  validateSources(sources: SourceMetadata[]): SourceValidation[] {
    return sources.map(source => this.validateSource(source));
  }

  /**
   * Filter valid sources from a list
   */
  filterValidSources(sources: SourceMetadata[]): SourceMetadata[] {
    return sources.filter(source => {
      const validation = this.validateSource(source);
      return validation.isValid;
    });
  }

  /**
   * Get validation summary for multiple sources
   */
  getValidationSummary(sources: SourceMetadata[]): {
    total: number;
    valid: number;
    invalid: number;
    averageCredibility: number;
  } {
    const validations = this.validateSources(sources);
    const valid = validations.filter(v => v.isValid).length;
    const invalid = validations.length - valid;
    const averageCredibility = validations.reduce((sum, v) => sum + v.credibilityScore, 0) / validations.length;

    return {
      total: sources.length,
      valid,
      invalid,
      averageCredibility: Math.round(averageCredibility),
    };
  }
}

export const sourceValidationService = new SourceValidationService();

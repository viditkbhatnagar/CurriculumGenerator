/**
 * Quality Assurance Types
 * Types for QA validation, reports, and compliance checking
 * Implements Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

export interface QAReport {
  programId: string;
  overallScore: number; // 0-100
  complianceIssues: ComplianceIssue[];
  recommendations: string[];
  passedChecks: string[];
  generatedAt: Date;
}

export interface ComplianceIssue {
  category: string;
  severity: 'error' | 'warning';
  description: string;
  location: string;
  suggestion: string;
}

export interface SourceValidation {
  sourceId: string;
  sourceUrl: string;
  publicationDate?: Date;
  isValid: boolean;
  isException?: boolean;
  issue?: string;
  severity?: 'error' | 'warning';
}

export interface OutcomeValidation {
  outcomeText: string;
  isValid: boolean;
  issue?: string;
  severity?: 'error' | 'warning';
  location: string;
  suggestion?: string;
  bloomsLevel?: string;
}

export interface HoursValidation {
  totalHours: number;
  expectedHours: number;
  moduleHours: Array<{
    moduleCode: string;
    hours: number;
  }>;
  isValid: boolean;
  issues?: string[];
  severity?: 'error' | 'warning';
}

export interface CitationValidation {
  citation: string;
  isValid: boolean;
  issue?: string;
  severity?: 'error' | 'warning';
  location: string;
  suggestion?: string;
}

export interface StructureValidation {
  aspect: string;
  isValid: boolean;
  issue?: string;
  severity?: 'error' | 'warning';
  location: string;
}

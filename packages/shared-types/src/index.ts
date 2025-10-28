// Common types shared across all packages

export interface ProgramOverview {
  programName: string;
  qualificationLevel: string;
  qualificationType: string;
  totalCredits: number;
  industrySector: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  sheet: string;
  cell?: string;
  message: string;
}

export interface ValidationWarning {
  sheet: string;
  message: string;
}

export interface SourceMetadata {
  title: string;
  author?: string;
  publicationDate: Date;
  domain: string;
  credibilityScore: number;
  tags: string[];
}

export interface GenerationJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  estimatedCompletion: Date;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}

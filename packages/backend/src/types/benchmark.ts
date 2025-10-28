/**
 * Types for benchmarking service
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

export interface CompetitorProgram {
  id: string;
  institutionName: string;
  programName: string;
  level?: string;
  topics: CompetitorTopic[];
  structure: CompetitorStructure;
  createdAt: Date;
}

export interface CompetitorTopic {
  name: string;
  description?: string;
  hours?: number;
  moduleCode?: string;
}

export interface CompetitorStructure {
  totalHours?: number;
  modules?: CompetitorModule[];
  assessmentTypes?: string[];
  deliveryMethods?: string[];
}

export interface CompetitorModule {
  code: string;
  title: string;
  hours: number;
  topics: string[];
}

export interface CompetitorProgramInput {
  institutionName: string;
  programName: string;
  level?: string;
  topics: CompetitorTopic[];
  structure: CompetitorStructure;
}

export interface InstitutionComparison {
  institutionName: string;
  programName: string;
  similarityScore: number; // 0-100
  topicCoverage: number; // 0-100
  assessmentAlignment: number; // 0-100
  structureAlignment: number; // 0-100
}

export interface Gap {
  type: 'topic' | 'assessment' | 'structure';
  description: string;
  competitorInstitution: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface Strength {
  type: 'topic' | 'assessment' | 'structure';
  description: string;
  advantage: string;
}

export interface BenchmarkReport {
  programId: string;
  generatedAt: Date;
  comparisons: InstitutionComparison[];
  overallSimilarity: number; // 0-100, average across all comparisons
  gaps: Gap[];
  strengths: Strength[];
  recommendations: string[];
  summary: string;
}

export interface TopicComparison {
  generatedTopic: string;
  matchedCompetitorTopics: Array<{
    topic: string;
    institution: string;
    similarity: number;
  }>;
  isCovered: boolean;
}

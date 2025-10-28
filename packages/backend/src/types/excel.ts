// Excel sheet data types based on the 15 required sheets

export interface ProgramOverview {
  programName: string;
  qualificationLevel: string;
  qualificationType: string;
  totalCredits: number;
  industrySector: string;
  programAim?: string;
  targetAudience?: string;
  entryRequirements?: string;
  careerOutcomes?: string;
}

export interface CompetencyDomain {
  domain: string;
  description: string;
  skills: string[];
}

export interface LearningOutcome {
  outcomeText: string;
  knowledgeSkillCompetency: 'K' | 'S' | 'C';
  bloomLevel: string;
  assessmentCriteria?: string[];
}

export interface Module {
  moduleCode: string;
  moduleTitle: string;
  hours: number;
  moduleAim?: string;
  coreElective: 'Core' | 'Elective';
  sequenceOrder: number;
  units?: Unit[];
}

export interface Unit {
  unitTitle: string;
  hours: number;
  learningOutcomes: string[];
  indicativeContent?: string;
}

export interface TopicSource {
  topic: string;
  sourceUrl: string;
  sourceType: string;
  publicationDate?: string;
  credibilityScore?: number;
}

export interface ReadingItem {
  title: string;
  author?: string;
  publicationYear?: number;
  url?: string;
  type: 'Required' | 'Recommended';
  moduleCode?: string;
}

export interface Assessment {
  moduleCode: string;
  questionType: 'MCQ' | 'Case Study' | 'Essay' | 'Practical';
  questionText: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  learningOutcome?: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  relatedTerms?: string[];
}

export interface CaseStudy {
  title: string;
  scenario: string;
  questions: string[];
  moduleCode?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface DeliverySpecification {
  deliveryMode: 'Online' | 'Blended' | 'Face-to-face';
  duration: string;
  assessmentStrategy?: string;
  teachingMethods?: string[];
}

export interface ParsedProgramData {
  programOverview: ProgramOverview;
  competencyFramework: CompetencyDomain[];
  learningOutcomes: LearningOutcome[];
  courseFramework: Module[];
  topicSources: TopicSource[];
  readingLists: ReadingItem[];
  assessments: Assessment[];
  glossary: GlossaryTerm[];
  caseStudies: CaseStudy[];
  deliverySpecs: DeliverySpecification;
}

export interface ValidationError {
  sheet: string;
  row?: number;
  column?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

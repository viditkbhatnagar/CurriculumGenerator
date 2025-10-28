/**
 * Simulation Engine Types
 * Types for interactive workplace scenario-based learning
 */

export interface Scenario {
  scenarioId: string;
  title: string;
  context: string;
  topic: string;
  difficulty: number; // 1-5 scale
  initialState: ScenarioState;
  learningObjectives: string[];
  bestPractices: string[];
  createdAt: Date;
  metadata?: {
    industry?: string;
    roleType?: string;
    estimatedDuration?: number; // minutes
  };
}

export interface ScenarioState {
  currentSituation: string;
  availableActions: Action[];
  previousActions: StudentAction[];
  feedback: string;
  score: number; // 0-100
  isComplete: boolean;
  currentStep: number;
  totalSteps: number;
}

export interface Action {
  actionId: string;
  description: string;
  category: 'analysis' | 'communication' | 'decision' | 'implementation';
  isOptimal?: boolean; // For evaluation purposes
}

export interface StudentAction {
  actionId: string;
  description: string;
  timestamp: Date;
  score: number;
  feedback: string;
  consequences: string;
}

export interface PerformanceReport {
  scenarioId: string;
  studentId: string;
  overallScore: number; // 0-100
  completionTime: number; // seconds
  actionsCount: number;
  optimalActionsCount: number;
  categoryScores: {
    analysis: number;
    communication: number;
    decision: number;
    implementation: number;
  };
  strengths: string[];
  areasForImprovement: string[];
  detailedFeedback: string;
  recommendations: string[];
  completedAt: Date;
}

export interface ScenarioTemplate {
  templateId: string;
  name: string;
  topic: string;
  contextTemplate: string;
  situationTemplates: string[];
  actionTemplates: ActionTemplate[];
  evaluationCriteria: EvaluationCriteria;
}

export interface ActionTemplate {
  category: 'analysis' | 'communication' | 'decision' | 'implementation';
  descriptionTemplate: string;
  isOptimal: boolean;
  scoreImpact: number; // -20 to +20
}

export interface EvaluationCriteria {
  optimalPathScore: number;
  timeWeight: number;
  categoryWeights: {
    analysis: number;
    communication: number;
    decision: number;
    implementation: number;
  };
  rubric: RubricItem[];
}

export interface RubricItem {
  criterion: string;
  excellent: string; // 90-100
  good: string; // 70-89
  satisfactory: string; // 50-69
  needsImprovement: string; // 0-49
}

export interface CreateScenarioRequest {
  topic: string;
  difficulty: number;
  courseId?: string;
  industry?: string;
  roleType?: string;
}

export interface ProcessActionRequest {
  scenarioId: string;
  studentId: string;
  actionId: string;
}

export interface ScenarioProgress {
  scenarioId: string;
  studentId: string;
  currentState: ScenarioState;
  startedAt: Date;
  lastActionAt: Date;
  isComplete: boolean;
}

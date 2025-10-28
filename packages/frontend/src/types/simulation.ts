/**
 * Simulation Frontend Types
 */

export interface Scenario {
  scenarioId: string;
  title: string;
  context: string;
  topic: string;
  difficulty: number;
  initialState: ScenarioState;
  learningObjectives: string[];
  bestPractices: string[];
  metadata?: {
    industry?: string;
    roleType?: string;
    estimatedDuration?: number;
  };
}

export interface ScenarioState {
  currentSituation: string;
  availableActions: Action[];
  previousActions: StudentAction[];
  feedback: string;
  score: number;
  isComplete: boolean;
  currentStep: number;
  totalSteps: number;
}

export interface Action {
  actionId: string;
  description: string;
  category: 'analysis' | 'communication' | 'decision' | 'implementation';
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
  overallScore: number;
  completionTime: number;
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

export interface CreateScenarioRequest {
  topic: string;
  difficulty: number;
  courseId?: string;
  industry?: string;
  roleType?: string;
}

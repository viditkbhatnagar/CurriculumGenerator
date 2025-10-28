/**
 * Tutor Bot Types
 * Types for AI-powered student support chatbot
 */

export interface ChatMessage {
  id: string;
  studentId: string;
  courseId: string;
  role: 'student' | 'tutor';
  content: string;
  timestamp: Date;
  metadata?: {
    responseTime?: number;
    sourcesUsed?: string[];
    comprehensionSignal?: ComprehensionSignal;
  };
}

export interface ComprehensionSignal {
  level: 'high' | 'medium' | 'low';
  indicators: string[];
  topicsNeedingSupport: string[];
}

export interface ConversationHistory {
  studentId: string;
  courseId: string;
  messages: ChatMessage[];
  lastUpdated: Date;
}

export interface TutorResponse {
  message: string;
  suggestedResources: Resource[];
  followUpQuestions: string[];
  responseTime: number;
  comprehensionSignal?: ComprehensionSignal;
}

export interface Resource {
  id: string;
  title: string;
  type: 'reading' | 'video' | 'exercise' | 'module';
  url?: string;
  description: string;
  relevanceScore: number;
}

export interface StudentProgress {
  studentId: string;
  courseId: string;
  topicsDiscussed: string[];
  comprehensionLevels: Map<string, ComprehensionSignal>;
  resourcesEngaged: string[];
  lastInteraction: Date;
  totalInteractions: number;
}

export interface ChatRequest {
  studentId: string;
  message: string;
  courseId: string;
}

/**
 * Tutor Bot Frontend Types
 */

export interface ChatMessage {
  id: string;
  role: 'student' | 'tutor';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface TutorResponse {
  message: string;
  suggestedResources: Resource[];
  followUpQuestions: string[];
  responseTime: number;
}

export interface Resource {
  id: string;
  title: string;
  type: 'reading' | 'video' | 'exercise' | 'module';
  url?: string;
  description: string;
  relevanceScore: number;
}

export interface ChatRequest {
  studentId: string;
  message: string;
  courseId: string;
}

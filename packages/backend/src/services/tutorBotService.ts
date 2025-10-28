import { llmService } from './llmService';
import { ragEngine } from './ragEngine';
import {
  ChatMessage,
  TutorResponse,
  ConversationHistory,
  Resource,
  ComprehensionSignal,
  StudentProgress,
} from '../types/tutorBot';
import { User } from '../models/User';

/**
 * Tutor Bot Service
 * Provides AI-powered student support with context-aware responses
 * Uses MongoDB Atlas Vector Search via RAG engine
 * Implements Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */

export class TutorBotService {
  private readonly maxConversationHistory = 10;
  private readonly responseTimeout = 3000; // 3 seconds

  constructor() {
    // No longer needs database pool - uses Mongoose models
  }

  /**
   * Process student chat message and generate tutor response
   * Implements Requirements 8.1, 8.2, 8.3, 8.5
   */
  async chat(
    studentId: string,
    message: string,
    courseId: string
  ): Promise<TutorResponse> {
    const startTime = Date.now();

    try {
      // Get conversation history
      const history = await this.getConversationHistory(studentId, courseId);

      // Retrieve relevant course content using RAG
      const contexts = await ragEngine.retrieveContext(message, {
        maxSources: 5,
        minSimilarity: 0.7,
      });

      // Get student progress for adaptive responses
      const progress = await this.getStudentProgress(studentId, courseId);

      // Generate response using LLM with Socratic questioning
      const tutorMessage = await this.generateSocraticResponse(
        message,
        contexts,
        history,
        progress
      );

      // Suggest relevant resources
      const suggestedResources = await this.suggestResources(message, courseId, contexts);

      // Generate follow-up questions
      const followUpQuestions = await this.generateFollowUpQuestions(
        message,
        tutorMessage,
        progress
      );

      // Analyze comprehension signals
      const comprehensionSignal = this.analyzeComprehension(message, history);

      // Store messages in database
      await this.storeMessage(studentId, courseId, message, 'student');
      await this.storeMessage(studentId, courseId, tutorMessage, 'tutor', {
        sourcesUsed: contexts.map(c => c.sourceId),
        comprehensionSignal,
      });

      // Update student progress
      await this.updateStudentProgress(studentId, courseId, message, comprehensionSignal);

      const responseTime = Date.now() - startTime;

      return {
        message: tutorMessage,
        suggestedResources,
        followUpQuestions,
        responseTime,
        comprehensionSignal,
      };
    } catch (error) {
      console.error('Error in tutor bot chat:', error);
      throw new Error(
        `Failed to generate tutor response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate Socratic response that guides rather than answers directly
   * Implements Requirement 8.2
   */
  private async generateSocraticResponse(
    studentMessage: string,
    contexts: any[],
    history: ConversationHistory,
    progress: StudentProgress
  ): Promise<string> {
    // Build context from retrieved sources
    const contextText = contexts
      .map((ctx, idx) => `[Source ${idx + 1}]: ${ctx.content}`)
      .join('\n\n');

    // Build conversation context
    const conversationContext = history.messages
      .slice(-6) // Last 3 exchanges (6 messages)
      .map(msg => `${msg.role === 'student' ? 'Student' : 'Tutor'}: ${msg.content}`)
      .join('\n');

    // Determine difficulty level based on student performance
    const difficultyLevel = this.determineDifficultyLevel(progress);

    // Create Socratic system prompt
    const systemPrompt = `You are an AI tutor using the Socratic method to guide student learning. Your role is to:

1. Ask thought-provoking questions rather than providing direct answers
2. Guide students to discover answers themselves through reasoning
3. Break down complex concepts into manageable steps
4. Encourage critical thinking and deeper understanding
5. Adapt your language and complexity to the student's comprehension level: ${difficultyLevel}

Guidelines:
- Use the provided course content as reference but don't quote it directly
- Ask 1-2 guiding questions to help the student think through the problem
- Provide hints or scaffolding when the student seems stuck
- Acknowledge correct reasoning and gently redirect misconceptions
- Keep responses concise (2-3 paragraphs maximum)
- Be encouraging and supportive

Course Content:
${contextText}

Recent Conversation:
${conversationContext}`;

    const userPrompt = `Student asks: "${studentMessage}"

Respond using the Socratic method to guide their learning.`;

    // Generate response with timeout
    const response = await llmService.generateContent(userPrompt, systemPrompt, {
      temperature: 0.7,
      maxTokens: 500,
      timeout: this.responseTimeout,
    });

    return response;
  }

  /**
   * Suggest relevant course materials based on query topic
   * Implements Requirement 8.1, 8.4
   */
  private async suggestResources(
    query: string,
    courseId: string,
    contexts: any[]
  ): Promise<Resource[]> {
    const client = await this.db.connect();

    try {
      // Get course modules and learning materials
      const result = await client.query(
        `SELECT 
          m.id,
          m.module_title as title,
          m.module_code,
          lo.outcome_text,
          'module' as type
         FROM modules m
         LEFT JOIN learning_outcomes lo ON lo.module_id = m.id
         WHERE m.program_id = $1
         LIMIT 10`,
        [courseId]
      );

      // Calculate relevance based on query and context
      const resources: Resource[] = result.rows.map(row => {
        const relevanceScore = this.calculateResourceRelevance(
          query,
          row.title + ' ' + (row.outcome_text || ''),
          contexts
        );

        return {
          id: row.id,
          title: row.title,
          type: 'module',
          description: row.outcome_text || `Module: ${row.module_code}`,
          relevanceScore,
        };
      });

      // Sort by relevance and return top 3
      return resources
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3);
    } finally {
      client.release();
    }
  }

  /**
   * Generate follow-up questions to deepen understanding
   * Implements Requirement 8.1, 8.4
   */
  private async generateFollowUpQuestions(
    studentMessage: string,
    tutorResponse: string,
    progress: StudentProgress
  ): Promise<string[]> {
    const systemPrompt = `Generate 2-3 follow-up questions that will deepen the student's understanding of the topic they're discussing. 

Questions should:
- Build on the current conversation
- Encourage deeper thinking
- Connect to related concepts
- Be appropriate for the student's comprehension level

Return only the questions, one per line.`;

    const userPrompt = `Student asked: "${studentMessage}"
Tutor responded: "${tutorResponse}"

Generate follow-up questions:`;

    try {
      const response = await llmService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.8,
        maxTokens: 200,
        timeout: 2000,
      });

      // Parse questions from response
      const questions = response
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(q => q.endsWith('?'))
        .slice(0, 3);

      return questions;
    } catch (error) {
      console.error('Error generating follow-up questions:', error);
      // Return default questions if generation fails
      return [
        'What aspects of this topic would you like to explore further?',
        'Can you think of a real-world example where this concept applies?',
      ];
    }
  }

  /**
   * Analyze student comprehension from message patterns
   * Implements Requirement 8.4
   */
  private analyzeComprehension(
    message: string,
    history: ConversationHistory
  ): ComprehensionSignal {
    const indicators: string[] = [];
    let level: 'high' | 'medium' | 'low' = 'medium';

    // Check message length and complexity
    const wordCount = message.split(/\s+/).length;
    if (wordCount < 5) {
      indicators.push('Very brief responses');
      level = 'low';
    }

    // Check for question words (indicates confusion)
    const questionWords = ['what', 'why', 'how', 'when', 'where', 'confused', 'don\'t understand'];
    const hasQuestions = questionWords.some(word => 
      message.toLowerCase().includes(word)
    );
    if (hasQuestions) {
      indicators.push('Asking clarifying questions');
    }

    // Check for repetition of topics (indicates struggle)
    const recentTopics = history.messages
      .slice(-6)
      .map(m => this.extractTopics(m.content))
      .flat();
    
    const currentTopics = this.extractTopics(message);
    const repeatedTopics = currentTopics.filter(topic =>
      recentTopics.filter(t => t === topic).length > 2
    );

    if (repeatedTopics.length > 0) {
      indicators.push('Revisiting same topics');
      level = 'low';
    }

    // Check for understanding indicators
    const understandingWords = ['understand', 'got it', 'makes sense', 'i see', 'clear'];
    const showsUnderstanding = understandingWords.some(word =>
      message.toLowerCase().includes(word)
    );
    if (showsUnderstanding) {
      indicators.push('Expressing understanding');
      level = 'high';
    }

    return {
      level,
      indicators,
      topicsNeedingSupport: repeatedTopics,
    };
  }

  /**
   * Extract topics from message text
   */
  private extractTopics(text: string): string[] {
    // Simple topic extraction - in production, use NLP
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    
    return words
      .filter(word => word.length > 4 && !stopWords.has(word))
      .slice(0, 5);
  }

  /**
   * Calculate resource relevance score
   */
  private calculateResourceRelevance(
    query: string,
    resourceText: string,
    contexts: any[]
  ): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const resourceTerms = resourceText.toLowerCase().split(/\s+/);

    // Calculate term overlap
    let matchCount = 0;
    for (const term of queryTerms) {
      if (resourceTerms.some(rt => rt.includes(term) || term.includes(rt))) {
        matchCount++;
      }
    }

    // Normalize score
    return matchCount / queryTerms.length;
  }

  /**
   * Determine difficulty level based on student performance
   * Implements Requirement 8.3
   */
  private determineDifficultyLevel(progress: StudentProgress): string {
    // Analyze comprehension levels from progress
    const comprehensionLevels = Array.from(progress.comprehensionLevels.values());
    
    if (comprehensionLevels.length === 0) {
      return 'beginner';
    }

    const highCount = comprehensionLevels.filter(c => c.level === 'high').length;
    const lowCount = comprehensionLevels.filter(c => c.level === 'low').length;
    const total = comprehensionLevels.length;

    if (highCount / total > 0.7) {
      return 'advanced';
    } else if (lowCount / total > 0.5) {
      return 'beginner';
    } else {
      return 'intermediate';
    }
  }

  /**
   * Get conversation history for a student
   * Maintains last 10 messages
   * Implements Requirement 8.1, 8.4
   */
  async getConversationHistory(
    studentId: string,
    courseId: string
  ): Promise<ConversationHistory> {
    const client = await this.db.connect();

    try {
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS tutor_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          student_id UUID NOT NULL,
          course_id UUID NOT NULL,
          role VARCHAR(20) NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tutor_conversations_student_course 
        ON tutor_conversations(student_id, course_id, created_at DESC)
      `);

      // Get last 10 messages
      const result = await client.query(
        `SELECT id, student_id, course_id, role, content, metadata, created_at
         FROM tutor_conversations
         WHERE student_id = $1 AND course_id = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [studentId, courseId, this.maxConversationHistory]
      );

      const messages: ChatMessage[] = result.rows.reverse().map(row => ({
        id: row.id,
        studentId: row.student_id,
        courseId: row.course_id,
        role: row.role,
        content: row.content,
        timestamp: row.created_at,
        metadata: row.metadata,
      }));

      return {
        studentId,
        courseId,
        messages,
        lastUpdated: messages.length > 0 ? messages[messages.length - 1].timestamp : new Date(),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Store a chat message in the database
   */
  private async storeMessage(
    studentId: string,
    courseId: string,
    content: string,
    role: 'student' | 'tutor',
    metadata?: any
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query(
        `INSERT INTO tutor_conversations (student_id, course_id, role, content, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [studentId, courseId, role, content, metadata ? JSON.stringify(metadata) : null]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get student progress and comprehension tracking
   * Implements Requirement 8.4
   */
  async getStudentProgress(
    studentId: string,
    courseId: string
  ): Promise<StudentProgress> {
    const client = await this.db.connect();

    try {
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS student_progress (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          student_id UUID NOT NULL,
          course_id UUID NOT NULL,
          topics_discussed JSONB DEFAULT '[]',
          comprehension_levels JSONB DEFAULT '{}',
          resources_engaged JSONB DEFAULT '[]',
          last_interaction TIMESTAMP DEFAULT NOW(),
          total_interactions INTEGER DEFAULT 0,
          UNIQUE(student_id, course_id)
        )
      `);

      const result = await client.query(
        `SELECT * FROM student_progress
         WHERE student_id = $1 AND course_id = $2`,
        [studentId, courseId]
      );

      if (result.rows.length === 0) {
        // Create new progress record
        await client.query(
          `INSERT INTO student_progress (student_id, course_id)
           VALUES ($1, $2)`,
          [studentId, courseId]
        );

        return {
          studentId,
          courseId,
          topicsDiscussed: [],
          comprehensionLevels: new Map(),
          resourcesEngaged: [],
          lastInteraction: new Date(),
          totalInteractions: 0,
        };
      }

      const row = result.rows[0];
      const comprehensionLevelsData = row.comprehension_levels || {};
      const comprehensionLevels = new Map<string, ComprehensionSignal>(
        Object.entries(comprehensionLevelsData).map(([key, value]) => [
          key,
          value as ComprehensionSignal,
        ])
      );

      return {
        studentId: row.student_id,
        courseId: row.course_id,
        topicsDiscussed: row.topics_discussed || [],
        comprehensionLevels,
        resourcesEngaged: row.resources_engaged || [],
        lastInteraction: row.last_interaction,
        totalInteractions: row.total_interactions,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update student progress after interaction
   */
  private async updateStudentProgress(
    studentId: string,
    courseId: string,
    message: string,
    comprehensionSignal: ComprehensionSignal
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      const topics = this.extractTopics(message);

      await client.query(
        `UPDATE student_progress
         SET 
           topics_discussed = topics_discussed || $3::jsonb,
           comprehension_levels = comprehension_levels || $4::jsonb,
           last_interaction = NOW(),
           total_interactions = total_interactions + 1
         WHERE student_id = $1 AND course_id = $2`,
        [
          studentId,
          courseId,
          JSON.stringify(topics),
          JSON.stringify({ [topics[0] || 'general']: comprehensionSignal }),
        ]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Track resource engagement
   * Implements Requirement 8.4
   */
  async trackResourceEngagement(
    studentId: string,
    courseId: string,
    resourceId: string
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query(
        `UPDATE student_progress
         SET resources_engaged = 
           CASE 
             WHEN resources_engaged @> $3::jsonb THEN resources_engaged
             ELSE resources_engaged || $3::jsonb
           END
         WHERE student_id = $1 AND course_id = $2`,
        [studentId, courseId, JSON.stringify([resourceId])]
      );
    } finally {
      client.release();
    }
  }
}

export const createTutorBotService = (db: Pool) => new TutorBotService(db);

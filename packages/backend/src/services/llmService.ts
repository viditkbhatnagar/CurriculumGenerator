import { openaiService } from './openaiService';

/**
 * LLM Service
 * Wrapper for unified OpenAI service with circuit breaker pattern
 * Implements Requirements 5.1, 5.2, 5.4
 */

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  timeout?: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export interface PromptTemplate {
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

// Circuit breaker states
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold = 5;
  private readonly successThreshold = 2;
  private readonly timeout = 60000; // 60 seconds

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN. Service temporarily unavailable.');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

export class LLMService {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Generate content using GPT-4 with retry logic
   * Implements timeout and circuit breaker pattern
   */
  async generateContent(
    prompt: string,
    systemPrompt?: string,
    options: LLMOptions = {}
  ): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      return await openaiService.generateContent(prompt, systemPrompt, options);
    });
  }

  /**
   * Generate content with streaming for better UX
   * Implements streaming responses
   */
  async generateContentStream(
    prompt: string,
    systemPrompt: string | undefined,
    callback: StreamCallback,
    options: LLMOptions = {}
  ): Promise<void> {
    return this.circuitBreaker.execute(async () => {
      return await openaiService.generateContentStream(prompt, systemPrompt, callback, options);
    });
  }

  /**
   * Generate structured JSON output
   * Useful for skill mappings and structured data generation
   */
  async generateStructuredOutput<T>(
    prompt: string,
    systemPrompt: string,
    options: LLMOptions = {}
  ): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      return await openaiService.generateStructuredContent<T>(prompt, systemPrompt, options);
    });
  }

  /**
   * Get circuit breaker state for monitoring
   */
  getCircuitBreakerState(): CircuitState {
    return this.circuitBreaker.getState();
  }
}

// Singleton instance
export const llmService = new LLMService();


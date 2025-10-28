import OpenAI from 'openai';
import config from '../config';
import { loggingService } from './loggingService';
import { monitoringService } from './monitoringService';
import { errorTrackingService } from './errorTrackingService';

/**
 * Unified OpenAI Service
 * Consolidates all OpenAI API interactions for embeddings and content generation
 * Implements Requirements 5.1, 5.2, 5.3, 5.4
 */

export interface OpenAIGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  responseFormat?: 'text' | 'json_object';
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export class OpenAIService {
  private client: OpenAI;
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second for exponential backoff

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      timeout: this.defaultTimeout,
      maxRetries: 0, // We handle retries manually for better control
    });
  }

  /**
   * Generate embedding for a single text using text-embedding-3-large
   * Implements Requirement 5.2
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now();

    return this.retryWithExponentialBackoff(async () => {
      try {
        const response = await this.client.embeddings.create({
          model: config.openai.embeddingModel,
          input: text,
          dimensions: 1536, // Using 1536 dimensions for compatibility
        });

        const embedding = response.data[0].embedding;
        
        // Record metrics
        const duration = Date.now() - startTime;
        const tokens = response.usage?.total_tokens || 0;
        const cost = this.calculateEmbeddingCost(tokens);
        
        loggingService.logLLMCall('openai', config.openai.embeddingModel, tokens, cost, duration);
        monitoringService.recordLLMCost('openai', config.openai.embeddingModel, tokens, cost);

        return embedding;
      } catch (error) {
        errorTrackingService.captureLLMError(
          error as Error,
          'openai',
          config.openai.embeddingModel,
          text.substring(0, 100)
        );
        throw error;
      }
    });
  }

  /**
   * Generate embeddings for multiple texts in batch
   * Implements Requirement 5.3 - batch processing
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // OpenAI allows up to 2048 inputs per request, but we'll use 100 for safety
    const batchSize = 100;
    const results: number[][] = [];
    const startTime = Date.now();

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const batchResults = await this.retryWithExponentialBackoff(async () => {
        try {
          const response = await this.client.embeddings.create({
            model: config.openai.embeddingModel,
            input: batch,
            dimensions: 1536,
          });

          // Record metrics for batch
          const duration = Date.now() - startTime;
          const tokens = response.usage?.total_tokens || 0;
          const cost = this.calculateEmbeddingCost(tokens);
          
          loggingService.logLLMCall('openai', config.openai.embeddingModel, tokens, cost, duration);
          monitoringService.recordLLMCost('openai', config.openai.embeddingModel, tokens, cost);

          return response.data.map(d => d.embedding);
        } catch (error) {
          errorTrackingService.captureLLMError(
            error as Error,
            'openai',
            config.openai.embeddingModel,
            `Batch of ${batch.length} texts`
          );
          throw error;
        }
      });

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Generate content using GPT-4-turbo
   * Implements Requirement 5.1
   */
  async generateContent(
    prompt: string,
    systemPrompt?: string,
    options: OpenAIGenerateOptions = {}
  ): Promise<string> {
    const {
      model = config.openai.chatModel,
      temperature = 0.7,
      maxTokens = 2000,
      timeout = this.defaultTimeout,
    } = options;

    const startTime = Date.now();

    return this.retryWithExponentialBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await this.client.chat.completions.create(
          {
            model,
            messages: [
              ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
              { role: 'user' as const, content: prompt },
            ],
            temperature,
            max_tokens: maxTokens,
          },
          { signal: controller.signal as any }
        );

        clearTimeout(timeoutId);

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content generated from OpenAI');
        }

        // Record metrics
        const duration = Date.now() - startTime;
        const tokens = response.usage?.total_tokens || 0;
        const cost = this.calculateChatCost(tokens, model);
        
        loggingService.logLLMCall('openai', model, tokens, cost, duration);
        monitoringService.recordLLMCost('openai', model, tokens, cost);

        return content;
      } catch (error) {
        clearTimeout(timeoutId);
        
        errorTrackingService.captureLLMError(
          error as Error,
          'openai',
          model,
          prompt.substring(0, 100)
        );
        
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`OpenAI request timed out after ${timeout}ms`);
        }
        throw error;
      }
    });
  }

  /**
   * Generate structured JSON content
   * Implements Requirement 5.4
   */
  async generateStructuredContent<T>(
    prompt: string,
    systemPrompt: string,
    options: OpenAIGenerateOptions = {}
  ): Promise<T> {
    const {
      model = config.openai.chatModel,
      temperature = 0.7,
      maxTokens = 2000,
      timeout = this.defaultTimeout,
    } = options;

    const startTime = Date.now();

    return this.retryWithExponentialBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await this.client.chat.completions.create(
          {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
          },
          { signal: controller.signal as any }
        );

        clearTimeout(timeoutId);

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content generated from OpenAI');
        }

        // Record metrics
        const duration = Date.now() - startTime;
        const tokens = response.usage?.total_tokens || 0;
        const cost = this.calculateChatCost(tokens, model);
        
        loggingService.logLLMCall('openai', model, tokens, cost, duration);
        monitoringService.recordLLMCost('openai', model, tokens, cost);

        return JSON.parse(content) as T;
      } catch (error) {
        clearTimeout(timeoutId);
        
        errorTrackingService.captureLLMError(
          error as Error,
          'openai',
          model,
          prompt.substring(0, 100)
        );
        
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`OpenAI request timed out after ${timeout}ms`);
        }
        throw error;
      }
    });
  }

  /**
   * Generate content with streaming for better UX
   */
  async generateContentStream(
    prompt: string,
    systemPrompt: string | undefined,
    callback: StreamCallback,
    options: OpenAIGenerateOptions = {}
  ): Promise<void> {
    const {
      model = config.openai.chatModel,
      temperature = 0.7,
      maxTokens = 2000,
      timeout = this.defaultTimeout,
    } = options;

    return this.retryWithExponentialBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const stream = await this.client.chat.completions.create(
          {
            model,
            messages: [
              ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
              { role: 'user' as const, content: prompt },
            ],
            temperature,
            max_tokens: maxTokens,
            stream: true,
          },
          { signal: controller.signal as any }
        );

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            callback({ content, done: false });
          }
        }

        callback({ content: '', done: true });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        
        errorTrackingService.captureLLMError(
          error as Error,
          'openai',
          model,
          prompt.substring(0, 100)
        );
        
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`OpenAI streaming request timed out after ${timeout}ms`);
        }
        throw error;
      }
    });
  }

  /**
   * Retry logic with exponential backoff
   * Implements Requirement 5.3 - retry logic
   */
  private async retryWithExponentialBackoff<T>(
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      // Check if we should retry
      if (attempt >= this.maxRetries || !this.isRetryableError(error)) {
        throw error;
      }

      // Calculate exponential backoff delay
      const delay = this.baseDelay * Math.pow(2, attempt - 1);
      
      console.warn(
        `OpenAI request failed (attempt ${attempt}/${this.maxRetries}), ` +
        `retrying in ${delay}ms...`,
        error instanceof Error ? error.message : 'Unknown error'
      );

      await this.sleep(delay);
      return this.retryWithExponentialBackoff(fn, attempt + 1);
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Retry on rate limits, timeouts, and server errors
    if (error instanceof OpenAI.APIError) {
      return (
        error.status === 429 || // Rate limit
        error.status === 500 || // Server error
        error.status === 502 || // Bad gateway
        error.status === 503 || // Service unavailable
        error.status === 504    // Gateway timeout
      );
    }

    // Retry on timeout errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('econnrefused')
      );
    }

    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate cost for embedding API calls
   * text-embedding-3-large: $0.00013 per 1K tokens
   */
  private calculateEmbeddingCost(tokens: number): number {
    return (tokens / 1000) * 0.00013;
  }

  /**
   * Calculate cost for chat completion API calls
   */
  private calculateChatCost(tokens: number, model: string): number {
    const costPer1kTokens: Record<string, number> = {
      'gpt-4': 0.045, // Average of input/output
      'gpt-4-turbo': 0.02,
      'gpt-4-turbo-preview': 0.02,
      'gpt-3.5-turbo': 0.002,
    };

    const rate = costPer1kTokens[model] || 0.02;
    return (tokens / 1000) * rate;
  }

  /**
   * Get embedding dimensions for the current model
   */
  getEmbeddingDimensions(): number {
    // text-embedding-3-large supports up to 3072, but we use 1536 for compatibility
    return 1536;
  }
}

// Singleton instance
export const openaiService = new OpenAIService();

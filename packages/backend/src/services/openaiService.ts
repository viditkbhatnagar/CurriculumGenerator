import OpenAI from 'openai';
import config from '../config';
import { loggingService } from './loggingService';
import { monitoringService } from './monitoringService';
import { errorTrackingService } from './errorTrackingService';
import { analyticsStorageService } from './analyticsStorageService';

/**
 * Unified OpenAI Service
 * Consolidates all OpenAI API interactions for embeddings and content generation
 * Implements Requirements 5.1, 5.2, 5.3, 5.4
 */

export interface OpenAIGenerateOptions {
  model?: string;
  maxTokens?: number;
  timeout?: number;
  responseFormat?: 'text' | 'json_object';
  // Note: temperature is not supported by GPT-5 (only default value 1 is allowed)
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export class OpenAIService {
  private client: OpenAI;
  private readonly defaultTimeout = 180000; // 180 seconds (3 minutes) for complex generation
  private readonly maxRetries = 5; // Increased retries for curriculum generation
  private readonly baseDelay = 2000; // 2 seconds for exponential backoff
  private initialized = false;

  constructor() {
    const apiKey = config.openai.apiKey;
    
    if (!apiKey) {
      console.error('[OpenAI] ERROR: OPENAI_API_KEY is not set!');
      loggingService.error('OpenAI API key is not configured', {
        hasKey: false,
        model: config.openai.chatModel,
      });
    } else {
      console.log(`[OpenAI] Initialized with model: ${config.openai.chatModel}, key: ${apiKey.substring(0, 10)}...`);
    }
    
    this.client = new OpenAI({
      apiKey: apiKey || 'missing-key',
      timeout: 180000, // 180 seconds (3 minutes) for complex curriculum generation
      maxRetries: 0, // We handle retries manually for better control
    });
  }

  /**
   * Verify OpenAI connection and model availability
   */
  async verifyConnection(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: config.openai.chatModel,
        messages: [{ role: 'user', content: 'Hello' }],
        max_completion_tokens: 5,
      });
      console.log(`[OpenAI] Connection verified - Model ${config.openai.chatModel} is working`);
      this.initialized = true;
      return true;
    } catch (error: any) {
      console.error(`[OpenAI] Connection FAILED: ${error.message}`);
      loggingService.error('OpenAI connection verification failed', {
        error: error.message,
        model: config.openai.chatModel,
        code: error.code,
        status: error.status,
      });
      return false;
    }
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

        // Store in database for historical tracking
        analyticsStorageService
          .recordTokenUsage({
            tokensUsed: tokens,
            provider: 'openai',
            model: config.openai.embeddingModel,
            cost: cost,
          })
          .catch((err) => loggingService.error('Failed to store token analytics', { error: err }));

        analyticsStorageService
          .recordApiCost({
            cost: cost,
            provider: 'openai',
            model: config.openai.embeddingModel,
            tokensUsed: tokens,
          })
          .catch((err) => loggingService.error('Failed to store cost analytics', { error: err }));

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

          // Store in database
          analyticsStorageService
            .recordTokenUsage({
              tokensUsed: tokens,
              provider: 'openai',
              model: config.openai.embeddingModel,
              cost: cost,
            })
            .catch((err) =>
              loggingService.error('Failed to store token analytics', { error: err })
            );

          analyticsStorageService
            .recordApiCost({
              cost: cost,
              provider: 'openai',
              model: config.openai.embeddingModel,
              tokensUsed: tokens,
            })
            .catch((err) => loggingService.error('Failed to store cost analytics', { error: err }));

          return response.data.map((d) => d.embedding);
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
   * Generate content using GPT-5
   * Implements Requirement 5.1
   *
   * GPT-5 Features:
   * - Enhanced reasoning capabilities
   * - Improved contextual understanding
   * - Multimodal processing support
   * - Supports streaming, structured outputs, prompt caching
   */
  async generateContent(
    prompt: string,
    systemPrompt?: string,
    options: OpenAIGenerateOptions = {}
  ): Promise<string> {
    const {
      model = config.openai.chatModel, // Default: gpt-5
      maxTokens = 4000, // GPT-5 supports larger context
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
            max_completion_tokens: maxTokens,
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

        // Store in database
        analyticsStorageService
          .recordTokenUsage({
            tokensUsed: tokens,
            provider: 'openai',
            model: model,
            cost: cost,
          })
          .catch((err) => loggingService.error('Failed to store token analytics', { error: err }));

        analyticsStorageService
          .recordApiCost({
            cost: cost,
            provider: 'openai',
            model: model,
            tokensUsed: tokens,
          })
          .catch((err) => loggingService.error('Failed to store cost analytics', { error: err }));

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
   * GPT-5 has native structured output support
   */
  async generateStructuredContent<T>(
    prompt: string,
    systemPrompt: string,
    options: OpenAIGenerateOptions = {}
  ): Promise<T> {
    const {
      model = config.openai.chatModel, // Default: gpt-5
      maxTokens = 4000, // GPT-5 supports larger context
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
            max_completion_tokens: maxTokens,
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

        // Store in database
        analyticsStorageService
          .recordTokenUsage({
            tokensUsed: tokens,
            provider: 'openai',
            model: model,
            cost: cost,
          })
          .catch((err) => loggingService.error('Failed to store token analytics', { error: err }));

        analyticsStorageService
          .recordApiCost({
            cost: cost,
            provider: 'openai',
            model: model,
            tokensUsed: tokens,
          })
          .catch((err) => loggingService.error('Failed to store cost analytics', { error: err }));

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
   * GPT-5 has optimized streaming support
   */
  async generateContentStream(
    prompt: string,
    systemPrompt: string | undefined,
    callback: StreamCallback,
    options: OpenAIGenerateOptions = {}
  ): Promise<void> {
    const {
      model = config.openai.chatModel, // Default: gpt-5
      maxTokens = 4000, // GPT-5 supports larger context
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
            max_completion_tokens: maxTokens,
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
        error.status === 504 // Gateway timeout
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
    return new Promise((resolve) => setTimeout(resolve, ms));
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
   * Updated for GPT-5 models (August 2025)
   * Pricing per 1M tokens: gpt-5 ($1.25 in / $10 out), gpt-5-mini ($0.25 in / $2 out), gpt-5-nano ($0.05 in / $0.40 out)
   */
  private calculateChatCost(tokens: number, model: string): number {
    // Cost per 1K tokens (average of input/output)
    const costPer1kTokens: Record<string, number> = {
      // GPT-5 models (per 1K = per 1M / 1000)
      'gpt-5': 0.005625, // ($1.25 + $10) / 2 / 1000 = avg $5.625/1M = $0.005625/1K
      'gpt-5-mini': 0.001125, // ($0.25 + $2) / 2 / 1000 = avg $1.125/1M = $0.001125/1K
      'gpt-5-nano': 0.000225, // ($0.05 + $0.40) / 2 / 1000 = avg $0.225/1M = $0.000225/1K
      // Legacy GPT-4 models
      'gpt-4': 0.045,
      'gpt-4-turbo': 0.02,
      'gpt-4-turbo-preview': 0.02,
      'gpt-4o': 0.00625, // ($2.50 + $10) / 2 / 1000
      'gpt-4o-mini': 0.000375, // ($0.15 + $0.60) / 2 / 1000
      'gpt-3.5-turbo': 0.002,
    };

    const rate = costPer1kTokens[model] || 0.005625; // Default to gpt-5
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

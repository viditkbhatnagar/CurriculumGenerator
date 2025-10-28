import { llmService, LLMOptions } from './llmService';
import { cacheService, CacheNamespace } from './cacheService';
import crypto from 'crypto';

/**
 * LLM Batch Service
 * Implements request batching for LLM API calls to optimize performance and costs
 * Implements Requirement 12.1 (request batching for LLM API calls)
 */

interface BatchRequest {
  id: string;
  prompt: string;
  systemPrompt?: string;
  options?: LLMOptions;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

interface CachedLLMResponse {
  content: string;
  timestamp: number;
}

export class LLMBatchService {
  private queue: BatchRequest[] = [];
  private processing: boolean = false;
  private readonly batchSize: number = 5; // Process 5 requests at a time
  private readonly batchDelay: number = 100; // Wait 100ms before processing batch
  private batchTimer: NodeJS.Timeout | null = null;

  /**
   * Generate cache key for LLM request
   */
  private generateCacheKey(prompt: string, systemPrompt?: string, options?: LLMOptions): string {
    const keyData = {
      prompt,
      systemPrompt,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    };
    const keyString = JSON.stringify(keyData);
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Generate content with batching and caching
   */
  async generateContent(
    prompt: string,
    systemPrompt?: string,
    options?: LLMOptions
  ): Promise<string> {
    // Check cache first
    const cacheKey = this.generateCacheKey(prompt, systemPrompt, options);
    const cached = await cacheService.get<CachedLLMResponse>(cacheKey, {
      namespace: CacheNamespace.LLM_RESPONSE,
    });

    if (cached) {
      return cached.content;
    }

    // Create a promise that will be resolved when the batch is processed
    return new Promise<string>((resolve, reject) => {
      const request: BatchRequest = {
        id: crypto.randomUUID(),
        prompt,
        systemPrompt,
        options,
        resolve,
        reject,
      };

      // Add to queue
      this.queue.push(request);

      // Schedule batch processing
      this.scheduleBatchProcessing();
    });
  }

  /**
   * Schedule batch processing with debouncing
   */
  private scheduleBatchProcessing(): void {
    // Clear existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // If queue is full, process immediately
    if (this.queue.length >= this.batchSize) {
      this.processBatch();
      return;
    }

    // Otherwise, wait for more requests
    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.batchDelay);
  }

  /**
   * Process a batch of requests
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Take up to batchSize requests from queue
      const batch = this.queue.splice(0, this.batchSize);

      // Process requests in parallel (but still respecting rate limits)
      const results = await Promise.allSettled(
        batch.map(async (request) => {
          try {
            const content = await llmService.generateContent(
              request.prompt,
              request.systemPrompt,
              request.options
            );

            // Cache the result
            const cacheKey = this.generateCacheKey(
              request.prompt,
              request.systemPrompt,
              request.options
            );
            await cacheService.set(
              cacheKey,
              { content, timestamp: Date.now() },
              { namespace: CacheNamespace.LLM_RESPONSE }
            );

            request.resolve(content);
          } catch (error) {
            request.reject(error instanceof Error ? error : new Error('Unknown error'));
          }
        })
      );

      // If there are more requests in queue, schedule next batch
      if (this.queue.length > 0) {
        this.scheduleBatchProcessing();
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Generate structured output with batching and caching
   */
  async generateStructuredOutput<T>(
    prompt: string,
    systemPrompt: string,
    options?: LLMOptions
  ): Promise<T> {
    // Check cache first
    const cacheKey = this.generateCacheKey(prompt, systemPrompt, options);
    const cached = await cacheService.get<CachedLLMResponse>(cacheKey, {
      namespace: CacheNamespace.LLM_RESPONSE,
    });

    if (cached) {
      return JSON.parse(cached.content) as T;
    }

    // For structured output, we don't batch since it uses different API parameters
    const result = await llmService.generateStructuredOutput<T>(
      prompt,
      systemPrompt,
      options
    );

    // Cache the result
    await cacheService.set(
      cacheKey,
      { content: JSON.stringify(result), timestamp: Date.now() },
      { namespace: CacheNamespace.LLM_RESPONSE }
    );

    return result;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueLength: number;
    processing: boolean;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
    };
  }

  /**
   * Clear the queue (useful for testing or emergency situations)
   */
  clearQueue(): void {
    // Reject all pending requests
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'));
    }
    this.queue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}

// Singleton instance
export const llmBatchService = new LLMBatchService();

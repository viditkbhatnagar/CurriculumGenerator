import { ragEngine } from './ragEngine';
import { llmService, LLMOptions, StreamCallback } from './llmService';
import { getTemplate, PromptTemplate } from './promptTemplates';
import { Context, RetrievalOptions, ContentWithCitations } from '../types/rag';
import { createClient } from 'redis';
import config from '../config';

/**
 * Content Generation Service
 * Integrates RAG engine with LLM for context-aware content generation
 * Uses MongoDB Atlas Vector Search via RAG engine
 * Implements Requirements 2.5, 3.5, 5.1
 */

export interface GenerationRequest {
  templateName: string;
  templateParams: any;
  retrievalQuery: string;
  retrievalOptions?: RetrievalOptions;
  llmOptions?: LLMOptions;
  useCache?: boolean;
}

export interface GenerationResult {
  content: string;
  citations: Array<{ sourceId: string; citationText: string; position: number }>;
  sources: Array<any>;
  usedSources: string[];
  confidence: number;
  cached: boolean;
}

export interface FactCheckResult {
  isAccurate: boolean;
  issues: Array<{
    claim: string;
    issue: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  overallScore: number;
}

export class ContentGenerationService {
  private redisClient: ReturnType<typeof createClient>;
  private readonly cachePrefix = 'content_gen:';
  private readonly cacheTTL = 86400; // 24 hours

  constructor() {
    this.redisClient = createClient({ url: config.redis.url });
    this.redisClient.connect().catch(console.error);
  }

  /**
   * Generate content with context from RAG engine
   * Implements context-aware generation with source attribution
   */
  async generateContent(request: GenerationRequest): Promise<GenerationResult> {
    const {
      templateName,
      templateParams,
      retrievalQuery,
      retrievalOptions = {},
      llmOptions = {},
      useCache = true,
    } = request;

    // Check cache first
    if (useCache) {
      const cached = await this.getCachedContent(request);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    // Get prompt template
    const template = getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Retrieve relevant context from RAG engine
    const contexts = await ragEngine.retrieveContext(retrievalQuery, {
      maxSources: 10,
      minSimilarity: 0.75,
      ...retrievalOptions,
    });

    if (contexts.length === 0) {
      // Fallback: try with lower similarity threshold
      const fallbackContexts = await ragEngine.retrieveContext(retrievalQuery, {
        ...retrievalOptions,
        minSimilarity: 0.6,
        maxSources: 5,
      });

      if (fallbackContexts.length === 0) {
        throw new Error('No relevant sources found for content generation');
      }

      contexts.push(...fallbackContexts);
    }

    // Prepare sources with citations for prompt
    const sourcesWithCitations = await this.prepareSourcesForPrompt(contexts);

    // Build user prompt with sources
    const userPrompt = template.buildUserPrompt({
      ...templateParams,
      sources: sourcesWithCitations,
    });

    // Generate content using LLM
    const generatedText = await llmService.generateContent(
      userPrompt,
      template.systemPrompt,
      llmOptions
    );

    // Extract used source IDs
    const usedSourceIds = contexts.map(c => c.sourceId);

    // Perform fact-checking
    const factCheckResult = await this.factCheck(generatedText, contexts);

    // Generate citations
    const contentWithCitations = await ragEngine.attributeSources(
      generatedText,
      contexts
    );

    const result: GenerationResult = {
      content: contentWithCitations.content,
      citations: contentWithCitations.citations,
      sources: contentWithCitations.sources,
      usedSources: usedSourceIds,
      confidence: factCheckResult.overallScore / 100,
      cached: false,
    };

    // Cache the result
    if (useCache) {
      await this.cacheContent(request, result);
    }

    return result;
  }

  /**
   * Generate content with streaming for better UX
   */
  async generateContentStream(
    request: GenerationRequest,
    callback: StreamCallback
  ): Promise<GenerationResult> {
    const {
      templateName,
      templateParams,
      retrievalQuery,
      retrievalOptions = {},
      llmOptions = {},
    } = request;

    // Get prompt template
    const template = getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Retrieve relevant context
    const contexts = await ragEngine.retrieveContext(retrievalQuery, {
      maxSources: 10,
      minSimilarity: 0.75,
      ...retrievalOptions,
    });

    if (contexts.length === 0) {
      throw new Error('No relevant sources found for content generation');
    }

    // Prepare sources with citations
    const sourcesWithCitations = await this.prepareSourcesForPrompt(contexts);

    // Build user prompt
    const userPrompt = template.buildUserPrompt({
      ...templateParams,
      sources: sourcesWithCitations,
    });

    // Accumulate streamed content
    let accumulatedContent = '';
    const streamCallback: StreamCallback = (chunk) => {
      if (!chunk.done) {
        accumulatedContent += chunk.content;
      }
      callback(chunk);
    };

    // Generate content with streaming
    await llmService.generateContentStream(
      userPrompt,
      template.systemPrompt,
      streamCallback,
      llmOptions
    );

    // Extract used source IDs
    const usedSourceIds = contexts.map(c => c.sourceId);

    // Perform fact-checking on complete content
    const factCheckResult = await this.factCheck(accumulatedContent, contexts);

    // Generate citations
    const contentWithCitations = await ragEngine.attributeSources(
      accumulatedContent,
      contexts
    );

    return {
      content: contentWithCitations.content,
      citations: contentWithCitations.citations,
      sources: contentWithCitations.sources,
      usedSources: usedSourceIds,
      confidence: factCheckResult.overallScore / 100,
      cached: false,
    };
  }

  /**
   * Generate structured output (JSON) with context
   */
  async generateStructuredContent<T>(
    request: GenerationRequest
  ): Promise<{ data: T; sources: string[]; confidence: number }> {
    const {
      templateName,
      templateParams,
      retrievalQuery,
      retrievalOptions = {},
      llmOptions = {},
    } = request;

    // Get prompt template
    const template = getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Retrieve relevant context
    const contexts = await ragEngine.retrieveContext(retrievalQuery, {
      maxSources: 10,
      minSimilarity: 0.75,
      ...retrievalOptions,
    });

    if (contexts.length === 0) {
      throw new Error('No relevant sources found for content generation');
    }

    // Prepare sources with citations
    const sourcesWithCitations = await this.prepareSourcesForPrompt(contexts);

    // Build user prompt
    const userPrompt = template.buildUserPrompt({
      ...templateParams,
      sources: sourcesWithCitations,
    });

    // Generate structured output
    const data = await llmService.generateStructuredOutput<T>(
      userPrompt,
      template.systemPrompt,
      llmOptions
    );

    // Extract used source IDs
    const usedSourceIds = contexts.map(c => c.sourceId);

    return {
      data,
      sources: usedSourceIds,
      confidence: 0.85, // Default confidence for structured output
    };
  }

  /**
   * Fact-check generated content against source material
   * Implements fact-checking requirement
   */
  async factCheck(
    generatedContent: string,
    contexts: Context[]
  ): Promise<FactCheckResult> {
    // Extract claims from generated content
    const claims = this.extractClaims(generatedContent);

    const issues: Array<{
      claim: string;
      issue: string;
      severity: 'high' | 'medium' | 'low';
    }> = [];

    // Check each claim against source material
    for (const claim of claims) {
      const isSupported = this.isClaimSupported(claim, contexts);

      if (!isSupported) {
        issues.push({
          claim,
          issue: 'Claim not found in source material',
          severity: 'high',
        });
      }
    }

    // Calculate overall accuracy score
    const totalClaims = claims.length;
    const unsupportedClaims = issues.length;
    const overallScore = totalClaims > 0
      ? ((totalClaims - unsupportedClaims) / totalClaims) * 100
      : 100;

    return {
      isAccurate: overallScore >= 80,
      issues,
      overallScore,
    };
  }

  /**
   * Handle LLM failures with fallback strategies
   * Implements fallback strategies requirement
   */
  async generateWithFallback(request: GenerationRequest): Promise<GenerationResult> {
    try {
      // Try primary generation
      return await this.generateContent(request);
    } catch (error) {
      console.error('Primary content generation failed:', error);

      // Fallback 1: Try with cached results
      const cached = await this.getCachedContent(request);
      if (cached) {
        console.log('Using cached content as fallback');
        return { ...cached, cached: true };
      }

      // Fallback 2: Try with simplified prompt (lower token limit)
      try {
        console.log('Trying with simplified prompt');
        return await this.generateContent({
          ...request,
          llmOptions: {
            ...request.llmOptions,
            maxTokens: 1000,
            temperature: 0.5,
          },
        });
      } catch (simplifiedError) {
        console.error('Simplified generation failed:', simplifiedError);

        // Fallback 3: Return error with partial content from sources
        const contexts = await ragEngine.retrieveContext(
          request.retrievalQuery,
          request.retrievalOptions
        );

        if (contexts.length > 0) {
          const fallbackContent = this.createFallbackContent(contexts);
          const contentWithCitations = await ragEngine.attributeSources(
            fallbackContent,
            contexts
          );

          return {
            content: contentWithCitations.content,
            citations: contentWithCitations.citations,
            sources: contentWithCitations.sources,
            usedSources: contexts.map(c => c.sourceId),
            confidence: 0.5, // Low confidence for fallback
            cached: false,
          };
        }

        // If all fallbacks fail, throw error
        throw new Error('Content generation failed and no fallback available');
      }
    }
  }

  /**
   * Prepare sources with citations for prompt
   */
  private async prepareSourcesForPrompt(
    contexts: Context[]
  ): Promise<Array<{ content: string; citation: string }>> {
    const client = await this.db.connect();

    try {
      const sourcesWithCitations = [];

      for (const context of contexts) {
        // Get source URL from database
        const result = await client.query(
          'SELECT source_url FROM knowledge_base WHERE id = $1',
          [context.sourceId]
        );

        const sourceUrl = result.rows[0]?.source_url || '';

        // Generate APA citation
        const citation = ragEngine.generateAPACitation(
          context.source,
          sourceUrl
        );

        sourcesWithCitations.push({
          content: context.content,
          citation,
        });
      }

      return sourcesWithCitations;
    } finally {
      client.release();
    }
  }

  /**
   * Extract factual claims from generated content
   */
  private extractClaims(content: string): string[] {
    // Simple claim extraction: split by sentences
    // In production, use NLP library for better extraction
    const sentences = content
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20); // Filter out short fragments

    // Filter to keep only declarative statements
    return sentences.filter(s => {
      // Exclude questions, citations, headers
      return (
        !s.includes('?') &&
        !s.match(/^\d+\./) && // Not a numbered list
        !s.match(/^#+/) && // Not a header
        !s.match(/^\[?\d+\]?/) // Not a citation
      );
    });
  }

  /**
   * Check if a claim is supported by source material
   */
  private isClaimSupported(claim: string, contexts: Context[]): boolean {
    const claimLower = claim.toLowerCase();
    const claimWords = claimLower.split(/\s+/).filter(w => w.length > 3);

    // Check if significant words from claim appear in sources
    for (const context of contexts) {
      const contextLower = context.content.toLowerCase();
      let matchCount = 0;

      for (const word of claimWords) {
        if (contextLower.includes(word)) {
          matchCount++;
        }
      }

      // If more than 50% of significant words match, consider supported
      if (matchCount / claimWords.length > 0.5) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create fallback content from sources when LLM fails
   */
  private createFallbackContent(contexts: Context[]): string {
    let content = 'Content generated from available sources:\n\n';

    contexts.slice(0, 3).forEach((context, index) => {
      content += `${index + 1}. ${context.content}\n\n`;
    });

    content += '\nNote: This content was compiled from source material due to generation service limitations.';

    return content;
  }

  /**
   * Get cached content
   */
  private async getCachedContent(
    request: GenerationRequest
  ): Promise<GenerationResult | null> {
    try {
      const cacheKey = this.getCacheKey(request);
      const cached = await this.redisClient.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Cache generated content
   */
  private async cacheContent(
    request: GenerationRequest,
    result: GenerationResult
  ): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(request);
      await this.redisClient.setEx(
        cacheKey,
        this.cacheTTL,
        JSON.stringify(result)
      );
    } catch (error) {
      console.error('Cache storage error:', error);
    }
  }

  /**
   * Generate cache key from request
   */
  private getCacheKey(request: GenerationRequest): string {
    const key = JSON.stringify({
      template: request.templateName,
      query: request.retrievalQuery,
      params: request.templateParams,
    });

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `${this.cachePrefix}${hash}`;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redisClient.quit();
  }
}

export const createContentGenerationService = (db: Pool) =>
  new ContentGenerationService(db);


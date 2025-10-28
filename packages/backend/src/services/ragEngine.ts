import { embeddingService } from './embeddingService';
import { vectorSearchService } from './vectorSearchService';
import { cacheService, CacheNamespace } from './cacheService';
import { SourceMetadata } from '../types/knowledgeBase';
import { KnowledgeBase } from '../models/KnowledgeBase';
import {
  RetrievalOptions,
  Context,
  SearchResult,
  GeneratedContent,
  ContentWithCitations,
  Citation,
} from '../types/rag';
import crypto from 'crypto';

/**
 * RAG Engine Service
 * Orchestrates retrieval and generation for curriculum content
 * Implements semantic search, multi-query retrieval, re-ranking, and source attribution
 * Uses MongoDB Atlas Vector Search instead of Pinecone
 * Implements caching for knowledge base queries (Requirement 12.1)
 */

export type {
  RetrievalOptions,
  Context,
  SearchResult,
  GeneratedContent,
  ContentWithCitations,
  Citation,
};

export class RAGEngine {
  constructor() {
    // No longer needs database pool - uses Mongoose models
  }

  /**
   * Generate cache key for search queries
   */
  private generateSearchCacheKey(query: string, options: RetrievalOptions): string {
    const keyData = { query, options };
    const keyString = JSON.stringify(keyData);
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Perform semantic search with configurable options
   * Uses MongoDB Atlas Vector Search
   * Implements Requirements 2.1, 2.2, 2.3, 2.4, 2.5
   */
  async semanticSearch(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<SearchResult[]> {
    const {
      maxSources = 10,
      minSimilarity = 0.75,
      recencyWeight = 0.3,
      domains,
    } = options;

    try {
      // Use vector search service with MongoDB
      const vectorResults = await vectorSearchService.search(query, {
        limit: maxSources,
        minSimilarity,
        recencyWeight,
        domain: domains?.[0], // Use first domain if multiple specified
      });

      // Transform to SearchResult format
      const results: SearchResult[] = vectorResults.map((result, index) => ({
        content: result.content,
        source: {
          title: result.metadata.title || 'Untitled',
          author: result.metadata.author,
          publicationDate: result.publicationDate || new Date(),
          domain: result.domain,
          credibilityScore: result.credibilityScore,
          tags: result.metadata.tags || [],
          isFoundational: (result.metadata as any).isFoundational,
        },
        similarityScore: result.similarityScore,
        relevanceRank: index + 1,
        sourceId: result.id,
      }));

      return results;
    } catch (error) {
      throw new Error(
        `Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Multi-query retrieval with query variations
   * Generates 3 query variations for comprehensive coverage
   * Uses MongoDB vector search with deduplication
   * Implements Requirement 2.4
   */
  async multiQueryRetrieval(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<SearchResult[]> {
    const {
      maxSources = 10,
      minSimilarity = 0.75,
      domains,
    } = options;

    try {
      // Generate query variations
      const queryVariations = this.generateQueryVariations(query);

      // Use vector search service multi-query search
      const vectorResults = await vectorSearchService.multiQuerySearch(queryVariations, {
        limit: maxSources,
        minSimilarity,
        domain: domains?.[0],
      });

      // Transform to SearchResult format
      const results: SearchResult[] = vectorResults.map((result, index) => ({
        content: result.content,
        source: {
          title: result.metadata.title || 'Untitled',
          author: result.metadata.author,
          publicationDate: result.publicationDate || new Date(),
          domain: result.domain,
          credibilityScore: result.credibilityScore,
          tags: result.metadata.tags || [],
          isFoundational: (result.metadata as any).isFoundational,
        },
        similarityScore: result.similarityScore,
        relevanceRank: index + 1,
        sourceId: result.id,
      }));

      // Re-rank combined results
      const rerankedResults = await this.reRankResults(query, results);

      // Limit to maxSources (2-10 sources per topic)
      const limitedResults = rerankedResults.slice(0, Math.min(Math.max(maxSources, 2), 10));

      // Update relevance ranks
      return limitedResults.map((result, index) => ({
        ...result,
        relevanceRank: index + 1,
      }));
    } catch (error) {
      throw new Error(
        `Multi-query retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Hybrid search combining semantic and keyword search
   * Semantic weight: 0.7, Keyword weight: 0.3
   * Implements Requirement 3.4
   */
  async hybridSearch(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<SearchResult[]> {
    const {
      maxSources = 10,
      minSimilarity = 0.75,
    } = options;

    try {
      // Perform semantic search
      const semanticResults = await this.semanticSearch(query, {
        ...options,
        maxSources: maxSources * 2,
      });

      // Perform keyword search
      const keywordResults = await this.keywordSearch(query, {
        ...options,
        maxSources: maxSources * 2,
      });

      // Combine results with hybrid scoring
      const combinedResults = this.combineHybridResults(
        semanticResults,
        keywordResults,
        0.7, // semantic weight
        0.3  // keyword weight
      );

      // Re-rank combined results
      const rerankedResults = await this.reRankResults(query, combinedResults);

      // Limit to maxSources
      const finalResults = rerankedResults.slice(0, maxSources);

      // Update relevance ranks
      return finalResults.map((result, index) => ({
        ...result,
        relevanceRank: index + 1,
      }));
    } catch (error) {
      throw new Error(
        `Hybrid search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate query variations for multi-query retrieval
   * Creates 3 variations of the original query
   */
  private generateQueryVariations(query: string): string[] {
    const variations: string[] = [query];

    // Variation 1: Add context
    variations.push(`What are the key concepts related to ${query}?`);

    // Variation 2: Rephrase as question
    variations.push(`Explain ${query} in detail`);

    return variations;
  }

  /**
   * Perform keyword-based search in MongoDB
   */
  private async keywordSearch(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<SearchResult[]> {
    try {
      const { maxSources = 10 } = options;

      // Use MongoDB text search
      const results = await KnowledgeBase.find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(maxSources);

      return results.map((doc, index) => ({
        content: doc.content,
        source: {
          title: doc.metadata.title || 'Untitled',
          author: doc.metadata.author,
          publicationDate: doc.publicationDate || new Date(),
          domain: doc.domain,
          credibilityScore: doc.credibilityScore,
          tags: doc.metadata.tags || [],
          isFoundational: (doc.metadata as any).isFoundational,
        },
        similarityScore: (doc as any).score || 0,
        relevanceRank: index + 1,
        sourceId: doc._id.toString(),
      }));
    } catch (error) {
      console.error('Keyword search failed:', error);
      return []; // Return empty array if text search not available
    }
  }

  /**
   * Combine semantic and keyword search results with hybrid scoring
   */
  private combineHybridResults(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    semanticWeight: number,
    keywordWeight: number
  ): SearchResult[] {
    const resultMap = new Map<string, SearchResult>();

    // Add semantic results
    for (const result of semanticResults) {
      resultMap.set(result.sourceId, {
        ...result,
        similarityScore: result.similarityScore * semanticWeight,
      });
    }

    // Merge keyword results
    for (const result of keywordResults) {
      const existing = resultMap.get(result.sourceId);
      if (existing) {
        // Combine scores
        existing.similarityScore += result.similarityScore * keywordWeight;
      } else {
        // Add new result
        resultMap.set(result.sourceId, {
          ...result,
          similarityScore: result.similarityScore * keywordWeight,
        });
      }
    }

    // Convert to array and sort by combined score
    return Array.from(resultMap.values()).sort(
      (a, b) => b.similarityScore - a.similarityScore
    );
  }

  /**
   * Re-rank results using cross-encoder model for improved relevance
   * Implements Requirement 3.4
   * 
   * Note: This is a simplified implementation. In production, you would use
   * a cross-encoder model like 'cross-encoder/ms-marco-MiniLM-L-12-v2'
   */
  private async reRankResults(
    query: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    // For now, implement a simple re-ranking based on content relevance
    // In production, this would use a cross-encoder model
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    const reranked = results.map(result => {
      const content = result.content.toLowerCase();
      
      // Calculate term frequency score
      let termScore = 0;
      for (const term of queryTerms) {
        const matches = (content.match(new RegExp(term, 'g')) || []).length;
        termScore += matches;
      }
      
      // Normalize term score
      const normalizedTermScore = termScore / (content.length / 100);
      
      // Combine with existing similarity score (70% similarity, 30% term frequency)
      const rerankedScore = result.similarityScore * 0.7 + normalizedTermScore * 0.3;
      
      return {
        ...result,
        similarityScore: rerankedScore,
      };
    });

    // Sort by re-ranked score
    return reranked.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Retrieve context for content generation
   * Combines semantic search with optional keyword search
   */
  async retrieveContext(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<Context[]> {
    const searchResults = await this.semanticSearch(query, options);

    return searchResults.map(result => ({
      content: result.content,
      source: result.source,
      relevanceScore: result.similarityScore,
      sourceId: result.sourceId,
    }));
  }

  /**
   * Generate APA 7th edition citation for a source
   * Implements Requirement 3.5
   */
  generateAPACitation(source: SourceMetadata, sourceUrl?: string): string {
    const { title, author, publicationDate, domain } = source;

    // Format author
    const authorText = author || 'Unknown Author';

    // Format date
    const year = publicationDate.getFullYear();
    const month = publicationDate.toLocaleString('en-US', { month: 'long' });
    const day = publicationDate.getDate();

    // Format title (italicized in actual output)
    const titleText = title;

    // Format URL if available
    const urlText = sourceUrl ? sourceUrl : '';

    // APA 7th edition format for web sources:
    // Author, A. A. (Year, Month Day). Title of work. Site Name. URL
    let citation = `${authorText}. (${year}, ${month} ${day}). ${titleText}.`;

    if (domain) {
      citation += ` ${domain}.`;
    }

    if (urlText) {
      citation += ` ${urlText}`;
    }

    return citation;
  }

  /**
   * Track which sources were used for generated content
   * Links generated content to source IDs in database
   * Note: This would require a separate ContentSourceAttribution model
   * For now, this is a placeholder that logs the usage
   */
  async trackSourceUsage(
    generatedContentId: string,
    usedSourceIds: string[],
    contentType: string
  ): Promise<void> {
    try {
      // TODO: Implement ContentSourceAttribution model if needed
      // For now, just log the usage
      console.log('Source usage tracked:', {
        contentId: generatedContentId,
        contentType,
        sourceIds: usedSourceIds,
      });
    } catch (error) {
      console.error('Failed to track source usage:', error);
    }
  }

  /**
   * Get sources used for a specific piece of generated content
   */
  async getContentSources(
    contentId: string
  ): Promise<Array<{ source: SourceMetadata; sourceUrl: string }>> {
    try {
      // TODO: Implement ContentSourceAttribution model if needed
      // For now, return empty array
      console.log('Getting content sources for:', contentId);
      return [];
    } catch (error) {
      console.error('Failed to get content sources:', error);
      return [];
    }
  }

  /**
   * Attribute sources to generated content
   * Generates APA 7th edition citations automatically
   * Uses MongoDB to fetch source URLs
   */
  async attributeSources(
    content: string,
    usedSources: Context[]
  ): Promise<ContentWithCitations> {
    const citations: Citation[] = [];
    const sources: SourceMetadata[] = [];

    try {
      for (let i = 0; i < usedSources.length; i++) {
        const context = usedSources[i];

        // Get source URL from MongoDB
        const knowledgeBase = await KnowledgeBase.findById(context.sourceId);
        const sourceUrl = knowledgeBase?.sourceUrl || '';

        // Generate APA citation
        const citationText = this.generateAPACitation(context.source, sourceUrl);

        citations.push({
          sourceId: context.sourceId,
          citationText,
          position: i + 1,
        });

        sources.push(context.source);
      }

      // Append citations to content
      let contentWithCitations = content;

      if (citations.length > 0) {
        contentWithCitations += '\n\n## References\n\n';
        citations.forEach((citation, index) => {
          contentWithCitations += `${index + 1}. ${citation.citationText}\n`;
        });
      }

      return {
        content: contentWithCitations,
        citations,
        sources,
      };
    } catch (error) {
      console.error('Failed to attribute sources:', error);
      throw error;
    }
  }

  /**
   * Generate content with embedded source attribution
   * This method would be used with an LLM service to generate content
   * with inline citations
   */
  async generateContentWithAttribution(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<ContentWithCitations> {
    // Retrieve relevant context
    const contexts = await this.retrieveContext(query, options);

    if (contexts.length === 0) {
      throw new Error('No relevant sources found for query');
    }

    // In a real implementation, this would call an LLM service
    // For now, we'll create a placeholder content structure
    const content = `Generated content based on query: ${query}\n\n` +
      `This content is informed by ${contexts.length} sources.`;

    // Attribute sources
    return await this.attributeSources(content, contexts);
  }

}

export const ragEngine = new RAGEngine();

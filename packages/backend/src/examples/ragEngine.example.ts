/**
 * RAG Engine Usage Examples
 * 
 * This file demonstrates how to use the RAG Engine for content retrieval
 * and source attribution in the Curriculum Generator App.
 */

import { Pool } from 'pg';
import { RAGEngine } from '../services/ragEngine';

// Initialize RAG Engine
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const ragEngine = new RAGEngine(db);

/**
 * Example 1: Basic Semantic Search
 * Performs semantic search with default options
 */
async function basicSemanticSearch() {
  const query = 'machine learning fundamentals';
  
  const results = await ragEngine.semanticSearch(query, {
    maxSources: 5,
    minSimilarity: 0.75,
    recencyWeight: 0.3,
  });

  console.log(`Found ${results.length} relevant sources:`);
  results.forEach(result => {
    console.log(`- ${result.source.title} (Score: ${result.similarityScore.toFixed(2)})`);
    console.log(`  Published: ${result.source.publicationDate.toISOString()}`);
    console.log(`  Credibility: ${result.source.credibilityScore}/100`);
  });
}

/**
 * Example 2: Multi-Query Retrieval
 * Uses query variations for comprehensive coverage
 */
async function multiQueryRetrieval() {
  const query = 'data visualization techniques';
  
  const results = await ragEngine.multiQueryRetrieval(query, {
    maxSources: 8,
    minSimilarity: 0.70,
  });

  console.log(`Multi-query retrieval found ${results.length} unique sources`);
  results.forEach(result => {
    console.log(`${result.relevanceRank}. ${result.source.title}`);
  });
}

/**
 * Example 3: Hybrid Search
 * Combines semantic and keyword search
 */
async function hybridSearch() {
  const query = 'neural networks deep learning';
  
  const results = await ragEngine.hybridSearch(query, {
    maxSources: 10,
    minSimilarity: 0.75,
    recencyWeight: 0.4,
  });

  console.log(`Hybrid search results (semantic + keyword):`);
  results.forEach(result => {
    console.log(`- ${result.source.title}`);
    console.log(`  Combined Score: ${result.similarityScore.toFixed(3)}`);
  });
}

/**
 * Example 4: Retrieve Context for Content Generation
 * Gets relevant context to pass to an LLM
 */
async function retrieveContextForGeneration() {
  const query = 'explain supervised learning algorithms';
  
  const contexts = await ragEngine.retrieveContext(query, {
    maxSources: 5,
    minSimilarity: 0.80,
    domains: ['machine-learning', 'artificial-intelligence'],
  });

  console.log(`Retrieved ${contexts.length} context chunks for generation:`);
  contexts.forEach((context, index) => {
    console.log(`\nContext ${index + 1}:`);
    console.log(`Source: ${context.source.title}`);
    console.log(`Relevance: ${context.relevanceScore.toFixed(2)}`);
    console.log(`Content preview: ${context.content.substring(0, 150)}...`);
  });
}

/**
 * Example 5: Generate Content with Source Attribution
 * Creates content with automatic APA citations
 */
async function generateWithAttribution() {
  const query = 'benefits of project-based learning';
  
  const result = await ragEngine.generateContentWithAttribution(query, {
    maxSources: 6,
    minSimilarity: 0.75,
  });

  console.log('Generated Content with Citations:');
  console.log(result.content);
  console.log(`\nUsed ${result.sources.length} sources`);
}

/**
 * Example 6: Track Source Usage
 * Records which sources were used for generated content
 */
async function trackSourceUsage() {
  const contentId = 'program_spec_12345';
  const sourceIds = ['src_001', 'src_002', 'src_003'];
  const contentType = 'program_specification';

  await ragEngine.trackSourceUsage(contentId, sourceIds, contentType);
  
  console.log(`Tracked ${sourceIds.length} sources for content ${contentId}`);
}

/**
 * Example 7: Get Sources for Generated Content
 * Retrieves all sources used in a piece of content
 */
async function getContentSources() {
  const contentId = 'program_spec_12345';
  
  const sources = await ragEngine.getContentSources(contentId);
  
  console.log(`Sources used in content ${contentId}:`);
  sources.forEach(({ source, sourceUrl }) => {
    console.log(`- ${source.title}`);
    console.log(`  URL: ${sourceUrl}`);
    console.log(`  Credibility: ${source.credibilityScore}/100`);
  });
}

/**
 * Example 8: Generate APA Citation
 * Creates properly formatted APA 7th edition citation
 */
async function generateAPACitation() {
  const source = {
    title: 'Machine Learning: A Probabilistic Perspective',
    author: 'Murphy, K. P.',
    publicationDate: new Date('2012-08-24'),
    domain: 'MIT Press',
    credibilityScore: 95,
    tags: ['machine-learning', 'textbook'],
  };

  const citation = ragEngine.generateAPACitation(
    source,
    'https://mitpress.mit.edu/books/machine-learning'
  );

  console.log('APA Citation:');
  console.log(citation);
}

/**
 * Example 9: Domain-Specific Search
 * Search within specific knowledge domains
 */
async function domainSpecificSearch() {
  const query = 'assessment strategies';
  
  const results = await ragEngine.semanticSearch(query, {
    maxSources: 5,
    domains: ['education', 'pedagogy'],
    minSimilarity: 0.75,
  });

  console.log('Domain-specific search results:');
  results.forEach(result => {
    console.log(`- ${result.source.title} (${result.source.domain})`);
  });
}

/**
 * Example 10: High Recency Weight Search
 * Prioritize very recent sources
 */
async function recentSourcesSearch() {
  const query = 'artificial intelligence trends';
  
  const results = await ragEngine.semanticSearch(query, {
    maxSources: 5,
    minSimilarity: 0.70,
    recencyWeight: 0.6, // High weight on recency
  });

  console.log('Recent sources (high recency weight):');
  results.forEach(result => {
    const age = new Date().getFullYear() - result.source.publicationDate.getFullYear();
    console.log(`- ${result.source.title} (${age} years old)`);
  });
}

// Export examples for testing
export {
  basicSemanticSearch,
  multiQueryRetrieval,
  hybridSearch,
  retrieveContextForGeneration,
  generateWithAttribution,
  trackSourceUsage,
  getContentSources,
  generateAPACitation,
  domainSpecificSearch,
  recentSourcesSearch,
};

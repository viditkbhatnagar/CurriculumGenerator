/**
 * Knowledge Base Service Usage Examples
 * 
 * This file demonstrates how to use the knowledge base ingestion pipeline
 * for processing documents and generating embeddings.
 */

import { Pool } from 'pg';
import { KnowledgeBaseService } from '../services/knowledgeBaseService';
import { DocumentSource } from '../types/knowledgeBase';
import fs from 'fs';

// Example 1: Ingest a PDF document
async function ingestPDFExample(db: Pool) {
  const knowledgeBaseService = new KnowledgeBaseService(db);

  // Read PDF file
  const pdfBuffer = fs.readFileSync('./path/to/document.pdf');

  const source: DocumentSource = {
    type: 'pdf',
    content: pdfBuffer,
    metadata: {
      title: 'Introduction to Machine Learning',
      author: 'John Doe',
      publicationDate: new Date('2023-01-15'),
      domain: 'machine-learning',
      credibilityScore: 0, // Will be calculated by validation service
      tags: ['machine-learning', 'ai', 'education'],
      isFoundational: false,
    },
  };

  const result = await knowledgeBaseService.ingestDocument(source);

  if (result.success) {
    console.log('Document ingested successfully!');
    console.log(`Source ID: ${result.sourceId}`);
    console.log(`Chunks processed: ${result.chunksProcessed}`);
  } else {
    console.error('Ingestion failed:', result.error);
  }
}

// Example 2: Ingest a DOCX document
async function ingestDOCXExample(db: Pool) {
  const knowledgeBaseService = new KnowledgeBaseService(db);

  const docxBuffer = fs.readFileSync('./path/to/document.docx');

  const source: DocumentSource = {
    type: 'docx',
    content: docxBuffer,
    metadata: {
      title: 'Business Intelligence Best Practices',
      author: 'Jane Smith',
      publicationDate: new Date('2022-06-20'),
      domain: 'business-intelligence',
      credibilityScore: 0,
      tags: ['business-intelligence', 'analytics', 'best-practices'],
    },
  };

  const result = await knowledgeBaseService.ingestDocument(source);
  console.log('DOCX ingestion result:', result);
}

// Example 3: Ingest content from a URL
async function ingestURLExample(db: Pool) {
  const knowledgeBaseService = new KnowledgeBaseService(db);

  const source: DocumentSource = {
    type: 'url',
    content: 'https://example.com/article/data-science-fundamentals',
    metadata: {
      title: 'Data Science Fundamentals',
      publicationDate: new Date('2023-03-10'),
      domain: 'data-science',
      credibilityScore: 0,
      tags: ['data-science', 'statistics', 'python'],
    },
  };

  const result = await knowledgeBaseService.ingestDocument(source);
  console.log('URL ingestion result:', result);
}

// Example 4: Search the knowledge base
async function searchExample(db: Pool) {
  const knowledgeBaseService = new KnowledgeBaseService(db);

  const results = await knowledgeBaseService.search(
    'What are the key principles of machine learning?',
    {
      domains: ['machine-learning', 'ai'],
      maxResults: 5,
      minSimilarity: 0.75,
      recencyWeight: 0.3, // 30% weight on recency
    }
  );

  console.log(`Found ${results.length} relevant sources:`);
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.source.title}`);
    console.log(`   Similarity: ${(result.similarityScore * 100).toFixed(1)}%`);
    console.log(`   Credibility: ${result.source.credibilityScore}/100`);
    console.log(`   Published: ${result.source.publicationDate.toISOString().split('T')[0]}`);
    console.log(`   Content preview: ${result.content.substring(0, 200)}...`);
  });
}

// Example 5: Batch ingest multiple documents
async function batchIngestExample(db: Pool) {
  const knowledgeBaseService = new KnowledgeBaseService(db);

  const sources: DocumentSource[] = [
    {
      type: 'url',
      content: 'https://ieee.org/article/neural-networks',
      metadata: {
        title: 'Neural Networks Overview',
        publicationDate: new Date('2023-01-01'),
        domain: 'machine-learning',
        credibilityScore: 0,
        tags: ['neural-networks', 'deep-learning'],
      },
    },
    {
      type: 'url',
      content: 'https://acm.org/article/supervised-learning',
      metadata: {
        title: 'Supervised Learning Techniques',
        publicationDate: new Date('2022-11-15'),
        domain: 'machine-learning',
        credibilityScore: 0,
        tags: ['supervised-learning', 'classification'],
      },
    },
  ];

  const results = await knowledgeBaseService.ingestDocuments(sources);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Batch ingestion complete: ${successful} successful, ${failed} failed`);
}

// Example 6: Get knowledge base statistics
async function getStatsExample(db: Pool) {
  const knowledgeBaseService = new KnowledgeBaseService(db);

  const stats = await knowledgeBaseService.getStats();

  console.log('Knowledge Base Statistics:');
  console.log(`Total sources: ${stats.totalSources}`);
  console.log(`Total vectors: ${stats.totalVectors}`);
  console.log(`Average credibility: ${stats.averageCredibility}/100`);
  console.log('\nDomain distribution:');
  Object.entries(stats.domainDistribution).forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count} sources`);
  });
}

// Example 7: Ingest a foundational source (older than 5 years)
async function ingestFoundationalExample(db: Pool) {
  const knowledgeBaseService = new KnowledgeBaseService(db);

  const source: DocumentSource = {
    type: 'url',
    content: 'https://example.com/classic-algorithms',
    metadata: {
      title: 'Classic Algorithms in Computer Science',
      author: 'Donald Knuth',
      publicationDate: new Date('2010-01-01'), // Older than 5 years
      domain: 'computer-science',
      credibilityScore: 0,
      tags: ['algorithms', 'computer-science', 'foundational'],
      isFoundational: true, // Mark as foundational to bypass age validation
    },
  };

  const result = await knowledgeBaseService.ingestDocument(source);
  console.log('Foundational source ingestion result:', result);
}

// Example 8: API request format for ingesting a document
const apiRequestExample = {
  method: 'POST',
  url: '/api/knowledge-base/ingest',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your-jwt-token>',
  },
  body: {
    type: 'url',
    content: 'https://example.com/article',
    metadata: {
      title: 'Article Title',
      author: 'Author Name',
      publicationDate: '2023-01-15',
      domain: 'domain-name',
      tags: ['tag1', 'tag2'],
      isFoundational: false,
    },
  },
};

// Example 9: API request format for searching
const apiSearchExample = {
  method: 'POST',
  url: '/api/knowledge-base/search',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your-jwt-token>',
  },
  body: {
    query: 'What are machine learning algorithms?',
    domains: ['machine-learning', 'ai'],
    maxResults: 10,
    minSimilarity: 0.75,
    recencyWeight: 0.3,
  },
};

export {
  ingestPDFExample,
  ingestDOCXExample,
  ingestURLExample,
  searchExample,
  batchIngestExample,
  getStatsExample,
  ingestFoundationalExample,
  apiRequestExample,
  apiSearchExample,
};

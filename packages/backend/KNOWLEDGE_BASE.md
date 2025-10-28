# Knowledge Base Ingestion Pipeline

This document describes the knowledge base ingestion pipeline implementation for the Curriculum Generator App.

## Overview

The knowledge base ingestion pipeline processes educational content from multiple sources (PDFs, DOCX files, URLs) and stores them in a vector database for semantic search and retrieval-augmented generation (RAG).

## Architecture

The pipeline consists of five main components:

1. **Document Ingestion Service** - Extracts text from various document formats
2. **Embedding Service** - Chunks documents and generates embeddings
3. **Vector Database Service** - Manages Pinecone vector database operations
4. **Source Validation Service** - Validates source credibility and compliance
5. **Knowledge Base Service** - Orchestrates the complete pipeline

## Pipeline Flow

```
Document Source → Validation → Extraction → Chunking → Embedding → Storage
                                                                      ↓
                                                            PostgreSQL + Pinecone
```

### Step-by-Step Process

1. **Validation**: Source metadata is validated for:
   - Publication date (must be within 5 years unless marked as foundational)
   - Domain exclusions (Wikipedia, blogs, AI-generated content)
   - Credibility scoring (0-100 based on source type)

2. **Extraction**: Text is extracted based on document type:
   - PDF: Using `pdf-parse` library
   - DOCX: Using `mammoth` library
   - URL: Using `axios` and `cheerio` with rate limiting

3. **Cleaning**: Extracted text is preprocessed:
   - Remove special characters
   - Normalize whitespace
   - Remove excessive line breaks

4. **Chunking**: Text is split into manageable chunks:
   - Chunk size: 512 tokens
   - Overlap: 50 tokens
   - Uses LangChain's RecursiveCharacterTextSplitter

5. **Embedding**: Chunks are converted to vector embeddings:
   - Model: OpenAI text-embedding-3-large (3072 dimensions)
   - Batch size: 100 chunks per API call
   - Retry logic with exponential backoff for rate limits

6. **Storage**: Embeddings are stored in two locations:
   - **Pinecone**: Vector embeddings with metadata
   - **PostgreSQL**: Source references and metadata

## Services

### DocumentIngestionService

Handles text extraction from multiple document formats.

**Key Features:**
- PDF parsing with `pdf-parse`
- DOCX parsing with `mammoth`
- URL scraping with rate limiting (1 request/second)
- Text cleaning and normalization

**Usage:**
```typescript
import { documentIngestionService } from './services/documentIngestionService';

const processed = await documentIngestionService.processDocument({
  type: 'pdf',
  content: pdfBuffer,
  metadata: { /* ... */ }
});
```

### EmbeddingService

Manages document chunking and embedding generation.

**Key Features:**
- LangChain text splitting (512 tokens, 50 overlap)
- OpenAI embeddings (text-embedding-3-large)
- Batch processing (100 items/batch)
- Exponential backoff retry logic

**Usage:**
```typescript
import { embeddingService } from './services/embeddingService';

const chunks = await embeddingService.chunkDocument(processedDoc);
const embeddings = await embeddingService.generateEmbeddings(chunks);
```

### VectorDatabaseService

Manages Pinecone vector database operations.

**Key Features:**
- Index initialization and management
- Namespace organization (domain/source_type)
- Batch upsert operations
- Semantic similarity search
- PostgreSQL reference management

**Usage:**
```typescript
import { VectorDatabaseService } from './services/vectorDatabaseService';

const vectorDb = new VectorDatabaseService(dbPool);
await vectorDb.initializeIndex(3072);
const embeddingIds = await vectorDb.storeEmbeddings(chunks, embeddings, sourceId);
```

### SourceValidationService

Validates source credibility and compliance.

**Key Features:**
- Publication date validation (5-year rule)
- Domain exclusion (Wikipedia, blogs, AI content)
- Credibility scoring (0-100)
- High-credibility domain detection (IEEE, ACM, etc.)

**Credibility Scoring:**
- Base score: 50
- Peer-reviewed journals: +40
- Professional associations: +30
- .gov/.edu domains: +25
- Recency bonus: 0-10 (newer = higher)
- Author presence: +5

**Usage:**
```typescript
import { sourceValidationService } from './services/sourceValidationService';

const validation = sourceValidationService.validateSource(metadata);
if (validation.isValid) {
  // Proceed with ingestion
}
```

### KnowledgeBaseService

Orchestrates the complete ingestion pipeline.

**Key Features:**
- End-to-end document processing
- Batch ingestion support
- Semantic search with filtering
- Statistics and analytics
- Source deletion

**Usage:**
```typescript
import { KnowledgeBaseService } from './services/knowledgeBaseService';

const kbService = new KnowledgeBaseService(dbPool);
await kbService.initialize();

const result = await kbService.ingestDocument(source);
const searchResults = await kbService.search(query, options);
```

## API Endpoints

### POST /api/knowledge-base/ingest
Ingest a new document into the knowledge base.

**Request:**
```json
{
  "type": "url",
  "content": "https://example.com/article",
  "metadata": {
    "title": "Article Title",
    "author": "Author Name",
    "publicationDate": "2023-01-15",
    "domain": "machine-learning",
    "tags": ["ml", "ai"],
    "isFoundational": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "sourceId": "uuid",
  "chunksProcessed": 42
}
```

### POST /api/knowledge-base/search
Search the knowledge base using semantic search.

**Request:**
```json
{
  "query": "What are machine learning algorithms?",
  "domains": ["machine-learning"],
  "maxResults": 10,
  "minSimilarity": 0.75,
  "recencyWeight": 0.3
}
```

**Response:**
```json
{
  "query": "What are machine learning algorithms?",
  "results": [
    {
      "content": "...",
      "source": {
        "title": "...",
        "publicationDate": "2023-01-15",
        "credibilityScore": 85
      },
      "similarityScore": 0.92,
      "relevanceRank": 1
    }
  ],
  "count": 5
}
```

### GET /api/knowledge-base/sources
List all sources in the knowledge base.

**Query Parameters:**
- `domain` (optional): Filter by domain
- `limit` (default: 50): Number of results
- `offset` (default: 0): Pagination offset

### DELETE /api/knowledge-base/sources/:id
Remove a source from the knowledge base.

### GET /api/knowledge-base/stats
Get knowledge base statistics.

**Response:**
```json
{
  "totalSources": 150,
  "totalVectors": 6300,
  "averageCredibility": 78,
  "domainDistribution": {
    "machine-learning": 45,
    "business-intelligence": 32,
    "data-science": 28
  }
}
```

### POST /api/knowledge-base/initialize
Initialize the knowledge base (create Pinecone indexes).

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# OpenAI API Key (for embeddings)
OPENAI_API_KEY=your-openai-api-key

# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=curriculum-knowledge-base
```

### Database Schema

The `knowledge_base` table stores source references:

```sql
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    source_url VARCHAR(500),
    source_type VARCHAR(50),
    publication_date DATE,
    domain VARCHAR(100),
    credibility_score INTEGER CHECK (credibility_score BETWEEN 0 AND 100),
    metadata JSONB,
    embedding_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Source Validation Rules

### Publication Date
- Sources must be published within the last 5 years
- Exception: Sources marked as `isFoundational: true`
- Future dates trigger warnings

### Excluded Domains
- Wikipedia (all variants)
- Blog platforms (Medium, Blogger, WordPress, Tumblr)
- AI-generated content sites (ChatGPT, Bard, Claude)

### High-Credibility Domains
- Peer-reviewed journals (IEEE, ACM, Springer, Nature, Science)
- Professional associations (PMI, SHRM, AMA, AICPA)
- Government (.gov) and educational (.edu) domains

## Performance Considerations

### Batch Processing
- Embeddings are generated in batches of 100 chunks
- Reduces API calls and improves throughput

### Rate Limiting
- URL scraping: 1 request per second
- OpenAI API: Exponential backoff on rate limits

### Caching
- Consider implementing Redis cache for frequent queries
- Cache embeddings for reused content

### Costs
- OpenAI embeddings: ~$0.13 per 1M tokens
- Pinecone: Based on index size and queries
- Estimate: ~$0.01 per document (average)

## Error Handling

### Common Errors

1. **Validation Failed**: Source doesn't meet credibility requirements
2. **Rate Limit**: OpenAI API rate limit exceeded (automatic retry)
3. **Parse Error**: Document format is corrupted or unsupported
4. **Network Error**: URL is unreachable or times out

### Retry Logic

- OpenAI API calls: 3 retries with exponential backoff
- Base delay: 1 second
- Max delay: 8 seconds (1s, 2s, 4s, 8s)

## Testing

See `src/examples/knowledgeBase.example.ts` for usage examples.

### Manual Testing

1. Initialize the knowledge base:
```bash
curl -X POST http://localhost:4000/api/knowledge-base/initialize \
  -H "Authorization: Bearer <token>"
```

2. Ingest a document:
```bash
curl -X POST http://localhost:4000/api/knowledge-base/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "type": "url",
    "content": "https://example.com/article",
    "metadata": {
      "title": "Test Article",
      "publicationDate": "2023-01-15",
      "domain": "test",
      "tags": ["test"]
    }
  }'
```

3. Search the knowledge base:
```bash
curl -X POST http://localhost:4000/api/knowledge-base/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "query": "test query",
    "maxResults": 5
  }'
```

## Future Enhancements

1. **Hybrid Search**: Combine semantic and keyword search
2. **Re-ranking**: Use cross-encoder models for improved relevance
3. **Multi-query Retrieval**: Generate query variations for better coverage
4. **Metadata Filtering**: Advanced filtering by tags, authors, dates
5. **Source Deduplication**: Detect and merge duplicate sources
6. **Incremental Updates**: Update existing sources instead of re-ingesting

## Troubleshooting

### Pinecone Connection Issues
- Verify API key is correct
- Check index name matches configuration
- Ensure index dimensions match embedding model (3072)

### OpenAI API Errors
- Verify API key has sufficient credits
- Check rate limits on your account
- Ensure model name is correct (text-embedding-3-large)

### Memory Issues
- Large PDFs may cause memory issues
- Consider streaming for files >50MB
- Implement chunking at file level for very large documents

## References

- [LangChain Documentation](https://js.langchain.com/)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Pinecone Documentation](https://docs.pinecone.io/)
- Requirements: 2.1, 2.2, 2.3, 2.4, 2.5

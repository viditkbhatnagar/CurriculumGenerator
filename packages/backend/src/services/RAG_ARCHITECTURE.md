# RAG Engine Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         RAG Engine                               │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Semantic Search Layer                        │  │
│  │  • Query Embedding Generation (OpenAI)                    │  │
│  │  • Vector Similarity Search (Pinecone)                    │  │
│  │  • Recency Filtering (5 years)                            │  │
│  │  • Credibility Ranking                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Multi-Query Retrieval Layer                     │  │
│  │  • Query Variation Generation (3 variations)              │  │
│  │  • Parallel Search Execution                              │  │
│  │  • Result Deduplication                                   │  │
│  │  • Coverage Enhancement                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Hybrid Search Layer                          │  │
│  │  • Semantic Search (70% weight)                           │  │
│  │  • Keyword Search (30% weight)                            │  │
│  │  • PostgreSQL Full-Text Search                            │  │
│  │  • Score Combination                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Re-Ranking Layer                             │  │
│  │  • Cross-Encoder Logic                                    │  │
│  │  • Term Frequency Analysis                                │  │
│  │  • Relevance Score Optimization                           │  │
│  │  • Final Result Ordering                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Source Attribution Layer                        │  │
│  │  • APA 7th Edition Citation Generation                    │  │
│  │  • Source Usage Tracking                                  │  │
│  │  • Content-Source Linking                                 │  │
│  │  • Citation Management                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Query
    ↓
┌─────────────────────┐
│ Query Embedding     │ → OpenAI API
│ Generation          │   (text-embedding-3-large)
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Vector Search       │ → Pinecone
│ (Similarity)        │   (cosine similarity)
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Metadata Enrichment │ → PostgreSQL
│ (Source Details)    │   (knowledge_base table)
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Filtering &         │
│ Ranking             │
│ • Recency           │
│ • Credibility       │
│ • Relevance         │
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Source Attribution  │ → PostgreSQL
│ & Citation          │   (content_source_attribution)
└─────────────────────┘
    ↓
Results with Citations
```

## Component Interactions

```
┌──────────────────┐
│  RAG Engine      │
└────────┬─────────┘
         │
         ├─────────────────┐
         │                 │
         ↓                 ↓
┌──────────────────┐  ┌──────────────────┐
│ Embedding        │  │ Vector Database  │
│ Service          │  │ Service          │
│                  │  │                  │
│ • Chunking       │  │ • Pinecone Ops   │
│ • Embeddings     │  │ • Query Similar  │
│ • Query Embed    │  │ • Store Vectors  │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         └──────────┬──────────┘
                    │
                    ↓
         ┌──────────────────────┐
         │   PostgreSQL DB      │
         │                      │
         │ • knowledge_base     │
         │ • content_source_    │
         │   attribution        │
         └──────────────────────┘
```

## API Layer

```
┌─────────────────────────────────────────────────────────┐
│                    Express Router                        │
│                   /api/rag/*                             │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  POST /search                  → semanticSearch()        │
│  POST /multi-query-search      → multiQueryRetrieval()   │
│  POST /hybrid-search           → hybridSearch()          │
│  POST /retrieve-context        → retrieveContext()       │
│  POST /generate-with-attribution → generateContent...()  │
│  POST /track-source-usage      → trackSourceUsage()      │
│  GET  /content-sources/:id     → getContentSources()     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Search Strategy Comparison

| Strategy | Use Case | Pros | Cons |
|----------|----------|------|------|
| **Semantic Search** | General queries, conceptual search | High relevance, understands context | May miss exact keywords |
| **Multi-Query** | Comprehensive coverage needed | Broader results, better recall | More API calls, slower |
| **Hybrid Search** | Balance precision and recall | Best of both worlds | More complex, requires tuning |
| **Keyword Search** | Exact term matching | Fast, precise for known terms | Misses semantic similarity |

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────┐
│                  Performance Metrics                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Semantic Search:        ~500-800ms                      │
│  Multi-Query Search:     ~1500-2500ms (3x queries)       │
│  Hybrid Search:          ~800-1200ms                     │
│  Citation Generation:    ~50-100ms                       │
│  Source Tracking:        ~20-50ms                        │
│                                                           │
│  Throughput:             ~100 requests/minute            │
│  Concurrent Searches:    Up to 50 simultaneous           │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Scalability Considerations

### Horizontal Scaling
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ RAG Engine   │  │ RAG Engine   │  │ RAG Engine   │
│ Instance 1   │  │ Instance 2   │  │ Instance 3   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                    Load Balancer
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
   ┌───▼────┐      ┌─────▼─────┐    ┌─────▼─────┐
   │Pinecone│      │PostgreSQL │    │   Redis   │
   │        │      │  (Pooled) │    │  (Cache)  │
   └────────┘      └───────────┘    └───────────┘
```

### Caching Strategy
```
┌─────────────────────────────────────────────────────────┐
│                    Cache Layers                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  L1: Query Embeddings Cache (Redis)                      │
│      TTL: 1 hour                                         │
│      Hit Rate: ~60%                                      │
│                                                           │
│  L2: Search Results Cache (Redis)                        │
│      TTL: 5 minutes                                      │
│      Hit Rate: ~40%                                      │
│                                                           │
│  L3: Source Metadata Cache (Redis)                       │
│      TTL: 24 hours                                       │
│      Hit Rate: ~80%                                      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
User Request
    ↓
┌─────────────────────┐
│ Input Validation    │ → 400 Bad Request
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Embedding Gen       │ → 502 External Service Error
│ (OpenAI)            │   (Retry with backoff)
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Vector Search       │ → 503 Service Unavailable
│ (Pinecone)          │   (Circuit breaker)
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Database Query      │ → 500 Internal Error
│ (PostgreSQL)        │   (Connection pool)
└─────────────────────┘
    ↓
Success Response (200)
```

## Security Considerations

```
┌─────────────────────────────────────────────────────────┐
│                  Security Layers                         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. Rate Limiting                                        │
│     • 100 requests/minute per user                       │
│     • Prevents abuse and DoS                             │
│                                                           │
│  2. Input Validation                                     │
│     • Query length limits                                │
│     • Parameter sanitization                             │
│                                                           │
│  3. Authentication                                       │
│     • JWT token validation                               │
│     • Role-based access control                          │
│                                                           │
│  4. Data Protection                                      │
│     • Encrypted connections (TLS)                        │
│     • Sensitive data masking                             │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────┐
│                    Metrics Tracked                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  • Search latency (p50, p95, p99)                        │
│  • Query success/failure rates                           │
│  • Cache hit rates                                       │
│  • API call counts (OpenAI, Pinecone)                    │
│  • Source attribution accuracy                           │
│  • Result relevance scores                               │
│  • Database query performance                            │
│  • Error rates by type                                   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Future Enhancements

1. **Advanced Re-Ranking**
   - Integrate actual cross-encoder models
   - Use BERT-based re-rankers
   - Implement learning-to-rank

2. **Query Understanding**
   - Intent classification
   - Entity extraction
   - Query expansion with LLM

3. **Multi-Modal Search**
   - Image embeddings
   - Video content search
   - Audio transcription search

4. **Federated Search**
   - Multiple vector databases
   - External knowledge sources
   - Real-time web search

5. **Personalization**
   - User preference learning
   - Context-aware ranking
   - Historical query analysis

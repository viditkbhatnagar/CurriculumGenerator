export interface DocumentSource {
  type: 'pdf' | 'docx' | 'url';
  content: string | Buffer;
  metadata: SourceMetadata;
}

export interface SourceMetadata {
  title: string;
  author?: string;
  publicationDate: Date;
  domain: string;
  credibilityScore: number; // 0-100
  tags: string[];
  isFoundational?: boolean; // Allows sources older than 5 years
}

export interface IngestionResult {
  success: boolean;
  sourceId?: string;
  embeddingIds?: string[];
  error?: string;
  chunksProcessed?: number;
}

export interface ProcessedDocument {
  text: string;
  metadata: SourceMetadata;
  cleanedText: string;
}

export interface DocumentChunk {
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata extends SourceMetadata {
  chunkIndex: number;
  totalChunks: number;
}

export interface EmbeddingResult {
  embedding: number[];
  chunkIndex: number;
}

export interface PineconeMetadata {
  content: string;
  source_url: string;
  source_type: string;
  publication_date: string;
  domain: string;
  credibility_score: number;
  tags: string[];
  chunk_index: number;
  total_chunks: number;
  title: string;
  author?: string;
}

export interface SourceValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  credibilityScore: number;
}

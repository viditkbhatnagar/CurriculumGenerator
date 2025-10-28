import { SourceMetadata } from './knowledgeBase';

export interface RetrievalOptions {
  domains?: string[];
  maxSources?: number;
  minSimilarity?: number;
  recencyWeight?: number;
  includeKeywordSearch?: boolean;
}

export interface Context {
  content: string;
  source: SourceMetadata;
  relevanceScore: number;
  sourceId: string;
}

export interface SearchResult {
  content: string;
  source: SourceMetadata;
  similarityScore: number;
  relevanceRank: number;
  sourceId: string;
}

export interface GeneratedContent {
  text: string;
  usedSources: string[]; // source IDs
  confidence: number;
}

export interface ContentWithCitations {
  content: string;
  citations: Citation[];
  sources: SourceMetadata[];
}

export interface Citation {
  sourceId: string;
  citationText: string;
  position: number;
}

export interface KnowledgeBaseSource {
  id: string;
  content: string;
  source_url: string;
  source_type: string;
  publication_date: string;
  domain: string;
  credibility_score: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  created_at: string;
}

export interface SearchFilters {
  domain?: string;
  source_type?: string;
  date_from?: string;
  date_to?: string;
  min_credibility?: number;
}

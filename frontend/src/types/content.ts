export type ContentType = "url" | "pdf" | "text";

export type ContentStatus = "pending" | "processing" | "completed" | "failed";

// FastAPI의 ContentRead 스키마에 대응
export type ContentItem = {
  id: number;
  title: string;
  url?: string | null;
  content_type: string;
  summary?: string | null;
  tags?: string[] | null;
  status: ContentStatus;
  is_public: boolean;
  created_at: string;
  updated_at?: string | null;
};

export type SearchChunk = {
  content_id: number;
  chunk_index: number;
  chunk_text: string;
  title: string;
  summary: string;
  tags: string[];
  similarity_score: number;
  user_id: number;
};

export type SearchResultItem = {
  content_id: number;
  title: string;
  summary: string;
  tags: string[];
  similarity_score: number;
  user_id: number;
  top_snippet: string;
  matched_chunks: SearchChunk[];
};

export type SemanticSearchResponse = {
  query: string;
  total: number;
  results: SearchResultItem[];
  search_type: string;
};

export type ChatSource = {
  content_id: number;
  title: string;
  chunk_index: number;
  snippet: string;
  similarity_score: number;
};

export type ChatAnswer = {
  answer: string;
  sources: ChatSource[];
  confidence: number;
};


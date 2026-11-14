export type Metadata = Record<string, string | number | boolean | null>;

export interface DocumentChunk {
  id?: number;
  source: string;
  content: string;
  metadata: Metadata;
  embedding: number[];
  createdAt?: string;
}

export interface SearchMatch {
  id: number;
  source: string;
  content: string;
  metadata: Metadata;
  score: number;
}

export interface FindMatch {
  id: number;
  source: string;
  content: string;
  metadata: Metadata;
}

export interface IndexDocumentResult {
  dryRun?: boolean;
  documents?: DocumentChunk[];
  chunks: number;
  ids: number[];
}

export interface DocumentStats {
  chunks: number;
  sources: number;
}

export interface AppStats {
  documentsDb: string;
  documents: DocumentStats;
}

export interface FindResult {
  total: number;
  limit: number;
  offset: number;
  matches: FindMatch[];
}

export type Metadata = Record<string, string | number | boolean | null>;

export interface CategoryEntry {
  id: string;
  path: string;
  description?: string;
  examples: string[];
}

export interface CategoryMatch {
  category: CategoryEntry;
  score: number;
}

export interface TaxonomyEntry {
  category: string;
  taxonomy: string;
  description?: string;
  metadata: Metadata;
}

export interface DocumentChunk {
  id?: number;
  source: string;
  content: string;
  taxonomy: TaxonomyEntry;
  embedding: number[];
  createdAt?: string;
}

export interface SearchMatch {
  id: number;
  source: string;
  content: string;
  taxonomy: TaxonomyEntry;
  score: number;
}

export interface IndexDocumentResult {
  chunks: number;
  ids: number[];
}

export type Metadata = Record<string, string | number | boolean | null>;

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

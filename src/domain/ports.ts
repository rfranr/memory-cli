import type { CategoryEntry, CategoryMatch, DocumentChunk, DocumentStats, FindResult, SearchMatch } from "./entities.js";

export interface EmbeddingClient {
  embed(input: string): Promise<number[]>;
}

export interface VectorStore {
  init(): Promise<void>;
  add(chunk: DocumentChunk): Promise<number>;
  addMany(chunks: DocumentChunk[]): Promise<number[]>;
  search(embedding: number[], limit: number): Promise<SearchMatch[]>;
  find(filters: { file?: string; text?: string; category?: string; limit: number; offset: number }): Promise<FindResult>;
  stats(): Promise<DocumentStats>;
  close(): Promise<void>;
}

export interface CategoryStore {
  init(): Promise<void>;
  upsert(category: CategoryEntry, embedding: number[]): Promise<void>;
  search(embedding: number[], limit: number): Promise<CategoryMatch[]>;
  count(): Promise<number>;
  close(): Promise<void>;
}

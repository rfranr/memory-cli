import type { CategoryEntry, CategoryMatch, DocumentChunk, DocumentStats, SearchMatch } from "./entities.js";

export interface EmbeddingClient {
  embed(input: string): Promise<number[]>;
}

export interface VectorStore {
  init(): Promise<void>;
  add(chunk: DocumentChunk): Promise<number>;
  search(embedding: number[], limit: number): Promise<SearchMatch[]>;
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

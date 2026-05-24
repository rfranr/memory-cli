import type { CategoryEntry, CategoryMatch, DocumentChunk, SearchMatch } from "./entities.js";

export interface EmbeddingClient {
  embed(input: string): Promise<number[]>;
}

export interface VectorStore {
  init(): Promise<void>;
  add(chunk: DocumentChunk): Promise<number>;
  search(embedding: number[], limit: number): Promise<SearchMatch[]>;
  close(): Promise<void>;
}

export interface CategoryStore {
  init(): Promise<void>;
  upsert(category: CategoryEntry, embedding: number[]): Promise<void>;
  search(embedding: number[], limit: number): Promise<CategoryMatch[]>;
  close(): Promise<void>;
}

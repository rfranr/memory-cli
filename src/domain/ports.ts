import type { DocumentChunk, SearchMatch } from "./entities.js";

export interface EmbeddingClient {
  embed(input: string): Promise<number[]>;
}

export interface VectorStore {
  init(): Promise<void>;
  add(chunk: DocumentChunk): Promise<number>;
  search(embedding: number[], limit: number): Promise<SearchMatch[]>;
  close(): Promise<void>;
}

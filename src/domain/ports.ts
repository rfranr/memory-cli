import type { DocumentChunk, DocumentStats, FindResult, SearchMatch } from './entities.js';

export interface EmbeddingClient {
  embed(input: string): Promise<number[]>;
  embedMany?(inputs: string[]): Promise<number[][]>;
}

export interface VectorStore {
  init(): Promise<void>;
  add(chunk: DocumentChunk): Promise<number>;
  addMany(chunks: DocumentChunk[]): Promise<number[]>;
  isDocumentCurrent(identity: string, hash: string): Promise<boolean>;
  replaceDocument(identity: string, hash: string, chunks: DocumentChunk[]): Promise<number[]>;
  search(embedding: number[], limit: number): Promise<SearchMatch[]>;
  find(filters: { file?: string; text?: string; limit: number; offset: number }): Promise<FindResult>;
  stats(): Promise<DocumentStats>;
  close(): Promise<void>;
}

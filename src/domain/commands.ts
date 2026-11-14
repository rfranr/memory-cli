import type { Metadata } from './entities.js';

export interface IndexDocumentCommand {
  dryRun?: boolean;
  input: string;
  metadata: Metadata;
}

export interface SearchCommand {
  text: string;
  limit: number;
}

export interface FindCommand {
  file?: string;
  text?: string;
  limit: number;
  offset: number;
}

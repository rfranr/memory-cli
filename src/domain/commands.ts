import type { Metadata } from "./entities.js";

export interface TaxonomySyncCommand {
  taxonomyFile: string;
}

export interface ClassifyCommand {
  input: string;
  limit: number;
}

export interface IndexDocumentCommand {
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
  category?: string;
  limit: number;
  offset: number;
}

import type { Metadata } from "./entities.js";

export interface IndexDocumentCommand {
  file: string;
  category: string;
  taxonomy: string;
  description?: string;
  metadata: Metadata;
}

export interface SearchCommand {
  text: string;
  limit: number;
}

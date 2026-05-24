import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import type { DocumentChunk, DocumentStats, SearchMatch, TaxonomyEntry } from "../../domain/entities.js";
import type { VectorStore } from "../../domain/ports.js";
import { cosineSimilarity } from "../../shared/cosine.js";

interface StoredRow {
  id: number;
  source: string;
  content: string;
  category: string;
  taxonomy: string;
  description: string | null;
  metadata_json: string;
  embedding_json: string;
  created_at: string;
}

interface CountRow {
  count: number;
}

interface ByCategoryRow {
  category: string;
  chunks: number;
}

export class SqliteVectorStore implements VectorStore {
  private db?: Database<sqlite3.Database, sqlite3.Statement>;

  constructor(private readonly filename: string) {}

  async init(): Promise<void> {
    this.db = await open({ filename: this.filename, driver: sqlite3.Database });
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        taxonomy TEXT NOT NULL,
        description TEXT,
        metadata_json TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
      CREATE INDEX IF NOT EXISTS idx_documents_taxonomy ON documents(taxonomy);
    `);
  }

  async add(chunk: DocumentChunk): Promise<number> {
    const db = this.ensureDb();
    const result = await db.run(
      `INSERT INTO documents
        (source, content, category, taxonomy, description, metadata_json, embedding_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      chunk.source,
      chunk.content,
      chunk.taxonomy.category,
      chunk.taxonomy.taxonomy,
      chunk.taxonomy.description ?? null,
      JSON.stringify(chunk.taxonomy.metadata),
      JSON.stringify(chunk.embedding),
    );

    return result.lastID ?? 0;
  }

  async search(embedding: number[], limit: number): Promise<SearchMatch[]> {
    const db = this.ensureDb();
    const rows = await db.all<StoredRow[]>(`SELECT * FROM documents`);

    return rows
      .map((row) => this.toSearchMatch(row, embedding))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  async stats(): Promise<DocumentStats> {
    const db = this.ensureDb();
    const [chunksRow, sourcesRow, categoriesRow, byCategoryRows] = await Promise.all([
      db.get<CountRow>(`SELECT count(*) AS count FROM documents`),
      db.get<CountRow>(`SELECT count(DISTINCT source) AS count FROM documents`),
      db.get<CountRow>(`SELECT count(DISTINCT category) AS count FROM documents`),
      db.all<ByCategoryRow[]>(`SELECT category, count(*) AS chunks FROM documents GROUP BY category ORDER BY chunks DESC, category ASC`),
    ]);

    return {
      chunks: chunksRow?.count ?? 0,
      sources: sourcesRow?.count ?? 0,
      categories: categoriesRow?.count ?? 0,
      byCategory: byCategoryRows.map((row) => ({ category: row.category, chunks: row.chunks })),
    };
  }

  async close(): Promise<void> {
    await this.db?.close();
    this.db = undefined;
  }

  private ensureDb(): Database<sqlite3.Database, sqlite3.Statement> {
    if (!this.db) {
      throw new Error("Vector store is not initialized");
    }

    return this.db;
  }

  private toSearchMatch(row: StoredRow, queryEmbedding: number[]): SearchMatch {
    const taxonomy: TaxonomyEntry = {
      category: row.category,
      taxonomy: row.taxonomy,
      description: row.description ?? undefined,
      metadata: JSON.parse(row.metadata_json) as TaxonomyEntry["metadata"],
    };

    return {
      id: row.id,
      source: row.source,
      content: row.content,
      taxonomy,
      score: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding_json) as number[]),
    };
  }
}

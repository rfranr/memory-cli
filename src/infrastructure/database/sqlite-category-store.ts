import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import type { CategoryEntry, CategoryMatch } from "../../domain/entities.js";
import type { CategoryStore } from "../../domain/ports.js";
import { cosineSimilarity } from "../../shared/cosine.js";

interface StoredCategoryRow {
  id: string;
  path: string;
  description: string | null;
  examples_json: string;
  embedding_json: string;
  updated_at: string;
}

export class SqliteCategoryStore implements CategoryStore {
  private db?: Database<sqlite3.Database, sqlite3.Statement>;

  constructor(private readonly filename: string) {}

  async init(): Promise<void> {
    this.db = await open({ filename: this.filename, driver: sqlite3.Database });
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        description TEXT,
        examples_json TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_categories_path ON categories(path);
    `);
  }

  async upsert(category: CategoryEntry, embedding: number[]): Promise<void> {
    const db = this.ensureDb();
    await db.run(
      `INSERT INTO categories (id, path, description, examples_json, embedding_json, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         path = excluded.path,
         description = excluded.description,
         examples_json = excluded.examples_json,
         embedding_json = excluded.embedding_json,
         updated_at = datetime('now')`,
      category.id,
      category.path,
      category.description ?? null,
      JSON.stringify(category.examples),
      JSON.stringify(embedding),
    );
  }

  async search(embedding: number[], limit: number): Promise<CategoryMatch[]> {
    const db = this.ensureDb();
    const rows = await db.all<StoredCategoryRow[]>(`SELECT * FROM categories`);

    return rows
      .map((row) => ({
        category: this.toCategory(row),
        score: cosineSimilarity(embedding, JSON.parse(row.embedding_json) as number[]),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  async close(): Promise<void> {
    await this.db?.close();
    this.db = undefined;
  }

  private ensureDb(): Database<sqlite3.Database, sqlite3.Statement> {
    if (!this.db) {
      throw new Error("Category store is not initialized");
    }

    return this.db;
  }

  private toCategory(row: StoredCategoryRow): CategoryEntry {
    return {
      id: row.id,
      path: row.path,
      description: row.description ?? undefined,
      examples: JSON.parse(row.examples_json) as string[],
    };
  }
}

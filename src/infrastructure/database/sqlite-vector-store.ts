import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import { load as loadSqliteVec } from "sqlite-vec";
import type { DocumentChunk, DocumentStats, FindMatch, FindResult, SearchMatch, TaxonomyEntry } from "../../domain/entities.js";
import type { VectorStore } from "../../domain/ports.js";
import type { IndexMetadata } from "../../shared/index-metadata.js";
import { ensureIndexMetadata } from "../../shared/index-metadata.js";

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

interface KnnRow extends StoredRow {
  distance: number;
}

interface CountRow {
  count: number;
}

interface ByCategoryRow {
  category: string;
  chunks: number;
}

interface FindFilters {
  file?: string;
  text?: string;
  category?: string;
  limit: number;
  offset: number;
}

export class SqliteVectorStore implements VectorStore {
  private db?: Database<sqlite3.Database, sqlite3.Statement>;
  private dimensions = 0;

  constructor(
    private readonly filename: string,
    private readonly metadata: IndexMetadata,
  ) {}

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
      CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);
    `);

    await ensureIndexMetadata(this.db, this.metadata, "documents index");

    this.dimensions = parseDimensions(this.metadata);

    loadSqliteVec(this.db);

    await this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_vec
      USING vec0(embedding float[${this.dimensions}]);
    `);
  }

  async add(chunk: DocumentChunk): Promise<number> {
    const db = this.ensureDb();
    const embedding = normalizeEmbedding(chunk.embedding, this.dimensions);

    await db.exec("BEGIN");
    try {
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

      const id = result.lastID ?? 0;
      await db.run(`INSERT INTO documents_vec(rowid, embedding) VALUES (?, vec_f32(?))`, id, JSON.stringify(embedding));

      await db.exec("COMMIT");
      return id;
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  }

  async search(queryEmbedding: number[], limit: number): Promise<SearchMatch[]> {
    const db = this.ensureDb();
    const normalized = normalizeEmbedding(queryEmbedding, this.dimensions);

    const knn = await db.all<Array<{ rowid: number; distance: number }>>(
      `SELECT rowid, distance
       FROM documents_vec
       WHERE embedding MATCH vec_f32(?)
       ORDER BY distance ASC
       LIMIT ?`,
      JSON.stringify(normalized),
      limit,
    );

    if (knn.length === 0) {
      return [];
    }

    knn.sort((left, right) => left.distance - right.distance || left.rowid - right.rowid);

    const ids = knn.map((row) => row.rowid);
    const placeholders = ids.map(() => "?").join(",");
    const docs = await db.all<StoredRow[]>(`SELECT * FROM documents WHERE id IN (${placeholders})`, ...ids);
    const docsById = new Map(docs.map((row) => [row.id, row] as const));

    return knn
      .map(({ rowid, distance }) => {
        const row = docsById.get(rowid);
        if (!row) {
          return undefined;
        }
        return this.toSearchMatch({ ...row, distance } as KnnRow);
      })
      .filter((match): match is SearchMatch => Boolean(match));
  }

  async find(filters: FindFilters): Promise<FindResult> {
    const db = this.ensureDb();
    const where = buildWhereClause(filters);
    const params = buildParams(filters);
    const totalRow = await db.get<CountRow>(`SELECT count(*) AS count FROM documents${where.sql}`, params);
    const rows = await db.all<StoredRow[]>(
      `SELECT * FROM documents${where.sql} ORDER BY id ASC LIMIT ? OFFSET ?`,
      ...params,
      filters.limit,
      filters.offset,
    );

    return {
      total: totalRow?.count ?? 0,
      limit: filters.limit,
      offset: filters.offset,
      matches: rows.map((row) => this.toFindMatch(row)),
    };
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

  private toSearchMatch(row: KnnRow): SearchMatch {
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
      score: l2DistanceToCosineSimilarity(row.distance),
    };
  }

  private toFindMatch(row: StoredRow): FindMatch {
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
    };
  }
}

function parseDimensions(metadata: IndexMetadata): number {
  const raw = metadata.embedding_dimensions;
  const value = Number.parseInt(raw ?? "", 10);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("documents index metadata is missing a valid embedding_dimensions");
  }

  return value;
}

function normalizeEmbedding(values: number[], dimensions: number): number[] {
  if (values.length !== dimensions) {
    throw new Error(`Embedding dimension mismatch: expected ${dimensions} values but received ${values.length}`);
  }

  let norm = 0;
  for (const value of values) {
    norm += value * value;
  }

  if (norm === 0) {
    return values.slice();
  }

  const scale = 1 / Math.sqrt(norm);
  return values.map((value) => value * scale);
}

function l2DistanceToCosineSimilarity(distance: number): number {
  // For unit-normalized vectors: ||a-b||^2 = 2 - 2cos(a,b)  => cos = 1 - d^2/2
  const similarity = 1 - (distance * distance) / 2;
  return Math.max(-1, Math.min(1, similarity));
}

function buildWhereClause(filters: FindFilters): { sql: string } {
  const clauses = buildClauses(filters);
  return { sql: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "" };
}

function buildClauses(filters: Pick<FindFilters, "file" | "text" | "category">): string[] {
  const clauses: string[] = [];

  if (filters.file) {
    clauses.push(`lower(source) LIKE ? ESCAPE '\\'`);
  }

  if (filters.text) {
    clauses.push(`lower(content) LIKE ? ESCAPE '\\'`);
  }

  if (filters.category) {
    clauses.push(`lower(category) LIKE ? ESCAPE '\\'`);
  }

  return clauses;
}

function buildParams(filters: FindFilters): string[] {
  const params: string[] = [];

  if (filters.file) {
    params.push(toLikePattern(filters.file));
  }

  if (filters.text) {
    params.push(toLikePattern(filters.text));
  }

  if (filters.category) {
    params.push(toLikePattern(filters.category));
  }

  return params;
}

function toLikePattern(value: string): string {
  return `%${escapeLike(value.toLowerCase())}%`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

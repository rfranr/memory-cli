import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import { load as loadSqliteVec } from 'sqlite-vec';
import type {
  DocumentChunk,
  DocumentStats,
  FindMatch,
  FindResult,
  SearchMatch,
  Metadata,
} from '../../domain/entities.js';
import type { VectorStore } from '../../domain/ports.js';
import type { IndexMetadata } from '../../shared/index-metadata.js';
import { ensureIndexMetadata } from '../../shared/index-metadata.js';

interface StoredRow {
  id: number;
  source: string;
  content: string;
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

interface FindFilters {
  file?: string;
  text?: string;
  limit: number;
  offset: number;
}

export class SqliteVectorStore implements VectorStore {
  private db?: Database<sqlite3.Database, sqlite3.Statement>;
  private dimensions = 0;
  private legacySchema = false;

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
        metadata_json TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);
      CREATE TABLE IF NOT EXISTS document_versions (
        identity TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        ids_json TEXT NOT NULL
      );
    `);

    // Keep legacy classification columns and their data intact; never rebuild user tables.
    const columns = await this.db.all<Array<{ name: string }>>('PRAGMA table_info(documents)');

    this.legacySchema = columns.some((column) => column.name === 'taxonomy');

    await ensureIndexMetadata(this.db, this.metadata, 'documents index');

    this.dimensions = parseDimensions(this.metadata);

    loadSqliteVec(this.db);

    await this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_vec
      USING vec0(embedding float[${this.dimensions}]);
    `);
  }

  async add(chunk: DocumentChunk): Promise<number> {
    const [id] = await this.addMany([chunk]);

    return id ?? 0;
  }

  async isDocumentCurrent(identity: string, hash: string): Promise<boolean> {
    const row = await this.ensureDb().get<{ hash: string }>(
      'SELECT hash FROM document_versions WHERE identity = ?',
      identity,
    );

    return row?.hash === hash;
  }

  async replaceDocument(identity: string, hash: string, chunks: DocumentChunk[]): Promise<number[]> {
    return this.persist(chunks, { identity, hash });
  }

  async addMany(chunks: DocumentChunk[]): Promise<number[]> {
    return this.persist(chunks);
  }

  private async removeVersion(identity: string): Promise<void> {
    const db = this.ensureDb();
    const row = await db.get<{ ids_json: string }>(
      'SELECT ids_json FROM document_versions WHERE identity = ?',
      identity,
    );

    for (const id of JSON.parse(row?.ids_json ?? '[]') as number[]) {
      await db.run('DELETE FROM documents_vec WHERE rowid = ?', id);
      await db.run('DELETE FROM documents WHERE id = ?', id);
    }
  }

  private async persist(chunks: DocumentChunk[], version?: { identity: string; hash: string }): Promise<number[]> {
    const db = this.ensureDb();
    const ids: number[] = [];

    await db.exec('BEGIN IMMEDIATE');
    try {
      if (version) {
        await this.removeVersion(version.identity);
      }

      for (const chunk of chunks) {
        const embedding = normalizeEmbedding(chunk.embedding, this.dimensions);

        const result = await db.run(
          this.legacySchema
            ? `INSERT INTO documents (source, content, metadata_json, embedding_json, category, taxonomy)
               VALUES (?, ?, ?, ?, '', '')`
            : `INSERT INTO documents (source, content, metadata_json, embedding_json) VALUES (?, ?, ?, ?)`,
          chunk.source,
          chunk.content,
          JSON.stringify(chunk.metadata),
          JSON.stringify(chunk.embedding),
        );

        const id = result.lastID ?? 0;

        ids.push(id);
        await db.run(
          `INSERT INTO documents_vec(rowid, embedding) VALUES (?, vec_f32(?))`,
          id,
          JSON.stringify(embedding),
        );
      }

      await this.saveVersion(ids, version);
      await db.exec('COMMIT');

      return ids;
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }

  private async saveVersion(ids: number[], version?: { identity: string; hash: string }): Promise<void> {
    if (!version) {
      return;
    }

    await this.ensureDb().run(
      'INSERT OR REPLACE INTO document_versions (identity, hash, ids_json) VALUES (?, ?, ?)',
      version.identity,
      version.hash,
      JSON.stringify(ids),
    );
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
    const placeholders = ids.map(() => '?').join(',');
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
    const [chunksRow, sourcesRow] = await Promise.all([
      db.get<CountRow>(`SELECT count(*) AS count FROM documents`),
      db.get<CountRow>(`SELECT count(DISTINCT source) AS count FROM documents`),
    ]);

    return {
      chunks: chunksRow?.count ?? 0,
      sources: sourcesRow?.count ?? 0,
    };
  }

  async close(): Promise<void> {
    await this.db?.close();
    this.db = undefined;
  }

  private ensureDb(): Database<sqlite3.Database, sqlite3.Statement> {
    if (!this.db) {
      throw new Error('Vector store is not initialized');
    }

    return this.db;
  }

  private toSearchMatch(row: KnnRow): SearchMatch {
    return {
      id: row.id,
      source: row.source,
      content: row.content,
      metadata: JSON.parse(row.metadata_json) as Metadata,
      score: l2DistanceToCosineSimilarity(row.distance),
    };
  }

  private toFindMatch(row: StoredRow): FindMatch {
    return {
      id: row.id,
      source: row.source,
      content: row.content,
      metadata: JSON.parse(row.metadata_json) as Metadata,
    };
  }
}

function parseDimensions(metadata: IndexMetadata): number {
  const raw = metadata.embedding_dimensions;
  const value = Number.parseInt(raw ?? '', 10);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('documents index metadata is missing a valid embedding_dimensions');
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

  return { sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '' };
}

function buildClauses(filters: Pick<FindFilters, 'file' | 'text'>): string[] {
  const clauses: string[] = [];

  if (filters.file) {
    clauses.push(`lower(source) LIKE ? ESCAPE '\\'`);
  }

  if (filters.text) {
    clauses.push(`lower(content) LIKE ? ESCAPE '\\'`);
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

  return params;
}

function toLikePattern(value: string): string {
  return `%${escapeLike(value.toLowerCase())}%`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

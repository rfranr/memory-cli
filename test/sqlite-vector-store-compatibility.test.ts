import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { load as loadSqliteVec } from 'sqlite-vec';
import { expect, it } from 'vitest';
import { SqliteVectorStore } from '../src/infrastructure/database/sqlite-vector-store.js';

const metadata = {
  embedding_provider: 'test',
  embedding_url: 'http://localhost',
  embedding_model: 'test',
  embedding_dimensions: '2',
};

it('preserves legacy rows and vectors while allowing unclassified inserts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rag-legacy-'));
  const filename = join(directory, 'docs.sqlite');
  const db = await open({ filename, driver: sqlite3.Database });
  const store = new SqliteVectorStore(filename, metadata);

  try {
    loadSqliteVec(db);
    await db.exec(`CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, content TEXT NOT NULL,
      category TEXT NOT NULL, taxonomy TEXT NOT NULL, description TEXT,
      metadata_json TEXT NOT NULL, embedding_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_documents_category ON documents(category);
    CREATE INDEX idx_documents_taxonomy ON documents(taxonomy);`);
    await store.init();
    await db.run(
      `INSERT INTO documents (id, source, content, category, taxonomy, description, metadata_json, embedding_json)
       VALUES (42, 'old.txt', 'Software design', 'architecture', 'Software / Architecture', 'Original', ?, '[1,0]')`,
      JSON.stringify({ fileName: 'old.txt', chunkIndex: 0, chunkCount: 1, categoryScore: 0.9 }),
    );
    await db.run(`INSERT INTO documents_vec(rowid, embedding) VALUES (42, '[1,0]')`);
    const before = await db.get('SELECT * FROM documents WHERE id = 42');

    await store.add({ source: 'new.txt', content: 'Music', embedding: [0, 1], metadata: { page: 2 } });
    expect(await db.get('SELECT * FROM documents WHERE id = 42')).toEqual(before);
    expect(await store.search([1, 0], 2)).toMatchObject([
      { id: 42, source: 'old.txt', score: 1, metadata: JSON.parse(before.metadata_json) },
      { source: 'new.txt', score: expect.any(Number), metadata: { page: 2 } },
    ]);
    expect(await store.find({ file: 'old', limit: 20, offset: 0 })).toMatchObject({
      total: 1,
      matches: [{ id: 42, metadata: JSON.parse(before.metadata_json) }],
    });
    expect(await store.stats()).toEqual({ chunks: 2, sources: 2 });
    await store.close();
    await store.init();
    expect((await store.search([1, 0], 1))[0].id).toBe(42);
    expect(await db.get('SELECT * FROM documents WHERE id = 42')).toEqual(before);
  } finally {
    await store.close();
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it('creates new databases without classification columns or indexes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rag-clean-'));
  const filename = join(directory, 'docs.sqlite');
  const store = new SqliteVectorStore(filename, metadata);

  try {
    await store.init();
    const db = await open({ filename, driver: sqlite3.Database });

    try {
      const columns = await db.all<Array<{ name: string }>>('PRAGMA table_info(documents)');

      expect(columns.map((column) => column.name)).toEqual([
        'id',
        'source',
        'content',
        'metadata_json',
        'embedding_json',
        'created_at',
      ]);
      const indexes = await db.all<Array<{ name: string }>>('PRAGMA index_list(documents)');

      expect(indexes.map((index) => index.name)).toEqual(['idx_documents_source']);
    } finally {
      await db.close();
    }
  } finally {
    await store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

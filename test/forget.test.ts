import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { load } from 'sqlite-vec';
import { expect, it, vi } from 'vitest';
import { IndexDocumentUseCase } from '../src/application/index-document.js';
import { RagCliApp } from '../src/core/core.js';
import { documentIdentity } from '../src/application/read-input.js';
import { SqliteVectorStore } from '../src/infrastructure/database/sqlite-vector-store.js';

it('forgets atomically, preserves other sources, and persists exclusion across restarts and edits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'forget-'));
  const filename = join(dir, 'index.sqlite');
  const source = join(dir, 'doc.txt');
  const store = new SqliteVectorStore(filename, {
    embedding_provider: 'test',
    embedding_url: 'http://localhost',
    embedding_model: 'test',
    embedding_dimensions: '2',
  });
  const embed = vi.fn(async () => [1, 0]);
  const useCase = new IndexDocumentUseCase({ embed }, store);

  await writeFile(source, 'private document');
  await store.init();
  const db = await open({ filename, driver: sqlite3.Database });

  load(db);

  try {
    await useCase.execute({ input: source, metadata: {} });
    await useCase.execute({ input: 'unrelated', metadata: { preserved: true } });
    const before = await store.find({ limit: 100, offset: 0 });
    const identity = documentIdentity(source);

    // Fail after chunk/vector removal, during tombstone insertion.
    await db.exec(`CREATE TRIGGER fail_forget BEFORE INSERT ON forgotten_documents
      BEGIN SELECT RAISE(ABORT, 'interrupted forget'); END;`);
    await expect(store.forgetDocument(identity)).rejects.toThrow('interrupted forget');
    expect(await store.find({ limit: 100, offset: 0 })).toEqual(before);
    expect(await store.search([1, 0], 100)).toHaveLength(2);
    expect(await store.isDocumentForgotten(identity)).toBe(false);
    expect(await db.get('SELECT count(*) AS n FROM document_versions')).toEqual({ n: 2 });
    await db.exec('DROP TRIGGER fail_forget');

    await store.forgetDocument(identity);
    await store.forgetDocument(identity);
    expect(await readFile(source, 'utf8')).toBe('private document');
    expect((await store.find({ limit: 100, offset: 0 })).matches).toEqual(
      before.matches.filter((match) => match.source === 'unrelated'),
    );
    expect((await store.search([1, 0], 100)).map((match) => match.source)).toEqual(['unrelated']);
    expect(await db.get('SELECT count(*) AS n FROM document_versions')).toEqual({ n: 1 });
    expect(await db.get('SELECT count(*) AS n FROM documents_vec')).toEqual({ n: 1 });
    expect(await db.get('SELECT count(*) AS n FROM documents')).toEqual({ n: 1 });

    await store.close();
    await store.init();
    embed.mockClear();
    expect(await useCase.execute({ input: source, metadata: {} })).toMatchObject({ skipped: 'forgotten' });
    await writeFile(source, 'changed private document');
    expect(await useCase.execute({ input: source, metadata: {} })).toMatchObject({ skipped: 'forgotten' });
    expect(embed).not.toHaveBeenCalled();
    expect(
      await store.replaceDocument(identity, 'new-hash', [
        { source, content: 'racing writer', metadata: {}, embedding: [1, 0] },
      ]),
    ).toEqual([]);
    expect(await store.isDocumentForgotten(identity)).toBe(true);

    const directory = join(dir, 'documents');

    await mkdir(directory);
    const nestedSource = join(directory, 'nested.txt');

    await writeFile(nestedSource, 'excluded from directory');
    const app = new RagCliApp({
      databasePath: filename,
      embeddingEndpoint: 'http://localhost',
      embeddingProvider: 'test',
      embeddingModel: 'test',
      embeddingDimensions: 2,
    });

    await app.forget(nestedSource);
    expect(await app.indexDocument({ input: directory, metadata: {} })).toMatchObject({
      chunks: 0,
      results: [{ skipped: 'forgotten' }],
    });
    expect(await app.indexDocument({ input: nestedSource, metadata: {}, dryRun: true })).toMatchObject({
      skipped: 'forgotten',
    });
  } finally {
    await db.close();
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

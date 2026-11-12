import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { RagCliApp } from '../src/core/core.js';
import { SqliteCategoryStore } from '../src/infrastructure/database/sqlite-category-store.js';

it('dry run leaves database bytes unchanged and does not create a documents database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rag-dry-'));
  const categoriesDatabasePath = join(directory, 'categories.sqlite');
  const config = {
    databasePath: join(directory, 'documents.sqlite'),
    categoriesDatabasePath,
    embeddingEndpoint: 'http://localhost/embedding',
    embeddingProvider: 'test',
    embeddingModel: 'test',
    embeddingDimensions: 2,
  };
  const categories = new SqliteCategoryStore(categoriesDatabasePath, {
    embedding_provider: 'test',
    embedding_url: config.embeddingEndpoint,
    embedding_model: 'test',
    embedding_dimensions: '2',
  });

  try {
    await categories.init();
    await categories.upsert({ id: 'notes', path: 'Notes', examples: [] }, [1, 0]);
    await categories.close();

    const before = await readFile(categoriesDatabasePath);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ embedding: [1, 0] }))),
    );
    const result = await new RagCliApp(config).indexDocument({ input: 'My note', metadata: {}, dryRun: true });

    expect(result.documents?.[0].content).toBe('My note');
    expect(await readFile(categoriesDatabasePath)).toEqual(before);
    expect(await readdir(directory)).toEqual(['categories.sqlite']);
  } finally {
    vi.unstubAllGlobals();
    await categories.close();
    await rm(directory, { recursive: true, force: true });
  }
});

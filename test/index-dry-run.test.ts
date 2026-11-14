import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { RagCliApp } from '../src/core/core.js';

it('indexes and searches without initialization; dry run never changes database bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rag-dry-'));
  const config = {
    databasePath: join(directory, 'documents.sqlite'),
    embeddingEndpoint: 'http://localhost/embedding',
    embeddingProvider: 'test',
    embeddingModel: 'test',
    embeddingDimensions: 2,
  };

  try {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ embedding: [1, 0] }))),
    );
    const app = new RagCliApp(config);
    const command = { input: 'My note', metadata: { url: 'https://example.com/note' } };
    const preview = await app.indexDocument({ ...command, dryRun: true });

    expect(preview.documents?.[0].content).toBe('My note');
    expect(await readdir(directory)).toEqual([]);
    await app.indexDocument(command);
    const before = await readFile(config.databasePath);

    await app.indexDocument({ ...command, dryRun: true });
    expect(await readFile(config.databasePath)).toEqual(before);
    const matches = await app.search({ text: 'note', limit: 1 });

    expect(matches[0]).toMatchObject({
      source: command.input,
      content: command.input,
      metadata: { url: command.metadata.url, chunkIndex: 0, chunkCount: 1, chunkStart: 0, chunkEnd: 7 },
      score: 1,
    });
    expect(await app.stats()).toEqual({
      documentsDb: config.databasePath,
      documents: { chunks: 1, sources: 1 },
    });
  } finally {
    vi.unstubAllGlobals();
    await rm(directory, { recursive: true, force: true });
  }
});

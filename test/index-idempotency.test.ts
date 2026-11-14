import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { IndexDocumentUseCase } from '../src/application/index-document.js';
import { SqliteVectorStore } from '../src/infrastructure/database/sqlite-vector-store.js';

it('atomically maintains one current version and matching vectors', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'idempotency-'));
  const input = join(dir, 'doc.txt');
  const store = new SqliteVectorStore(join(dir, 'docs.sqlite'), {
    embedding_provider: 'test',
    embedding_url: 'http://localhost',
    embedding_model: 'test',
    embedding_dimensions: '2',
  });

  await store.init();

  const embed = vi.fn(async () => [1, 0]);
  const useCase = new IndexDocumentUseCase({ embed }, store);
  const command = { input, metadata: { custom: 'kept' } };

  try {
    await writeFile(input, 'Original paragraph. '.repeat(500));

    const first = await useCase.execute(command);

    expect(first.chunks).toBeGreaterThan(1);
    expect((await store.stats()).chunks).toBe(first.chunks);
    embed.mockClear();
    expect(await useCase.execute({ ...command, input: join(dir, '.', 'doc.txt') })).toEqual({ chunks: 0, ids: [] });
    expect(embed).not.toHaveBeenCalled();

    await writeFile(input, 'Changed paragraph. '.repeat(500));

    const modified = await useCase.execute(command);

    expect((await store.stats()).chunks).toBe(modified.chunks);
    expect((await store.search([1, 0], 100)).every((row) => !row.content.includes('Original'))).toBe(true);

    await writeFile(input, 'Short current version');
    await useCase.execute(command);

    const current = await store.find({ limit: 100, offset: 0 });

    expect(current.total).toBe(1);
    expect(await store.search([1, 0], 100)).toMatchObject([{ content: 'Short current version' }]);

    await writeFile(input, 'Failed version');
    embed.mockRejectedValueOnce(new Error('endpoint failed'));
    await expect(useCase.execute(command)).rejects.toThrow('endpoint failed');
    expect(await store.find({ limit: 100, offset: 0 })).toEqual(current);

    // Force a database-side failure after deletion and the first new vector insert.
    await expect(
      store.replaceDocument(`file:${input}`, 'bad', [
        { source: input, content: 'partial', metadata: {}, embedding: [1, 0] },
        { source: input, content: 'invalid', metadata: {}, embedding: [1] },
      ]),
    ).rejects.toThrow('dimension mismatch');
    expect(await store.find({ limit: 100, offset: 0 })).toEqual(current);

    const matches = await store.search([1, 0], 100);

    expect(matches.map((row) => row.id)).toEqual(current.matches.map((row) => row.id));
    expect(matches[0].metadata.custom).toBe('kept');
    await writeFile(input, 'Short current version');
    embed.mockClear();
    await useCase.execute(command);
    expect(embed).not.toHaveBeenCalled();
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Memories } from '../src/application/memories.js';
import { SqliteVectorStore } from '../src/infrastructure/database/sqlite-vector-store.js';

async function makeStore() {
  const dir = await mkdtemp(join(tmpdir(), 'rag-cli-knn-'));
  const store = new SqliteVectorStore(join(dir, 'docs.sqlite'), {
    embedding_provider: 'test',
    embedding_url: 'http://localhost',
    embedding_model: 'test-model',
    embedding_dimensions: '2',
  });

  await store.init();

  return store;
}

describe('SqliteVectorStore.search (sqlite-vec KNN)', () => {
  it('returns nearest neighbors ordered by similarity', async () => {
    const store = await makeStore();

    await store.add({
      source: 'a',
      content: 'doc a',
      embedding: [1, 0],
      metadata: {},
    });

    await store.add({
      source: 'b',
      content: 'doc b',
      embedding: [0, 1],
      metadata: {},
    });

    const matches = await store.search([0.9, 0.1], 2);

    expect(matches).toHaveLength(2);
    expect(matches[0].source).toBe('a');
    expect(matches[0].score).toBeGreaterThan(matches[1].score);

    await store.close();
  });

  it('filters projects before top-K across explicit memories and episodic documents', async () => {
    const store = await makeStore();

    try {
      const reversi = new Memories(store, { embed: async () => [0, 1] });
      const worldgl = new Memories(store, { embed: async () => [1, 0] });

      await reversi.remember('reversi memory', 'reversi');
      await worldgl.remember('worldgl memory', 'worldgl');
      await store.add({ source: 'unscoped', content: 'legacy', metadata: {}, embedding: [1, 0] });
      await store.add({
        source: 'session',
        content: 'reversi episode',
        metadata: { project: 'reversi', kind: 'episodic' },
        embedding: [0.2, 0.8],
      });
      const matches = await store.search([1, 0], 2, 'reversi');

      expect(matches.map((match) => match.content)).toEqual(['reversi episode', 'reversi memory']);
      expect(matches.every((match) => match.metadata.project === 'reversi')).toBe(true);
      expect(await store.search([1, 0], 1, 'reversi')).toEqual(matches.slice(0, 1));
      const other = await store.search([0, 1], 2, 'worldgl');

      expect(other.map((match) => match.content)).toEqual(['worldgl memory']);
      expect(await store.search([1, 0], 2, 'missing')).toEqual([]);
      const all = await store.search([1, 0], 10);

      expect(all).toHaveLength(4);
      expect(all.some((match) => match.source === 'unscoped')).toBe(true);
      expect(all.some((match) => match.source === 'session')).toBe(true);
    } finally {
      await store.close();
    }
  });

  it('fails clearly on embedding dimension mismatch', async () => {
    const store = await makeStore();

    await expect(store.search([1, 0, 0], 1)).rejects.toThrow('Embedding dimension mismatch');

    await store.close();
  });
});

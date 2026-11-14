import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { Memories } from '../src/application/memories.js';
import { SqliteVectorStore } from '../src/infrastructure/database/sqlite-vector-store.js';

it('persists isolated explicit memories and atomically replaces and forgets their vectors', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'explicit-memory-'));
  const metadata = {
    embedding_provider: 'test',
    embedding_url: 'test',
    embedding_model: 'test',
    embedding_dimensions: '2',
  };
  let store = new SqliteVectorStore(join(dir, 'db.sqlite'), metadata);
  let vector = [1, 0];
  let fail = false;
  const provider = {
    embed: async () => {
      if (fail) {
        throw new Error('offline');
      }

      return vector;
    },
  };

  try {
    await store.init();
    let memories = new Memories(store, provider);
    const first = await memories.remember('日本語\nimportant', 'one');
    const other = await memories.remember('other', 'two');

    expect(await memories.list('one')).toEqual([first]);
    expect(await memories.get(first.id)).toEqual(first);
    expect((await store.search([1, 0], 10)).some((match) => match.metadata.memoryId === first.id)).toBe(true);
    await store.add({ source: 'session', content: 'episodic', metadata: {}, embedding: [0, 1] });
    await store.forgetDocument('session');
    expect(await memories.get(first.id)).toEqual(first);
    fail = true;
    await expect(memories.update(first.id, 'failed')).rejects.toThrow('offline');
    await expect(memories.remember('failed', 'one')).rejects.toThrow('offline');
    expect(await memories.get(first.id)).toEqual(first);
    fail = false;
    vector = [1, 2, 3];
    await expect(memories.update(first.id, 'bad dimensions')).rejects.toThrow('dimension');
    expect(await memories.get(first.id)).toEqual(first);
    vector = [0, 1];
    const updated = await memories.update(first.id, 'updated');

    expect(updated.id).toBe(first.id);
    expect(updated.createdAt).toBe(first.createdAt);
    expect((await store.search([0, 1], 10)).find((m) => m.metadata.memoryId === first.id)?.content).toBe('updated');
    await store.close();
    store = new SqliteVectorStore(join(dir, 'db.sqlite'), metadata);
    await store.init();
    memories = new Memories(store, provider);
    expect(await memories.get(first.id)).toEqual(updated);
    await memories.forget(first.id);
    await memories.forget(first.id);
    expect(await memories.get(first.id)).toBeNull();
    expect(await memories.list('one')).toEqual([]);
    expect(await memories.get(other.id)).toEqual(other);
    expect((await store.search([0, 1], 10)).some((m) => m.metadata.memoryId === first.id)).toBe(false);
    await expect(memories.get('invalid')).rejects.toThrow('Invalid');
    await expect(memories.remember(' \n', 'one')).rejects.toThrow('empty');
    await expect(memories.remember('ok', '')).rejects.toThrow('project');
    await expect(memories.remember('ok', 'one', 'global')).rejects.toThrow('scope');
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

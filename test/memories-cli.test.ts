import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { buildProgram } from '../src/cli/program.js';
import { createApp } from '../src/core/core.js';
import type { Memory } from '../src/domain/memory.js';

it('persists JSON memories across fresh CLI invocations', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'memory-cli-'));
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ embedding: [1, 0] }))),
  );
  const run = async (...args: string[]) => {
    const program = buildProgram((options) =>
      createApp({ ...options, embeddingDimensions: '2', embeddingModel: 'mock', embeddingProvider: 'mock' }),
    );

    await program.parseAsync(['node', 'memory-cli', '--db', join(dir, 'db.sqlite'), ...args]);

    return JSON.parse(String(log.mock.calls.at(-1)?.[0])) as unknown;
  };

  try {
    const memory = (await run(
      'remember',
      'Unicode 🧠\nsecond line',
      '--scope',
      'project',
      '--project',
      'demo',
    )) as Memory;

    expect(await run('memories', 'get', memory.id)).toEqual(memory);
    expect(await run('memories', 'list', '--project', 'demo')).toEqual([memory]);
    expect(await run('memories', 'list', '--project', 'other')).toEqual([]);
    const updated = (await run('memories', 'update', memory.id, 'changed')) as Memory;

    expect(updated.id).toBe(memory.id);
    expect(await run('memories', 'get', memory.id)).toEqual(updated);
    await run('memories', 'forget', memory.id);
    await run('memories', 'forget', memory.id);
    expect(await run('memories', 'get', memory.id)).toBeNull();
  } finally {
    vi.unstubAllGlobals();
    log.mockRestore();
    await rm(dir, { recursive: true, force: true });
  }
});

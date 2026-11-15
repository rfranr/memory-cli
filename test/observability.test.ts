import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { RagCliApp } from '../src/core/core.js';
import { Observability } from '../src/infrastructure/database/observability.js';
import { renderDashboard } from '../src/cli/observability.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('records operations privately, attributes explicit contexts, and preserves primary results', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'memory-traces-'));
  const app = new RagCliApp({
    databasePath: join(dir, 'db.sqlite'),
    embeddingEndpoint: 'http://localhost/embedding',
    embeddingProvider: 'test',
    embeddingModel: 'test',
    embeddingDimensions: 2,
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ embedding: [1, 0] }))),
  );
  vi.stubEnv('MEMORY_CLI_ACTOR', 'agent-test');
  vi.stubEnv('MEMORY_CLI_SESSION', 'session-1');
  try {
    const memory = (await app.remember('private content', 'reversi', 'project')) as { id: string };

    await app.search({ text: 'private query', project: 'reversi', limit: 10 });
    await app.memoryUpdate(memory.id, 'new private content');
    await expect(app.remember('secret', 'reversi', 'global')).rejects.toThrow();
    const events = await app.traces({ project: 'reversi' });

    expect(events.map((event) => event.operation)).toEqual(['remember', 'memories update', 'search', 'remember']);
    expect(events[0].status).toBe('failure');
    expect(events[1]).toMatchObject({ actor: 'agent-test', session: 'session-1', memoryIds: [memory.id] });
    expect(events[2].memoryIds).toEqual([memory.id]);
    expect(JSON.stringify(events)).not.toMatch(/private|secret|embedding/);
    expect(await app.traces({ operation: 'search', since: '2099-01-01' })).toEqual([]);
    const stats = await app.dashboard('reversi');

    expect(stats).toMatchObject({
      explicitMemories: 1,
      frequentlyRetrieved: [{ id: memory.id, retrievals: 1 }],
      neverRetrieved: [],
      recent24h: { failures: 1, reads: 1, writes: 3 },
    });
    expect(renderDashboard(stats, false)).not.toContain('\u001b');
    expect(renderDashboard(stats, true)).toContain('\u001b[36m');
    vi.stubEnv('NO_COLOR', '1');
    expect(renderDashboard(stats, true, 30)).not.toContain('\u001b');
    expect(
      renderDashboard(stats, true, 30)
        .split('\n')
        .every((line) => line.length <= 30),
    ).toBe(true);
    vi.stubEnv('MEMORY_CLI_ACTOR', '');
    vi.stubEnv('MEMORY_CLI_SESSION', '');
    await app.memoryForget(memory.id);
    expect((await app.traces({ limit: 1 }))[0]).toMatchObject({ actor: 'unknown', session: null });
    const preserved = (await app.remember('preserve through cleanup', 'reversi', 'project')) as { id: string };

    expect(await app.cleanupTraces('2099-01-01')).toBe(6);
    expect(await app.traces()).toEqual([]);
    expect(await app.memoryGet(preserved.id)).toMatchObject({ id: preserved.id });
    vi.spyOn(Observability.prototype, 'record').mockRejectedValue(new Error('telemetry unavailable'));
    await expect(app.remember('still works', 'reversi', 'project')).resolves.toBeDefined();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it('bounds retained traces without deleting memories', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'trace-retention-'));
  const filename = join(dir, 'db.sqlite');
  const telemetry = new Observability(filename);
  const event = {
    timestamp: '2026-01-01T00:00:00.000Z',
    operation: 'search',
    status: 'success',
    project: null,
    actor: 'unknown',
    session: null,
    durationMs: 2,
    count: 0,
    memoryIds: [],
  };

  try {
    await telemetry.record(event);
    const db = await open({ filename, driver: sqlite3.Database });

    await db.exec(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<10000)
      INSERT INTO operation_traces (id,timestamp,operation,status,project,actor,session,durationMs,count,memoryIds)
      SELECT 'seed-'||x,'2026-01-01T00:00:00.000Z','search','success',NULL,'unknown',NULL,2,0,'[]' FROM n`);
    await db.close();
    await telemetry.record(event);
    const rows = await telemetry.traces({ limit: 10000 });

    expect(rows).toHaveLength(10000);
    expect(rows[0].sequence).toBe(10002);
    expect(rows.at(-1)?.sequence).toBe(3);
    expect(await telemetry.cleanup('2026-01-02T00:00:00.000Z')).toBe(10000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it('traces document indexing, source deletion and embedding failure without input text', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'trace-documents-'));
  const app = new RagCliApp({
    databasePath: join(dir, 'db.sqlite'),
    embeddingEndpoint: 'http://localhost/embedding',
    embeddingProvider: 'test',
    embeddingModel: 'test',
    embeddingDimensions: 2,
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ embedding: [1, 0] }))),
  );
  try {
    await app.indexDocument({
      input: 'private document',
      metadata: { project: 'project-one', type: 'session', originalSession: 'session-one' },
    });
    expect(await app.dashboard()).toMatchObject({ indexedDocuments: 1, chunks: 1, episodicSessions: 1 });
    await app.forget('private document');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('private endpoint detail');
      }),
    );
    await expect(app.search({ text: 'private query', limit: 5 })).rejects.toThrow();
    const events = await app.traces();

    expect(events.map((event) => event.operation)).toEqual(['search', 'forget --source', 'index']);
    expect(events[0].status).toBe('failure');
    expect(events[1]).toMatchObject({ count: 1, project: 'project-one' });
    expect(events[2]).toMatchObject({ project: 'project-one', count: 1 });
    expect(JSON.stringify(events)).not.toContain('private');
    expect(await app.dashboard()).toMatchObject({ indexedDocuments: 0, chunks: 0 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

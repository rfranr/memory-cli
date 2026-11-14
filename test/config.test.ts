import { afterEach, expect, it, vi } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildConfig, defaultDatabasePath } from '../src/config/config.js';

afterEach(() => vi.unstubAllEnvs());

it('keeps explicit database paths and the environment override', () => {
  vi.stubEnv('RAG_CLI_DB', './existing.sqlite');
  const options = { envFile: '/nonexistent/memory-cli.env', embeddingDimensions: '2' };

  expect(buildConfig(options).databasePath).toBe('./existing.sqlite');
  expect(buildConfig({ ...options, db: './explicit.sqlite' }).databasePath).toBe('./explicit.sqlite');
});

it('uses an absolute persistent Linux data directory, not the working directory', () => {
  if (process.platform !== 'linux') {
    return;
  }

  vi.stubEnv('XDG_DATA_HOME', '/tmp/memory-cli-data');
  expect(defaultDatabasePath()).toBe('/tmp/memory-cli-data/memory-cli/rag.sqlite');
  vi.stubEnv('XDG_DATA_HOME', 'relative-invalid');
  expect(defaultDatabasePath()).toBe(join(homedir(), '.local', 'share', 'memory-cli', 'rag.sqlite'));
});

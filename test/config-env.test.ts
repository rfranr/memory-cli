import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildConfig } from '../src/config/config.js';

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'memory-cli-env-'));
  vi.spyOn(process, 'cwd').mockReturnValue(directory);

  for (const key of ['RAG_CLI_DB', 'RAG_CLI_EMBEDDING_DIMENSIONS', 'RAG_CLI_EMBEDDING_MODEL', 'OTHER_APP_CONFIG']) {
    vi.stubEnv(key, undefined);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

it('loads only RAG_CLI variables from the current directory', () => {
  writeFileSync(
    join(directory, '.env'),
    'RAG_CLI_DB=./local.sqlite\nRAG_CLI_EMBEDDING_DIMENSIONS=2\nOTHER_APP_CONFIG=ignored\n',
  );

  const config = buildConfig({});

  expect(config.databasePath).toBe('./local.sqlite');
  expect(config.embeddingDimensions).toBe(2);
  expect(process.env.OTHER_APP_CONFIG).toBeUndefined();
});

it('prioritizes explicit options, then process variables, then .env', () => {
  writeFileSync(join(directory, '.env'), 'RAG_CLI_DB=./local.sqlite\nRAG_CLI_EMBEDDING_DIMENSIONS=2\n');
  vi.stubEnv('RAG_CLI_DB', './process.sqlite');
  vi.stubEnv('RAG_CLI_EMBEDDING_DIMENSIONS', '3');

  expect(buildConfig({}).databasePath).toBe('./process.sqlite');
  expect(buildConfig({}).embeddingDimensions).toBe(3);
  expect(buildConfig({ db: './option.sqlite', embeddingDimensions: '4' })).toMatchObject({
    databasePath: './option.sqlite',
    embeddingDimensions: 4,
  });
});

it('preserves empty process variables and unrelated application configuration', () => {
  writeFileSync(join(directory, '.env'), 'RAG_CLI_EMBEDDING_MODEL=file-model\nOTHER_APP_CONFIG=changed\n');
  vi.stubEnv('RAG_CLI_EMBEDDING_MODEL', '');
  vi.stubEnv('OTHER_APP_CONFIG', 'original');

  expect(buildConfig({ embeddingDimensions: '2' }).embeddingModel).toBe('');
  expect(process.env.OTHER_APP_CONFIG).toBe('original');
});

it('continues without .env and does not search parent directories', () => {
  writeFileSync(join(directory, '.env'), 'RAG_CLI_DB=./parent.sqlite\n');
  const child = join(directory, 'child');

  mkdirSync(child);
  vi.mocked(process.cwd).mockReturnValue(child);
  expect(buildConfig({ embeddingDimensions: '2' }).databasePath).not.toBe('./parent.sqlite');
  expect(process.env.RAG_CLI_DB).toBeUndefined();
});
